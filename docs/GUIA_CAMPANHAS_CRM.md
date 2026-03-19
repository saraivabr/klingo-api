# Guia de Configuracao de Campanhas - CRM IRB Prime Care

> Guia pratico para configurar campanhas de marketing com rastreamento de leads via WhatsApp no sistema CRM da IRB Prime Care.

---

## 1. Visao Geral do Fluxo

### Como funciona o rastreamento automatico

```
 CAMPANHA (Google/Meta/Site)
       |
       v
 LANDING PAGE (com UTMs)
       |
       v
 BOTAO WHATSAPP
 wa.me/5517997796014?text=CODIGO
       |
       v
 PACIENTE ENVIA MENSAGEM
 "ORT001" ou "Oi, vi no Google..."
       |
       v
 WORKER (message-intake.ts)
   |
   +---> detectCampaign() analisa a mensagem
   |       |
   |       +---> Regex: /\b([A-Z]{2,5}\d{2,5})\b/
   |       |     Busca codigo no banco (ex: ORT001)
   |       |
   |       +---> Texto livre: "vi no google", "vi no instagram"
   |             Classifica por palavras-chave
   |
   +---> Cria PACIENTE (patients) com utm_source, utm_medium, utm_campaign
   |
   +---> Cria LEAD no pipeline (leads) vinculado a campanha
   |
   +---> Julia (IA) responde automaticamente
       |
       v
 LEAD APARECE NO KANBAN DO CRM
 (Dashboard > CRM > Pipeline)
```

### Regra de deteccao

O sistema usa duas estrategias para identificar a origem do lead:

1. **Codigo da campanha** (prioridade): Se a primeira mensagem contem um codigo como `ORT001`, `META15`, `SITE01`, o sistema busca na tabela `campaigns` por esse codigo exato (status = `active`).

2. **Palavras-chave no texto**: Se nao encontrou codigo, analisa o texto:
   - "vi no google" / "anuncio google" --> `google_ads`
   - "vi no instagram" / "vi no facebook" --> `meta_ads`
   - "site" / "vi no site" --> `site`
   - "indicacao" / "indicacao" --> `indicacao`
   - Nenhum match --> `whatsapp_organic`

**Formato do codigo**: 2 a 5 letras maiusculas + 2 a 5 numeros (regex: `[A-Z]{2,5}\d{2,5}`)

---

## 2. Criando Campanhas no CRM

### Passo a passo

1. Acesse o Dashboard: `https://irb.klingo.app` (ou o endereco do dashboard)
2. No menu lateral, clique em **CRM > Campanhas**
3. Clique no botao **"Nova campanha"** (canto superior direito)
4. Preencha o formulario:

| Campo | Descricao | Obrigatorio |
|-------|-----------|:-----------:|
| **Nome** | Nome descritivo da campanha | Sim |
| **Codigo (UTM)** | Codigo unico para rastreamento (ex: ORT001) | Sim |
| **Canal** | Google, Meta, Site, E-mail ou Outro | Nao |
| **Midia** | Tipo de midia: cpc, social, organic | Nao |
| **Landing page** | URL da pagina de destino | Nao |
| **Orcamento (R$)** | Valor investido na campanha | Nao |
| **Inicio / Fim** | Periodo de veiculacao | Nao |

5. Clique em **"Criar campanha"**
6. A campanha aparecera na lista com status **Ativa**

### Campanhas recomendadas para a IRB

Cadastre todas as campanhas abaixo no CRM:

#### Google Ads

| Nome | Codigo | Canal | Midia |
|------|--------|-------|-------|
| Google Ads - Ortodontia | `ORT001` | Google | cpc |
| Google Ads - Implante | `IMP001` | Google | cpc |
| Google Ads - Clinico Geral | `CLI001` | Google | cpc |
| Google Ads - Estetica | `EST001` | Google | cpc |

#### Meta Ads (Instagram/Facebook)

