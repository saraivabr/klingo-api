# Codonto (ControleODONTO) - APIs Extraídas

**Base URL**: `https://codonto.aplicativo.net`
**Plataforma**: ASP.NET MVC (.NET Framework 4.0.33019, ASP.NET 4.8.4667.0)
**Padrão**: POST para Controller/Action, retorna HTML parcial ou JSON
**SignalR Hub**: `https://codonto.aplicativo.net/signalr/hubs`

---

## 1. Administração (Admin Controller)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Admin/ClinicaInfo` | Dados da clínica |
| POST | `/Admin/EquipeList` | Lista da equipe |
| POST | `/Admin/GestaoTempo` | Gestão do tempo |
| POST | `/Admin/GestaoBancaria` | Gestão bancária |
| POST | `/Admin/PoliticaFinanceiraIntro` | Política financeira |
| POST | `/Admin/GestaoCrescimento` | Gestão do crescimento |
| POST | `/Admin/PoliticaPrecosIntro` | Política de preços |
| POST | `/Admin/PoliticaComercialIntro` | Contratos e consentimentos |
| POST | `/Admin/CampanhasMarketingIntro` | Campanhas de marketing |
| POST | `/Admin/ConfiguracoesInfo` | Configurações / Política de mensagens |
| POST | `/Admin/SubCadastrosIntro` | Sub-cadastros |

---

## 2. Home / Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Home/AgendaIntro` | Agenda pessoal |
| POST | `/Home/CadastroInfo` | Meu cadastro |
| POST | `/Home/MensagensIntro` | Lembretes & mensagens |
| POST | `/Home/Welcome` | Tela de boas-vindas |
| POST | `/Home/VerificarAlertas` | Verificar alertas |
| POST | `/Home/CreateNewToken/{paginaID}` | Criar novo token de página |
| GET | `/Home/MenuClinicas` | Menu de clínicas |
| POST | `/Home/ShowAjuda/` | Mostrar ajuda |
| POST | `/Plataforma/AuthThisLocal` | Autenticação local |
| POST | `/Plataforma/LogOff` | Logoff |

---

## 3. Atendimentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Atendimentos/Dashboard` | Dashboard de atendimentos |
| POST | `/Atendimentos/EstatisticaUltimasMovimentacoes` | Estatísticas recentes |
| POST | `/Atendimentos/DashTicketMedio` | Ticket médio |
| POST | `/Atendimentos/DashNovosNegocios` | Novos negócios |
| POST | `/Atendimentos/DashNegociosPerdidos` | Negócios perdidos |
| POST | `/Atendimentos/DashNegociosEmAberto` | Negócios em aberto |
| POST | `/Atendimentos/FluxoHoje` | Fluxo de hoje |
| POST | `/Atendimentos/FluxoAgendamentosList` | Lista de agendamentos do fluxo |
| POST | `/Atendimentos/CalcularPendenciasFaltas` | Calcular pendências/faltas |
| POST | `/Atendimentos/AgendamentosIntro` | Intro de agendamentos |
| POST | `/Atendimentos/ControleRetornosIntro` | Controle de retornos |
| POST | `/Atendimentos/MovimentacoesIntro` | Movimentações |
| POST | `/Atendimentos/ProcedimentosIntro` | Procedimentos |
| POST | `/Atendimentos/RemuneracoesIntro` | Remunerações |
| POST | `/Atendimentos/GuiasIntro` | Controle de convênios/guias |
| POST | `/Atendimentos/Avaliacao` | Gestão da excelência |
| POST | `/Atendimentos/ShowPesquisa` | Pesquisa de atendimentos |
| GET | `/Atendimentos/AgendaDiaPrint?uid=` | Imprimir agenda do dia |

---

