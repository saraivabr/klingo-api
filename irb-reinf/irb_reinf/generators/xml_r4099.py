"""Gera evento R-4099 — Fechamento da série R-4000 (evt4099FechamentoDirf)."""
from lxml import etree

from irb_reinf.config import settings
from irb_reinf.generators._xml_helpers import fmt_competencia, make_id, to_xml_str


VERSAO_R4099 = "v2_01_02"
NS_R4099 = f"http://www.reinf.esocial.gov.br/schemas/evt4099FechamentoDirf/{VERSAO_R4099}"


def gerar_r4099(
    competencia_ano: int,
    competencia_mes: int,
    cnpj_contrib: str | None = None,
    sequencial: int = 1,
    fechar: bool = True,  # True=fechamento (1), False=reabertura (0)
    # parâmetros legados ignorados (mantidos para compatibilidade de chamada)
    operacao: str = "FECH",
    tem_r4010: bool = True,
    tem_r4020: bool = False,
    tem_r4040: bool = False,
    tem_r4080: bool = False,
) -> str:
    """Gera XML do R-4099 (Fechamento da série R-4000).

    Estrutura conforme XSD evt4099FechamentoDirf/v2_01_02:
    - infoFech.fechRet: 1=fechamento, 0=reabertura
    """
    cnpj = (cnpj_contrib or settings.contrib_cnpj).zfill(14)
    per_apur = fmt_competencia(competencia_ano, competencia_mes)

    nsmap = {None: NS_R4099}
    reinf = etree.Element("Reinf", nsmap=nsmap)
    evt = etree.SubElement(reinf, "evtFech", id=make_id(cnpj, sequencial))

    ide = etree.SubElement(evt, "ideEvento")
    etree.SubElement(ide, "perApur").text = per_apur
    etree.SubElement(ide, "tpAmb").text = str(settings.tp_amb)
    etree.SubElement(ide, "procEmi").text = "1"
    etree.SubElement(ide, "verProc").text = "irb-reinf-1.0"

    ic = etree.SubElement(evt, "ideContri")
    etree.SubElement(ic, "tpInsc").text = "1"
    etree.SubElement(ic, "nrInsc").text = cnpj[:8]

    # Responsável pelas informações (obrigatório)
    resp = etree.SubElement(evt, "ideRespInf")
    etree.SubElement(resp, "nmResp").text = settings.responsavel_nome or settings.contrib_nome
    etree.SubElement(resp, "cpfResp").text = (settings.responsavel_cpf or "").zfill(11)
    # foneFixo ou foneCel obrigatório
    fone = settings.responsavel_telefone or "00000000000"
    etree.SubElement(resp, "telefone").text = fone
    if settings.smtp_from_email:
        etree.SubElement(resp, "email").text = settings.smtp_from_email

    info = etree.SubElement(evt, "infoFech")
    # fechRet=0 → fechamento (requer período Em Andamento)
    # fechRet=1 → reabertura  (requer período Fechada)
    etree.SubElement(info, "fechRet").text = "0" if fechar else "1"

    return to_xml_str(reinf)
