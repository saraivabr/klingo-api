"""
Klingo API Client - Wrapper completo para o sistema Klingo (IRB Prime Care)
===========================================================================

Uso básico:
    from klingo_api import KlingoAPI

    api = KlingoAPI(domain="irb")
    api.login("USUARIO", "SENHA")

    # Buscar pacientes
    pacientes = api.pacientes.buscar("João")

    # Listar agendas do dia
    agendas = api.agendas.listar(data="2026-02-18")

    # Criar marcação
    api.agendas.agendar(id_paciente=123, id_medico=456, data="2026-02-20", hora="10:00")
"""

import requests
from datetime import datetime, date
from typing import Any, Optional, Union


class KlingoAPIError(Exception):
    """Exceção para erros da API Klingo."""
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class _BaseModule:
    """Classe base para todos os módulos da API."""

    def __init__(self, client: "KlingoAPI"):
        self._client = client

    def _aql(self, name: str, parms: dict = None, id_alias: str = "item",
             action: str = None, page: int = None, configs: list = None,
             lon: str = None) -> Any:
        return self._client._aql(name, parms, id_alias, action, page, configs, lon)

    def _aql_multi(self, queries: list) -> dict:
        return self._client._aql_multi(queries)


# ============================================================================
# MÓDULO: PACIENTES
# ============================================================================
class PacientesModule(_BaseModule):
    """Gerenciamento de pacientes."""

    def buscar(self, search: str = "", page: int = 1, **filtros) -> dict:
        """Busca pacientes por nome, CPF, etc."""
        parms = {"search": search, "page": page, **filtros}
        return self._aql("pacientes.index", parms, "lista", action="pacientes.index")

    def detalhar(self, id_pessoa: int) -> dict:
        """Obtém detalhes completos de um paciente.

        Args:
            id_pessoa: ID da pessoa (campo id_pessoa retornado na busca)
        """
        return self._aql("pacientes.show", {"id": id_pessoa}, "item", action="pacientes.show")

    def criar(self, dados: dict) -> dict:
        """Cria um novo paciente.

        Args:
            dados: dict com campos como st_nome, st_cpf, dt_nascimento,
                   st_sexo, st_telefone, st_email, etc.
        """
        return self._aql("pacientes.store", dados, "item", action="pacientes.store")

    def atualizar(self, id_pessoa: int, dados: dict) -> dict:
        """Atualiza dados de um paciente existente.

        Args:
            id_pessoa: ID da pessoa (campo id_pessoa retornado na busca)
        """
        dados["id"] = id_pessoa
        return self._aql("pacientes.store", dados, "item", action="pacientes.store")

    def retornos(self, id_pessoa: int) -> dict:
        """Lista retornos de um paciente.

        Args:
            id_pessoa: ID da pessoa (campo id_pessoa retornado na busca)
        """
        return self._aql("pacientes.retornos", {"id_paciente": id_pessoa}, "lista")

    def etnias(self) -> dict:
        """Lista etnias disponíveis para cadastro de pacientes."""
        return self._aql("pacientes.etnias", {}, "lista")


# ============================================================================
# MÓDULO: AGENDAS / MARCAÇÕES
# ============================================================================
class AgendasModule(_BaseModule):
    """Gerenciamento de agendas e marcações."""

    def listar(self, data: str = None, medico: str = "", especialidade: str = "",
               turno: str = "G", status: str = "T", unidade_operacao: int = 1,
               page: int = None, **filtros) -> dict:
        """Lista agendas do dia.

        Args:
            data: Data no formato YYYY-MM-DD (padrão: hoje)
            medico: ID ou nome do médico
            especialidade: Filtro por especialidade
            turno: G=Geral, M=Manhã, T=Tarde, N=Noite
            status: T=Todos, A=Agendado, C=Confirmado, etc.
        """
        if data is None:
            data = date.today().isoformat()
        parms = {
            "data": data, "turno": turno, "medico": medico,
            "medicos": None, "group": "none", "livres": 0,
            "status": status, "especialidade": especialidade,
            "unidade_operacao": unidade_operacao, "faixa_hora": "D",
            "recepcao": "", "page": page, "search": None,
            "view_status": "", "id_atendimento": None,
            "id_fila_laudo": "", "tipo_proced": "T",
            "editados": False, **filtros
        }
        return self._aql("agendas.index", parms, "lista", action="agendas.index", page=page or 1)

    def agendar(self, dados: dict) -> dict:
        """Cria um novo agendamento.

        Args:
            dados: dict com id_paciente, id_medico, data, hora,
                   id_procedimento, id_operadora, etc.
        """
        return self._aql("agendas.store", dados, "item", action="agendas.store")

    def cancelar(self, id_agenda: int, id_motivo: int = None) -> dict:
        """Cancela um agendamento."""
        parms = {"id": id_agenda}
        if id_motivo:
            parms["id_motivo"] = id_motivo
        return self._aql("agendas.destroy", parms, "item")

    def reservar(self, dados: dict) -> dict:
        """Reserva um horário na agenda."""
        return self._aql("agendas.reservar", dados, "item", action="agendas.reservar")

    def liberar_reservas(self, ids: list) -> dict:
        """Libera reservas de horários."""
        return self._aql("agendas.liberar_reservas", {"ids": ids}, "item")

    def recorrencia(self, dados: dict) -> dict:
        """Cria agendamento recorrente."""
        return self._aql("agendas.store", dados, "item", action="agendas.recorrencia")

    def horarios_medico(self, id_medico: int, data: str = None, id_procedimento: int = None) -> dict:
        """Obtém horários disponíveis de um médico.

        Args:
            id_medico: ID da pessoa do médico (campo id_pessoa)
            data: Data no formato YYYY-MM-DD (padrão: hoje)
            id_procedimento: ID do procedimento (obrigatório pela API)
        """
        if data is None:
            data = date.today().isoformat()
        parms = {"id_medico": id_medico, "data": data}
        if id_procedimento:
            parms["id_procedimento"] = id_procedimento
        return self._aql("medicos.horarios", parms, "item")


