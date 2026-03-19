---
title: Fluxo de Telemedicina
tags:
  - irb
  - fluxo
  - telemedicina
  - cabines
---

# Fluxo de Telemedicina

Atendimento remoto via cabines e ferramentas de video.

## Ferramentas

- [[Klingo]] / Google Meet - Conexao estavel
- [[Vsee]] - Backup (funciona com 9Kbps, tecnologia NASA)

## Cabines

- Cabines construidas em galpao, com:
  - Camera multidirecional
  - Microfone com cancelamento de ruido
  - Ar-condicionado
  - Adesivamento e janela
  - Impressora interna
- Usadas em areas remotas (Rondonia) com Starlink

## Fluxo

1. Paciente entra na cabine
2. Camera e microfone conectam com medico remoto
3. Conexao estavel → usa [[Klingo]]/Google Meet
4. Conexao instavel → fallback para [[Vsee]]
5. Medico faz consulta e laudo
6. Receituario impresso remotamente na impressora da cabine
7. Paciente recebe documento na hora

## Qualidade de Imagem

- [[Vsee]] prioriza qualidade para o paciente ver o medico (confianca)
- Se banda cai, medico mantem qualidade superior (diagnostico)
- Sem delay mesmo em 8-9 Mbps

## Observacao

Medicos em Rondonia atendem pacientes remotamente. Problema original: Starlink com 10-30 Mbps gerava imagem pixelada no Google Meet. [[Vsee]] resolveu.
