# IRB WhatsApp AI - Documentacao de Deploy e Sistema Financeiro

## Resumo Executivo

Este documento descreve a implementacao completa do sistema IRB WhatsApp AI, incluindo o modulo financeiro e o deploy em producao.

---

## 1. Sistema Desenvolvido

### 1.1 Visao Geral

O IRB WhatsApp AI e um sistema integrado para gestao de clinica medica que combina:
- **Atendimento via WhatsApp** com IA (Claude)
- **Dashboard administrativo** web
- **Modulo financeiro** completo
- **Integracoes** com Klingo, UAZAPI, Asaas

### 1.2 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Dashboard  │  │   Booking   │  │   Teleconsulta      │  │
│  │  (React)    │  │   (React)   │  │   (React+WebRTC)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    API      │  │   Worker    │  │      AI Engine      │  │
│  │  (Fastify)  │  │  (BullMQ)   │  │     (Claude)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATABASES                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ PostgreSQL  │  │   MongoDB   │  │       Redis         │  │
│  │ (pgvector)  │  │(conversas)  │  │  (filas/cache)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Modulo Financeiro

### 2.1 Funcionalidades Implementadas

#### Contas a Pagar (`/financeiro/contas-pagar`)
- CRUD completo de contas
- Calculo automatico de impostos retidos (INSS, IR, CSLL, COFINS, PIS, ISS)
- Workflow de aprovacao (pendente → aprovado → pago)
- Fila do dia com vencimentos
- Filtros por status, fornecedor, centro de custo
- Relatorios de aging (vencidos, a vencer)

#### Contas a Receber (`/financeiro/contas-receber`)
- CRUD de recebiveis
- Parcelamento automatico
- Registro de recebimentos parciais
- Aging report (0-30, 31-60, 61-90, 90+ dias)
- Integracao com convenios de saude
- Link com vouchers Klingo

#### Fluxo de Caixa (`/financeiro/fluxo-caixa`)
- Visao diaria e mensal
- Projecao de 30/60/90 dias
- DRE simplificado
- Gestao de contas bancarias
- Saldo consolidado

### 2.2 Tabelas do Banco de Dados

```sql
-- Estrutura Financeira (18 tabelas)
cost_centers          -- 21 centros de custo
chart_of_accounts     -- 30 categorias contabeis
suppliers             -- Fornecedores
bank_accounts         -- 7 contas bancarias
accounts_payable      -- Contas a pagar
payment_approvals     -- Aprovacoes
credit_card_purchases -- Compras cartao
bank_transactions     -- Conciliacao
insurance_providers   -- 13 convenios
accounts_receivable   -- Contas a receber
receivable_installments -- Parcelas
receivable_payments   -- Recebimentos
reimbursement_requests -- Reembolsos
reimbursement_items   -- Itens reembolso
transport_vouchers    -- Vale-transporte
cash_flow_snapshots   -- Posicao diaria
```

### 2.3 APIs Criadas

```
POST/GET/PUT/DELETE /api/accounts-payable
POST /api/accounts-payable/:id/approve
POST /api/accounts-payable/:id/pay
GET  /api/accounts-payable/queue/today
GET  /api/accounts-payable/report/aging

POST/GET/PUT/DELETE /api/accounts-receivable
POST /api/accounts-receivable/:id/receive
GET  /api/accounts-receivable/report/aging
GET  /api/accounts-receivable/summary

GET  /api/cash-flow/daily
GET  /api/cash-flow/monthly
GET  /api/cash-flow/projection
GET  /api/cash-flow/dre
GET  /api/cash-flow/bank-accounts
```

### 2.4 Workers de Automacao

- **payment-approval.ts** - Envia resumo diario as 8h via WhatsApp
- **overdue-collection.ts** - Cobranca automatica de inadimplentes

---

## 3. Deploy em Producao

### 3.1 Infraestrutura

| Componente | Especificacao |
|------------|---------------|
| Servidor | Digital Ocean (147.182.253.191) |
| OS | Ubuntu |
| Reverse Proxy | Caddy (SSL automatico) |
| Containers | Docker Compose |
| Dominio | irb.saraiva.ai |

### 3.2 Containers em Execucao

```yaml
services:
  irb-api:
    porta: 3003 (interno)
    imagem: irb-whatsapp-api
    
  irb-worker:
    15 workers BullMQ ativos
    imagem: irb-whatsapp-worker
    
  irb-dashboard:
    porta: 8091 (interno)
    imagem: irb-whatsapp-dashboard (nginx)
```

### 3.3 Bancos de Dados (Compartilhados)

```yaml
postgres:
  versao: 17
  extensao: pgvector
  database: irb_whatsapp
  rede: proxy

mongo:
  versao: 8
  database: irb_whatsapp
  rede: proxy

redis:
  versao: 7-alpine
  senha: configurada
  rede: proxy
```

### 3.4 Configuracao Caddy

```caddyfile
irb.saraiva.ai {
    handle /api/* {
        reverse_proxy localhost:3003
    }
    handle /ws/* {
        reverse_proxy localhost:3003
    }
    handle {
        reverse_proxy localhost:8091
    }
}
```

---

## 4. Arquivos Modificados/Criados

### 4.1 Frontend (Dashboard)

