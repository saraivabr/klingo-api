# Relatorio de Atendimentos da IA desde o Inicio

Data do relatorio: 11 de marco de 2026

Periodo analisado:
- Inicio real da operacao da IA: 4 de marco de 2026, 20:04:00 UTC
- Ultimo atendimento no recorte: 11 de marco de 2026, 21:51:17 UTC

Fontes:
- MongoDB de producao (`irb_whatsapp.conversations`)
- PostgreSQL de producao (`escalations`, `booking_links`, `appointments`)

## Resumo executivo

Desde o inicio da operacao, a IA participou de 80 de 89 conversas e respondeu 405 mensagens. O volume ja e suficiente para identificar padroes operacionais claros.

Os dois principais gargalos atuais sao:
1. rastreabilidade de entrega ainda ruim, com 378 de 405 mensagens da IA em `pending`;
2. compreensao conversacional ainda rasa, com `unknown` em 277 de 405 respostas da IA.

Tambem ha uma taxa alta de escalacao: 29 de 89 conversas estao hoje em estado `escalated`, e 26 escalacoes foram abertas no Postgres. A maior causa e `repeated_failure`.

## Numeros principais

### Conversas

- Conversas totais no periodo: 89
- Conversas com participacao da IA: 80
- Cobertura da IA nas conversas: 89,9%
- Conversas `active`: 45
- Conversas `escalated`: 29
- Conversas `closed`: 15
- Taxa de conversas escaladas: 32,6%
- Media de mensagens por conversa: 13,8

### Mensagens

- Mensagens de pacientes: 819
- Mensagens da IA: 405
- Mensagens humanas (`attendant`): 1
- Media de mensagens da IA por conversa atendida pela IA: 5,1
- Media de mensagens do paciente por conversa: 9,2

### Entrega

- Mensagens da IA com `pending`: 378
- Mensagens da IA com `sent`: 27
- Taxa de mensagens ainda em `pending`: 93,3%
- Mensagens da IA com `failed`: 0

Leitura operacional:
- a IA esta respondendo e produzindo texto, mas o tracking de entrega ainda nao representa o que realmente aconteceu no WhatsApp;
- isso distorce diagnostico de jornada, funil e SLA.

### Tempo de resposta

Observacao: os tempos de resposta so aparecem em 11 conversas, entao essa metrica ainda esta em fase inicial de confiabilidade.

- `firstResponseTimeMs` medio nas conversas com amostra: 9,5s
- `avgResponseTimeMs` medio nas conversas com amostra: 6,7s
- Conversas com amostra valida de `firstResponseTimeMs`: 11
- Conversas com amostra valida de `avgResponseTimeMs`: 11

## Estados da jornada

- `exploring`: 36
- `escalated`: 22
- `greeting`: 22
- `scheduling`: 7
- `price_discussion`: 1
- `active`: 1

Leitura operacional:
- a maior parte das conversas ainda fica em exploracao, sem avancar de forma consistente para agendamento;
- o volume alto em `greeting` e `exploring` sugere muita conversa curta, ambigua ou mal classificada;
- o bloco de `escalated` confirma que a IA ainda falha com frequencia relevante em fechamento de fluxo.

## Intencoes classificadas nas respostas da IA

- `unknown`: 277
- `greeting`: 67
- `appointment_booking`: 27
- `gratitude`: 16
- `human_request`: 5
- `price_inquiry`: 4
- `availability_inquiry`: 2
- `insurance_inquiry`: 2
- `cancellation`: 2
- `location_inquiry`: 1
- `payment_inquiry`: 1
- `medical_urgency`: 1

Leitura operacional:
- `unknown` representa 68,4% das mensagens da IA;
- isso e alto demais para uma operacao assistida por jornada;
- na pratica, a IA ainda esta respondendo muito sem compreender claramente a intencao do paciente.

## Uso de ferramentas pela IA

- `send_interactive_message`: 108
- `get_service_price`: 14
- `generate_booking_link`: 12
- `escalate_to_human`: 7
- `get_patient_appointments`: 6
- `check_availability`: 5
- `send_location`: 2
- `book_appointment`: 1
- `check_exam_results`: 1
- `get_knowledge`: 1
- `cancel_appointment`: 1

Leitura operacional:
- `send_interactive_message` apareceu em 26,7% das mensagens da IA;
- isso confirma que a jornada estava, de fato, com uso pesado de botoes;
- os ajustes mais recentes para reduzir poluicao visual devem baixar esse numero nas proximas amostras.

