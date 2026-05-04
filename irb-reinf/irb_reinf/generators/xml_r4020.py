"""Gera evento R-4020 — Pagamentos/Créditos a beneficiário pessoa jurídica."""
from datetime import date
from typing import Literal

from lxml import etree

from irb_reinf.config import settings
from irb_reinf.generators._xml_helpers import (
    fmt_competencia, fmt_data, fmt_decimal, make_id, to_xml_str,
)
from irb_reinf.models import Pagamento


VERSAO_R4020 = "v2_01_02"
NS_R4020 = f"http://www.reinf.esocial.gov.br/schemas/evtRetPJ/{VERSAO_R4020}"


def gerar_r4020(
    pagamento: Pagamento,
    competencia_ano: int,
    competencia_mes: int,
    cnpj_contrib: str | None = None,
    sequencial: int = 1,
    operacao: Literal["INC", "ALT", "EXC"] = "INC",
    nrRecibo: str | None = None,
) -> str:
    cnpj = (cnpj_contrib or settings.contrib_cnpj).zfill(14)
    per_apur = fmt_competencia(competencia_ano, competencia_mes)

    nsmap = {None: NS_R4020}
    reinf = etree.Element("Reinf", nsmap=nsmap)
    evt = etree.SubElement(reinf, "evtRetPJ", id=make_id(cnpj, sequencial))

    ide = etree.SubElement(evt, "ideEvento")
    etree.SubElement(ide, "indRetif").text = "1" if operacao == "INC" else "2"
    if nrRecibo and operacao != "INC":
        etree.SubElement(ide, "nrRecibo").text = nrRecibo
    etree.SubElement(ide, "perApur").text = per_apur
    etree.SubElement(ide, "tpAmb").text = str(settings.tp_amb)
    etree.SubElement(ide, "procEmi").text = "1"
    etree.SubElement(ide, "verProc").text = "irb-reinf-1.0"

    ic = etree.SubElement(evt, "ideContri")
    etree.SubElement(ic, "tpInsc").text = "1"
    etree.SubElement(ic, "nrInsc").text = cnpj[:8]

    ie = etree.SubElement(evt, "ideEstab")
    etree.SubElement(ie, "tpInscEstab").text = "1"
    etree.SubElement(ie, "nrInscEstab").text = cnpj

    ib = etree.SubElement(ie, "ideBenef")
    etree.SubElement(ib, "cnpjBenef").text = pagamento.cpf_cnpj.zfill(14)
    etree.SubElement(ib, "nmBenef").text = pagamento.nome

    ip = etree.SubElement(ib, "idePgto")
    etree.SubElement(ip, "natRend").text = str(pagamento.nat_rendimento)

    info_pg = etree.SubElement(ip, "infoPgto")
    etree.SubElement(info_pg, "dtFG").text = fmt_data(date(competencia_ano, competencia_mes, 1))
    etree.SubElement(info_pg, "vlrRendBruto").text = fmt_decimal(pagamento.vlr_rendimentos_tributaveis)
    if pagamento.vlr_irrf > 0:
        etree.SubElement(info_pg, "vlrIR").text = fmt_decimal(pagamento.vlr_irrf)

    return to_xml_str(reinf)
