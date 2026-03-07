# Security & Performance Review
**IRB Prime Care - WhatsApp AI Bot**  
**Date**: 2026-03-07

---

## 🔒 Security Audit

### ✅ PASSED: Secret Management

#### Environment Variables
```bash
# All sensitive credentials stored in .env files
✓ .env (root)
✓ apps/sync-klingo/.env
✓ Both files properly gitignored
✓ .env.example provided as template
```

#### No Hardcoded Secrets
```bash
# Automated scans performed:
✓ No API keys in source code (sk-, pk_live-, ghp-, xoxb- patterns)
✓ No Bearer tokens hardcoded
✓ No passwords in code
✓ All credentials loaded from process.env
```

#### Secrets Used
```typescript
// All loaded from environment variables
UAZAPI_TOKEN              // WhatsApp API authentication
KLINGO_APP_TOKEN          // Klingo External API authentication
REDIS_PASSWORD            // Redis connection (optional)
DATABASE_URL              // PostgreSQL connection string
MONGO_URI                 // MongoDB connection string
OPENAI_API_KEY            // OpenAI GPT-4o API key
```

### ✅ PASSED: SQL Injection Prevention

**ORM Usage**: Drizzle ORM with parameterized queries
```typescript
// All queries use parameterized format
await db.select()
  .from(schema.patients)
  .where(eq(schema.patients.phone, normalizedPhone))  // ✓ Parameterized

// No raw string interpolation found
// No db.query(`SELECT * FROM users WHERE id = ${userId}`)  ❌ NOT USED
```

### ✅ PASSED: Webhook Authentication

#### UAZAPI Webhook
```typescript
// apps/api/src/routes/webhooks/uazapi.ts
const WEBHOOK_TOKEN = process.env.UAZAPI_WEBHOOK_TOKEN;

if (!WEBHOOK_TOKEN) {
  console.warn('[uazapi-webhook] WEBHOOK_TOKEN not set - accepting all requests');
}

// ✓ Token validation (when configured)
if (WEBHOOK_TOKEN && req.headers['x-webhook-token'] !== WEBHOOK_TOKEN) {
  return reply.code(401).send({ error: 'Unauthorized' });
}
```

**⚠️ RECOMMENDATION**: Make `UAZAPI_WEBHOOK_TOKEN` required (reject if not set)

#### Klingo Webhook
```typescript
// apps/api/src/routes/webhooks/klingo.ts
const KLINGO_APP_TOKEN = process.env.KLINGO_APP_TOKEN;

if (!KLINGO_APP_TOKEN) {
  return reply.code(401).send({ error: 'Missing KLINGO_APP_TOKEN configuration' });
}

// ✓ Token validation (FIXED in this audit)
if (req.headers['x-app-token'] !== KLINGO_APP_TOKEN) {
  return reply.code(401).send({ error: 'Unauthorized' });
}
```

**✅ SECURE**: Rejects requests when token not configured

### ⚠️ FINDINGS: Input Validation

#### Phone Number Normalization
```typescript
// packages/shared/src/utils/phone.ts
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

// ✓ Removes non-digits
// ✓ Ensures E.164 format
// ⚠️ No validation for length (should be 12-13 digits for Brazil)
```

**⚠️ RECOMMENDATION**: Add length validation
```typescript
export function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '');
  const normalized = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  
  // Validate: Brazil = 55 + DDD (2) + number (8-9)
  if (normalized.length < 12 || normalized.length > 13) {
    return null; // Invalid
  }
  
  return normalized;
}
```

#### User Input Sanitization
```typescript
// AI context builder (apps/ai/src/context/builder.ts)
// ✓ FIXED: Null safety added
const normalizedText = (m.text || '').toLowerCase();

// ✓ OpenAI handles escaping for chat completions
// ✓ No direct eval() or Function() calls
// ✓ No shell command execution with user input
```

### ✅ PASSED: API Rate Limiting

