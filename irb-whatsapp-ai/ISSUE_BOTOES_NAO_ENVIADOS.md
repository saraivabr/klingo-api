# Issue: Botões Interativos Não Enviados

## Problema Identificado

A AI está **anunciando** que vai enviar botões ("Vou deixar algumas opções aqui pra facilitar:") mas **não está executando** a tool `send_interactive_message`.

### Exemplo do Erro

```
[AI Response]
"Oii! Sou a Julia, da IRB Prime Care 😊 Que bom que você veio falar com a gente! Me conta, o que te trouxe até nós?"

"Vou deixar algumas opções aqui pra facilitar:"
```

**Esperado**: Botões interativos aparecem  
**Real**: Apenas texto, sem botões

---

## Causa Raiz

A AI (GPT-4o) está respondendo com **texto conversacional** sobre os botões em vez de **executar a tool** `send_interactive_message`.

Possíveis causas:
1. **Prompt muito longo** → AI esquece instruções no meio
2. **Instrução não clara o suficiente** → AI acha que anunciar botões é suficiente
3. **Falta de exemplo concreto** → AI não entende o flow correto
4. **Competing instructions** → Regra de "não repetir conteúdo" conflita com envio de botões

---

## Análise do Código

### ✅ Tool Definition (Correto)
```typescript
// apps/ai/src/claude/tools.ts
{
  type: 'function',
  function: {
    name: 'send_interactive_message',
    description: 'Envia mensagem interativa com botões ou lista. USE FREQUENTEMENTE! Sempre que tiver 2-3 opções para o paciente (período, confirmação, especialidade), USE ESTA TOOL em vez de perguntar por texto.',
    // ... parameters
  }
}
```

### ✅ Tool Handler (Correto)
```typescript
// apps/worker/src/processors/ai-pipeline.ts
case 'send_interactive_message': {
  console.log('[TOOL] send_interactive_message called with:', toolInput);
  
  // Validates buttons/list
  // Stores in interactiveHolder.message
  
  return JSON.stringify({
    success: true,
    message: 'Mensagem interativa configurada com sucesso.',
    instructions: 'O texto que você definiu no campo "text" da mensagem interativa SERÁ exibido ao paciente junto com os botões/lista...'
  });
}
```

### ✅ Message Send (Correto)
```typescript
// apps/worker/src/processors/ai-pipeline.ts (lines 1103-1108)
if (interactiveHolder.message) {
  console.log('[AI-PIPELINE] Adding interactive message to send job:', interactiveHolder.message);
  sendJobData.interactive = interactiveHolder.message;
} else {
  console.log('[AI-PIPELINE] No interactive message pending');
}
```

**Conclusão**: O código está correto. O problema é a **AI não chamar a tool**.

---

## Soluções

### Solução 1: Melhorar Instrução no System Prompt ✅ IMPLEMENTAR

**Problema**: Instrução atual está **dispersa** e **não explícita o suficiente**.

**Fix**: Adicionar exemplo MUITO CLARO no topo do prompt:

```typescript
// apps/ai/src/prompts/system.ts (linha 13, ANTES de tudo)

⚠️ REGRA CRÍTICA - LEIA ISTO PRIMEIRO:

QUANDO você quer que botões apareçam para o paciente, você PRECISA:
1. CHAMAR a tool send_interactive_message (OBRIGATÓRIO)
2. Opcionalmente, escrever texto conversacional ANTES

EXEMPLO CORRETO:
[Texto da sua resposta]: "Oii! Sou a Julia 😊"
[DEPOIS, VOCÊ CHAMA]: send_interactive_message({ message_type: "buttons", text: "Como posso te ajudar?", buttons: [...] })

EXEMPLO ERRADO (❌ NUNCA FAÇA):
[Texto]: "Vou deixar algumas opções aqui pra facilitar:"
[SEM CHAMAR A TOOL] ← ERRADO! Paciente NÃO verá botões!

SE você escrever "vou deixar opções" ou "vou mandar botões" mas NÃO chamar send_interactive_message, os botões NÃO aparecerão.

A ÚNICA forma de enviar botões é CHAMANDO a tool send_interactive_message.
```

### Solução 2: Adicionar Few-Shot Examples

```typescript
// Adicionar ao final do system prompt

=== EXEMPLOS CONCRETOS DE TOOL USAGE ===

EXEMPLO 1 - Primeira Mensagem (COM BOTÕES):
User: "oi"
Assistant Text: "Oii! Sou a Julia, da IRB Prime Care 😊 Que bom que você veio falar com a gente!"
Assistant Tool Call: send_interactive_message({
  message_type: "buttons",
  text: "Como posso te ajudar?",
  buttons: [
    { id: "agendar", text: "Quero agendar" },
    { id: "conhecer", text: "Quero conhecer" },
    { id: "falar", text: "Falar com alguém" }
  ]
})

EXEMPLO 2 - Escolher Período:
User: "quero agendar cardiologia"
Assistant Text: "Que bom! A Dra. Fernanda é excelente em cardiologia 😊"
Assistant Tool Call: send_interactive_message({
  message_type: "buttons",
  text: "Qual período fica melhor pra você?",
  buttons: [
    { id: "manha", text: "Manhã (7h-12h)" },
    { id: "tarde", text: "Tarde (13h-18h)" },
    { id: "qualquer", text: "Qualquer horário" }
  ]
})

EXEMPLO 3 - Confirmar Horário:
User: "quinta às 14h"
Assistant Tool Call: send_interactive_message({
  message_type: "buttons",
  text: "Quinta às 14h com Dra. Fernanda, certo?",
  buttons: [
    { id: "confirmar", text: "Confirmar ✓" },
    { id: "outro", text: "Outro horário" }
  ]
})
```

