"""
Extração completa da Klingo: todos os pacientes, marcações e atendimentos.
Estratégia: iterar agendas dia a dia para capturar todas as marcações,
depois detalhar cada paciente e atendimento único.
"""
import json
import psycopg2
from datetime import date, timedelta
from klingo_api import KlingoAPI

# ============================================================
# CONFIG
# ============================================================
PG_HOST = "172.19.0.4"
PG_CONFIG = {
    "host": PG_HOST, "port": 5432, "dbname": "irb_whatsapp",
    "user": "irb", "password": "IxBQqnnSpYuzMF53jk9z4eAtSbkor",
}

# Quantos dias pra trás extrair
DIAS_ATRAS = 365

api = KlingoAPI(domain="irb")
api.login("FELLIPE.SARAIVA", "FELLIPE.SARAIVA1")


def fetch_raw(name, id_alias, parms):
    """Fetch sem unwrap - retorna resposta bruta."""
    resp = api.session.post(
        f"{api.BASE_URL}/aql?a={name}",
        json={"q": [{"name": name, "id": id_alias, "parms": parms}]},
    )
    return resp.json().get(id_alias, resp.json())


# ============================================================
# 1. EXTRAIR MARCAÇÕES VIA AGENDAS (dia a dia)
# ============================================================
print("=" * 60)
print(f"EXTRAIR MARCAÇÕES (últimos {DIAS_ATRAS} dias)")
print("=" * 60)

hoje = date.today()
all_marcacoes = {}  # id_marcacao -> data
all_paciente_ids = set()
all_medico_ids = set()

dias_com_dados = 0
dias_sem_dados = 0

for i in range(DIAS_ATRAS):
    dt = (hoje - timedelta(days=i)).isoformat()
    try:
        result = fetch_raw("agendas.index", "lista", {"data": dt})
        if isinstance(result, dict) and "status" in result:
            result = result.get("data", result)
        if isinstance(result, dict):
            agendas = result.get("agendas", [])
            if not agendas:
                dias_sem_dados += 1
                continue

            dias_com_dados += 1
            for slot in agendas:
                marc = slot.get("marcacao")
                if not marc:
                    continue

                id_marc = marc.get("id_marcacao")
                if id_marc and id_marc not in all_marcacoes:
                    # Flatten marcação
                    flat = {}
                    for k, v in marc.items():
                        if isinstance(v, (dict, list)):
                            flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                        else:
                            flat[k] = v
                    # Adicionar dados do slot
                    flat["_slot_hora"] = slot.get("hora")
                    flat["_slot_status"] = slot.get("status")
                    flat["_slot_data"] = slot.get("data")
                    medico = slot.get("medico", {})
                    if isinstance(medico, dict):
                        flat["_medico_nome"] = medico.get("st_nome_exibicao", "")

                    all_marcacoes[id_marc] = flat

                    # Coletar IDs
                    pid = marc.get("id_paciente")
                    mid = marc.get("id_medico")
                    if pid:
                        all_paciente_ids.add(pid)
                    if mid:
                        all_medico_ids.add(mid)

            if i % 30 == 0:
                print(f"  Dia {dt}: {len(agendas)} slots | Total acumulado: {len(all_marcacoes)} marcações, {len(all_paciente_ids)} pacientes")
    except Exception as e:
        if i % 30 == 0:
            print(f"  Dia {dt}: ERRO - {e}")

print(f"\n  Resultado: {len(all_marcacoes)} marcações únicas")
print(f"  Pacientes encontrados: {len(all_paciente_ids)}")
print(f"  Médicos encontrados: {len(all_medico_ids)}")
print(f"  Dias com dados: {dias_com_dados} | Dias vazios: {dias_sem_dados}")

# ============================================================
# 2. BUSCAR PACIENTES ADICIONAIS POR NOME
# ============================================================
print("\n" + "=" * 60)
print("BUSCAR PACIENTES ADICIONAIS")
print("=" * 60)