| Nome | Codigo | Canal | Midia |
|------|--------|-------|-------|
| Meta Ads - Always On #1 | `META01` | Meta | social |
| Meta Ads - Always On #2 | `META02` | Meta | social |
| Meta Ads - Always On #3 | `META03` | Meta | social |
| Meta Ads - Always On #4 | `META04` | Meta | social |
| Meta Ads - Always On #5 | `META05` | Meta | social |
| Meta Ads - Always On #6 | `META06` | Meta | social |
| Meta Ads - Always On #7 | `META07` | Meta | social |
| Meta Ads - Always On #8 | `META08` | Meta | social |
| Meta Ads - Always On #9 | `META09` | Meta | social |
| Meta Ads - Always On #10 | `META10` | Meta | social |
| Meta Ads - Always On #11 | `META11` | Meta | social |
| Meta Ads - Always On #12 | `META12` | Meta | social |
| Meta Ads - Always On #13 | `META13` | Meta | social |
| Meta Ads - Always On #14 | `META14` | Meta | social |
| Meta Ads - Always On #15 | `META15` | Meta | social |
| Meta Ads - Always On #16 | `META16` | Meta | social |
| Meta Ads - Always On #17 | `META17` | Meta | social |
| Meta Ads - Always On #18 | `META18` | Meta | social |
| Meta Ads - Always On #19 | `META19` | Meta | social |
| Meta Ads - Always On #20 | `META20` | Meta | social |
| Meta Ads - Always On #21 | `META21` | Meta | social |
| Meta Ads - Always On #22 | `META22` | Meta | social |
| Meta Ads - Always On #23 | `META23` | Meta | social |
| Meta Ads - Always On #24 | `META24` | Meta | social |
| Meta Ads - Always On #25 | `META25` | Meta | social |
| Meta Ads - Always On #26 | `META26` | Meta | social |

#### Site e Indicacao

| Nome | Codigo | Canal | Midia |
|------|--------|-------|-------|
| Site - Botao Principal | `SITE01` | Site | organic |
| Site - Banner Promocao | `SITE02` | Site | organic |
| Indicacao | `IND001` | Outro | indicacao |

---

## 3. Configurando os Links WhatsApp

### Formato padrao do link

```
https://wa.me/5517997796014?text=CODIGO
```

O paciente clica no link, o WhatsApp abre com a mensagem pre-preenchida contendo o codigo da campanha. Quando ele envia, o sistema detecta automaticamente.

### Tabela completa de links

#### Google Ads

| Campanha | Link WhatsApp |
|----------|---------------|
| Ortodontia | `https://wa.me/5517997796014?text=ORT001` |
| Implante | `https://wa.me/5517997796014?text=IMP001` |
| Clinico Geral | `https://wa.me/5517997796014?text=CLI001` |
| Estetica | `https://wa.me/5517997796014?text=EST001` |

#### Meta Ads

| Campanha | Link WhatsApp |
|----------|---------------|
| Always On #1 | `https://wa.me/5517997796014?text=META01` |
| Always On #2 | `https://wa.me/5517997796014?text=META02` |
| Always On #3 | `https://wa.me/5517997796014?text=META03` |
| Always On #4 | `https://wa.me/5517997796014?text=META04` |
| Always On #5 | `https://wa.me/5517997796014?text=META05` |
| Always On #6 | `https://wa.me/5517997796014?text=META06` |
| Always On #7 | `https://wa.me/5517997796014?text=META07` |
| Always On #8 | `https://wa.me/5517997796014?text=META08` |
| Always On #9 | `https://wa.me/5517997796014?text=META09` |
| Always On #10 | `https://wa.me/5517997796014?text=META10` |
| Always On #11 | `https://wa.me/5517997796014?text=META11` |
| Always On #12 | `https://wa.me/5517997796014?text=META12` |
| Always On #13 | `https://wa.me/5517997796014?text=META13` |
| Always On #14 | `https://wa.me/5517997796014?text=META14` |
| Always On #15 | `https://wa.me/5517997796014?text=META15` |
| Always On #16 | `https://wa.me/5517997796014?text=META16` |
| Always On #17 | `https://wa.me/5517997796014?text=META17` |
| Always On #18 | `https://wa.me/5517997796014?text=META18` |
| Always On #19 | `https://wa.me/5517997796014?text=META19` |
| Always On #20 | `https://wa.me/5517997796014?text=META20` |
| Always On #21 | `https://wa.me/5517997796014?text=META21` |
| Always On #22 | `https://wa.me/5517997796014?text=META22` |
| Always On #23 | `https://wa.me/5517997796014?text=META23` |
| Always On #24 | `https://wa.me/5517997796014?text=META24` |
| Always On #25 | `https://wa.me/5517997796014?text=META25` |
| Always On #26 | `https://wa.me/5517997796014?text=META26` |