# ============================================================================
# MÓDULO: MARCAÇÕES
# ============================================================================
class MarcacoesModule(_BaseModule):
    """Gerenciamento de marcações (agendamentos confirmados)."""

    def stats(self, para_marcacao: bool = True) -> dict:
        """Obtém estatísticas de marcações."""
        return self._aql("marcacoes.stats", {"para_marcacao": para_marcacao}, "lista",
                         action="marcacoes.stats")

    def listar(self, id_paciente: int, **filtros) -> dict:
        """Lista marcações de um paciente.

        Args:
            id_paciente: ID da pessoa do paciente (obrigatório)
        """
        return self._aql("marcacoes.index", {"id_paciente": id_paciente, **filtros}, "lista")

    def detalhar(self, id_marcacao: int) -> dict:
        """Obtém detalhes de uma marcação.

        Args:
            id_marcacao: ID da marcação (campo id_marcacao)
        """
        return self._aql("marcacoes.show", {"id": id_marcacao}, "item", action="marcacoes.show")

    def detalhar_completo(self, id_marcacao: int, guia_tiss: bool = False,
                          foto: bool = True) -> dict:
        """Obtém marcação com dados completos (atendimento, procedimentos, pagamento).

        Útil para carregar dados clínicos (anamnese, receitas, requisições, laudos).
        """
        return self._aql("marcacoes.show", {
            "id": id_marcacao, "para_atendimento": True,
            "lancamento_procedimento": True, "foto": foto,
            "buscar_outras": True, "guia_tiss": guia_tiss
        }, "item", action="marcacoes.show")

    def iniciar(self, id_marcacao: int) -> dict:
        """Inicia uma marcação (check-in)."""
        return self._aql("marcacoes.iniciar", {"id": id_marcacao}, "item", action="marcacoes.iniciar")


# ============================================================================
# MÓDULO: ATENDIMENTOS
# ============================================================================
class AtendimentosModule(_BaseModule):
    """Gerenciamento de atendimentos."""

    def criar(self, dados: dict) -> dict:
        """Cria um novo atendimento."""
        return self._aql("atendimentos.store", dados, "item", action="atendimentos.store")

    def detalhar(self, id_atendimento: int) -> dict:
        """Obtém detalhes de um atendimento."""
        return self._aql("atendimentos.show", {"id": id_atendimento}, "item",
                         action="atendimentos.show")

    def chamar(self, id_atendimento: int) -> dict:
        """Chama paciente para atendimento."""
        return self._aql("atendimentos.chamar", {"id": id_atendimento}, "item")

    def iniciar(self, id_atendimento: int) -> dict:
        """Inicia o atendimento."""
        return self._aql("atendimentos.iniciar", {"id": id_atendimento}, "item")

    def finalizar(self, id_atendimento: int, dados: dict = None) -> dict:
        """Finaliza o atendimento."""
        parms = {"id": id_atendimento}
        if dados:
            parms.update(dados)
        return self._aql("atendimentos.finalizar", parms, "item")


# ============================================================================
# MÓDULO: MÉDICOS
# ============================================================================
class MedicosModule(_BaseModule):
    """Gerenciamento de médicos/profissionais."""

    def listar(self, ativos: bool = True, **filtros) -> dict:
        """Lista médicos cadastrados."""
        parms = {"ativos": ativos, **filtros}
        return self._aql("medicos.index", parms, "lista", action="medicos.index")

    def horarios(self, id_medico: int, data: str = None, id_procedimento: int = None) -> dict:
        """Obtém horários de um médico.

        Args:
            id_medico: ID da pessoa do médico (campo id_pessoa)
            data: Data no formato YYYY-MM-DD (padrão: hoje)
            id_procedimento: ID do procedimento (obrigatório pela API)
        """
        if data is None:
            data = date.today().isoformat()
        parms = {"id_medico": id_medico, "data": data}
        if id_procedimento:
            parms["id_procedimento"] = id_procedimento
        return self._aql("medicos.horarios", parms, "item")


# ============================================================================
# MÓDULO: ESPECIALIDADES
# ============================================================================
class EspecialidadesModule(_BaseModule):
    """Gerenciamento de especialidades."""

    def listar(self, ativadas: bool = True) -> dict:
        """Lista especialidades."""
        return self._aql("especialidades.index", {"ativadas": ativadas}, "lista",
                         action="especialidades.index")


