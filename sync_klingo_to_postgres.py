"""
Sincroniza dados da API Klingo → PostgreSQL existente do irb-whatsapp-ai.
Alimenta as tabelas: doctors, services, patients, knowledge_base.
"""
import json
import psycopg2
from psycopg2.extras import execute_values
from klingo_api import KlingoAPI

# ============================================================
# CONFIG
# ============================================================
PG_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "irb_whatsapp",
    "user": "irb",
    "password": "IxBQqnnSpYuzMF53jk9z4eAtSbkor",
}

api = KlingoAPI(domain="irb")
api.login("FELLIPE.SARAIVA", "FELLIPE.SARAIVA1")


def fetch(name, id_alias="lista", parms=None):
    if parms is None:
        parms = {}
    try:
        resp = api.session.post(
            f"{api.BASE_URL}/aql?a={name}",
            json={"q": [{"name": name, "id": id_alias, "parms": parms}]},
        )
        d = resp.json()
        result = d.get(id_alias, d)
        if isinstance(result, dict) and "status" in result and "data" in result:
            result = result["data"]
        if isinstance(result, dict) and "data" in result and isinstance(result["data"], list):
            result = result["data"]
        return result if isinstance(result, list) else result
    except Exception as e:
        print(f"  ERRO fetch({name}): {e}")
        return None


conn = psycopg2.connect(**PG_CONFIG)
conn.autocommit = False
cur = conn.cursor()

# ============================================================
# 1. SINCRONIZAR DOCTORS
# ============================================================
print("=" * 60)
print("SINCRONIZAR DOCTORS")
print("=" * 60)

medicos = fetch("medicos.index", "lista", {"ativos": True})
especialidades = fetch("especialidades.index", "lista", {"ativadas": True})

# Mapear id_especialidade → nome
esp_map = {}
if isinstance(especialidades, list):
    for e in especialidades:
        esp_map[e.get("id_especialidade")] = e.get("st_especialidade", "")

# Pegar klingo_ids já existentes
cur.execute("SELECT klingo_id FROM doctors WHERE klingo_id IS NOT NULL")
existing_klingo_ids = {row[0] for row in cur.fetchall()}

inserted = 0
updated = 0
if isinstance(medicos, list):
    for m in medicos:
        klingo_id = m.get("id_pessoa")
        nome = m.get("st_nome_exibicao", m.get("st_nome", ""))
        id_esp = m.get("id_especialidade")
        especialidade = esp_map.get(id_esp, "")
        crm = m.get("st_conselho_numero", "")
        conselho = m.get("st_conselho_sigla", "CRM")
        uf = m.get("st_conselho_uf", "SP")
        crm_full = f"{conselho}/{uf} {crm}".strip() if crm else f"{conselho}/{uf}"
        is_active = m.get("fl_ativo", True)

        if klingo_id in existing_klingo_ids:
            # Atualizar
            cur.execute("""
                UPDATE doctors SET name = %s, specialty = %s, crm = %s, is_active = %s
                WHERE klingo_id = %s
            """, (nome, especialidade, crm_full, is_active, klingo_id))
            updated += 1
        else:
            # Inserir
            cur.execute("""
                INSERT INTO doctors (id, name, specialty, crm, klingo_id, is_active)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s)
            """, (nome, especialidade, crm_full, klingo_id, is_active))
            inserted += 1

conn.commit()
print(f"  Médicos da Klingo: {len(medicos)}")
print(f"  Inseridos: {inserted} | Atualizados: {updated}")

# ============================================================
# 2. SINCRONIZAR SERVICES (procedimentos como serviços)
# ============================================================
print("\n" + "=" * 60)
print("SINCRONIZAR SERVICES")
print("=" * 60)

procedimentos = fetch("procedimentos.index", "lista")

# Ver services existentes
cur.execute("SELECT name FROM services")
existing_services = {row[0] for row in cur.fetchall()}

