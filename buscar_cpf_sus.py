"""
Busca CPF e Cartão SUS dos pacientes dos atendimentos com dados faltando.
"""
import sys
sys.path.insert(0, '/Users/saraiva/Documents/IRB')
from klingo_api import KlingoAPI

api = KlingoAPI(domain="irb")
api.login("FELLIPE.SARAIVA", "FELLIPE.SARAIVA1")

# Todos os atendimentos do relatório que precisam de CPF/SUS
# Formato: (id_atend, nome_paciente, data, procedimento, profissional, operadora)
atendimentos = [
    (3699, "ANTONIO DE SOUZA", "11/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "Particular"),
    (3718, "APARECIDO JOSE DA SILVA", "11/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "Particular"),
    (3851, "REBECA MOREIRA DA SILVA", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3856, "HADASSA MOREIRA DA SILVA", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3859, "DAVI RAACH BRANDAO PASSOS", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3860, "OLIVIA GABRIELLY DA SILVA MANFROI", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3861, "LAURA BUENO DE OLIVEIRA", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3865, "LAIS BUENO DE OLIVEIRA", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3866, "ETHAN GABRIEL OLIVEIRA RAMOS RODRIGUES", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3867, "MURILLO FERREIRA ROCHA", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3869, "HELENNA FERREIRA PRADO", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3871, "MARIA HELOISA CARDOSO SCATOLIM", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3872, "MAITE AGUIAR PINHEIRO", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3873, "NOAH MARTINS GOMES", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3876, "ARTHUR GABRYEL ASSUNCAO SOUZA", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3878, "ARTHUR VINICIUS DE SOUZA FURTADO", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3881, "JULIA BEATRIZ FERREIRA SILVA", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3884, "JOVANE KAUE PIRES DA SILVA", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3887, "KEVIN RYAN MARTINS DOS SANTOS", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3888, "ALICE FERREIRA NASCIMENTO", "13/02/2026", "Pediatria", "DRA BEATRIZ ANTUNES", "Particular"),
    (3932, "VALDIR VENSON", "13/02/2026", "Gastroenterologia", "DRA ANA TRAJANO", "Particular"),
    (3933, "KAYKI SACCHETTI DE OLIVEIRA", "13/02/2026", "Gastroenterologia", "DRA ANA TRAJANO", "Particular"),
    (3934, "NEUZA MIRANDA GONCALVES", "13/02/2026", "Gastroenterologia", "DRA ANA TRAJANO", "Particular"),
    (3935, "ANGELINA SAURIN", "13/02/2026", "Gastroenterologia", "DRA ANA TRAJANO", "Particular"),
    (3946, "MARCOS EMANUEL DOS SANTOS ALVARINTHO", "19/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (3947, "GENILTON MACIEL MUNIZ", "19/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (3948, "IRENE MENDES DOS SANTOS", "19/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (3949, "CARLOS ROBERTO MACAUBAS", "19/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (3950, "JEREMIAS ALVES DA SILVA", "19/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (3951, "IVANETE RODRIGUES", "19/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (3957, "DIEGO RODRIGUES", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3959, "ROSANGELA ALVES BORBA", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3960, "BRUNO JANEIRO DA SILVA", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3962, "FABIO JUNIOR DE CARVALHO", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3964, "DAVI RAFAEL MACHADO SILVA", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3965, "DEBORAH KETELLYN CARDOSO LOPES", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3966, "IGOR HENRIQUE OLIVEIRA SANTOS", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3967, "JOHN MICHAEL MATHEUS ARIAS", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3968, "YORHANE MACEDO ARRIGO", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3969, "ELIANE APARECIDA GOMES GONCALVES", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3971, "JOZIANE MARA MACEDO DA SILVA", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3972, "JOSILDO CLAUDINO DE MORAIS", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (3973, "JOSUE ALEXANDER ROSILLO CARTAYA", "19/02/2026", "Psiquiatria", "DRA PATRICIA BENTO", "Particular"),
    (4115, "NICOMERIA MEDEIROS SCHWENCK NETA", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "Particular"),
    (4117, "MAYCON CEZAR BRAGANCA TAVARES", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "Particular"),
    (4118, "MATHEUS DE LIMA SOUZA", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "Particular"),
    (4119, "RODRIGO HENRIQUE VERLY DA SILVA", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "Particular"),
    (4121, "MARIA HELENA DA SILVA", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "Particular"),
    (4126, "ELISIANE FERREIRA", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "Particular"),
    (4134, "DEOCLECIO CORREIA PEDROSO", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "Particular"),
    (4120, "TALIA SOUZA DE OLIVEIRA", "23/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (4127, "GABRIEL MATHEUS DOS SANTOS", "23/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (4129, "ANY IZABELY LEONEL DE SOUZA", "23/02/2026", "Neurologia", "DR ANGELO CAMPOS", "Particular"),
    (4135, "ADILSON ALVES ALMEIDA", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4136, "ZELIA MARIA DEMEDEIROS", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4139, "ADILCE GOMES DOSSANTOS", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4140, "NATALIA CLECIANE DE PAULA SOLIS", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "SUS"),
    (4141, "ROSA ROCHA DESOUZA", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4142, "TANIA JUDITE MIOTTI", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "SUS"),
    (4144, "SIRLEIDE PARENTE DESOUZA", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4145, "JOSILDO CLAUDINO DE MORAIS", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4146, "JOAO JOSE PEREIRA", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4148, "ORLEI MAGALHAES MOREIRA", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "SUS"),
    (4149, "LUCIANA FRONTELI BELONI", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "SUS"),
    (4150, "ISABELA BATISTANUNES", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4151, "ADRIANA MOREIRA CORSINI", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "SUS"),
    (4152, "VILMA DOS SANTOS", "23/02/2026", "Gastroenterologia", "DRA RAFAELA MAIA", "SUS"),
    (4153, "SABRINA XAVIER DIAS", "23/02/2026", "Psiquiatria", "DRA MAÍRA G MELO", "SUS"),
    (4154, "MARTINS FERREIRA CHAVES", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
    (4155, "ANGELA JULHO DA SILVA", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
    (4156, "LUCICLEIDE LOPES DA SILVA", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
    (4164, "ANDREIA ARRUDA", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
    (4165, "VERA LUCIA WOZINSKI", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
    (4170, "NIVERSINA GONCALVES DOS PASSOS", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
    (4172, "EDUARDO CARVALHO DE SOUZA", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
    (4175, "MARIA MARQUES RODRIGUES PESSOA", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
    (4176, "ENI AMARAL DA SILVA", "24/02/2026", "Gastroenterologia", "DRA ALICE FERREIRA", "SUS"),
]

def formatar_cpf(cpf_raw):
    if not cpf_raw:
        return ""
    s = str(cpf_raw).strip()
    # Remove não dígitos
    digits = ''.join(c for c in s if c.isdigit())
    if len(digits) == 11:
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
    return s

def formatar_sus(sus_raw):
    if not sus_raw:
        return ""
    s = str(sus_raw).strip()
    digits = ''.join(c for c in s if c.isdigit())
    if len(digits) == 15:
        return f"{digits[:3]} {digits[3:7]} {digits[7:11]} {digits[11:]}"
    return s

print(f"Buscando dados de {len(atendimentos)} atendimentos...\n")
sys.stdout.flush()

results = []
for (id_atend, nome, data, proc, prof, operadora) in atendimentos:
    try:
        atend = api.atendimentos.detalhar(id_atend)
        id_pac = atend.get("id_paciente")

        cpf = ""
        sus = ""

        if id_pac:
            pac = api.pacientes.detalhar(id_pac)
            cadastro = pac.get("cadastro", {}) or {}
            pu = pac.get("paciente_unidade", {}) or {}
            cpf = formatar_cpf(cadastro.get("st_cpf"))
            sus = formatar_sus(pu.get("st_sus"))

        results.append((id_atend, nome, data, proc, prof, operadora, cpf, sus, id_pac))
        status = "OK" if (cpf or sus) else "SEM_DADOS"
        print(f"[{status}] {id_atend} - {nome}: CPF={cpf or 'N/A'} | SUS={sus or 'N/A'}")
    except Exception as e:
        results.append((id_atend, nome, data, proc, prof, operadora, "ERRO", "ERRO", None))
        print(f"[ERRO] {id_atend} - {nome}: {e}")
    sys.stdout.flush()

# --- RELATÓRIO FINAL ---
print("\n\n" + "="*120)
print("RELATÓRIO: CPF E CARTÃO SUS DOS ATENDIMENTOS - FEVEREIRO 2026")
print("="*120)
print(f"{'ID':<8} {'PACIENTE':<45} {'DATA':<12} {'ESPECIALIDADE':<18} {'OPERADORA':<12} {'CPF':<16} {'CARTÃO SUS':<20} {'PROFISSIONAL'}")
print("-"*120)

tem_dados = []
sem_dados = []
for (id_atend, nome, data, proc, prof, operadora, cpf, sus, id_pac) in results:
    linha = f"{id_atend:<8} {nome:<45} {data:<12} {proc:<18} {operadora:<12} {cpf or 'NÃO CADASTRADO':<16} {sus or 'NÃO CADASTRADO':<20} {prof}"
    if cpf or sus:
        tem_dados.append(linha)
    else:
        sem_dados.append(linha)

print("\n--- COM DADOS ENCONTRADOS ---")
for l in tem_dados:
    print(l)

print(f"\n--- SEM DADOS NO SISTEMA ({len(sem_dados)} pacientes) ---")
for l in sem_dados:
    print(l)

print(f"\n{'='*120}")
print(f"RESUMO: {len(tem_dados)} pacientes com dados | {len(sem_dados)} pacientes sem CPF/SUS no sistema")
print(f"Total processado: {len(results)}")