```
apps/dashboard/src/
├── pages/
│   ├── AccountsPayable.tsx    (NOVO - ~800 linhas)
│   ├── AccountsReceivable.tsx (NOVO - ~750 linhas)
│   └── CashFlow.tsx           (NOVO - ~600 linhas)
├── services/
│   └── api.ts                 (MODIFICADO - +50 metodos)
├── components/layout/
│   └── Sidebar.tsx            (MODIFICADO - submenu financeiro)
└── main.tsx                   (MODIFICADO - 3 novas rotas)
```

### 4.2 Backend (API)

```
apps/api/src/
├── routes/
│   ├── accounts-payable.ts    (NOVO)
│   ├── accounts-receivable.ts (NOVO)
│   └── cash-flow.ts           (NOVO)
├── services/
│   ├── accounts-payable-service.ts    (NOVO)
│   ├── accounts-receivable-service.ts (NOVO)
│   └── cash-flow-service.ts           (NOVO)
└── server.ts                  (MODIFICADO - registro de rotas)
```

### 4.3 Database

```
packages/database/src/postgres/
├── schema.ts                  (MODIFICADO - 18 tabelas novas)
└── migrations/
    └── 0005_financial_module.sql (NOVO - DDL + seeds)
```

### 4.4 Workers

```
apps/worker/src/processors/
├── payment-approval.ts    (NOVO)
└── overdue-collection.ts  (NOVO)
```

---

## 5. Correcoes Aplicadas Durante Deploy

### 5.1 Redis Password

Todos os arquivos que criam conexao Redis foram corrigidos para incluir a senha:

```typescript
// ANTES (erro NOAUTH)
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// DEPOIS (corrigido)
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};
```

**Arquivos corrigidos:**
- `apps/worker/src/index.ts`
- `apps/worker/src/processors/ai-pipeline.ts`
- `apps/worker/src/processors/message-intake.ts`
- `apps/worker/src/processors/follow-up.ts`
- `apps/worker/src/processors/appointment-reminder.ts`
- `apps/worker/src/processors/appointment-confirmation.ts`
- `apps/worker/src/processors/nps-collection.ts`
- `apps/worker/src/processors/payment-notification.ts`
- `apps/worker/src/processors/payment-reminder.ts`
- `apps/worker/src/processors/teleconsultation-reminder.ts`
- `apps/worker/src/processors/overdue-collection.ts`
- `apps/worker/src/processors/payment-approval.ts`
- `apps/api/src/routes/booking.ts`
- `apps/api/src/routes/subscriptions.ts`
- `apps/api/src/routes/teleconsultation.ts`
- `apps/api/src/routes/webhooks/uazapi.ts`
- `apps/api/src/routes/webhooks/asaas.ts`
- `apps/api/src/routes/webhooks/klingo.ts`

### 5.2 pgvector

Instalado no container PostgreSQL existente:
```bash
docker exec postgres apt-get update
docker exec postgres apt-get install -y postgresql-17-pgvector
docker exec postgres psql -U postgres -d irb_whatsapp -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

---

## 6. Acesso ao Sistema

### 6.1 URLs

| Aplicacao | URL |
|-----------|-----|
| Dashboard | https://irb.saraiva.ai |
| API | https://irb.saraiva.ai/api/* |
| Booking | https://irb.saraiva.ai/agendar/* |
| Teleconsulta | https://irb.saraiva.ai/consulta/* |

### 6.2 Credenciais de Teste

```
Email: admin@irb.com.br
Senha: admin123
Role: admin

Email: financeiro@irb.com.br
Senha: admin123
Role: operator
```

---

## 7. Comandos Uteis

### 7.1 SSH e Acesso

```bash
# Conectar ao servidor
ssh do

# Diretorio do projeto
cd /opt/irb-whatsapp
```

### 7.2 Docker

```bash
# Ver containers
docker ps --filter 'name=irb'

# Logs
docker logs irb-api -f
docker logs irb-worker -f
docker logs irb-dashboard -f

# Restart
docker compose -f docker-compose.prod.yml restart

# Rebuild completo
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### 7.3 Banco de Dados

```bash
# Conectar ao PostgreSQL
docker exec -it postgres psql -U postgres -d irb_whatsapp

# Listar tabelas
\dt

# Ver dados de uma tabela
SELECT * FROM cost_centers;
```

### 7.4 Deploy de Atualizacoes

```bash
# Do seu computador local
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  /Users/saraiva/Documents/IRB/irb-whatsapp-ai/ do:/opt/irb-whatsapp/

# No servidor
ssh do
cd /opt/irb-whatsapp
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## 8. Proximos Passos (Opcional)

1. **Configurar KLINGO_APP_TOKEN** - Para integracao completa com Klingo
2. **Configurar webhook UAZAPI** - Para bot WhatsApp funcionar
3. **Adicionar monitoramento** - Healthchecks, alertas
4. **Configurar backups** - Backup automatico do PostgreSQL/MongoDB
5. **Testar modulo financeiro** - Validar todas as funcionalidades

---

## 9. Contato e Suporte

- **Projeto**: IRB WhatsApp AI
- **Repositorio**: /Users/saraiva/Documents/IRB/irb-whatsapp-ai
- **Servidor**: Digital Ocean - 147.182.253.191
- **Data do Deploy**: 05/03/2026

---

*Documento gerado automaticamente durante sessao de deploy.*
