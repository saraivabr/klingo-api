"""
Cria banco de dados SQLite com todos os dados extraídos da API Klingo.
Extrai dados em tempo real e popula as tabelas.
"""
import sqlite3
import json
from datetime import date
from klingo_api import KlingoAPI

DB_PATH = "/Users/saraiva/Documents/IRB/klingo_irb.db"

# ============================================================
# CONEXÃO E HELPERS
# ============================================================
conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA foreign_keys=ON")
cur = conn.cursor()

api = KlingoAPI(domain="irb")
api.login("FELLIPE.SARAIVA", "FELLIPE.SARAIVA1")
hoje = date.today().isoformat()


def fetch(name, id_alias="lista", parms=None):
    """Busca dados via AQL e desempacota resposta."""
    if parms is None:
        parms = {}
    try:
        resp = api.session.post(
            f"{api.BASE_URL}/aql?a={name}",
            json={"q": [{"name": name, "id": id_alias, "parms": parms}]},
        )
        d = resp.json()
        result = d.get(id_alias, d)
        # Unwrap {status, data}
        if isinstance(result, dict) and "status" in result and "data" in result:
            result = result["data"]
        # Unwrap pagination {current_page, data: [...]}
        if isinstance(result, dict) and "data" in result and isinstance(result["data"], list):
            result = result["data"]
        return result if isinstance(result, list) else result
    except Exception as e:
        print(f"  ERRO fetch({name}): {e}")
        return None


def create_and_insert(table_name, data, extra_sql=""):
    """Cria tabela e insere dados automaticamente a partir da lista de dicts."""
    if not data or not isinstance(data, list) or len(data) == 0:
        print(f"  ⚠️  {table_name}: sem dados")
        return 0

    # Pegar todas as keys de todos os itens
    all_keys = set()
    for item in data:
        if isinstance(item, dict):
            all_keys.update(item.keys())
    if not all_keys:
        return 0

    cols = sorted(all_keys)

    # Criar tabela
    col_defs = []
    for c in cols:
        # Detectar tipo pela primeira ocorrência não-null
        sample = None
        for item in data:
            if isinstance(item, dict) and item.get(c) is not None:
                sample = item[c]
                break
        if isinstance(sample, bool):
            col_defs.append(f'"{c}" BOOLEAN')
        elif isinstance(sample, int):
            col_defs.append(f'"{c}" INTEGER')
        elif isinstance(sample, float):
            col_defs.append(f'"{c}" REAL')
        else:
            col_defs.append(f'"{c}" TEXT')

    sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(col_defs)}{extra_sql})'
    cur.execute(f'DROP TABLE IF EXISTS "{table_name}"')
    cur.execute(sql)

    # Inserir dados
    placeholders = ", ".join(["?" for _ in cols])
    col_names = ", ".join([f'"{c}"' for c in cols])
    insert_sql = f'INSERT INTO "{table_name}" ({col_names}) VALUES ({placeholders})'

    count = 0
    for item in data:
        if not isinstance(item, dict):
            continue
        values = []
        for c in cols:
            v = item.get(c)
            if isinstance(v, (dict, list)):
                v = json.dumps(v, default=str, ensure_ascii=False)
            elif isinstance(v, bool):
                v = int(v)
            values.append(v)
        try:
            cur.execute(insert_sql, values)
            count += 1
        except Exception as e:
            print(f"    Insert error {table_name}: {e}")
            break

    conn.commit()
    print(f"  ✅ {table_name}: {count} registros")
    return count


# ============================================================
# EXTRAÇÃO E CRIAÇÃO DAS TABELAS
# ============================================================
total = 0

# --- CADASTROS BÁSICOS ---
print("=" * 60)
print("CADASTROS BÁSICOS")
print("=" * 60)

