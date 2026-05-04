"""Gera evento R-4010 — Pagamentos/Créditos a beneficiário pessoa física.

Estrutura conforme XSD evt4010PagtoBeneficiarioPF/v2_01_02_C:
- vlrRendBruto: obrigatório, formato "9999,99" (vírgula)
- indFciScp + nrInscFciScp: diretamente em infoPgto (não em detSCP)
- rendIsento: opcional, tpIsencao aceita 1|2|3|4|5|6|7|8|10|11|99
"""
from datetime import date
from decimal import Decimal
from typing import Literal

from lxml import etree

from irb_reinf.config import settings
from irb_reinf.generators._xml_helpers import (
    fmt_competencia, fmt_data, fmt_decimal_comma, make_id, to_xml_str,
)
from irb_reinf.models import Pagamento


VERSAO_R4010 = "v2_01_02"
NS_R4010 = f"http://www.reinf.esocial.gov.br/schemas/evt4010PagtoBeneficiarioPF/{VERSAO_R4010}"


def gerar_r4010(
    pagamento: Pagamento,
    competencia_ano: int,
    competencia_mes: int,
    cnpj_contrib: str | None = None,
    sequencial: int = 1,
    scp_cnpj_default: str | None = None,
    operacao: Literal["INC", "ALT", "EXC"] = "INC",
    nrRecibo: str | None = None,
) -> str:
    """Gera XML do R-4010 para um beneficiário PF em uma competência.

    Args:
        nrRecibo: Número do recibo do evento original (obrigatório para operacao=ALT).
                  Formato: "NNNNN-NN-NNNN-NNNN-NNNNN" conforme nrRecArqBase da resposta.
    """
    cnpj = (cnpj_contrib or settings.contrib_cnpj).zfill(14)
    per_apur = fmt_competencia(competencia_ano, competencia_mes)

    nsmap = {None: NS_R4010}
    reinf = etree.Element("Reinf", nsmap=nsmap)
    evt = etree.SubElement(reinf, "evtRetPF", id=make_id(cnpj, sequencial))

    # ideEvento
    ide = etree.SubElement(evt, "ideEvento")
    etree.SubElement(ide, "indRetif").text = "1" if operacao == "INC" else "2"
    if nrRecibo and operacao != "INC":
        etree.SubElement(ide, "nrRecibo").text = nrRecibo
    etree.SubElement(ide, "perApur").text = per_apur
    etree.SubElement(ide, "tpAmb").text = str(settings.tp_amb)
    etree.SubElement(ide, "procEmi").text = "1"
    etree.SubElement(ide, "verProc").text = "irb-reinf-1.0"

    # ideContri
    ic = etree.SubElement(evt, "ideContri")
    etree.SubElement(ic, "tpInsc").text = "1"
    etree.SubElement(ic, "nrInsc").text = cnpj[:8]

    # ideEstab — estabelecimento pagador (matriz)
    ie = etree.SubElement(evt, "ideEstab")
    etree.SubElement(ie, "tpInscEstab").text = "1"
    etree.SubElement(ie, "nrInscEstab").text = cnpj

    # ideBenef — cpfBenef OU nmBenef (não ambos conforme regra de validação)
    ib = etree.SubElement(ie, "ideBenef")
    etree.SubElement(ib, "cpfBenef").text = pagamento.cpf_cnpj.zfill(11)

    # idePgto — agrupador por natureza de rendimento
    ip = etree.SubElement(ib, "idePgto")
    etree.SubElement(ip, "natRend").text = str(pagamento.nat_rendimento)

    # infoPgto — detalhamento (vlrRendBruto obrigatório com vírgula decimal)
    info_pg = etree.SubElement(ip, "infoPgto")
    etree.SubElement(info_pg, "dtFG").text = fmt_data(date(competencia_ano, competencia_mes, 1))

    # Valor bruto OBRIGATÓRIO — soma de todos os rendimentos do beneficiário
    vlr_bruto = pagamento.vlr_rendimentos_tributaveis + pagamento.total_isento()
    etree.SubElement(info_pg, "vlrRendBruto").text = fmt_decimal_comma(vlr_bruto)

    # Rendimento tributável (opcional, apenas se houver IR)
    if pagamento.vlr_rendimentos_tributaveis > 0:
        etree.SubElement(info_pg, "vlrRendTrib").text = fmt_decimal_comma(
            pagamento.vlr_rendimentos_tributaveis - pagamento.vlr_contrib_prev_oficial
        )
        if pagamento.vlr_irrf > 0:
            etree.SubElement(info_pg, "vlrIR").text = fmt_decimal_comma(pagamento.vlr_irrf)

    # SCP: indicador, CNPJ e percentual diretamente em infoPgto
    if pagamento.vlr_lucros_scp > 0:
        etree.SubElement(info_pg, "indFciScp").text = "2"
        scp_doc = (pagamento.scp_cnpj or scp_cnpj_default or settings.scp_cnpj).zfill(14)
        etree.SubElement(info_pg, "nrInscFciScp").text = scp_doc
        # percSCP obrigatório para indFciScp=2: formato "X,X" (1 decimal)
        perc = pagamento.scp_percentual
        if perc is None or perc <= 0:
            perc = Decimal("0")
        perc_f = float(perc)
        if perc_f >= 100:
            perc_str = "100,0"
        else:
            perc_str = f"{perc_f:.1f}".replace(".", ",")
        etree.SubElement(info_pg, "percSCP").text = perc_str

    return to_xml_str(reinf)
