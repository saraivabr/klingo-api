# IRB Prime Care - Fluxo Conversacional WhatsApp
## Relatório para Apresentação | Março 2026

---

## 1. Visão Geral

A **Clara** é a assistente virtual da IRB Prime Care no WhatsApp. Ela atende pacientes 24/7 com linguagem natural, acolhedora e humanizada — sem parecer robô.

**Tecnologia:**
- IA: OpenAI GPT-4o-mini (primário) + Anthropic Claude (fallback)
- Transcrição de áudio: Groq Whisper Large V3
- Integração: Klingo (agenda real) + UAZAPI (WhatsApp)
- Infraestrutura: Docker + PostgreSQL + MongoDB + Redis

**Números:**
- 190+ conversas processadas
- 134 médicos cadastrados na Klingo
- 13 especialidades ativas
- 13 procedimentos estéticos
- Tempo médio de resposta: < 5 segundos

---

## 2. Funil de Conversão (3 cliques)

O paciente chega ao link de agendamento em no máximo **3 cliques**:

```
Paciente manda "oi"
    |
    v
Clara se apresenta + Menu principal (6 opções)
    |
    v
Paciente escolhe categoria
    |
    v
Paciente escolhe subcategoria (quando aplicável)
    |
    v
Link de agendamento com horários REAIS da Klingo
```

---

## 3. Menu Principal (Nível 1)

Quando o paciente manda qualquer saudação, a Clara responde com calor humano e apresenta:

| Opção | O que faz | Cliques até link |
|-------|-----------|-----------------|
| Consulta | Abre tipos de consulta | 2-3 |
| Estética | Abre procedimentos | 2 |
| Medicina do Trabalho | Link direto | 1 |
| Exames | Abre tipos de exame | 2 |
| Associado IRB Prime | Informações do plano | - |
| Falar com Atendimento | Conecta com humano | 1 |

---

## 4. Fluxo Detalhado por Categoria

### 4.1 CONSULTA

```
Consulta
  ├── Médica ──────────── Lista de 10 especialidades ──── Link
  │   ├── Clínica Geral/Check-up (Avaliação completa)
  │   ├── Cardiologia (Coração, pressão, dor no peito)
  │   ├── Neurologia (Dor de cabeça, tontura)
  │   ├── Reumatologia (Dores nas juntas e costas)
  │   ├── Urologia (Problemas urinários)
  │   ├── Cirurgia Vascular (Varizes, circulação)
  │   ├── Ortopedia (Ossos, músculos, coluna)
  │   ├── Ginecologia (Saúde da mulher)
  │   ├── Psiquiatria (Ansiedade, insônia, bem-estar)
  │   └── Outra especialidade (atendimento livre)
  │
  ├── Odontológica ────── Link direto
  ├── Nutrição ─────────── Link direto
  ├── Fonoaudiologia ──── Link direto
  └── Psicologia/Terapia ─ Link direto
```

**Diferencial:** Cada especialidade tem descrição em linguagem do paciente (ex: "Reumatologia" → "Dores nas juntas e costas"), eliminando a barreira do jargão médico.

### 4.2 ESTÉTICA

```
Estética
  ├── Botox (Toxina botulínica)
  ├── Preenchimento Facial (Lábios, olheiras, mandíbula)
  ├── Harmonização Full Face (Transformação completa)
  ├── Firmeza/Rejuvenescimento (Bioestimulador, Ultraformer)
  ├── Rinomodelação (Nariz sem cirurgia)
  ├── Lipo de Papada
  └── Outro procedimento
```

**13 procedimentos reais** da clínica organizados em categorias orientadas ao desejo do paciente, não ao nome técnico.

### 4.3 MEDICINA DO TRABALHO

Link de agendamento **direto** — sem sub-menus. O paciente que precisa de medicina do trabalho já sabe o que quer.

### 4.4 EXAMES

