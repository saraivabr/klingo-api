# Production Deployment Checklist
**IRB Prime Care - WhatsApp AI Bot**  
**Version**: 1.0.0  
**Target Date**: TBD

---

## Pre-Deployment (Do These First)

### 🔴 CRITICAL - Must Fix Before Deploy

- [ ] **Fix N+1 queries in appointment-confirmation.ts**
  - File: `apps/worker/src/processors/appointment-confirmation.ts`
  - Change: Batch DB queries (lines 66-120)
  - Test: Run cron manually with 50+ appointments
  - Expected: < 3 seconds total duration

- [ ] **Add MongoDB indexes**
  ```bash
  # Connect to MongoDB
  mongosh $MONGO_URI
  
  # Add indexes
  use irb_whatsapp
  db.conversations.createIndex({ patientPhone: 1, lastMessageAt: -1 })
  db.conversations.createIndex({ lastMessageAt: -1 })
  
  # Verify
  db.conversations.getIndexes()
  ```
  - Test: Query conversation by phone → should use index
  - Expected: Query time < 10ms

- [ ] **Make UAZAPI webhook token required**
  - File: `apps/api/src/routes/webhooks/uazapi.ts`
  - Change: Reject requests if `UAZAPI_WEBHOOK_TOKEN` not set
  - Test: Send request without token → should return 401
  
### 🟡 HIGH - Should Fix Before Deploy

- [ ] **Add PostgreSQL indexes**
  ```sql
  -- Run migration
  CREATE INDEX patients_phone_idx ON patients(phone);
  CREATE INDEX patients_klingo_patient_id_idx ON patients(klingo_patient_id);
  CREATE INDEX appointments_slot_time_idx ON appointments(slot_time);
  CREATE INDEX appointments_status_idx ON appointments(status);
  ```
  - Test: Explain query plans → should use indexes
  
- [ ] **Add phone number validation**
  - File: `packages/shared/src/utils/phone.ts`
  - Add: Length validation (12-13 digits)
  - Test: normalizePhone('123') → should return null
  
- [ ] **Implement retry logic for external APIs**
  - Files: Klingo calls in ai-pipeline.ts, UAZAPI calls in uazapi.ts
  - Add: Exponential backoff on 429/503 errors
  - Test: Simulate rate limit → should retry with delay

---

## Environment Setup

### 1. Environment Variables

#### Required (Fail if Missing)
```bash
# WhatsApp API
UAZAPI_URL=https://saraiva.uazapi.com
UAZAPI_TOKEN=<your-token>
UAZAPI_WEBHOOK_TOKEN=<webhook-secret>

# Klingo External API
KLINGO_EXTERNAL_BASE_URL=https://api-externa.klingo.app
KLINGO_APP_TOKEN=<your-app-token>

# OpenAI
OPENAI_API_KEY=<your-api-key>

# Databases
DATABASE_URL=postgresql://user:pass@host:5432/irb_whatsapp
MONGO_URI=mongodb://user:pass@host:27017/irb_whatsapp

# Redis
REDIS_HOST=<redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>
```

#### Optional (Default Values)
```bash
# Team Notifications
TEAM_NOTIFY_PHONE=5511999999999

# Port Configuration
PORT=3000
WORKER_CONCURRENCY=5

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

### 2. Verify .env Template
```bash
# Check .env.example is up to date
diff <(grep -oE '^[A-Z_]+=' .env.example | sort) \
     <(grep -oE 'process\.env\.[A-Z_]+' -rh apps packages | sed 's/process.env.//' | sort -u)

# Should show no missing variables
```

---

## Infrastructure Setup

### 1. PostgreSQL

```bash
# Create database
createdb irb_whatsapp

# Run migrations
cd apps/api
npm run db:migrate

# Verify tables exist
psql $DATABASE_URL -c "\dt"
# Should show: patients, appointments, doctors, services, subscriptions, etc.

# Add indexes (from HIGH priority tasks)
psql $DATABASE_URL < migrations/add_indexes.sql
```

### 2. MongoDB

```bash
# Create database and user
mongosh --eval "
  use irb_whatsapp
  db.createUser({
    user: 'irb_user',
    pwd: '<password>',
    roles: [{ role: 'readWrite', db: 'irb_whatsapp' }]
  })
