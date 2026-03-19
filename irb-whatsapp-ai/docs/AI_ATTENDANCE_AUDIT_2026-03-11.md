# Auditoria do Atendimento da IA
**Projeto:** IRB WhatsApp AI  
**Data:** 2026-03-11  
**Escopo:** qualidade do atendimento, observabilidade, operação e pontos de melhoria

## Resumo Executivo

O atendimento da IA está funcional, mas ainda opera com baixa confiabilidade operacional e pouca visibilidade de resultado. O principal problema hoje não é só prompt ou tom de voz; é que o sistema ainda mistura mensagens realmente entregues com mensagens apenas geradas, e isso distorce métricas, bloqueia retries e dificulta entender a jornada real do paciente.

Nos últimos 7 dias em produção:

- 85 conversas com atividade
- 44 `active`
- 26 `escalated`
- 15 `closed`
- 39 com `isAiHandling=false`
- média de 12,06 mensagens por conversa
- média de 3,72 mensagens da IA por conversa
- média de 8,44 mensagens do paciente por conversa
- 378 mensagens da IA registradas como `pending`
- 0 mensagens da IA registradas como `sent`, `delivered` ou `read`
- 0 ms em `avgResponseTimeMs` em toda a base auditada

Leitura prática:

- a IA conversa, mas o produto ainda não mede entrega real;
- a taxa de escalada está alta para um bot que deveria absorver triagem inicial;
- há evidência de atendimento fora de escopo clínico;
- a auditoria operacional atual é fraca, então fica difícil separar falha de IA, falha de fila e falha do WhatsApp.

## Achados Principais

### 1. Entrega da mensagem está sem rastreabilidade confiável

Achado:

- todas as mensagens da IA aparecem como `pending` no Mongo na janela auditada;
- não há massa relevante marcada como `sent`, `delivered` ou `read`;
- isso invalida a leitura de sucesso do atendimento.

Evidência:

- modelo de conversa suporta `pending|sent|delivered|read|failed` em [`conversation.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/packages/database/src/mongo/models/conversation.ts)
- `ai-pipeline` grava a mensagem como `pending` antes do envio em [`ai-pipeline.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/worker/src/processors/ai-pipeline.ts)
- `message-send` só atualiza o último item da conversa quando consegue associar `lastMessageId`, mas o histórico atual mostra `pending` persistente em produção em [`message-send.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/worker/src/processors/message-send.ts)

Impacto:

- o time não sabe o que a IA falou de fato e o que só ficou registrado internamente;
- retries e antidupe ficam sujeitos a falso positivo;
- qualquer dashboard de performance fica enganoso.

### 2. Métricas de resposta estão quebradas

Achado:

- `avgResponseTimeMs` e `firstResponseTimeMs` estão zerados nas conversas auditadas;
- o dashboard expõe essas métricas, mas o pipeline não as calcula.

Evidência:

- campos existem no schema em [`conversation.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/packages/database/src/mongo/models/conversation.ts)
- dashboard usa essas métricas em [`dashboard.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/api/src/routes/dashboard.ts)
- `message-intake` incrementa `patientMessages`, mas não mede tempo em [`message-intake.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/worker/src/processors/message-intake.ts)
- `ai-pipeline` incrementa `aiMessages`, mas não calcula primeiro tempo nem média em [`ai-pipeline.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/worker/src/processors/ai-pipeline.ts)

Impacto:

- não existe KPI real de SLA da IA;
- não dá para saber se o paciente está sendo respondido rápido ou lento;
- decisões de melhoria ficam no escuro.

### 3. Taxa de escalada está alta e mistura operação com qualidade de IA

Achado:

- 26 de 85 conversas recentes estão `escalated`, cerca de 30,6%;
- 39 de 85 estão com `isAiHandling=false`, cerca de 45,9%;
- isso é alto para um canal que deveria absorver triagem, dúvidas básicas e encaminhamento inicial.

Leitura provável:

- parte das escaladas é legítima;
- parte parece ser operacional, por exemplo conversa assumida por humano e nunca devolvida;
- parte pode ser efeito de classificação superficial ou baixa confiança.

Evidência:

- regra de escalada é simples e agressiva em [`escalation.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/ai/src/classifiers/escalation.ts)
- rota de assign/release existe, mas depende de disciplina operacional em [`conversations.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/api/src/routes/conversations.ts)

Impacto:

- a IA perde cobertura;
- o time humano vira fallback padrão;
- o dashboard pode parecer “cheio” mesmo quando o problema é processo e não volume.

### 4. O classificador de intenção é raso para produção real

Achado:

- `unknown` é a intenção mais frequente: 57 ocorrências na janela auditada;
- o classificador atual é baseado em regex simples e não tem categoria explícita de `out_of_scope`, `support`, `commercial`, `spam`, `internal_staff` ou `technical_issue`.

Evidência:

- classificador em [`intent.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/ai/src/classifiers/intent.ts)

Exemplos práticos observados:

- a IA respondeu conversa técnica de autenticação como se fosse uma conversa válida do canal;
- a IA respondeu mensagens de perfis internos e operacionais;
- a IA ainda tenta manter tom assistencial mesmo quando a conversa claramente não é de paciente.

Impacto:

