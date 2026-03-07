# Scripts de Migração e Manutenção

## MongoDB Index Migration

### Propósito
Adiciona índices críticos de performance à collection `conversations` do MongoDB.

**Performance esperada:**
- Query time: 300ms → 5-10ms (30-60x mais rápido)
- Cron job `appointment-confirmation`: 15s → 2s (7-8x mais rápido)

### Índices Criados

1. **`{ patientPhone: 1, lastMessageAt: -1 }`** (compound index)
   - Usado em: Lookup de conversas por telefone + ordenação
   - Queries beneficiadas: `findOne({ patientPhone }).sort({ lastMessageAt: -1 })`

2. **`{ lastMessageAt: -1 }`** (single field index)
   - Usado em: Ordenação geral de conversas
   - Queries beneficiadas: Listagem de conversas recentes

### Como Executar

#### Método 1: Via npm script (Recomendado)

```bash
# Com MongoDB URI do .env
npm run db:indexes

# Com URI customizada
MONGO_URI=mongodb://user:pass@host:27017/db npm run db:indexes
```

#### Método 2: Direto via Node

```bash
# Local
node scripts/add-mongodb-indexes.js

# Produção
MONGO_URI=mongodb://prod-uri node scripts/add-mongodb-indexes.js
```

#### Método 3: Via mongosh (Manual)

```bash
mongosh $MONGO_URI

# No shell do MongoDB:
use irb_whatsapp

db.conversations.createIndex(
  { patientPhone: 1, lastMessageAt: -1 },
  { name: 'patientPhone_lastMessageAt', background: true }
)

db.conversations.createIndex(
  { lastMessageAt: -1 },
  { name: 'lastMessageAt', background: true }
)

# Verificar índices
db.conversations.getIndexes()
```

### Verificação

O script automaticamente verifica se os índices estão sendo usados:

```bash
node scripts/add-mongodb-indexes.js
```

**Output esperado:**
```
🔗 Connecting to MongoDB...
✅ Connected to MongoDB

📊 Current indexes:
   - _id_: {"_id":1}

🔨 Creating index: { patientPhone: 1, lastMessageAt: -1 }
✅ Index created: patientPhone_lastMessageAt

🔨 Creating index: { lastMessageAt: -1 }
✅ Index created: lastMessageAt

📊 Updated indexes:
   - _id_: {"_id":1}
   - patientPhone_lastMessageAt: {"patientPhone":1,"lastMessageAt":-1}
   - lastMessageAt: {"lastMessageAt":-1}

🔍 Verifying index usage...
✅ Query is using index: patientPhone_lastMessageAt
   Documents examined: 1
   Execution time: 3ms

🎉 MongoDB indexes successfully created!

Expected performance improvement:
   - Query time: 300ms → 5-10ms (30-60x faster)
   - Cron job duration: 15s → 2s (7-8x faster)
```

### Rollback

Para remover os índices (se necessário):

```bash
mongosh $MONGO_URI

use irb_whatsapp
db.conversations.dropIndex('patientPhone_lastMessageAt')
db.conversations.dropIndex('lastMessageAt')
```

**⚠️ Atenção**: Não remova o índice `_id_` (índice padrão do MongoDB)

### Troubleshooting

#### Erro: "Index already exists"
```
MongoServerError: Index already exists with a different name
```

**Solução**: Os índices já foram criados. Verifique com:
```bash
mongosh $MONGO_URI --eval "db.conversations.getIndexes()"
```

#### Erro: "Authentication failed"
```
MongoServerError: Authentication failed
```

**Solução**: Verifique credenciais no `MONGO_URI`:
```bash
# Formato correto
MONGO_URI=mongodb://username:password@host:27017/database
```

#### Erro: "Connection timed out"
```
MongoServerError: connect ETIMEDOUT
```

**Solução**: 
1. Verifique se MongoDB está rodando: `docker ps` ou `systemctl status mongod`
2. Verifique firewall/network
3. Teste conexão: `mongosh $MONGO_URI --eval "db.adminCommand('ping')"`

### Performance Testing

Após criar os índices, teste a performance:

```javascript
// Antes dos índices (lento)
const start = Date.now();
const conv = await ConversationModel.findOne({ patientPhone: '5511999999999' })
  .sort({ lastMessageAt: -1 });
console.log(`Time: ${Date.now() - start}ms`);
// Esperado: ~300ms

// Depois dos índices (rápido)
const start = Date.now();
const conv = await ConversationModel.findOne({ patientPhone: '5511999999999' })
  .sort({ lastMessageAt: -1 });
console.log(`Time: ${Date.now() - start}ms`);
// Esperado: ~5-10ms
```

### Adicionar ao package.json

```json
{
  "scripts": {
    "db:indexes": "node scripts/add-mongodb-indexes.js"
  }
}
```

---

## Próximos Scripts (Futuro)

- `add-postgresql-indexes.sql` - Índices para PostgreSQL
- `seed-test-data.js` - Dados de teste
- `cleanup-old-conversations.js` - Limpeza de conversas antigas
- `export-analytics.js` - Exportar dados para análise
