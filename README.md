# Klingo API Client

Wrapper Python completo para a API do sistema Klingo (IRB Prime Care), obtido via engenharia reversa do frontend.

## Instalação

```bash
pip install requests
```

## Uso Rápido

```python
from klingo_api import KlingoAPI

api = KlingoAPI(domain="irb")
api.login("USUARIO", "SENHA")

# Buscar pacientes
pacientes = api.pacientes.buscar("João")

# Listar agendas do dia
agendas = api.agendas.listar(data="2026-02-18")

# Listar médicos ativos
medicos = api.medicos.listar()

# Detalhar um paciente
paciente = api.pacientes.detalhar(id_paciente=123)
```

## Módulos Disponíveis

| Módulo | Descrição | Funções |
|---|---|---|
| `pacientes` | Gerenciamento de pacientes | `buscar`, `detalhar`, `criar`, `atualizar`, `retornos` |
| `agendas` | Agendamentos | `listar`, `agendar`, `cancelar`, `reservar`, `horarios_medico`, `recorrencia` |
| `marcacoes` | Marcações | `stats`, `listar`, `detalhar`, `iniciar` |
| `atendimentos` | Atendimentos | `criar`, `detalhar`, `chamar`, `iniciar`, `finalizar` |
| `medicos` | Profissionais | `listar`, `horarios` |
| `especialidades` | Especialidades médicas | `listar` |
| `operadoras` | Convênios/Operadoras | `listar`, `detalhar`, `config` |
| `financeiro` | Financeiro | `configs`, `lancamentos_tags`, `formas_pagamento`, `impostos` |
| `pagamentos` | Pagamentos | `pode_realizar`, `adiantamentos`, `responsaveis` |
| `faturamento` | Faturamento/TISS | `classes_procedimento`, `tabelas_versao`, `tiss_gerar_json` |
| `suprimentos` | Estoque | `tipos_movimentacao`, `solicitacoes`, `itens_tags`, `locais` |
| `laudos` | Laudos | `filas`, `status_laudos` |
| `autorizacoes` | Autorizações | `filas` |
| `crm` | CRM/Leads | `filas_leads`, `orcamentos` |
| `relatorios` | Relatórios | `listar`, `executar`, `pagina`, `dashboards` |
| `pep` | Prontuário Eletrônico | `carregar`, `historico`, `avulsos`, `pode_avulso` |
| `configuracoes` | Configurações | `listar`, `obter`, `verificar` |
| `usuarios` | Usuários/Permissões | `tem_permissao`, `tem_permissao_acesso`, `listar` |
| `cadastros` | Cadastros auxiliares | `cep`, `estados`, `cidades`, `cids`, `procedimentos`, `medicamentos`, `planos`, etc. |
| `tarefas` | Tarefas | `listar` |

## Multi-Query

Execute várias consultas em uma única requisição HTTP:

```python
results = api._aql_multi([
    {"name": "medicos.index", "id": "medicos", "parms": {"ativos": True}},
    {"name": "especialidades.index", "id": "especialidades", "parms": {"ativadas": True}},
    {"name": "operadoras.index", "id": "operadoras"},
])

medicos = results["medicos"]["data"]
especialidades = results["especialidades"]["data"]
operadoras = results["operadoras"]["data"]
```

## Endpoints Não Mapeados

Para qualquer endpoint AQL que não esteja nos módulos:

```python
# Query genérica
resultado = api.aql_raw("qualquer_entidade.qualquer_acao", {"param": "valor"})
```

## Detalhes Técnicos

- **API Base**: `https://api.klingo.app/api/`
- **Autenticação**: JWT Bearer Token via POST `/api/login`
- **Protocolo**: AQL (Application Query Language) - todas as operações via POST para `/api/aql`
- **Headers**: `X-DOMAIN`, `X-PORTAL`, `X-UNIDADE`, `Authorization: Bearer <token>`

## Reutilizar Sessão

```python
# Salvar token para reutilizar depois
token = api.token

# Em outra sessão
api2 = KlingoAPI(domain="irb")
api2.set_token(token)  # Sem precisar logar novamente (válido por 10h)
```