## 4. Agenda / Agendamento

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/Agenda/GetEventos?PessoaID={id}&start={ts}&end={ts}` | Buscar eventos da agenda |
| POST | `/Agenda/ChangeHorario` | Alterar horário |
| POST | `/Agenda/ShowAdd` | Mostrar form de adicionar |
| POST | `/Agenda/ShowEdit/{id}` | Mostrar form de editar |
| POST | `/Agenda/ExcluirAgendamento/{id}` | Excluir agendamento |
| POST | `/Agenda/ResizeHorario` | Redimensionar horário |
| POST | `/Agendamento/GetMapaSemanal` | Mapa semanal de agendamentos |
| POST | `/AgendamentosEspera/ListPendentes` | Lista de espera pendentes |

---

## 5. Pacientes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Pacientes/Dashboard` | Dashboard de pacientes |
| POST | `/Pacientes/DashPacientesAtivos` | Pacientes ativos |
| POST | `/Pacientes/DashPacientesNovos` | Pacientes novos |
| POST | `/Pacientes/StatsNovosCadastramentos` | Estatísticas novos cadastros |
| POST | `/Pacientes/DashPacientesEmTratamento` | Pacientes em tratamento |
| POST | `/Pacientes/Prontuarios` | Tela de prontuários |
| POST | `/Pacientes/ShowPesquisaSimples` | Pesquisa simples de pacientes |
| POST | `/Pacientes/PacientesList?filtro={f}&letra={L}` | Listar pacientes por letra |
| POST | `/Pacientes/MarketingIntro` | Marketing / Mala direta |
| POST | `/Pacientes/ShowExport?isFiltrados={bool}` | Exportar planilha de pacientes |
| POST | `/Pacientes/ShowSatisfacaoStatusDialog` | Dialog de satisfação |
| POST | `/Paciente/RemoveProntuario/` | Remover prontuário |

---

## 6. Pessoa (Cadastro)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Pessoa/ShowDialogSearch3` | Dialog de pesquisa de pessoa |
| POST | `/Pessoa/ShowDialogCadastrar3?local=pacientes` | Dialog de cadastrar paciente |
| POST | `/Pessoa/ViewDadosPrincipais` | Dados principais da pessoa |
| POST | `/Pessoa/IsEnderecoAtivo` | Verificar se endereço está ativo |

---

## 7. Cliente (Clínica)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Cliente/ViewDadosPrincipais/{id}` | Dados principais do cliente |
| POST | `/Cliente/ViewContratoPadrao` | Contrato padrão |
| POST | `/Cliente/ViewConfiguracoesSMSAgendaDia` | Config SMS agenda do dia |
| POST | `/Cliente/ViewPoliticaMultaAndJuros` | Política de multa e juros |
| POST | `/Cliente/ViewTransacoesAnaliseMonth?PreviousMonths={n}` | Análise de transações mensal |
| POST | `/Cliente/ShowDashboardForm?TipoDashboard=Financeiro` | Dashboard financeiro |
| POST | `/Cliente/AddNewIPAddress?Ip=` | Adicionar IP |
| POST | `/Cliente/PesquisarNome` | Pesquisar cliente por nome |

---

## 8. Clientes (Comercial)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Clientes/ClientesIntro` | Introdução clientes |
| POST | `/Clientes/ClienteInfo/{id}` | Info do cliente |
| POST | `/Clientes/ComercialIntro` | Gestão de negócios |

---

## 9. Equipe

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Equipe/ListNivers?Mes={mes}` | Aniversariantes da equipe |
| POST | `/Equipe/ViewRemuneracaoPesquisa` | Pesquisa de remuneração |

---

## 10. Financeiro

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Financeiro/Dashboard` | Dashboard financeiro |
| POST | `/Financeiro/FaturamentoIntro` | Faturamento |
| POST | `/Financeiro/RecebiveisIntro` | Contas a receber |
| POST | `/Financeiro/ExigiveisIntro` | Contas a pagar |
| POST | `/Financeiro/FluxoIntro` | Fluxo de caixa |
| POST | `/Financeiro/Comissionamentos` | Comissionamentos |
| POST | `/Financeiro/FechamentoCaixasIntro` | Fechamento de caixas |
| POST | `/Financeiro/CaixaAdministrativoIntro` | Caixa administrativo |
| POST | `/Financeiro/ControleBoletosIntro` | Controle de boletos |

---

## 11. Recebíveis / Recebidos / Exigíveis / Pagos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Recebiveis/ShowPesquisaSimples` | Pesquisa de recebíveis |
| POST | `/Recebiveis/GetStatInadimplencia` | Estatísticas de inadimplência |
| POST | `/Recebidos/ShowPesquisaSimples` | Pesquisa de recebidos |
| POST | `/Exigiveis/ShowPesquisaSimples` | Pesquisa de exigíveis |
| POST | `/Pagos/ShowPesquisaSimples` | Pesquisa de pagos |

---

## 12. Fluxo de Caixa / Conciliações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/FluxoCaixa/ShowPesquisaCaixa` | Pesquisa caixa |
| POST | `/FluxoCaixa/ShowPesquisaCompetencia` | Pesquisa competência |
| POST | `/FluxoCaixa/ShowPesquisaCaixaFechamentos` | Pesquisa fechamentos |
| POST | `/FluxoCaixa/ShowPesquisaCaixaFechamentosInternos` | Fechamentos internos |
| POST | `/Conciliacoes/ChequesPesquisar` | Pesquisar cheques |

