---
title: Klingo
tags:
  - irb
  - sistema
  - erp
  - core
status: ativo
categoria: ERP
---

# Klingo

Sistema core medico da [[Ecossistema IRB|IRB]]. Gerencia prontuarios, agendamentos e atendimentos.

## Funcoes

- Prontuario eletronico do paciente
- Agendamento de consultas
- Atendimento medico
- Receituarios e atestados
- Integra com [[MobileMed]] (radiografia via nuvem)
- Recebe resultados de [[Hilab]], [[Worklab]] e [[EDB]]

## APIs Disponiveis

4 APIs confirmadas:
1. Cadastro de paciente
2. Autenticacao
3. Atualizacao de dados do paciente
4. Agendas

Ver [[API Klingo Limitada]] para restricoes.

## Problemas

- Fornecedor nao tem proatividade (chamados ficam parados)
- [[API Klingo Limitada]] - Poucas APIs, nao abrem mais
- Sistema legado implantado pelo Dr. Flavio (medico, nao TI)
- Nao tem webhook para notificacoes externas
- Nao integra nativamente com [[Sistema IRB]]
- Assinatura digital paga embutida (custo duplicado)

## Relacoes

- Pertence a [[ERPs]]
- Recebe dados de [[Hilab]], [[Worklab]], [[EDB]], [[MobileMed]], [[LogicMedic]]
- Usado na [[Jornada do Paciente]]
- Usado no [[Fluxo de Telemedicina]]
- Integracao futura com [[Sistema IRB]]