tables = {
    "medicos": ("medicos.index", {"ativos": True}),
    "especialidades": ("especialidades.index", {"ativadas": True}),
    "operadoras": ("operadoras.index", {}),
    "planos": ("planos.index", {}),
    "procedimentos": ("procedimentos.index", {}),
    "formas_pagamento": ("forma_pagamentos.index", {}),
    "recepcoes": ("recepcaos.index", {}),
    "locais": ("locals.index", {}),
    "unidades": ("unidades.index", {}),
    "unidade_operacoes": ("unidade_operacaos.index", {}),
    "tipo_atendimentos": ("tipo_atendimentos.index", {}),
    "tipo_arquivos": ("tipo_arquivos.index", {}),
    "sinalizadores": ("sinalizadores.index", {}),
    "motivos": ("motivos.index", {}),
    "usuarios": ("usuarios.index", {}),
    "modelos_prontuario": ("modelos.index", {}),
    "configuracoes": ("configuracoes.index", {}),
    "fila_laudos": ("fila_laudos.index", {}),
}

for tbl, (endpoint, parms) in tables.items():
    data = fetch(endpoint, "lista", parms)
    if isinstance(data, list):
        total += create_and_insert(tbl, data)
    else:
        print(f"  ⚠️  {tbl}: resposta não é lista ({type(data).__name__})")

# --- CADASTROS AUXILIARES ---
print("\n" + "=" * 60)
print("CADASTROS AUXILIARES")
print("=" * 60)

aux_tables = {
    "estados": ("estados.index", {}),
    "bancos": ("bancos.index", {}),
    "conselhos": ("conselhos.index", {}),
    "classe_procedimentos": ("classe_procedimentos.index", {}),
    "tabela_versoes": ("tabela_versaos.index", {}),
    "codigo_tabelas": ("codigo_tabelas.index", {}),
    "codigo_despesa": ("codigo_despesa.index", {}),
    "grau_participacoes": ("grau_participacoes.index", {}),
    "moedas": ("moedas.index", {}),
    "motivos_glosa": ("motivos_glosa.index", {}),
    "unidade_medidas": ("unidade_medidas.index", {}),
    "taxas": ("taxas.index", {}),
    "bandeira_cartoes": ("bandeira_cartaos.index", {}),
    "observacao_tipos": ("observacao_tipos.index", {}),
    "contato_status": ("contato_status.index", {}),
    "desconto_tipos": ("desconto_tipos.index", {}),
    "centro_cirurgicos": ("centro_cirurgicos.index", {}),
    "textos_padrao": ("textos_padrao.index", {}),
    "resultados": ("resultados.index", {}),
    "procedimento_grupos": ("procedimento_grupos.index", {}),
    "tipo_logradouros": ("tipo_logradouros.index", {}),
}

for tbl, (endpoint, parms) in aux_tables.items():
    data = fetch(endpoint, "lista", parms)
    if isinstance(data, list):
        total += create_and_insert(tbl, data)
    else:
        print(f"  ⚠️  {tbl}: {type(data).__name__}")

# --- ESTOQUE / SUPRIMENTOS ---
print("\n" + "=" * 60)
print("ESTOQUE / SUPRIMENTOS")
print("=" * 60)

est_tables = {
    "estoque_grupos": ("estoque_grupos.index", {}),
    "estoque_items": ("estoque_items.index", {}),
    "estoque_locais": ("estoque_locals.index", {}),
    "estoque_lotes": ("estoque_lotes.index", {}),
    "consumo_materiais": ("consumo.index", {}),
}

for tbl, (endpoint, parms) in est_tables.items():
    data = fetch(endpoint, "lista", parms)
    if isinstance(data, list):
        total += create_and_insert(tbl, data)
    else:
        print(f"  ⚠️  {tbl}: {type(data).__name__}")

# --- CRM / ORÇAMENTOS ---
print("\n" + "=" * 60)
print("CRM / ORÇAMENTOS")
print("=" * 60)

data = fetch("orcamentos.index", "lista")
if isinstance(data, list):
    total += create_and_insert("orcamentos", data)

