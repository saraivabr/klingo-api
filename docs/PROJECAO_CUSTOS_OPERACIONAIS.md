# Projeção de Custos Operacionais - IRB Prime Care

**Referência contratual**: Cláusula 1.2 - Fase 1 - "Levantamento e projeção de custos operacionais (licenças, tokens, infraestrutura) para ambiente de produção."

**Data**: 19 de março de 2026
**Elaborado por**: Equipe técnica CONTRATADA
**Período de referência dos dados**: 01/03/2026 a 19/03/2026

---

## 1. Resumo Executivo

Este documento apresenta o levantamento detalhado dos custos operacionais recorrentes do sistema de atendimento via WhatsApp com IA da IRB Prime Care. Os valores são baseados em dados reais de uso coletados em produção durante março de 2026.

**Custo mensal estimado total: R$ 327,00 a R$ 577,00**

---

## 2. Infraestrutura de Servidor

### 2.1 VPS Hostinger (Servidor Principal)

| Item | Detalhe |
|------|---------|
| IP | 187.77.62.141 |
| Processador | AMD EPYC 9355P (2 vCPUs) |
| Memória RAM | 8 GB (2,1 GB em uso / 5,7 GB disponível) |
| Disco | 100 GB SSD (46 GB em uso / 50 GB livre) |
| Sistema | Linux (Docker containers) |
| Containers ativos | 6 (api, worker, postgres, mongo, redis, bullboard) |

**Custo estimado**: R$ 80,00 a R$ 120,00/mês (VPS KVM 8GB Hostinger)

Observação: O uso atual de recursos está confortável. A RAM tem 72% livre e o disco 52% livre. Não há necessidade imediata de upgrade.

### 2.2 Domínio e SSL

