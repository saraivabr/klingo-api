# Critical Flow Diagrams
**IRB Prime Care - WhatsApp AI Bot**

---

## 1. Complete Message Flow

```
┌─────────────────┐
│  WhatsApp User  │
└────────┬────────┘
         │ sends message
         ▼
┌──────────────────────────────────────────┐
│  UAZAPI Webhook                          │
│  POST /webhooks/uazapi                   │
│  - Validates token                       │
│  - Normalizes phone (E.164)              │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  MESSAGE-INTAKE Queue (BullMQ)           │
│  - Deduplication (4 second debounce)     │
│  - Button/List response handlers         │
│  - Find or create conversation           │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  AI-PIPELINE Queue (BullMQ)              │
│  - Build context (last 20 messages)      │
│  - Call GPT-4o with tools                │
│  - Handle tool responses                 │
│  - Check escalation conditions           │
└────────┬─────────────────────────────────┘
         │
         ├─── Tool: check_availability ────►┌─────────────────────┐
         │                                   │  Klingo External    │
         │                                   │  GET /horarios      │
         │                                   └─────────────────────┘
         │
         ├─── Tool: book_appointment ──────►┌─────────────────────┐
         │                                   │  Klingo External    │
         │                                   │  1. POST /reservar  │
         │                                   │  2. POST /horario   │
         │                                   └─────────────────────┘
         │
         ├─── Tool: cancel_appointment ────►┌─────────────────────┐
         │                                   │  Klingo External    │
         │                                   │  DELETE /cancelar   │
         │                                   └─────────────────────┘
         │
         ├─── Tool: send_clinic_info ──────►(No external API)
         │
         └─── Tool: transfer_to_human ─────►(Escalation flow)
         │
         ▼
┌──────────────────────────────────────────┐
│  MESSAGE-SEND Queue (BullMQ)             │
│  Job Data:                               │
│  {                                       │
│    conversationId: string                │
│    patientPhone: string                  │
│    text: string                          │
│    instanceName: string                  │
│    interactive?: {...}                   │
│    sendLocation?: boolean                │
│  }                                       │
└────────┬─────────────────────────────────┘
         │
         ├─── Text message ────────────────►┌─────────────────────┐
         │                                   │  UAZAPI             │
         ├─── Buttons ─────────────────────►│  POST /send/text    │
         │                                   │  POST /send/menu    │
         ├─── List ────────────────────────►│  POST /send/location│
         │                                   └─────────────────────┘
         └─── Location ────────────────────►
         │
         ▼
┌──────────────────────────────────────────┐
│  Update Conversation (MongoDB)           │
│  - Set messageId                         │
│  - Set deliveryStatus: 'sent'            │
│  - Update lastMessageAt                  │
└──────────────────────────────────────────┘
```

---

## 2. Appointment Booking Flow (End-to-End)

```
Patient: "Quero agendar consulta"
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  AI: "Qual especialidade?"                          │
└─────────────────────────────────────────────────────┘
         │
Patient: "Cardiologia"
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  TOOL: check_availability(specialtyName: "cardio")  │
│                                                     │
│  1. Resolve specialty name → Klingo ID             │
│     GET /api/agenda/especialidades                 │
│     → Find match: {id: 5, nome: "Cardiologia"}     │
│                                                     │
│  2. Fetch available slots                          │
│     GET /api/agenda/horarios?especialidade=5       │
│     &mes=3&ano=2026                                │
│     → Returns: [                                    │
│         {data: "2026-03-10", hora: "14:00", ...},  │
│         {data: "2026-03-11", hora: "09:00", ...}   │
│       ]                                             │
│                                                     │
│  3. Return formatted slots to AI                   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  AI: Shows list of available dates/times            │
│  (Interactive list message via UAZAPI)              │
└─────────────────────────────────────────────────────┘
         │
Patient: Selects "2026-03-10 14:00"
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  TOOL: book_appointment(                            │
│    appointmentDate: "2026-03-10",                   │
│    appointmentTime: "14:00"                         │
│  )                                                  │
│                                                     │
│  1. Find patient's Klingo ID                       │
│     SELECT klingoPatientId FROM patients           │
│     WHERE phone = '5511999999999'                  │
│                                                     │
│  2. Find matching slot from cache                  │
│     const slot = availableSlots.find(...)          │
│                                                     │
│  3. Reserve slot (10 minute hold)                  │
│     POST /api/agenda/reservar                      │
│     {                                               │
│       id_horario: 12345,                           │
│       id_profissional: 67,                         │
│       id_paciente: 89                              │
│     }                                               │
│     ← {id_marcacao_voucher: 999}                   │
│                                                     │
│  4. Confirm booking                                │
│     POST /api/agenda/horario                       │
│     {                                               │
│       id_paciente: 89,                             │
│       id_horario: 12345,                           │
│       id_profissional: 67,                         │
│       id_marcacao_voucher: 999                     │
│     }                                               │
│     ← {id_marcacao: 777}                           │
│                                                     │
│  5. Create appointment in local DB                 │
│     INSERT INTO appointments (                     │
│       patient_id, slot_time, specialty,            │
│       klingoVoucherId: 999,                        │
│       klingoReservationId: 777,                    │
│       klingoSyncStatus: 'synced'                   │
│     )                                               │
│                                                     │
│  6. Return success to AI                           │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  AI: "Prontinho! Agendamento confirmado 🎉"        │
│  + Sends clinic location via UAZAPI                 │
└─────────────────────────────────────────────────────┘
```