#### BullMQ Job Processing
```typescript
// Worker concurrency controlled
const worker = new Worker(QUEUE_NAMES.AI_PIPELINE, processor, {
  connection: redisConnection,
  concurrency: 5,  // ✓ Limits parallel processing
});

// ✓ Prevents resource exhaustion
// ✓ Queue-based backpressure
```

#### External API Calls
```typescript
// No rate limiting implemented for:
// - UAZAPI calls
// - Klingo API calls
// - OpenAI API calls

// ⚠️ RISK: Could hit rate limits under high load
```

**⚠️ RECOMMENDATION**: Implement exponential backoff + retry
```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        await sleep(delay);
        continue;
      }
      
      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

### ⚠️ FINDINGS: Sensitive Data Logging

```typescript
// Several processors log patient data
console.log(`[nps] Sent NPS request to ${patient.phone} for marcacao ${klingoMarcacaoId}`);
console.log(`[appointment-confirmation] No conversation found for ${normalizedPhone}, skipping`);

// ⚠️ GDPR/LGPD concern: PII in logs
```

**⚠️ RECOMMENDATION**: Mask PII in logs
```typescript
function maskPhone(phone: string): string {
  return phone.replace(/(\d{2})(\d{2})\d{5}(\d{2})/, '$1$2*****$3');
}

console.log(`[nps] Sent NPS request to ${maskPhone(patient.phone)}`);
// Output: 5511*****99
```

### 🔒 Security Score: **8.5/10**

**Strengths:**
- ✅ No hardcoded secrets
- ✅ Environment-based configuration
- ✅ Parameterized database queries
- ✅ Webhook authentication (Klingo)
- ✅ ORM prevents SQL injection

**Weaknesses:**
- ⚠️ UAZAPI webhook accepts requests when token not set
- ⚠️ No phone number length validation
- ⚠️ No rate limiting on external APIs
- ⚠️ PII in logs (GDPR/LGPD concern)

---

## ⚡ Performance Review

### 🔴 CRITICAL: Sequential Database Queries in Loops

#### Problem: appointment-confirmation.ts
```typescript
// Lines 66-120: Sequential await in for loop
for (const apt of appointments) {
  // 2 DB queries per iteration (sequential)
  const [patient] = await db.select({ id: schema.patients.id })
    .from(schema.patients)
    .where(eq(schema.patients.phone, normalizedPhone))
    .limit(1);
    
  const conversation = await ConversationModel.findOne({
    patientPhone: normalizedPhone,
  }).sort({ lastMessageAt: -1 });
  
  await messageSendQueue.add('send', {...});
}

// ⚠️ N+1 problem: 100 appointments = 200+ sequential queries
```

**Impact**: If Klingo returns 50 appointments, this takes ~10-15 seconds (300ms per iteration)

**Fix**: Batch queries
```typescript
// 1. Collect all phones
const phones = appointments.map(apt => {
  const phone = apt.telefone?.replace(/\D/g, '');
  return phone?.startsWith('55') ? phone : `55${phone}`;
}).filter(Boolean);

// 2. Single batch query for all patients
const patients = await db.select()
  .from(schema.patients)
  .where(inArray(schema.patients.phone, phones));

const patientMap = new Map(patients.map(p => [p.phone, p]));

// 3. Single batch query for all conversations
const conversations = await ConversationModel.find({
  patientPhone: { $in: phones }
}).sort({ lastMessageAt: -1 });

const conversationMap = new Map();
conversations.forEach(c => {
  if (!conversationMap.has(c.patientPhone)) {
    conversationMap.set(c.patientPhone, c);
  }
});

// 4. Now loop is just memory operations (fast)
for (const apt of appointments) {
  const normalizedPhone = /* normalize */;
  const patient = patientMap.get(normalizedPhone);
  const conversation = conversationMap.get(normalizedPhone);
  
  if (!conversation) continue;
  
  await messageSendQueue.add('send', {...});
}
```

**Performance Gain**: 10-15s → ~1-2s (5-10x faster)

### 🟡 MEDIUM: OpenAI API Latency

```typescript
// apps/worker/src/processors/ai-pipeline.ts
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages,
  tools,
  max_tokens: 1000,
});

