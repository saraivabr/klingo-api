"""Validação completa da API Klingo v3 - Todos os endpoints descobertos"""
import json, traceback
from datetime import date, timedelta
from klingo_api import KlingoAPI, KlingoAPIError

api = KlingoAPI(domain="irb")
res = {"ok": [], "erro": [], "skip": []}

def t(nome, func, skip=False):
    if skip:
        res["skip"].append(nome)
        print(f"  ⚠️  {nome} (skip)")
        return None
    try:
        r = func()
        if r is None:
            desc = "None"
        elif isinstance(r, list):
            desc = f"{len(r)} itens"
        elif isinstance(r, dict):
            desc = f"dict({list(r.keys())[:4]})"
        elif isinstance(r, bool):
            desc = str(r)
        else:
            desc = f"{type(r).__name__}"
        res["ok"].append(f"{nome} → {desc}")
        print(f"  ✅ {nome} → {desc}")
        return r
    except Exception as e:
        res["erro"].append(f"{nome} → {e}")
        print(f"  ❌ {nome} → {e}")
        return None

hoje = date.today().isoformat()

# LOGIN
print("=" * 60)
print("LOGIN")
t("login", lambda: api.login("FELLIPE.SARAIVA", "FELLIPE.SARAIVA1"))

# PACIENTES
print("\nPACIENTES")
pacs = t("pacientes.buscar", lambda: api.pacientes.buscar("Maria"))
id_p = pacs[0]["id_pessoa"] if pacs else None
if id_p:
    t("pacientes.detalhar", lambda: api.pacientes.detalhar(id_p))
    t("pacientes.retornos", lambda: api.pacientes.retornos(id_p))
t("pacientes.etnias", lambda: api.pacientes.etnias())

# MÉDICOS
print("\nMÉDICOS")
meds = t("medicos.listar", lambda: api.medicos.listar())
id_m = meds[0]["id_pessoa"] if meds else None
if id_m:
    t("medicos.horarios", lambda: api.medicos.horarios(id_m, hoje, 2098))

# MÉDICOS DETALHES
print("\nMÉDICOS DETALHES")
t("medicos_det.unidades", lambda: api.medicos_detalhes.unidades())
t("medicos_det.procedimento_unidades", lambda: api.medicos_detalhes.procedimento_unidades())
t("medicos_det.solicitantes", lambda: api.medicos_detalhes.solicitantes())

# ESPECIALIDADES
print("\nESPECIALIDADES")
t("especialidades.listar", lambda: api.especialidades.listar())

# AGENDAS
print("\nAGENDAS")
t("agendas.listar", lambda: api.agendas.listar(data=hoje))
if id_m:
    t("agendas.horarios_medico", lambda: api.agendas.horarios_medico(id_m, hoje, 2098))

# MARCAÇÕES
print("\nMARCAÇÕES")
t("marcacoes.stats", lambda: api.marcacoes.stats())
if id_p:
    marcs = t("marcacoes.listar", lambda: api.marcacoes.listar(id_p))
    if marcs and isinstance(marcs, list) and marcs:
        id_marc = marcs[0]["id_marcacao"]
        t("marcacoes.detalhar", lambda: api.marcacoes.detalhar(id_marc))
        t("marcacoes.detalhar_completo", lambda: api.marcacoes.detalhar_completo(id_marc))

# ATENDIMENTOS
print("\nATENDIMENTOS")
if marcs and isinstance(marcs, list) and marcs and marcs[0].get("id_atendimento"):
    id_a = marcs[0]["id_atendimento"]
    t("atendimentos.detalhar", lambda: api.atendimentos.detalhar(id_a))

# ATENDIMENTO DETALHES
print("\nATENDIMENTO DETALHES")
t("atd_det.instrucoes_plano", lambda: api.atendimento_detalhes.instrucoes_plano(1))
t("atd_det.lista_espera", lambda: api.atendimento_detalhes.lista_espera())
t("atd_det.tipo_atendimentos", lambda: api.atendimento_detalhes.tipo_atendimentos())
t("atd_det.recepcoes", lambda: api.atendimento_detalhes.recepcoes())
t("atd_det.textos_padrao", lambda: api.atendimento_detalhes.textos_padrao())
t("atd_det.resultados", lambda: api.atendimento_detalhes.resultados())
t("atd_det.observacao_tipos", lambda: api.atendimento_detalhes.observacao_tipos())
t("atd_det.contato_status", lambda: api.atendimento_detalhes.contato_status())
t("atd_det.desconto_tipos", lambda: api.atendimento_detalhes.desconto_tipos())
t("atd_det.centro_cirurgicos", lambda: api.atendimento_detalhes.centro_cirurgicos())