# ============================================================================
# MÓDULO: OPERADORAS (Convênios)
# ============================================================================
class OperadorasModule(_BaseModule):
    """Gerenciamento de operadoras/convênios."""

    def listar(self, **filtros) -> dict:
        """Lista operadoras/convênios."""
        return self._aql("operadoras.index", filtros, "lista", action="operadoras.index")

    def detalhar(self, id_operadora: int) -> dict:
        """Obtém detalhes de uma operadora.

        Args:
            id_operadora: ID da operadora (campo id_operadora da listagem)
        """
        return self._aql("operadoras.show", {"id": id_operadora}, "item", action="operadoras.show")


# ============================================================================
# MÓDULO: FINANCEIRO
# ============================================================================
class FinanceiroModule(_BaseModule):
    """Gerenciamento financeiro."""

    def configs(self) -> dict:
        """Obtém configurações do financeiro."""
        return self._aql("financeiro.configs", {}, "item", action="financeiro.configs")

    def lancamentos_tags(self) -> dict:
        """Lista tags de lançamentos."""
        return self._aql("lancamentos.tags", {}, "item", action="lancamentos.tags")

    def formas_pagamento(self) -> dict:
        """Lista formas de pagamento."""
        return self._aql("forma_pagamentos.index", {}, "lista", action="forma_pagamentos.index")

    def impostos(self, ativos: bool = True) -> dict:
        """Lista impostos configurados."""
        return self._aql("impostos.index", {"where": {"fl_ativo": ativos}}, "item",
                         action="impostos.index")


# ============================================================================
# MÓDULO: PAGAMENTOS
# ============================================================================
class PagamentosModule(_BaseModule):
    """Gerenciamento de pagamentos."""

    def pode_realizar(self, id_atendimento: int) -> dict:
        """Verifica se pode realizar pagamento."""
        return self._aql("pagamentos.pode_realizar_pagamento",
                         {"id_atendimento": id_atendimento}, "item")

    def adiantamentos(self, id_paciente: int) -> dict:
        """Lista adiantamentos de um paciente."""
        return self._aql("pagamentos.adiantamentos", {"id_paciente": id_paciente}, "item")

    def responsaveis(self, id_atendimento: int) -> dict:
        """Lista responsáveis pelo pagamento."""
        return self._aql("pagamentos.responsaveis", {"id_atendimento": id_atendimento}, "item")


# ============================================================================
# MÓDULO: FATURAMENTO
# ============================================================================
class FaturamentoModule(_BaseModule):
    """Gerenciamento de faturamento."""

    def classes_procedimento(self) -> dict:
        """Lista classes de procedimento."""
        return self._aql("classe_procedimentos.index", {}, "lista",
                         action="classe_procedimentos.index")

    def tabelas_versao(self, atualizacao_preco: bool = True) -> dict:
        """Lista versões de tabelas."""
        return self._aql("tabela_versaos.index", {"atualizacao_preco": atualizacao_preco},
                         "lista", action="tabela_versaos.index")

    def tiss_gerar_json(self, dados: dict) -> dict:
        """Gera JSON TISS."""
        return self._aql("tiss.gerar_json", dados, "item", action="tiss.gerar_json")


# ============================================================================
# MÓDULO: ESTOQUE / SUPRIMENTOS
# ============================================================================
class SuprimentosModule(_BaseModule):
    """Gerenciamento de estoque e suprimentos."""

    def tipos_movimentacao(self, outras: bool = True) -> dict:
        """Lista tipos de movimentação de estoque."""
        return self._aql("estoque_tipo_movimentacaos.index", {"outras": outras}, "item",
                         action="estoque_tipo_movimentacaos.index")

    def solicitacoes(self, status: str = "A", atendimento: bool = True,
                     page: int = 1, size: int = 100, **filtros) -> dict:
        """Lista solicitações de estoque."""
        parms = {
            "atendimento": atendimento, "classe": "", "status": status,
            "id_estoque_local": "", "inicio": "", "fim": "",
            "semana": "", "mes": "", "periodo": "s", "referencia": "",
            "tipo_mov": "", "search": "", "id_unidade_operacao": "",
            "id_centro_custo": "", "id_estoque_local_destino": "",
            "com_saldo": "T", "size": size, "page": page,
            "saldos": False, "atend_consolid": False, **filtros
        }
        return self._aql("estoque_solicitacoes.index", parms, "lista",
                         action="estoque_solicitacoes.index")

    def itens_tags(self) -> dict:
        """Lista tags de itens de estoque."""
        return self._aql("estoque_items.tags", {}, "item", action="estoque_items.tags")

    def locais(self) -> dict:
        """Lista locais de estoque."""
        return self._aql("estoque_locals.index", {"sup": 1}, "lista",
                         action="estoque_locals.index")


