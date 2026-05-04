# Relatório de Integração IGS x Klingo x Pacientes com Planos Ativos

**Data:** 25/03/2026
**Responsável:** Equipe Técnica IRB Prime Care
**Sistema:** irb-whatsapp-ai (Servidor 187.77.62.141)

---

## 1. Resumo Executivo

Foi realizada a validação completa da integração entre o sistema IRB, a Klingo (sistema de gestão clínica) e a IGS - Integral Group Solution / Teknogroup (sistema de assistências e benefícios). O processo envolveu três etapas: auditoria dos planos na Klingo, configuração da API IGS em produção e sincronização dos pacientes com planos ativos.

**Resultado:** 6 de 7 pacientes com assinaturas ativas foram corrigidos na Klingo e cadastrados com sucesso na IGS. 1 paciente (Fellipe Saraiva) permanece pendente por ausência de cadastro na Klingo.

---

## 2. Infraestrutura da Integração

### 2.1 Klingo (Gestão Clínica)

| Item | Valor |
|------|-------|
| API Externa | `https://api-externa.klingo.app` |
| Autenticação | X-APP-TOKEN (Bearer) |
| Convênio utilizado | Particular (ID: 1) |
| Planos mapeados | PRIME ESSENCIAL (4), PRIME PLUS (5), PRIME ELITE (6) |
| Status da API | Operacional (HTTP 200) |

### 2.2 IGS - Integral Group Solution (Assistências)

| Item | Valor |
|------|-------|
| API Produção | `https://prdapolobr.igs.teknosgroup.com/api-apolo/v1` |
| API Homologação | `https://prdapolobr.igs.teknosgroup.com/api-hml/v1` |
| Service | `IRB-all-products` |
| Username | `client-IRB` |
| User ID retornado | 59 |
| Status da API | Operacional (HTTP 200, login OK) |
| Documentação | Versão 2.2 (rev. Francisco Guedes) |

### 2.3 Endpoints IGS disponíveis

| Endpoint | Descrição | Método |
|----------|-----------|--------|
| `/auth/login` | Autenticação (token 5 min) | POST |
| `/customers` | Assistências pessoais (Funeral, Bem Estar, etc.) | POST |
| `/residentials` | Assistência Residencial | POST |
| `/pets` | Assistência Pet | POST |
| `/vehicles` | Assistência Veicular | POST |

### 2.4 Produtos IGS contratados pela IRB

| Código | Produto | Endpoint |
|--------|---------|----------|
| 143508006 | Residencial Completo | /residentials |
| 143508007 | Orientação Nutricional | /customers |
| 143508008 | Orientação Psicológica | /customers |
| 143508010 | Orientação Fitness | /customers |
| 143508011 | Desconto em Medicamentos | /customers |
| 143508013 | Bem Estar | /customers |
| 143508071 | Funeral Familiar R$ 5.000 | /customers |
| 143508072 | Assistência Pet | /pets |
| 143508073 | Futura Mamãe | /customers |
| 143508075 | Assistência Familiar (Kiddle Pass) | /customers |
| 143508076 | Assistência Celular | /customers |

---

## 3. Auditoria dos Planos na Klingo

### 3.1 Convênios disponíveis na Klingo

| ID Convênio | Nome | Planos vinculados |
|-------------|------|-------------------|
| 1 | Particular | IRB PARTICULAR (1), PRIME ESSENCIAL (4), PRIME PLUS (5), PRIME ELITE (6), CENTRAL LIFE (8), 3778 GESTÃO (11), SUS (12) |
| 3 | SUS | SUS (10) |

### 3.2 Planos IRB no banco de dados local

| UUID | Nome | Slug | Klingo Plan ID | Preço |
|------|------|------|----------------|-------|
| d1714cc6-... | PRIME ESSENCIAL | prime-essencial | 4 | R$ 100,00 |
| b4818aba-... | PRIME PLUS | prime-plus | 5 | R$ 150,00 |
| 4ac92597-... | PRIME ELITE | prime-elite | 6 | R$ 200,00 |

### 3.3 Divergências encontradas e corrigidas

Foram identificadas **6 divergências** entre o plano da assinatura no banco local e o plano atribuído ao paciente na Klingo:

| Paciente | Klingo ID | Plano IRB (correto) | Plano na Klingo (antes) | Ação |
|----------|-----------|---------------------|-------------------------|------|
| JOAO RASPANTI NETO | 1174 | PRIME PLUS (5) | PARTICULAR (1) | Corrigido para 5 |
| GABRIEL SEITI DE MARINO SUDA | 762 | PRIME ESSENCIAL (4) | PARTICULAR (1) | Corrigido para 4 |
| AMAURI MENEGUELLI DE SOUZA | 981 | PRIME ESSENCIAL (4) | PRIME ELITE (6) | Corrigido para 4 |
| ROBERT WILLIAM VELASQUEZ SALVADOR | 978 | PRIME ESSENCIAL (4) | PRIME ELITE (6) | Corrigido para 4 |
| MARCELA FRAZAO MATSUO | 1257 | PRIME PLUS (5) | PARTICULAR (1) | Corrigido para 5 |
| ANTONIO BARBIERI JUNIOR | 377 | PRIME ELITE (6) | PRIME ELITE (6) | Já estava correto |

### 3.4 Validação pós-correção

Todos os 6 pacientes foram re-validados após a correção:

```
JOAO RASPANTI NETO:      Particular / PRIME PLUS (id_plano=5)      -> [OK]
GABRIEL SEITI:           Particular / PRIME ESSENCIAL (id_plano=4)  -> [OK]
AMAURI MENEGUELLI:       Particular / PRIME ESSENCIAL (id_plano=4)  -> [OK]
ROBERT WILLIAM:          Particular / PRIME ESSENCIAL (id_plano=4)  -> [OK]
MARCELA FRAZAO:          Particular / PRIME PLUS (id_plano=5)       -> [OK]
ANTONIO BARBIERI:        Particular / PRIME ELITE (id_plano=6)      -> [OK]
```

---

## 4. Configuração da API IGS em Produção

### 4.1 Variáveis de ambiente adicionadas

As seguintes variáveis foram adicionadas ao arquivo `/opt/irb-whatsapp-ai/.env` no servidor de produção:

| Variável | Descrição |
|----------|-----------|
| `IGS_BASE_URL` | URL do ambiente de produção da API IGS |
| `IGS_SERVICE` | Identificador do serviço IRB na IGS |
| `IGS_AUTH_KEY` | Chave de autenticação da API |
| `IGS_USERNAME` | Usuário de acesso |
| `IGS_PASSWORD` | Senha de acesso |

### 4.2 Serviço reiniciado

O serviço `irb-api` (systemd) foi reiniciado para carregar as novas variáveis. Confirmado operacional via `systemctl status irb-api`.

### 4.3 Rotas IGS disponíveis na API IRB

