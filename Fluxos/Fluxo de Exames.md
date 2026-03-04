---
title: Fluxo de Exames
tags:
  - irb
  - fluxo
  - laboratorio
  - exames
---

# Fluxo de Exames

Processo de realizacao e entrega de resultados de exames.

## Sistemas Envolvidos

- [[Hilab]] - Urina
- [[Worklab]] - Sangue
- [[EDB]] - Respiratorio
- [[Klingo]] - Prontuario final

## Fluxo

1. Medico solicita exames (via [[Klingo]])
2. Paciente realiza exames
3. Cada tipo de exame vai para um sistema diferente:
   - Urina → [[Hilab]]
   - Sangue → [[Worklab]]
   - Respiratorio → [[EDB]]
4. Resultados consolidados manualmente no [[Klingo]]
5. Resultado entregue ao paciente

## Problema

Se paciente faz 3 tipos de exame, alguem precisa entrar em 3 sistemas diferentes, pegar os resultados e consolidar no [[Klingo]]. Processo manual e fragmentado.

## Radiologia

- [[MobileMed]] → envia para nuvem → [[Klingo]]
- [[LogicMedic]] → armazena localmente → [[Klingo]]
- [[Radiologia Dental]] → pendrive fisico (manual)