- aumenta ruído operacional;
- piora taxa de escalada;
- produz respostas simpáticas, mas erradas para o contexto.

### 5. Filtro de números internos ainda está incompleto

Achado:

- há conversas recentes com nomes como `Dr`, `Irb Prime - Financeiro` e contatos operacionais dentro do fluxo da IA;
- o código depende de `STAFF_PHONES` e uma pequena lista hardcoded, o que não escala.

Evidência:

- filtro em [`message-intake.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/worker/src/processors/message-intake.ts)

Impacto:

- ruído na base;
- métricas contaminadas;
- respostas indevidas para time interno.

### 6. Anti-duplicidade estava bloqueando replay legítimo

Achado:

- durante a análise de hoje, o sistema gravava a resposta da IA na conversa e em seguida bloqueava o reenvio por considerar duplicata recente;
- isso acontecia porque o throttle comparava texto sem considerar se a mensagem anterior tinha sido realmente enviada.

Status:

- corrigido hoje no worker de produção para ignorar mensagens `pending` e `failed` no antidupe.

Evidência:

- ajuste em [`message-send.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/worker/src/processors/message-send.ts)

Impacto:

- antes da correção, havia perda silenciosa de entrega;
- esse tipo de bug explica por que o usuário sente “sumiço” mesmo com a IA gerando resposta.

## Diagnóstico de Produto

### O que a IA já faz bem

- responde rapidamente no fluxo de triagem;
- usa botões e mensagens interativas;
- tem integração relevante com agenda e contexto clínico;
- consegue sustentar conversa básica de entrada.

### O que ainda atrapalha a experiência

- excesso de respostas genéricas de acolhimento;
- pouca distinção entre paciente real, equipe interna e conversa fora de escopo;
- escalada sem fechamento de ciclo;
- ausência de visão clara de “enviado”, “entregue”, “lido”, “resolvido”.

### O que eu melhoraria no atendimento em si

- menos texto institucional repetido;
- mais objetividade na primeira resposta;
- uma camada explícita de “isso é assunto da clínica ou assunto técnico/operacional?” antes de entrar em fluxo assistencial;
- mais uso de botões curtos logo na primeira troca;
- fallback de humano com SLA e contexto resumido, não só “escalar”.

## Melhorias Prioritárias

### Prioridade 1

- corrigir rastreamento de entrega no Mongo para que `pending` vire `sent/delivered/read` com base no retorno real da UAZAPI;
- recalcular `firstResponseTimeMs` e `avgResponseTimeMs` no pipeline;
- criar alerta de saúde do canal: volume de `pending` acima do normal, falhas no worker, falhas na OpenAI, falhas na UAZAPI;
- impedir que conversas internas entrem no funil da IA.

### Prioridade 2

- ampliar o classificador com intents de `out_of_scope`, `technical_support`, `internal_staff`, `spam`, `commercial_partner`;
- separar “escalado para humano” de “assumido manualmente”;
- exigir motivo de release/assign no dashboard para auditoria operacional;
- registrar motivo de não envio no documento da conversa, não só em log.

### Prioridade 3

- revisar copy das primeiras respostas;
- criar score de resolução por conversa;
- medir taxa de clique em botões;
- medir quantas conversas terminam com agendamento, encaminhamento humano ou abandono.

## Mudanças Recomendadas no Código

### Observabilidade

- adicionar `sentAt`, `deliveredAt`, `readAt`, `failedAt`, `failureReason` por mensagem;
- persistir `providerResponseId` e `providerStatus`;
- registrar no dashboard:
  - taxa de entrega
  - taxa de escalada
  - taxa de abandono
  - taxa de conversa fora de escopo

### Classificação

- estender [`intent.ts`](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/apps/ai/src/classifiers/intent.ts) com:
  - `out_of_scope`
  - `technical_support`
  - `internal_staff`
  - `spam`
- adicionar um gate antes do prompt principal:
  - se `internal_staff`, não responder ou responder com template operacional;
  - se `technical_support`, sair do roteiro assistencial;
  - se `out_of_scope`, encerrar curto e claro.

### Operação

- adicionar endpoint ou ação automática para “retornar para IA” após resolução humana;
- criar aging de escaladas pendentes;
- bloquear novas mensagens automáticas em conversas antigas assumidas manualmente sem dono.

## Plano de Ação Sugerido

### Semana 1

- corrigir delivery tracking
- corrigir response time metrics
- criar dashboard mínimo de saúde do canal

### Semana 2

- ampliar classificação de intenção
- tratar contatos internos
- revisar copy inicial e botões

### Semana 3

- medir funil real:
  - entrada
  - resposta
  - clique
  - agendamento
  - escalada
  - abandono

## Conclusão

O sistema já tem base boa para atendimento inicial, mas hoje a gestão do atendimento ainda está mais cega do que deveria. O principal ganho agora não vem de “deixar a IA mais inteligente” primeiro; vem de torná-la auditável, mensurável e operacionalmente previsível.

Se eu fosse priorizar em ordem estrita:

1. entrega real e status de mensagem  
2. métricas de resposta reais  
3. filtro de conversas internas e fora de escopo  
4. revisão de escalada  
5. refinamento do tom e do funil de atendimento
