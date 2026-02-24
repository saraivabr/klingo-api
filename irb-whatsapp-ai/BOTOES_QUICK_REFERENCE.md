# 🎯 Quick Reference: Botões Interativos - Para Próximos Workers

## A Situação em Uma Sentença

**send_interactive_message está 100% implementada tecnicamente, mas o system prompt é tão vago que a IA raramente a chama.**

---

## O Que Precisa Ser Feito (em ordem de prioridade)

### 1️⃣ PRIORITY 1: Reescrever System Prompt (2-3 horas)

**Arquivo:** `apps/ai/src/prompts/system.ts` (linhas 262-295)

**Problema Atual:**
```
MENSAGENS INTERATIVAS (BOTOES E LISTAS):
Use send_interactive_message ESTRATEGICAMENTE em momentos-chave...
```
❌ Muito vago. A IA não sabe quando exatamente disparar um botão.

**O Que Fazer:**
Reescrever seção de botões com imperativos claros (SEMPRE, NUNCA, etc):

```
QUANDO USAR BOTÕES (IMPERATIVO - use quase sempre nestes casos):

1. ESCOLHER PERÍODO:
   Assim que paciente quer agendar, SEMPRE ofereça botões de período
   "Qual fica melhor?" + botões: "Manhã (7h-12h)" / "Tarde (13h-18h)" / "Sem preferência"

2. CONFIRMAR AGENDAMENTO:
   Quando tiver hora confirmada, SEMPRE confirme com botão
   "Sexta às 10h com Dr. Marcos?" + botões: "Confirmar ✓" / "Outro horário"

3. ESCOLHER ESPECIALIDADE (USE LIST):
   Se paciente não sabe qual, SEMPRE ofereça lista com dropdown
   Botão: "Ver especialidades" → abre list

4. RESPOSTA SIM/NÃO:
   "Você já foi atendido conosco?" + botões: "Sim" / "Não" / "Não lembro"

5. PRÓXIMO PASSO:
   Após agendamento confirmado: "O que você precisa?" + botões: "Ver comprovante" / "Suporte"

QUANDO NÃO USAR:
- Acolhimento inicial (primeira mensagem)
- Perguntas exploratórias abertas
- Se já mandou link de agendamento
```

**Adicionar Exemplos:**
Incluir conversa real mostrando quando dispara:
```
Paciente: "quero agendar dermatólogo"
Julia: "Que bom! Qual período fica melhor?" 
[DISPARA BUTTON com "Manhã" / "Tarde"]

Paciente: [clica "Tarde"]
Julia: "Perfeito!" [manda generate_booking_link]

Paciente: "quinta às 14h"
Julia: "Quinta às 14h com Dr. Marcos?"
[DISPARA BUTTON com "Confirmar ✓" / "Outro horário"]
```

---

### 2️⃣ PRIORITY 2: Adicionar Hints Contextuais (1-2 horas)

**Arquivo:** `apps/ai/src/context/builder.ts` (adicionar em `buildContext()`)

**O Que Fazer:**
Quando estado = SCHEDULING ou CONFIRMATION, injetar no system prompt:

```typescript
if (conversation.state === 'scheduling') {
  systemPrompt += `\n\n🎯 DICA CONTEXTUAL: O paciente quer agendar. 
  Use send_interactive_message para oferecer período (manhã/tarde). 
  Isso torna a conversa mais rápida e clara.`;
}

if (conversation.state === 'confirmation') {
  systemPrompt += `\n\n🎯 DICA CONTEXTUAL: Confirme o agendamento com um botão 
  "Confirmar ✓" / "Outro horário". Deixa tudo explícito.`;
}
```

---

### 3️⃣ PRIORITY 3: Implementar Métrica (30 min)

**Arquivo:** `apps/worker/src/processors/ai-pipeline.ts` (linha ~525)

**O Que Fazer:**
Adicionar contador de botões em `aiMetadata`:

```typescript
aiMetadata: {
  ...
  toolsUsed,
  interactiveMessagesCount: toolsUsed.filter(t => t === 'send_interactive_message').length, // ← NOVO
  ...
}
```

Isso permite dashboard mostrar "% de conversas com botões interativos"

---

### 4️⃣ PRIORITY 4: Testes (1-2 horas)

**Cenários de Teste:**

