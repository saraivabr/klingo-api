# WhatsApp AI Experience - Complete Roadmap 🚀

**Goal**: Make Julia the most loved healthcare AI assistant in Brazil  
**Status**: 95% ready, need 8 key improvements  
**Timeline**: 1-2 weeks to launch

---

## 📊 Current State Analysis

### ✅ What's Working
- ✅ Copy is encantadora (charming & human)
- ✅ Triagem flow is correct (symptom → doctor → time)
- ✅ Button system integrated (max 3 buttons per message)
- ✅ Klingo sync functional
- ✅ UAZAPI integrated
- ✅ Database schema complete
- ✅ API routes implemented

### ⚠️ What Needs Work
- ❌ End-to-end testing (real WhatsApp testing needed)
- ❌ Performance optimization (N+1 queries blocking production)
- ❌ Personalization (every patient gets same response)
- ❌ Follow-up automation (post-consultation check-ins missing)
- ❌ Context memory (Julia forgets patient info between messages)
- ❌ Analytics (no metrics on conversion, drop-off, satisfaction)
- ❌ Mobile optimization (message formatting for small screens)
- ❌ Conversational depth (humor, empathy, surprise moments missing)

---

## 🎯 8-Task Roadmap

### TIER 1: CRITICAL (Do First - Makes/Breaks Launch)

#### Task 1️⃣: Test End-to-End WhatsApp Flow
**Why**: Can't launch without knowing it actually works  
**What**: Send real messages, complete full journey (oi → triagem → agendamento → link)  
**Files**: 
- `apps/ai/src/prompts/system.ts` (verify triagem logic)
- `apps/ai/src/claude/button-templates.ts` (verify buttons work)
- `apps/api/src/routes/webhooks/uazapi.ts` (verify webhook receives messages)

**Steps**:
1. Send "oi" from WhatsApp → Verify Julia responds with 4 splitued messages + 3 buttons
2. Click "Tenho um sintoma" → Verify next step appears
3. Follow full triagem → Verify doctor recommendation is personalized
4. Confirm period → Verify booking link appears
5. Click link → Verify booking page loads
6. Complete booking → Verify confirmation message in WhatsApp

**Success**: Full journey takes <2 minutes, all buttons work, link generation correct

---

#### Task 2️⃣: Implement Priority 1 Fixes (Performance)
**Why**: System will crash under real traffic without these  
**What**: Fix N+1 queries, add indexes, secure webhook  
**Files**:
- `apps/worker/src/processors/appointment-confirmation.ts` (batch queries)
- `packages/database/src/postgres/schema.ts` (verify indexes exist)
- `apps/api/src/routes/webhooks/uazapi.ts` (add token auth)

**Changes**:
```typescript
// BEFORE: 50 appointments = 200+ sequential queries
for (const apt of appointments) {
  const patient = await db.select()... // SLOW!
}

// AFTER: 1 batch query + 1 batch query = FAST ✅
const patients = await db.select()
  .from(schema.patients)
  .where(inArray(schema.patients.phone, allPhones));
```

**Expected Results**:
- 15 seconds → 2 seconds (7.5x faster)
- Database queries: 200 → 2 (100x reduction)
- Can handle 1000+ messages/day without lag

---

### TIER 2: HIGH (Do Next - Improves Conversion)

#### Task 3️⃣: Add Personalization & Context Memory
**Why**: Every patient gets same copy = boring + impersonal  
**What**: Remember patient history, tailor responses  
**Files**:
- `apps/worker/src/processors/ai-pipeline.ts` (load patient context)
- `apps/ai/src/services/context.ts` (build context from DB)

**Examples**:
```typescript
// BEFORE
"Oi! Sou a Julia 👋✨"

// AFTER (if patient had issue before)
"Oi Maria! Voltou com a gente! 💙 Como está aquele problema no coração?"

// OR (if first visit)
"Oi! Sou a Julia, primeira vez aqui? Que honra!"
```

**Data to Load**:
- Patient name (use in greeting)
- Last visit date & doctor
- Common symptoms/issues
- Booking history
- Satisfaction score (NPS)

---

#### Task 4️⃣: Implement Follow-up Automation
**Why**: Convert 1-time patients to regular users  
**What**: Send NPS, check-ins, appointment reminders PROACTIVELY  
**Files**:
- `apps/worker/src/processors/follow-up.ts` (new cron jobs)
- `apps/api/src/routes/appointments.ts` (trigger follow-ups)

**Automation**:
```
Day 0: Appointment booked
Day 1: Appointment reminder ("Sua consulta amanhã às 10h! 🏥")
Day 2 (after appt): "Como foi com Dr. [Nome]?" + "Resolveu o problema?" + "Ficou com alguma dúvida?"
Day 7: NPS question ("De 0-10, o quanto você recomenda?")
Day 30: Check-in ("Melhorou aquele incômodo?")
```

---

### TIER 3: NICE-TO-HAVE (Do If Time - Polish)

#### Task 5️⃣: Add Conversational Features (Humor, Empathy)
**Why**: Make Julia feel human, not robotic  
**What**: Add surprise moments, personality, easter eggs  
**Files**:
- `apps/ai/src/prompts/system.ts` (new personality instructions)
- `COPY_ENCANTADORA.md` (more dialogue variations)