---

## 13. Comissionamentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Comissionamentos/ViewApuracaoVendedoresPesquisar` | Apuração vendedores |
| POST | `/Comissionamentos/ViewConsolidarComissoes` | Consolidar comissões |
| POST | `/Comissionamentos/ViewApuracaoMetasPesquisar` | Apuração de metas |
| POST | `/Comissionamentos/ViewContaCorrentePesquisa` | Conta corrente |

---

## 14. Controle de Boletos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/ControleBoletos/TitulosList?filtro={f}&Data={data}` | Lista de títulos |
| POST | `/ControleBoletos/AtivarServico` | Ativar serviço |
| POST | `/ControleBoletos/InativarServico` | Inativar serviço |
| POST | `/ControleBoletos/GetEula` | Obter EULA |
| POST | `/ControleBoletos/ProcessarBoleto` | Processar boleto |
| POST | `/ControleBoletosRecebimentos/ListCliente?filtro={f}&Data={data}` | Recebimentos |
| POST | `/ControleBoletosResgates/ClienteList?filtro={f}&Data={data}` | Resgates |
| POST | `/ControleBoletosCashback/ClienteListUtilizacao` | Cashback utilização |
| POST | `/ControleBoletosAntecipacoes/AtivarServico/` | Ativar antecipações |
| POST | `/ControleBoletosAntecipacoes/GetEula` | EULA antecipações |

---

## 15. Notas Fiscais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/NotasFiscais/ShowPesquisa` | Pesquisa de notas |
| POST | `/NotasFiscais/ListAFaturar?Mes={n}` | Listar a faturar |
| POST | `/NotasFiscais/ViewNFSeDadosPrincipais/{id}` | Dados NFS-e |

---

## 16. Contratos / Orçamentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Contrato/ShowPesquisa` | Pesquisa de contratos |
| POST | `/ContratoItens/ShowPesquisarEmAberto` | Itens em aberto |
| POST | `/ContratoItens/ShowPesquisarContratados` | Itens contratados |
| POST | `/ContratoEventos/ShowPesquisarManutencoes` | Pesquisar manutenções |
| POST | `/ContratoEventos/ShowPesquisar` | Pesquisar eventos |
| POST | `/Orcamento/ShowPesquisa` | Pesquisa de orçamentos |

---

## 17. Negócios

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Negocios/ShowPesquisa` | Pesquisa de negócios |
| POST | `/NegocioAgendamentos/ShowPesquisa` | Pesquisa agendamentos de negócio |
| POST | `/NegocioAgendamentos/ListPendentes/{id}` | Listar pendentes |

---

## 18. Estoque / Compras / Produtos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Estoque/FornecedoresList` | Lista de fornecedores |
| POST | `/Estoque/ProdutosList` | Lista de produtos |
| POST | `/Estoque/InventarioIntro` | Inventário |
| POST | `/Estoque/ComprasOrdensList` | Ordens de compra |
| POST | `/Estoque/RequisicoesProdutosList` | Requisições |
| POST | `/Estoque/ProtesesIntro` | Gestão de próteses |
| POST | `/Fornecedores/ShowPesquisa` | Pesquisa fornecedores |
| POST | `/Fornecedores/ShowSearchDialog` | Dialog de busca |
| POST | `/Produtos/ShowPesquisa` | Pesquisa de produtos |
| POST | `/Produtos/ShowPesquisaLotes` | Pesquisa de lotes |
| POST | `/Produtos/ShowPesquisaInventario` | Pesquisa inventário |
| POST | `/Compras/ShowPesquisa` | Pesquisa de compras |
| POST | `/ComprasOrdens/ListOfMonth?Data={data}` | Ordens do mês |
| POST | `/ComprasOrdens/ListAguardandoAutorizacao` | Aguardando autorização |
| POST | `/ProdutosSaidas/ShowPesquisa` | Pesquisa saídas |
| POST | `/ProdutosRequisicoes/ListFromSituacao/{id}` | Requisições por situação |
| POST | `/ProdutosRequisicoes/ShowPesquisa` | Pesquisa requisições |
| POST | `/Patrimonios/ShowPesquisa` | Pesquisa patrimônios |

---