| Cenário | Input | Esperado | Verify |
|---------|-------|----------|--------|
| Primeira msg | "Oi, quero agendar" | Acolhimento SEM botão | pendingInteractiveMessage === null |
| Escolher período | "Quando?" | "Manhã/Tarde/Sem preferência" com BUTTONS | pendingInteractiveMessage.type === 'buttons' |
| Confirmar horário | "Tá bom sexta às 10h?" | "Confirmar/Outro horário" com BUTTONS | Segundo botão disparado |
| Escolher especialidade | "Não sei qual" | Dropdown LIST de especialidades | listSections.length > 0 |
| Pós-agendamento | "Agendado!" | Texto SEM botão obrigatório | Apenas aiText |

---

## Arquitetura Mínima para Entender

```
Paciente: "Quero agendar"
    ↓
AI-Pipeline chama Claude com aiTools (inclui send_interactive_message)
    ↓
Claude: "Que período?" + CALL send_interactive_message
    ↓
executeTool() valida e armazena em pendingInteractiveMessage
    ↓
Resposta é enfileirada no MESSAGE_SEND com interactive data
    ↓
UAZAPI envia texto + botões ao WhatsApp
    ↓
Paciente vê mensagem com botões interativos ✓
```

---

## Checklist Técnico Atual

```
✅ Tool send_interactive_message definida (tools.ts)
✅ Tool passada para Claude (ai-pipeline.ts linha 414)
✅ Handler implementado (ai-pipeline.ts linha 239-298)
✅ Validações de tamanho funcionando
✅ Integração com fila MESSAGE_SEND OK
❌ System prompt fraco (PROBLEMA CRÍTICO)
❌ Exemplos faltam no prompt
❌ Hints contextuais não injetados
❌ Métrica de botões não existe
```

---

## Arquivos Críticos (LEIA ANTES DE EDITAR)

| Arquivo | Linhas | O Que Verificar |
|---------|--------|-----------------|
| tools.ts | 102-165 | Define send_interactive_message (SEM MUDAR) |
| ai-pipeline.ts | 239-298 | Handler (SEM MUDAR, está perfeito) |
| ai-pipeline.ts | 414, 456 | Passa tools para Claude (SEM MUDAR) |
| system.ts | 262-295 | **MUDAR AQUI** - Seção de botões |
| builder.ts | buildContext() | **MUDAR AQUI** - Adicionar hints |
| ai-pipeline.ts | ~525 | **MUDAR AQUI** - Adicionar métrica |

---

## Exemplo de Mudança (system.ts)

**ANTES:**
```
MENSAGENS INTERATIVAS (BOTOES E LISTAS):
Use send_interactive_message ESTRATEGICAMENTE em momentos-chave...
```

**DEPOIS:**
```
=== MENSAGENS INTERATIVAS (BOTOES E LISTAS - IMPERATIVO) ===

QUANDO USAR BOTÕES (use quase SEMPRE nestes casos):

1. PERÍODO: Paciente quer agendar? Ofereça "Manhã" / "Tarde" / "Sem preferência"
   Isso MUDA a conversa de texto livre para decisão guiada.

2. CONFIRMAÇÃO: Horário marcado? Ofereça "Confirmar ✓" / "Outro horário"
   Deixa tudo explícito, reduz dúvidas.

3. ESPECIALIDADE (LIST): Paciente não sabe qual? Dropdown com opções
   Botão: "Ver especialidades"

4. SIM/NÃO ESTRATÉGICO: Sempre ofereça botões para decisões binárias
   "Você já foi atendido?" + botões

[... ADD CONCRETE EXAMPLES OF CONVERSATION ...]
```

---

## Fórmula de Sucesso

✅ Prompt claro + vários exemplos  
✅ Hints contextuais injetados  
✅ Métrica para medir  
✅ Testes manuais  

= **IA usa botões em 80%+ dos cenários apropriados**

---

## Contato para Dúvidas

Relatório completo: `ANALISE_BOTOES_FLUXO.md` (443 linhas)

Coordenador, quando estes 4 passos forem feitos, IA vai disparar botões automaticamente nos momentos corretos. ✨

---

**Documento criado por:** DarkHawk 🦅  
**Para:** Próximos Workers  
**Leia isto antes de começar.**
