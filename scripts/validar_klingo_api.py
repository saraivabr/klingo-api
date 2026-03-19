"""
Validação completa da API Klingo - Testa todos os módulos e endpoints (v2)
"""

import json
import traceback
from datetime import date, timedelta
from klingo_api import KlingoAPI, KlingoAPIError

api = KlingoAPI(domain="irb")

resultados = {"ok": [], "erro": [], "aviso": []}

def testar(nome, func, destrutivo=False):
    if destrutivo:
        resultados["aviso"].append(f"{nome} (PULADO - destrutivo)")
        print(f"  ⚠️  {nome} - PULADO (destrutivo)")
        return None
    try:
        result = func()
        if result is None:
            resultados["aviso"].append(f"{nome} → None")
            print(f"  ⚠️  {nome} → None")
        elif isinstance(result, list) and len(result) == 0:
            resultados["ok"].append(f"{nome} → []")
            print(f"  ✅ {nome} → [] (vazio)")
        elif isinstance(result, list):
            resultados["ok"].append(f"{nome} → {len(result)} itens")
            print(f"  ✅ {nome} → {len(result)} itens")
        elif isinstance(result, dict):
            keys = list(result.keys())[:5]
            resultados["ok"].append(f"{nome} → dict({', '.join(keys)})")
            print(f"  ✅ {nome} → dict keys: {keys}")
        elif isinstance(result, bool):
            resultados["ok"].append(f"{nome} → {result}")
            print(f"  ✅ {nome} → {result}")
        else:
            resultados["ok"].append(f"{nome} → {type(result).__name__}")
            print(f"  ✅ {nome} → {type(result).__name__}: {str(result)[:80]}")
        return result
    except KlingoAPIError as e:
        resultados["erro"].append(f"{nome} → KlingoAPIError: {e}")
        print(f"  ❌ {nome} → {e}")
        return None
    except Exception as e:
        resultados["erro"].append(f"{nome} → {type(e).__name__}: {e}")
        print(f"  ❌ {nome} → {type(e).__name__}: {e}")
        return None


hoje = date.today().isoformat()
amanha = (date.today() + timedelta(days=1)).isoformat()

# LOGIN
print("=" * 60)
print("1. LOGIN")
print("=" * 60)
testar("login", lambda: api.login("FELLIPE.SARAIVA", "FELLIPE.SARAIVA1"))
if not api.token:
    print("FALHOU"); exit(1)

# PACIENTES
print("\n" + "=" * 60)
print("2. PACIENTES")
print("=" * 60)
pacientes = testar("pacientes.buscar('Maria')", lambda: api.pacientes.buscar("Maria"))
id_pessoa = pacientes[0]["id_pessoa"] if pacientes and len(pacientes) > 0 else None
if id_pessoa:
    print(f"  → id_pessoa={id_pessoa}")
    testar("pacientes.detalhar", lambda: api.pacientes.detalhar(id_pessoa))
    testar("pacientes.retornos", lambda: api.pacientes.retornos(id_pessoa))
testar("pacientes.buscar(page=2)", lambda: api.pacientes.buscar("Maria", page=2))
testar("pacientes.criar", lambda: None, destrutivo=True)
testar("pacientes.atualizar", lambda: None, destrutivo=True)

# MÉDICOS
print("\n" + "=" * 60)
print("3. MÉDICOS")
print("=" * 60)
medicos = testar("medicos.listar(ativos=True)", lambda: api.medicos.listar(ativos=True))
testar("medicos.listar(ativos=False)", lambda: api.medicos.listar(ativos=False))
id_medico = medicos[0]["id_pessoa"] if medicos and len(medicos) > 0 else None
if id_medico:
    print(f"  → id_medico={id_medico} ({medicos[0]['st_nome_exibicao']})")
    testar("medicos.horarios(sem proc)", lambda: api.medicos.horarios(id_medico, hoje))
    testar("medicos.horarios(com proc)", lambda: api.medicos.horarios(id_medico, hoje, id_procedimento=2098))

# ESPECIALIDADES
print("\n" + "=" * 60)
print("4. ESPECIALIDADES")
print("=" * 60)
testar("especialidades.listar(ativadas=True)", lambda: api.especialidades.listar(ativadas=True))
testar("especialidades.listar(ativadas=False)", lambda: api.especialidades.listar(ativadas=False))

# AGENDAS
print("\n" + "=" * 60)
print("5. AGENDAS")
print("=" * 60)
agendas = testar("agendas.listar(hoje)", lambda: api.agendas.listar(data=hoje))
testar("agendas.listar(amanhã)", lambda: api.agendas.listar(data=amanha))
testar("agendas.listar(turno=M)", lambda: api.agendas.listar(data=hoje, turno="M"))
testar("agendas.listar(status=A)", lambda: api.agendas.listar(data=hoje, status="A"))
if id_medico:
    testar("agendas.listar(medico)", lambda: api.agendas.listar(data=hoje, medico=str(id_medico)))
    testar("agendas.listar(livres=1)", lambda: api.agendas.listar(data=amanha, medico=str(id_medico), livres=1))
    testar("agendas.horarios_medico", lambda: api.agendas.horarios_medico(id_medico, hoje, id_procedimento=2098))