```
Exames
  ├── Exame de Imagem ──── Link direto (ultrassom, raio-x, eco)
  ├── Exame Laboratorial ── Link direto (sangue, urina)
  └── Tenho um pedido ──── Clara pergunta qual exame
```

### 4.5 ASSOCIADO IRB PRIME

Clara explica os benefícios do plano e oferece:
- Quero me associar → Conecta com equipe
- Já sou associado → Clara ajuda
- Saber mais → Informações detalhadas

### 4.6 FALAR COM ATENDIMENTO

Escalação **imediata** para atendente humano com auto-recovery: se ninguém responder em 10 minutos, a Clara volta a atender automaticamente.

---

## 5. Inteligência do Sistema

### 5.1 Atalhos Inteligentes

O paciente NÃO precisa navegar menus. Se digitar diretamente:

| Mensagem do paciente | O que acontece |
|---------------------|----------------|
| "quero agendar cardiologia" | Vai direto pro link de cardiologia |
| "Dra. Natalia" | Reconhece o nome e gera link |
| "quanto custa consulta?" | Responde o preço + oferece agendamento |
| "onde fica a clínica?" | Envia localização no mapa |
| "quero cancelar" | Cancela via Klingo automaticamente |

### 5.2 Transcrição de Áudio

Pacientes que mandam **áudio** são atendidos normalmente — o sistema transcreve via Groq Whisper Large V3 (mais rápido que OpenAI) e processa como texto.

Se a transcrição falha, o bot responde: "Não consegui ouvir bem, pode mandar por texto?"

### 5.3 Classificação de Intenção por Prioridade

O sistema detecta a intenção do paciente com regex por prioridade:

| Prioridade | Intenção | Exemplo |
|-----------|----------|---------|
| 10 | Emergência médica | "passando mal", "sangramento" |
| 9 | Pedido de humano | "quero falar com atendente" |
| 9 | Reclamação | "péssimo atendimento" |
| 7 | Agendamento | "quero marcar consulta" |
| 6 | Preço | "quanto custa?" |
| 6 | Localização | "onde fica?" |
| 1 | Saudação | "oi", "bom dia" |

### 5.4 Debounce Inteligente

Quando o paciente manda várias mensagens rápidas (comum no WhatsApp), o sistema agrupa tudo em uma janela de 4 segundos antes de processar — evitando respostas fragmentadas.

---

## 6. Proteções e Segurança

| Proteção | Descrição |
|----------|-----------|
| **Filtro de Staff** | Números internos (médicos, recepção) não recebem resposta da IA |
| **Rate Limit** | Máximo 5 mensagens da IA por conversa a cada 10 minutos |
| **Anti-duplicata** | Não envia a mesma mensagem 2x em 5 minutos |
| **Quiet Hours** | Follow-ups não são enviados entre 21h e 8h |
| **Auto-recovery** | Se humano não responde em 10min, IA volta a atender |
| **Escalação controlada** | Só escala por pedido explícito ou emergência real (não escala por "ai_uncertainty") |

---

## 7. Sistema de Follow-up

Se o paciente para de responder no meio do fluxo:

| Tempo | Mensagem | Estratégia |
|-------|----------|------------|
| 30 min | "Clara aqui! Quer continuar?" + botões | Curiosidade |
| 24h | "Sem pressão! Quando quiser, é só chamar" | Respeito |
| +24h | Auto-fecha a conversa | Limpeza |

**Contexto adaptativo:** Se o paciente estava vendo horários, o follow-up menciona isso. Se estava perguntando preço, menciona o valor.

---

## 8. Integração Klingo (Agenda Real)

O sistema está **totalmente integrado** com a Klingo:

### Validação realizada em 24/03/2026:

| Especialidade | Slots disponíveis | Datas | Fonte |
|--------------|-------------------|-------|-------|
| Cardiologia | 9 horários | 31/mar | Klingo (real) |
| Odontologia | 12 horários | 25/mar | Klingo (real) |
| Estética | 9 horários | 25-27/mar | Klingo (real) |
| Clínica Médica | 12 horários | 26, 30/mar | Klingo (real) |
| Ultrassom | 9 horários | 25-27/mar | Klingo (real) |

