"""Gera PDF do Comprovante de Rendimentos (modelo IN RFB 2060/2021).

Reproduz o layout oficial da Receita Federal — Comprovante de Rendimentos
Pagos e de Imposto sobre a Renda Retido na Fonte.
"""
from datetime import date
from decimal import Decimal
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)

from irb_reinf.config import settings
from irb_reinf.models import Pagamento


def _fmt_real(v: Decimal | float | int) -> str:
    if v is None:
        return "0,00"
    s = f"{Decimal(v):,.2f}"
    # converte 1,234,567.89 -> 1.234.567,89
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_cpf(cpf: str) -> str:
    cpf = cpf.zfill(11)
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"


def _fmt_cnpj(cnpj: str) -> str:
    cnpj = cnpj.zfill(14)
    return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"


def gerar_pdf_informe(
    pagamento: Pagamento,
    saida_dir: Path | str,
    fonte_pagadora_cnpj: str | None = None,
    fonte_pagadora_nome: str | None = None,
    responsavel_nome: str | None = None,
    data_emissao: date | None = None,
    obs_complementar: str | None = None,
) -> Path:
    """Gera PDF do comprovante e retorna caminho do arquivo."""
    saida_dir = Path(saida_dir)
    saida_dir.mkdir(parents=True, exist_ok=True)

    fpc = (fonte_pagadora_cnpj or settings.contrib_cnpj).zfill(14)
    fpn = fonte_pagadora_nome or settings.contrib_nome
    resp = responsavel_nome or settings.responsavel_nome
    dt = data_emissao or date.today()

    arquivo = saida_dir / f"informe_{pagamento.cpf_cnpj}_{pagamento.ano_cal}.pdf"

    doc = SimpleDocTemplate(
        str(arquivo),
        pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )
    styles = getSampleStyleSheet()
    bold = ParagraphStyle("bold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8)
    normal = ParagraphStyle("normal", parent=styles["Normal"], fontName="Helvetica", fontSize=8)
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=12, alignment=1)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=9, fontName="Helvetica-Bold",
                        backColor=colors.lightgrey, leftIndent=2, spaceBefore=4, spaceAfter=2)

    story = []

    # Cabeçalho
    story.append(Paragraph("Ministério da Fazenda — Secretaria da Receita Federal do Brasil", normal))
    story.append(Paragraph("Imposto sobre a Renda da Pessoa Física &nbsp;&nbsp;&nbsp; Exercício de "
                           f"{pagamento.ano_cal + 1}", normal))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Comprovante de Rendimentos Pagos e de Imposto sobre a Renda Retido na Fonte</b>", h1))
    story.append(Paragraph(f"<b>Ano-calendário de {pagamento.ano_cal}</b>", h1))
    story.append(Spacer(1, 6))

    # Fonte pagadora
    story.append(Paragraph("1. Fonte Pagadora Pessoa Jurídica ou Pessoa Física", h2))
    story.append(Table(
        [[Paragraph("<b>Nome Empresarial</b>", bold), Paragraph("<b>CNPJ</b>", bold)],
         [Paragraph(fpn, normal), Paragraph(_fmt_cnpj(fpc), normal)]],
        colWidths=[120*mm, 60*mm],
        style=TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ])
    ))
    story.append(Spacer(1, 4))

    # Beneficiário
    story.append(Paragraph("2. Pessoa Física Beneficiária dos Rendimentos", h2))
    if pagamento.tipo.value == "PF":
        doc_label = "CPF"
        doc_fmt = _fmt_cpf(pagamento.cpf_cnpj)
    else:
        doc_label = "CNPJ"
        doc_fmt = _fmt_cnpj(pagamento.cpf_cnpj)
    story.append(Table(
        [[Paragraph(f"<b>{doc_label}</b>", bold), Paragraph("<b>Nome Completo</b>", bold)],
         [Paragraph(doc_fmt, normal), Paragraph(pagamento.nome, normal)]],
        colWidths=[60*mm, 120*mm],
        style=TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ])
    ))
    story.append(Spacer(1, 4))

    # Quadro 3 — Tributáveis
    story.append(Paragraph("3. Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido na Fonte "
                           "&nbsp;&nbsp;&nbsp;<i>Valores em reais</i>", h2))
    bruto = pagamento.vlr_rendimentos_tributaveis
    story.append(Table([
        ["1. Total dos rendimentos (inclusive férias)", _fmt_real(bruto)],
        ["2. Contribuição previdenciária oficial", _fmt_real(pagamento.vlr_contrib_prev_oficial)],
        ["3. Contribuição a entidades de previdência complementar / Fapi", "0,00"],
        ["4. Pensão alimentícia", _fmt_real(pagamento.vlr_pensao_alimenticia)],
        ["5. Imposto sobre a renda retido na fonte (IRRF)", _fmt_real(pagamento.vlr_irrf)],
    ], colWidths=[140*mm, 40*mm], style=_table_style()))
    story.append(Spacer(1, 4))

    # Quadro 4 — Isentos
    story.append(Paragraph("4. Rendimentos Isentos e Não Tributáveis &nbsp;&nbsp;&nbsp;<i>Valores em reais</i>", h2))
    outros_label = "9. Outros:"
    outros_val = "0,00"
    if pagamento.vlr_lucros_scp > 0:
        outros_label = f"9. Outros: Dividendos pagos ao sócio de SCP"
        outros_val = _fmt_real(pagamento.vlr_lucros_scp)
    elif pagamento.vlr_dividendos > 0:
        outros_label = "9. Outros: Dividendos"
        outros_val = _fmt_real(pagamento.vlr_dividendos)

    story.append(Table([
        ["1. Parcela isenta de proventos de aposentadoria/reforma (65 anos+)", "0,00"],
        ["2. Parcela isenta do 13º salário (65 anos+)", "0,00"],
        ["3. Diárias e ajudas de custo", "0,00"],
        ["4. Pensão/aposentadoria por moléstia grave; aposentadoria por acidente em serviço", "0,00"],
        ["5. Lucros e dividendos apurados a partir de 1996 (pessoa jurídica)", "0,00"],
        ["6. Valores pagos a titular ou sócio de ME ou EPP, exceto pro labore/aluguel/serviços",
         _fmt_real(pagamento.vlr_lucros_me_epp)],
        ["7. Indenizações por rescisão de contrato (PDV/acidente)", _fmt_real(pagamento.vlr_rescisao)],
        ["8. Juros de mora por atraso no pagamento de remuneração", "0,00"],
        [outros_label, outros_val],
    ], colWidths=[140*mm, 40*mm], style=_table_style()))
    story.append(Spacer(1, 4))

    # Quadro 5 — Tributação Exclusiva
    story.append(Paragraph("5. Rendimentos Sujeitos à Tributação Exclusiva (rendimento líquido) "
                           "&nbsp;&nbsp;&nbsp;<i>Valores em reais</i>", h2))
    story.append(Table([
        ["1. 13º (décimo terceiro) salário", _fmt_real(pagamento.vlr_13_salario)],
        ["2. Imposto sobre a renda retido na fonte sobre 13º salário", _fmt_real(pagamento.vlr_irrf_13)],
        ["3. Outros", "0,00"],
    ], colWidths=[140*mm, 40*mm], style=_table_style()))
    story.append(Spacer(1, 4))

    # Quadro 6 — RRA
    story.append(Paragraph("6. Rendimentos Recebidos Acumuladamente — Art. 12-A da Lei nº 7.713/1988", h2))
    story.append(Paragraph("<i>(não aplicável neste comprovante)</i>", normal))
    story.append(Spacer(1, 4))

    # Quadro 7 — Informações Complementares
    story.append(Paragraph("7. Informações Complementares", h2))
    obs = obs_complementar or ""
    if pagamento.vlr_lucros_scp > 0 and not obs:
        scp_doc = pagamento.scp_cnpj or settings.scp_cnpj
        obs = (f"O valor de R$ {_fmt_real(pagamento.vlr_lucros_scp)}, referente a lucros e dividendos "
               f"recebidos pelo sócio da Sociedade em Conta de Participação, "
               f"CNPJ nº {_fmt_cnpj(scp_doc)}, está contido no montante informado na linha 9 — Outros — "
               f"do Quadro 4. Rendimentos Isentos e Não Tributáveis.")
    story.append(Paragraph(obs or "&nbsp;", normal))
    story.append(Spacer(1, 8))

    # Responsável
    story.append(Paragraph("8. Responsável pelas Informações", h2))
    story.append(Table(
        [[Paragraph("<b>Nome</b>", bold), Paragraph("<b>Data</b>", bold), Paragraph("<b>Assinatura</b>", bold)],
         [Paragraph(resp, normal), Paragraph(dt.strftime("%d/%m/%Y"), normal), Paragraph("&nbsp;", normal)]],
        colWidths=[100*mm, 30*mm, 50*mm],
        style=TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (1, 1), (1, 1), 18),
        ])
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Aprovado pela Instrução Normativa RFB nº 2060, de 13 de dezembro de 2021.",
        ParagraphStyle("foot", parent=normal, fontSize=7, alignment=1)
    ))

    doc.build(story)
    return arquivo


def _table_style():
    return TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ])
