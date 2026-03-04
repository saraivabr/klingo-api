---
title: API Klingo Limitada
tags:
  - irb
  - problema
  - integracao
  - api
---

# API Klingo Limitada

O [[Klingo]] tem APIs muito limitadas e o fornecedor nao abre mais integracao.

## APIs Disponiveis (4)

1. Cadastro de paciente
2. Autenticacao
3. Atualizacao de dados do paciente
4. Agendas

## Problemas

- Sem webhook (nao notifica sistemas externos)
- Fornecedor sem proatividade (chamados ficam parados)
- Nao abre novas APIs
- Sistema provavelmente unificado back+front (SaaS fechado)
- Poucas requisicoes externas, com gargalos

## Alternativas Exploradas

- Playwright/Puppeteer para capturar requisicoes do network
- Simulador de captacao via automacao de navegador
- Foram analisadas as requisicoes e "nao tem" mais endpoints

## Impacto

- [[Sistema IRB]] nao consegue integrar profundamente
- Dados precisam ser duplicados manualmente
- Impossivel criar fluxo automatizado completo

## Relacoes

- [[Klingo]]
- [[Sistema IRB]]
- [[Sem ERP Unificado]]
