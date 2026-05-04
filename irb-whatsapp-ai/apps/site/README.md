# IRB Site

O site institucional publico da IRB vive neste app.

## Stack

- Next.js App Router
- TypeScript
- export estatico via `output: \"export\"`

## Rotas oficiais

- `/`
- `/agendar/`
- `/pagamento/`
- `/confirmado/`
- `/especialidades/`
- `/equipe-medica/`

As URLs antigas em `.html` existem apenas como redirects configurados no Nginx.

## Comandos

```bash
pnpm --filter @irb/site dev
pnpm --filter @irb/site build
```

## Publicacao

O deploy do site esta documentado em [docs/SITE_DEPLOY.md](/Users/saraiva/Documents/IRB/irb-whatsapp-ai/docs/SITE_DEPLOY.md) e automatizado em `scripts/deploy-site.sh`.

## Regra de manutencao

Nao reintroduza paginas HTML soltas neste app. Se uma rota nova for criada, ela deve nascer dentro do App Router.