---

## 3. Cron Jobs Timeline

```
06:00 BRT  ┌──────────────────────────────────────┐
           │  payment-reminder                    │
           │  - Check subscriptions due today     │
           │  - Send payment reminders            │
           └──────────────────────────────────────┘

07:00 BRT  ┌──────────────────────────────────────┐
           │  appointment-reminder                │
           │  - Check today's appointments        │
           │  - Send check-in messages            │
           │  - 1h before: reminder with location │
           └──────────────────────────────────────┘

14:00 BRT  ┌──────────────────────────────────────┐
           │  appointment-confirmation            │
           │  - Fetch tomorrow's appointments     │
           │  - Send confirmation buttons         │
           │  - Skip already confirmed            │
           └──────────────────────────────────────┘

16:00 BRT  ┌──────────────────────────────────────┐
           │  nps-collection                      │
           │  - Trigger after completed appts     │
           │  - Send NPS score list (0-10)        │
           └──────────────────────────────────────┘

18:00 BRT  ┌──────────────────────────────────────┐
           │  overdue-collection                  │
           │  - Check overdue subscriptions       │
           │  - Send collection messages          │
           │  - Escalate to finance if >30 days   │
           └──────────────────────────────────────┘
```

---

## 4. Escalation Decision Tree

```
                    ┌────────────────────┐
                    │  AI Response       │
                    └──────────┬─────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
    stopReason =         stopReason =           stopReason =
    'tool_use'           'stop'                'length'
         │                     │                     │
         ▼                     ▼                     ▼
    aiConfidence         aiConfidence          aiConfidence
    = 0.9                = 0.7                 = 0.5
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Count consecutive   │
                    │  unknown messages    │
                    └──────────┬───────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
    Last 5 msgs          Last 5 msgs           Last 5 msgs
    have tool use        have sentiment        all user input
         │               "confused|sorry"            │
         ▼                     │                     ▼
    unknowns = 0              ▼                 unknowns = 3+
         │               unknowns = 1+               │
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Check thresholds:   │
                    │  - confidence < 0.6? │
                    │  - unknowns >= 3?    │
                    └──────────┬───────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
            YES (escalate)            NO (continue AI)
                  │                         │
                  ▼                         │
         ┌────────────────────┐             │
         │  TOOL:             │             │
         │  transfer_to_human │             │
         │                    │             │
         │  1. Set escalated  │             │
         │  2. Notify team    │             │
         │  3. Update conv    │             │
         └────────────────────┘             │
                  │                         │
                  └─────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Send response       │
                    │  via MESSAGE_SEND    │
                    └──────────────────────┘
```

---

## 5. Klingo Webhook Events

```
┌─────────────────────────────────────────────┐
│  Klingo Event: STATUS-MARCACAO              │
│  (Appointment status changed in Klingo)     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  1. Validate X-APP-TOKEN                    │
│  2. Find patient by klingoPatientId         │
│  3. Find conversation by patientPhone       │
│  4. Update appointment status in local DB   │
│  5. Send notification via MESSAGE_SEND      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Klingo Event: REMARCACAO                   │
│  (Appointment rescheduled in Klingo)        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  1. Validate X-APP-TOKEN                    │
│  2. Find patient by klingoPatientId         │
│  3. Find conversation by patientPhone       │
│  4. Update appointment date/time in DB      │
│  5. Send reschedule notification            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Klingo Event: CHAMADA                      │
│  (Patient called/no-show in Klingo)         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  1. Validate X-APP-TOKEN                    │
│  2. Find patient by klingoPatientId         │
│  3. Find conversation by patientPhone       │
│  4. Log call event in local DB              │
│  5. Optionally send follow-up message       │
└─────────────────────────────────────────────┘
```

---