# Adicionar coluna klingo_procedure_id se não existe
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'klingo_procedure_id'
""")
if not cur.fetchone():
    cur.execute("ALTER TABLE services ADD COLUMN klingo_procedure_id INTEGER")
    conn.commit()
    print("  Coluna klingo_procedure_id adicionada à tabela services")

# Pegar services já com klingo_id
cur.execute("SELECT klingo_procedure_id FROM services WHERE klingo_procedure_id IS NOT NULL")
existing_proc_ids = {row[0] for row in cur.fetchall()}

inserted_svc = 0
if isinstance(procedimentos, list):
    # Mapear classes de procedimento
    classes = fetch("classe_procedimentos.index", "lista")
    class_map = {}
    if isinstance(classes, list):
        for c in classes:
            class_map[c.get("id_classe_procedimento")] = c.get("st_classe_procedimento", "")

    for p in procedimentos:
        proc_id = p.get("id_procedimento")
        nome = p.get("st_procedimento", "")
        id_classe = p.get("id_classe_procedimento")
        classe = class_map.get(id_classe, "")

        # Categorizar
        nome_lower = nome.lower()
        if "consulta" in nome_lower:
            category = "consulta"
        elif any(x in nome_lower for x in ["exame", "laborat", "hemograma", "coleta", "urina"]):
            category = "exame"
        elif any(x in nome_lower for x in ["eco", "eletro", "ecg", "doppler", "ultrassom", "tomografia", "raio", "radiografia", "ressonância"]):
            category = "exame"
        elif any(x in nome_lower for x in ["cirurgia", "cirúrgic", "procedimento"]):
            category = "procedimento"
        elif any(x in nome_lower for x in ["aplicação", "infusão", "vacina"]):
            category = "aplicacao"
        elif any(x in nome_lower for x in ["tele", "teleprime"]):
            category = "telemedicina"
        else:
            category = classe.lower() if classe else "outro"

        if proc_id not in existing_proc_ids:
            cur.execute("""
                INSERT INTO services (id, name, description, category, is_active, klingo_procedure_id)
                VALUES (gen_random_uuid(), %s, %s, %s, true, %s)
            """, (nome, classe, category, proc_id))
            inserted_svc += 1

conn.commit()
print(f"  Procedimentos Klingo: {len(procedimentos) if isinstance(procedimentos, list) else 0}")
print(f"  Services já existentes: {len(existing_services)}")
print(f"  Novos services inseridos: {inserted_svc}")

# ============================================================
# 3. SINCRONIZAR KNOWLEDGE BASE
# ============================================================
print("\n" + "=" * 60)
print("SINCRONIZAR KNOWLEDGE BASE")
print("=" * 60)

# Gerar knowledge base a partir dos dados reais
formas_pag = fetch("forma_pagamentos.index", "lista")
operadoras = fetch("operadoras.index", "lista")
planos = fetch("planos.index", "lista")

# Médicos ativos e suas especialidades
cur.execute("SELECT name, specialty, crm FROM doctors WHERE is_active = true ORDER BY name")
docs_ativos = cur.fetchall()

# Gerar lista de médicos por especialidade
esp_docs = {}
for name, spec, crm in docs_ativos:
    if spec:
        esp_docs.setdefault(spec, []).append(name)

corpo_clinico_text = "Corpo clínico da IRB Prime Care:\n"
for esp, nomes in sorted(esp_docs.items()):
    corpo_clinico_text += f"- {esp}: {', '.join(nomes)}\n"

# Lista de formas de pagamento
formas_text = "Formas de pagamento aceitas: "
if isinstance(formas_pag, list):
    formas_text += ", ".join([f.get("st_forma_pagamento", "") for f in formas_pag])

# Lista de especialidades
esp_list = fetch("especialidades.index", "lista", {"ativadas": True})
esp_text = "Especialidades disponíveis: "
if isinstance(esp_list, list):
    esp_text += ", ".join(sorted([e.get("st_especialidade", "") for e in esp_list]))

# Lista de exames
cur.execute("SELECT name FROM services WHERE category = 'exame' AND is_active = true ORDER BY name")
exames = [row[0] for row in cur.fetchall()]
exames_text = "Exames disponíveis: " + ", ".join(exames) if exames else "Exames: consulte a clínica"

new_kb = [
    ("corpo_clinico", "Quais médicos atendem na clínica?", corpo_clinico_text, "medicos"),
    ("especialidades_disponiveis", "Quais especialidades estão disponíveis?", esp_text, "medicos"),
    ("formas_pagamento_detalhe", "Quais são as formas de pagamento?", formas_text, "financeiro"),
    ("exames_disponiveis", "Quais exames a clínica faz?", exames_text, "exame"),
]

kb_inserted = 0
for key, question, answer, category in new_kb:
    cur.execute("SELECT 1 FROM knowledge_base WHERE key = %s", (key,))
    if cur.fetchone():
        cur.execute("""
            UPDATE knowledge_base SET question = %s, answer = %s, category = %s, updated_at = NOW()
            WHERE key = %s
        """, (question, answer, category, key))
    else:
        cur.execute("""
            INSERT INTO knowledge_base (id, key, question, answer, category, updated_at)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
        """, (key, question, answer, category))
        kb_inserted += 1

conn.commit()
print(f"  Knowledge base entries adicionadas/atualizadas: {len(new_kb)}")
print(f"  Novas: {kb_inserted}")

# ============================================================
# 4. ATUALIZAR klingo_id NOS DOCTORS QUE NÃO TÊM
# ============================================================
print("\n" + "=" * 60)
print("VERIFICAR MAPEAMENTO KLINGO_ID")
print("=" * 60)

cur.execute("SELECT id, name, klingo_id FROM doctors WHERE klingo_id IS NULL")
sem_klingo = cur.fetchall()
if sem_klingo:
    print(f"  ⚠️  {len(sem_klingo)} doctors sem klingo_id:")
    for d in sem_klingo:
        print(f"    - {d[1]} (id: {d[0]})")
else:
    print("  ✅ Todos os doctors têm klingo_id")

# ============================================================
# RESUMO FINAL
# ============================================================
print("\n" + "=" * 60)
print("RESUMO FINAL")
print("=" * 60)

for tbl in ["doctors", "services", "patients", "knowledge_base"]:
    cur.execute(f"SELECT COUNT(*) FROM {tbl}")
    cnt = cur.fetchone()[0]
    print(f"  {tbl}: {cnt} registros")

cur.close()
conn.close()
print("\n  Sincronização concluída!")
