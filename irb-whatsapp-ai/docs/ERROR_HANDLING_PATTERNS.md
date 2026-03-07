# Error Handling Patterns & Best Practices
**IRB Prime Care - WhatsApp AI Bot**

---

## Current Error Handling Review

### ✅ GOOD: BullMQ Job Error Handling

All processors correctly throw errors to trigger BullMQ retry:

```typescript
// apps/worker/src/processors/ai-pipeline.ts
export async function processAiPipeline(job: Job<AiPipelineJobData>) {
  try {
    // ... processing logic
  } catch (err) {
    console.error('[ai-pipeline] Error:', (err as Error).message);
    throw err;  // ✓ Re-throw for BullMQ retry
  }
}
```

**✅ Correct pattern**: Throwing errors triggers BullMQ's automatic retry with exponential backoff

### ✅ GOOD: Nested Try-Catch for External APIs

```typescript
// apps/worker/src/processors/ai-pipeline.ts - check_availability tool
try {
  const specialties = await klingoExt.getSpecialties();
  // ... find matching specialty
} catch (specErr) {
  console.error('[ai-pipeline] Failed to resolve specialty:', specErr);
  // ✓ Graceful fallback: return error message to user
  return {
    role: 'tool',
    content: 'Não consegui buscar as especialidades no momento...',
  };
}
```

**✅ Correct pattern**: Catch API errors, return user-friendly message instead of crashing

### ✅ GOOD: Fallback on Failure

```typescript
// apps/worker/src/processors/message-send.ts
try {
  // Send interactive buttons
  if (interactive.type === 'buttons') {
    result = await sendButtons(...);
  }
} catch (err) {
  console.error('[MESSAGE-SEND] Interactive send failed, falling back to text:', err);
  try {
    // ✓ Fallback to plain text
    const fallback = await sendText(phone, interactive.text);
    if (fallback.key?.id) lastMessageId = fallback.key.id;
  } catch (fallbackErr) {
    console.error('[MESSAGE-SEND] Fallback text also failed:', fallbackErr);
  }
}
```

**✅ Correct pattern**: Graceful degradation (buttons → text)

### ⚠️ ISSUE: Silent Failures in Cron Jobs

```typescript
// apps/worker/src/processors/appointment-reminder.ts
for (const appt of appointmentsToRemind) {
  try {
    // ... send reminder
    await messageSendQueue.add('send', {...});
    sentCount++;
  } catch (err) {
    console.error(`[appointment-reminder] Error processing appointment ${appt.id}:`, err);
    // ⚠️ Continues to next appointment - error not tracked
  }
}
```

**⚠️ Problem**: Errors logged but not aggregated. If 10/50 reminders fail, we don't know.

**Fix**: Track failures and alert if > threshold
```typescript
let sentCount = 0;
let failedCount = 0;
const failures: Array<{ id: number, error: string }> = [];

for (const appt of appointmentsToRemind) {
  try {
    await messageSendQueue.add('send', {...});
    sentCount++;
  } catch (err) {
    failedCount++;
    failures.push({ id: appt.id, error: (err as Error).message });
    console.error(`[appointment-reminder] Error processing appointment ${appt.id}:`, err);
  }
}

// Alert if failure rate > 10%
if (failedCount > 0 && failedCount / (sentCount + failedCount) > 0.1) {
  console.error(`[appointment-reminder] HIGH FAILURE RATE: ${failedCount}/${sentCount + failedCount} failed`);
  // TODO: Send alert to team
}

return { status: 'completed', sent: sentCount, failed: failedCount, failures };
```

### ⚠️ ISSUE: No Circuit Breaker for External APIs

If Klingo API is down, every request will timeout (30s default), blocking the queue.

```typescript
// Current: No circuit breaker
const response = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/agenda/horarios`, {
  headers: { 'X-APP-TOKEN': KLINGO_APP_TOKEN },
});
// ⚠️ If Klingo down, this blocks for 30s per request
```

**Fix**: Implement circuit breaker pattern
```typescript
// utils/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,        // Open after 5 failures
    private timeout = 60000,      // Stay open for 60 seconds
    private resetTimeout = 30000  // Try half-open after 30 seconds
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
        console.error(`[CircuitBreaker] OPENED after ${this.failures} failures`);
      }
      
      throw err;
    }
  }
}

// Usage
const klingoCircuitBreaker = new CircuitBreaker();