# ============================================================================
# MÓDULO: LAUDOS
# ============================================================================
class LaudosModule(_BaseModule):
    """Gerenciamento de laudos."""

    def listar(self, page: int = 1) -> dict:
        """Lista laudos (paginado)."""
        return self._aql("laudos.index", {"page": page}, "lista", page=page)

    def detalhar(self, id_laudo: int) -> dict:
        """Obtém detalhes de um laudo."""
        return self._aql("laudos.show", {"id": id_laudo}, "item")

    def filas(self, todas: bool = True) -> dict:
        """Lista filas de laudos."""
        return self._aql("fila_laudos.index", {"todas": todas}, "item",
                         action="fila_laudos.index")

    def fila_detalhar(self, id_fila: int) -> dict:
        """Obtém detalhes de uma fila de laudos."""
        return self._aql("fila_laudos.show", {"id": id_fila}, "fila")

    def status_laudos(self) -> dict:
        """Lista status possíveis de laudos."""
        return self._aql("status_laudos.index", {}, "lista", action="status_laudos.index")


# ============================================================================
# MÓDULO: AUTORIZAÇÕES
# ============================================================================
class AutorizacoesModule(_BaseModule):
    """Gerenciamento de autorizações."""

    def filas(self) -> dict:
        """Lista filas de autorização."""
        return self._aql("fila_autorizacoes.index", {}, "lista",
                         action="fila_autorizacoes.index")

    def solicitacoes(self) -> dict:
        """Lista solicitações de autorização."""
        return self._aql("solicitacao_autorizacoes.index", {}, "lista")


# ============================================================================
# MÓDULO: CRM / LEADS
# ============================================================================
class CRMModule(_BaseModule):
    """Gerenciamento de CRM e leads."""

    def filas_leads(self, todas: bool = True) -> dict:
        """Lista filas de leads."""
        return self._aql("fila_leads.index", {"todas": todas}, "item",
                         action="fila_leads.index")

    def orcamentos(self, **filtros) -> dict:
        """Lista orçamentos."""
        return self._aql("orcamentos.index", filtros, "lista")


# ============================================================================
# MÓDULO: RELATÓRIOS
# ============================================================================
class RelatoriosModule(_BaseModule):
    """Gerenciamento de relatórios."""

    def listar(self) -> dict:
        """Lista relatórios disponíveis."""
        return self._aql("relatorios.index", {}, "lista")

    def executar(self, id_relatorio: int, parms: dict = None) -> dict:
        """Executa um relatório."""
        p = {"id": id_relatorio}
        if parms:
            p.update(parms)
        return self._aql("relatorios.show", p, "item", action="relatorio.show")

    def pagina(self, pagina: str) -> dict:
        """Obtém relatórios de uma página específica."""
        return self._aql("relatorios.pagina", {"pagina": pagina}, "item",
                         action="relatorios.pagina")

    def dashboards(self) -> dict:
        """Lista dashboards disponíveis."""
        return self._aql("dashboards.lista", {}, "lista")


# ============================================================================
# MÓDULO: PEP (Prontuário Eletrônico)
# ============================================================================
class PEPModule(_BaseModule):
    """Prontuário Eletrônico do Paciente."""

    def carregar(self, id_atendimento: int) -> dict:
        """Carrega o PEP de um atendimento."""
        return self._aql("pep.load", {"id_atendimento": id_atendimento}, "item", action="pep.load")

    def historico(self, id_paciente: int, tipo: str = None) -> dict:
        """Obtém histórico do PEP.

        Args:
            id_paciente: ID da pessoa do paciente (id_pessoa)
            tipo: Tipo de histórico (ex: 'atendimentos', 'exames'). Se None, usa endpoint genérico.
        """
        if tipo:
            return self._aql(f"pep.historico_{tipo}", {"id_paciente": id_paciente}, "item")
        return self._aql("pep.historico", {"id_paciente": id_paciente}, "item")

    def avulsos(self, id_paciente: int) -> dict:
        """Lista atendimentos avulsos do PEP."""
        return self._aql("pep.avulsos", {"id_paciente": id_paciente}, "item")

    def pode_avulso(self) -> dict:
        """Verifica se pode criar atendimento avulso."""
        return self._aql("pep.pode_avulso", {}, "item")

    def legado(self, id_paciente: int) -> dict:
        """Obtém registros legados do PEP de um paciente."""
        return self._aql("pep.legado", {"id_paciente": id_paciente}, "legado")

    def cancelar(self, id_atendimento: int) -> dict:
        """Cancela um registro PEP."""
        return self._aql("pep.cancelar", {"id_atendimento": id_atendimento}, "item")


# ============================================================================
# MÓDULO: CONFIGURAÇÕES
# ============================================================================
class ConfiguracoesModule(_BaseModule):
    """Configurações do sistema."""

    def listar(self, **filtros) -> dict:
        """Lista configurações."""
        return self._aql("configuracoes.index", filtros, "item")

    def obter(self, slug: str) -> dict:
        """Obtém valor de uma configuração."""
        return self._aql("configuracoes.get", {"st_slug": slug}, "item")

    def verificar(self, slug: str, valor: str = "1") -> dict:
        """Verifica se uma configuração está ativa."""
        return self._aql("configuracoes.check", {"st_slug": slug, "st_valor": valor}, "item")


