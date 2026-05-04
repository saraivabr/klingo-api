# IRB EFD-Reinf — Sistema Autônomo

Sistema completo e independente para:
1. Ler planilhas de pagamentos (Viva Care + Pega Plantão)
2. Gerar XMLs EFD-Reinf (R-1000, R-1050, R-4010, R-4020, R-4099)
3. Assinar com certificado digital A1 da SCP
4. Transmitir à Receita Federal (REST API assíncrono v2.7)
5. Gerar PDFs do Comprovante de Rendimentos (modelo IN RFB 2060/2021)
6. Distribuir via Email + WhatsApp (uazapi)
7. Painel de acompanhamento ao vivo
8. Auditoria completa em SQLite

**Sem dependência do Domínio Sistemas. Tudo standalone, em Python.**

---

## Setup

```bash
cd /Users/saraiva/irb-reinf
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# editar .env com credenciais reais
```

---

## Comandos

```bash
# 1. Inicializa banco
python cli.py init

# 2. Gera 1 PDF (debug visual)
python cli.py gerar-pdf 12912345609 data/input/dados_teste.xlsx

# 3. Pipeline completo SEM enviar à Receita (gera XMLs + PDFs locais)
python cli.py run data/input/dados_teste.xlsx --ano 2025 --mes 12

# 4. Pipeline completo + envio à Receita (homologação)
python cli.py run data/input/dados_teste.xlsx --ano 2025 --mes 12 --enviar

# 5. Pipeline completo + envio + distribuição
python cli.py run data/input/dados_teste.xlsx --ano 2025 --mes 12 --enviar --distribuir

# 6. Painel web
python cli.py dashboard
# acesse http://localhost:8080  (admin / senha do .env)
```

---

## Estrutura

```
irb-reinf/
├── cli.py                   # ponto de entrada
├── requirements.txt
├── .env.example
├── irb_reinf/
│   ├── config.py            # settings (Pydantic)
│   ├── models.py            # Pagamento, Beneficiario, Evento
│   ├── extractors/
│   │   └── excel_extractor.py   # lê XLSX + valida
│   ├── generators/
│   │   ├── xml_r1000.py     # cadastro contribuinte
│   │   ├── xml_r1050.py     # cadastro SCP
│   │   ├── xml_r4010.py     # pgto PF (com SCP)
│   │   ├── xml_r4020.py     # pgto PJ
│   │   ├── xml_r4099.py     # fechamento R-4000
│   │   └── pdf_informe.py   # PDF Comprovante Rendimentos
│   ├── signer/
│   │   └── xml_signer.py    # XMLDSig SHA256 com cert A1
│   ├── webservice/
│   │   └── reinf_client.py  # REST API EFD-Reinf assíncrono
│   ├── distribution/
│   │   ├── email_sender.py  # SMTP + PDF anexo
│   │   └── whatsapp_uazapi.py  # WhatsApp + PDF
│   ├── orchestrator/
│   │   └── pipeline.py      # tudo junto end-to-end
│   ├── audit/
│   │   └── db.py            # SQLite com histórico
│   └── api/
│       └── dashboard.py     # FastAPI painel
└── data/
    ├── input/               # planilhas
    └── output/
        ├── xmls/            # eventos gerados
        ├── pdfs/            # informes gerados
        └── recibos/         # protocolos da Receita
```

---

## Schema da planilha de entrada

