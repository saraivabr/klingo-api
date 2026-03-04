"""Fix specialties and CRM for doctors in PostgreSQL."""
import psycopg2
from klingo_api import KlingoAPI

api = KlingoAPI(domain="irb")
api.login("FELLIPE.SARAIVA", "FELLIPE.SARAIVA1")

medicos = api.medicos.listar(ativos=True)
esps = api.especialidades.listar(ativadas=True)
esp_map = {e["id_especialidade"]: e["st_especialidade"] for e in esps}

conn = psycopg2.connect(
    host="172.19.0.4", port=5432, dbname="irb_whatsapp",
    user="irb", password="IxBQqnnSpYuzMF53jk9z4eAtSbkor"
)
cur = conn.cursor()

updated = 0
for m in medicos:
    klingo_id = m["id_pessoa"]
    me_list = m.get("medico_especialidade", [])
    esp_nome = ""
    if me_list:
        id_esp = me_list[0].get("id_especialidade")
        esp_nome = esp_map.get(id_esp, "")

    conselho = m.get("conselho", {})
    estado = m.get("estado_conselho", {})
    numero = m.get("in_numero_conselho", "")
    sigla_c = (conselho.get("st_sigla") or "CRM")
    sigla_uf = (estado.get("st_sigla") or "SP")
    crm_full = f"{sigla_c}/{sigla_uf} {numero}".strip() if numero else f"{sigla_c}/{sigla_uf}"

    cur.execute(
        "UPDATE doctors SET specialty = %s, crm = %s WHERE klingo_id = %s",
        (esp_nome, crm_full, klingo_id)
    )
    if cur.rowcount > 0:
        updated += 1

conn.commit()
print(f"Atualizados: {updated}")

# Verificar
cur.execute("SELECT name, specialty, crm, klingo_id FROM doctors WHERE is_active = true ORDER BY name")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} | {r[2]} | klingo={r[3]}")

conn.close()
