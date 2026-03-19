# Documentacao Tecnica - IRB WhatsApp AI

**Versao:** 1.0
**Data:** 2026-03-19
**Projeto:** irb-whatsapp-ai
**Repositorio:** /opt/irb-whatsapp-ai (producao)

---

## 1. Visao Geral da Arquitetura

O IRB WhatsApp AI e um sistema completo de atendimento automatizado via WhatsApp para a clinica IRB Prime Care (Sao Paulo/SP). O sistema integra inteligencia artificial (GPT-4o-mini da OpenAI), agendamento em tempo real via Klingo, pagamentos via Asaas, teleconsulta por video, e um dashboard administrativo.

### Arquitetura Geral

```
Paciente (WhatsApp)
       |
   [UAZAPI Gateway]
       |
   [Nginx Reverse Proxy]
       |
   [irb-api (Fastify)]  <-->  [irb-dashboard (React SPA)]
       |                              |
   [Redis (BullMQ)]            [WebSocket /ws]
       |
   [irb-worker (BullMQ)]
       |
   +---+---+---+---+
   |               |
[PostgreSQL]  [MongoDB]
```

### Monorepo (pnpm workspaces)

O projeto usa pnpm workspaces com a seguinte organizacao:

- **apps/** - Aplicacoes executaveis
  - `api` - Servidor REST API (Fastify)
  - `worker` - Processadores de filas (BullMQ)
  - `dashboard` - Painel administrativo (React + Vite)
  - `booking` - App de agendamento publico (React + Vite)
  - `ai` - Modulos de IA (prompts, classificadores, transcricao)
  - `teleconsulta` - App de teleconsulta por video
  - `sync-klingo` - Scripts de sincronizacao Klingo
- **packages/** - Bibliotecas compartilhadas
  - `database` - Schemas PostgreSQL (Drizzle ORM), modelos MongoDB (Mongoose), conexoes Redis
  - `shared` - Constantes, utilitarios, tipos compartilhados
- **infra/** - Infraestrutura
  - `docker/` - Dockerfiles (api, worker, dashboard)
  - `nginx/` - Configuracao do reverse proxy

---

## 2. Stack Tecnologica

| Camada | Tecnologia | Versao/Detalhes |
|--------|-----------|-----------------|
| Runtime | Node.js | LTS (>=18) |
| Linguagem | TypeScript | Strict mode |
| HTTP Server | Fastify | Com CORS, rate-limit, JWT, WebSocket, static |
| ORM SQL | Drizzle ORM | PostgreSQL driver |
| ODM NoSQL | Mongoose | MongoDB 7 |
| Filas | BullMQ | Redis-backed job queues |
| Frontend Dashboard | React 18 + Vite | TypeScript, TailwindCSS |
| Frontend Booking | React 18 + Vite | TypeScript, TailwindCSS |
| IA (principal) | OpenAI GPT-4o-mini | Tool calling, function calls |
| IA (transcricao) | Groq Whisper Large V3 | Fallback: OpenAI Whisper-1 |
| IA (embeddings) | OpenAI text-embedding-3-small | Vetor 1536 dimensoes |
| Banco relacional | PostgreSQL 16 + pgvector | Imagem: pgvector/pgvector:pg16 |
| Banco documentos | MongoDB 7 | Conversas e mensagens |
| Cache/Filas | Redis 7 Alpine | BullMQ, pub/sub, locks, rate-limit |
| WhatsApp Gateway | UAZAPI | REST API com token auth |
| Pagamentos | Asaas | PIX, boleto, cartao de credito |
| Gestao Clinica | Klingo External API | REST com X-APP-TOKEN |
| Containerizacao | Docker Compose | Multi-container com healthchecks |
| Reverse Proxy | Nginx | SSL termination, proxy_pass |
| Auth | JWT (@fastify/jwt) | Bearer token com RBAC |
| Senhas | bcryptjs | Hash com salt round 10 |

---

## 3. Estrutura do Projeto

```
irb-whatsapp-ai/
|-- apps/
|   |-- api/                      # REST API (porta 3001)
|   |   |-- src/
|   |   |   |-- middleware/       # authMiddleware (JWT verify)
|   |   |   |-- lib/             # access-control.ts (RBAC)
|   |   |   |-- routes/          # 23 arquivos de rotas
|   |   |   |   |-- webhooks/    # uazapi.ts, klingo.ts, asaas.ts
|   |   |   |-- services/        # 21 servicos externos
|   |   |   |-- websocket/       # handler.ts (Redis pub/sub -> WS)
|   |   |   |-- server.ts        # Entry point
|   |-- worker/                   # Processadores BullMQ
|   |   |-- src/
|   |   |   |-- processors/      # 16 processadores
|   |   |   |-- services/        # klingo-client-worker.ts
|   |   |   |-- index.ts         # Entry point
|   |-- dashboard/                # React SPA (porta 8090)
|   |   |-- src/
|   |   |   |-- components/      # chat/, kanban/, layout/
|   |   |   |-- pages/           # ~15 paginas
|   |   |   |-- hooks/           # useWebSocket.ts
|   |   |   |-- services/        # api.ts
|   |-- booking/                  # App agendamento publico
|   |   |-- src/
|   |   |   |-- App.tsx          # Router principal
|   |   |   |-- SlotPicker.tsx   # Seletor de horarios
|   |   |   |-- PatientForm.tsx  # Formulario do paciente
|   |   |   |-- Confirmation.tsx # Tela de confirmacao
|   |-- ai/                       # Modulos de IA
|   |   |-- src/
|   |   |   |-- prompts/         # system.ts (prompt Julia)
|   |   |   |-- classifiers/     # intent.ts (regex-based)
|   |   |   |-- audio/           # transcribe.ts (Whisper)
|   |   |   |-- context/         # builder.ts (chat context)
|   |   |   |-- claude/          # client.ts (OpenAI SDK)
|   |-- teleconsulta/             # App teleconsulta por video
|-- packages/
|   |-- database/
|   |   |-- src/
|   |   |   |-- postgres/        # schema.ts (Drizzle)
|   |   |   |-- mongo/models/    # conversation.ts (Mongoose)
|   |   |   |-- seed.ts          # Dados iniciais
|   |-- shared/
|   |   |-- src/
|   |   |   |-- constants/       # queues.ts
|   |   |   |-- utils/           # normalizePhone, etc.
|-- infra/
|   |-- docker/                   # Dockerfiles
|   |-- nginx/                    # nginx.conf
|-- docker-compose.prod.yml       # Orquestracao producao
|-- pnpm-workspace.yaml
|-- package.json
```

---

## 4. Banco de Dados

### 4.1 PostgreSQL (Drizzle ORM)

Todas as tabelas usam UUID como chave primaria (exceto `business_hours` que usa serial) e timestamps com timezone.

#### Tabelas Core

| Tabela | Descricao | Campos Chave |
|--------|-----------|-------------|
| `patients` | Pacientes (criados via WhatsApp ou dashboard) | phone (unique), name, cpf_hash, birth_date, klingo_patient_id, source |
| `users` | Usuarios do dashboard (atendentes, admins) | email (unique), password_hash, role, access_profile, permission_overrides, access_scope |
| `doctors` | Corpo clinico | name, specialty, crm, klingo_id |
| `services` | Servicos oferecidos (consultas, exames) | name, price_cents, duration_minutes, category |
| `appointments` | Agendamentos | patient_id, doctor_id, scheduled_at, status, klingo_sync_status, klingo_voucher_id |
| `escalations` | Escalonamentos para atendente humano | conversation_mongo_id, reason, priority, status |
| `business_hours` | Horarios de funcionamento | day_of_week, open_time, close_time |
| `knowledge_base` | FAQ para a IA | key, question, answer, category |
| `knowledge_embeddings` | Vetores RAG (pgvector 1536d) | chunk_id, content, section, embedding |
| `ai_settings` | Configuracoes da IA (chave-valor JSONB) | key, value |

#### Tabelas de Agendamento

| Tabela | Descricao |
|--------|-----------|
| `booking_links` | Links de agendamento gerados pela IA (token unico, expira em 48h) |
| `schedules` | Horarios de atendimento por medico (dia da semana, inicio, fim, tempo por paciente) |
| `doctor_holidays` | Feriados/folgas dos medicos |
| `lunch_breaks` | Intervalo de almoco dos medicos |

#### Tabelas Financeiras - Assinatura/Planos

| Tabela | Descricao |
|--------|-----------|
| `plans` | Planos de assinatura (com klingo_plan_id) |
| `asaas_customers` | Clientes Asaas vinculados a pacientes (CPF, asaas_id) |
| `subscriptions` | Assinaturas ativas (paciente + plano + status Asaas) |
| `payments` | Pagamentos de assinaturas (Asaas payment ID, PIX QR, boleto) |

#### Tabelas Financeiras - Contas a Pagar

| Tabela | Descricao |
|--------|-----------|
| `cost_centers` | Centros de custo (21 unidades: Projetos, Braganca, Paraguacu, SAMU-MG, etc.) |
| `chart_of_accounts` | Plano de contas (25 categorias: Pessoal, Impostos, Operacional, etc.) |
| `suppliers` | Fornecedores (CNPJ, dados bancarios, PIX) |
| `bank_accounts` | Contas bancarias (7 contas: Bradesco x3, Unicred, Safra, BB) |
| `accounts_payable` | Contas a pagar (862+ registros, com retencoes tributarias INSS/IRPJ/CSLL/COFINS/PIS/ISS) |
| `payment_approvals` | Workflow de aprovacao de pagamentos (com notificacao WhatsApp) |
| `credit_card_purchases` | Compras no cartao corporativo (parcelamento) |
| `bank_transactions` | Movimentacoes bancarias (conciliacao) |

#### Tabelas Financeiras - Contas a Receber

| Tabela | Descricao |
|--------|-----------|
| `insurance_providers` | Convenios (13 cadastrados, com codigo ANS) |
| `accounts_receivable` | Contas a receber (particular + convenio, com guia e autorizacao) |
| `receivable_installments` | Parcelas a receber |
| `receivable_payments` | Pagamentos recebidos |

#### Tabelas Financeiras - Reembolso e VT

| Tabela | Descricao |
|--------|-----------|
| `reimbursement_requests` | Solicitacoes de reembolso de viagem (workflow aprovacao) |
| `reimbursement_items` | Itens do reembolso (alimentacao, transporte, hospedagem, etc.) |
| `transport_vouchers` | Vale-transporte CLTs (mensal, por centro de custo) |

#### Tabelas Financeiras - Fluxo de Caixa

| Tabela | Descricao |
|--------|-----------|
| `cash_flow_snapshots` | Posicao diaria consolidada (saldo abertura/fechamento, receitas/despesas por categoria) |

#### Tabelas Clinicas

| Tabela | Descricao |
|--------|-----------|
| `teleconsultation_rooms` | Salas de teleconsulta (room_code, patient_token, status) |
| `prescriptions` | Prescricoes (vinculadas a teleconsulta, PDF gerado) |
| `opd_visits` | Visitas ambulatoriais (OPD) |
| `opd_vitals` | Sinais vitais (altura, peso, PA, pulso, temperatura) |
| `opd_diagnoses` | Diagnosticos (CID-10) |
| `opd_timelines` | Timeline de evolucao |

#### Tabelas de Faturamento

| Tabela | Descricao |
|--------|-----------|
| `charge_categories` | Categorias de cobranca |
| `charges` | Procedimentos cobraveis (codigo, valor padrao) |
| `bills` | Faturas (numero, total, desconto, status) |
| `bill_items` | Itens da fatura |
| `bill_transactions` | Transacoes de pagamento da fatura |

#### Tabelas de Laboratorio

| Tabela | Descricao |
|--------|-----------|
| `lab_categories` | Categorias de exames |
| `lab_tests` | Exames disponiveis (metodo, unidade, faixa normal) |
| `lab_parameters` | Parametros dos exames |
| `lab_orders` | Pedidos de exame (order_number, status, prioridade) |
| `lab_order_items` | Itens do pedido |
| `lab_results` | Resultados (valor, is_abnormal) |

#### Tabelas de Farmacia

| Tabela | Descricao |
|--------|-----------|
| `medicine_categories` | Categorias de medicamentos |
| `medicine_brands` | Marcas/fabricantes |
| `medicines` | Medicamentos (estoque, preco, lote, validade, alerta) |
| `medicine_sales` | Vendas |
| `medicine_sale_items` | Itens da venda |

### 4.2 MongoDB (Mongoose)

Collection unica: **conversations**

```typescript
interface IConversation {
  patientPhone: string;        // Indexado
  patientName: string | null;
  patientId: string | null;    // UUID do PostgreSQL
  instanceName: string;        // Nome da instancia UAZAPI
  state: string;               // Estado da maquina de estados (greeting, scheduling, etc.)
  previousStates: Array<{ state: string; at: Date }>;
  detectedIntents: string[];   // Intencoes detectadas na conversa
  detectedAnxieties: string[];
  escapePhraseDetected: boolean;
  sentimentScore: number;
  status: 'active' | 'escalated' | 'closed';
  assignedTo: string | null;   // UUID do atendente
  isAiHandling: boolean;       // true = IA responde, false = humano
  startedAt: Date;
  lastMessageAt: Date;
  closedAt: Date | null;
  metrics: {
    totalMessages: number;
    aiMessages: number;
    humanMessages: number;
    patientMessages: number;
    avgResponseTimeMs: number;
    firstResponseTimeMs: number;
  };
  summary: string | null;      // Resumo para contexto entre conversas
  messages: IMessage[];        // Array embarcado de mensagens
}

interface IMessage {
  sender: 'patient' | 'ai' | 'attendant' | 'system';
  text: string;
  type: 'text' | 'image' | 'audio' | 'document';
  mediaUrl?: string;
  aiMetadata?: {
    promptTokens: number;
    completionTokens: number;
    model: string;
    confidenceScore: number;
    intentClassified: string | null;
    stateTransition: { from: string; to: string } | null;
    toolsUsed: string[];
    interactiveMessagesCount: number;
    latencyMs: number;
  };
  messageId?: string;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
}
```

**Indices MongoDB:**
- `{ patientPhone: 1, status: 1 }`
- `{ status: 1, lastMessageAt: -1 }`
- `{ instanceName: 1, status: 1 }`
- `{ lastMessageAt: -1 }`

### 4.3 Redis

| Uso | Chave | TTL | Descricao |
|-----|-------|-----|-----------|
| BullMQ Queues | `bull:<queue_name>:*` | - | 16 filas de processamento |
| Pub/Sub | `channel:conversations`, `channel:escalations`, `channel:metrics` | - | Eventos real-time para dashboard |
| Distributed Lock | `msg:<messageId>` | 30s | Prevencao de mensagens duplicadas |
| Rate Limit | `rate:<phone>` | 10min | Limite de mensagens por telefone |
| Session Cache | `session:<phone>` | - | Cache do estado da conversa |
| Debounce | `debounce:<phone>`, `debounce_job:<phone>` | 30s | Agregacao de mensagens rapidas (4s window) |
| Calendar Link | `calendar_event:<appointmentId>` | 7 dias | URL Google Calendar pos-agendamento |
| NPS Pending | `nps_pending:<phone>` | - | Aguardando voto NPS |

---

## 5. API Endpoints

### Rotas Publicas (sem autenticacao)

| Metodo | Path | Descricao |
|--------|------|-----------|
| GET | `/api/health` | Health check (Redis, Postgres, Mongo) |
| POST | `/api/auth/login` | Login (email + password -> JWT) |
| POST | `/api/webhooks/uazapi` | Webhook de mensagens WhatsApp (UAZAPI) |
| GET | `/api/webhooks/uazapi` | Validacao do webhook UAZAPI |
| GET | `/api/webhooks/uazapi/health` | Health check do webhook |
| POST | `/api/webhooks/klingo` | Webhook Klingo |
| POST | `/api/webhooks/asaas` | Webhook pagamentos Asaas |
| GET | `/api/booking/:token` | Dados do link de agendamento + slots disponiveis |
| POST | `/api/booking/:token/confirm` | Confirmar agendamento (cria paciente + appointment + Klingo sync) |
| GET/POST | `/api/teleconsultation/*` | Rotas publicas de teleconsulta |

### Rotas Protegidas (JWT obrigatorio)

#### Conversas

| Metodo | Path | Descricao |
|--------|------|-----------|
| GET | `/api/conversations` | Listar conversas (paginado, com appointment/booking enriquecido) |
| GET | `/api/conversations/search` | Buscar por telefone ou nome |
| GET | `/api/conversations/:id` | Detalhes com todas as mensagens |
| GET | `/api/conversations/:id/context` | Contexto completo do paciente (conversas, appointments, escalations) |
| POST | `/api/conversations/:id/assign` | Atribuir para atendente (desliga IA) |
| POST | `/api/conversations/:id/release` | Devolver para IA |
| POST | `/api/conversations/:id/close` | Fechar conversa |
| POST | `/api/conversations/:id/send` | Enviar mensagem manual (enfileira via BullMQ) |

#### Pacientes

| Metodo | Path | Descricao |
|--------|------|-----------|
| GET | `/api/patients` | Listar pacientes (busca por nome) |
| GET | `/api/patients/:id` | Detalhes (com CPF Asaas e assinatura ativa) |
| PUT | `/api/patients/:id` | Atualizar paciente |
| GET | `/api/patients/:id/appointments` | Historico de consultas |
| GET | `/api/patients/klingo/search` | Buscar paciente na Klingo (CPF ou telefone) |
| POST | `/api/patients/ensure` | Garantir existencia do paciente (find or create) |

#### Usuarios (RBAC)

| Metodo | Path | Descricao | Permissao |
|--------|------|-----------|-----------|
| GET | `/api/users` | Listar usuarios | users.manage |
| POST | `/api/users` | Criar usuario | users.manage |
| PUT | `/api/users/:id` | Atualizar usuario | users.manage |
| PUT | `/api/users/me/password` | Trocar propria senha | Qualquer autenticado |
| GET | `/api/users/access-model` | Modelo de acesso (perfis, permissoes, centros de custo) | users.manage |

#### Financeiro

| Metodo | Path | Descricao |
|--------|------|-----------|
| * | `/api/accounts-payable/*` | CRUD contas a pagar (aprovacao, pagamento) |
| * | `/api/accounts-receivable/*` | CRUD contas a receber (convenio, particular) |
| * | `/api/cash-flow/*` | Fluxo de caixa (snapshots, DRE) |
| * | `/api/finance/*` | Visao geral financeiro |
| * | `/api/finance-ops/*` | Operacoes financeiras |
| * | `/api/pdv/*` | Ponto de venda (cobranças Asaas) |
| * | `/api/subscriptions/*` | Gestao de assinaturas |
| * | `/api/billing/*` | Faturamento (faturas, itens, transacoes) |

#### Clinico

| Metodo | Path | Descricao |
|--------|------|-----------|
| * | `/api/doctors/*` | CRUD medicos |
| * | `/api/schedules/*` | Horarios dos medicos |
| * | `/api/opd/*` | Ambulatorio (visitas, sinais vitais, diagnosticos) |
| * | `/api/lab/*` | Laboratorio (pedidos, resultados) |
| * | `/api/pharmacy/*` | Farmacia (estoque, vendas) |

#### Outros

| Metodo | Path | Descricao |
|--------|------|-----------|
| * | `/api/dashboard/*` | Metricas do dashboard |
| * | `/api/settings/*` | Configuracoes do sistema |
| * | `/api/igs/*` | Integracao IGS (Teknos) |
| * | `/api/sync/*` | Sincronizacao manual Klingo |
| WS | `/ws` | WebSocket real-time (Redis pub/sub fan-out) |

### Rate Limits

- Geral: 100 req/min (exceto localhost)
- Webhooks: 300 req/min
- Booking: 30 req/min

---

## 6. Workers / Processadores

O sistema usa 16 workers BullMQ, cada um com concorrencia configuravel:

| # | Fila | Concorrencia | Trigger | Descricao |
|---|------|-------------|---------|-----------|
| 1 | `message-intake` | 10 | Webhook UAZAPI | Recebe mensagem, cria/encontra paciente e conversa, faz debounce (4s), transcricao de audio, enfileira para IA. Trata botoes especiais (calendario, confirmacao, NPS, check-in). |
| 2 | `ai-pipeline` | 5 | message-intake | Classifica intencao, busca RAG, chama GPT-4o-mini com tools (12 funcoes), aplica regras de experiencia (triagem, botoes fallback), detecta escalacao, transiciona estado. |
| 3 | `message-send` | 10 | ai-pipeline, manual | Envia mensagem via UAZAPI (texto, botoes, listas). Split automatico em \n\n. Simula "digitando...". Throttle: max 5 msgs AI/10min. Envia localizacao apos agendamento. |
| 4 | `follow-up` | 3 | ai-pipeline, cron | Follow-up 24h apos escape phrase. Recuperador de atencao 30min apos botoes sem resposta. |
| 5 | `analytics` | 2 | ai-pipeline | Atualiza metricas de conversa (intencao, latencia, tools usadas, escalacao). |
| 6 | `booking-cleanup` | 1 | Cron: a cada 1h | Expira booking links pendentes com mais de 48h. |
| 7 | `appointment-reminder` | 2 | Cron: 18:00 BRT | Envia lembretes de consulta para dia seguinte via WhatsApp com botoes (Confirmar/Cancelar/Remarcar). |
| 8 | `klingo-sync` | 2 | ai-pipeline (retry) | Retry de sincronizacao Klingo quando agendamento falhou (3 tentativas, backoff exponencial). |
| 9 | `klingo-agenda-sync` | 1 | Cron: 5min (light) / 1h (full) | Sync leve: apenas agendamentos. Sync completo: medicos + agendamentos + vouchers. |
| 10 | `appointment-confirmation` | 2 | Cron: 14:00 BRT | Busca consultas do dia seguinte na Klingo e envia confirmacao via WhatsApp. |
| 11 | `nps-collection` | 2 | Apos consulta | Envia pesquisa NPS via WhatsApp com botoes de nota (0-10). Registra na Klingo. |
| 12 | `payment-notification` | 3 | Webhook Asaas | Notifica paciente sobre pagamentos (confirmado, vencido, cancelado). |
| 13 | `payment-reminder` | 3 | Cron: 10:00 BRT | Lembrete de pagamentos vencendo. |
| 14 | `payment-approval` | 1 | Cron: 08:00 BRT | Notifica aprovadores sobre contas a pagar pendentes via WhatsApp. |
| 15 | `teleconsultation-reminder` | 2 | ai-pipeline (delay) | Lembretes 30min e 5min antes da teleconsulta. |
| 16 | `teleconsultation-cleanup` | 1 | Cron: a cada 30min | Limpa salas de teleconsulta expiradas. |

### Schedule dos Jobs Periodicos

| Job | Horario (BRT) | Frequencia |
|-----|---------------|------------|
| booking-cleanup | - | A cada 1 hora |
| appointment-reminder | 18:00 | Diario |
| appointment-confirmation | 14:00 | Diario |
| payment-reminder | 10:00 | Diario |
| payment-approval | 08:00 | Diario |
| teleconsultation-cleanup | - | A cada 30 minutos |
| klingo-agenda-sync (light) | - | A cada 5 minutos |
| klingo-agenda-sync (full) | - | A cada 1 hora |

---

## 7. Integracoes Externas

### 7.1 Klingo API Externa

**Base URL:** `https://api-externa.klingo.app`
**Autenticacao:** Header `X-APP-TOKEN` com token da aplicacao
**Autenticacao por paciente:** Header `Authorization: Bearer <token>` (obtido via login de sessao)

#### Endpoints Utilizados

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/live` | Health check |
| POST | `/api/paciente/identificar` | Identificar paciente por telefone |
| GET | `/api/paciente/cpf?cpf=XXX` | Identificar paciente por CPF |
| POST | `/api/externo/register` | Registrar novo paciente |
| POST | `/api/externo/login` | Login de sessao do paciente (retorna bearer token) |
| GET | `/api/paciente` | Perfil do paciente (autenticado) |
| PUT | `/api/paciente` | Atualizar perfil (autenticado) |
| GET | `/api/agenda/especialidades` | Listar especialidades |
| GET | `/api/agenda/exames` | Listar exames disponiveis |
| GET | `/api/agenda/profissionais` | Listar profissionais |
| GET | `/api/agenda/horarios?especialidade=&exame=&plano=&inicio=&fim=` | Horarios disponiveis |
| POST | `/api/agenda/reservar` | Reservar slot (hold 10min, autenticado) |
| DELETE | `/api/agenda/reservar` | Cancelar reserva (autenticado) |
| POST | `/api/agenda/horario` | Confirmar agendamento (autenticado) |
| DELETE | `/api/voucher` | Cancelar agendamento (autenticado) |
| GET | `/api/convenios` | Listar convenios e planos |
| GET | `/api/preco?id_procedimento=&id_plano=` | Consultar preco |
| GET | `/api/telefonia/lista/:date` | Listar consultas do dia (para confirmacao) |
| POST | `/api/telefonia/confirmar` | Confirmar/cancelar consulta (status C/R/N) |
| POST | `/api/telefonia/nps` | Registrar nota NPS |
| GET | `/api/telefonia/bloqueios` | Bloqueios de agenda |
| POST | `/api/checkin` | Check-in do paciente (autenticado) |
| GET | `/api/resultado/:id` | Resultado de exame |
| GET | `/api/resultado/pdf/:id` | PDF do resultado |

#### Mapa de Procedimentos de Consulta

```typescript
const CONSULTA_PROCEDURE_MAP: Record<string, number> = {
  'cardiologia': 416,
  'gastroenterologia': 1293,
  'neurologia': 1312,
  'reumatologia': 1314,
  'dermatologia': 1317,
  'odontologia': 1105,
  'psiquiatria': 1345,
  'ginecologia': 1290,
  'ortopedia': 1301,
  'urologia': 1339,
  'oftalmologia': 1295,
  'pneumologia': 1321,
  'pediatria': 1327,
  'endocrinologia': 1302,
  'geriatria': 1343,
};
```

### 7.2 Asaas (Gateway de Pagamentos)

**Base URL Producao:** `https://api.asaas.com/v3`
**Base URL Sandbox:** `https://api-sandbox.asaas.com/v3`
**Autenticacao:** Header `access_token`

#### Funcionalidades

- **Customers:** Criar, buscar por CPF, atualizar
- **Subscriptions:** Criar assinatura recorrente (PIX, boleto, cartao), cancelar
- **Payments:** Criar cobranca avulsa, consultar status, gerar QR Code PIX, pagar com cartao
- **Webhooks:** Notificacao de mudanca de status de pagamento

#### Tipos de Cobranca
- `PIX` - QR Code + copia-e-cola
- `BOLETO` - Boleto bancario
- `CREDIT_CARD` - Cartao de credito
- `UNDEFINED` - Paciente escolhe na hora

### 7.3 UAZAPI (Gateway WhatsApp)

**Base URL:** `https://saraiva.uazapi.com`
**Autenticacao:** Header `token`

#### Endpoints Utilizados

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/send/text` | Enviar mensagem de texto |
| POST | `/send/media` | Enviar midia (imagem, video, audio, documento) |
| POST | `/send/menu` | Enviar botoes (type: button), listas (type: list), enquetes (type: poll) |
| POST | `/send/carousel` | Enviar carrossel de cards |
| POST | `/send/location` | Enviar localizacao |
| POST | `/send/contact` | Enviar contato (vCard) |
| POST | `/send/pix-button` | Enviar botao de pagamento PIX |
| POST | `/message/presence` | Status "digitando..." ou "gravando..." |
| POST | `/message/react` | Enviar emoji de reacao |
| POST | `/message/download` | Download de midia de mensagem |
| GET | `/instance/status` | Status da instancia |

#### Formato dos Botoes (UAZAPI)

```javascript
// Botoes: array de strings "texto|id"
choices: ["Quero agendar|agendar", "Check-up|checkup", "Falar com alguem|atendente"]

// URL Button: "texto|https://..."
choices: ["Agendar consulta|https://irb.saraiva.ai/agendar/X7kM9pQ"]

// Listas: "[Secao]" + "titulo|id|descricao"
choices: ["[Especialidades]", "Cardiologia|cardio|Coracao e pressao", "Neurologia|neuro|Dores de cabeca"]
```

#### Webhook (entrada)

O UAZAPI envia POST para `/api/webhooks/uazapi` com:

```json
{
  "EventType": "message",
  "instanceName": "irbPRIME",
  "token": "<instance_token>",
  "message": {
    "chatid": "5517999999999@s.whatsapp.net",
    "sender": "5517999999999@s.whatsapp.net",
    "senderName": "Joao Silva",
    "fromMe": false,
    "isGroup": false,
    "messageType": "conversation",
    "text": "Oi, quero agendar uma consulta",
    "messageid": "ABCD1234",
    "wasSentByApi": false,
    "buttonOrListid": "agendar"
  },
  "chat": {
    "wa_chatid": "5517999999999@s.whatsapp.net",
    "wa_name": "Joao Silva"
  }
}
```

**Filtros de webhook:**
- Ignora mensagens enviadas pela API (`wasSentByApi: true`)
- Ignora mensagens proprias (`fromMe: true`)
- Ignora mensagens de grupo (`isGroup: true`)
- Ignora numeros de staff internos (configuravel via `STAFF_PHONES`)
- Valida instancia contra `UAZAPI_ALLOWED_INSTANCE_NAMES`
- Autenticacao tripla: header x-webhook-token, query ?token=, ou body.token

### 7.4 OpenAI

**Modelo principal:** GPT-4o-mini (via SDK OpenAI)
**Modelo de embeddings:** text-embedding-3-small (1536 dimensoes)
**Transcricao de audio:** Groq Whisper Large V3 (fallback: OpenAI Whisper-1)

#### Tools Disponiveis para a IA (12 funcoes)

| Tool | Descricao |
|------|-----------|
| `get_service_price` | Consultar preco de servicos no banco |
| `check_availability` | Verificar horarios disponiveis (Klingo External API) |
| `book_appointment` | Agendar consulta (Klingo reserve + confirm + DB local) |
| `generate_booking_link` | Gerar link de agendamento (token 48h) |
| `cancel_appointment` | Cancelar consulta futura (Klingo + local) |
| `get_patient_appointments` | Listar consultas futuras do paciente |
| `get_knowledge` | Buscar na base de conhecimento (RAG semantico + fallback exato) |
| `escalate_to_human` | Transferir para atendente humano |
| `send_interactive_message` | Enviar botoes ou listas no WhatsApp |
| `check_exam_results` | Verificar resultados de exames |
| `send_location` | Enviar localizacao da clinica |
| `generate_teleconsultation_link` | Criar sala de teleconsulta e gerar link |

---

## 8. Fluxo de Mensagens WhatsApp

### Fluxo Completo (mensagem recebida ate resposta enviada)

```
1. Paciente envia mensagem no WhatsApp
       |
2. UAZAPI recebe e faz POST /api/webhooks/uazapi
       |
3. [API] Valida token, instancia, filtros (fromMe, group, staff)
       |
4. [API] Enfileira no BullMQ: message-intake
       |
5. [WORKER message-intake]
   a. Distributed lock (previne duplicatas)
   b. Rate limit check
   c. Verifica botoes especiais (calendario, confirmacao, NPS, check-in)
   d. Se audio: transcreve via Whisper (Groq ou OpenAI)
   e. Find or create patient (PostgreSQL)
   f. Identifica paciente na Klingo por telefone (async)
   g. Find or create conversation (MongoDB)
   h. Se conversa fechada anterior: carrega contexto resumido
   i. Adiciona mensagem do paciente ao array de mensagens
   j. Debounce: agrega msgs rapidas em 4s window
   k. Publica evento WebSocket para dashboard
   l. Enfileira no BullMQ: ai-pipeline (com delay de 4s debounce)
       |
6. [WORKER ai-pipeline]
   a. Resolve textos debounced do Redis
   b. Envia emoji de reacao (saudacao -> onda, obrigado -> coracao, etc.)
   c. Cancela recuperador de atencao pendente
   d. Classifica intencao (regex patterns: 19 intencoes)
   e. Detecta frase de escape ("vou pensar", "depois vejo")
   f. Journey Guard: bloqueia respostas para assuntos tecnicos/operacionais
   g. RAG: busca chunks relevantes via pgvector (top 5, cosine similarity)
   h. Monta contexto: system prompt + KB + RAG + medicos ativos + historico
   i. Chama GPT-4o-mini com 12 tools disponiveis
   j. Loop de tool calls (execute tool -> re-call com resultado)
   k. Aplica regras de experiencia (triagem obrigatoria, botoes fallback)
   l. Detecta bullet points e converte em botoes automaticamente
   m. Verifica necessidade de escalacao
   n. Transiciona estado da maquina de estados
   o. Salva mensagem AI no MongoDB (com retry para VersionError)
   p. Agenda follow-up se escape phrase detectada
   q. Enfileira no BullMQ: message-send
   r. Agenda recuperador de atencao (30min) se enviou botoes
   s. Enfileira analytics
       |
7. [WORKER message-send]
   a. Verifica throttle (max 5 msgs AI / 10 min, anti-duplicata 5min)
   b. Se texto + interativo: envia texto primeiro, depois botoes
   c. Split em \n\n -> multiplas mensagens separadas
   d. Simula "digitando..." com delay proporcional ao tamanho
   e. Envia via UAZAPI (/send/text ou /send/menu)
   f. Fallback: se botoes falharem, envia como texto puro
   g. Se agendamento confirmado, envia localizacao automaticamente
   h. Atualiza deliveryStatus no MongoDB
   i. Publica evento WebSocket para dashboard
```

### Maquina de Estados da Conversa

Estados: `greeting` -> `scheduling` -> `collecting_info` -> `price_discussion` -> `service_inquiry` -> `exploring` -> `escalated` -> `closed`

### Intencoes Classificadas (Regex)

```
greeting, appointment_booking, price_inquiry, availability_inquiry,
service_info, location_inquiry, payment_inquiry, insurance_inquiry,
cancellation, reschedule, complaint, medical_urgency, human_request,
technical_support, out_of_scope, follow_up, gratitude, farewell, unknown
```

---

## 9. Sistema de Agendamento

### Fluxo de Agendamento via IA (WhatsApp)

```
1. Paciente: "Quero agendar"
2. Julia (IA): Triagem obrigatoria - "O que te trouxe?" [Botoes: Sintoma/Check-up/Exame]
3. Paciente: [Clica "Sintoma"]
4. Julia: "Onde esta o desconforto?" [Botoes: Cabeca-Coracao / Corpo-Pele / Outro]
5. Paciente: [Clica "Coracao"]
6. Julia: Indica Dra. Natalia Mucare (Cardiologista)
7. Julia: "Qual periodo?" [Botoes: Manha / Tarde / Qualquer]
8. Paciente: [Clica "Tarde"]
9. Julia: Chama tool generate_booking_link(specialty: "Cardiologia", doctor_name: "Natalia Mucare")
10. Sistema: Cria booking_link no PostgreSQL (token unico, expira 48h)
11. Julia: Envia botao CTA "Agendar consulta" com URL
12. Paciente: Clica no link -> abre app booking
```

### Fluxo de Confirmacao (App Booking)

```
1. GET /api/booking/:token
   - Valida link (existe, pendente, nao expirou)
   - Busca medicos da especialidade no PostgreSQL
   - Busca slots reais na Klingo External API
   - Fallback: gera slots hardcoded se Klingo falhar

2. Paciente escolhe horario e preenche dados (nome, CPF, nascimento, email)

3. POST /api/booking/:token/confirm
   a. Identifica paciente na Klingo (CPF -> telefone -> auto-registro)
   b. Reserva slot na Klingo (hold 10min) -- se falhar, retorna 409
   c. Transacao PostgreSQL:
      - Verifica link pendente (protecao de concorrencia)
      - Checa conflito de horario no mesmo medico
      - Find or create patient
      - Cria appointment
      - Marca link como "booked"
   d. Confirma booking na Klingo (reserva -> voucher)
   e. Se Klingo falhou: notifica equipe via WhatsApp + enfileira retry
   f. Envia confirmacao ao paciente via WhatsApp
   g. Envia botao "Adicionar a agenda" (Google Calendar)
```

### Fast-Track

Se o paciente ja menciona a especialidade ("quero cardiologia"), a IA pula a triagem e gera o link imediatamente.

---

## 10. Controle de Acesso (RBAC)

### Perfis de Acesso

| Perfil | Label | Permissoes |
|--------|-------|-----------|
| `super_admin` | Super Admin | TODAS as permissoes |
| `finance_director` | Diretoria Financeira | Dashboard, metricas, todas as financeiras |
| `finance_analyst` | Analista Financeiro | Dashboard, financeiras (com aprovacao) |
| `finance_operator` | Operacao Financeira | Dashboard, financeiras (somente visualizacao + cadastros) |
| `attendant_basic` | Atendimento | Dashboard, conversas, teleconsulta, agendas, assinaturas |

### Grupos de Permissoes

**Workspace:**
`dashboard.view`, `conversations.view`, `teleconsulta.view`, `schedules.view`, `opd.view`, `billing.view`, `lab.view`, `pharmacy.view`, `metrics.view`, `subscriptions.view`

**Finance:**
`finance.view`, `finance.payable.view`, `finance.payable.approve`, `finance.payable.pay`, `finance.receivable.view`, `finance.receivable.receive`, `finance.daily.view`, `finance.cashflow.view`, `finance.cashflow.import_statement`, `finance.reimbursements.view`, `finance.orders.view`, `finance.cadastros.view`

**Admin:**
`settings.view`, `users.manage`

### Regras

- Role `admin` sempre tem TODAS as permissoes
- Cada perfil tem um conjunto base de permissoes
- `permissionOverrides` permite adicionar (`allow`) ou remover (`deny`) permissoes individuais
- `accessScope` controla quais centros de custo o usuario pode ver (`allCostCenters` ou `costCenterIds`)
- Middleware `authMiddleware` valida JWT em todas as rotas protegidas
- Funcao `hasPermission(user, 'permissao')` usada em guards de rota

---

## 11. Deploy e Infraestrutura

### Servidor de Producao

| Item | Valor |
|------|-------|
| IP | 187.77.62.141 |
| OS | Linux |
| Acesso | SSH (root) |
| Projeto | /opt/irb-whatsapp-ai |

### Containers Docker

| Container | Imagem Base | Porta | Descricao |
|-----------|-------------|-------|-----------|
| irb-postgres | pgvector/pgvector:pg16 | 5432 (interno) | PostgreSQL com pgvector |
| irb-mongo | mongo:7 | 27017 (interno) | MongoDB |
| irb-redis | redis:7-alpine | 6379 (interno) | Redis |
| irb-api | Custom (Dockerfile.api) | 127.0.0.1:3001 | API Fastify |
| irb-worker | Custom (Dockerfile.worker) | - | Workers BullMQ |
| irb-dashboard | Custom (Dockerfile.dashboard) | 8090 | React SPA (Nginx serve) |
| irb-bullboard | deadly0/bull-board | 3100 | Monitor de filas BullMQ |

### Volumes Persistentes

- `postgres_data` - Dados PostgreSQL
- `mongo_data` - Dados MongoDB
- `redis_data` - Dados Redis
- `prescription_data` - PDFs de prescricoes (/data/prescriptions)

### Nginx Reverse Proxy

O Nginx roda no host (nao containerizado) e faz:
- SSL termination (HTTPS)
- Proxy para irb-api (porta 3001)
- Proxy para irb-dashboard (porta 8090)
- Proxy para irb-bullboard (porta 3100)
- WebSocket upgrade para /ws

Dominios:
- `irb.saraiva.ai` - Dashboard + API
- `irb.saraiva.ai/agendar/*` - App de agendamento
- `irb.saraiva.ai/consulta/*` - App de teleconsulta

### Processo de Deploy

```bash
# 1. Sync dos arquivos para o servidor
rsync -avz --exclude node_modules --exclude .git \
  ./irb-whatsapp-ai/ root@187.77.62.141:/opt/irb-whatsapp-ai/

# 2. No servidor: rebuild e restart
cd /opt/irb-whatsapp-ai
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# 3. Verificar logs
docker compose -f docker-compose.prod.yml logs -f api worker
```

**Importante:** O arquivo `.dockerignore` e essencial. Sem ele, o COPY no Dockerfile sobrescreve os `node_modules` instalados pelo `pnpm install --frozen-lockfile` dentro do container. Os Dockerfiles devem copiar TODOS os `package.json` do workspace antes de rodar `pnpm install`.

---

## 12. Variaveis de Ambiente

### Obrigatorias

| Variavel | Descricao |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `MONGO_URI` | Connection string MongoDB |
| `REDIS_HOST` | Host do Redis |
| `REDIS_PORT` | Porta do Redis (default: 6379) |
| `JWT_SECRET` | Segredo para assinar tokens JWT |
| `UAZAPI_URL` | URL base da instancia UAZAPI |
| `UAZAPI_TOKEN` | Token de autenticacao UAZAPI |
| `OPENAI_API_KEY` | Chave da API OpenAI (GPT-4o-mini + embeddings) |
| `KLINGO_APP_TOKEN` | Token X-APP-TOKEN da Klingo External API |

### Opcionais

| Variavel | Default | Descricao |
|----------|---------|-----------|
| `API_PORT` | 3001 | Porta da API |
| `NODE_ENV` | development | Ambiente (production/development) |
| `LOG_LEVEL` | info | Nivel de log (debug, info, warn, error) |
| `REDIS_PASSWORD` | - | Senha do Redis |
| `UAZAPI_ACCEPTED_TOKENS` | - | Tokens adicionais aceitos no webhook (separados por virgula) |
| `UAZAPI_ALLOWED_INSTANCE_NAMES` | irbPRIME,uazapi | Instancias permitidas |
| `MAX_AI_MESSAGES_PER_10_MIN` | 5 | Limite de mensagens AI por conversa a cada 10 min |
| `FOLLOW_UP_TIMEZONE` | America/Sao_Paulo | Timezone para follow-ups |
| `FOLLOW_UP_QUIET_HOUR_START` | 21 | Inicio do horario de silencio |
| `FOLLOW_UP_QUIET_HOUR_END` | 8 | Fim do horario de silencio |
| `KLINGO_EXTERNAL_BASE_URL` | https://api-externa.klingo.app | URL base Klingo |
| `BOOKING_BASE_URL` | https://irb.saraiva.ai/agendar | URL base dos links de agendamento |
| `TELECONSULTA_BASE_URL` | https://irb.saraiva.ai/consulta | URL base da teleconsulta |
| `TEAM_NOTIFY_PHONE` | 5511975830146 | Telefone para notificacoes da equipe |
| `DIRECTOR_PHONE` | 5511975830146 | Telefone do diretor |
| `FINANCE_PHONE` | 5511975830146 | Telefone do financeiro |
| `DASHBOARD_URL` | https://irb.saraiva.ai | URL do dashboard |
| `STAFF_PHONES` | - | Numeros de staff que a IA ignora (separados por virgula) |
| `GROQ_API_KEY` | - | Chave Groq para Whisper (mais rapido, prioridade sobre OpenAI) |
| `ASAAS_API_KEY` | - | Chave da API Asaas |
| `ASAAS_ENVIRONMENT` | sandbox | Ambiente Asaas (sandbox/production) |
| `IGS_BASE_URL` | https://prdapolobr.igs.teknosgroup.com/api-apolo/v1 | URL da API IGS |
| `IGS_SERVICE` | - | Servico IGS |
| `IGS_AUTH_KEY` | - | Chave de autenticacao IGS |
| `IGS_USERNAME` | - | Usuario IGS |
| `IGS_PASSWORD` | - | Senha IGS |
| `POSTGRES_DB` | - | Nome do banco PostgreSQL |
| `POSTGRES_USER` | - | Usuario PostgreSQL |
| `POSTGRES_PASSWORD` | - | Senha PostgreSQL |

---

## 13. Monitoramento

### Health Check

**Endpoint:** `GET /api/health` (publico)

**Resposta:**

```json
{
  "status": "ok",
  "timestamp": "2026-03-19T15:30:00.000Z",
  "uptime": 86400.123,
  "services": {
    "redis": "ok",
    "postgres": "ok",
    "mongo": "ok"
  }
}
```

Se algum servico estiver indisponivel, retorna `"unavailable"` no campo correspondente.

### BullBoard

Disponivel em `https://irb.saraiva.ai:3100` (porta 3100), mostra:
- Status de todas as 16 filas
- Jobs ativos, completos, falhados, atrasados
- Detalhes de cada job (payload, erro, tentativas)
- Metricas de throughput

### WebSocket (Dashboard Real-Time)

O dashboard conecta em `wss://irb.saraiva.ai/ws` e recebe eventos:

| Canal | Evento | Descricao |
|-------|--------|-----------|
| `channel:conversations` | `message:received` | Nova mensagem do paciente |
| `channel:conversations` | `message:sent` | Mensagem enviada (IA ou humano) |
| `channel:escalations` | `escalation:created` | Conversa escalada para humano |
| `channel:metrics` | * | Atualizacoes de metricas |

---

## 14. Troubleshooting Comum

### Mensagens nao chegam no sistema

1. Verificar se a instancia UAZAPI esta conectada: `GET /instance/status`
2. Verificar se o webhook esta ativo: `GET /api/webhooks/uazapi/health`
3. Verificar logs do container api: `docker logs irb-api --tail 100`
4. Verificar se o token no webhook UAZAPI bate com `UAZAPI_TOKEN`
5. Verificar se `UAZAPI_ALLOWED_INSTANCE_NAMES` inclui o nome da instancia

### IA nao responde

1. Verificar se `OPENAI_API_KEY` esta configurada
2. Verificar fila `ai-pipeline` no BullBoard (jobs falhando?)
3. Verificar se a conversa esta com `isAiHandling: true` no MongoDB
4. Verificar rate limit: maximo 5 mensagens AI por conversa a cada 10 minutos
5. Verificar se o numero nao esta na lista de `STAFF_PHONES`

### Agendamento nao sincroniza com Klingo

1. Verificar se `KLINGO_APP_TOKEN` esta configurado
2. Verificar logs: procurar por `[booking]` ou `[ai-pipeline]`
3. Verificar o campo `klingo_sync_status` na tabela `appointments` (pending/synced/failed)
4. O campo `klingo_sync_error` mostra o motivo da falha
5. O worker `klingo-sync` faz retry automatico (3 tentativas, backoff exponencial)
6. Se falhou, a equipe recebe notificacao WhatsApp para acao manual

### Botoes nao aparecem no WhatsApp

1. Verificar logs do `message-send`: procurar por `Interactive send failed`
2. UAZAPI limita botoes a 3 por mensagem (maximo WhatsApp)
3. Texto do botao: maximo 20 caracteres
4. Se UAZAPI rejeitar, o sistema faz fallback para texto puro automaticamente
5. O AI Pipeline converte listas automaticamente para botoes (max 3)

### Webhooks Asaas nao processam

1. Verificar se `ASAAS_API_KEY` esta configurado
2. Verificar se o webhook Asaas esta apontando para `/api/webhooks/asaas`
3. Verificar fila `payment-notification` no BullBoard

### Audio nao e transcrito

1. Verificar se `GROQ_API_KEY` ou `OPENAI_API_KEY` esta configurado
2. Verificar se o UAZAPI retorna a midia no `/message/download`
3. Verificar logs: procurar por `[whisper]`
4. Minimo de 100 bytes para considerar audio valido

### Erro de concorrencia no MongoDB (VersionError)

O worker `ai-pipeline` tem retry automatico (3 tentativas) com mecanismo `saveConversationWithRetry`. Se persistir, verificar se multiplos workers estao processando a mesma conversa (distributed lock deveria prevenir).

### Container nao inicia apos deploy

1. Verificar se `.dockerignore` existe (sem ele, COPY sobrescreve node_modules)
2. Verificar se todos os `package.json` do workspace estao sendo copiados no Dockerfile
3. Verificar se `pnpm-lock.yaml` esta atualizado
4. Testar build local: `docker compose -f docker-compose.prod.yml build api`

### Dashboard nao conecta WebSocket

1. Verificar configuracao Nginx para WebSocket upgrade:
```nginx
location /ws {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```
2. Verificar se Redis esta rodando (pub/sub depende dele)

---

## Apendice A: Persona Julia (IA)

A IA se apresenta como "Julia, da recepcao da IRB Prime Care". Principais caracteristicas:

- Nunca se identifica como IA, chatbot ou assistente virtual
- Fala como pessoa real no WhatsApp (mensagens curtas, emojis naturais)
- Proibido usar formatacao (negrito, listas, bullet points)
- Triagem obrigatoria antes de agendar (exceto fast-track quando paciente ja sabe a especialidade)
- Maximo 3 botoes por mensagem
- Split automatico de mensagens longas via `\n\n`
- Aplica tecnicas de PNL e Sexy Canvas (seguranca, amor, liberdade, pertencimento, curiosidade, recompensa, diversao)
- Corpo clinico mapeado: 11 medicos com especialidades especificas
- Endereco: Rua Boa Vista, 99 - 6o Andar, Sao Paulo/SP
- Horario: Seg-Sex 7h-19h, Sab-Dom fechado
- Consulta: R$ 149,90 (retorno 30 dias gratis)
- Pagamento: PIX, cartao 3x, boleto

## Apendice B: Corpo Clinico

| Medico | Especialidade |
|--------|---------------|
| Dr. Flavio Barbieri | Clinica Medica / Check-up |
| Dra. Natalia Mucare | Cardiologia |
| Dr. Angelo Campos | Neurologia |
| Dr. Pedro Cardoso | Urologia |
| Dra. Karla Souza | Reumatologia |
| Dr. Eduardo Marim | Cirurgia Vascular |
| Dra. Maira Melo | Psiquiatria |
| Dra. Natalia Barbosa | Estetica |
| Dra. Thalita Goulart | Odontologia |
| Dra. Beatriz | Pediatria |
| Dr. Rodrigo Favoreto / Dr. Lucas Rodrigues | Ultrassonografia |