### Solução 3: Adicionar Validação Post-Response

```typescript
// apps/worker/src/processors/ai-pipeline.ts
// Após receber resposta da AI, verificar se ela "prometeu" botões

const aiText = completion.choices[0].message.content || '';
const hasInteractiveTool = toolsUsed.includes('send_interactive_message');

// Detectar se AI disse que vai enviar botões mas não chamou a tool
const promisedButtons = /vou (deixar|mandar|enviar).*(opç[õo]|bot[õa]|menu|lista)/i.test(aiText);

if (promisedButtons && !hasInteractiveTool) {
  console.warn('[AI-PIPELINE] AI promised interactive message but did not call tool!');
  console.warn('[AI-PIPELINE] Response:', aiText);
  
  // Log para monitoring/alerting
  // Opcionalmente: adicionar botões genéricos de fallback
}
```

### Solução 4: Simplificar Prompt (Reduzir Conflitos)

**Problema**: Linha 479 do handler retorna instrução confusa:

```typescript
instructions: 'O texto que você definiu no campo "text" da mensagem interativa SERÁ exibido ao paciente junto com os botões/lista. Se quiser adicionar uma mensagem conversacional ANTES dos botões (ex: saudação, contexto emocional), escreva na sua resposta de texto normal. NÃO repita o conteúdo que já está no campo "text" da mensagem interativa.'
```

Isso pode estar causando confusão na AI.

**Fix**: Simplificar para:

```typescript
instructions: 'Botões configurados! Eles serão enviados automaticamente após sua resposta de texto.'
```

---

## Plano de Implementação

### Fase 1: Quick Fix (5 minutos)

1. ✅ Adicionar warning crítico no TOPO do system prompt
2. ✅ Adicionar 3 exemplos concretos de tool usage
3. ✅ Simplificar `instructions` no tool handler

### Fase 2: Validação (10 minutos)

4. ⏳ Adicionar detecção de "promised buttons" sem tool call
5. ⏳ Logar warning quando detectar
6. ⏳ Adicionar fallback genérico de botões

### Fase 3: Monitoring (Ongoing)

7. ⏳ Monitorar logs para casos de promise sem tool
8. ⏳ Ajustar prompt baseado em padrões de erro
9. ⏳ Considerar switch para modelo mais instruction-following

---

## Testing Checklist

Após implementar fixes:

```bash
# Test 1: Primeira mensagem
Enviar: "oi"
Esperar: Texto + Botões [Quero agendar / Quero conhecer / Falar com alguém]

# Test 2: Agendamento com período
Enviar: "quero agendar"
Esperar: Texto + Botões [Manhã / Tarde / Qualquer horário]

# Test 3: Confirmação
Enviar: "quinta às 14h"
Esperar: Botões [Confirmar / Outro horário]

# Test 4: Especialidades múltiplas
Enviar: "que especialistas vocês têm?"
Esperar: Lista com especialidades

# Test 5: Pós-booking
Enviar: [simular confirmação]
Esperar: Texto + Botões [Adicionar à agenda / Tenho dúvidas / Valeu Julia!]
```

---

## Métricas de Sucesso

Antes do fix:
- Taxa de envio de botões: ~30-40% (estimado)
- Taxa de "promise sem delivery": ~60-70%

Depois do fix (meta):
- Taxa de envio de botões: >90%
- Taxa de "promise sem delivery": <5%

Monitorar via:
```sql
-- MongoDB analytics
db.conversations.aggregate([
  {
    $unwind: "$messages"
  },
  {
    $match: {
      "messages.sender": "ai",
      "messages.hasInteractive": { $exists: true }
    }
  },
  {
    $group: {
      _id: null,
      totalAiMessages: { $sum: 1 },
      messagesWithButtons: {
        $sum: { $cond: ["$messages.hasInteractive", 1, 0] }
      }
    }
  }
])
```

---

## Notas Adicionais

- GPT-4o é muito bom em seguir instruções **quando são claras e diretas**
- Prompts muito longos (>400 linhas) causam "instruction drift"
- Exemplos concretos (few-shot) funcionam melhor que regras abstratas
- Validação pós-response é safety net necessário

**Status**: Aguardando implementação  
**Priority**: HIGH (afeta UX diretamente)  
**Estimativa**: 15 minutos total