"

# Add indexes
mongosh $MONGO_URI --eval "
  use irb_whatsapp
  db.conversations.createIndex({ patientPhone: 1, lastMessageAt: -1 })
  db.conversations.createIndex({ lastMessageAt: -1 })
"

# Verify
mongosh $MONGO_URI --eval "db.conversations.getIndexes()"
```

### 3. Redis

```bash
# Start Redis (Docker)
docker run -d \
  --name redis \
  -p 6379:6379 \
  -e REDIS_PASSWORD=<password> \
  redis:7-alpine \
  redis-server --requirepass <password>

# Test connection
redis-cli -h localhost -p 6379 -a <password> PING
# Should return: PONG

# Optional: Enable persistence
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes --requirepass <password>
```

### 4. Process Manager (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'irb-api',
      cwd: './apps/api',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'irb-worker',
      cwd: './apps/worker',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WORKER_CONCURRENCY: 5,
      },
      error_file: 'logs/worker-error.log',
      out_file: 'logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      cron_restart: '0 4 * * *',  // Restart daily at 4 AM
    },
  ],
};
EOF

# Start services
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Setup startup script
pm2 startup
```

---

## Build & Deploy

### 1. Build Application

```bash
# Install dependencies
npm install

# Run build
npm run build

# Verify all packages built
ls -la apps/*/dist packages/*/dist
# Should show dist folders with compiled JS

# Check for TypeScript errors
npm run build 2>&1 | grep -i error
# Should be empty
```

### 2. Start Services

```bash
# Start API server
cd apps/api
NODE_ENV=production PORT=3000 node dist/index.js &

# Start worker
cd apps/worker
NODE_ENV=production node dist/index.js &

# Or use PM2
pm2 start ecosystem.config.js
```

### 3. Health Checks

```bash
# API health
curl http://localhost:3000/health
# Should return: {"status":"ok"}

# Check worker is processing
pm2 logs irb-worker --lines 20
# Should show: [worker] Connected to Redis, processing jobs...

# Check BullMQ queues
redis-cli -a <password> KEYS "bull:*"
# Should show queue keys: bull:message-intake, bull:ai-pipeline, etc.
```

---

## Webhook Configuration

### 1. UAZAPI Webhook

```bash
# Configure webhook in UAZAPI dashboard
# URL: https://your-domain.com/webhooks/uazapi
# Method: POST
# Headers:
#   Content-Type: application/json
#   x-webhook-token: <UAZAPI_WEBHOOK_TOKEN>

# Test webhook
curl -X POST https://your-domain.com/webhooks/uazapi \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: $UAZAPI_WEBHOOK_TOKEN" \
  -d '{
    "key": {"remoteJid": "5511999999999@s.whatsapp.net"},
    "message": {"conversation": "test"},
    "messageType": "conversation"
  }'

# Should return: {"status":"ok"}
```

### 2. Klingo Webhook

```bash
# Configure webhook in Klingo dashboard
# Events: STATUS-MARCACAO, REMARCACAO, CHAMADA
# URL: https://your-domain.com/webhooks/klingo
# Method: POST
# Headers:
#   Content-Type: application/json
#   X-APP-TOKEN: <KLINGO_APP_TOKEN>

# Test webhook
curl -X POST https://your-domain.com/webhooks/klingo \
  -H "Content-Type: application/json" \
  -H "X-APP-TOKEN: $KLINGO_APP_TOKEN" \
  -d '{
    "evento": "STATUS-MARCACAO",
    "id_paciente": 123,
    "id_marcacao": 456,
    "status": "confirmado"
  }'

# Should return: {"status":"ok"}
```

---

## Testing in Production

### 1. Smoke Tests

#### Test 1: Incoming Message
```bash
# Send test message via WhatsApp to bot number
# Expected flow:
# 1. UAZAPI webhook receives → returns 200
# 2. message-intake queues job
# 3. ai-pipeline processes → calls GPT-4o
# 4. message-send sends response → UAZAPI
# 5. User receives reply in WhatsApp

# Monitor logs
pm2 logs irb-worker --lines 50 | grep -i "test"
```