**Todos os horários mostrados ao paciente são reais** — vêm diretamente da agenda da Klingo, não são fabricados.

### Funcionalidades Klingo integradas:
- Busca de slots livres por especialidade/médico
- Confirmação de consulta via botão
- Cancelamento de consulta via chat
- Check-in pelo WhatsApp
- NPS pós-consulta
- Identificação automática de paciente por telefone

---

## 9. Procedimentos Estéticos Cadastrados

Baseado na lista oficial da clínica:

**Preenchimentos Faciais:**
- Olheiras, Malar, Mandíbula, Mento, Têmpora, Bigode Chinês, Labial

**Toxina e Harmonização:**
- Botox, Harmonização Full Face

**Outros Procedimentos:**
- Rinomodelação, Bioestimulador de Colágeno, Lipo de Papada, Ultraformer

Todos cadastrados no sistema com agendamento integrado à Klingo.

---

## 10. Elementos de Conversão

| Elemento | Implementação |
|----------|---------------|
| **Social Proof** | "Nossos pacientes adoram", "Quem vem uma vez sempre volta" |
| **Urgência** | "Tem horários disponíveis essa semana!", "A agenda costuma preencher rápido" |
| **Tom adaptativo** | Clara espelha o tom do paciente (formal ↔ descontraído) |
| **Preço acessível** | R$ 149,90 com retorno grátis em 30 dias |
| **Sem fricção** | Link de agendamento com botão CTA direto no WhatsApp |
| **Acolhimento** | Persona Clara — calorosa, empática, como amiga da recepção |

---

## 11. Arquitetura Técnica

```
[WhatsApp] ←→ [UAZAPI] ←→ [Webhook API]
                               |
                    ┌──────────┼──────────┐
                    v          v          v
              [Intake]   [AI Pipeline]  [Send]
                    |          |          |
              [MongoDB]  [OpenAI/Claude] [UAZAPI]
              [Postgres] [Groq Whisper]
              [Redis]    [Klingo API]
```

**Stack:**
- API: Node.js + Fastify
- Workers: BullMQ (16 workers paralelos)
- Banco: PostgreSQL (pacientes, agendamentos) + MongoDB (conversas) + Redis (cache, filas)
- Frontend: React + Vite (booking app, dashboard)
- Deploy: Docker Compose em servidor dedicado

---

## 12. Dashboard de Monitoramento

Acessível em **https://irb.saraiva.ai/painel/**

- Visualização de todas as conversas em tempo real
- Métricas de atendimento (tempo de resposta, taxa de conversão)
- Pipeline CRM com leads
- Intervenção manual quando necessário

---

## 13. Resultados da Validação Completa

**7 fluxos testados e validados** em produção:

| # | Fluxo | Resultado |
|---|-------|-----------|
| 1 | Welcome → Lista 6 opções | PASS |
| 2 | Consulta → Médica → Cardiologia → Link | PASS |
| 3 | Consulta → Odonto → Link direto | PASS |
| 4 | Estética → Botox → Link | PASS |
| 5 | Medicina do Trabalho → Link direto | PASS |
| 6 | Exames → Imagem → Link | PASS |
| 7 | Falar com Atendimento → Escalação | PASS |

**5 integrações Klingo validadas** com slots reais.

**0 erros** em produção no período de teste.

---

## 14. Próximos Passos

1. Implementar tentativas intermediárias de follow-up (4h com recompensa)
2. Mostrar horários disponíveis dentro do WhatsApp (antes do link externo)
3. Adicionar prova social com dados reais (número de pacientes, notas)
4. Countdown de expiração no link de booking
5. Segmentação de follow-up por valor do lead (estética vs consulta)

---

*Relatório gerado em 24/03/2026 | IRB Prime Care | Sistema Clara v2.0*