#### Site e Indicacao

| Campanha | Link WhatsApp |
|----------|---------------|
| Site - Botao Principal | `https://wa.me/5517997796014?text=SITE01` |
| Site - Banner Promocao | `https://wa.me/5517997796014?text=SITE02` |
| Indicacao | `https://wa.me/5517997796014?text=IND001` |

### Como usar na Landing Page (botao HTML)

```html
<!-- Botao WhatsApp para Landing Page de Ortodontia -->
<a href="https://wa.me/5517997796014?text=ORT001"
   target="_blank"
   rel="noopener noreferrer"
   style="display:inline-block; background:#25D366; color:#fff;
          padding:16px 32px; border-radius:12px; font-size:16px;
          font-weight:600; text-decoration:none;">
  Agendar pelo WhatsApp
</a>
```

### Como usar no Meta Ads (CTA do anuncio)

1. Ao criar o anuncio no Gerenciador de Anuncios do Meta, selecione o objetivo **Mensagens**
2. Em "Destino da mensagem", escolha **WhatsApp**
3. No campo **Mensagem pre-preenchida**, coloque apenas o codigo:
   ```
   META01
   ```
4. O numero do WhatsApp Business deve ser o `+55 17 99779-6014`

**Importante**: No Meta Ads com objetivo "Mensagens para WhatsApp", a mensagem pre-preenchida e configurada diretamente no anuncio. Cada anuncio (Always On #1, #2, etc.) deve ter seu proprio codigo.

### Como usar no Site (botao flutuante)

```html
<!-- Botao flutuante WhatsApp no site -->
<a href="https://wa.me/5517997796014?text=SITE01"
   target="_blank"
   rel="noopener noreferrer"
   style="position:fixed; bottom:24px; right:24px; z-index:9999;
          background:#25D366; color:#fff; width:64px; height:64px;
          border-radius:50%; display:flex; align-items:center;
          justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.15);
          text-decoration:none; font-size:32px;">
  <!-- Icone WhatsApp (pode usar SVG ou emoji) -->
  <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.598-.804-6.357-2.158l-.445-.346-2.635.884.884-2.635-.346-.445A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
</a>
```

Para o **banner de promocao**, use o link com `SITE02`:
```html
<a href="https://wa.me/5517997796014?text=SITE02">
  Aproveitar promocao
</a>
```

---

## 4. Configurando UTMs nas Landing Pages

### Padrao de UTM recomendado

As UTMs ficam na URL da **Landing Page**, nao no link do WhatsApp. Elas servem para rastrear de onde o visitante veio antes de clicar no botao do WhatsApp.

```
https://sualandingpage.com.br/ortodontia?utm_source=FONTE&utm_medium=MIDIA&utm_campaign=CAMPANHA
```

### Exemplos completos

#### Google Ads

```
https://irbprimecare.com.br/ortodontia?utm_source=google&utm_medium=cpc&utm_campaign=ortodontia_sp&utm_content=anuncio_v1
https://irbprimecare.com.br/implante?utm_source=google&utm_medium=cpc&utm_campaign=implante_sp&utm_content=anuncio_v1
https://irbprimecare.com.br/clinico?utm_source=google&utm_medium=cpc&utm_campaign=clinico_sp&utm_content=anuncio_v1
https://irbprimecare.com.br/estetica?utm_source=google&utm_medium=cpc&utm_campaign=estetica_sp&utm_content=anuncio_v1
```

#### Meta Ads (Instagram/Facebook)

```
https://irbprimecare.com.br/lp-always-on?utm_source=meta&utm_medium=social&utm_campaign=always_on_01&utm_content=feed_img
https://irbprimecare.com.br/lp-always-on?utm_source=meta&utm_medium=social&utm_campaign=always_on_02&utm_content=stories_video
https://irbprimecare.com.br/lp-always-on?utm_source=meta&utm_medium=social&utm_campaign=always_on_03&utm_content=reels
```

#### Site organico

```
https://irbprimecare.com.br?utm_source=site&utm_medium=organic&utm_campaign=botao_principal
https://irbprimecare.com.br?utm_source=site&utm_medium=organic&utm_campaign=banner_promo
```

### Tabela de parametros

| Parametro | O que significa | Exemplos |
|-----------|----------------|----------|
| `utm_source` | De onde veio o trafego | google, meta, site, indicacao |
| `utm_medium` | Tipo de midia | cpc, social, organic, email |
| `utm_campaign` | Nome da campanha | ortodontia_sp, always_on_01 |
| `utm_content` | Variacao do criativo | anuncio_v1, feed_img, stories |
| `utm_term` | Palavra-chave (Google) | ortodontia sjrp, implante dentario |

---

## 5. Gestao do Pipeline

### Etapas do funil e o que fazer em cada uma

O pipeline do CRM funciona como um Kanban. Os leads sao movidos arrastando os cards entre as colunas.

```
+------------+    +---------------+    +--------------+    +--------------+
| NOVO LEAD  | -> | CONTATO FEITO | -> | QUALIFICADO  | -> | AGENDAMENTO  |
| (automatico)|    | (Julia/IA)    |    | (interesse)  |    | (consulta    |
|            |    |               |    |              |    |  agendada)   |
+------------+    +---------------+    +--------------+    +--------------+
                                                                 |
                                                                 v
+------------+    +-----------------+    +-----------------+
| FECHADO    | <- | PROPOSTA        | <- | CONSULTA        |
| GANHO/     |    | ENVIADA         |    | REALIZADA       |
| PERDIDO    |    | (orcamento)     |    | (paciente foi)  |
+------------+    +-----------------+    +-----------------+
```

### Detalhamento de cada etapa

#### 1. Novo Lead (automatico)
- **O que acontece**: Lead chega automaticamente quando um novo paciente manda mensagem no WhatsApp
- **Quem cuida**: Julia (IA) responde em ate 30 segundos
- **Tempo ideal**: Ate 5 minutos
- **Acao**: Julia cumprimenta, identifica o interesse e tenta agendar

#### 2. Contato Feito
- **O que acontece**: Julia ja fez o primeiro contato e esta conversando com o paciente
- **Quem cuida**: Julia (IA) automaticamente
- **Tempo ideal**: Ate 24 horas
- **Acao**: Julia qualifica o interesse (qual procedimento, urgencia, conveniencia)

#### 3. Qualificado
- **O que acontece**: Paciente confirmou interesse em um procedimento especifico
- **Quem cuida**: Julia (IA) ou atendente humano
- **Tempo ideal**: Ate 48 horas
- **Acao**: Oferecer horarios disponiveis, tirar duvidas sobre valores/planos

#### 4. Agendamento
- **O que acontece**: Consulta agendada no Klingo
- **Quem cuida**: Sistema automatico (Julia agenda via Klingo API)
- **Tempo ideal**: Ate o dia da consulta
- **Acao**: Enviar lembrete 24h antes, confirmar presenca

#### 5. Consulta Realizada
- **O que acontece**: Paciente compareceu a consulta
- **Quem cuida**: Recepcao / Equipe comercial
- **Tempo ideal**: Ate 72 horas
- **Acao**: Registrar se houve proposta de tratamento

#### 6. Proposta Enviada
- **O que acontece**: Orcamento foi apresentado ao paciente
- **Quem cuida**: Equipe comercial
- **Tempo ideal**: Ate 7 dias
- **Acao**: Follow-up em 48h se nao houver resposta

#### 7. Fechado Ganho / Perdido
- **Ganho**: Paciente aceitou o tratamento --> Clicar em "Ganho" e "Converter em paciente"
- **Perdido**: Paciente desistiu --> Clicar em "Perdido" e registrar o motivo

### Quando escalar para atendente humano

A Julia deve transferir para humano quando:
- Paciente pede explicitamente para falar com alguem
- Reclamacao ou insatisfacao detectada
- Pergunta sobre valores especificos de tratamento
- Negociacao de pagamento/desconto
- Situacao de urgencia medica
- Paciente nao responde apos 3 tentativas da IA

---

## 6. Metricas e KPIs

### Acompanhamento DIARIO

| Metrica | Onde ver | Meta |
|---------|---------|------|
| Novos leads | CRM > Pipeline (coluna "Novo Lead") | 5-15/dia |
| Tempo de primeira resposta | Dashboard > Conversas | < 1 minuto |
| Leads qualificados | CRM > Pipeline (coluna "Qualificado") | 40% dos novos |
| Agendamentos realizados | CRM > Pipeline (coluna "Agendamento") | 25% dos qualificados |

### Acompanhamento SEMANAL

| Metrica | Como calcular | Benchmark saude/odonto |
|---------|--------------|----------------------|
| Taxa de conversao (lead -> agendamento) | Agendamentos / Total de leads | 15-30% |
| Taxa de comparecimento | Consultas realizadas / Agendamentos | 70-85% |
| Taxa de fechamento | Ganhos / Consultas realizadas | 30-50% |
| Custo por lead (CPL) | Investimento / Total de leads | R$ 15-50 |
| Custo por agendamento | Investimento / Agendamentos | R$ 50-150 |
| Leads por campanha | CRM > Campanhas (coluna "Leads") | Varia |

### Como calcular ROI por campanha

```
ROI = ((Receita gerada pela campanha - Custo da campanha) / Custo da campanha) x 100

Exemplo:
- Campanha: Google Ads - Ortodontia (ORT001)
- Investimento mensal: R$ 3.000
- Leads gerados: 80
- Agendamentos: 24 (30%)
- Consultas realizadas: 18 (75% comparecimento)
- Fechamentos: 7 (39%)
- Ticket medio ortodontia: R$ 4.500
- Receita: 7 x R$ 4.500 = R$ 31.500

ROI = ((31.500 - 3.000) / 3.000) x 100 = 950%
```

### Como calcular custo por lead

```
CPL = Investimento total da campanha / Numero de leads gerados

Exemplo:
- Google Ads Ortodontia: R$ 3.000 / 80 leads = R$ 37,50 por lead
- Meta Always On #1: R$ 1.500 / 120 leads = R$ 12,50 por lead
```

### Benchmarks de saude/odontologia

| Metrica | Ruim | Aceitavel | Bom | Excelente |
|---------|------|-----------|-----|-----------|
| CPL Google Ads | > R$ 80 | R$ 40-80 | R$ 20-40 | < R$ 20 |
| CPL Meta Ads | > R$ 40 | R$ 20-40 | R$ 10-20 | < R$ 10 |
| Taxa lead -> agendamento | < 10% | 10-20% | 20-30% | > 30% |
| Taxa comparecimento | < 60% | 60-70% | 70-85% | > 85% |
| Taxa fechamento | < 20% | 20-30% | 30-50% | > 50% |
| Tempo primeira resposta | > 5 min | 1-5 min | 30s-1min | < 30s |

---

## 7. Templates de Mensagem

### Texto padrao por tipo de campanha

#### Ortodontia (ORT001)

Mensagem pre-preenchida no link:
```
ORT001
```

Primeira resposta da Julia:
```
Oi! Tudo bem? Sou a Julia, assistente virtual da IRB Prime Care!

Vi que voce tem interesse em ortodontia. Temos otimas opcoes
de aparelho fixo e alinhadores transparentes.

Posso agendar uma avaliacao pra voce? E rapidinho e sem compromisso!
Qual o melhor dia da semana pra voce?
```

#### Implante (IMP001)

Mensagem pre-preenchida:
```
IMP001
```

Primeira resposta da Julia:
```
Oi! Sou a Julia, da IRB Prime Care!

Vi que voce tem interesse em implante dentario. Aqui na IRB
trabalhamos com implantes de alta qualidade com equipe especializada.

Que tal agendar uma avaliacao? Posso verificar os horarios
disponiveis pra voce. Qual periodo fica melhor: manha ou tarde?
```

#### Clinico Geral (CLI001)

Mensagem pre-preenchida:
```
CLI001
```

Primeira resposta da Julia:
```
Oi! Sou a Julia, assistente da IRB Prime Care!

Como posso te ajudar? Estou aqui pra agendar sua consulta
com nosso clinico geral. Temos horarios disponiveis essa semana!

Me conta: voce ja e paciente da IRB ou e sua primeira vez?
```

#### Estetica (EST001)

Mensagem pre-preenchida:
```
EST001
```

Primeira resposta da Julia:
```
Oi! Sou a Julia, da IRB Prime Care!

Que legal que voce tem interesse em estetica dental! Trabalhamos
com lentes de contato, clareamento, facetas e muito mais.

Posso agendar uma avaliacao com nosso especialista?
Qual o melhor dia pra voce?
```

#### Meta Ads / Always On

Mensagem pre-preenchida (exemplo para #1):
```
META01
```

Primeira resposta da Julia:
```
Oi! Sou a Julia, assistente virtual da IRB Prime Care!

Vi que voce se interessou pela IRB. Como posso te ajudar hoje?

Posso agendar uma consulta, tirar duvidas sobre nossos
tratamentos ou verificar horarios disponiveis. E so me contar!
```

#### Site (SITE01, SITE02)

Mensagem pre-preenchida:
```
SITE01
```

Primeira resposta da Julia:
```
Oi! Sou a Julia, da IRB Prime Care!

Obrigada por entrar em contato pelo nosso site.
Como posso te ajudar? Estou aqui pra agendar consultas,
tirar duvidas ou encaminhar voce pro profissional certo.
```

#### Indicacao (IND001)

Mensagem pre-preenchida:
```
IND001
```

Primeira resposta da Julia:
```
Oi! Sou a Julia, assistente da IRB Prime Care!

Que bom que voce recebeu uma indicacao pra IRB!
Nossos pacientes sao nossa melhor propaganda.

Como posso te ajudar? Posso agendar uma consulta
ou tirar qualquer duvida que voce tenha!
```

### Como a Julia identifica o interesse do paciente

A Julia (IA) analisa a primeira mensagem e o codigo da campanha para identificar:

1. **Pelo codigo**: `ORT001` = ortodontia, `IMP001` = implante, etc.
2. **Pelo texto**: Palavras-chave como "aparelho", "implante", "clareamento", "dor de dente"
3. **Pela conversa**: Se o paciente nao menciona nada especifico, Julia pergunta diretamente

O interesse detectado aparece no card do lead no pipeline, facilitando a triagem.

---

## 8. Checklist de Lancamento

Use este checklist toda vez que lancar uma nova campanha:

### Configuracao no CRM

- [ ] Campanha cadastrada no CRM (menu CRM > Campanhas)
- [ ] Nome descritivo preenchido (ex: "Google Ads - Ortodontia Marco 2026")
- [ ] Codigo unico definido e anotado (ex: ORT001)
- [ ] Canal correto selecionado (Google, Meta, Site, etc.)
- [ ] Midia preenchida (cpc, social, organic)
- [ ] Orcamento definido
- [ ] Data de inicio e fim configuradas
- [ ] Status: Ativa

### Links e rastreamento

- [ ] Link WhatsApp gerado: `https://wa.me/5517997796014?text=CODIGO`
- [ ] Codigo correto no link (conferir letra por letra)
- [ ] Link testado: abre o WhatsApp com a mensagem correta
- [ ] UTMs configuradas na Landing Page
- [ ] UTMs testadas (usar extensao de navegador para verificar)

### Teste de ponta a ponta

- [ ] Enviar mensagem com o codigo pelo WhatsApp (usar numero pessoal)
- [ ] Verificar se Julia respondeu automaticamente
- [ ] Verificar se o lead apareceu no CRM > Pipeline
- [ ] Verificar se a campanha esta vinculada ao lead
- [ ] Verificar se a origem (source) esta correta

### Equipe

- [ ] Equipe de recepcao informada sobre a campanha
- [ ] Equipe sabe como acessar o pipeline no dashboard
- [ ] Responsavel definido para acompanhar leads diariamente
- [ ] Meta de leads definida para a campanha
- [ ] Rotina de follow-up combinada (horarios, frequencia)

### Pos-lancamento (primeira semana)

- [ ] Monitorar leads diariamente
- [ ] Verificar taxa de resposta da Julia
- [ ] Verificar se todos os leads estao com campanha vinculada
- [ ] Ajustar orcamento se necessario
- [ ] Revisar qualidade dos leads

---

## 9. Troubleshooting

### "Lead nao apareceu no CRM"

**Verificacoes:**

1. **O paciente ja existe no sistema?**
   - Leads so sao criados para **novos pacientes** (primeira mensagem)
   - Se o paciente ja mandou mensagem antes, ele nao gera um novo lead
   - Verificar em CRM > Pipeline se o lead ja existe com outro nome

2. **O numero do WhatsApp esta correto no link?**
   - Deve ser `5517997796014` (sem +, sem espacos)
   - Conferir: `wa.me/5517997796014` (nao `wa.me/+5517997796014`)

3. **A campanha esta ativa?**
   - No CRM > Campanhas, verificar se o status e "Ativa"
   - Campanhas pausadas ou encerradas nao sao detectadas

4. **O worker esta rodando?**
   - SSH no servidor: `docker logs irb-worker --tail 50`
   - Procurar por `[intake] Lead created for new patient`

### "Codigo nao foi detectado"

**Formato correto do codigo:**

```
CORRETO:    ORT001, META15, SITE01, IMP001, CLI001, EST001, IND001
INCORRETO:  ort001 (minusculo), ORT-001 (hifen), ORT 001 (espaco),
            ORTODO001 (mais de 5 letras), O1 (menos de 2 letras)
```

**Regras do regex:**
- 2 a 5 letras MAIUSCULAS seguidas de 2 a 5 numeros
- Sem espacos, hifens ou caracteres especiais
- Deve estar como palavra isolada na mensagem

**Exemplos que FUNCIONAM:**
```
ORT001                    --> detecta ORT001
Oi ORT001                 --> detecta ORT001
ORT001 quero agendar      --> detecta ORT001
```

**Exemplos que NAO funcionam:**
```
ort001                    --> minusculo, nao detecta
ORT-001                   --> hifen quebra o padrao
meucodigoORT001           --> colado em outra palavra
ORTODONTIA001             --> mais de 5 letras antes do numero
```

### "Campanha aparece como organico"

**Possiveis causas:**

1. **Paciente apagou o texto antes de enviar**
   - O WhatsApp permite que o usuario edite a mensagem pre-preenchida
   - Se ele apagou o codigo e escreveu outra coisa, o sistema nao detecta
   - Solucao: Adicionar texto amigavel ao redor do codigo
   ```
   https://wa.me/5517997796014?text=ORT001%20Oi%2C%20quero%20saber%20mais%20sobre%20ortodontia
   ```
   (O `%20` e espaco e `%2C` e virgula codificados na URL)

2. **Codigo nao esta cadastrado no CRM**
   - Verificar se o codigo digitado no link e exatamente igual ao cadastrado
   - Cuidado com letras maiusculas/minusculas (o sistema busca exatamente o que esta no banco)

3. **Campanha esta pausada ou encerrada**
   - O sistema so busca campanhas com status = `active`
   - Reativar a campanha se necessario

4. **Paciente ja existia no sistema**
   - Se o paciente ja tinha registro, o lead nao e recriado
   - Nesse caso, e necessario criar o lead manualmente: CRM > Pipeline > "Novo Lead"
   - Preencher a origem e campanha corretas

### Dica final

Para facilitar o debug, o worker registra logs detalhados. No servidor:

```bash
# Ver logs do worker em tempo real
docker logs irb-worker -f --tail 100 | grep "\[intake\]"

# Buscar logs de um telefone especifico
docker logs irb-worker --since 1h | grep "5517999999999"

# Ver leads criados
docker logs irb-worker --since 24h | grep "Lead created"
```

---

## Resumo rapido

```
1. Cadastre a campanha no CRM com um codigo (ex: ORT001)
2. Monte o link: wa.me/5517997796014?text=ORT001
3. Coloque o link no anuncio/LP/site
4. Paciente clica -> envia codigo -> Julia responde -> lead aparece no CRM
5. Acompanhe o pipeline e mova os leads pelas etapas
6. Meca CPL e ROI semanalmente
```