**Examples**:
```
// Empathy moment
Patient: "Estou com medo"
Julia: "Medo é normal! Mas sabe, você está nos melhores mãos aqui. 💙"

// Humor moment
Patient: "Quanto custa?"
Julia: "Ah, a saúde não tem preço... mas não se preocupa, a gente cuida do seu bolso também! 💰"

// Surprise moment
Patient: "Tá bom"
Julia: "Perfeito! Você é rapidinho mesmo! 🚀 Vamo botar essa consulta no seu calendário?"
```

---

#### Task 6️⃣: Implement Analytics & Metrics Dashboard
**Why**: Can't optimize what you don't measure  
**What**: Track funnel, conversion, drop-off, satisfaction  
**Files**:
- `apps/dashboard/src/pages/Analytics.tsx` (new page)
- `apps/api/src/routes/analytics.ts` (new endpoints)

**Metrics**:
```
Top Level:
- Messages received: 1,234
- Appointments booked: 89 (7.2% conversion)
- NPS score: 8.2/10

Funnel:
- Greeting seen: 1,234
- Clicked first button: 1,100 (89%)
- Completed triagem: 950 (77%)
- Booked appointment: 89 (7.2%)
- Showed up to appointment: 78 (88% no-show rate)

Details:
- Most popular doctor: Dr. Flavio (32 bookings)
- Most common symptom: Cabeça (28%)
- Average response time: 2.3 seconds
- Message satisfaction: 4.7/5
```

---

#### Task 7️⃣: Optimize Message Splitting & Delivery
**Why**: Messages should appear as a conversation, not wall of text  
**What**: Improve formatting, timing, emoji placement  
**Files**:
- `apps/ai/src/claude/client.ts` (splitting logic)
- `apps/api/src/services/whatsapp-notifications.ts` (delivery)

**Current**: Splits on `\n\n` → sometimes creates weird breaks  
**Better**: Splits on natural conversation points + adds small delays between messages

```
MESSAGE 1: "Oi! 👋✨ Sou a Julia, da IRB Prime Care!"
[wait 1s]
MESSAGE 2: "Que bom demais você veio falar com a gente! 🙌"
[wait 1s]
MESSAGE 3: "Me conta, o que te trouxe por aqui? 🤔"
[wait 1s]
MESSAGE 4: [BUTTONS: Sintoma / Check-up / Exame]
```

Instead of all at once!

---

#### Task 8️⃣: Add Smart Button Recommendations
**Why**: Right buttons at right time = higher conversion  
**What**: Choose next action intelligently based on context  
**Files**:
- `apps/ai/src/claude/button-templates.ts` (smart recommendations)
- `apps/ai/src/services/context.ts` (patient context)

**Smart Logic**:
```typescript
if (patient.visitCount === 0) {
  // First timer - educate
  buttons = ["Tenho um sintoma", "Quero check-up", "Como funciona?"]
} else if (patient.lastVisit < 30 days) {
  // Recent visit - follow-up
  buttons = ["Fazer check-up novo", "Retorno com mesmo doc", "Marcar outro especialista"]
} else if (patient.hasUnresolvedSymptom) {
  // They had issue before
  buttons = ["Mesma coisa voltou", "Evoluiu", "Passou! 🎉"]
}
```

---

## 🚀 Implementation Order

**Week 1** (Critical Path):
- ✅ Task 1: End-to-end testing (4 hours)
- ✅ Task 2: Priority 1 fixes (6 hours)
  - Total: 10 hours = LAUNCH READY

**Week 2** (High Impact):
- Task 3: Personalization (4 hours)
- Task 4: Follow-up automation (6 hours)
  - Total: 10 hours = CONVERT USERS

**Week 3** (Polish):
- Task 5: Conversational features (4 hours)
- Task 6: Analytics dashboard (6 hours)
- Task 7: Message optimization (3 hours)
- Task 8: Smart buttons (3 hours)
  - Total: 16 hours = EXCELLENT UX

---

## ✅ Success Metrics

### Week 1 (Launch)
- [ ] Zero crashes under 100 msg/day
- [ ] Full journey works end-to-end
- [ ] All buttons clickable

### Week 2 (Growth)
- [ ] 50+ appointments booked
- [ ] 70%+ conversion from greeting to appointment
- [ ] NPS > 8/10
- [ ] Zero customer complaints

### Week 3 (Optimization)
- [ ] 100+ appointments/week
- [ ] 85%+ conversion
- [ ] 30%+ of users return for follow-up
- [ ] Average response time < 2s

---

## 🔧 Testing Checklist

Before marking Task 1 complete:
- [ ] Send "oi" from WhatsApp
- [ ] See Julia's welcome (4 messages + buttons)
- [ ] Click each button on welcome
- [ ] Follow symptom triagem to completion
- [ ] Get doctor recommendation
- [ ] Get booking link
- [ ] Book appointment on link
- [ ] See confirmation in WhatsApp
- [ ] No errors in server logs
- [ ] Response time < 3 seconds per message
- [ ] All buttons render correctly on mobile
- [ ] Message splitting looks natural (not choppy)

---

## 📞 Support Links

- **Production Server**: `/opt/irb-whatsapp` on 187.77.62.141
- **Logs**: `docker logs irb-worker -f` (last 100 lines)
- **Database**: PostgreSQL on localhost:5432
- **Monitor**: BullMQ dashboard at `localhost:3001`

---

**Last Updated**: March 7, 2026  
**Status**: Ready to begin Task 1  
**Owner**: [Your Name]