#### Test 2: Check Availability
```
User: "Quero agendar consulta"
Bot: "Qual especialidade?"
User: "Cardiologia"
Bot: [Shows list of available slots]

# Verify:
# - Klingo API called successfully
# - Specialty resolved to ID
# - Slots returned and formatted
```

#### Test 3: Book Appointment
```
User: Selects slot from list
Bot: "Prontinho! Agendamento confirmado 🎉"
Bot: Sends location

# Verify in DB:
psql $DATABASE_URL -c "SELECT * FROM appointments ORDER BY created_at DESC LIMIT 1;"
# Should show: klingoVoucherId, klingoReservationId populated

# Verify in Klingo dashboard:
# Appointment should appear with status "Confirmado"
```

#### Test 4: Cron Jobs
```bash
# Manually trigger appointment confirmation
redis-cli -a <password> LPUSH "bull:appointment-confirmation:wait" '{"data":{}}'

# Monitor execution
pm2 logs irb-worker | grep -i confirmation

# Verify:
# - Fetched tomorrow's appointments from Klingo
# - Sent confirmation messages
# - No errors in logs
```

### 2. Load Test

```bash
# Install k6 (load testing tool)
brew install k6

# Create load test script
cat > loadtest.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 RPS
    { duration: '5m', target: 10 },  // Stay at 10 RPS
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const payload = JSON.stringify({
    key: { remoteJid: `5511${Math.floor(Math.random() * 100000000)}@s.whatsapp.net` },
    message: { conversation: 'oi' },
    messageType: 'conversation',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-token': __ENV.WEBHOOK_TOKEN,
    },
  };

  let res = http.post('http://localhost:3000/webhooks/uazapi', payload, params);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
EOF

# Run load test
WEBHOOK_TOKEN=$UAZAPI_WEBHOOK_TOKEN k6 run loadtest.js

# Monitor during test
watch -n 1 'pm2 status && redis-cli -a <password> LLEN bull:ai-pipeline:wait'
```

**Success Criteria:**
- ✅ API response time P95 < 500ms
- ✅ Zero 500 errors
- ✅ Queue depth stays < 100
- ✅ Worker CPU < 80%
- ✅ Memory stable (no leaks)

---

## Monitoring Setup

### 1. Application Logs

```bash
# PM2 log management
pm2 install pm2-logrotate

pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

# View logs
pm2 logs --lines 100
pm2 logs irb-api --lines 50
pm2 logs irb-worker --lines 50

# Filter errors
pm2 logs --err --lines 100
```

### 2. BullMQ Dashboard (Optional)

```bash
# Install bull-board
npm install @bull-board/api @bull-board/fastify

# Add route to apps/api/src/index.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';

const serverAdapter = new FastifyAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(messageIntakeQueue),
    new BullMQAdapter(aiPipelineQueue),
    new BullMQAdapter(messageSendQueue),
  ],
  serverAdapter,
});

serverAdapter.setBasePath('/admin/queues');
app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' });

# Access dashboard at: http://localhost:3000/admin/queues
```

### 3. Health Check Endpoint

```bash
# Test health endpoint
curl http://localhost:3000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-03-07T12:00:00.000Z",
  "uptime": 3600,
  "services": {
    "postgres": "connected",
    "mongo": "connected",
    "redis": "connected"
  }
}

# Setup external monitoring (UptimeRobot, Pingdom, etc.)
# URL: https://your-domain.com/health
# Interval: 1 minute
# Alert: If status != 200 for > 2 minutes
```

### 4. Error Alerting

```bash
# Option 1: PM2 Plus (Paid)
pm2 link <secret> <public>

# Option 2: Sentry (Recommended)
npm install @sentry/node

# Add to apps/api/src/index.ts and apps/worker/src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

# Wrap async handlers
app.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error);
  reply.status(500).send({ error: 'Internal Server Error' });
});
```

### 5. Metrics Collection (Prometheus + Grafana)

```bash
# Install prom-client
npm install prom-client

# Add metrics endpoint
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const messageCounter = new client.Counter({
  name: 'whatsapp_messages_total',
  help: 'Total WhatsApp messages processed',
  labelNames: ['type', 'status'],
  registers: [register],
});

app.get('/metrics', async (request, reply) => {
  reply.type('text/plain').send(await register.metrics());
});

# Configure Prometheus to scrape
# prometheus.yml:
scrape_configs:
  - job_name: 'irb-whatsapp'
    static_configs:
      - targets: ['localhost:3000']

# Setup Grafana dashboard with panels for:
# - Messages per minute
# - AI pipeline latency
# - Queue depth over time
# - Error rate
```