## 6. Button/List Response Flow

```
Patient clicks button/list item in WhatsApp
         │
         ▼
┌─────────────────────────────────────────────┐
│  UAZAPI Webhook                             │
│  - Extracts selectedId from payload         │
│  - selectedId patterns:                     │
│    • confirm_{id} → Confirmation            │
│    • cancel_{id} → Cancellation             │
│    • reschedule_{id} → Reschedule           │
│    • cal_{id} → Add to calendar             │
│    • nps_{score} → NPS score                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  MESSAGE-INTAKE: Button Handler             │
│                                             │
│  if (selectedId.startsWith('confirm_'))     │
│    → Call Klingo confirm endpoint           │
│    → Update appointment status              │
│    → Send "Confirmado! ✅"                  │
│                                             │
│  if (selectedId.startsWith('cancel_'))      │
│    → Call Klingo cancel endpoint            │
│    → Update appointment status              │
│    → Send "Cancelado. Quer remarcar?"       │
│                                             │
│  if (selectedId.startsWith('nps_'))         │
│    → Extract score from selectedId          │
│    → Find klingoMarcacaoId from Redis       │
│    → Send to Klingo NPS endpoint            │
│    → Store in local analytics               │
│    → Send "Obrigado pelo feedback! 💙"      │
│                                             │
│  if (selectedId.startsWith('cal_'))         │
│    → Retrieve calendar URL from Redis       │
│    → Send Google Calendar link              │
│    → Send "Link enviado! 📅"                │
└─────────────────────────────────────────────┘
```

---

## 7. Error Handling & Retry

```
┌─────────────────────────────────────────────┐
│  BullMQ Job Execution                       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  Job Processor  │
         └────────┬────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
  Success                     Error
    │                           │
    ▼                           ▼
┌─────────────┐      ┌──────────────────────┐
│ Complete    │      │  Check attempts:     │
│ Remove after│      │  - Max 3 retries     │
│ 50-500 jobs │      │  - Exponential       │
└─────────────┘      │    backoff           │
                     │  - 2^attempt * 1000ms│
                     └──────────┬───────────┘
                                │
                   ┌────────────┴────────────┐
                   │                         │
                   ▼                         ▼
              attempts < 3              attempts >= 3
                   │                         │
                   ▼                         ▼
         ┌─────────────────┐      ┌──────────────────┐
         │  Re-queue with  │      │  Move to DLQ     │
         │  backoff delay  │      │  Alert team      │
         └─────────────────┘      │  Log error       │
                                  └──────────────────┘
```

---

## 8. Data Flow Summary

```
External APIs          Queues (BullMQ)       Databases
═════════════          ═══════════════       ═════════

┌────────────┐         ┌──────────────┐      ┌──────────────┐
│  UAZAPI    │────────►│ message-     │      │  PostgreSQL  │
│            │         │ intake       │◄────►│  (Drizzle)   │
│  - Webhook │         └──────────────┘      │              │
│  - Send    │                               │  - patients  │
│  - Status  │         ┌──────────────┐      │  - appts     │
└────────────┘         │ ai-pipeline  │      │  - doctors   │
                       │              │      │  - services  │
┌────────────┐         └──────────────┘      └──────────────┘
│  Klingo    │
│            │         ┌──────────────┐      ┌──────────────┐
│  - Slots   │────────►│ message-send │      │  MongoDB     │
│  - Reserve │         │              │◄────►│  (Mongoose)  │
│  - Confirm │         └──────────────┘      │              │
│  - Cancel  │                               │  - convs     │
│  - Webhook │         ┌──────────────┐      │  - messages  │
└────────────┘         │ appointment- │      └──────────────┘
                       │ confirmation │
┌────────────┐         └──────────────┘      ┌──────────────┐
│  OpenAI    │                               │  Redis       │
│  GPT-4o    │         ┌──────────────┐      │              │
│            │◄───────►│ appointment- │      │  - Cache     │
│  - Chat    │         │ reminder     │◄────►│  - Sessions  │
│  - Tools   │         └──────────────┘      │  - Pending   │
└────────────┘                               │  - Calendar  │
                       ┌──────────────┐      └──────────────┘
                       │ nps-         │
                       │ collection   │
                       └──────────────┘

                       ┌──────────────┐
                       │ payment-*    │
                       │ jobs         │
                       └──────────────┘
```

---

## Legend

```
┌─────┐
│ Box │  = System component / Process
└─────┘

  │
  ▼      = Data flow direction

─────►   = API call / External request

◄─────►  = Bidirectional data sync

```

---

**Last Updated**: 2026-03-07  
**Status**: All flows validated and operational