| Item | Custo estimado |
|------|---------------|
| Domínio irb.saraiva.ai (subdomínio) | R$ 0,00 (subdomínio do domínio já existente) |
| Certificado SSL (Let's Encrypt) | R$ 0,00 (gratuito, renovação automática) |

**Subtotal Infraestrutura: R$ 80,00 a R$ 120,00/mês**

---

## 3. Custos de IA / LLM

### 3.1 Dados de Uso Real (Março/2026)

| Métrica | Valor |
|---------|-------|
| Conversas totais (desde 01/03) | 167 |
| Dias de operação (01-19/03) | 18 dias |
| Média de conversas/dia | 9,3 |
| Pico de conversas/dia | 31 (09/03) |
| Projeção mensal (30 dias) | ~280 conversas |

Distribuição diária observada:

| Data | Conversas | | Data | Conversas |
|------|----------|-|------|-----------|
| 04/03 | 1 | | 12/03 | 20 |
| 05/03 | 2 | | 13/03 | 8 |
| 06/03 | 3 | | 14/03 | 2 |
| 09/03 | 31 | | 16/03 | 16 |
| 10/03 | 27 | | 17/03 | 16 |
| 11/03 | 26 | | 18/03 | 10 |

### 3.2 OpenAI - GPT-4o-mini (Modelo Principal)

**Modelo**: `gpt-4o-mini`
**Preços OpenAI (março/2026)**:
- Input: US$ 0,15 / 1M tokens
- Output: US$ 0,60 / 1M tokens

**Estimativa de tokens por conversa**:

| Componente | Tokens estimados |
|------------|-----------------|
| System prompt (Julia) | ~4.000 tokens |
| Contexto RAG (knowledge base) | ~1.000 tokens |
| Histórico da conversa (até 20 msgs) | ~2.000 tokens |
| **Total input por chamada** | **~7.000 tokens** |
| Output por chamada (resposta + tools) | ~800 tokens |
| Chamadas de IA por conversa (média) | 4-6 chamadas |

**Custo por conversa**:
- Input: 7.000 tokens x 5 chamadas = 35.000 tokens/conversa = US$ 0,00525
- Output: 800 tokens x 5 chamadas = 4.000 tokens/conversa = US$ 0,0024
- **Total por conversa: ~US$ 0,008 (R$ 0,045)**

**Projeção mensal (280 conversas)**:
- Input: 9,8M tokens = US$ 1,47
- Output: 1,12M tokens = US$ 0,67
- **Total GPT-4o-mini: US$ 2,14/mês (~R$ 12,00/mês)**

### 3.3 OpenAI - Embeddings (RAG/Busca Semântica)

**Modelo**: `text-embedding-3-small`
**Preço**: US$ 0,02 / 1M tokens

Embeddings são gerados na busca de conhecimento (RAG) a cada chamada de IA. Volume estimado: ~1.400 chamadas/mês x 200 tokens = 280K tokens.

**Total Embeddings: US$ 0,006/mês (~R$ 0,03/mês)** — custo desprezível.

### 3.4 Transcrição de Áudio (Whisper)

**Configuração atual**: Groq (whisper-large-v3) como primário, OpenAI (whisper-1) como fallback.

- Groq Whisper: **gratuito** no tier free (até 28.800 segundos/dia)
- OpenAI Whisper (fallback): US$ 0,006/minuto

Estimativa: ~10% das conversas enviam áudio = ~28 áudios/mês x 30s médios = 14 minutos.

**Total Whisper: US$ 0,00 (Groq free tier) a US$ 0,084 (se usar OpenAI)**

### 3.5 Anthropic Claude (Fallback)

**Modelo**: `claude-sonnet-4-20250514`
**Ativação**: Apenas quando OpenAI retorna erro 429 (rate limit) ou 500+ (server error).

Em operação normal, o Claude **não é ativado**. Custos projetados apenas em cenário de indisponibilidade OpenAI:

- Claude Sonnet 4: US$ 3,00/1M input + US$ 15,00/1M output
- Custo por conversa (fallback): ~US$ 0,08
- Se 10% das conversas caírem no fallback: ~US$ 2,24/mês

**Total Anthropic: US$ 0,00/mês (operação normal) a US$ 2,24/mês (cenário degradado)**

### 3.6 Resumo Custos de IA

| Serviço | Custo mensal (USD) | Custo mensal (BRL) |
|---------|-------------------|--------------------|
| GPT-4o-mini | US$ 2,14 | R$ 12,00 |
| Embeddings | US$ 0,01 | R$ 0,05 |
| Whisper (Groq) | US$ 0,00 | R$ 0,00 |
| Claude (fallback) | US$ 0,00 a 2,24 | R$ 0,00 a 13,00 |
| **Subtotal IA** | **US$ 2,15 a 4,39** | **R$ 12,00 a 25,00** |

**Nota**: Esses valores são extremamente baixos graças ao uso do GPT-4o-mini, que é 30-60x mais barato que GPT-4o e adequado para a função de atendimento conversacional.

---

## 4. WhatsApp - UAZAPI

| Item | Detalhe |
|------|---------|
| Provedor | UAZAPI (saraiva.uazapi.com) |
| Protocolo | Baileys (conexão direta com WhatsApp Web) |
| Tipo de licença | SaaS mensal |

**Custo estimado**: R$ 79,90 a R$ 99,90/mês (plano UAZAPI single instance)

Observação: O UAZAPI cobra por instância conectada. Atualmente há 1 instância ativa (irbPRIME).

**Subtotal WhatsApp: R$ 79,90 a R$ 99,90/mês**

---

## 5. Gateway de Pagamentos - Asaas

| Item | Detalhe |
|------|---------|
| Provedor | Asaas |
| Modelo | Pay-per-use (taxa por transação) |
| Mensalidade | R$ 0,00 |

**Taxas por transação**:

| Meio de pagamento | Taxa Asaas |
|-------------------|-----------|
| PIX | R$ 1,99 por transação |
| Boleto | R$ 4,99 por transação |
| Cartão de crédito | 3,49% + R$ 0,49 por transação |

**Projeção mensal** (baseado em volume estimado de 50-100 transações/mês):

| Cenário | Estimativa |
|---------|-----------|
| 50 transações (maioria PIX) | ~R$ 120,00 |
| 100 transações (mix PIX/cartão) | ~R$ 280,00 |

**Subtotal Asaas: R$ 120,00 a R$ 280,00/mês** (variável conforme volume)

Observação: As taxas do Asaas são repassadas ao custo operacional da clínica, não à infraestrutura de TI. No entanto, são documentadas aqui para completude da projeção.

---

## 6. Outros Serviços

### 6.1 Klingo (Sistema de Gestão Clínica)

| Item | Detalhe |
|------|---------|
| Sistema | Klingo (gestão de agenda, pacientes, PEP) |
| API | api.klingo.app / api-externa.klingo.app |
| Custo | **Já pago pela CONTRATANTE (IRB)** |
| Integração | Via API AQL e API externa com X-APP-TOKEN |

**Custo para o projeto: R$ 0,00** (licença já existente da clínica)

### 6.2 Redis, PostgreSQL, MongoDB

Todos rodam como containers Docker no mesmo servidor VPS. Não há custo adicional além da infraestrutura do servidor.

### 6.3 BullBoard (Monitoramento de Filas)

Container Docker no mesmo servidor. Sem custo adicional.

---

## 7. Consolidação de Custos Mensais

### Cenário Conservador (volume atual ~280 conversas/mês)

| Categoria | Custo mensal (BRL) |
|-----------|-------------------|
| Servidor VPS (Hostinger) | R$ 100,00 |
| Domínio / SSL | R$ 0,00 |
| OpenAI (GPT-4o-mini + embeddings) | R$ 12,00 |
| Groq Whisper | R$ 0,00 |
| UAZAPI (WhatsApp) | R$ 89,90 |
| Asaas (gateway - custo operacional) | R$ 125,00 |
| Klingo | R$ 0,00 |
| **TOTAL** | **R$ 326,90** |

### Cenário de Crescimento (500 conversas/mês + mais transações)

| Categoria | Custo mensal (BRL) |
|-----------|-------------------|
| Servidor VPS (Hostinger) | R$ 100,00 |
| Domínio / SSL | R$ 0,00 |
| OpenAI (GPT-4o-mini + embeddings) | R$ 22,00 |
| Anthropic Claude (fallback ocasional) | R$ 13,00 |
| Groq Whisper | R$ 0,00 |
| UAZAPI (WhatsApp) | R$ 89,90 |
| Asaas (gateway - custo operacional) | R$ 280,00 |
| Klingo | R$ 0,00 |
| **TOTAL** | **R$ 504,90** |

### Cenário de Escala (1.000 conversas/mês)

| Categoria | Custo mensal (BRL) |
|-----------|-------------------|
| Servidor VPS (upgrade 16GB) | R$ 180,00 |
| Domínio / SSL | R$ 0,00 |
| OpenAI (GPT-4o-mini + embeddings) | R$ 42,00 |
| Anthropic Claude (fallback) | R$ 25,00 |
| Groq Whisper | R$ 0,00 |
| UAZAPI (WhatsApp) | R$ 89,90 |
| Asaas (gateway - custo operacional) | R$ 500,00 |
| Klingo | R$ 0,00 |
| **TOTAL** | **R$ 836,90** |

---

## 8. Recomendações para Otimização de Custos

### 8.1 Já implementadas

1. **GPT-4o-mini como modelo principal** — 30-60x mais barato que GPT-4o, com qualidade suficiente para atendimento conversacional.
2. **Groq Whisper gratuito** — Transcrição de áudio sem custo usando o tier free da Groq.
3. **Fallback inteligente para Claude** — Só ativa quando OpenAI falha, evitando custo desnecessário.
4. **RAG com pgvector** — Busca semântica local no PostgreSQL, sem custo de serviços externos de vector database.

### 8.2 Recomendações futuras

1. **Cache de respostas frequentes**: Implementar cache Redis para perguntas repetitivas (horário, endereço, preços), reduzindo chamadas à OpenAI em ~30%.

2. **Resumo de conversas longas**: Implementar sumarização de histórico quando conversas excedem 10 mensagens, reduzindo tokens de input em ~40%.

3. **Monitoramento de tokens**: Adicionar logging estruturado de `promptTokens` e `completionTokens` retornados pela API para acompanhamento preciso dos custos reais vs. projetados.

4. **Negociação de volume Asaas**: Com aumento de transações, negociar taxas reduzidas diretamente com o Asaas.

5. **Avaliação periódica de modelos**: A cada 3 meses, avaliar novos modelos (ex: futuras versões do GPT-4o-mini ou modelos open-source) que possam oferecer melhor custo-benefício.

---

## 9. Nota Contratual

Conforme cláusulas contratuais:

- **Durante o período do contrato**: Todos os custos operacionais listados acima (infraestrutura, licenças de IA, UAZAPI) são de responsabilidade da **CONTRATADA**.
- **Após o término do contrato**: Os custos operacionais recorrentes são transferidos para a **CONTRATANTE** (IRB Prime Care), que assumirá a manutenção do ambiente de produção.
- A CONTRATADA fornecerá documentação completa e treinamento para gestão independente dos serviços pela CONTRATANTE.

---

## 10. Premissas e Ressalvas

1. Valores em BRL calculados com câmbio de referência US$ 1,00 = R$ 5,70 (março/2026).
2. Projeções baseadas em dados reais de 18 dias de operação (01-19/03/2026).
3. O sistema ainda está em fase de ramp-up — o volume tende a crescer conforme mais pacientes interagirem com a IA.
4. Custos do Asaas são variáveis e dependem do volume de transações financeiras da clínica.
5. Preços de APIs (OpenAI, Groq, Anthropic) podem sofrer alterações pelos provedores.
6. O custo do Klingo não está incluído pois é licença preexistente da clínica.

---

*Documento gerado com base em dados reais de produção do servidor 187.77.62.141 em 19/03/2026.*