# OPERADORAS
print("\nOPERADORAS")
ops = t("operadoras.listar", lambda: api.operadoras.listar())
if ops and isinstance(ops, list) and ops:
    t("operadoras.detalhar", lambda: api.operadoras.detalhar(ops[0]["id_operadora"]))

# OPERADORAS DETALHES
print("\nOPERADORAS DETALHES")
t("op_det.verificar_unificar_guias", lambda: api.operadoras_detalhes.verificar_unificar_guias(1))
t("op_det.bandeira_cartoes", lambda: api.operadoras_detalhes.bandeira_cartoes())
t("op_det.apoiados", lambda: api.operadoras_detalhes.apoiados())
t("op_det.apoiado_origens", lambda: api.operadoras_detalhes.apoiado_origens())

# FINANCEIRO
print("\nFINANCEIRO")
t("financeiro.configs", lambda: api.financeiro.configs())
t("financeiro.lancamentos_tags", lambda: api.financeiro.lancamentos_tags())
t("financeiro.formas_pagamento", lambda: api.financeiro.formas_pagamento())
t("financeiro.impostos", lambda: api.financeiro.impostos())

# PAGAMENTOS
print("\nPAGAMENTOS")
if id_p:
    t("pagamentos.adiantamentos", lambda: api.pagamentos.adiantamentos(id_p))

# FATURAMENTO
print("\nFATURAMENTO")
t("faturamento.classes_proc", lambda: api.faturamento.classes_procedimento())
t("faturamento.tabelas_versao", lambda: api.faturamento.tabelas_versao())

# TABELAS DE REFERÊNCIA
print("\nTABELAS DE REFERÊNCIA")
t("tab_ref.brasindices", lambda: api.tabelas_referencia.brasindices())
t("tab_ref.simpros", lambda: api.tabelas_referencia.simpros())
t("tab_ref.codigo_tabelas", lambda: api.tabelas_referencia.codigo_tabelas())
t("tab_ref.codigo_despesa", lambda: api.tabelas_referencia.codigo_despesa())
t("tab_ref.grau_participacoes", lambda: api.tabelas_referencia.grau_participacoes())
t("tab_ref.taxas", lambda: api.tabelas_referencia.taxas())
t("tab_ref.moedas", lambda: api.tabelas_referencia.moedas())
t("tab_ref.motivos_glosa", lambda: api.tabelas_referencia.motivos_glosa())
t("tab_ref.unidade_medidas", lambda: api.tabelas_referencia.unidade_medidas())

# SUPRIMENTOS
print("\nSUPRIMENTOS")
t("suprimentos.tipos_mov", lambda: api.suprimentos.tipos_movimentacao())
t("suprimentos.solicitacoes", lambda: api.suprimentos.solicitacoes())
t("suprimentos.itens_tags", lambda: api.suprimentos.itens_tags())
t("suprimentos.locais", lambda: api.suprimentos.locais())

# ESTOQUE DETALHES
print("\nESTOQUE DETALHES")
t("est_det.grupos", lambda: api.estoque_detalhes.grupos())
t("est_det.itens", lambda: api.estoque_detalhes.itens())
t("est_det.lotes", lambda: api.estoque_detalhes.lotes())
t("est_det.consumo", lambda: api.estoque_detalhes.consumo())
t("est_det.ident_pac_consumo", lambda: api.estoque_detalhes.ident_paciente_consumo(hoje))
t("est_det.tipo_etq_amostras", lambda: api.estoque_detalhes.tipo_etiqueta_amostras())
t("est_det.rota_etiquetas", lambda: api.estoque_detalhes.rota_etiquetas())

# LAUDOS
print("\nLAUDOS")
t("laudos.listar", lambda: api.laudos.listar())
t("laudos.detalhar(1)", lambda: api.laudos.detalhar(1))
t("laudos.filas", lambda: api.laudos.filas())
t("laudos.fila_detalhar(1)", lambda: api.laudos.fila_detalhar(1))
t("laudos.status_laudos", lambda: api.laudos.status_laudos())

