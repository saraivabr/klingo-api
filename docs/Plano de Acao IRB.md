---
title: Plano de Acao IRB
date: 2026-02-18
tags:
  - irb
  - plano
  - acao
  - estrategia
aliases:
  - Roadmap IRB
---

# Plano de Acao IRB

Plano de resolucao dos problemas mapeados no [[Ecossistema IRB]]. Organizado em fases com dependencias claras.

---

## Fase 0 - Fundacao (Semanas 1-2)

> [!tip] Objetivo
> Ter acesso a tudo, entender o estado real e criar a base de trabalho.

### 0.1 - Obter todos os acessos

- [ ] SSH da [[Hostinger]] (VPS do [[Sistema IRB]])
- [ ] Admin do [[Klingo]] + documentacao das 4 APIs
- [ ] [[Meta WhatsApp]] - escanear QR code e ler ultimas 3000 conversas
- [ ] [[GLPI]], [[Interact]], [[SharePoint]]
- [ ] [[Controle Odonto IRB]] e [[Controle Odonto IST]]
- [ ] [[Hilab]], [[Worklab]], [[EDB]]
- [ ] [[CRM Dinamize]]
- [ ] [[SOC]]
- [ ] [[Metabase]]
- [ ] Acesso ao servidor do [[Klingo]] (documentacao API)

### 0.2 - Auditoria do WhatsApp

- [ ] Escanear QR code do WhatsApp da recepcao
- [ ] Sistema le as 3000 ultimas conversas
- [ ] Gerar relatorio analitico: horarios de pico, perguntas frequentes, onde o usuario para de responder, taxa de conversao real, tempo medio de resposta
- [ ] Identificar padroes de atendimento bom vs. ruim

### 0.3 - Testes do [[Sistema IRB]]

- [ ] Acessar VPS via SSH e mapear a estrutura do codigo
- [ ] Testar tela por tela, perfil por perfil, formulario por formulario
- [ ] Documentar: o que funciona, o que trava, o que falta
- [ ] Avaliar viabilidade de automatizar testes (Playwright/IA)
- [ ] Relatorio de redundancia (das 168 paginas, quais sao funcionais)

Resolve: [[Sistema IRB Atrasado]]

---

## Fase 1 - WhatsApp Inteligente (Semanas 2-4)

> [!tip] Objetivo
> Atendimento 24h no WhatsApp com IA, eliminando bloqueios e capturando leads fora do horario.

### 1.1 - IA no WhatsApp (Pacientes)

- [ ] Configurar instancia do Evolution API (ou similar) conectada ao [[Meta WhatsApp]]
- [ ] Criar agente IA com base nos POPs da recepcao e dados da auditoria (0.2)
- [ ] Fluxo: lead chega → IA responde instantaneamente → triagem de interesse → coleta dados → envia link de agendamento
- [ ] Mensagem fora do horario: IA atende normalmente (24h)
- [ ] Mensagem dentro do horario: IA faz triagem inicial, passa pra recepcao se necessario
- [ ] Encaminhamento humano quando IA nao resolve
- [ ] Dashboard de conversas e conversao

### 1.2 - IA no WhatsApp (RH)

- [ ] Agente separado para recrutamento
- [ ] Candidato se cadastra na plataforma → recebe mensagem instantanea (tempo real, nao em lote)
- [ ] Triagem automatica com parametros da vaga (Bia define criterios)
- [ ] Respostas 24h (captar plantonistas 12x36 que respondem de madrugada)
- [ ] Eliminar disparo em massa (resolve [[WhatsApp Bloqueado]])

### 1.3 - Captacao na Landing Page

- [ ] Alterar landing pages: ao inves de "clique para WhatsApp", colocar campo "digite seu numero"
- [ ] Lead cadastra numero → sistema liga automaticamente via IA
- [ ] Captura o lead mesmo se ele nao finalizar a jornada
- [ ] Filtro geografico na narrativa visual (imagens de SP, endereco visivel)

Resolve: [[WhatsApp Bloqueado]], parte da [[Jornada do Paciente]]

---

## Fase 2 - Pagamento Automatizado (Semanas 4-6)

> [!tip] Objetivo
> Eliminar Pix manual e conciliacao em Excel.

### 2.1 - Integrar [[Asaas]]

- [ ] Criar conta/configurar Asaas
- [ ] Integracao via API: atendimento gera cobranca automatica (Pix QR code)
- [ ] Webhook do Asaas: pagamento confirmado → status atualiza automaticamente
- [ ] Recepcao ve apenas: pago / nao pago (sem validacao manual)
- [ ] Historico completo: quem pagou, quando, como, qual procedimento

### 2.2 - Taxa de Reserva

- [ ] Implementar taxa de reserva no agendamento (ex: R$50)
- [ ] Pago via link no WhatsApp (Asaas gera link)
- [ ] Se nao comparece, perde a taxa
- [ ] Reduz no-show significativamente

### 2.3 - Conciliacao Automatica

