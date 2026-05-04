# Deploy do Site IRB

Este documento cobre apenas o site publico em `apps/site`.

## Modelo atual

- O site usa Next.js com `output: "export"`.
- O artefato publicado e `apps/site/out`.
- O Nginx interno no servidor serve esse diretorio diretamente.
- Nao existe dependencia de processo Node para o site publico.

## Servidor

- Host SSH: `irb`
- Projeto remoto: `/opt/irb-whatsapp-ai`
- Site remoto: `/opt/irb-whatsapp-ai/apps/site`
- Saida publicada: `/opt/irb-whatsapp-ai/apps/site/out`

## Comando padrao

Na raiz do monorepo:

```bash
pnpm deploy:site
```

Esse script:

1. roda o build local do `apps/site`
2. sincroniza `apps/site` para o servidor via `rsync`
3. roda o build no servidor
4. valida a configuracao do Nginx

## Validacao manual

Depois do deploy, conferir:

```bash
curl -I https://irb.saraiva.ai/
curl -I https://irb.saraiva.ai/agendar/
curl -I https://irb.saraiva.ai/pagamento/
curl -I https://irb.saraiva.ai/confirmado/
curl -I https://irb.saraiva.ai/agendamento.html
curl -I https://irb.saraiva.ai/pagamento.html
curl -I https://irb.saraiva.ai/confirmado.html
```

Esperado:

- `/`, `/agendar/`, `/pagamento/` e `/confirmado/` retornam `200`
- os `.html` retornam `301` para as rotas novas

## Nginx esperado

Camada publica:

- `irb.saraiva.ai` proxia para `127.0.0.1:8090`
- tambem intercepta `/agendamento.html`, `/pagamento.html` e `/confirmado.html` para redirects limpos

Camada interna:

- `root /opt/irb-whatsapp-ai/apps/site/out;`
- `/agendar/`, `/pagamento/` e `/confirmado/` apontam para os `index.html` exportados
- `absolute_redirect off;`
- `port_in_redirect off;`

## Observacoes

- `irb-site.service` deve permanecer desativado enquanto o site usar export estatico.
- Se o site voltar a exigir SSR, o modelo de deploy precisa mudar junto com o Nginx.