# Buscar por sílabas comuns pra capturar pacientes que nunca agendaram
termos = [
    "maria", "ana", "jose", "joao", "antonio", "carlos",
    "francisco", "paulo", "pedro", "lucas", "marcos",
    "rafael", "gabriel", "fernando", "roberto", "daniel",
    "silva", "santos", "oliveira", "souza", "lima",
    "costa", "pereira", "rodrigues", "almeida", "ferreira",
    "nascimento", "carvalho", "araujo", "ribeiro", "gomes",
    "martins", "rocha", "medeiros", "barbosa", "dias",
    "rosa", "moreira", "vieira", "nunes", "reis",
    "al", "ba", "ca", "da", "el", "fa", "ga",
    "he", "in", "ju", "ke", "la", "ma", "na",
    "ol", "pa", "ra", "sa", "ta", "va", "wa",
]

for termo in termos:
    try:
        pacs = api.pacientes.buscar(termo)
        if isinstance(pacs, list):
            for p in pacs:
                pid = p.get("id_pessoa")
                if pid:
                    all_paciente_ids.add(pid)
    except:
        pass

print(f"  Total pacientes após busca complementar: {len(all_paciente_ids)}")

# ============================================================
# 3. DETALHAR CADA PACIENTE
# ============================================================
print("\n" + "=" * 60)
print(f"DETALHAR {len(all_paciente_ids)} PACIENTES")
print("=" * 60)

all_pacientes = []
erros = 0
for i, pid in enumerate(sorted(all_paciente_ids)):
    try:
        pac = api.pacientes.detalhar(pid)
        if isinstance(pac, dict):
            flat = {}
            for k, v in pac.items():
                if isinstance(v, (dict, list)):
                    flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                else:
                    flat[k] = v
            all_pacientes.append(flat)
    except:
        erros += 1

    if (i + 1) % 100 == 0:
        print(f"  {i+1}/{len(all_paciente_ids)} detalhados...")

print(f"  Pacientes detalhados: {len(all_pacientes)} | Erros: {erros}")

# ============================================================
# 4. BUSCAR ATENDIMENTOS DOS MARCAÇÕES
# ============================================================
print("\n" + "=" * 60)
print("EXTRAIR ATENDIMENTOS")
print("=" * 60)

atend_ids = set()
for marc in all_marcacoes.values():
    aid = marc.get("id_atendimento")
    if aid:
        atend_ids.add(aid)

print(f"  Atendimentos únicos: {len(atend_ids)}")

all_atendimentos = []
all_atp = []
all_anamneses = []
erros_atend = 0

for i, aid in enumerate(sorted(atend_ids)):
    try:
        result = fetch_raw("atendimentos.show", "item", {"id": aid})
        if isinstance(result, dict) and "status" in result:
            result = result.get("data", result)

        if isinstance(result, dict):
            atp = result.pop("atendimento_procedimento", None)

            # Flatten atendimento
            flat = {}
            for k, v in result.items():
                if isinstance(v, (dict, list)):
                    flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                else:
                    flat[k] = v
            all_atendimentos.append(flat)

            # Atendimento procedimento
            if atp and isinstance(atp, dict):
                anamnese = atp.pop("anamnese", None)
                atp_flat = {}
                for k, v in atp.items():
                    if isinstance(v, (dict, list)):
                        atp_flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                    else:
                        atp_flat[k] = v
                all_atp.append(atp_flat)

                if anamnese and isinstance(anamnese, dict):
                    ana_flat = {}
                    for k, v in anamnese.items():
                        if isinstance(v, (dict, list)):
                            ana_flat[k] = json.dumps(v, default=str, ensure_ascii=False)
                        else:
                            ana_flat[k] = v
                    all_anamneses.append(ana_flat)
    except:
        erros_atend += 1

    if (i + 1) % 100 == 0:
        print(f"  {i+1}/{len(atend_ids)} atendimentos...")

