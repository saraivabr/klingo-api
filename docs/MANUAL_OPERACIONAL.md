# Manual Operacional - IRB Prime Care

## Sistema de Gestao e Atendimento Inteligente

**Versao:** 1.0 | **Data:** 19/03/2026 | **Publico:** Equipe operacional IRB Prime Care

---

## Sumario

1. [Introducao](#1-introducao)
2. [WhatsApp AI (Julia)](#2-whatsapp-ai-julia)
3. [Painel de Conversas](#3-painel-de-conversas)
4. [CRM - Pipeline de Leads](#4-crm---pipeline-de-leads)
5. [CRM - Campanhas](#5-crm---campanhas)
6. [CRM - Metricas](#6-crm---metricas)
7. [PDV - Ponto de Venda](#7-pdv---ponto-de-venda)
8. [Modulo Financeiro](#8-modulo-financeiro)
9. [Agendamento Online](#9-agendamento-online)
10. [Gestao de Usuarios](#10-gestao-de-usuarios)
11. [Perguntas Frequentes (FAQ)](#11-perguntas-frequentes-faq)
12. [Glossario](#12-glossario)

---

## 1. Introducao

### O que e o sistema

O sistema IRB Prime Care e uma plataforma completa que reune atendimento inteligente via WhatsApp, gestao financeira, CRM (gestao de relacionamento com leads e pacientes) e agendamento online. Ele foi criado para facilitar o dia a dia da clinica, automatizando tarefas repetitivas e organizando todas as informacoes em um unico lugar.

O sistema possui tres grandes pilares:

- **Atendimento via WhatsApp com IA (Julia):** Uma assistente virtual que conversa com pacientes, agenda consultas e tira duvidas 24 horas por dia.
- **Dashboard de gestao:** Painel onde a equipe acompanha conversas, gerencia financeiro, controla leads e muito mais.
- **CRM e PDV:** Ferramentas para captar e acompanhar potenciais pacientes, e para cobrar procedimentos e planos diretamente pelo sistema.

### Como acessar

1. Abra o navegador (Google Chrome recomendado)
2. Digite o endereco: **https://irb.saraiva.ai**
3. A tela de login sera exibida

### Login

1. Digite seu **e-mail** cadastrado
2. Digite sua **senha**
3. Clique em **Entrar**

> **Dica:** Se voce esqueceu sua senha, entre em contato com o administrador do sistema para redefini-la.

> **Atencao:** Nunca compartilhe sua senha com outras pessoas. Cada colaborador deve ter seu proprio acesso.

### Perfis de acesso

O sistema possui 5 perfis de acesso. Cada perfil libera um conjunto diferente de telas e funcionalidades:

| Perfil | Descricao | O que pode acessar |
|---|---|---|
| **Super Admin** | Administrador geral do sistema | Todas as telas e funcionalidades sem excecao |
| **Diretoria Financeira** | Diretor(a) financeiro(a) | Dashboard, Metricas, todo o modulo Financeiro, CRM completo (pipeline, campanhas, metricas) |
| **Analista Financeiro** | Analista da area financeira | Dashboard, modulo Financeiro completo (incluindo aprovacao de pagamentos e importacao de extratos) |
| **Operacao Financeira** | Operador(a) financeiro(a) | Dashboard, modulo Financeiro somente visualizacao (sem aprovar ou pagar) |
| **Atendimento** | Recepcionista / atendente | Dashboard, Conversas, Teleconsulta, Agendas, Assinaturas |

> **Dica:** Alem do perfil base, o administrador pode liberar ou bloquear permissoes individuais para cada colaborador. Se voce nao consegue acessar uma tela que precisa, fale com o administrador.

### Navegacao basica

Ao entrar no sistema, voce vera:

- **Menu lateral esquerdo (sidebar):** Contendo todos os modulos disponiveis para o seu perfil
- **Area principal (centro da tela):** Onde o conteudo de cada modulo e exibido
- **Indicador de conexao (canto inferior esquerdo):** Mostra se voce esta conectado ao sistema em tempo real (bolinha verde = conectado, bolinha vermelha = desconectado)
- **Botao Sair (canto inferior esquerdo):** Para encerrar sua sessao

Os itens do menu lateral sao:

| Item do menu | Funcao |
|---|---|
| Jornadas | Painel geral de fluxos de trabalho |
| Conversas | Painel Kanban com todas as conversas do WhatsApp |
| Teleconsulta | Gerenciamento de consultas por video |
| Agendas | Visualizacao das agendas medicas |
| Consultas | Registro de consultas (OPD) |
| Faturamento | Faturamento de procedimentos |
| Laboratorio | Exames laboratoriais |
| Farmacia | Controle de farmacia |
| Metricas | Indicadores de desempenho do atendimento |
| PDV Cobranca | Ponto de Venda para gerar cobranças |
| Assinaturas | Gestao de planos de assinatura |
| CRM | Submenu com Pipeline, Metricas e Campanhas |
| Financeiro | Submenu com Visao Geral, Contas a Pagar, Contas a Receber, Pagamento Diario, Fluxo de Caixa, Reembolsos, Ordens de Pagamento e Cadastros |
| Usuarios | Gerenciamento de colaboradores (somente admins) |
| Configuracoes | Ajustes do sistema |

> **Dica:** Os submenus CRM e Financeiro sao expansiveis. Clique sobre eles para ver as opcoes internas. Uma seta para baixo indica que o submenu esta expandido, e uma seta para a direita indica que esta recolhido.

> **Dica:** O menu de Conversas mostra um numero em vermelho quando ha mensagens nao lidas. Clique nele para ver as novas conversas.

---

## 2. WhatsApp AI (Julia)

### Quem e a Julia

A Julia e a assistente virtual da IRB Prime Care que atende os pacientes pelo WhatsApp. Ela funciona 24 horas por dia, 7 dias por semana, respondendo mensagens automaticamente.

Para os pacientes, a Julia se apresenta como uma pessoa real da recepcao da clinica. Ela conversa de forma natural, acolhedora e empática, como uma amiga que realmente se preocupa com a saude do paciente.

### O que a Julia faz automaticamente

A Julia realiza diversas tarefas sem precisar de intervencao humana:

1. **Boas-vindas:** Quando um paciente envia a primeira mensagem, a Julia se apresenta e oferece opcoes (sintoma, check-up, pedido de exame)
2. **Triagem:** Antes de agendar, a Julia pergunta o motivo da consulta para direcionar ao especialista correto
3. **Indicacao de medico:** Com base nos sintomas ou necessidade, a Julia recomenda o medico ideal do corpo clinico
4. **Agendamento:** Gera links de agendamento online para o paciente escolher o melhor horario
5. **Informacoes sobre a clinica:** Endereco, horarios, formas de pagamento, precos de consultas
6. **Teleconsulta:** Quando apropriado, sugere atendimento por video
7. **Acolhimento:** Trata objecoes (preco, duvidas) de forma empática e persuasiva

### Corpo clinico que a Julia conhece

| Medico | Especialidade |
|---|---|
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

### Quando a Julia escala para humano

A Julia transfere a conversa para um atendente humano nas seguintes situacoes:

- O paciente pede expressamente para falar com uma pessoa
- Urgencia medica real (dor forte, sangramento, desmaio)
- A Julia nao sabe a resposta para alguma pergunta
- Situacoes que fogem do escopo de atendimento padrao

### Horario de funcionamento

- **Segunda a sexta:** 7h as 19h
- **Sabado:** 8h as 13h
- **Domingo:** Fechado

Fora do horario, a Julia ainda responde mensagens, mas informa o horario de funcionamento e diz que retornara no proximo dia util. Ela coleta as informacoes do paciente para dar seguimento.

### Como ver conversas no dashboard

1. No menu lateral, clique em **Conversas**
2. Voce vera o painel Kanban com todas as conversas organizadas por status
3. Clique em qualquer card de conversa para abrir o chat completo

### Como assumir uma conversa (escalar manualmente)

Se voce precisa responder pessoalmente a um paciente:

1. Abra a conversa clicando no card
2. No painel de chat, clique no botao **Assumir**
3. A conversa sera transferida para voce e a Julia deixara de responder automaticamente
4. Digite sua mensagem no campo de texto e clique em **Enviar** (ou pressione Enter)

> **Atencao:** Quando voce assume uma conversa, a IA para de responder. Fique atento para nao deixar o paciente sem resposta.

### Como devolver para a IA

Quando terminar de atender manualmente e quiser que a Julia volte a cuidar da conversa:

1. No painel de chat da conversa, clique em **Devolver para IA**
2. A Julia voltara a responder automaticamente a partir desse momento

### Como fechar uma conversa

1. No painel de chat, clique em **Fechar conversa**
2. Confirme a acao na mensagem que aparecera
3. A conversa sera movida para a coluna "Fechada" no Kanban

> **Dica:** Feche conversas que ja foram resolvidas para manter o painel organizado.

---

## 3. Painel de Conversas

### Visao Kanban

O painel de Conversas organiza todos os atendimentos em um quadro Kanban com 4 colunas:

| Coluna | Cor | Significado |
|---|---|---|
| **IA** | Verde | Conversas sendo atendidas automaticamente pela Julia |
| **Aguardando** | Amarelo | Conversas aguardando acao (paciente ou equipe) |
| **Humano** | Azul | Conversas que foram assumidas por um atendente humano |
| **Fechada** | Cinza | Conversas encerradas/resolvidas |

Cada conversa aparece como um card mostrando:
- Nome ou telefone do paciente
- Ultima mensagem ou status
- Tempo desde a ultima interacao

O numero ao lado do titulo de cada coluna indica quantas conversas estao naquele status.

### Como filtrar conversas

No topo do painel de conversas, voce pode:
- Buscar pelo nome ou telefone do paciente
- Filtrar por status especifico

### Como abrir o chat

1. Clique em qualquer card de conversa no Kanban
2. O painel de chat abrira em tela cheia com:
   - **Cabecalho:** Nome do paciente, telefone, status da conversa
   - **Historico de mensagens:** Todas as mensagens trocadas (IA e humano)
   - **Campo de envio:** Para digitar e enviar mensagens manualmente
   - **Painel lateral:** Informacoes do paciente (quando disponivel)

### Como enviar mensagens manuais

1. Abra a conversa
2. Se necessario, clique em **Assumir** para tomar controle da conversa
3. Digite sua mensagem no campo de texto na parte inferior
4. Clique no icone de enviar ou pressione **Enter**

> **Atencao:** Voce so pode enviar mensagens manuais em conversas que voce assumiu. Se a conversa esta sob controle da IA, voce precisa assumi-la primeiro.

### Como ver o historico do paciente

1. Abra o chat de uma conversa
2. No lado direito, clique no icone de painel lateral para expandir/recolher
3. O painel mostrara informacoes do paciente como: nome, telefone, historico de conversas anteriores, dados cadastrais

> **Dica:** Pressione a tecla **Esc** para fechar o painel de chat e voltar ao Kanban.

---

## 4. CRM - Pipeline de Leads

### O que e o pipeline

O Pipeline e um quadro visual (Kanban) que organiza todos os potenciais pacientes (leads) da clinica em etapas, desde o primeiro contato ate o fechamento. Ele ajuda a equipe a acompanhar o progresso de cada lead e garantir que ninguem fique sem atencao.

### Como acessar

1. No menu lateral, clique em **CRM**
2. Clique em **Pipeline**

### As etapas do pipeline

O pipeline possui etapas que representam a jornada do lead. Cada coluna do Kanban corresponde a uma etapa. As etapas sao configuradas pelo administrador e tipicamente incluem fases como:

- **Novo Lead** - Lead acabou de chegar
- **Primeiro Contato** - Equipe ja fez o primeiro contato
- **Qualificado** - Lead tem interesse real e perfil adequado
- **Proposta Enviada** - Enviamos informacoes/proposta ao lead
- **Negociacao** - Estamos negociando detalhes
- **Agendado** - Lead agendou consulta
- **Ganho** - Lead se tornou paciente
- **Perdido** - Lead desistiu ou nao tem interesse

Cada etapa tem uma cor propria para facilitar a identificacao visual.

### Como visualizar leads no Kanban

Ao abrir o Pipeline, voce vera:
- Colunas lado a lado representando cada etapa
- Cards dentro de cada coluna representando cada lead
- Cada card mostra: nome, telefone, origem (Google, Meta, Site, Organico), campanha vinculada e tempo desde a criacao

### Filtros disponiveis

Na barra superior do Pipeline, voce pode:
- **Buscar por nome ou telefone:** Digite no campo de busca
- **Filtrar por origem:** Selecione entre Google Ads, Meta Ads, Site ou Organico
- **Filtrar por campanha:** Selecione uma campanha especifica

### Como mover um lead entre etapas

**Metodo 1 - Arrastar e soltar:**
1. Clique e segure o card do lead
2. Arraste ate a coluna da etapa desejada
3. Solte o card

**Metodo 2 - Pelo painel de detalhes:**
1. Clique no card do lead para abrir os detalhes
2. No campo **Etapa**, selecione a nova etapa no menu suspenso
3. A mudanca e salva automaticamente

### Como abrir detalhes do lead

1. Clique no card do lead no Kanban
2. O painel de detalhes abrira mostrando:
   - Nome, telefone e e-mail do lead
   - Origem (Google Ads, Meta Ads, Site, Organico)
   - Campanha vinculada
   - Primeira mensagem enviada pelo lead
   - Etapa atual
   - Responsavel
   - Valor estimado (R$)
   - Historico de atividades/notas

### Como adicionar notas e atividades

1. Abra os detalhes do lead
2. Role ate a secao **Atividades**
3. No campo "Adicionar nota...", digite sua observacao
4. Clique em **Adicionar**
5. A nota aparecera no historico de atividades com data e hora

> **Dica:** Registre todas as interacoes com o lead (ligacoes, mensagens, retornos). Isso ajuda toda a equipe a entender o historico.

### Como editar informacoes do lead

1. Abra os detalhes do lead
2. Altere os campos desejados:
   - **Etapa:** Mude a fase do funil
   - **Responsavel:** Atribua um membro da equipe
   - **Valor (R$):** Defina o valor estimado do negocio
3. Clique em **Salvar alteracoes**

### Como criar um lead manualmente

1. No topo do Pipeline, clique no botao **Novo Lead**
2. Preencha os campos:
   - **Nome** (obrigatorio)
   - **Telefone** (obrigatorio)
   - **E-mail** (opcional)
   - **Origem** (Google Ads, Meta Ads, Site ou Organico)
   - **Interesse** (o que o lead procura)
3. Clique em **Criar lead**

> **Dica:** Leads que chegam pelo WhatsApp sao criados automaticamente. Use o cadastro manual para leads que chegam por telefone, presencialmente ou por outros canais.

### Como converter lead em paciente

Quando o lead agendar e comparecer a consulta:

1. Abra os detalhes do lead
2. Clique no botao verde **Converter em paciente**
3. Confirme a acao
4. O lead sera convertido em paciente no sistema

### Como fechar como ganho ou perdido

**Marcar como ganho:**
1. Abra os detalhes do lead
2. Clique no botao azul **Ganho**
3. O lead sera marcado como fechado com sucesso

**Marcar como perdido:**
1. Abra os detalhes do lead
2. Clique no botao **Perdido**
3. Digite o motivo da perda (ex: "preco", "mudou de cidade", "nao respondeu")
4. Clique em OK

> **Atencao:** Registrar o motivo da perda e muito importante. Isso ajuda a identificar padroes e melhorar as estrategias de captacao.

---

## 5. CRM - Campanhas

### O que sao campanhas

Campanhas sao acoes de marketing que trazem leads para a clinica. Cada campanha tem um codigo unico (UTM) que permite rastrear de onde cada lead veio. Exemplos: uma campanha de Google Ads, um anuncio no Instagram, uma landing page no site.

### Como acessar

1. No menu lateral, clique em **CRM**
2. Clique em **Campanhas**

### Como criar uma campanha

1. Clique no botao **Nova campanha**
2. Preencha os campos:
   - **Nome** (obrigatorio): Nome descritivo da campanha. Ex: "Google Ads - Cardiologia Marco"
   - **Codigo UTM** (obrigatorio): Codigo unico para rastreamento. Ex: "google_cardio_mar25"
   - **Canal:** Selecione entre Google, Meta, Site, E-mail ou Outro
   - **Midia:** Tipo de midia (cpc, social, organic)
   - **Landing page:** URL da pagina de destino (se houver)
   - **Orcamento (R$):** Valor investido na campanha
   - **Data de inicio e fim:** Periodo de vigencia
3. Clique em **Criar campanha**

> **Dica:** Use codigos UTM padronizados para facilitar a analise. Exemplo de padrao: canal_especialidade_mes (google_cardio_mar25).

### Como usar os codigos nas landing pages e anuncios

O codigo da campanha deve ser adicionado como parametro UTM nos links dos anuncios e landing pages. Assim, quando um lead chega pelo WhatsApp vindo desse link, o sistema identifica automaticamente a campanha de origem.

Exemplo de URL com UTM:
```
https://seusite.com/lp-cardiologia?utm_campaign=google_cardio_mar25
```

### Como editar uma campanha

1. Na tabela de campanhas, encontre a campanha desejada
2. Clique no icone de lapis (Editar) na coluna de Acoes
3. Altere os campos necessarios
4. Clique em **Salvar alteracoes**

### Como pausar ou ativar uma campanha

1. Na tabela de campanhas, encontre a campanha
2. Clique no icone de pausa ou play na coluna de Acoes:
   - Icone de **pausa**: Pausa uma campanha ativa
   - Icone de **play**: Reativa uma campanha pausada

Os status possiveis sao:

| Status | Cor | Significado |
|---|---|---|
| Ativa | Verde | Campanha esta rodando e captando leads |
| Pausada | Amarelo | Campanha temporariamente parada |
| Encerrada | Cinza | Campanha finalizada |

### Como ver resultados por campanha

Na tabela de campanhas, a coluna **Leads** mostra quantos leads cada campanha gerou. Para uma analise mais detalhada:

1. Va para **CRM > Metricas** para ver graficos comparativos
2. Ou va para **CRM > Pipeline** e filtre por campanha especifica

---

## 6. CRM - Metricas

### Como acessar

1. No menu lateral, clique em **CRM**
2. Clique em **Metricas**

### Indicadores disponiveis

No topo da tela, voce encontra 4 cards com os principais indicadores:

| Indicador | O que mostra |
|---|---|
| **Leads no Mes** | Total de leads captados no mes atual |
| **Taxa de Conversao** | Percentual de leads que se tornaram pacientes |
| **Ticket Medio** | Valor medio dos negocios fechados |
| **Leads Hoje** | Quantidade de novos leads captados hoje |

### Grafico por origem

O grafico de rosca "Leads por origem" mostra a distribuicao dos leads por canal de captacao:

- **Google Ads** (azul)
- **Meta Ads** (roxo)
- **Site** (verde)
- **Organico** (cinza)

O numero central mostra o total de leads. Ao lado, uma legenda mostra a quantidade e percentual de cada origem.

### Grafico por campanha

O grafico de barras horizontais "Leads por campanha" mostra quantos leads cada campanha ativa gerou. As barras maiores indicam as campanhas com melhor desempenho.

### Funil do pipeline

A tabela "Funil do pipeline" mostra quantos leads estao em cada etapa:

| Coluna | Significado |
|---|---|
| Etapa | Nome da etapa do funil |
| Leads | Quantidade de leads naquela etapa |
| % do total | Percentual em relacao ao total |
| Barra visual | Representacao grafica do percentual |

### Leads recentes

A tabela "Leads recentes" mostra os ultimos 10 leads captados com nome, telefone, origem, etapa atual e data de entrada.

### Como interpretar os numeros

- **Taxa de conversao baixa (abaixo de 10%):** Pode indicar que os leads nao estao sendo bem trabalhados ou que o publico captado nao esta qualificado
- **Poucas leads no mes:** Pode indicar necessidade de investir mais em campanhas ou revisar as estrategias
- **Muitos leads parados na mesma etapa:** Indica gargalo no funil; a equipe precisa dar atencao a esses leads
- **Uma campanha com muitos leads e outra com poucos:** Compare o investimento e ajuste o orcamento

> **Dica:** Acompanhe as metricas semanalmente para identificar tendencias e agir rapidamente quando necessario.

---

## 7. PDV - Ponto de Venda

O PDV (Ponto de Venda) e a tela onde voce gera cobranças para pacientes, seja por procedimentos avulsos ou assinaturas de planos. Todas as cobranças sao processadas pelo gateway Asaas.

### Como acessar

1. No menu lateral, clique em **PDV Cobranca**

### Modos de operacao

O PDV possui dois modos, selecionaveis no canto superior direito:

- **Procedimentos:** Para cobrar consultas, exames e procedimentos avulsos
- **Planos:** Para criar assinaturas mensais de planos de saude

### Passo a passo - Cobranca de procedimento

**Etapa 1: Selecionar paciente**

1. No campo "Buscar por nome ou telefone", digite o nome ou telefone do paciente
2. Aguarde os resultados aparecerem (busca automatica)
3. Clique no nome do paciente correto
4. O paciente sera selecionado e exibido no topo

**Etapa 2: Preencher CPF**

1. No campo **CPF (obrigatorio)**, digite o CPF do paciente
2. Opcionalmente, preencha o **E-mail** para envio de comprovante

> **Atencao:** O CPF e obrigatorio para gerar a cobranca. Sem ele, o botao de cobrar ficara desabilitado.

**Etapa 3: Adicionar procedimentos ao carrinho**

1. Use o campo "Buscar procedimento" para encontrar o item desejado
2. Opcionalmente, filtre por categoria usando o menu suspenso
3. Clique no card do procedimento para adiciona-lo ao carrinho (painel direito)
4. Para alterar a quantidade, use os botoes + e -
5. Para remover um item, clique no icone de lixeira
6. Para aplicar desconto, digite o percentual no campo "Desconto %"

**Etapa 4: Escolher forma de pagamento**

No painel direito (carrinho), selecione a forma de pagamento:

| Forma | Descricao |
|---|---|
| **PIX** | Gera QR Code para pagamento instantaneo |
| **Cartao** | Cobranca no cartao de credito (ate 12x) |
| **Boleto** | Gera boleto bancario |

Se escolher **Cartao**, selecione tambem o numero de parcelas (1x a 12x).

**Etapa 5: Cobrar**

1. Confira o valor total no resumo
2. Clique no botao **Cobrar R$ XX,XX**
3. Aguarde o processamento

**Etapa 6: Acompanhar pagamento**

Apos gerar a cobranca:

- **PIX:** O sistema exibira o QR Code na tela. O paciente pode escanear com o celular. Tambem e possivel clicar em **Copiar Pix Copia e Cola** para enviar o codigo.
- **Boleto:** Um link sera exibido para acessar o boleto.
- **Cartao:** O link da fatura sera exibido.

O sistema verifica automaticamente o status do pagamento a cada poucos segundos. Quando confirmado, a tela mudara para verde com a mensagem "Pagamento Confirmado!".

> **Dica:** Para cobranças PIX, mantenha a tela aberta ate o pagamento ser confirmado. O sistema atualiza automaticamente.

**Etapa 7: Nova cobranca**

Apos a confirmacao:
- Clique em **Nova Cobranca** para cobrar outro procedimento do mesmo paciente
- Clique em **Novo Paciente** para iniciar uma cobranca para outro paciente

### Passo a passo - Assinatura de plano

1. No topo, selecione o modo **Planos**
2. Selecione o paciente (mesmo processo acima)
3. Preencha CPF e e-mail
4. Escolha um dos planos disponiveis clicando no card correspondente
5. Selecione a forma de pagamento
6. Clique em **Cobrar**

> **Atencao:** Assinaturas geram cobranças recorrentes mensais automaticamente pelo Asaas.

---

## 8. Modulo Financeiro

O modulo Financeiro reune todas as ferramentas de gestao financeira da clinica. Acesse pelo menu lateral clicando em **Financeiro** e expandindo o submenu.

### 8.1 Visao Geral

**Caminho:** Financeiro > Visao Geral

A Visao Geral apresenta um resumo executivo do cenario financeiro:

- **Assinaturas ativas:** Quantos pacientes estao com planos ativos
- **Assinaturas inadimplentes:** Quantos estao com pagamento atrasado
- **Receita do mes:** Total arrecadado no mes
- **Total vencido:** Valor total em atraso
- **Saldo bancario e posicao liquida:** Resumo do fluxo de caixa

### 8.2 Contas a Pagar

**Caminho:** Financeiro > Contas a Pagar

Nesta tela voce gerencia todas as obrigacoes financeiras da clinica (fornecedores, contas fixas, etc.).

**Como visualizar contas:**
1. Acesse Contas a Pagar
2. Use os filtros para refinar a busca:
   - Busca por texto (descricao, fornecedor)
   - Filtro por status
   - Filtro por periodo

**Status das contas a pagar:**

| Status | Cor | Significado |
|---|---|---|
| Pendente | Amarelo | Conta lancada, aguardando aprovacao |
| Aprovada | Azul | Conta aprovada, pronta para pagamento |
| Paga | Verde | Conta ja foi paga |
| Vencida | Vermelho | Conta passou do vencimento sem pagamento |

**Como aprovar um pagamento (perfil Analista ou superior):**
1. Encontre a conta com status "Pendente"
2. Clique para abrir os detalhes
3. Revise as informacoes (valor, fornecedor, vencimento)
4. Clique em **Aprovar**

**Como registrar pagamento (perfil Analista ou superior):**
1. Encontre a conta com status "Aprovada"
2. Clique para abrir os detalhes
3. Clique em **Registrar pagamento**
4. Preencha os dados do pagamento (data, metodo)
5. Confirme

> **Atencao:** Contas vencidas sao destacadas em vermelho. Priorize o pagamento destas para evitar juros e multas.

### 8.3 Contas a Receber

**Caminho:** Financeiro > Contas a Receber

Aqui voce acompanha todos os valores a receber, incluindo cobranças geradas pelo Asaas (PIX, boleto, cartao).

**Status das cobranças:**

| Status | Cor | Significado |
|---|---|---|
| PENDING | Amarelo | Cobranca gerada, aguardando pagamento |
| CONFIRMED / RECEIVED | Verde | Pagamento confirmado |
| OVERDUE | Vermelho | Pagamento atrasado |
| REFUNDED | Cinza | Valor estornado |

### 8.4 Pagamento Diario

**Caminho:** Financeiro > Pagamento Diario

Tela que organiza os pagamentos do dia em uma fila, permitindo visualizar e aprovar rapidamente todas as contas que vencem hoje.

### 8.5 Fluxo de Caixa

**Caminho:** Financeiro > Fluxo de Caixa

O Fluxo de Caixa mostra a movimentacao financeira da clinica:

- **Entradas:** Todos os recebimentos (consultas, planos, procedimentos)
- **Saidas:** Todos os pagamentos (fornecedores, salarios, despesas)
- **Saldo:** Diferenca entre entradas e saidas

**Como ler o resumo:**
- Valores em verde indicam entradas (dinheiro entrando)
- Valores em vermelho indicam saidas (dinheiro saindo)
- O saldo final mostra se a clinica esta positiva ou negativa no periodo

### 8.6 Reembolsos

**Caminho:** Financeiro > Reembolsos

Tela para gerenciar solicitacoes de reembolso de pacientes.

### 8.7 Ordens de Pagamento

**Caminho:** Financeiro > Ordens de Pagamento

Tela para criar e gerenciar ordens de pagamento a fornecedores e prestadores.

### 8.8 Cadastros Financeiros

**Caminho:** Financeiro > Cadastros

Nesta tela voce gerencia os cadastros base do modulo financeiro:

- **Fornecedores:** Cadastro de empresas e pessoas que prestam servicos ou vendem produtos para a clinica
- **Plano de Contas:** Categorias contabeis para classificar receitas e despesas
- **Centros de Custo:** Departamentos ou areas para distribuicao dos custos

> **Dica:** Mantenha os cadastros sempre atualizados. Um plano de contas bem organizado facilita muito a analise financeira.

---

## 9. Agendamento Online

### Como funciona o link de agendamento

O sistema gera links unicos de agendamento para cada paciente. Quando a Julia conversa com um paciente e identifica a necessidade, ela gera automaticamente um link personalizado.

### O que o paciente ve

Ao clicar no link, o paciente acessa uma pagina simples e intuitiva onde:

1. **Seleciona o horario:** Ve os horarios disponiveis do medico recomendado e escolhe o melhor
2. **Preenche dados:** Informa nome completo e dados de contato
3. **Confirma:** Confirma o agendamento com um clique

A pagina e rapida, funciona no celular e nao requer instalacao de nenhum aplicativo.

### Como a IA envia links automaticamente

1. Paciente envia mensagem no WhatsApp
2. Julia faz a triagem (pergunta o motivo da consulta)
3. Julia recomenda o medico adequado
4. Julia pergunta o periodo preferido (manha/tarde)
5. Julia gera o link de agendamento automaticamente
6. O paciente recebe um botao "Agendar consulta" que abre o link direto

Todo esse processo acontece sem intervencao humana.

### Como verificar agendamentos

1. No menu lateral, clique em **Agendas**
2. Voce vera os agendamentos do dia organizados por medico e horario
3. Use os filtros de data para ver agendamentos futuros ou passados

> **Dica:** Os agendamentos feitos pelo link online sao sincronizados automaticamente com o sistema Klingo da clinica.

---

## 10. Gestao de Usuarios

> **Atencao:** Esta funcionalidade esta disponivel apenas para usuarios com perfil **Super Admin** ou com a permissao `users.manage`.

### Como acessar

1. No menu lateral, clique em **Usuarios**

### Como criar novo usuario

1. Clique no botao **Novo colaborador**
2. Preencha os campos obrigatorios:
   - **Nome:** Nome completo do colaborador
   - **Email:** E-mail que sera usado para login
   - **Senha:** Senha inicial de acesso
   - **Papel tecnico:** Padrao ou Admin
   - **Perfil de acesso:** Escolha entre os 5 perfis disponiveis
3. Campos opcionais:
   - **Departamento:** Area do colaborador
   - **Cargo:** Funcao exercida
   - **Gestor:** Nome do gestor direto
4. Configure as **excecoes de permissao** se necessario:
   - Clique em **Liberar** para dar acesso extra a uma permissao
   - Clique em **Bloquear** para remover uma permissao do perfil base
5. Configure o **escopo** (centros de custo):
   - Marque "Liberar todos os centros de custo" ou selecione centros especificos
6. Clique em **Salvar acesso**

### Como definir perfil e permissoes

O sistema usa um modelo em camadas:

1. **Perfil base:** Define o conjunto padrao de permissoes (Super Admin, Diretoria Financeira, etc.)
2. **Excecoes (allow/deny):** Permite liberar ou bloquear permissoes individuais alem do perfil base
3. **Escopo:** Define em quais centros de custo o colaborador pode operar

O painel "Resultado efetivo" na tela de edicao mostra exatamente quais permissoes o colaborador tera ao final.

### Como editar um usuario

1. Na tabela de colaboradores, clique no icone de lapis ao lado do usuario
2. Altere os campos desejados
3. Para alterar a senha, preencha o campo "Senha" (deixe vazio para manter a atual)
4. Clique em **Salvar acesso**

### Como desativar um usuario

1. Na tabela de colaboradores, clique no botao de status (Ativo/Inativo) ao lado do usuario
2. O status sera alternado automaticamente
3. Usuarios inativos nao conseguem fazer login no sistema

> **Atencao:** Desativar um usuario NAO exclui seus dados. Voce pode reativa-lo a qualquer momento.

---

## 11. Perguntas Frequentes (FAQ)

### 1. "A Julia respondeu errado, o que faco?"

Se a Julia deu uma informacao incorreta ao paciente:
1. Va ate **Conversas** e localize a conversa
2. Clique no card e depois em **Assumir**
3. Envie uma mensagem corrigindo a informacao ao paciente
4. Informe o administrador do sistema para que a base de conhecimento da Julia seja atualizada

### 2. "O paciente nao recebeu a mensagem"

Possiveis causas e solucoes:
- **Numero incorreto:** Verifique se o numero cadastrado esta correto (com DDD e codigo do pais)
- **WhatsApp desconectado:** Verifique o indicador de conexao no canto inferior esquerdo do dashboard. Se estiver vermelho, informe o administrador
- **Paciente bloqueou o numero:** Nesse caso, nao ha o que fazer pelo sistema; tente contato por telefone

### 3. "Como mudo o horario de atendimento da Julia?"

O horario de atendimento da Julia e configurado pelo administrador do sistema. Atualmente:
- Seg a Sex: 7h as 19h
- Sab: 8h as 13h
- Dom: Fechado

Para alterar, solicite ao administrador do sistema.

### 4. "Como vejo quantos atendimentos a IA fez?"

1. Va ate **Metricas** no menu lateral
2. A tela de metricas mostra estatisticas de atendimento incluindo quantidade de conversas e desempenho

### 5. "O paciente quer falar com uma pessoa, o que faco?"

Dois caminhos:
- **Se a Julia esta atendendo:** A propria Julia transfere automaticamente quando o paciente pede
- **Se voce precisa intervir:** Va em Conversas, encontre a conversa e clique em **Assumir**

### 6. "Como gero uma cobranca PIX para um paciente na recepcao?"

1. Va ate **PDV Cobranca**
2. Busque e selecione o paciente
3. Preencha o CPF
4. Adicione os procedimentos ao carrinho
5. Selecione **PIX** como forma de pagamento
6. Clique em **Cobrar**
7. Mostre o QR Code para o paciente escanear com o celular

### 7. "Um lead chegou por telefone, como cadastro no CRM?"

1. Va ate **CRM > Pipeline**
2. Clique em **Novo Lead**
3. Preencha nome, telefone, e selecione "Organico" como origem
4. No campo Interesse, descreva o que o lead procura
5. Clique em **Criar lead**

### 8. "Como sei se uma campanha esta dando resultado?"

1. Va ate **CRM > Metricas**
2. Veja o grafico "Leads por campanha" para comparar o volume de leads
3. Va ate **CRM > Campanhas** para ver o numero de leads por campanha na tabela
4. Compare o investimento (orcamento) com o numero de leads para calcular o custo por lead

### 9. "O sistema esta lento ou nao carrega"

Tente as seguintes solucoes:
1. Recarregue a pagina (F5 ou Ctrl+R)
2. Limpe o cache do navegador (Ctrl+Shift+Delete)
3. Tente em uma aba anonima (Ctrl+Shift+N no Chrome)
4. Verifique sua conexao com a internet
5. Se o problema persistir, informe o administrador

### 10. "Como crio um plano de assinatura para oferecer aos pacientes?"

Os planos sao cadastrados pelo administrador do sistema. Para solicitar a criacao de um novo plano, entre em contato com o administrador informando:
- Nome do plano
- Valor mensal
- Descricao e beneficios inclusos

### 11. "Posso responder o paciente pelo meu WhatsApp pessoal?"

Nao. Todas as conversas devem ser feitas pelo sistema para que fiquem registradas e a equipe toda possa acompanhar. Responder pelo WhatsApp pessoal causa perda de historico e pode confundir o paciente.

### 12. "Como vejo o historico completo de um paciente?"

1. Va ate **Conversas**
2. Encontre a conversa do paciente
3. Clique no card para abrir o chat
4. O historico completo de mensagens estara disponivel
5. No painel lateral, voce vera dados adicionais do paciente

### 13. "O que significa o numero vermelho no menu Conversas?"

O numero vermelho indica a quantidade de mensagens nao lidas. Clique em **Conversas** para visualiza-las e o contador sera zerado.

### 14. "Como faco para a Julia parar de responder um paciente especifico?"

1. Va ate **Conversas**
2. Encontre a conversa do paciente
3. Clique em **Assumir**
4. A Julia parara de responder esse paciente
5. Voce tera que responder manualmente ate devolver para a IA

---

## 12. Glossario

| Termo | Significado |
|---|---|
| **Asaas** | Gateway de pagamentos usado pela clinica para processar cobranças (PIX, boleto, cartao) |
| **Bot / Chatbot** | Programa de computador que conversa automaticamente; no caso, a Julia |
| **Carrinho** | Lista de procedimentos selecionados para cobranca no PDV |
| **Centro de custo** | Departamento ou area da clinica usada para controle financeiro (ex: Recepcao, Laboratorio) |
| **CRM** | Customer Relationship Management; sistema para gerenciar o relacionamento com leads e pacientes |
| **Dashboard** | Painel de controle; tela principal do sistema com informacoes resumidas |
| **Escalar / Escalacao** | Transferir uma conversa da IA para um atendente humano |
| **Fluxo de caixa** | Relatorio que mostra todas as entradas e saidas de dinheiro da clinica |
| **Funil** | Representacao visual das etapas que um lead percorre ate se tornar paciente |
| **Gateway de pagamento** | Sistema que processa pagamentos online (no caso, Asaas) |
| **IA (Inteligencia Artificial)** | Tecnologia que permite a Julia conversar automaticamente com pacientes |
| **Kanban** | Metodo visual de organizacao em colunas; usado no painel de conversas e no pipeline |
| **Klingo** | Sistema de gestao clinica usado pela IRB para prontuarios e agendas |
| **Landing page (LP)** | Pagina web criada especificamente para receber visitantes de uma campanha |
| **Lead** | Pessoa que demonstrou interesse nos servicos da clinica mas ainda nao e paciente |
| **Parcela** | Divisao de um valor em pagamentos mensais (ex: 3x de R$ 50,00) |
| **PDV** | Ponto de Venda; tela para gerar cobranças no atendimento presencial |
| **Pipeline** | Sequencia de etapas que um lead percorre no CRM |
| **PIX** | Sistema de pagamento instantaneo do Banco Central do Brasil |
| **Plano de contas** | Estrutura de categorias contabeis para classificar receitas e despesas |
| **QR Code** | Codigo de barras bidimensional que pode ser escaneado com a camera do celular |
| **Sidebar** | Menu lateral do sistema, localizado a esquerda da tela |
| **Status** | Estado atual de um item (ex: pendente, aprovado, pago, vencido) |
| **Teleconsulta** | Consulta medica realizada por videochamada |
| **Triagem** | Processo de identificar o motivo da consulta para direcionar ao medico correto |
| **UAZAPI** | Plataforma que conecta o WhatsApp ao sistema da clinica |
| **UTM** | Parametros adicionados a URLs para rastrear a origem de visitantes (utm_campaign, utm_source, etc.) |
| **Webhook** | Mecanismo tecnico que permite que sistemas enviem notificacoes automaticas entre si |
| **WebSocket** | Tecnologia que permite atualizacao em tempo real no dashboard (ex: novas mensagens aparecem instantaneamente) |

---

**Documento elaborado pela equipe de tecnologia da IRB Prime Care.**
**Em caso de duvidas sobre o sistema, entre em contato com o administrador.**