# --- ENFERMAGEM / ATENDIMENTOS DO DIA ---
print("\n" + "=" * 60)
print("ENFERMAGEM / FILA DE ATENDIMENTOS")
print("=" * 60)

# Pegar fila de todas as recepções/filas
filas_ids = {
    1: "pre_consulta_enfermagem",
    4: "pos_atendimento_recepcao",
    17: "fila_cirurgia",
    21: "atendimentos_odontologia",
    22: "aplicacao",
    26: "triagem_telemedicina",
}

all_enfermagem = []
for fila_id, fila_nome in filas_ids.items():
    data = fetch("enfermagem.fila", "lista", {
        "referencia": hoje,
        "fila": True,
        "from": "2026-02-01",
        "to": hoje,
        "id_fila_laudo": fila_id,
        "page": 1,
        "size": 200,
        "tarefas": True,
    })
    if isinstance(data, dict) and "lista" in data:
        inner = data["lista"]
        if isinstance(inner, dict) and "data" in inner:
            items = inner["data"]
            if isinstance(items, list):
                for item in items:
                    item["_fila_nome"] = fila_nome
                    item["_fila_id"] = fila_id
                all_enfermagem.extend(items)
                print(f"  Fila {fila_nome} (id={fila_id}): {len(items)} itens")

if all_enfermagem:
    # Flatten nested objects for DB
    flat_items = []
    for item in all_enfermagem:
        flat = {}
        for k, v in item.items():
            if isinstance(v, (dict, list)):
                flat[k] = json.dumps(v, default=str, ensure_ascii=False)
            else:
                flat[k] = v
        flat_items.append(flat)
    total += create_and_insert("enfermagem_fila", flat_items)

# --- ATENDIMENTOS DETALHADOS ---
print("\n" + "=" * 60)
print("ATENDIMENTOS DETALHADOS (com anamnese)")
print("=" * 60)

# Pegar IDs de atendimentos únicos da fila
atend_ids = set()
for item in all_enfermagem:
    if item.get("id_atendimento"):
        atend_ids.add(item["id_atendimento"])

print(f"  Extraindo {len(atend_ids)} atendimentos...")
atendimentos = []
atendimento_procedimentos = []
anamneses = []

for aid in sorted(atend_ids):
    try:
        resp = api.session.post(
            f"{api.BASE_URL}/aql?a=atendimentos.show",
            json={"q": [{"name": "atendimentos.show", "id": "item", "parms": {"id": aid}}]},
        )
        d = resp.json()
        item = d.get("item", {})
        if isinstance(item, dict) and "data" in item:
            item = item["data"]

        # Atendimento base
        atend_flat = {}
        atp = None
        for k, v in item.items():
            if k == "atendimento_procedimento":
                atp = v
            elif isinstance(v, (dict, list)):
                atend_flat[k] = json.dumps(v, default=str, ensure_ascii=False)
            else:
                atend_flat[k] = v
        atendimentos.append(atend_flat)

        # Atendimento procedimento
        if atp and isinstance(atp, dict):
            atp_flat = {}
            anamnese_data = None
            for k, v in atp.items():
                if k == "anamnese":
                    anamnese_data = v
                elif isinstance(v, (dict, list)):
                    atp_flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                else:
                    atp_flat[k] = v
            atendimento_procedimentos.append(atp_flat)

            # Anamnese
            if anamnese_data and isinstance(anamnese_data, dict):
                ana_flat = {}
                for k, v in anamnese_data.items():
                    if isinstance(v, (dict, list)):
                        ana_flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                    else:
                        ana_flat[k] = v
                anamneses.append(ana_flat)

    except Exception as e:
        print(f"    Erro atendimento {aid}: {e}")

total += create_and_insert("atendimentos", atendimentos)
total += create_and_insert("atendimento_procedimentos", atendimento_procedimentos)
total += create_and_insert("anamneses", anamneses)