testar("agendas.agendar", lambda: None, destrutivo=True)
testar("agendas.cancelar", lambda: None, destrutivo=True)
testar("agendas.reservar", lambda: None, destrutivo=True)

# MARCAÇÕES
print("\n" + "=" * 60)
print("6. MARCAÇÕES")
print("=" * 60)
testar("marcacoes.stats", lambda: api.marcacoes.stats())
testar("marcacoes.stats(False)", lambda: api.marcacoes.stats(para_marcacao=False))
if id_pessoa:
    marcacoes = testar("marcacoes.listar", lambda: api.marcacoes.listar(id_paciente=id_pessoa))
    if marcacoes and isinstance(marcacoes, list) and len(marcacoes) > 0:
        id_marc = marcacoes[0]["id_marcacao"]
        testar("marcacoes.detalhar", lambda: api.marcacoes.detalhar(id_marc))

# ATENDIMENTOS
print("\n" + "=" * 60)
print("7. ATENDIMENTOS")
print("=" * 60)
testar("atendimentos.criar", lambda: None, destrutivo=True)
if marcacoes and isinstance(marcacoes, list) and len(marcacoes) > 0:
    id_atend = marcacoes[0].get("id_atendimento")
    if id_atend:
        testar("atendimentos.detalhar", lambda: api.atendimentos.detalhar(id_atend))

# OPERADORAS
print("\n" + "=" * 60)
print("8. OPERADORAS")
print("=" * 60)
operadoras = testar("operadoras.listar", lambda: api.operadoras.listar())
if operadoras and isinstance(operadoras, list) and len(operadoras) > 0:
    id_op = operadoras[0]["id_operadora"]
    testar("operadoras.detalhar", lambda: api.operadoras.detalhar(id_op))

# FINANCEIRO
print("\n" + "=" * 60)
print("9. FINANCEIRO")
print("=" * 60)
testar("financeiro.configs", lambda: api.financeiro.configs())
testar("financeiro.lancamentos_tags", lambda: api.financeiro.lancamentos_tags())
testar("financeiro.formas_pagamento", lambda: api.financeiro.formas_pagamento())
testar("financeiro.impostos", lambda: api.financeiro.impostos())

# PAGAMENTOS
print("\n" + "=" * 60)
print("10. PAGAMENTOS")
print("=" * 60)
if id_pessoa:
    testar("pagamentos.adiantamentos", lambda: api.pagamentos.adiantamentos(id_pessoa))

# FATURAMENTO
print("\n" + "=" * 60)
print("11. FATURAMENTO")
print("=" * 60)
testar("faturamento.classes_procedimento", lambda: api.faturamento.classes_procedimento())
testar("faturamento.tabelas_versao", lambda: api.faturamento.tabelas_versao())

# SUPRIMENTOS
print("\n" + "=" * 60)
print("12. SUPRIMENTOS")
print("=" * 60)
testar("suprimentos.tipos_movimentacao", lambda: api.suprimentos.tipos_movimentacao())
testar("suprimentos.solicitacoes", lambda: api.suprimentos.solicitacoes())
testar("suprimentos.itens_tags", lambda: api.suprimentos.itens_tags())
testar("suprimentos.locais", lambda: api.suprimentos.locais())

# LAUDOS
print("\n" + "=" * 60)
print("13. LAUDOS")
print("=" * 60)
testar("laudos.filas", lambda: api.laudos.filas())
testar("laudos.status_laudos", lambda: api.laudos.status_laudos())

# AUTORIZAÇÕES
print("\n" + "=" * 60)
print("14. AUTORIZAÇÕES")
print("=" * 60)
testar("autorizacoes.filas", lambda: api.autorizacoes.filas())

# CRM
print("\n" + "=" * 60)
print("15. CRM")
print("=" * 60)
testar("crm.filas_leads", lambda: api.crm.filas_leads())
testar("crm.orcamentos", lambda: api.crm.orcamentos())

# RELATÓRIOS
print("\n" + "=" * 60)
print("16. RELATÓRIOS")
print("=" * 60)
testar("relatorios.listar", lambda: api.relatorios.listar())
testar("relatorios.dashboards", lambda: api.relatorios.dashboards())
testar("relatorios.pagina('agenda')", lambda: api.relatorios.pagina("agenda"))