- [ ] Relatorios automaticos do Asaas substituem Excel do Joao
- [ ] Joao analisa numeros, nao valida transacoes
- [ ] Dashboard financeiro em tempo real

Resolve: [[Processos Manuais]] (pagamento), [[Fluxo de Pagamento]]

---

## Fase 3 - Hub de Dados (Semanas 6-10)

> [!tip] Objetivo
> Centralizar dados de todos os sistemas em um unico lugar.

### 3.1 - Banco de Dados Central

- [ ] PostgreSQL como banco unico
- [ ] Tabelas: pacientes, medicos, agendas, atendimentos, pagamentos, exames
- [ ] ElasticSearch para busca inteligente (buscar "adocar" e encontrar "acucar")
- [ ] Redis para cache e performance

### 3.2 - Integracao [[Klingo]]

- [ ] Usar as 4 APIs disponiveis (cadastro, autenticacao, dados, agendas)
- [ ] Sync bidirecional: dados do Klingo → hub, hub → Klingo
- [ ] Para dados sem API: avaliar Playwright para captura via network
- [ ] Webhook simulado: polling periodico nas APIs do Klingo

### 3.3 - Integracao Labs

- [ ] [[Hilab]], [[Worklab]], [[EDB]]: verificar APIs de cada um
- [ ] Resultados de exame caem automaticamente no hub
- [ ] Paciente recebe notificacao quando resultado fica pronto
- [ ] Eliminar consolidacao manual no [[Klingo]]

### 3.4 - Integracao [[SOC]]

- [ ] Dados de exames ocupacionais fluem para o hub
- [ ] Volume de atendimentos → faturamento automatico

### 3.5 - [[Metabase]] Funcional

- [ ] Conectar Metabase ao PostgreSQL central
- [ ] Dashboards: atendimentos, financeiro, conversao de leads, NPS, ocupacao de agenda
- [ ] Alertas automaticos para anomalias

Resolve: [[Sem ERP Unificado]], [[Redundancia de Sistemas]] (dados), [[Fluxo de Exames]]

---

## Fase 4 - Consolidar Redundancias (Semanas 8-12)

> [!tip] Objetivo
> Eliminar sistemas duplicados e padronizar.

### 4.1 - Odontologia

- [ ] Confirmar eliminacao do [[Capim]] (Alan ja esta fazendo)
- [ ] Avaliar unificacao de [[Controle Odonto IRB]] e [[Controle Odonto IST]] em base unica
- [ ] Integrar dados odontologicos no hub central

### 4.2 - CRM Unico

- [ ] [[CRM Dinamize]] como CRM oficial (ja e o do marketing)
- [ ] Migrar/sincronizar dados de CRMs internos dos labs e odontos
- [ ] Todos os leads e pacientes em um lugar so
- [ ] Pipeline visivel: lead → agendamento → atendimento → pos-venda

### 4.3 - Assinatura Digital

- [ ] Padronizar em 2 tipos de [[Assinatura Digital]] (ex: AM + DS)
- [ ] Garantir compatibilidade com [[Klingo]] e [[Sistema IRB]]
- [ ] Eliminar custo duplicado da assinatura paga do Klingo

### 4.4 - Comunicacao Interna

- [ ] Desativar [[Slack]] oficialmente
- [ ] Avaliar consolidacao: [[Interact]] + [[GLPI]] + [[SharePoint]] em plataforma unica
- [ ] Ou: intranet via WhatsApp (numero interno com IA para colaboradores)

Resolve: [[Redundancia de Sistemas]]

---

## Fase 5 - Automacoes Avancadas (Semanas 10-16)

> [!tip] Objetivo
> Automatizar processos que ainda dependem de humanos.

### 5.1 - Agendamento Self-Service

- [ ] Link de auto-agendamento enviado pela IA do WhatsApp
- [ ] Paciente ve horarios disponiveis, seleciona, preenche dados minimos
- [ ] Sistema confirma automaticamente
- [ ] Lembrete D-1 e D-0 com video do medico (reducao de no-show)
- [ ] Integra com [[Klingo]] via API de agendas

### 5.2 - Radiologia Digital

- [ ] Eliminar processo de pendrive da [[Radiologia Dental]]
- [ ] Equipamentos conectados na rede → imagem vai direto pro hub
- [ ] Unificar [[MobileMed]] e [[LogicMedic]] (escolher um destino: nuvem)

### 5.3 - IRB Academy (Intranet)

- [ ] Plataforma de onboarding e treinamento (LMS)
- [ ] POPs carregados na IA → colaborador pergunta e recebe resposta
- [ ] Cursos gerados a partir dos treinamentos gravados do [[Klingo]]
- [ ] Testes de validacao (pre e pos) com registro de auditoria
- [ ] Pesquisa de clima organizacional (requisito ONA)
- [ ] Disseminacao de politicas (LGPD, etc.) com confirmacao de leitura

### 5.4 - NPS e Avaliacao Inteligente