async function callKlingoAPI() {
  try {
    return await klingoCircuitBreaker.execute(async () => {
      const response = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/...`, {
        signal: AbortSignal.timeout(5000),  // 5 second timeout
      });
      if (!response.ok) throw new Error(`Klingo API error: ${response.status}`);
      return response.json();
    });
  } catch (err) {
    if (err.message === 'Circuit breaker is OPEN') {
      console.log('[Klingo] Circuit open, using fallback');
      return null;  // Return null, show booking link to user
    }
    throw err;
  }
}
```

---

## Error Categories & Handling Strategy

### 1. User Input Errors (Graceful, No Retry)

**Examples:**
- Invalid phone number format
- Invalid date selection
- Appointment slot no longer available

**Strategy:** Return user-friendly message, don't retry
```typescript
if (!isValidPhone(phone)) {
  return {
    role: 'tool',
    content: 'Número de telefone inválido. Por favor, use o formato: (11) 99999-9999',
  };
}
```

### 2. External API Errors (Retry with Backoff)

**Examples:**
- Klingo API timeout
- UAZAPI rate limit (429)
- OpenAI service unavailable (503)

**Strategy:** Retry 3x with exponential backoff, then fail gracefully
```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        console.log(`[fetchWithRetry] Rate limited, retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return response;
    } catch (err) {
      console.error(`[fetchWithRetry] Attempt ${attempt}/${maxRetries} failed:`, err);
      
      if (attempt === maxRetries) {
        throw err;
      }
      
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

### 3. Database Errors (Retry, Alert if Persistent)

**Examples:**
- Connection timeout
- Query deadlock
- Constraint violation

**Strategy:** BullMQ auto-retry, alert if fails 3x
```typescript
try {
  await db.insert(schema.appointments).values({...});
} catch (err) {
  if (err.code === '23505') {  // Unique constraint violation
    console.warn('[DB] Duplicate appointment, ignoring');
    return { status: 'duplicate' };
  }
  
  console.error('[DB] Insert failed:', err);
  throw err;  // Let BullMQ retry
}
```

### 4. Data Validation Errors (Log & Continue)

**Examples:**
- Missing required field in Klingo response
- Malformed webhook payload
- Unexpected message type

**Strategy:** Log warning, skip record, continue processing
```typescript
for (const apt of appointments) {
  if (!apt.telefone || !apt.paciente) {
    console.warn(`[validation] Skipping appointment ${apt.id}: missing required fields`);
    continue;
  }
  
  // Process valid appointment
}
```

### 5. Critical System Errors (Fail Fast, Alert)

**Examples:**
- Redis connection lost
- MongoDB connection lost
- Out of memory

**Strategy:** Throw error, stop processing, alert immediately
```typescript
// Worker startup health check
async function checkDependencies() {
  try {
    await redis.ping();
    await db.execute(sql`SELECT 1`);
    await mongoose.connection.db.admin().ping();
  } catch (err) {
    console.error('[CRITICAL] Dependency check failed:', err);
    // Send alert (email, Slack, PagerDuty)
    process.exit(1);  // Fail fast - PM2 will restart
  }
}
```

---

## Error Logging Best Practices

### ✅ DO: Structured Logging

```typescript
// Good
console.error('[ai-pipeline] OpenAI API error', {
  conversationId: job.data.conversationId,
  patientPhone: maskPhone(job.data.patientPhone),
  error: (err as Error).message,
  stack: (err as Error).stack,
  attempt: job.attemptsMade,
});

// Bad
console.error('Error:', err);
```

### ✅ DO: Include Context

```typescript
// Good
try {
  await messageSendQueue.add('send', sendJobData);
} catch (err) {
  console.error('[ai-pipeline] Failed to queue message send', {
    conversationId: sendJobData.conversationId,
    patientPhone: maskPhone(sendJobData.patientPhone),
    error: (err as Error).message,
  });
  throw err;
}

// Bad
try {
  await messageSendQueue.add('send', sendJobData);
} catch (err) {
  console.error('Queue failed:', err);
  throw err;
}
```

### ✅ DO: Mask PII in Logs

```typescript
function maskPhone(phone: string): string {
  return phone.replace(/(\d{2})(\d{2})\d{5}(\d{2})/, '$1$2*****$3');
}

function maskName(name: string): string {
  const parts = name.split(' ');
  return parts.length > 1 
    ? `${parts[0]} ${parts[parts.length - 1][0]}***`
    : `${parts[0][0]}***`;
}

// Usage
console.log('[nps] Sent to', maskPhone(patient.phone), maskName(patient.name));
// Output: [nps] Sent to 5511*****99 João S***
```

### ❌ DON'T: Log Sensitive Data

```typescript
// ❌ NEVER
console.log('[payment] Processing', {
  cardNumber: payment.cardNumber,
  cvv: payment.cvv,
  apiKey: KLINGO_APP_TOKEN,
});

// ✅ SAFE
console.log('[payment] Processing', {
  cardLast4: payment.cardNumber.slice(-4),
  amount: payment.amount,
});
```

---

## Error Monitoring & Alerting

### 1. Implement Error Tracking (Sentry)

```typescript
// apps/worker/src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  
  beforeSend(event, hint) {
    // Mask PII before sending to Sentry
    if (event.contexts?.conversationId) {
      event.contexts.conversationId = 'REDACTED';
    }
    if (event.user?.phone) {
      event.user.phone = maskPhone(event.user.phone);
    }
    return event;
  },
});

// Capture exceptions in processors
export async function processAiPipeline(job: Job<AiPipelineJobData>) {
  try {
    // ... processing
  } catch (err) {
    Sentry.captureException(err, {
      tags: {
        processor: 'ai-pipeline',
        conversationId: job.data.conversationId,
      },
      extra: {
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      },
    });
    throw err;
  }
}
```

### 2. Define Alert Thresholds

| Error Type | Threshold | Action |
|------------|-----------|--------|
| Failed jobs (any queue) | > 50 in 5 minutes | Slack alert |
| Klingo API errors | > 10% over 5 minutes | PagerDuty |
| OpenAI API errors | > 5% over 5 minutes | Email |
| Database connection lost | 1 occurrence | PagerDuty (critical) |
| Message send failures | > 20% over 15 minutes | Slack alert |
| Queue depth | > 1000 jobs | Slack alert |

### 3. Create Runbook for Common Errors

#### Error: "Circuit breaker is OPEN"
```
Cause: Klingo API is down or slow (>5 failures in 60s)
Impact: Appointment booking unavailable
Actions:
1. Check Klingo API status: curl https://api-externa.klingo.app/health
2. If Klingo down: Wait for recovery (circuit auto-closes after 30s)
3. If Klingo up but slow: Increase circuit breaker timeout
4. Notify users via WhatsApp: "Agendamento temporariamente indisponível"
```

#### Error: "Queue depth > 1000"
```
Cause: Worker processing slower than incoming rate
Impact: Delayed responses (users wait longer)
Actions:
1. Check worker CPU/memory: pm2 monit
2. If CPU > 90%: Scale workers horizontally (add instance)
3. If memory leak: Restart worker (pm2 restart irb-worker)
4. If stuck jobs: Clear failed jobs (redis-cli DEL bull:ai-pipeline:failed)
```

#### Error: "MongoDB connection lost"
```
Cause: MongoDB server unreachable or auth failed
Impact: All message processing stops
Actions:
1. Check MongoDB status: mongosh $MONGO_URI --eval "db.runCommand({ping:1})"
2. If auth error: Verify MONGO_URI in .env
3. If unreachable: Check network, restart MongoDB
4. Worker will auto-restart via PM2
```

---

## Testing Error Scenarios

### Unit Tests (Jest/Vitest)

```typescript
// apps/worker/src/processors/__tests__/ai-pipeline.test.ts
describe('processAiPipeline', () => {
  it('should retry on OpenAI rate limit', async () => {
    const mockOpenAI = jest.fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Hello' } }] });
    
    // Test implementation
  });
  
  it('should fall back to booking link when Klingo down', async () => {
    const mockKlingo = jest.fn().mockRejectedValue(new Error('Service unavailable'));
    
    const result = await processAiPipeline(job);
    
    expect(result.content).toContain('agendar pelo link');
  });
});
```

### Integration Tests (Manual)

```bash
# Test 1: Klingo API timeout
# Simulate by adding delay in Klingo mock
curl -X POST http://localhost:3000/webhooks/uazapi \
  -H "Content-Type: application/json" \
  -d '{"message": "quero agendar cardiologia"}'

# Expected: Returns booking link after timeout

# Test 2: OpenAI API error
# Set invalid OPENAI_API_KEY temporarily
OPENAI_API_KEY=invalid npm run worker

# Expected: Job fails, retries 3x, then moves to failed queue

# Test 3: MongoDB connection lost
# Stop MongoDB during processing
docker stop mongodb
curl -X POST http://localhost:3000/webhooks/uazapi \
  -d '{"message": "oi"}'

# Expected: Worker logs error, PM2 restarts worker
```

---

## Recommendations Summary

### Critical (Implement Before Production)

1. **Add failure tracking to cron jobs**
   - Track sent/failed counts
   - Alert if failure rate > 10%

2. **Implement circuit breaker for Klingo API**
   - Open after 5 failures
   - Auto-retry after 30 seconds
   - Graceful fallback to booking link

3. **Add request timeouts**
   - All fetch() calls: 5 second timeout
   - Use AbortSignal.timeout(5000)

### High Priority (Week 1)

4. **Implement retry with backoff for external APIs**
   - Max 3 retries
   - Exponential backoff: 2^attempt seconds
   - Handle 429 rate limits

5. **Add Sentry error tracking**
   - Capture all unhandled exceptions
   - Mask PII before sending
   - Set up alert rules

6. **Create error runbook**
   - Document common errors
   - Define actions for each
   - Share with team

### Medium Priority (Week 2-4)

7. **Add structured logging**
   - Include context (conversationId, jobId)
   - Mask PII (phone, name)
   - Use log levels (info, warn, error)

8. **Write error scenario tests**
   - Unit tests for retry logic
   - Integration tests for API failures
   - Load tests for queue overload

9. **Implement health checks**
   - Redis ping
   - MongoDB ping
   - PostgreSQL query
   - Fail fast on startup if dependencies down

---

**Error Handling Score**: 7/10  
**Production Ready**: ⚠️ After critical recommendations implemented
