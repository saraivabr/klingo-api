# Manual Tecnico de Manutencao

## Sistema IRB Prime Care - WhatsApp AI

**Versao:** 1.0
**Data:** 19/03/2026
**Publico-alvo:** Desenvolvedores e administradores de sistema

---

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Infraestrutura](#2-infraestrutura)
3. [Deploy](#3-deploy)
4. [Banco de Dados](#4-banco-de-dados)
5. [Monitoramento](#5-monitoramento)
6. [Manutencao Rotineira](#6-manutencao-rotineira)
7. [Variaveis de Ambiente](#7-variaveis-de-ambiente)
8. [Integracoes Externas](#8-integracoes-externas)
9. [Troubleshooting](#9-troubleshooting)
10. [Seguranca](#10-seguranca)
11. [Contatos e Recursos](#11-contatos-e-recursos)
12. [Procedimentos de Emergencia](#12-procedimentos-de-emergencia)

---

## 1. Visao Geral

### 1.1 Arquitetura do Sistema

```
                        +-----------------------+
                        |    Cloudflare DNS      |
                        |   irb.saraiva.ai       |
                        +-----------+-----------+
                                    |
                                    | HTTPS :443
                                    v
+-------------------------------[ SERVIDOR 187.77.62.141 ]-------------------------------+
|                                                                                         |
|   +-------------+        +------------------+        +------------------+               |
|   |   Nginx     |------->|  irb-dashboard   |        |   irb-bullboard  |               |
|   | :80/:443    |        |  :8090 (static)  |        |   :3100          |               |
|   | :3080(hook) |        +------------------+        +------------------+               |
|   +------+------+        Serve: Dashboard, Booking,                                     |
|          |               Teleconsulta, CRM (SPAs)                                       |
|          |                                                                              |
|          | /api/* /ws                                                                   |
|          v                                                                              |
|   +-------------+        +------------------+                                           |
|   |  irb-api    |<------>|   irb-worker     |                                           |
|   |  :3001      |        |  (background)    |                                           |
|   | Fastify     |        |  BullMQ Workers  |                                           |
|   +------+------+        +--------+---------+                                           |
|          |                        |                                                     |
|          +--------+-------+-------+                                                     |
|                   |       |       |                                                     |
|                   v       v       v                                                     |
|            +------++ +----+--+ +--+----+                                                |
|            |Postgres| |MongoDB| | Redis |                                                |
|            |pgvector| | :27017| | :6379 |                                                |
|            | :5432  | +-------+ +-------+                                                |
|            +--------+                                                                   |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
                    |                     |                      |
                    v                     v                      v
           +---------------+    +------------------+    +----------------+
           |  UAZAPI       |    |  OpenAI API      |    |  Klingo API    |
           | (WhatsApp)    |    |  (GPT-4o-mini)   |    |  (Agenda/PEP)  |
           +---------------+    +------------------+    +----------------+
                                        |
                                        v
                                +----------------+
                                |  Asaas          |
                                | (Pagamentos)    |
                                +----------------+
```

### 1.2 Stack Tecnologica

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Runtime | Node.js | 20 (Alpine) |
| Gerenciador de pacotes | pnpm | 9.x |
| Framework API | Fastify | latest |
| Filas | BullMQ + Redis | latest |
| Banco relacional | PostgreSQL + pgvector | 16 |
| Banco de documentos | MongoDB | 7 |
| Cache/Filas | Redis | 7 (Alpine) |
| ORM SQL | Drizzle ORM | latest |
| ODM Mongo | Mongoose | latest |
| Frontend | React + Vite + Tailwind | latest |
| Containers | Docker Compose | latest |
| Reverse Proxy | Nginx | sistema |
| SSL | Let's Encrypt (Certbot) | auto |
| IA | OpenAI GPT-4o-mini | API |

### 1.3 Repositorio e Estrutura de Pastas

```
irb-whatsapp-ai/
├── apps/
│   ├── api/              # API REST (Fastify) - porta 3001
│   ├── worker/           # Workers BullMQ (processamento async)
│   ├── ai/               # Modulo de IA (classificador, prompts, audio)
│   ├── dashboard/        # Dashboard admin (React/Vite)
│   ├── booking/          # App de agendamento publico (React/Vite)
│   ├── teleconsulta/     # App de teleconsulta (React/Vite)
│   ├── crm/              # CRM Open Insights (React/Vite)
│   └── sync-klingo/      # Sincronizacao Klingo (utilitario)
├── packages/
│   ├── database/         # Schema Drizzle (Postgres) + Models Mongoose (Mongo)
│   └── shared/           # Constantes, tipos e utilitarios compartilhados
├── infra/
│   ├── docker/           # Dockerfiles (api, worker, dashboard)
│   └── nginx/            # Config Nginx para container dashboard
├── scripts/              # Scripts utilitarios (seeds, imports)
├── docker-compose.prod.yml  # Composicao de producao
├── package.json          # Root do monorepo pnpm
├── pnpm-workspace.yaml   # Definicao do workspace
├── pnpm-lock.yaml        # Lockfile
└── tsconfig.base.json    # Config TypeScript base
```

---

## 2. Infraestrutura

### 2.1 Servidor

| Atributo | Valor |
|----------|-------|
| **IP** | 187.77.62.141 |
| **SO** | Ubuntu 24.04 (Linux 6.8.0-100-generic) |
| **CPU** | 2 vCPUs |
| **RAM** | 8 GB |
| **Disco** | 96 GB (49% usado em 19/03/2026) |
| **Acesso SSH** | `ssh root@187.77.62.141` |
| **Dominio** | irb.saraiva.ai |
| **Projeto** | /opt/irb-whatsapp-ai |

### 2.2 Docker Containers

| Container | Imagem | Porta | Funcao |
|-----------|--------|-------|--------|
| irb-api | irb-whatsapp-ai-api | 127.0.0.1:3001->3001 | API REST backend |
| irb-worker | irb-whatsapp-ai-worker | nenhuma | Processamento de filas |
| irb-postgres | pgvector/pgvector:pg16 | 5432 (interno) | Banco relacional |
| irb-mongo | mongo:7 | 27017 (interno) | Conversas e mensagens |
| irb-redis | redis:7-alpine | 6379 (interno) | Filas BullMQ + cache |
| irb-bullboard | deadly0/bull-board | 0.0.0.0:3100->3000 | UI de monitoramento de filas |

**Nota:** O container `irb-dashboard` esta definido no docker-compose mas o servico de arquivos estaticos e feito diretamente pelo Nginx do host (porta 8090), servindo os arquivos em `/opt/irb-whatsapp-ai/apps/dashboard/dist`.

### 2.3 Volumes Docker

```bash
# Verificar volumes
docker volume ls | grep irb

# Volumes persistentes:
# irb-whatsapp-ai_postgres_data  -> dados PostgreSQL
# irb-whatsapp-ai_mongo_data     -> dados MongoDB
# irb-whatsapp-ai_redis_data     -> dados Redis (filas)
# irb-whatsapp-ai_prescription_data -> PDFs de receitas
```

### 2.4 Nginx

O Nginx do host escuta em tres portas:

**Porta 443 (HTTPS - producao):**
- `/` -> Dashboard (proxy para :8090)
- `/agendar/` -> App de agendamento (proxy para :8090, sem cache)
- `/api/` -> API backend (proxy para :8090, que faz proxy para :3001)
- `/ws` -> WebSocket (proxy para :3001)
- `/api/teleconsultation/signal/` -> WebSocket teleconsulta
- `/webhooks/uazapi` -> Webhook UAZAPI (proxy para :3001)

**Porta 8090 (interno - serve arquivos estaticos):**
- `/` -> Dashboard dist (`/opt/irb-whatsapp-ai/apps/dashboard/dist`)
- `/agendar/` -> Booking dist (`/opt/irb-whatsapp-ai/apps/booking/dist`)
- `/consulta/` -> Teleconsulta dist (`/opt/irb-whatsapp-ai/apps/teleconsulta/dist`)
- `/crm/` -> CRM dist (`/opt/irb-whatsapp-ai/apps/crm/dist`)
- `/api/` -> Proxy para API :3001
- `/ws` -> Proxy para WebSocket :3001

**Porta 3080 (webhook direto, sem SSL):**
- `/api/webhooks/uazapi` -> Webhook UAZAPI (proxy para :3001)

### 2.5 SSL

| Atributo | Valor |
|----------|-------|
| Certificado | Let's Encrypt (Certbot) |
| Dominio | irb.saraiva.ai |
| Caminho cert | /etc/letsencrypt/live/irb.saraiva.ai/fullchain.pem |
| Caminho key | /etc/letsencrypt/live/irb.saraiva.ai/privkey.pem |
| Validade | Verificar com `certbot certificates` |

Renovacao do certificado:

```bash
# Verificar validade
certbot certificates

# Renovar manualmente (se necessario)
certbot renew

# Renovar e recarregar Nginx
certbot renew && systemctl reload nginx
```

**ATENCAO:** O Certbot normalmente renova automaticamente via timer do systemd. Verifique:

```bash
systemctl status certbot.timer
```

---

## 3. Deploy

### 3.1 Pre-requisitos na maquina local

- Node.js >= 20
- pnpm >= 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Docker e Docker Compose
- rsync
- SSH configurado para `root@187.77.62.141`

### 3.2 Deploy Completo (passo a passo)

```bash
# 1. Na maquina local, entrar no diretorio do projeto
cd /caminho/para/irb-whatsapp-ai

# 2. Sincronizar arquivos para o servidor
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.env.*' \
  ./ root@187.77.62.141:/opt/irb-whatsapp-ai/

# 3. Conectar no servidor
ssh root@187.77.62.141

# 4. Entrar no diretorio
cd /opt/irb-whatsapp-ai

# 5. Rebuild e restart dos containers
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# 6. Verificar se tudo subiu
docker ps
docker logs irb-api --tail 20
docker logs irb-worker --tail 20

# 7. Testar health check
curl http://localhost:3001/api/health
```

### 3.3 Deploy apenas do Backend (API + Worker)

```bash
# No servidor
cd /opt/irb-whatsapp-ai

# Rebuild apenas API e Worker
docker compose -f docker-compose.prod.yml build --no-cache api worker
docker compose -f docker-compose.prod.yml up -d api worker

# Verificar
docker logs irb-api --tail 20
docker logs irb-worker --tail 20
curl http://localhost:3001/api/health
```

### 3.4 Deploy apenas do Frontend (Dashboard/Booking/CRM)

O frontend e servido como arquivos estaticos pelo Nginx do host na porta 8090. Para atualizar:

```bash
# OPCAO A: Rebuild do container dashboard (se usar container)
cd /opt/irb-whatsapp-ai
docker compose -f docker-compose.prod.yml build --no-cache dashboard
docker compose -f docker-compose.prod.yml up -d dashboard

# OPCAO B: Build local e copia dos arquivos (mais rapido)
# Na maquina local:
cd irb-whatsapp-ai
pnpm install
pnpm --filter @irb/dashboard build
pnpm --filter @irb/booking build
# Copiar para o servidor:
rsync -avz apps/dashboard/dist/ root@187.77.62.141:/opt/irb-whatsapp-ai/apps/dashboard/dist/
rsync -avz apps/booking/dist/ root@187.77.62.141:/opt/irb-whatsapp-ai/apps/booking/dist/
```

### 3.5 Como Fazer Rollback

```bash
# No servidor, se o deploy falhou:

# 1. Parar containers com problema
docker compose -f docker-compose.prod.yml stop api worker

# 2. Na maquina local, fazer checkout da versao anterior
git log --oneline -5   # ver commits recentes
git checkout <commit-hash-anterior>

# 3. Re-sincronizar e rebuild
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.env' \
  ./ root@187.77.62.141:/opt/irb-whatsapp-ai/

# 4. No servidor
cd /opt/irb-whatsapp-ai
docker compose -f docker-compose.prod.yml build --no-cache api worker
docker compose -f docker-compose.prod.yml up -d

# 5. Voltar para main na maquina local
git checkout main
```

### 3.6 Notas Importantes sobre Deploy

- O arquivo `.dockerignore` e **essencial**. Sem ele, o COPY do Docker sobrescreve os `node_modules` instalados pelo `pnpm install --frozen-lockfile` dentro do container.
- Os Dockerfiles copiam TODOS os `package.json` do workspace para que o `pnpm install --frozen-lockfile` funcione corretamente.
- O `.env` **nunca** deve ser sincronizado via rsync. Ele fica apenas no servidor.

---

## 4. Banco de Dados

### 4.1 PostgreSQL

**Conexao:**

```bash
# Via Docker (dentro do container)
docker exec -it irb-postgres psql -U irb -d irb_whatsapp

# Via host (se psql instalado)
PGPASSWORD=<senha> psql -h localhost -U irb -d irb_whatsapp -p 5432
```

**Tabelas principais:**

| Tabela | Descricao |
|--------|-----------|
| patients | Pacientes (phone, name, cpf_hash, klingo_patient_id) |
| users | Usuarios do dashboard (email, password_hash, role) |
| doctors | Medicos (name, specialty, crm, klingo_id) |
| services | Servicos oferecidos (name, price_cents, duration) |
| appointments | Agendamentos (patient_id, doctor_id, scheduled_at, status) |
| booking_links | Links de agendamento enviados (token, specialty, expires_at) |
| escalations | Escalacoes de atendimento (reason, priority, status) |
| business_hours | Horario de funcionamento |
| knowledge_base | Base de conhecimento da IA (pergunta/resposta) |
| knowledge_embeddings | Embeddings vetoriais para RAG (vector 1536) |
| ai_settings | Configuracoes da IA (model, temperature, etc.) |
| plans | Planos de saude (Prime Essencial, Plus, Elite) |
| subscriptions | Assinaturas de pacientes |
| payments | Pagamentos de assinaturas (Asaas) |
| teleconsultation_rooms | Salas de teleconsulta |
| prescriptions | Receitas medicas |
| schedules | Agendas dos medicos |
| bills, bill_items, bill_transactions | Faturamento |
| lab_orders, lab_results | Laboratorio |
| opd_visits, opd_vitals, opd_diagnoses | Atendimentos |
| medicines, medicine_sales | Farmacia |
| cost_centers | Centros de custo (21 unidades) |
| chart_of_accounts | Plano de contas |
| suppliers | Fornecedores |
| bank_accounts | Contas bancarias |
| accounts_payable | Contas a pagar |
| accounts_receivable | Contas a receber |
| campaigns, leads, lead_activities | CRM |

**Backup PostgreSQL:**

```bash
# Backup completo
docker exec irb-postgres pg_dump -U irb -d irb_whatsapp > /opt/backups/pg_backup_$(date +%Y%m%d_%H%M).sql

# Backup compactado
docker exec irb-postgres pg_dump -U irb -d irb_whatsapp | gzip > /opt/backups/pg_backup_$(date +%Y%m%d_%H%M).sql.gz

# Backup automatico (adicionar ao crontab)
# 0 2 * * * docker exec irb-postgres pg_dump -U irb -d irb_whatsapp | gzip > /opt/backups/pg_$(date +\%Y\%m\%d).sql.gz
```

**Restore PostgreSQL:**

```bash
# Restore de backup
docker exec -i irb-postgres psql -U irb -d irb_whatsapp < /opt/backups/pg_backup_YYYYMMDD.sql

# Restore de backup compactado
gunzip -c /opt/backups/pg_backup_YYYYMMDD.sql.gz | docker exec -i irb-postgres psql -U irb -d irb_whatsapp
```

### 4.2 MongoDB

**Conexao:**

```bash
# Via Docker
docker exec -it irb-mongo mongosh irb_whatsapp
```

**Colecoes principais:**

| Colecao | Descricao |
|---------|-----------|
| conversations | Conversas do WhatsApp (mensagens, estado, metricas da IA) |

Estrutura da conversa:
- `patientPhone` - Telefone do paciente
- `state` - Estado atual (greeting, scheduling, etc.)
- `status` - active, escalated, closed
- `isAiHandling` - Se a IA esta respondendo
- `messages[]` - Array de mensagens (sender, text, type, aiMetadata)
- `metrics` - Metricas de atendimento

**Backup MongoDB:**

```bash
# Backup completo
docker exec irb-mongo mongodump --db irb_whatsapp --out /dump
docker cp irb-mongo:/dump /opt/backups/mongo_backup_$(date +%Y%m%d)

# Alternativa: direto do host
docker exec irb-mongo mongodump --db irb_whatsapp --archive=/tmp/mongo.gz --gzip
docker cp irb-mongo:/tmp/mongo.gz /opt/backups/mongo_$(date +%Y%m%d).gz
```

**Restore MongoDB:**

```bash
# Restore
docker cp /opt/backups/mongo_backup_YYYYMMDD irb-mongo:/dump
docker exec irb-mongo mongorestore --db irb_whatsapp /dump/irb_whatsapp

# Restore de arquivo compactado
docker cp /opt/backups/mongo_YYYYMMDD.gz irb-mongo:/tmp/mongo.gz
docker exec irb-mongo mongorestore --db irb_whatsapp --archive=/tmp/mongo.gz --gzip
```

### 4.3 Redis

**Uso:** Filas BullMQ (processamento de mensagens, agendamentos, notificacoes).

```bash
# Conectar ao Redis
docker exec -it irb-redis redis-cli

# Ver uso de memoria
docker exec irb-redis redis-cli INFO memory | grep used_memory_human

# Listar filas (keys BullMQ)
docker exec irb-redis redis-cli KEYS "bull:*" | head -20

# Ver quantos jobs em cada fila
docker exec irb-redis redis-cli KEYS "bull:*:waiting"

# Flush APENAS se necessario (CUIDADO: apaga todas as filas!)
# docker exec irb-redis redis-cli FLUSHALL

# Monitorar comandos em tempo real
docker exec irb-redis redis-cli MONITOR
```

### 4.4 Migrations e Seeds

```bash
# No servidor, dentro do container da API:

# Gerar nova migration (apos alterar schema.ts)
docker exec irb-api npx drizzle-kit generate

# Rodar migrations pendentes
docker exec irb-api npx drizzle-kit migrate

# Rodar seed (dados iniciais: servicos, medicos, horarios, planos, etc.)
docker exec irb-api node -e "import('./packages/database/dist/seed.js')"

# OU via pnpm na maquina local (com DATABASE_URL apontando para producao):
# pnpm db:migrate
# pnpm db:seed
```

---

## 5. Monitoramento

### 5.1 Health Check

```bash
# Verificar se a API esta respondendo
curl https://irb.saraiva.ai/api/health

# Resposta esperada:
# {
#   "status": "ok",
#   "timestamp": "2026-03-19T...",
#   "uptime": 12345.678,
#   "services": {
#     "redis": "ok",
#     "postgres": "ok",
#     "mongo": "ok"
#   }
# }

# Se algum servico estiver "unavailable", verificar o container correspondente
```

### 5.2 Logs dos Containers

```bash
# Logs em tempo real
docker logs -f irb-api
docker logs -f irb-worker

# Ultimas 100 linhas
docker logs --tail 100 irb-api
docker logs --tail 100 irb-worker

# Logs com timestamp
docker logs --tail 50 -t irb-api

# Logs de um periodo especifico
docker logs --since "2026-03-19T10:00:00" irb-api

# Verificar erros no worker
docker logs irb-worker 2>&1 | grep -i "error\|failed\|ERR"

# Ver todos os containers
docker ps -a
```

### 5.3 BullBoard (Monitoramento de Filas)

**URL:** http://187.77.62.141:3100

**ATENCAO:** O BullBoard esta exposto na porta 3100 sem autenticacao. Considere restringir acesso por IP no firewall.

Filas disponiveis (16 filas):

| Fila | Concorrencia | Funcao | Agendamento |
|------|-------------|--------|-------------|
| message-intake | 10 | Recepcao de mensagens WhatsApp | Sob demanda (webhook) |
| ai-pipeline | 5 | Processamento IA (classificacao + resposta) | Sob demanda |
| message-send | 10 | Envio de mensagens via UAZAPI | Sob demanda |
| follow-up | 3 | Follow-up automatico de pacientes | Sob demanda |
| analytics | 2 | Coleta de analitics | Sob demanda |
| booking-cleanup | 1 | Limpeza de links expirados | A cada 1 hora |
| appointment-reminder | 2 | Lembrete de consulta | Diario as 18:00 BRT |
| appointment-confirmation | 2 | Confirmacao de consulta | Diario as 14:00 BRT |
| klingo-sync | 2 | Sincronizacao com Klingo | Sob demanda |
| klingo-agenda-sync | 1 | Sync agenda Klingo (light a cada 5min, full a cada 1h) | Automatico |
| nps-collection | 2 | Coleta NPS | Sob demanda |
| payment-notification | 3 | Notificacao de pagamento | Sob demanda |
| payment-reminder | 3 | Lembrete de pagamento | Diario as 10:00 BRT |
| payment-approval | 1 | Aprovacao de pagamento | Diario as 08:00 BRT |
| teleconsultation-reminder | 2 | Lembrete de teleconsulta | Sob demanda |
| teleconsultation-cleanup | 1 | Limpeza de teleconsultas | A cada 30 minutos |

### 5.4 Sinais de Alerta

| Sinal | Como verificar | Gravidade |
|-------|---------------|-----------|
| Health check com servico "unavailable" | `curl localhost:3001/api/health` | CRITICA |
| Container reiniciando em loop | `docker ps` (ver coluna STATUS) | CRITICA |
| Worker com muitos jobs falhados | BullBoard :3100 ou `docker logs irb-worker` | ALTA |
| Disco acima de 80% | `df -h /` | ALTA |
| RAM acima de 90% | `free -h` | MEDIA |
| Certificado SSL expirando em < 7 dias | `certbot certificates` | ALTA |
| Muitos erros 502/504 no Nginx | `/var/log/nginx/error.log` | CRITICA |

### 5.5 Verificar se a IA esta Respondendo

```bash
# 1. Verificar se o worker esta rodando
docker ps | grep irb-worker

# 2. Verificar se tem jobs sendo processados na fila ai-pipeline
docker logs --tail 30 irb-worker | grep "ai-pipeline"

# 3. Verificar se a OpenAI esta respondendo (dentro do container)
docker exec irb-api node -e "
  fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY }
  }).then(r => r.json()).then(d => console.log('OpenAI OK, modelos:', d.data?.length || 'ERRO'))
    .catch(e => console.error('OpenAI FALHOU:', e.message))
"

# 4. Verificar conversas recentes no MongoDB
docker exec irb-mongo mongosh irb_whatsapp --eval "
  db.conversations.find({status:'active'}).sort({lastMessageAt:-1}).limit(3).forEach(c => {
    print(c.patientPhone + ' - ' + c.state + ' - AI: ' + c.isAiHandling + ' - Msgs: ' + c.messages.length);
  })
"

# 5. Verificar se mensagens estao chegando (fila message-intake)
docker logs --tail 30 irb-worker | grep "message-intake"
```

---

## 6. Manutencao Rotineira

### 6.1 Checklist Diario

```bash
# Executar estes comandos no servidor (ssh root@187.77.62.141)

# 1. Verificar se todos os containers estao rodando
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. Health check
curl -s http://localhost:3001/api/health | python3 -m json.tool

# 3. Verificar disco
df -h /

# 4. Verificar memoria
free -h

# 5. Verificar erros recentes no worker
docker logs --since "24h" irb-worker 2>&1 | grep -c "failed"

# 6. Verificar erros recentes na API
docker logs --since "24h" irb-api 2>&1 | grep -c "error"
```

### 6.2 Checklist Semanal

```bash
# 1. Verificar tamanho dos volumes Docker
docker system df -v | grep irb

# 2. Verificar certificado SSL
certbot certificates 2>/dev/null | grep "Expiry"

# 3. Limpar imagens Docker antigas
docker image prune -f

# 4. Verificar se ha jobs presos nas filas
# Acessar BullBoard em http://187.77.62.141:3100

# 5. Verificar tamanho do MongoDB
docker exec irb-mongo mongosh irb_whatsapp --eval "db.stats().dataSize / 1024 / 1024 + ' MB'"

# 6. Verificar tamanho do PostgreSQL
docker exec irb-postgres psql -U irb -d irb_whatsapp -c "SELECT pg_size_pretty(pg_database_size('irb_whatsapp'));"
```

### 6.3 Backup Mensal

```bash
# Criar diretorio de backup
mkdir -p /opt/backups

# Backup PostgreSQL
docker exec irb-postgres pg_dump -U irb -d irb_whatsapp | gzip > /opt/backups/pg_$(date +%Y%m%d).sql.gz

# Backup MongoDB
docker exec irb-mongo mongodump --db irb_whatsapp --archive=/tmp/mongo.gz --gzip
docker cp irb-mongo:/tmp/mongo.gz /opt/backups/mongo_$(date +%Y%m%d).gz

# Backup do .env (NUNCA enviar para fora do servidor sem criptografar!)
cp /opt/irb-whatsapp-ai/.env /opt/backups/env_$(date +%Y%m%d).bak

# Verificar tamanho dos backups
ls -lh /opt/backups/

# Limpar backups antigos (manter ultimos 3 meses)
find /opt/backups -type f -mtime +90 -delete
```

**Recomendacao:** Configurar backup automatico via crontab:

```bash
crontab -e

# Adicionar:
# Backup diario as 3:00 AM
0 3 * * * docker exec irb-postgres pg_dump -U irb -d irb_whatsapp | gzip > /opt/backups/pg_$(date +\%Y\%m\%d).sql.gz
0 3 * * * docker exec irb-mongo mongodump --db irb_whatsapp --archive=/tmp/mongo.gz --gzip && docker cp irb-mongo:/tmp/mongo.gz /opt/backups/mongo_$(date +\%Y\%m\%d).gz

# Limpar backups com mais de 30 dias
0 4 1 * * find /opt/backups -type f -mtime +30 -delete
```

### 6.4 Atualizacao de Certificados SSL

```bash
# Verificar se o timer de renovacao automatica esta ativo
systemctl status certbot.timer

# Se nao estiver ativo:
systemctl enable certbot.timer
systemctl start certbot.timer

# Renovacao manual (se necessario)
certbot renew
systemctl reload nginx

# Verificar validade atual
certbot certificates
```

### 6.5 Limpeza de Disco

```bash
# 1. Ver uso de disco
df -h /
du -sh /opt/irb-whatsapp-ai/
du -sh /var/lib/docker/

# 2. Limpar imagens Docker nao utilizadas
docker image prune -a -f

# 3. Limpar containers parados
docker container prune -f

# 4. Limpar volumes orfaos (CUIDADO!)
# docker volume prune -f  # So use se souber o que esta fazendo

# 5. Limpar logs do Docker (podem crescer muito)
truncate -s 0 /var/lib/docker/containers/*/\*-json.log

# 6. Limpar logs do sistema
journalctl --vacuum-time=7d

# 7. Limpar backups antigos
find /opt/backups -type f -mtime +30 -delete
```

---

## 7. Variaveis de Ambiente

Arquivo: `/opt/irb-whatsapp-ai/.env`

### 7.1 Lista Completa

| Variavel | Obrigatoria | Descricao | Valor Padrao |
|----------|-------------|-----------|-------------|
| **Banco de Dados** | | | |
| POSTGRES_HOST | Sim | Host do PostgreSQL | localhost |
| POSTGRES_PORT | Sim | Porta do PostgreSQL | 5432 |
| POSTGRES_DB | Sim | Nome do banco | irb_whatsapp |
| POSTGRES_USER | Sim | Usuario do banco | irb |
| POSTGRES_PASSWORD | Sim | Senha do banco | (sem padrao) |
| MONGO_URI | Sim | URI do MongoDB | mongodb://localhost:27017/irb_whatsapp |
| REDIS_HOST | Sim | Host do Redis | localhost |
| REDIS_PORT | Sim | Porta do Redis | 6379 |
| **Aplicacao** | | | |
| NODE_ENV | Sim | Ambiente | production |
| API_PORT | Sim | Porta da API | 3001 |
| LOG_LEVEL | Nao | Nivel de log (info, debug, warn, error) | info |
| TZ | Nao | Timezone | America/Sao_Paulo |
| JWT_SECRET | Sim | Chave secreta para JWT | (sem padrao) |
| JWT_EXPIRES_IN | Nao | Tempo de expiracao JWT | 24h |
| **WhatsApp (UAZAPI)** | | | |
| UAZAPI_URL | Sim | URL da instancia UAZAPI | https://saraiva.uazapi.com |
| UAZAPI_TOKEN | Sim | Token de autenticacao UAZAPI | (sem padrao) |
| UAZAPI_ACCEPTED_TOKENS | Nao | Tokens aceitos no webhook | (vazio) |
| UAZAPI_ALLOWED_INSTANCE_NAMES | Nao | Nomes de instancia permitidos | irbPRIME,uazapi |
| **OpenAI** | | | |
| OPENAI_API_KEY | Sim | Chave API da OpenAI | (sem padrao) |
| AI_MODEL | Nao | Modelo da OpenAI | gpt-4o-mini |
| **Klingo** | | | |
| KLINGO_APP_TOKEN | Sim | Token da API externa Klingo | (sem padrao) |
| KLINGO_EXTERNAL_BASE_URL | Nao | URL base da API externa | https://api-externa.klingo.app |
| **Asaas (Pagamentos)** | | | |
| ASAAS_API_KEY | Sim | Chave API do Asaas | (sem padrao) |
| ASAAS_ENVIRONMENT | Nao | Ambiente Asaas | production |
| **Comportamento** | | | |
| MAX_AI_MESSAGES_PER_10_MIN | Nao | Limite de msgs IA por 10min por conversa | 5 |
| FOLLOW_UP_TIMEZONE | Nao | Timezone para follow-up | America/Sao_Paulo |
| FOLLOW_UP_QUIET_HOUR_START | Nao | Hora silenciosa inicio | 21 |
| FOLLOW_UP_QUIET_HOUR_END | Nao | Hora silenciosa fim | 8 |
| **Notificacoes** | | | |
| TEAM_NOTIFY_PHONE | Nao | Telefone para notificacoes da equipe | 5511975830146 |
| DIRECTOR_PHONE | Nao | Telefone do diretor | 5511975830146 |
| FINANCE_PHONE | Nao | Telefone do financeiro | 5511975830146 |
| **URLs** | | | |
| BOOKING_BASE_URL | Nao | URL base do app de agendamento | https://irb.saraiva.ai/agendar |
| TELECONSULTA_BASE_URL | Nao | URL base da teleconsulta | https://irb.saraiva.ai/consulta |
| DASHBOARD_URL | Nao | URL do dashboard | https://irb.saraiva.ai |

### 7.2 Como Alterar Variaveis

```bash
# 1. Editar o arquivo .env
nano /opt/irb-whatsapp-ai/.env

# 2. Reiniciar os containers que usam a variavel alterada
# Se alterou algo de API/Worker:
docker compose -f /opt/irb-whatsapp-ai/docker-compose.prod.yml up -d api worker

# Se alterou algo de banco:
docker compose -f /opt/irb-whatsapp-ai/docker-compose.prod.yml up -d

# 3. Verificar se os containers reiniciaram
docker ps
```

---

## 8. Integracoes Externas

### 8.1 OpenAI

**Uso:** Classificacao de intencoes, geracao de respostas, transcricao de audio.
**Modelo em uso:** gpt-4o-mini

```bash
# Verificar se a API key esta funcionando
docker exec irb-api node -e "
  fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY }
  }).then(r => {
    console.log('Status:', r.status);
    return r.json();
  }).then(d => {
    if (d.error) console.error('ERRO:', d.error.message);
    else console.log('OK - Modelos disponiveis:', d.data.length);
  }).catch(e => console.error('FALHA:', e.message))
"

# Verificar quota/uso: acessar https://platform.openai.com/usage

# Trocar API key:
# 1. Gerar nova key em https://platform.openai.com/api-keys
# 2. Editar /opt/irb-whatsapp-ai/.env -> OPENAI_API_KEY=sk-...
# 3. Reiniciar: docker compose -f docker-compose.prod.yml up -d api worker
```

### 8.2 UAZAPI (WhatsApp)

**URL:** https://saraiva.uazapi.com
**Instancias permitidas:** irbPRIME, uazapi

```bash
# Verificar status da conexao WhatsApp
curl -s "https://saraiva.uazapi.com/status?token=<UAZAPI_TOKEN>" | python3 -m json.tool

# Verificar se o webhook esta configurado
curl -s "https://saraiva.uazapi.com/getWebhook?token=<UAZAPI_TOKEN>" | python3 -m json.tool
# O webhook deve apontar para: https://irb.saraiva.ai/api/webhooks/uazapi
# OU: http://187.77.62.141:3080/api/webhooks/uazapi (direto, sem SSL)

# Reconectar WhatsApp (se desconectou):
# 1. Acessar o painel UAZAPI: https://saraiva.uazapi.com
# 2. Verificar se a instancia "irbPRIME" esta conectada
# 3. Se desconectou, gerar novo QR Code e escanear com o celular

# Testar envio de mensagem (CUIDADO: envia mensagem real!)
# curl -X POST "https://saraiva.uazapi.com/sendText" \
#   -H "Content-Type: application/json" \
#   -d '{"token":"<TOKEN>","phone":"5511999999999","message":"Teste"}'
```

### 8.3 Asaas (Gateway de Pagamento)

**Ambiente:** production
**Uso:** Cobrancas de planos (PIX, boleto, cartao), notificacoes de pagamento.

```bash
# Verificar se a API key esta funcionando
docker exec irb-api node -e "
  fetch('https://api.asaas.com/v3/finance/balance', {
    headers: { 'access_token': process.env.ASAAS_API_KEY }
  }).then(r => r.json()).then(d => console.log('Saldo Asaas:', JSON.stringify(d)))
    .catch(e => console.error('FALHA:', e.message))
"

# Verificar webhooks configurados no Asaas:
# Acessar https://www.asaas.com -> Configuracoes -> Webhooks
# O webhook deve apontar para: https://irb.saraiva.ai/api/webhooks/asaas

# Trocar API key:
# 1. Gerar nova key no painel Asaas
# 2. Editar .env -> ASAAS_API_KEY=...
# 3. Reiniciar: docker compose -f docker-compose.prod.yml up -d api worker
```

### 8.4 Klingo (Sistema de Gestao Clinica)

**URL API Externa:** https://api-externa.klingo.app
**Uso:** Sincronizacao de agendas, medicos, pacientes, vouchers.

```bash
# Verificar se o token esta funcionando
docker exec irb-api node -e "
  fetch('https://api-externa.klingo.app/api/v1/doctors', {
    headers: { 'Authorization': 'Bearer ' + process.env.KLINGO_APP_TOKEN }
  }).then(r => {
    console.log('Status:', r.status);
    return r.json();
  }).then(d => console.log('Medicos:', Array.isArray(d) ? d.length : JSON.stringify(d).slice(0,200)))
    .catch(e => console.error('FALHA:', e.message))
"

# A sincronizacao Klingo roda automaticamente:
# - Light sync (agendas): a cada 5 minutos
# - Full sync (medicos + agendas + vouchers): a cada 1 hora

# Verificar se a sync esta rodando
docker logs --tail 50 irb-worker | grep -i "klingo"

# Trocar token:
# 1. Solicitar novo token ao suporte Klingo
# 2. Editar .env -> KLINGO_APP_TOKEN=...
# 3. Reiniciar: docker compose -f docker-compose.prod.yml up -d api worker
```

---

## 9. Troubleshooting

### 9.1 IA nao Responde

**Sintomas:** Paciente envia mensagem no WhatsApp e nao recebe resposta da IA.

```bash
# PASSO 1: Verificar se o Worker esta rodando
docker ps | grep irb-worker
# Se nao estiver rodando:
docker compose -f /opt/irb-whatsapp-ai/docker-compose.prod.yml up -d worker

# PASSO 2: Verificar se a mensagem chegou na fila
docker logs --tail 30 irb-worker | grep "message-intake"
# Se nao tem logs de intake, o webhook pode estar fora

# PASSO 3: Verificar a fila ai-pipeline
docker logs --tail 30 irb-worker | grep "ai-pipeline"
# Se tem erros, verificar abaixo

# PASSO 4: Verificar se a OpenAI esta respondendo
docker exec irb-api node -e "
  fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY }
  }).then(r => console.log('Status:', r.status))
    .catch(e => console.error('FALHA:', e.message))
"
# Se falhou: verificar API key, quota, ou status em https://status.openai.com

# PASSO 5: Verificar se tem jobs travados na fila
# Acessar BullBoard em http://187.77.62.141:3100
# Verificar se ha jobs "active" por muito tempo ou "failed"

# PASSO 6: Verificar Redis
docker exec irb-redis redis-cli PING
# Deve retornar "PONG"

# PASSO 7: Forcar restart do worker
docker restart irb-worker
docker logs -f irb-worker
```

### 9.2 WhatsApp Desconectou

**Sintomas:** Mensagens nao chegam, pacientes nao recebem resposta.

```bash
# PASSO 1: Verificar status da conexao UAZAPI
# Acessar o painel UAZAPI ou:
curl -s "https://saraiva.uazapi.com/status?token=<TOKEN>"

# PASSO 2: Se desconectou, acessar o painel UAZAPI
# https://saraiva.uazapi.com
# Gerar novo QR Code e escanear com o celular do numero +5517997796014

# PASSO 3: Verificar se o webhook esta configurado
curl -s "https://saraiva.uazapi.com/getWebhook?token=<TOKEN>"
# Deve mostrar a URL: https://irb.saraiva.ai/api/webhooks/uazapi

# PASSO 4: Testar se o webhook esta acessivel
curl -X POST https://irb.saraiva.ai/api/webhooks/uazapi -H "Content-Type: application/json" -d '{}'
# Deve retornar algo (nao timeout)
```

### 9.3 Dashboard nao Carrega

**Sintomas:** Ao acessar https://irb.saraiva.ai, pagina nao carrega ou mostra erro.

```bash
# PASSO 1: Verificar se o Nginx esta rodando
systemctl status nginx

# Se nao estiver:
systemctl start nginx

# PASSO 2: Verificar se os arquivos do dashboard existem
ls -la /opt/irb-whatsapp-ai/apps/dashboard/dist/index.html

# PASSO 3: Verificar erros do Nginx
tail -20 /var/log/nginx/error.log

# PASSO 4: Verificar se a porta 8090 esta respondendo
curl -I http://localhost:8090

# PASSO 5: Se os arquivos nao existem, fazer rebuild
cd /opt/irb-whatsapp-ai
docker compose -f docker-compose.prod.yml build --no-cache dashboard
docker compose -f docker-compose.prod.yml up -d dashboard
# Copiar os dist do container para o host se necessario

# PASSO 6: Testar acesso direto a API
curl http://localhost:3001/api/health
```

### 9.4 Erro 502 / 504

**Sintomas:** Erro "Bad Gateway" ou "Gateway Timeout" ao acessar o sistema.

```bash
# PASSO 1: Verificar se a API esta rodando
docker ps | grep irb-api

# Se nao estiver rodando:
docker compose -f /opt/irb-whatsapp-ai/docker-compose.prod.yml up -d api

# PASSO 2: Verificar logs da API
docker logs --tail 50 irb-api

# PASSO 3: Verificar se a API responde diretamente
curl http://localhost:3001/api/health

# PASSO 4: Verificar se o container esta reiniciando em loop
docker ps | grep irb-api
# Olhar coluna STATUS - se mostra "Restarting" ou uptime muito baixo

# PASSO 5: Verificar se o banco de dados esta acessivel
docker exec irb-postgres psql -U irb -d irb_whatsapp -c "SELECT 1"
docker exec irb-mongo mongosh --eval "db.runCommand({ping:1})"
docker exec irb-redis redis-cli PING

# PASSO 6: Verificar erro no Nginx
tail -20 /var/log/nginx/error.log

# PASSO 7: Restart completo
docker compose -f /opt/irb-whatsapp-ai/docker-compose.prod.yml restart
systemctl restart nginx
```

### 9.5 Banco de Dados Cheio

```bash
# PASSO 1: Verificar tamanho do PostgreSQL
docker exec irb-postgres psql -U irb -d irb_whatsapp -c "
  SELECT pg_size_pretty(pg_database_size('irb_whatsapp')) AS db_size;
"

# PASSO 2: Verificar tabelas maiores
docker exec irb-postgres psql -U irb -d irb_whatsapp -c "
  SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
  FROM pg_catalog.pg_statio_user_tables
  ORDER BY pg_total_relation_size(relid) DESC
  LIMIT 10;
"

# PASSO 3: Verificar tamanho do MongoDB
docker exec irb-mongo mongosh irb_whatsapp --eval "
  var stats = db.stats();
  print('Data: ' + (stats.dataSize/1024/1024).toFixed(2) + ' MB');
  print('Storage: ' + (stats.storageSize/1024/1024).toFixed(2) + ' MB');
"

# PASSO 4: Verificar tamanho das colecoes MongoDB
docker exec irb-mongo mongosh irb_whatsapp --eval "
  db.getCollectionNames().forEach(function(c) {
    var s = db[c].stats();
    print(c + ': ' + (s.size/1024/1024).toFixed(2) + ' MB (' + s.count + ' docs)');
  })
"

# PASSO 5: Limpar conversas antigas fechadas (mais de 6 meses)
docker exec irb-mongo mongosh irb_whatsapp --eval "
  var cutoff = new Date(Date.now() - 180*24*60*60*1000);
  var result = db.conversations.deleteMany({status:'closed', closedAt:{\$lt:cutoff}});
  print('Conversas removidas: ' + result.deletedCount);
"

# PASSO 6: VACUUM no PostgreSQL (recuperar espaco)
docker exec irb-postgres psql -U irb -d irb_whatsapp -c "VACUUM FULL ANALYZE;"
```

### 9.6 Redis com Memoria Alta

```bash
# PASSO 1: Verificar uso de memoria
docker exec irb-redis redis-cli INFO memory | grep used_memory_human

# PASSO 2: Verificar filas com muitos jobs
docker exec irb-redis redis-cli KEYS "bull:*:completed" | while read key; do
  echo "$key: $(docker exec irb-redis redis-cli LLEN $key)"
done

# PASSO 3: Limpar jobs completados antigos
# Os jobs ja tem removeOnComplete configurado, mas se acumular:
docker exec irb-redis redis-cli KEYS "bull:*:completed" | while read key; do
  docker exec irb-redis redis-cli DEL "$key"
done

# PASSO 4: Se necessario, flush total (PERDE TODAS AS FILAS!)
# docker exec irb-redis redis-cli FLUSHALL
# Reiniciar o worker depois: docker restart irb-worker
```

### 9.7 Container Reiniciando em Loop

```bash
# PASSO 1: Identificar qual container esta em loop
docker ps -a --format "table {{.Names}}\t{{.Status}}"

# PASSO 2: Ver logs do container com problema
docker logs --tail 100 <nome-container>

# Causas comuns:
# - Falta de variavel de ambiente no .env
# - Banco de dados nao esta acessivel (healthcheck falhou)
# - Erro no codigo (porta ja em uso, modulo nao encontrado)

# PASSO 3: Verificar se os bancos estao healthy
docker ps | grep -E "postgres|mongo|redis"
# Devem mostrar "(healthy)"

# PASSO 4: Se o problema e de dependencia, reiniciar tudo na ordem
docker compose -f /opt/irb-whatsapp-ai/docker-compose.prod.yml down
docker compose -f /opt/irb-whatsapp-ai/docker-compose.prod.yml up -d postgres mongo redis
# Esperar os bancos ficarem healthy (10-15 segundos)
sleep 15
docker compose -f /opt/irb-whatsapp-ai/docker-compose.prod.yml up -d api worker

# PASSO 5: Se o container falha por falta de memoria
free -h
# Se sem memoria, aumentar swap ou RAM do servidor
```

### 9.8 Pacientes Duplicados

```bash
# Verificar duplicatas por telefone
docker exec irb-postgres psql -U irb -d irb_whatsapp -c "
  SELECT phone, COUNT(*) as qtd, array_agg(id) as ids
  FROM patients
  GROUP BY phone
  HAVING COUNT(*) > 1
  ORDER BY qtd DESC;
"

# O campo phone tem constraint UNIQUE, entao duplicatas sao raras
# Se acontecer, pode ser por formatacao diferente do telefone (com/sem +55)

# Verificar no MongoDB (conversas duplicadas para mesmo telefone)
docker exec irb-mongo mongosh irb_whatsapp --eval "
  db.conversations.aggregate([
    {\$match: {status:'active'}},
    {\$group: {_id:'\$patientPhone', count:{\$sum:1}}},
    {\$match: {count:{\$gt:1}}},
    {\$sort: {count:-1}}
  ]).forEach(printjson)
"
```

### 9.9 Agendamento nao Sincroniza com Klingo

```bash
# PASSO 1: Verificar se a sync esta rodando
docker logs --tail 50 irb-worker | grep -i "klingo"

# PASSO 2: Verificar token Klingo
docker exec irb-api node -e "
  fetch('https://api-externa.klingo.app/api/v1/doctors', {
    headers: { 'Authorization': 'Bearer ' + process.env.KLINGO_APP_TOKEN }
  }).then(r => console.log('Status:', r.status))
    .catch(e => console.error('FALHA:', e.message))
"

# PASSO 3: Verificar agendamentos com erro de sync
docker exec irb-postgres psql -U irb -d irb_whatsapp -c "
  SELECT id, patient_id, scheduled_at, klingo_sync_status, klingo_sync_error, klingo_sync_attempts
  FROM appointments
  WHERE klingo_sync_status != 'synced'
  ORDER BY created_at DESC
  LIMIT 10;
"

# PASSO 4: Forcar re-sync de um agendamento
# Isso depende da logica de negocio, mas pode-se resetar o status:
# UPDATE appointments SET klingo_sync_status='pending', klingo_sync_attempts=0 WHERE id='<UUID>';
```

### 9.10 Como Escalar o Sistema

**Mais RAM (recomendado como primeira acao):**
- O servidor atual tem 8 GB. Para carga maior, aumentar para 16 GB.
- Contatar o provedor de hosting para upgrade.

**Mais Workers:**
- Aumentar a concorrencia no arquivo `packages/shared/src/constants/queues.ts`.
- Ou rodar multiplas instancias do worker (alterar docker-compose para `scale: 2`).

**Separar banco de dados:**
- Mover PostgreSQL e MongoDB para servidores dedicados.
- Atualizar as variaveis de conexao no `.env`.

**CDN para frontend:**
- Colocar os arquivos estaticos do dashboard num CDN (Cloudflare Pages, Vercel).

---

## 10. Seguranca

### 10.1 Portas Expostas

| Porta | Servico | Acesso |
|-------|---------|--------|
| 22 | SSH | Publico (considerar restringir) |
| 80 | Nginx (redireciona para 443) | Publico |
| 443 | Nginx (HTTPS) | Publico |
| 3080 | Nginx (webhook UAZAPI direto) | Publico |
| 3100 | BullBoard | **Publico SEM autenticacao** |
| 3001 | API (via Docker, bind 127.0.0.1) | Apenas localhost |
| 8090 | Nginx interno (estaticos) | Apenas localhost |
| 5432 | PostgreSQL (Docker interno) | Apenas Docker network |
| 27017 | MongoDB (Docker interno) | Apenas Docker network |
| 6379 | Redis (Docker interno) | Apenas Docker network |

**ATENCAO:** A porta 3100 (BullBoard) esta exposta publicamente sem autenticacao. Qualquer pessoa pode ver o estado das filas. Recomenda-se fortemente:

```bash
# Opcao 1: Restringir por IP no iptables
iptables -A INPUT -p tcp --dport 3100 -s <SEU_IP> -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -j DROP

# Opcao 2: Ativar UFW
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow 3080
ufw deny 3100
ufw enable
```

### 10.2 Firewall

O UFW esta **inativo** no servidor. Recomenda-se ativar:

```bash
# Configurar UFW
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw allow 3080/tcp   # Webhook UAZAPI
# NAO permitir 3100 (BullBoard) exceto para IPs especificos
ufw allow from <IP_DO_ADMIN> to any port 3100
ufw enable
ufw status
```

### 10.3 Senhas e Chaves

| Item | Onde fica | Como rotacionar |
|------|----------|----------------|
| SSH root | Servidor | `passwd root` |
| POSTGRES_PASSWORD | .env | Alterar .env, reiniciar postgres, api, worker |
| JWT_SECRET | .env | Alterar .env, reiniciar api (invalida todos os tokens) |
| OPENAI_API_KEY | .env | Gerar nova em platform.openai.com, alterar .env, reiniciar api+worker |
| UAZAPI_TOKEN | .env | Gerar novo no painel UAZAPI, alterar .env, reiniciar api+worker |
| KLINGO_APP_TOKEN | .env | Solicitar novo ao suporte Klingo, alterar .env, reiniciar api+worker |
| ASAAS_API_KEY | .env | Gerar nova no painel Asaas, alterar .env, reiniciar api+worker |

**Procedimento geral para rotacionar chaves:**

```bash
# 1. Gerar/obter nova chave do servico
# 2. Editar o arquivo .env
nano /opt/irb-whatsapp-ai/.env
# 3. Reiniciar containers
cd /opt/irb-whatsapp-ai
docker compose -f docker-compose.prod.yml up -d api worker
# 4. Verificar se tudo esta funcionando
curl http://localhost:3001/api/health
docker logs --tail 10 irb-api
docker logs --tail 10 irb-worker
```

### 10.4 LGPD - Dados de Pacientes

O sistema armazena dados sensiveis de pacientes:

- **PostgreSQL:** nome, telefone, email, data de nascimento, CPF (hash), historico de consultas, dados financeiros
- **MongoDB:** historico completo de conversas do WhatsApp (mensagens de texto, audio transcrito)

**Obrigacoes:**
- Backup criptografado ao transferir dados para fora do servidor
- Direito ao esquecimento: possibilidade de apagar dados de um paciente

```bash
# Apagar dados de um paciente (CUIDADO - irreversivel!)
# 1. Identificar o paciente
docker exec irb-postgres psql -U irb -d irb_whatsapp -c "
  SELECT id, phone, name FROM patients WHERE phone = '+5511999999999';
"

# 2. Apagar conversas no MongoDB
docker exec irb-mongo mongosh irb_whatsapp --eval "
  db.conversations.deleteMany({patientPhone: '+5511999999999'})
"

# 3. Apagar dados no PostgreSQL (verificar constraints de FK antes)
# Primeiro apagar registros dependentes: appointments, escalations, subscriptions, etc.
# Depois apagar o paciente
```

---

## 11. Contatos e Recursos

### 11.1 Repositorio

O codigo-fonte fica no repositorio Git local. Nao ha repositorio remoto configurado (verificar com `git remote -v`).

### 11.2 Fornecedores

| Servico | Fornecedor | Painel/URL | Suporte |
|---------|-----------|-----------|---------|
| WhatsApp API | UAZAPI | https://saraiva.uazapi.com | Suporte via site |
| Gateway de Pagamento | Asaas | https://www.asaas.com | https://ajuda.asaas.com |
| Sistema Clinico | Klingo | https://irb.klingo.app | Suporte Klingo |
| IA (LLM) | OpenAI | https://platform.openai.com | https://help.openai.com |
| Servidor (VPS) | Provedor hosting | (verificar contrato) | (verificar contrato) |
| DNS/CDN | Cloudflare | https://dash.cloudflare.com | (se aplicavel) |
| SSL | Let's Encrypt | https://letsencrypt.org | Gratuito, automatico |

### 11.3 Documentacao de Referencia

- **Fastify:** https://fastify.dev/docs/latest/
- **BullMQ:** https://docs.bullmq.io/
- **Drizzle ORM:** https://orm.drizzle.team/docs/overview
- **Mongoose:** https://mongoosejs.com/docs/
- **Docker Compose:** https://docs.docker.com/compose/
- **Nginx:** https://nginx.org/en/docs/
- **OpenAI API:** https://platform.openai.com/docs/
- **Asaas API:** https://docs.asaas.com/

---

## 12. Procedimentos de Emergencia

### 12.1 Sistema Fora do Ar

```bash
# PASSO 1: Conectar no servidor
ssh root@187.77.62.141

# PASSO 2: Verificar se o Docker esta rodando
systemctl status docker
# Se nao: systemctl start docker

# PASSO 3: Verificar containers
docker ps -a

# PASSO 4: Se nenhum container esta rodando, subir tudo
cd /opt/irb-whatsapp-ai
docker compose -f docker-compose.prod.yml up -d

# PASSO 5: Esperar os bancos ficarem saudaveis (15-30 segundos)
sleep 20
docker ps

# PASSO 6: Verificar Nginx
systemctl status nginx
# Se nao: systemctl start nginx

# PASSO 7: Testar
curl http://localhost:3001/api/health
curl -I https://irb.saraiva.ai

# PASSO 8: Se nada funciona, reboot do servidor (ultimo recurso!)
# reboot
# Depois do reboot, os containers com restart:always sobem automaticamente
# Pode demorar 1-2 minutos. Verificar com: docker ps
```

### 12.2 WhatsApp Parou

```bash
# PASSO 1: Verificar se os containers de backend estao rodando
docker ps | grep -E "irb-api|irb-worker"

# PASSO 2: Verificar webhook
curl -X POST http://localhost:3001/api/webhooks/uazapi \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'
# Deve responder (nao timeout)

# PASSO 3: Verificar conexao UAZAPI
# Acessar https://saraiva.uazapi.com e verificar status da instancia

# PASSO 4: Se desconectou, reconectar:
# - Acessar painel UAZAPI
# - Gerar novo QR Code para instancia "irbPRIME"
# - Escanear com o celular do numero da clinica

# PASSO 5: Verificar se os workers estao processando
docker logs --tail 20 irb-worker | grep -E "intake|send"

# PASSO 6: Restart do pipeline completo
docker restart irb-api irb-worker
```

### 12.3 Servidor sem Espaco

```bash
# PASSO 1: Verificar uso
df -h /

# PASSO 2: Encontrar o que esta ocupando espaco
du -sh /* 2>/dev/null | sort -rh | head -10
du -sh /var/lib/docker/* 2>/dev/null | sort -rh | head -5
du -sh /opt/irb-whatsapp-ai/ 2>/dev/null

# PASSO 3: Limpeza emergencial do Docker
docker system prune -a -f --volumes
# CUIDADO: --volumes apaga volumes orfaos (nao os que estao em uso)

# PASSO 4: Limpar logs do Docker (podem ocupar GB!)
find /var/lib/docker/containers/ -name "*.log" -exec truncate -s 0 {} \;

# PASSO 5: Limpar logs do sistema
journalctl --vacuum-size=100M

# PASSO 6: Limpar backups antigos
find /opt/backups -type f -mtime +7 -delete

# PASSO 7: Limpar /tmp
rm -rf /tmp/*

# PASSO 8: Verificar novamente
df -h /
```

### 12.4 Suspeita de Ataque ou Vazamento

```bash
# PASSO 1: NAO desligar o servidor (manter evidencias)

# PASSO 2: Verificar acessos SSH recentes
last -20
grep "Accepted" /var/log/auth.log | tail -20

# PASSO 3: Verificar processos suspeitos
ps aux | head -20
top -b -n 1 | head -20

# PASSO 4: Verificar conexoes de rede abertas
ss -tunapl | head -30

# PASSO 5: Se confirmado ataque, isolar:
# - Trocar senha SSH: passwd root
# - Rotacionar TODAS as API keys (.env)
# - Verificar se houve acesso ao banco de dados

# PASSO 6: Se houve vazamento de dados de pacientes (LGPD):
# - Notificar a ANPD (Autoridade Nacional de Protecao de Dados)
# - Notificar os titulares dos dados afetados
# - Documentar o incidente

# PASSO 7: Hardening pos-incidente
ufw enable
ufw default deny incoming
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3080/tcp
# Trocar porta SSH: editar /etc/ssh/sshd_config -> Port 2222
# Desabilitar login por senha: PasswordAuthentication no (usar chave SSH)
```

---

## Apendice: Rotas da API

### Rotas Publicas (sem autenticacao)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | /api/health | Health check |
| POST | /api/auth/* | Login e autenticacao |
| POST | /api/webhooks/uazapi | Webhook UAZAPI (WhatsApp) |
| POST | /api/webhooks/klingo | Webhook Klingo |
| POST | /api/webhooks/asaas | Webhook Asaas |
| * | /api/booking/* | App de agendamento (rate limit: 30/min) |
| * | /api/teleconsultation/* | Teleconsulta |

### Rotas Protegidas (requer JWT)

| Prefixo | Descricao |
|---------|-----------|
| /api/conversations | Conversas do WhatsApp |
| /api/patients | Pacientes |
| /api/dashboard | Metricas do dashboard |
| /api/settings | Configuracoes |
| /api/igs | Integracao IGS |
| /api/subscriptions | Assinaturas de planos |
| /api/finance | Financeiro geral |
| /api/schedules | Agendas dos medicos |
| /api/billing | Faturamento |
| /api/lab | Laboratorio |
| /api/opd | Atendimentos ambulatoriais |
| /api/pharmacy | Farmacia |
| /api/doctors | Medicos |
| /api/sync | Sincronizacao Klingo |
| /api/accounts-payable | Contas a pagar |
| /api/accounts-receivable | Contas a receber |
| /api/cash-flow | Fluxo de caixa |
| /api/finance-ops | Operacoes financeiras |
| /api/users | Usuarios do sistema |
| /api/pdv | Ponto de venda |
| /api/crm | CRM e leads |
| /ws | WebSocket (dashboard real-time) |

### Rate Limits

| Escopo | Limite |
|--------|--------|
| Geral (rotas protegidas) | 100 req/min |
| Webhooks | 300 req/min |
| Booking (agendamento) | 30 req/min |
| Localhost (127.0.0.1) | Sem limite |

---

**Fim do Manual Tecnico de Manutencao**
**Ultima atualizacao:** 19/03/2026