## 19. Próteses

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/ProteseSolicitacaoEventos/ListData?filtro={f}&Data={data}` | Eventos de solicitação |
| POST | `/ProteseSolicitacoes/ListPendentes` | Solicitações pendentes |

---

## 20. SMS / Mensagens

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/SMS/GetRecebimentos?Mala={bool}&List={bool}` | Recebimentos SMS |
| POST | `/SMS/ShowPesquisa` | Pesquisa SMS |
| POST | `/SMS/ShowSMSDialogContratarPacotes` | Contratar pacotes SMS |
| POST | `/SMS/ShowSMSDialogContratarPayment/{id}` | Pagamento pacote SMS |
| POST | `/SMS/ShowSMSDialogStatus` | Status SMS |

---

## 21. Lembretes / Anotações / Retornos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Lembretes/ListPendentes` | Lembretes pendentes |
| POST | `/Lembretes/Concluir/` | Concluir lembrete |
| POST | `/Lembretes/Itens` | Itens de lembretes |
| POST | `/Lembretes/RemoverAllById/` | Remover lembretes |
| POST | `/Lembretes/SalvarItem/` | Salvar lembrete |
| POST | `/ConsumidorAnotacoes/GetLembretes` | Lembretes de pacientes |
| POST | `/ConsumidorRetornos/GetLembretes` | Lembretes de retornos |
| POST | `/ConsumidorRetornos/ListResolvidosData?Data={data}` | Retornos resolvidos |
| POST | `/ConsumidorRetornos/ListPendentes` | Retornos pendentes |

---

## 22. Avaliação / Satisfação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/AvaliacaoCliente/AvaliacaoMes?PreviousMonths={n}` | Avaliação por mês |

---

## 23. Campanhas / Promoções

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Campanhas/ListAtivos` | Campanhas ativas |
| POST | `/Promocoes/RegistrarCiente/{id}` | Registrar ciência |
| POST | `/Promocoes/RegistrarRejeicao/{id}` | Registrar rejeição |
| POST | `/Promocoes/RegistrarInteresse/{id}` | Registrar interesse |

---

## 24. Transações / Cartões

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Transacoes/ShowCartaoCreditoSelect/{tituloID}` | Selecionar cartão |
| POST | `/Transacoes/ShowCartaoCreditoEdit/{tituloID}` | Editar cartão |
| POST | `/Transacoes/RemoverCartao/{cartaoID}` | Remover cartão |

---

## 25. Contas Bancárias

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/ContasBancarias/ListBancos` | Listar bancos |
| POST | `/ContaBancariaTarifas/List` | Listar tarifas |

---

## 26. Tabelas e Índices

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/TabelaPrecos/List` | Listar tabelas de preços |
| POST | `/IndicesPreco/List?Year={ano}` | Índices de preço |
| POST | `/PlanoContas/ListContasRecebimentos` | Plano de contas |
| POST | `/CentroCustos/List?TipoID={id}` | Centros de custo |

---

## 27. TISS (Convênios)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/TissLotes/ShowPesquisa` | Pesquisa lotes TISS |
| POST | `/TissGuias/ShowPesquisa` | Pesquisa guias TISS |

---

## 28. Feriados / Ponto Eletrônico

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Feriados/List?Year={ano}` | Listar feriados |
| POST | `/PontoEletronico/ShowCarregarFonteDados` | Carregar fonte de dados |

---

## 29. Licenças / WebSite / Integração

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Licencas/ViewDadosLicencaCliente` | Dados da licença |
| POST | `/WebSite/ViewDadosPrincipais/{id}` | Dados do website |
| POST | `/Integracao/ViewIntegracao/?integradorID={id}` | Integração (ex: Cloudia) |

---

## 30. Salas / Pânico / Regras

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Salas/List` | Listar salas |
| POST | `/Panico/ViewConfiguracoes` | Configurações botão de pânico |
| POST | `/RegrasContratosOrcamentos/List` | Regras de contratos/orçamentos |

---

## 31. Corpo / Odontograma / Receitas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/CorpoView/LoadItems?Id=` | Carregar itens do corpo |
| POST | `/CorpoView/RemoveItem/` | Remover item |
| POST | `/CorpoView/SaveItem/` | Salvar item |
| POST | `/SituacaoFisica/LoadSituacao/{id}?OrtoFacial={bool}` | Situação física |
| POST | `/Receitas/CadastrarPrescricaoMemed/` | Cadastrar prescrição Memed |
| GET | `/co/Arcada3d` | Arcada 3D |

---

## 32. Z.AI (Assistente Virtual)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/Zai/EditarMensagem` | Editar mensagem Z.AI |
| POST | `/Zai/ExcluirMensagem` | Excluir mensagem Z.AI |

---