# ============================================================================
# MÓDULO: USUÁRIOS / PERMISSÕES
# ============================================================================
class UsuariosModule(_BaseModule):
    """Gerenciamento de usuários e permissões."""

    def tem_permissao(self, id_acao: int) -> dict:
        """Verifica se o usuário tem permissão para uma ação.

        Args:
            id_acao: ID numérico da ação
        """
        return self._aql("usuarios.tem_permissao", {"id_acao": id_acao}, "item")

    def tem_permissao_acesso(self, resource_id: int) -> dict:
        """Verifica permissão de acesso a um recurso.

        Args:
            resource_id: ID numérico do recurso
        """
        return self._aql("usuarios.tem_permissao_acesso",
                         {"resource_id": resource_id, "block_vazio": True}, "item")

    def listar(self) -> dict:
        """Lista usuários."""
        return self._aql("usuarios.index", {}, "lista")


# ============================================================================
# MÓDULO: CADASTROS AUXILIARES
# ============================================================================
class CadastrosModule(_BaseModule):
    """Cadastros auxiliares do sistema."""

    def cep(self, cep: str) -> dict:
        """Busca endereço por CEP."""
        return self._aql("cep.show", {"cep": cep}, "item")

    def estados(self) -> dict:
        """Lista estados."""
        return self._aql("estados.index", {}, "lista")

    def cidades(self, id_estado: int = None) -> dict:
        """Lista cidades."""
        parms = {"id_estado": id_estado} if id_estado else {}
        return self._aql("cidades.index", parms, "lista")

    def cids(self, search: str = "") -> dict:
        """Busca CIDs."""
        return self._aql("cids.index", {"search": search}, "lista")

    def conselhos(self) -> dict:
        """Lista conselhos profissionais."""
        return self._aql("conselhos.index", {}, "lista")

    def bancos(self) -> dict:
        """Lista bancos."""
        return self._aql("bancos.index", {}, "lista")

    def motivos(self) -> dict:
        """Lista motivos (cancelamento, etc)."""
        return self._aql("motivos.index", {}, "lista")

    def sinalizadores(self, ativos: bool = True) -> dict:
        """Lista sinalizadores de atendimento."""
        return self._aql("sinalizadores.index", {"ativos": ativos}, "lista",
                         action="sinalizadores.index")

    def procedimentos(self, search: str = "") -> dict:
        """Busca procedimentos."""
        return self._aql("procedimentos.index", {"search": search}, "lista")

    def buscar_procedimento(self, search: str) -> dict:
        """Busca procedimento por nome/código."""
        return self._aql("procedimentos.index", {"search": search}, "lista",
                         action="procedimentos.index")

    def materiais(self, search: str = "") -> dict:
        """Lista materiais."""
        return self._aql("materiais.index", {"search": search}, "lista")

    def medicamentos(self, search: str = "") -> dict:
        """Lista medicamentos."""
        return self._aql("medicamentos.index", {"search": search}, "lista")

    def planos(self) -> dict:
        """Lista planos."""
        return self._aql("planos.index", {}, "lista")

    def buscar_plano(self, search: str) -> dict:
        """Busca plano por nome."""
        return self._aql("planos.index", {"search": search}, "lista")

    def modelos(self) -> dict:
        """Lista modelos de documentos."""
        return self._aql("modelos.index", {}, "lista")

    def tipo_arquivos(self, model: str = "marcacao", ativos: bool = True) -> dict:
        """Lista tipos de arquivo."""
        return self._aql("tipo_arquivos.index",
                         {"fl_ativo": 1 if ativos else 0, "model": model}, "lista",
                         action="tipo_arquivos.index")

    def unidades(self) -> dict:
        """Lista unidades."""
        return self._aql("unidades.index", {}, "lista")

    def unidades_operacao(self) -> dict:
        """Lista unidades de operação."""
        return self._aql("unidade_operacaos.index", {}, "lista")

    def locais(self) -> dict:
        """Lista locais de atendimento."""
        return self._aql("locals.index", {}, "lista")

    def tipo_logradouros(self) -> dict:
        """Lista tipos de logradouro."""
        return self._aql("tipo_logradouros.index", {}, "lista")

    def procedimento_grupos(self) -> dict:
        """Lista grupos de procedimento."""
        return self._aql("procedimento_grupos.index", {}, "lista")


# ============================================================================
# MÓDULO: ATENDIMENTO - DETALHES (Instruções, Lista Espera, etc)
# ============================================================================
class AtendimentoDetalhesModule(_BaseModule):
    """Detalhes complementares de atendimentos."""

    def instrucoes_plano(self, id_plano: int, id_paciente: int = None,
                         id_unidade_operacao: int = None) -> dict:
        """Obtém instruções de um plano/convênio."""
        parms = {"id_plano": id_plano}
        if id_paciente:
            parms["id_paciente"] = id_paciente
        if id_unidade_operacao:
            parms["id_unidade_operacao"] = id_unidade_operacao
        return self._aql("instrucoes.show", parms, "plano", action="instrucoes.show")

    def instrucoes_procedimento(self, id_plano: int, id_procedimento: int,
                                id_paciente: int = None, id_medico: int = None) -> dict:
        """Obtém instruções de um procedimento dentro de um plano."""
        parms = {"id_plano": id_plano, "id_procedimento": id_procedimento}
        if id_paciente:
            parms["id_paciente"] = id_paciente
        if id_medico:
            parms["id_medico"] = id_medico
        return self._aql("instrucoes.show", parms, "proced", action="instrucoes.show")

    def lista_espera(self) -> dict:
        """Lista pacientes na lista de espera."""
        return self._aql("lista_esperas.index", {}, "lista")

    def tipo_atendimentos(self) -> dict:
        """Lista tipos de atendimento."""
        return self._aql("tipo_atendimentos.index", {}, "lista")

    def recepcoes(self) -> dict:
        """Lista recepções."""
        return self._aql("recepcaos.index", {}, "lista")

    def textos_padrao(self) -> dict:
        """Lista textos padrão."""
        return self._aql("textos_padrao.index", {}, "lista")

    def resultados(self) -> dict:
        """Lista resultados."""
        return self._aql("resultados.index", {}, "lista")

    def observacao_tipos(self) -> dict:
        """Lista tipos de observação."""
        return self._aql("observacao_tipos.index", {}, "lista")

    def contato_status(self) -> dict:
        """Lista status de contato."""
        return self._aql("contato_status.index", {}, "lista")

    def desconto_tipos(self) -> dict:
        """Lista tipos de desconto."""
        return self._aql("desconto_tipos.index", {}, "lista")

    def centro_cirurgicos(self) -> dict:
        """Lista centros cirúrgicos."""
        return self._aql("centro_cirurgicos.index", {}, "lista")