---

## Rollback Plan

### If Critical Issues Found

```bash
# 1. Stop services immediately
pm2 stop all

# 2. Revert to previous version
git checkout <previous-tag>
npm install
npm run build

# 3. Restart with old code
pm2 restart all

# 4. Verify health
curl http://localhost:3000/health

# 5. Investigate issue in staging
# (Don't deploy fix until tested)
```

### Database Rollback

```bash
# PostgreSQL
psql $DATABASE_URL < backups/pre-deploy-$(date +%Y%m%d).sql

# MongoDB
mongorestore --uri=$MONGO_URI backups/mongo-$(date +%Y%m%d)/
```

---

## Post-Deployment

### Day 1 (First 24 Hours)

- [ ] Monitor error logs every 2 hours
- [ ] Check queue depth every hour
- [ ] Verify cron jobs run successfully
- [ ] Monitor external API error rates
- [ ] Check database connection pool usage

### Week 1

- [ ] Review Sentry errors daily
- [ ] Analyze message processing latency (P50, P95, P99)
- [ ] Check for memory leaks (PM2 memory graph)
- [ ] Verify appointment booking success rate
- [ ] Review customer feedback/complaints

### Week 2-4

- [ ] Analyze cost (OpenAI API, infrastructure)
- [ ] Review optimization opportunities
- [ ] Check for edge cases in logs
- [ ] Evaluate AI response quality
- [ ] Plan next iteration improvements

---

## Success Criteria

### Functional

- ✅ Messages sent/received successfully via UAZAPI
- ✅ Appointment booking creates confirmed slot in Klingo
- ✅ Cron jobs run on schedule without errors
- ✅ Escalation triggers when AI confidence low
- ✅ Webhooks from Klingo processed correctly

### Performance

- ✅ API response time P95 < 500ms
- ✅ Message delivery latency P95 < 10 seconds
- ✅ Appointment confirmation cron < 5 seconds
- ✅ Queue processing keeps up with incoming messages
- ✅ Zero memory leaks over 7 days

### Reliability

- ✅ Uptime > 99.5% (max 3.6 hours downtime/month)
- ✅ Error rate < 1%
- ✅ Zero data loss
- ✅ Graceful degradation when external APIs down

---

## Checklist Summary

### Before Deploy
- [ ] Fix N+1 queries (CRITICAL)
- [ ] Add MongoDB indexes (CRITICAL)
- [ ] Make webhook token required (CRITICAL)
- [ ] Add PostgreSQL indexes (HIGH)
- [ ] Add phone validation (HIGH)
- [ ] Implement API retry logic (HIGH)

### Infrastructure
- [ ] PostgreSQL database created + migrations run
- [ ] MongoDB database created + indexes added
- [ ] Redis running and accessible
- [ ] PM2 configured for auto-restart
- [ ] Logs directory created with rotation

### Configuration
- [ ] All environment variables set
- [ ] .env file NOT committed to git
- [ ] Webhook URLs configured in UAZAPI dashboard
- [ ] Webhook URLs configured in Klingo dashboard
- [ ] Health check endpoint tested

### Testing
- [ ] Build passes with zero errors
- [ ] Smoke tests pass (messages, booking, cron)
- [ ] Load test passes (10 RPS sustained)
- [ ] Rollback procedure tested

### Monitoring
- [ ] PM2 logs configured with rotation
- [ ] Health check monitoring set up
- [ ] Error alerting configured (Sentry)
- [ ] Metrics collection enabled (optional)
- [ ] BullMQ dashboard accessible (optional)

### Documentation
- [ ] Deployment runbook reviewed
- [ ] Team trained on monitoring dashboard
- [ ] Escalation contacts documented
- [ ] On-call schedule defined

---

**Deployment Status**: ⚠️ **Ready after Critical fixes**  
**Estimated Deploy Time**: 2-3 hours (including testing)  
**Rollback Time**: < 15 minutes
