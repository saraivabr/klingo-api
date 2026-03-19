---
title: Sem ERP Unificado
tags:
  - irb
  - problema
  - critico
---

# Sem ERP Unificado

A IRB opera com 8+ sistemas em paralelo sem integracao. Cada departamento tem seu proprio sistema isolado.

## Sistemas Atuais

- [[Klingo]] - Core medico
- [[Sistema IRB]] - Em desenvolvimento
- [[Controle Odonto IRB]] + [[Controle Odonto IST]] + [[Capim]] - Odontologia
- [[Hilab]] + [[Worklab]] + [[EDB]] - Laboratorio
- [[SOC]] - Ocupacional
- Excel - Financeiro

## Consequencias

- Dados duplicados e inconsistentes
- Retrabalho constante
- Impossivel ter visao unica do paciente
- [[Metabase]] instalado mas sem dados para BI
- Cada sistema tem CRM proprio → [[Redundancia de Sistemas]]

## Solucao Proposta

Hub centralizado:
- PostgreSQL como banco unico
- ElasticSearch para busca inteligente (entende sinonimos)
- Redis para cache e velocidade
- Todas as fontes alimentam o hub
- [[Metabase]] consome dados do hub

## Relacao com Alan (TI)

Alan esta ha 3 meses na IRB. Mapeou todo o ecossistema. Reconhece que foi crescendo organicamente ("coloca um livro embaixo da cadeira").