// ⚠️ Typical latency: 2-5 seconds
// ⚠️ P99 latency: 8-12 seconds
```

**Impact**: User waits 2-5s for AI response

**Mitigation**:
1. ✅ Already using `gpt-4o` (faster than `gpt-4`)
2. ⚠️ Consider `gpt-4o-mini` for simple queries (5x faster, 10x cheaper)
3. ⚠️ Add typing indicator immediately when job starts

**Recommendation**: Smart model routing
```typescript
// Classify message complexity first
const complexity = classifyComplexity(userMessage);

const model = complexity === 'simple' 
  ? 'gpt-4o-mini'  // 200-500ms, $0.00015/1K tokens
  : 'gpt-4o';      // 2-5s, $0.0015/1K tokens

// Save 80% on cost, 80% on latency for simple queries
```

### 🟢 GOOD: BullMQ Queue Processing

```typescript
// Concurrency controls prevent overload
concurrency: 5  // Process 5 jobs in parallel

// Job options prevent memory leaks
removeOnComplete: 100,  // Keep last 100 successful
removeOnFail: 500,      // Keep last 500 failed

// Delays prevent flooding
delay: sent * 2000,  // Stagger messages by 2 seconds
```

**✅ Well architected**: Queue-based backpressure prevents crashes

### 🟢 GOOD: Message Debouncing

```typescript
// apps/worker/src/processors/message-intake.ts
// Debounce 4 seconds - prevents duplicate AI calls
const existingJob = await aiPipelineQueue.getJob(`ai-${conversationId}-${timestamp}`);
if (existingJob) {
  await existingJob.remove();
}

await aiPipelineQueue.add('process', {...}, {
  jobId: `ai-${conversationId}-${timestamp}`,
  delay: 4000,  // ✓ Debounce window
});
```

**✅ Prevents**: User types "oi" → "oi!" → "oi! tudo bem?" from triggering 3 AI calls

### 🟡 MEDIUM: MongoDB Conversation Queries

```typescript
// No indexes defined in schema
const conversation = await ConversationModel.findOne({
  patientPhone: normalizedPhone,
}).sort({ lastMessageAt: -1 });

// ⚠️ Without index on patientPhone, this is a collection scan
```

**Recommendation**: Add compound index
```typescript
// packages/database/src/mongo/schemas/conversation.ts
conversationSchema.index({ patientPhone: 1, lastMessageAt: -1 });

// Performance: O(n) → O(log n)
// 10,000 conversations: 500ms → 5ms
```

### 🟢 GOOD: Typing Delay Calculation

```typescript
// apps/worker/src/processors/message-send.ts
function calculateTypingDelay(text: string): number {
  const delay = text.length * 40; // ~40ms per character
  return Math.min(Math.max(delay, 1500), 8000); // min 1.5s, max 8s
}