# ============================================================================
# MÓDULO: MÉDICOS - DETALHES (Unidades, Procedimentos, Solicitantes)
# ============================================================================
class MedicosDetalhesModule(_BaseModule):
    """Detalhes complementares de médicos."""

    def unidades(self) -> dict:
        """Lista médicos por unidade."""
        return self._aql("medico_unidades.index", {}, "lista")

    def procedimento_unidades(self) -> dict:
        """Lista procedimentos por médico/unidade."""
        return self._aql("medico_procedimento_unidades.index", {}, "lista")

    def solicitantes(self) -> dict:
        """Lista médicos solicitantes."""
        return self._aql("medico_solicitantes.index", {}, "lista")


# ============================================================================
# MÓDULO: TABELAS DE REFERÊNCIA (Brasíndice, SIMPRO, TUSS, etc)
# ============================================================================
class TabelasReferenciaModule(_BaseModule):
    """Tabelas de referência para faturamento e precificação."""

    def brasindices(self) -> dict:
        """Lista itens da tabela Brasíndice."""
        return self._aql("brasindices.index", {}, "lista")

    def simpros(self) -> dict:
        """Lista itens da tabela SIMPRO."""
        return self._aql("simpros.index", {}, "lista")

    def codigo_tabelas(self) -> dict:
        """Lista códigos de tabela."""
        return self._aql("codigo_tabelas.index", {}, "lista")

    def codigo_despesa(self) -> dict:
        """Lista códigos de despesa."""
        return self._aql("codigo_despesa.index", {}, "lista")

    def grau_participacoes(self) -> dict:
        """Lista graus de participação."""
        return self._aql("grau_participacoes.index", {}, "lista")

    def taxas(self) -> dict:
        """Lista taxas."""
        return self._aql("taxas.index", {}, "lista")

    def moedas(self) -> dict:
        """Lista moedas."""
        return self._aql("moedas.index", {}, "lista")

    def motivos_glosa(self, internos: bool = None) -> dict:
        """Lista motivos de glosa.

        Args:
            internos: True=internos, False=externos, None=todos
        """
        parms = {}
        if internos is not None:
            parms["where"] = {"fl_interno": 1 if internos else 0}
        return self._aql("motivos_glosa.index", parms, "lista")

    def unidade_medidas(self) -> dict:
        """Lista unidades de medida."""
        return self._aql("unidade_medidas.index", {}, "lista")


# ============================================================================
# MÓDULO: ESTOQUE - DETALHES (Grupos, Itens, Lotes, Consumo)
# ============================================================================
class EstoqueDetalhesModule(_BaseModule):
    """Detalhes complementares de estoque."""

    def grupos(self) -> dict:
        """Lista grupos de estoque."""
        return self._aql("estoque_grupos.index", {}, "lista")

    def itens(self, **filtros) -> dict:
        """Lista itens de estoque."""
        return self._aql("estoque_items.index", filtros, "lista")

    def lotes(self) -> dict:
        """Lista lotes de estoque."""
        return self._aql("estoque_lotes.index", {}, "lista")

    def consumo(self) -> dict:
        """Lista itens de consumo."""
        return self._aql("consumo.index", {}, "lista")

    def ident_paciente_consumo(self, data: str, unidade: int = 1,
                                devolucao: int = 0) -> dict:
        """Identifica pacientes com consumo."""
        return self._aql("estoque.ident_paciente_consumo",
                         {"data": data, "unidade": unidade, "devolucao": devolucao}, "item")

    def tipo_etiqueta_amostras(self) -> dict:
        """Lista tipos de etiqueta de amostra."""
        return self._aql("tipo_etiqueta_amostras.index", {}, "lista")

    def rota_etiquetas(self) -> dict:
        """Lista rotas de etiquetas."""
        return self._aql("rota_etqs.index", {}, "lista")


# ============================================================================
# MÓDULO: SUS
# ============================================================================
class SUSModule(_BaseModule):
    """Endpoints específicos do SUS."""

    def motivo_saidas(self) -> dict:
        """Lista motivos de saída SUS."""
        return self._aql("sus.motivo_saidas", {}, "lista")