| Coluna | Tipo | Descrição |
|---|---|---|
| `cpf_cnpj` | str | sem máscara, 11 ou 14 dígitos |
| `tipo` | PF \| PJ | |
| `nome` | str | |
| `ano_cal` | int | ano-calendário (ex: 2025) |
| `vlr_rendimentos_tributaveis` | decimal | bruto pago |
| `vlr_contrib_prev_oficial` | decimal | INSS retido |
| `vlr_irrf` | decimal | IRRF retido |
| `vlr_lucros_me_epp` | decimal | sócio ME/EPP |
| `vlr_dividendos` | decimal | dividendos comuns |
| `vlr_lucros_scp` | decimal | (opcional) lucros SCP |
| `vlr_13_salario` | decimal | |
| `vlr_irrf_13` | decimal | |
| `vlr_rescisao` | decimal | |
| `vlr_pensao_alimenticia` | decimal | |
| `nat_rendimento` | int | código (12001 = lucros) |
| `ind_retencao` | int | 1 |
| `scp_cnpj` | str | (opcional) CNPJ SCP do médico |
| `scp_percentual` | decimal | (opcional) % participação SCP |
| `email` | str | (opcional) para envio |
| `telefone_whatsapp` | str | (opcional) para envio |

---

## Variáveis críticas no `.env`

| Variável | O que é |
|---|---|
| `REINF_AMBIENTE` | `pre_producao` ou `producao` |
| `CONTRIB_CNPJ` | CNPJ da IRB (37787172000167) |
| `SCP_CNPJ` | CNPJ da SCP (39403031000129) |
| `CERT_A1_PATH` | caminho para o `.pfx` da SCP |
| `CERT_A1_SENHA` | senha do `.pfx` |
| `SMTP_*` | credenciais para envio email |
| `UAZAPI_TOKEN` | token uazapi para WhatsApp |

---

## Endpoints REST API EFD-Reinf

- **Pré-produção:** `https://preprodefdreinf.receita.fazenda.gov.br/api/v1`
- **Produção:** `https://reinf.receita.fazenda.gov.br/api/v1`

Endpoints utilizados:
- `POST /eventos` — envia lote
- `GET /protocolos/{id}` — consulta status
- `GET /recibos/{id}` — consulta recibo

Autenticação: **mTLS com certificado A1 (PFX)**.

---

## Fluxo end-to-end

```
planilha.xlsx
    ↓
[ler_planilha + validar]  → CPFs, totais, duplicados
    ↓
[gerar XMLs]  → R-1000 + R-1050 + N x R-4010/R-4020 + R-4099
    ↓
[assinar XMLDSig SHA256]  → com cert A1
    ↓
[montar lote]  → envelope envioLoteEventos
    ↓
[POST /eventos]  → mTLS REST
    ↓ aguarda recibo
[gerar PDFs]  → reportlab, modelo IN RFB 2060/2021
    ↓
[distribuir]  → email (SMTP) + WhatsApp (uazapi)
    ↓
[auditar]  → SQLite (eventos, distribuições, status)
    ↓
[dashboard]  → http://localhost:8080
```

---

## Status atual

| Módulo | Estado |
|---|---|
| Leitura planilha + validação | ✅ |
| Geração R-1000 / R-1050 / R-4010 / R-4020 / R-4099 | ✅ |
| Assinatura XMLDSig SHA256 com cert A1 | ✅ |
| Cliente REST EFD-Reinf assíncrono | ✅ |
| PDF Comprovante Rendimentos | ✅ |
| Envio email SMTP | ✅ |
| Envio WhatsApp uazapi | ✅ |
| SQLite auditoria | ✅ |
| Dashboard FastAPI | ✅ |
| CLI Typer | ✅ |

**Falta apenas:**
- [ ] Certificado A1 da SCP (Denis precisa emitir)
- [ ] Planilha real consolidada Viva Care + Pega Plantão
- [ ] Cadastro atualizado de email/WhatsApp dos médicos
- [ ] Validação dos XMLs contra os XSDs oficiais (precisa baixar)
- [ ] Testes em ambiente de pré-produção da Receita

---

## Próximos passos (build)

1. Baixar XSDs oficiais (`sped.rfb.gov.br`) e validar XMLs gerados
2. Comprar/emitir certificado A1 da SCP
3. Coletar planilha real e rodar `--ano 2025 --mes 12` sem `--enviar`
4. Validar PDFs visualmente com Denis
5. Rodar com `--enviar` em pré-produção
6. Após sucesso, migrar `REINF_AMBIENTE=producao`
7. Executar com `--distribuir` para entregar aos médicos