// ✓ Realistic typing simulation
// ✓ Prevents UX oddities (instant long messages)
```

### ⚡ Performance Score: **7/10**

**Strengths:**
- ✅ BullMQ queue-based architecture
- ✅ Job concurrency controls
- ✅ Message debouncing (4s)
- ✅ Typing delay simulation
- ✅ Job cleanup (removeOnComplete)

**Weaknesses:**
- 🔴 N+1 queries in appointment-confirmation loop
- 🟡 No MongoDB indexes on frequently queried fields
- 🟡 OpenAI latency (2-5s P50, 8-12s P99)
- 🟡 No caching for Klingo specialty list (fetched every time)

---

## 📊 Performance Benchmarks (Estimated)

### Message Processing Pipeline

| Stage | Latency (P50) | Latency (P99) | Bottleneck |
|-------|---------------|---------------|------------|
| UAZAPI Webhook → Intake | 50ms | 150ms | Network |
| Intake → Queue | 10ms | 30ms | Redis write |
| Debounce Wait | 4000ms | 4000ms | Intentional |
| Context Building | 100ms | 300ms | MongoDB query |
| OpenAI API Call | 2500ms | 8000ms | **🔴 Critical** |
| Tool Execution (Klingo) | 500ms | 2000ms | External API |
| Message Send → UAZAPI | 200ms | 600ms | Network |
| **Total (no tools)** | **6.8s** | **13s** | - |
| **Total (with tools)** | **7.3s** | **15s** | - |

### Cron Job Performance

| Job | Frequency | Avg Duration | Records/Run | Bottleneck |
|-----|-----------|--------------|-------------|------------|
| appointment-confirmation | Daily 14:00 | **15s** | 50 | 🔴 N+1 queries |
| appointment-reminder | Daily 07:00 | 8s | 30 | MongoDB lookup |
| nps-collection | After appt | 2s | 1 | Network |
| payment-reminder | Daily 06:00 | 5s | 20 | MongoDB lookup |
| overdue-collection | Daily 18:00 | 10s | 40 | Sequential sends |

**🔴 Critical Optimization**: Batch queries in appointment-confirmation (15s → 2s)

### Database Query Performance (Estimated)

| Query | Current | With Index | Improvement |
|-------|---------|------------|-------------|
| Find conversation by phone | 300ms | 5ms | **60x faster** |
| Find patient by Klingo ID | 50ms | 5ms | **10x faster** |
| Find appointments by date | 100ms | 10ms | **10x faster** |

**Recommendation**: Add these indexes
```typescript
// MongoDB
conversationSchema.index({ patientPhone: 1, lastMessageAt: -1 });

// PostgreSQL (Drizzle)
pgTable('patients', {
  // ...
}, (table) => ({
  phoneIdx: index('patients_phone_idx').on(table.phone),
  klingoPatientIdIdx: index('patients_klingo_patient_id_idx').on(table.klingoPatientId),
}));

pgTable('appointments', {
  // ...
}, (table) => ({
  slotTimeIdx: index('appointments_slot_time_idx').on(table.slotTime),
  statusIdx: index('appointments_status_idx').on(table.status),
}));
```

---

## 🎯 Optimization Recommendations

### Priority 1: Critical (Implement before production)

1. **Fix N+1 queries in appointment-confirmation.ts**
   - Impact: 5-10x faster cron job
   - Effort: 2 hours
   - Risk: Low (refactor existing code)

2. **Add MongoDB indexes**
   - Impact: 10-60x faster conversation lookups
   - Effort: 30 minutes
   - Risk: None (migration only)

3. **Make UAZAPI webhook token required**
   - Impact: Security vulnerability closed
   - Effort: 5 minutes
   - Risk: None

### Priority 2: High (Implement within 1 week)

4. **Implement rate limiting + retry for external APIs**
   - Impact: Prevents 429 errors, improves reliability
   - Effort: 4 hours
   - Risk: Low (additive change)

5. **Add phone number validation**
   - Impact: Prevents invalid data in DB
   - Effort: 1 hour
   - Risk: Low (validation only)

6. **Cache Klingo specialty list**
   - Impact: Reduces API calls, faster availability checks
   - Effort: 2 hours
   - Risk: Low (TTL-based cache)

### Priority 3: Medium (Implement within 1 month)

7. **Smart OpenAI model routing (mini vs full)**
   - Impact: 80% cost reduction + faster simple queries
   - Effort: 6 hours
   - Risk: Medium (requires testing for quality)

8. **Mask PII in logs**
   - Impact: GDPR/LGPD compliance
   - Effort: 4 hours
   - Risk: Low (logging only)

9. **Add PostgreSQL indexes**
   - Impact: 10x faster patient/appointment queries
   - Effort: 1 hour
   - Risk: Low (migration only)

---

## 🚨 High-Risk Areas (Monitor Post-Deployment)

### 1. OpenAI Rate Limits
```
Current: No limits configured
Risk: 429 errors during high traffic
Monitor: OpenAI dashboard for quota usage
Alert: If requests/min > 80% of quota
```

### 2. BullMQ Queue Depth
```
Current: No alerting on queue depth
Risk: Queue grows unbounded if workers crash
Monitor: BullMQ dashboard or Redis LLEN
Alert: If queue depth > 1000 jobs
```

### 3. MongoDB Connection Pool
```
Current: Default pool size (5-10)
Risk: Connection exhaustion under load
Monitor: MongoDB connection metrics
Alert: If active connections > 80% of pool
```

### 4. Klingo API Availability
```
Current: No circuit breaker
Risk: Cascading failures if Klingo down
Monitor: Klingo API response times
Alert: If error rate > 10% over 5 minutes
```

### 5. Message Send Failures
```
Current: Jobs retry 3x then fail silently
Risk: Lost messages if UAZAPI down
Monitor: BullMQ failed job count
Alert: If failed jobs > 50
```

---

## 📋 Performance Testing Plan

### Load Testing Scenarios

**Scenario 1: Message Burst**
```bash
# Simulate 100 messages arriving in 10 seconds
for i in {1..100}; do
  curl -X POST localhost:3000/webhooks/uazapi \
    -H "Content-Type: application/json" \
    -d '{"message": "test '$i'", "from": "5511999999999"}' &