# ============================================================================
# MÓDULO: OPERADORAS - DETALHES
# ============================================================================
class OperadorasDetalhesModule(_BaseModule):
    """Detalhes complementares de operadoras."""

    def verificar_unificar_guias(self, id_operadora: int) -> dict:
        """Verifica se pode unificar guias de uma operadora."""
        return self._aql("operadoras.verificar_unificar_guias",
                         {"id_operadora": id_operadora}, "item")

    def bandeira_cartoes(self) -> dict:
        """Lista bandeiras de cartão."""
        return self._aql("bandeira_cartaos.index", {}, "lista")

    def apoiados(self) -> dict:
        """Lista apoiados."""
        return self._aql("apoiados.index", {}, "lista")

    def apoiado_origens(self) -> dict:
        """Lista origens de apoiados."""
        return self._aql("apoiado_origens.index", {}, "lista")


# ============================================================================
# MÓDULO: TAREFAS
# ============================================================================
class TarefasModule(_BaseModule):
    """Gerenciamento de tarefas."""

    def listar(self, pendentes: bool = True, minhas: bool = True) -> dict:
        """Lista tarefas."""
        return self._aql("tarefas.index",
                         {"pendentes": pendentes, "minhas": minhas, "id_medico": None}, "item",
                         action="tarefas.index")

    def grupos(self) -> dict:
        """Lista grupos de tarefas."""
        return self._aql("tarefa_grupos.index", {}, "lista")


# ============================================================================
# CLIENTE PRINCIPAL
# ============================================================================
class KlingoAPI:
    """
    Cliente principal da API Klingo.

    Uso:
        api = KlingoAPI(domain="irb")
        api.login("USUARIO", "SENHA")

        # Acessar módulos
        api.pacientes.buscar("João")
        api.agendas.listar()
        api.medicos.listar()
    """

    BASE_URL = "https://api.klingo.app/api"

    def __init__(self, domain: str = "irb", unidade: int = 1, portal: int = 0):
        self.domain = domain
        self.unidade = unidade
        self.portal = portal
        self.token = None
        self.session = requests.Session()

        # Headers padrão
        self.session.headers.update({
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=utf-8",
            "X-DOMAIN": domain,
            "X-PORTAL": str(portal),
            "X-UNIDADE": str(unidade),
        })

        # Inicializar módulos
        self.pacientes = PacientesModule(self)
        self.agendas = AgendasModule(self)
        self.marcacoes = MarcacoesModule(self)
        self.atendimentos = AtendimentosModule(self)
        self.medicos = MedicosModule(self)
        self.especialidades = EspecialidadesModule(self)
        self.operadoras = OperadorasModule(self)
        self.financeiro = FinanceiroModule(self)
        self.pagamentos = PagamentosModule(self)
        self.faturamento = FaturamentoModule(self)
        self.suprimentos = SuprimentosModule(self)
        self.laudos = LaudosModule(self)
        self.autorizacoes = AutorizacoesModule(self)
        self.crm = CRMModule(self)
        self.relatorios = RelatoriosModule(self)
        self.pep = PEPModule(self)
        self.configuracoes = ConfiguracoesModule(self)
        self.usuarios = UsuariosModule(self)
        self.cadastros = CadastrosModule(self)
        self.tarefas = TarefasModule(self)
        self.atendimento_detalhes = AtendimentoDetalhesModule(self)
        self.medicos_detalhes = MedicosDetalhesModule(self)
        self.tabelas_referencia = TabelasReferenciaModule(self)
        self.estoque_detalhes = EstoqueDetalhesModule(self)
        self.sus = SUSModule(self)
        self.operadoras_detalhes = OperadorasDetalhesModule(self)

    def login(self, usuario: str, senha: str) -> dict:
        """
        Realiza login e obtém token JWT.

        Args:
            usuario: Nome de usuário
            senha: Senha

        Returns:
            dict com dados do login incluindo token
        """
        response = self.session.post(f"{self.BASE_URL}/login", json={
            "login": usuario,
            "senha": senha,
        })

        if response.status_code != 200:
            raise KlingoAPIError(
                f"Falha no login: {response.status_code}",
                status_code=response.status_code,
                response=response.json() if response.text else None
            )

        data = response.json()
        self.token = data.get("access_token") or data.get("token")
        if self.token:
            self.session.headers["Authorization"] = f"Bearer {self.token}"

        return data

    def set_token(self, token: str):
        """Define o token JWT manualmente (útil para reutilizar sessões)."""
        self.token = token
        self.session.headers["Authorization"] = f"Bearer {token}"

    def _aql(self, name: str, parms: dict = None, id_alias: str = "item",
             action: str = None, page: int = None, configs: list = None,
             lon: str = None) -> Any:
        """
        Executa uma query AQL (Application Query Language).

        Este é o método central da API Klingo. Todas as operações
        são feitas via POST para /api/aql com queries no formato AQL.

        Args:
            name: Nome da query (ex: "pacientes.index")
            parms: Parâmetros da query
            id_alias: Alias para o resultado (ex: "lista", "item")
            action: Ação para o query string ?a= (otimização de rota)
            page: Número da página para paginação
            configs: Lista de configurações extras a buscar
            lon: Cache key para dados que não mudam frequentemente
        """
        query = {"name": name, "id": id_alias}
        if parms:
            query["parms"] = parms
        if configs:
            query["configs"] = configs
        if lon is not None:
            query["lon"] = lon

        url = f"{self.BASE_URL}/aql"
        params = {}
        if action:
            params["a"] = action
        if page:
            params["page"] = page

        response = self.session.post(url, json={"q": [query]}, params=params)

        if response.status_code != 200:
            raise KlingoAPIError(
                f"Erro AQL ({name}): {response.status_code}",
                status_code=response.status_code,
                response=response.json() if response.text else None
            )

        data = response.json()

        # Detectar erros que vêm com HTTP 200 mas com status/error no body
        if isinstance(data, dict) and "status" in data and "error" in data:
            status = data["status"]
            if isinstance(status, int) and status >= 400 or isinstance(status, str) and status.isdigit() and int(status) >= 400:
                raise KlingoAPIError(
                    f"Erro AQL ({name}): {data['error']}",
                    status_code=int(status) if isinstance(status, str) else status,
                    response=data
                )

        # Extrair resultado pelo alias
        if id_alias in data:
            result = data[id_alias]
            if isinstance(result, dict) and "data" in result:
                return result["data"]
            return result

        return data

    def _aql_multi(self, queries: list) -> dict:
        """
        Executa múltiplas queries AQL em uma única requisição.

        Args:
            queries: Lista de dicts com {name, parms, id, configs, lon}

        Returns:
            dict com resultados indexados pelo id de cada query

        Exemplo:
            results = api._aql_multi([
                {"name": "medicos.index", "id": "medicos", "parms": {"ativos": True}},
                {"name": "especialidades.index", "id": "especialidades", "parms": {"ativadas": True}},
            ])
            medicos = results["medicos"]["data"]
            especialidades = results["especialidades"]["data"]
        """
        response = self.session.post(f"{self.BASE_URL}/aql", json={"q": queries})

        if response.status_code != 200:
            raise KlingoAPIError(
                f"Erro AQL multi: {response.status_code}",
                status_code=response.status_code
            )

        return response.json()

    def aql_raw(self, name: str, parms: dict = None, **kwargs) -> dict:
        """
        Executa uma query AQL raw - para endpoints que não estão mapeados nos módulos.

        Args:
            name: Nome completo da query (ex: "qualquer_entidade.qualquer_acao")
            parms: Parâmetros

        Returns:
            Resposta completa da API
        """
        return self._aql(name, parms, **kwargs)

    def upload_arquivo(self, file_path: str, id_atendimento: int = None) -> dict:
        """Faz upload de um arquivo."""
        with open(file_path, 'rb') as f:
            files = {'file': f}
            headers = {k: v for k, v in self.session.headers.items()
                       if k != 'Content-Type'}
            response = requests.post(
                f"{self.BASE_URL}/upload_arquivo_token",
                files=files,
                headers=headers,
                data={"id_atendimento": id_atendimento} if id_atendimento else {}
            )

        if response.status_code != 200:
            raise KlingoAPIError(f"Erro upload: {response.status_code}")

        return response.json()

    def download_arquivo(self, dados: dict) -> bytes:
        """Faz download de um arquivo."""
        response = self.session.post(f"{self.BASE_URL}/arq", json=dados)
        if response.status_code != 200:
            raise KlingoAPIError(f"Erro download: {response.status_code}")
        return response.content

    def modulos_acesso(self) -> dict:
        """Lista módulos que o usuário tem acesso.

        Nota: Este endpoint pode não estar disponível na API.
        Use aql_raw() para descobrir endpoints de módulos.
        """
        return self._aql("modulos.acesso", {}, "item")