print(f"  Atendimentos: {len(all_atendimentos)}")
print(f"  Procedimentos: {len(all_atp)}")
print(f"  Anamneses: {len(all_anamneses)}")
print(f"  Erros: {erros_atend}")

# ============================================================
# 5. SALVAR NO POSTGRESQL
# ============================================================
print("\n" + "=" * 60)
print("SALVAR NO POSTGRESQL")
print("=" * 60)

conn = psycopg2.connect(**PG_CONFIG)
cur = conn.cursor()


def ensure_table(table_name, data_list):
    """Cria ou recria tabela com prefixo klingo_ e insere dados."""
    full_name = f"klingo_{table_name}"
    if not data_list:
        print(f"  ⚠️  {full_name}: sem dados")
        return 0

    all_keys = set()
    for item in data_list:
        all_keys.update(item.keys())
    cols = sorted(all_keys)

    cur.execute(f'DROP TABLE IF EXISTS "{full_name}"')

    col_defs = []
    for c in cols:
        sample = None
        for item in data_list:
            if item.get(c) is not None:
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

    cur.execute(f'CREATE TABLE "{full_name}" ({", ".join(col_defs)})')

    placeholders = ", ".join(["%s" for _ in cols])
    col_names = ", ".join([f'"{c}"' for c in cols])
    insert_sql = f'INSERT INTO "{full_name}" ({col_names}) VALUES ({placeholders})'

    count = 0
    for item in data_list:
        values = []
        for c in cols:
            v = item.get(c)
            if isinstance(v, bool):
                v = v
            elif isinstance(v, (dict, list)):
                v = json.dumps(v, default=str, ensure_ascii=False)
            values.append(v)
        cur.execute(insert_sql, values)
        count += 1

    conn.commit()
    print(f"  ✅ {full_name}: {count} registros ({len(cols)} colunas)")
    return count


total = 0
total += ensure_table("pacientes", all_pacientes)
total += ensure_table("marcacoes", list(all_marcacoes.values()))
total += ensure_table("atendimentos", all_atendimentos)
total += ensure_table("atendimento_procedimentos", all_atp)
total += ensure_table("anamneses", all_anamneses)

# ============================================================
# 6. ÍNDICES
# ============================================================
print("\n  Criando índices...")
indices = [
    'CREATE INDEX IF NOT EXISTS idx_kp_nome ON klingo_pacientes(st_nome)',
    'CREATE INDEX IF NOT EXISTS idx_kp_cpf ON klingo_pacientes(st_cpf)',
    'CREATE INDEX IF NOT EXISTS idx_km_paciente ON klingo_marcacoes(id_paciente)',
    'CREATE INDEX IF NOT EXISTS idx_km_medico ON klingo_marcacoes(id_medico)',
    'CREATE INDEX IF NOT EXISTS idx_km_data ON klingo_marcacoes(dt_inicio)',
    'CREATE INDEX IF NOT EXISTS idx_ka_paciente ON klingo_atendimentos(id_paciente)',
    'CREATE INDEX IF NOT EXISTS idx_ka_medico ON klingo_atendimentos(id_medico)',
    'CREATE INDEX IF NOT EXISTS idx_katp_atend ON klingo_atendimento_procedimentos(id_atendimento)',
    'CREATE INDEX IF NOT EXISTS idx_kan_atp ON klingo_anamneses(id_atendimento_procedimento)',
]
for idx in indices:
    try:
        cur.execute(idx)
    except Exception as e:
        pass
conn.commit()

# ============================================================
# RESUMO
# ============================================================
print("\n" + "=" * 60)
print("RESUMO FINAL")
print("=" * 60)

for tbl in ["klingo_pacientes", "klingo_marcacoes", "klingo_atendimentos",
            "klingo_atendimento_procedimentos", "klingo_anamneses"]:
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
        cnt = cur.fetchone()[0]
        print(f"  {tbl}: {cnt} registros")
    except:
        pass

print(f"\n  Total: {total} registros")
cur.close()
conn.close()
print("  Extração concluída!")