done

# Expected: 
# - All messages debounced correctly
# - Queue depth < 10 (most deduplicated)
# - Response time < 200ms
```

**Scenario 2: Cron Job Stress**
```bash
# Simulate 200 appointments in confirmation job
# Expected duration: 15s current, 2s optimized
# Monitor: PostgreSQL connection count, MongoDB queries
```

**Scenario 3: Sustained Load**
```bash
# 10 messages/second for 1 hour
# Expected:
# - Queue processes without growing
# - Worker memory stable (no leaks)
# - Response times stable
```

### Metrics to Track

```yaml
api:
  - request_duration_ms (p50, p95, p99)
  - requests_per_second
  - error_rate (%)
  
worker:
  - job_duration_ms (by queue)
  - jobs_completed_per_minute
  - jobs_failed_per_minute
  - queue_depth (current)
  
external_apis:
  - uazapi_response_time_ms
  - klingo_response_time_ms
  - openai_response_time_ms
  - api_error_rate (%)
  
database:
  - postgres_query_duration_ms
  - mongo_query_duration_ms
  - connection_pool_usage (%)
  - slow_queries_count
```

---

## ✅ Security Checklist (Pre-Deploy)

- [x] .env files gitignored
- [x] No hardcoded secrets in code
- [x] Parameterized database queries (SQL injection safe)
- [x] Klingo webhook validates token
- [ ] **TODO**: UAZAPI webhook requires token
- [ ] **TODO**: Phone number length validation
- [ ] **TODO**: Rate limiting on external APIs
- [ ] **TODO**: PII masking in logs
- [ ] **TODO**: HTTPS enforced in production
- [ ] **TODO**: CORS configured correctly
- [ ] **TODO**: Security headers (helmet.js)

---

## ✅ Performance Checklist (Pre-Deploy)

- [ ] **TODO**: Fix N+1 in appointment-confirmation
- [ ] **TODO**: Add MongoDB indexes (patientPhone, lastMessageAt)
- [ ] **TODO**: Add PostgreSQL indexes (phone, klingoPatientId, slotTime)
- [ ] **TODO**: Cache Klingo specialty list (TTL: 24h)
- [x] BullMQ concurrency configured
- [x] Job cleanup (removeOnComplete/Fail)
- [x] Message debouncing (4s)
- [ ] **TODO**: Circuit breaker for Klingo API
- [ ] **TODO**: OpenAI error handling + retry
- [ ] **TODO**: Load testing performed

---

**Security Score**: 8.5/10  
**Performance Score**: 7/10  
**Production Ready**: ⚠️ **After Priority 1 fixes**
