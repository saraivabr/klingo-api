"""Helpers comuns para geração dos XMLs EFD-Reinf."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from lxml import etree


# namespace base dos eventos EFD-Reinf
NSMAP = {
    None: "http://www.reinf.esocial.gov.br/schemas/evtRet/v2_01_02",
}


def make_id(cnpj: str, sequencial: int, dt: Optional[datetime] = None) -> str:
    """Gera identificador único do evento conforme manual SPED.

    Formato: ID + tpInsc(1) + raizCNPJ(8) + zeros(6) + AAAAMMDDHHMMSS + sequencial(5)
    Total: 36 caracteres começando com 'ID'.
    nrInsc = raiz CNPJ (8 dígitos) completada com zeros até 14 dígitos."""
    if dt is None:
        dt = datetime.now()
    # Usa a raiz do CNPJ (8 dígitos) + 6 zeros = 14 dígitos
    raiz = cnpj.zfill(14)[:8]
    cnpj_no_id = raiz + "000000"
    timestamp = dt.strftime("%Y%m%d%H%M%S")
    seq = str(sequencial).zfill(5)
    raw = f"ID1{cnpj_no_id}{timestamp}{seq}"
    return raw[:36]


def fmt_decimal(v: Decimal) -> str:
    """Formata Decimal com ponto decimal (uso interno/PDF)."""
    if v is None:
        return "0.00"
    return f"{Decimal(v):.2f}"


# Mapeamento de operação para nome de tag XML (R-1000, R-1050, etc.)
OP_TAG = {"INC": "inclusao", "ALT": "alteracao", "EXC": "exclusao"}


def fmt_decimal_comma(v) -> str:
    """Formata valor monetário com vírgula decimal conforme XSD R-4000 (ex: '1200,00')."""
    if v is None:
        return "0,00"
    return f"{Decimal(str(v)):.2f}".replace(".", ",")


def fmt_data(d) -> str:
    """Formata date como AAAA-MM-DD."""
    if d is None:
        return ""
    return d.strftime("%Y-%m-%d")


def fmt_competencia(ano: int, mes: int) -> str:
    """Formata competência como AAAA-MM."""
    return f"{ano:04d}-{mes:02d}"


def to_xml_str(elem: etree._Element, pretty: bool = False) -> str:
    """Serializa Element como string UTF-8."""
    return etree.tostring(
        elem, pretty_print=pretty, xml_declaration=True, encoding="UTF-8"
    ).decode("utf-8")
