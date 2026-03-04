# Sync Klingo → SysVortex

Serviço de sincronização que **consulta dados do Klingo** e **alimenta o SysVortex**.

## 🚀 Quick Start

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Modo teste (executa uma vez com 5 registros)
pnpm dev

# Modo produção (executa continuamente)
MODE=production pnpm dev
```

## 📋 Variáveis de Ambiente

```env
# Klingo API
KLINGO_USER=seu_usuario
KLINGO_PASS=sua_senha
KLINGO_DOMAIN=irb
KLINGO_UNIDADE=1

# SysVortex API  
SYSVORTEX_BASE_URL=https://minhaempresa.sysvortex.com
SYSVORTEX_CLIENTE=minhaempresa
SYSVORTEX_TOKEN=seu_token
SYSVORTEX_UNIDADE=1

# Config
SYNC_ENABLED=true
SYNC_INTERVAL_MINUTES=15
MODE=test
```

## 🔄 O que é sincronizado?

### ✅ Pacientes
- **Origem**: Klingo `pacientes.index`
- **Destino**: SysVortex `/homecare/paciente`
- **Mapeamento**: CPF, nome, data nascimento, telefone, endereço, etc
- **Frequência**: Diariamente às 2h (carga completa) + a cada X minutos (batch de 50)

### ✅ Agendas
- **Origem**: Klingo `agendas.index`
- **Destino**: SysVortex `/homecare/agenda`
- **Mapeamento**: CPF paciente, data inicial, data final
- **Frequência**: A cada X minutos (configurável)

## 🧪 Modo Teste

Para testar sem impactar produção:

```bash
MODE=test pnpm dev
```

Isso irá:
- Executar **uma única vez**
- Sincronizar **apenas 5 registros** de cada tipo
- Exibir logs detalhados
- Sair automaticamente após conclusão

## 📊 Logs

Os logs mostram:
- ✅ Registros sincronizados com sucesso
- ❌ Erros durante sincronização
- ⏭️  Registros pulados (sem CPF, inválidos, etc)
- 📋 Estatísticas (total, sucesso, erros, tempo)

Exemplo:
```
🔄 Iniciando sincronização de pacientes...
📋 10 pacientes encontrados no Klingo
✅ João da Silva sincronizado
⏭️  Maria Santos - CPF inválido
✅ Sincronização concluída - 2.3s - 8 sucesso, 2 erros, 0 pulados
```

## 🏗️ Arquitetura

```
src/
├── adapters/
│   ├── klingo.adapter.ts      # Cliente Klingo API
│   └── sysvortex.adapter.ts   # Cliente SysVortex API
├── services/
│   └── transform.service.ts   # Transformação de dados
├── jobs/
│   ├── sync-patients.job.ts   # Job pacientes
│   └── sync-agendas.job.ts    # Job agendas
├── types/
│   └── sysvortex.ts           # Types do SysVortex
├── utils/
│   └── logger.ts              # Logger (Pino)
└── index.ts                   # Entry point
```

## 🔧 Troubleshooting

### Erro: "Token não encontrado"
- Verificar se `KLINGO_USER` e `KLINGO_PASS` estão corretos
- Verificar se domínio está correto (`KLINGO_DOMAIN=irb`)

### Erro: "SysVortex API offline"
- Verificar se `SYSVORTEX_BASE_URL` está correto
- Verificar se `SYSVORTEX_TOKEN` está válido
- Testar manualmente: `curl https://minhaempresa.sysvortex.com/FAMBER/api/logounidade`

### Pacientes/Agendas não sincronizam
- Verificar logs detalhados (`LOG_LEVEL=debug`)
- Verificar se CPFs estão válidos
- Verificar mapeamento de campos no `transform.service.ts`

## 📚 Documentação das APIs

- **Klingo**: Baseado em `klingo_api.py` (AQL queries)
- **SysVortex**: Baseado em `swagger.json` disponível em `/swagger/index.html`

## 🛠️ Desenvolvimento

```bash
# Watch mode (recarrega ao salvar)
pnpm dev

# Build
pnpm build

# Executar build
pnpm start

# Testes (em breve)
pnpm test
```

## 📦 Deploy

### Docker
```bash
docker build -t irb-sync-klingo .
docker run -d --env-file .env irb-sync-klingo
```

### PM2
```bash
pnpm build
pm2 start dist/index.js --name sync-klingo
pm2 save
```

### Systemd
```bash
sudo cp sync-klingo.service /etc/systemd/system/
sudo systemctl enable sync-klingo
sudo systemctl start sync-klingo
```

## ⚠️ Importante

- **NÃO** commitar o arquivo `.env` com credenciais
- **Testar** sempre no modo `MODE=test` antes de rodar em produção
- **Monitorar** logs para identificar erros
- **Validar** dados sincronizados no SysVortex manualmente

## 🤝 Contribuindo

Ao adicionar novos endpoints:

1. Adicionar método no adapter correspondente
2. Criar tipos em `types/`
3. Criar transformer em `transform.service.ts`
4. Criar job em `jobs/`
5. Integrar no `index.ts`
6. Testar com `MODE=test`