# --- MARCAÇÕES DE PACIENTES ---
print("\n" + "=" * 60)
print("MARCAÇÕES RECENTES")
print("=" * 60)

# Pegar marcações dos pacientes da fila
pac_ids = set()
for item in all_enfermagem:
    if item.get("id_paciente"):
        pac_ids.add(item["id_paciente"])

print(f"  Extraindo marcações de {len(pac_ids)} pacientes...")
all_marcacoes = []
for pid in sorted(pac_ids):
    try:
        marcs = api.marcacoes.listar(pid)
        if isinstance(marcs, list):
            for m in marcs:
                m_flat = {}
                for k, v in m.items():
                    if isinstance(v, (dict, list)):
                        m_flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                    else:
                        m_flat[k] = v
                all_marcacoes.append(m_flat)
    except:
        pass

total += create_and_insert("marcacoes", all_marcacoes)

# --- PACIENTES ---
print("\n" + "=" * 60)
print("PACIENTES (da fila)")
print("=" * 60)

all_pacientes = []
for pid in sorted(pac_ids):
    try:
        pac = api.pacientes.detalhar(pid)
        if isinstance(pac, dict):
            p_flat = {}
            for k, v in pac.items():
                if isinstance(v, (dict, list)):
                    p_flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                else:
                    p_flat[k] = v
            all_pacientes.append(p_flat)
    except:
        pass

total += create_and_insert("pacientes", all_pacientes)

# ============================================================
# ÍNDICES
# ============================================================
print("\n" + "=" * 60)
print("CRIANDO ÍNDICES")
print("=" * 60)

indices = [
    "CREATE INDEX IF NOT EXISTS idx_medicos_nome ON medicos(st_nome_exibicao)",
    "CREATE INDEX IF NOT EXISTS idx_procedimentos_nome ON procedimentos(st_procedimento)",
    "CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON pacientes(st_nome)",
    "CREATE INDEX IF NOT EXISTS idx_marcacoes_paciente ON marcacoes(id_paciente)",
    "CREATE INDEX IF NOT EXISTS idx_marcacoes_medico ON marcacoes(id_medico)",
    "CREATE INDEX IF NOT EXISTS idx_marcacoes_data ON marcacoes(dt_inicio)",
    "CREATE INDEX IF NOT EXISTS idx_atendimentos_paciente ON atendimentos(id_paciente)",
    "CREATE INDEX IF NOT EXISTS idx_atendimentos_medico ON atendimentos(id_medico)",
    "CREATE INDEX IF NOT EXISTS idx_enfermagem_paciente ON enfermagem_fila(id_paciente)",
    "CREATE INDEX IF NOT EXISTS idx_enfermagem_medico ON enfermagem_fila(id_medico)",
    "CREATE INDEX IF NOT EXISTS idx_anamneses_atp ON anamneses(id_atendimento_procedimento)",
    "CREATE INDEX IF NOT EXISTS idx_atp_atendimento ON atendimento_procedimentos(id_atendimento)",
    "CREATE INDEX IF NOT EXISTS idx_orcamentos_titulo ON orcamentos(st_titulo)",
    "CREATE INDEX IF NOT EXISTS idx_estoque_items_nome ON estoque_items(st_item)",
]

for idx_sql in indices:
    try:
        cur.execute(idx_sql)
    except Exception as e:
        print(f"  ⚠️  {e}")

conn.commit()
print("  ✅ Índices criados")

# ============================================================
# RESUMO
# ============================================================
print("\n" + "=" * 60)
print("RESUMO DO BANCO DE DADOS")
print("=" * 60)

cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cur.fetchall()
print(f"\n  Tabelas: {len(tables)}")
for (tbl,) in tables:
    cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
    count = cur.fetchone()[0]
    print(f"    {tbl}: {count} registros")

print(f"\n  Total de registros: {total}")
print(f"  Banco salvo em: {DB_PATH}")

conn.close()