# AUTORIZAÇÕES
print("\nAUTORIZAÇÕES")
t("autorizacoes.filas", lambda: api.autorizacoes.filas())
t("autorizacoes.solicitacoes", lambda: api.autorizacoes.solicitacoes())

# CRM
print("\nCRM")
t("crm.filas_leads", lambda: api.crm.filas_leads())
t("crm.orcamentos", lambda: api.crm.orcamentos())

# RELATÓRIOS
print("\nRELATÓRIOS")
t("relatorios.listar", lambda: api.relatorios.listar())
t("relatorios.dashboards", lambda: api.relatorios.dashboards())

# PEP
print("\nPEP")
t("pep.pode_avulso", lambda: api.pep.pode_avulso())
if id_p:
    t("pep.avulsos", lambda: api.pep.avulsos(id_p))
    t("pep.legado", lambda: api.pep.legado(id_p))

# CONFIGURAÇÕES
print("\nCONFIGURAÇÕES")
configs = t("configuracoes.listar", lambda: api.configuracoes.listar())
if configs and isinstance(configs, list) and configs:
    slug = configs[0].get("st_slug", "avulso-procedimento")
    t("configuracoes.obter", lambda: api.configuracoes.obter(slug))
t("configuracoes.verificar", lambda: api.configuracoes.verificar("pep_ativo"))

# USUÁRIOS
print("\nUSUÁRIOS")
t("usuarios.listar", lambda: api.usuarios.listar())
t("usuarios.tem_permissao(1)", lambda: api.usuarios.tem_permissao(1))

# SUS
print("\nSUS")
t("sus.motivo_saidas", lambda: api.sus.motivo_saidas())

# CADASTROS
print("\nCADASTROS")
t("cadastros.cep", lambda: api.cadastros.cep("01001000"))
t("cadastros.estados", lambda: api.cadastros.estados())
t("cadastros.cidades", lambda: api.cadastros.cidades(id_estado=26))
t("cadastros.cids", lambda: api.cadastros.cids("J06"))
t("cadastros.conselhos", lambda: api.cadastros.conselhos())
t("cadastros.bancos", lambda: api.cadastros.bancos())
t("cadastros.motivos", lambda: api.cadastros.motivos())
t("cadastros.sinalizadores", lambda: api.cadastros.sinalizadores())
t("cadastros.procedimentos", lambda: api.cadastros.procedimentos())
t("cadastros.buscar_proc", lambda: api.cadastros.buscar_procedimento("consulta"))
t("cadastros.materiais", lambda: api.cadastros.materiais())
t("cadastros.medicamentos", lambda: api.cadastros.medicamentos())
t("cadastros.planos", lambda: api.cadastros.planos())
t("cadastros.modelos", lambda: api.cadastros.modelos())
t("cadastros.tipo_arquivos", lambda: api.cadastros.tipo_arquivos())
t("cadastros.unidades", lambda: api.cadastros.unidades())
t("cadastros.unidades_operacao", lambda: api.cadastros.unidades_operacao())
t("cadastros.locais", lambda: api.cadastros.locais())
t("cadastros.tipo_logradouros", lambda: api.cadastros.tipo_logradouros())
t("cadastros.procedimento_grupos", lambda: api.cadastros.procedimento_grupos())

# TAREFAS
print("\nTAREFAS")
t("tarefas.listar", lambda: api.tarefas.listar())
t("tarefas.grupos", lambda: api.tarefas.grupos())

# AQL MULTI
print("\nAQL MULTI")
t("aql_multi", lambda: api._aql_multi([
    {"name": "medicos.index", "id": "medicos", "parms": {"ativos": True}},
    {"name": "especialidades.index", "id": "esps", "parms": {"ativadas": True}},
    {"name": "forma_pagamentos.index", "id": "formas"},
]))

# RELATÓRIO
print("\n" + "=" * 60)
total = len(res["ok"]) + len(res["erro"]) + len(res["skip"])
exec_count = len(res["ok"]) + len(res["erro"])
print(f"Total: {total} | Executados: {exec_count}")
print(f"✅ OK:   {len(res['ok'])}")
print(f"❌ ERRO: {len(res['erro'])}")
print(f"⚠️  SKIP: {len(res['skip'])}")
if res["erro"]:
    print("\nERROS:")
    for e in res["erro"]:
        print(f"  - {e}")
pct = 100 * len(res["ok"]) / exec_count if exec_count else 0
print(f"\nTaxa: {len(res['ok'])}/{exec_count} ({pct:.1f}%)")
