"""Gera evento R-1000 — Informações do Contribuinte (cadastro/alteração).

Necessário antes do primeiro envio. Cadastra a IRB como contribuinte EFD-Reinf.
"""
from datetime import datetime
from typing import Literal

from lxml import etree

from irb_reinf.config import settings
from irb_reinf.generators._xml_helpers import OP_TAG, make_id, to_xml_str


VERSAO_R1000 = "v2_01_02"
NS_R1000 = f"http://www.reinf.esocial.gov.br/schemas/evtInfoContribuinte/{VERSAO_R1000}"


def gerar_r1000(
    operacao: Literal["INC", "ALT", "EXC"] = "INC",
    classif_trib: str = "99",  # 99 = pessoa jurídica em geral
    cnpj_contrib: str | None = None,
    contato_nome: str | None = None,
    contato_cpf: str | None = None,
    contato_telefone: str = "",
    contato_email: str = "",
    sequencial: int = 1,
) -> str:
    """Gera XML do R-1000 (Informações do Contribuinte)."""
    cnpj = (cnpj_contrib or settings.contrib_cnpj).zfill(14)
    nome_contato = contato_nome or settings.responsavel_nome
    cpf_contato = (contato_cpf or settings.responsavel_cpf).zfill(11)

    nsmap = {None: NS_R1000}
    reinf = etree.Element("Reinf", nsmap=nsmap)
    evt = etree.SubElement(reinf, "evtInfoContri", id=make_id(cnpj, sequencial))

    # ideEvento
    ide = etree.SubElement(evt, "ideEvento")
    etree.SubElement(ide, "tpAmb").text = str(settings.tp_amb)
    etree.SubElement(ide, "procEmi").text = "1"  # aplicativo do contribuinte
    etree.SubElement(ide, "verProc").text = "irb-reinf-1.0"

    # ideContri
    ic = etree.SubElement(evt, "ideContri")
    etree.SubElement(ic, "tpInsc").text = "1"  # 1 = CNPJ
    etree.SubElement(ic, "nrInsc").text = cnpj[:8]  # raiz CNPJ (8 dígitos)

    # infoContri (operação)
    info = etree.SubElement(evt, "infoContri")
    op = etree.SubElement(info, OP_TAG[operacao])  # inclusao/alteracao/exclusao
    ide_period = etree.SubElement(op, "idePeriodo")
    etree.SubElement(ide_period, "iniValid").text = settings.scp_inicio_validade
    inf_cad = etree.SubElement(op, "infoCadastro")
    etree.SubElement(inf_cad, "classTrib").text = classif_trib
    etree.SubElement(inf_cad, "indEscrituracao").text = "0"  # 0 = não obrigado a escrituração contábil
    etree.SubElement(inf_cad, "indDesoneracao").text = "0"
    etree.SubElement(inf_cad, "indAcordoIsenMulta").text = "0"
    etree.SubElement(inf_cad, "indSitPJ").text = "0"
    contato = etree.SubElement(inf_cad, "contato")
    etree.SubElement(contato, "nmCtt").text = nome_contato
    etree.SubElement(contato, "cpfCtt").text = cpf_contato
    # foneFixo obrigatório se foneCel não preenchido
    fone = contato_telefone or settings.responsavel_telefone or "00000000000"
    etree.SubElement(contato, "foneFixo").text = fone
    if contato_email:
        etree.SubElement(contato, "email").text = contato_email

    return to_xml_str(reinf)