# ============================================================================
# EXEMPLO DE USO
# ============================================================================
if __name__ == "__main__":
    # Inicializar
    api = KlingoAPI(domain="irb")

    # Login
    api.login("FELLIPE.SARAIVA", "FELLIPE.SARAIVA1")
    print("Login realizado com sucesso!")

    # Listar especialidades
    especialidades = api.especialidades.listar()
    print(f"\nEspecialidades: {len(especialidades)} encontradas")
    for esp in especialidades[:5]:
        print(f"  - {esp['st_especialidade']}")

    # Listar médicos
    medicos = api.medicos.listar()
    print(f"\nMédicos: {len(medicos)} encontrados")
    for med in medicos[:5]:
        print(f"  - {med['st_nome_exibicao']}")

    # Listar agendas do dia
    agendas = api.agendas.listar()
    print(f"\nAgendas de hoje carregadas com sucesso")

    # Buscar operadoras (campo PK é id_operadora)
    operadoras = api.operadoras.listar()
    print(f"\nOperadoras: {len(operadoras)} encontradas")
    for op in operadoras[:5]:
        print(f"  - {op['st_operadora']} (id={op['id_operadora']})")

    # Multi-query (buscar várias coisas de uma vez)
    results = api._aql_multi([
        {"name": "forma_pagamentos.index", "id": "formas"},
        {"name": "sinalizadores.index", "id": "sinalizadores", "parms": {"ativos": True}},
    ])
    print(f"\nMulti-query executada com sucesso")

    print("\nAPI Klingo pronta para uso!")