# PEP
print("\n" + "=" * 60)
print("17. PEP")
print("=" * 60)
testar("pep.pode_avulso", lambda: api.pep.pode_avulso())
if id_pessoa:
    testar("pep.avulsos", lambda: api.pep.avulsos(id_pessoa))

# CONFIGURAÇÕES
print("\n" + "=" * 60)
print("18. CONFIGURAÇÕES")
print("=" * 60)
configs = testar("configuracoes.listar", lambda: api.configuracoes.listar())
if configs and isinstance(configs, list) and len(configs) > 0:
    slug = configs[0].get("st_slug", "avulso-procedimento")
    testar(f"configuracoes.obter('{slug}')", lambda: api.configuracoes.obter(slug))
testar("configuracoes.verificar('pep_ativo')", lambda: api.configuracoes.verificar("pep_ativo"))

# USUÁRIOS
print("\n" + "=" * 60)
print("19. USUÁRIOS")
print("=" * 60)
testar("usuarios.listar", lambda: api.usuarios.listar())
testar("usuarios.tem_permissao(1)", lambda: api.usuarios.tem_permissao(1))
testar("usuarios.tem_permissao(2)", lambda: api.usuarios.tem_permissao(2))

# CADASTROS
print("\n" + "=" * 60)
print("20. CADASTROS AUXILIARES")
print("=" * 60)
testar("cadastros.cep('01001000')", lambda: api.cadastros.cep("01001000"))
testar("cadastros.estados", lambda: api.cadastros.estados())
testar("cadastros.cidades(26)", lambda: api.cadastros.cidades(id_estado=26))
testar("cadastros.cids('J06')", lambda: api.cadastros.cids("J06"))
testar("cadastros.conselhos", lambda: api.cadastros.conselhos())
testar("cadastros.bancos", lambda: api.cadastros.bancos())
testar("cadastros.motivos", lambda: api.cadastros.motivos())
testar("cadastros.sinalizadores", lambda: api.cadastros.sinalizadores())
testar("cadastros.procedimentos", lambda: api.cadastros.procedimentos())
testar("cadastros.buscar_procedimento('consulta')", lambda: api.cadastros.buscar_procedimento("consulta"))
testar("cadastros.materiais", lambda: api.cadastros.materiais())
testar("cadastros.medicamentos", lambda: api.cadastros.medicamentos())
testar("cadastros.planos", lambda: api.cadastros.planos())
testar("cadastros.buscar_plano('basico')", lambda: api.cadastros.buscar_plano("basico"))
testar("cadastros.modelos", lambda: api.cadastros.modelos())
testar("cadastros.tipo_arquivos", lambda: api.cadastros.tipo_arquivos())
testar("cadastros.unidades", lambda: api.cadastros.unidades())
testar("cadastros.unidades_operacao", lambda: api.cadastros.unidades_operacao())
testar("cadastros.locais", lambda: api.cadastros.locais())

# TAREFAS
print("\n" + "=" * 60)
print("21. TAREFAS")
print("=" * 60)
testar("tarefas.listar", lambda: api.tarefas.listar())
testar("tarefas.listar(False)", lambda: api.tarefas.listar(pendentes=False))

# AQL MULTI
print("\n" + "=" * 60)
print("22. AQL MULTI")
print("=" * 60)
testar("aql_multi(medicos+esps)", lambda: api._aql_multi([
    {"name": "medicos.index", "id": "medicos", "parms": {"ativos": True}},
    {"name": "especialidades.index", "id": "especialidades", "parms": {"ativadas": True}},
]))
testar("aql_multi(formas+sinalizadores)", lambda: api._aql_multi([
    {"name": "forma_pagamentos.index", "id": "formas"},
    {"name": "sinalizadores.index", "id": "sinalizadores", "parms": {"ativos": True}},
]))

# ============================================================
# RELATÓRIO
# ============================================================
print("\n" + "=" * 60)
print("RELATÓRIO FINAL")
print("=" * 60)

total = len(resultados["ok"]) + len(resultados["erro"]) + len(resultados["aviso"])
executados = len(resultados["ok"]) + len(resultados["erro"])
print(f"\n  Total: {total} | Executados: {executados}")
print(f"  ✅ OK:    {len(resultados['ok'])}")
print(f"  ❌ ERRO:  {len(resultados['erro'])}")
print(f"  ⚠️  AVISO: {len(resultados['aviso'])}")

if resultados["erro"]:
    print(f"\n  ERROS:")
    for i, e in enumerate(resultados["erro"], 1):
        print(f"    {i}. {e}")

if resultados["aviso"]:
    print(f"\n  AVISOS:")
    for i, a in enumerate(resultados["aviso"], 1):
        print(f"    {i}. {a}")

if executados > 0:
    pct = 100 * len(resultados["ok"]) / executados
    print(f"\n  Taxa de sucesso: {len(resultados['ok'])}/{executados} ({pct:.1f}%)")
print("=" * 60)
