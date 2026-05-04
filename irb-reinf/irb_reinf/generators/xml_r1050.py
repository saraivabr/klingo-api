"""Gera evento R-1050 — Tabela de Entidades Ligadas (cadastro da SCP).

Necessário antes de enviar R-4010 com indFciScp=2 (lucros pagos via SCP).
"""
from typing import Literal

from lxml import etree

from irb_reinf.config import settings
from irb_reinf.generators._xml_helpers import OP_TAG, make_id, to_xml_str


VERSAO_R1050 = "v2_01_02"
NS_R1050 = f"http://www.reinf.esocial.gov.br/schemas/evt1050TabLig/{VERSAO_R1050}"


def gerar_r1050(
    scp_cnpj: str | None = None,
    cnpj_contrib: str | None = None,
    operacao: Literal["INC", "ALT", "EXC"] = "INC",
    inicio_validade: str | None = None,  # AAAA-MM
    fim_validade: str | None = None,      # opcional
    sequencial: int = 1,
) -> str:
    """Gera XML do R-1050 cadastrando uma SCP (Sociedade em Conta de Participação)."""
    cnpj = (cnpj_contrib or settings.contrib_cnpj).zfill(14)
    cnpj_scp = (scp_cnpj or settings.scp_cnpj).zfill(14)
    inicio = inicio_validade or settings.scp_inicio_validade

    nsmap = {None: NS_R1050}
    reinf = etree.Element("Reinf", nsmap=nsmap)
    evt = etree.SubElement(reinf, "evtTabLig", id=make_id(cnpj, sequencial))

    # ideEvento
    ide = etree.SubElement(evt, "ideEvento")
    etree.SubElement(ide, "tpAmb").text = str(settings.tp_amb)
    etree.SubElement(ide, "procEmi").text = "1"
    etree.SubElement(ide, "verProc").text = "irb-reinf-1.0"

    # ideContri
    ic = etree.SubElement(evt, "ideContri")
    etree.SubElement(ic, "tpInsc").text = "1"
    etree.SubElement(ic, "nrInsc").text = cnpj[:8]

    # infoLig (estrutura conforme XSD evt1050TabLig/v2_01_02)
    info = etree.SubElement(evt, "infoLig")
    op = etree.SubElement(info, OP_TAG[operacao])
    ide_ent = etree.SubElement(op, "ideEntLig")
    etree.SubElement(ide_ent, "tpEntLig").text = "4"  # 4 = SCP (Sociedade em Conta de Participação)
    etree.SubElement(ide_ent, "cnpjLig").text = cnpj_scp
    etree.SubElement(ide_ent, "iniValid").text = inicio
    if fim_validade:
        etree.SubElement(ide_ent, "fimValid").text = fim_validade

    return to_xml_str(reinf)