## 33. Log / Releases / Print

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/LogReleases/LogAtualizacoesUsuario` | Log de atualizações |
| GET | `/Print/Shell` | Shell de impressão |

---

## 34. Upload / Server

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/server/upload` | Upload de arquivos |

---

## 35. SignalR Hub - chatHub

**Conexão**: `https://hub.aplicativo.net/signalr`

### Server Methods (chamadas do cliente para o server)
| Método | Descrição |
|--------|-----------|
| `connect` | Conectar ao hub |
| `send` | Enviar mensagem |
| `sendSMS` | Enviar SMS |
| `confirmar` | Confirmar mensagem |
| `startTyping` | Indicar digitação |
| `stopTyping` | Parar indicação de digitação |
| `addAgendamentoHoje` | Adicionar agendamento hoje |
| `addAmbiente` | Adicionar ambiente |
| `addSalaEspera` | Adicionar à sala de espera |
| `addChamadoEmAberto` | Adicionar chamado em aberto |
| `removeSalaEspera` | Remover da sala de espera |
| `removeChamadoEmAberto` | Remover chamado em aberto |
| `removeFluxoAgendados` | Remover do fluxo agendados |
| `removeFluxoConsultorios` | Remover do fluxo consultórios |
| `removeMonitor` | Remover do monitor |
| `atendimentoChamadaMedico` | Chamada médico |
| `atendimentoChamadaRegistrada` | Chamada registrada |
| `chamarAvaliacaoChamado` | Chamar avaliação |
| `chamarByMonitor` | Chamar via monitor |
| `leaveEquipe` | Sair da equipe |
| `panicoAcionado` | Pânico acionado |
| `recebidoBot` | Recebido via bot |

### Client Methods (server para o cliente)
| Método | Descrição |
|--------|-----------|
| `onReconnected` | Reconectado |
| `joinEquipe` | Entrou na equipe |
| `leaveEquipe` | Saiu da equipe |
| `addSalaEspera` | Paciente na sala de espera |
| `removeSalaEspera` | Paciente saiu da espera |
| `novoChamadoEmAberto` | Novo chamado aberto |
| `removeChamadoEmAberto` | Chamado removido |
| `addAgendamentoHoje` | Novo agendamento hoje |
| `removeFluxoConsultorios` | Removido de consultórios |
| `removeFluxoAgendados` | Removido de agendados |
| `atendimentoChamadaMedico` | Chamada médico |
| `atendimentoChamadaRegistrada` | Chamada registrada |
| `chamarAvaliacaoChamado` | Chamar avaliação |
| `recebidoBot` | Mensagem recebida via bot |
| `recebido` | Mensagem recebida |
| `enviado` | Mensagem enviada |
| `confirmado` | Mensagem confirmada |
| `startTyping` | Digitando |
| `stopTyping` | Parou de digitar |
| `progressSendMessage` | Progresso envio |
| `progressSendProgress` | Progresso |
| `progressCompleted` | Envio completo |

---

## Resumo

- **Total de endpoints REST identificados**: ~130+
- **Controllers ASP.NET MVC**: Admin, Home, Plataforma, Atendimentos, Agenda, Agendamento, AgendamentosEspera, Pacientes, Paciente, Pessoa, Cliente, Clientes, Equipe, Financeiro, Recebiveis, Recebidos, Exigiveis, Pagos, FluxoCaixa, Conciliacoes, Comissionamentos, ControleBoletos, ControleBoletosRecebimentos, ControleBoletosResgates, ControleBoletosCashback, ControleBoletosAntecipacoes, NotasFiscais, Contrato, ContratoItens, ContratoEventos, Orcamento, Negocios, NegocioAgendamentos, Estoque, Fornecedores, Produtos, ProdutosSaidas, ProdutosRequisicoes, Patrimonios, Compras, ComprasOrdens, ProteseSolicitacaoEventos, ProteseSolicitacoes, SMS, Lembretes, ConsumidorAnotacoes, ConsumidorRetornos, AvaliacaoCliente, Campanhas, Promocoes, Transacoes, ContasBancarias, ContaBancariaTarifas, TabelaPrecos, IndicesPreco, PlanoContas, CentroCustos, TissLotes, TissGuias, Feriados, PontoEletronico, Licencas, WebSite, Integracao, Salas, Panico, RegrasContratosOrcamentos, CorpoView, SituacaoFisica, Receitas, Zai, LogReleases, Print
- **SignalR Hub**: chatHub com 22 server methods e 21 client methods
- **Hub externo**: `hub.aplicativo.net`