## Escalacoes

Escalacoes registradas desde o inicio:
- Total: 26
- Pendentes: 26

Motivos:
- `repeated_failure`: 19
- `patient_request`: 6
- `medical_urgency`: 1

Leitura operacional:
- o principal problema nao e risco clinico, e falha repetida de execucao/jornada;
- isso indica que o maior ganho no curto prazo vem de robustez conversacional e operacional, nao de expandir repertorio.

## Links de agendamento e consultas

### Booking links

- Links gerados: 12
- Links convertidos em agendamento (`booked`): 3
- Taxa de conversao de link para agendamento: 25,0%

Especialidades com links gerados:
- Cardiologia: 3
- Reumatologia: 3
- Clinica Medica: 2
- Clinica Geral: 1
- Clinico Geral: 1
- Dermatologia: 1
- Odontologia: 1

### Appointments

- Consultas criadas no periodo: 4
- Consultas criadas pela IA (`created_by = 'ai'`): 1
- Status das consultas:
- `pending_confirmation`: 2
- `scheduled`: 2

Leitura operacional:
- a IA esta conseguindo abrir caminho para agendamento;
- mas ainda ha perda relevante entre gerar link e concluir marcacao;
- tambem existe inconsistência de nomenclatura de especialidade (`Clinica Geral` x `Clinico Geral`), o que afeta leitura e analytics.

## Achados prioritarios

### 1. Entrega ainda e o ponto mais opaco

O sistema registra 93,3% das mensagens da IA como `pending`. Isso impede diagnostico confiavel de:
- taxa real de entrega;
- taxa real de leitura;
- sumico de respostas;
- impacto operacional dos ajustes de jornada.

### 2. Classificacao ainda esta fraca

`unknown` domina a operacao. Isso reduz a capacidade de:
- escolher o melhor proximo passo;
- usar menos botoes;
- encaminhar com seguranca para agendamento, preco, exame, retorno ou recepcao.

### 3. Escalacao esta puxada por falha repetida

`repeated_failure` lidera com folga. Isso reforca que o problema principal nao e falta de volume, e sim falta de robustez em alguns trechos do fluxo.

### 4. Conversao de interesse para agendamento ainda e baixa

12 links gerados para 3 agendamentos concluidos e apenas 1 consulta criada diretamente pela IA. A jornada ainda perde paciente entre intencao e fechamento.

## O que ja melhorou nas ultimas iteracoes

As mudancas recentes ja atacam pontos importantes:
- reducao de botoes fora de contexto;
- menos fallback automatico com menu em perguntas informativas;
- bloqueio de repeticao de interativos em sequencia;
- metrica real de tempo de resposta;
- melhoria no tracking `pending`/`sent` do envio.

Essas mudancas devem aparecer melhor no proximo ciclo de dados, nao retroativamente.

## Proximos passos recomendados

### Imediato

1. Corrigir tracking de entrega ate `delivered` e `read`.
2. Reabrir e limpar conversas presas em `escalated` por falha repetida quando nao houver necessidade humana real.
3. Consolidar nomes de especialidade para analytics e agendamento.

### Curto prazo

1. Melhorar o classificador para reduzir `unknown`.
2. Criar dashboard operacional com:
   - entrega real
   - conversas escaladas por motivo
   - conversao de booking link
   - tempo de resposta
   - top intents
3. Medir jornada por etapa:
   - saudacao
   - exploracao
   - triagem
   - link gerado
   - link clicado
   - agendamento concluido

### Produto e conversa

1. Manter botao so em decisao de alta probabilidade.
2. Preferir texto limpo em:
   - agradecimento
   - horario de funcionamento
   - informacoes simples
3. Forcar triagem curta e objetiva quando o paciente quer agendar.

## Conclusao

A IA ja esta operando de forma real e gerando atendimento, mas ainda esta em fase de estabilizacao. O maior gargalo hoje nao e volume, e qualidade operacional:
- tracking de entrega insuficiente;
- intencao `unknown` excessiva;
- taxa alta de escalacao por falha repetida;
- conversao ainda modesta para agendamento.

Com os ajustes de jornada que ja foram publicados, a tendencia e melhorar a experiencia do paciente. O proximo salto de qualidade depende principalmente de analytics confiavel e melhor classificacao de intencao.