- [ ] Comento atual coleta dados mas nao analisa
- [ ] IA analisa respostas e gera insights automaticos
- [ ] Identifica padroes: "terças o atendimento cai com Dr. X"
- [ ] Avaliacao Google: manter QR code presencial + e-book como reciprocidade
- [ ] Para telemedicina: pesquisa automatica no fim do atendimento

### 5.5 - Telefonia com IA

- [ ] [[Telefonia Fixa]] SIP ja e digital/nuvem
- [ ] Integrar IA para triagem de ligacoes
- [ ] Atendimento inicial por voz antes de transferir para humano

Resolve: [[Processos Manuais]] (restantes), escala operacional

---

## Fase 6 - Inteligencia e Escala (Semanas 14-20)

> [!tip] Objetivo
> Dashboards inteligentes, alertas e preparacao para expansao.

### 6.1 - BI Completo

- [ ] [[Metabase]] com todos os dados do hub
- [ ] KPIs: conversao de leads, no-show, tempo de atendimento, NPS, faturamento
- [ ] Alertas automaticos para gestao (Robert, Darli, Ivan)
- [ ] Relatorios diarios automaticos via WhatsApp para diretoria

### 6.2 - Monitoramento de Colaboradores

- [ ] Tempo de resposta no WhatsApp por atendente
- [ ] Qualidade de atendimento (IA analisa conversas)
- [ ] Performance de medicos (volume, satisfacao, pontualidade)
- [ ] Sem "baba" ao lado: dados digitais fazem a gestao

### 6.3 - Preparacao para Expansao

- [ ] Todos os processos documentados e automatizados
- [ ] Onboarding via IRB Academy (nova unidade = mesmos processos)
- [ ] Cabines de telemedicina com [[Vsee]] como backup
- [ ] Sistemas prontos para 10 unidades sem retrabalho

---

## Cronograma Visual

| Fase | Semanas | Foco | Resolve |
|:-----|:--------|:-----|:--------|
| **0** | 1-2 | Acessos, auditoria, testes | Base de trabalho |
| **1** | 2-4 | WhatsApp IA 24h | [[WhatsApp Bloqueado]], captacao |
| **2** | 4-6 | Pagamento automatico | [[Processos Manuais]], no-show |
| **3** | 6-10 | Hub de dados central | [[Sem ERP Unificado]] |
| **4** | 8-12 | Eliminar redundancias | [[Redundancia de Sistemas]] |
| **5** | 10-16 | Automacoes avancadas | [[Processos Manuais]], escala |
| **6** | 14-20 | BI e expansao | Gestao inteligente |

> [!note] Sobreposicao intencional
> As fases se sobrepõem porque algumas podem rodar em paralelo (ex: pagamento nao depende do hub completo).

---

## Dependencias Entre Fases

- **Fase 0** → desbloqueia todas as outras
- **Fase 1** → independente (pode comecar junto com 0)
- **Fase 2** → independente (pode comecar apos 0)
- **Fase 3** → depende parcialmente de 0 (acessos e APIs)
- **Fase 4** → depende de 3 (hub precisa existir para migrar dados)
- **Fase 5** → depende de 1 + 2 + 3
- **Fase 6** → depende de 3 + 5

---

## Quick Wins (Impacto imediato, esforco baixo)

> [!success] Pode fazer agora

1. **Mensagem fora do horario** no WhatsApp (nem precisa de IA, basta mensagem automatica)
2. **Filtro geografico** na landing page (colocar "Sao Paulo - Centro" visivel)
3. **Pergunta aberta** na primeira mensagem do RH (ja implementado parcialmente)
4. **Pausar campanhas apos 19h** (nao gerar leads sem atendimento)
5. **QR code Google** continuar no presencial (169 avaliacoes/mes, resultado comprovado)
6. **Eliminar [[Capim]]** oficialmente (Alan ja esta fazendo)
7. **Desativar [[Slack]]** oficialmente (ninguem usa)

---

## Pessoas e Responsabilidades

| Pessoa | Area | Papel no Plano |
|:-------|:-----|:---------------|
| Felipe (Saraiva) | Tecnologia/IA | Execucao tecnica de todas as fases |
| Alan | TI | Acessos, infraestrutura, testes Sistema IRB, suporte |
| Robert | Gestao | Aprovacoes, priorizacao, decisoes estrategicas |
| Darli | Operacoes | POPs, fluxos de atendimento, validacao de processos |
| Joao | Financeiro | Validacao Fase 2 (pagamento), requisitos financeiros |
| Michel | Contas a Pagar | Teste e validacao do fluxo de pagamento |
| Bia | RH | Parametros de triagem, teste da IA de recrutamento |
| Marcela/Julia/Mariana | Recepcao | Teste de fluxos, feedback de usabilidade |
| Felipe (dev Sistema IRB) | Desenvolvimento | Correcoes e ajustes no Sistema IRB |
| Dra. Talita | Odontologia | Unificacao dos controles odonto |
| Ivan | Diretoria | Aprovacao de investimentos e mudancas estrategicas |