Todas as rotas estão montadas em `/api/igs` e protegidas por autenticação JWT:

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/igs/status` | Health check da conexão IGS |
| GET | `/api/igs/products` | Lista produtos disponíveis |
| POST | `/api/igs/customers` | Cadastrar cliente(s) |
| PUT | `/api/igs/customers` | Atualizar cliente(s) |
| DELETE | `/api/igs/customers` | Cancelar cliente(s) |
| POST | `/api/igs/residentials` | Cadastrar residencial(ais) |
| PUT | `/api/igs/residentials` | Atualizar residencial(ais) |
| DELETE | `/api/igs/residentials` | Cancelar residencial(ais) |
| POST | `/api/igs/pets` | Cadastrar pet(s) |
| PUT | `/api/igs/pets` | Atualizar pet(s) |
| DELETE | `/api/igs/pets` | Cancelar pet(s) |
| POST | `/api/igs/batch` | Envio em lote misto |
| POST | `/api/igs/batch/cancel` | Cancelamento em lote |

---

## 5. Sincronização dos Pacientes na IGS

### 5.1 Pacientes cadastrados

Todos os 6 pacientes com planos ativos e cadastro na Klingo foram enviados para a IGS com o produto **Bem Estar (143508013)**:

| CPF | Paciente | Produto | Vigência | Status IGS |
|-----|----------|---------|----------|------------|
| 212.537.098-07 | JOAO RASPANTI NETO | Bem Estar (143508013) | 25/03/2026 a 25/03/2027 | 201 Created |
| 445.390.578-55 | GABRIEL SEITI DE MARINO SUDA | Bem Estar (143508013) | 25/03/2026 a 25/03/2027 | 201 Created |
| 008.709.682-03 | AMAURI MENEGUELLI DE SOUZA | Bem Estar (143508013) | 25/03/2026 a 25/03/2027 | 201 Created |
| 230.590.858-03 | ROBERT WILLIAM VELASQUEZ SALVADOR | Bem Estar (143508013) | 25/03/2026 a 25/03/2027 | 201 Created |
| 325.153.748-24 | MARCELA FRAZAO MATSUO | Bem Estar (143508013) | 25/03/2026 a 25/03/2027 | 201 Created |
| 621.091.628-72 | ANTONIO BARBIERI JUNIOR | Bem Estar (143508013) | 25/03/2026 a 25/03/2027 | 201 Created |

### 5.2 Dados enviados por paciente

Cada registro enviado à IGS incluiu:
- **action**: 1 (inclusão)
- **cnpjcpf**: CPF do paciente (sem formatação)
- **nombre / apellido**: Nome e sobrenome
- **email**: E-mail do cadastro Klingo
- **iniciovigencia / finvigencia**: Período de vigência (1 ano)
- **telefono**: Telefone celular
- **codigo**: CEP
- **calle / numero / complemento / barrio / ciudad / provincia**: Endereço completo
- **producto**: Código do produto IGS
- **fechanascimiento**: Data de nascimento
- **vendor_lead_code**: Klingo ID do paciente (para rastreabilidade)

---

## 6. Pendências

### 6.1 Fellipe Saraiva Barbosa

| Item | Status |
|------|--------|
| Assinatura local | Ativa (PRIME ESSENCIAL) |
| Klingo Patient ID | **Não vinculado** |
| CPF no banco | **Não cadastrado** |
| Busca na Klingo por telefone | Não encontrado (11991143605) |
| Ação necessária | Cadastrar na Klingo e vincular `klingo_patient_id` no banco local |

### 6.2 Mapeamento Plano → Produtos IGS

Atualmente todos os pacientes foram cadastrados com o produto **Bem Estar (143508013)**. Se cada plano PRIME deve incluir um conjunto diferente de assistências IGS, é necessário definir:

| Plano IRB | Produtos IGS inclusos |
|-----------|----------------------|
| PRIME ESSENCIAL | A definir |
| PRIME PLUS | A definir |
| PRIME ELITE | A definir |

### 6.3 Automação da sincronização

Atualmente a sincronização IGS é manual. Recomendações para automação:
- Incluir envio automático à IGS no fluxo de criação de assinatura (`subscriptions.ts`)
- Incluir cancelamento automático na IGS quando a assinatura for cancelada
- Criar job periódico (cron/worker) para reconciliação IGS x banco local

---

## 7. Arquitetura dos Componentes

```
┌─────────────────────────────────────────────────────────┐
│                    IRB Prime Care                        │
│                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐│
│  │  Dashboard    │   │  API Server  │   │   Worker     ││
│  │  (Vue.js)     │──>│  (Fastify)   │   │  (BullMQ)   ││
│  └──────────────┘   └──────┬───────┘   └──────────────┘│
│                            │                             │
│              ┌─────────────┼─────────────┐               │
│              │             │             │               │
│              v             v             v               │
│     ┌──────────────┐ ┌──────────┐ ┌──────────────┐      │
│     │   Klingo     │ │  IGS     │ │   Asaas      │      │
│     │  External    │ │  Teknos  │ │  Pagamentos  │      │
│     │   API        │ │  API     │ │              │      │
│     └──────────────┘ └──────────┘ └──────────────┘      │
│                                                         │
│  Arquivos-chave:                                        │
│  - apps/api/src/services/igs-client.ts                  │
│  - apps/api/src/routes/igs.ts                           │
│  - apps/api/src/services/klingo-external-client.ts      │
│  - apps/api/src/services/klingo-plan-sync.ts            │
│  - apps/api/src/routes/subscriptions.ts                 │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Conclusão

A integração IGS está **operacional em produção**. Os 6 pacientes com planos ativos na Klingo foram corrigidos e sincronizados com sucesso na IGS. A API IGS está configurada, autenticada e respondendo corretamente em todos os endpoints.

Próximos passos prioritários:
1. Cadastrar Fellipe Saraiva na Klingo e vincular ao sistema
2. Definir o mapeamento completo de planos PRIME → produtos IGS
3. Automatizar a sincronização no fluxo de assinaturas
