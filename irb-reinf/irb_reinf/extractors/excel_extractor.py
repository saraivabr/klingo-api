"""Importa planilha XLSX/CSV de pagamentos e converte em lista de Pagamento."""
from decimal import Decimal
from pathlib import Path
from typing import Iterable

import pandas as pd
from loguru import logger

from irb_reinf.models import Pagamento, TipoBenef


COLUNAS_OBRIGATORIAS = {
    "cpf_cnpj", "tipo", "nome", "ano_cal",
    "vlr_rendimentos_tributaveis", "vlr_contrib_prev_oficial", "vlr_irrf",
    "vlr_lucros_me_epp", "vlr_dividendos", "vlr_13_salario", "vlr_irrf_13",
    "vlr_rescisao", "vlr_pensao_alimenticia",
    "nat_rendimento", "ind_retencao",
}

COLUNAS_OPCIONAIS = {
    "vlr_lucros_scp", "scp_cnpj", "scp_percentual", "email", "telefone_whatsapp",
}


def _to_decimal(v) -> Decimal:
    if v is None or (isinstance(v, float) and pd.isna(v)) or v == "":
        return Decimal("0")
    return Decimal(str(v)).quantize(Decimal("0.01"))


def ler_planilha(caminho: Path | str) -> list[Pagamento]:
    """Lê XLSX/CSV e devolve lista de Pagamento validada."""
    caminho = Path(caminho)
    if not caminho.exists():
        raise FileNotFoundError(caminho)

    if caminho.suffix.lower() == ".csv":
        df = pd.read_csv(caminho, dtype=str)
    else:
        df = pd.read_excel(caminho, dtype=str)

    cols = set(df.columns.str.lower())
    df.columns = df.columns.str.lower()

    faltando = COLUNAS_OBRIGATORIAS - cols
    if faltando:
        raise ValueError(f"Planilha sem colunas obrigatórias: {sorted(faltando)}")

    pagamentos = []
    for _, row in df.iterrows():
        try:
            p = Pagamento(
                cpf_cnpj=str(row["cpf_cnpj"]).strip(),
                tipo=TipoBenef(row["tipo"].strip().upper()),
                nome=str(row["nome"]).strip(),
                ano_cal=int(row["ano_cal"]),
                vlr_rendimentos_tributaveis=_to_decimal(row["vlr_rendimentos_tributaveis"]),
                vlr_contrib_prev_oficial=_to_decimal(row["vlr_contrib_prev_oficial"]),
                vlr_irrf=_to_decimal(row["vlr_irrf"]),
                vlr_lucros_me_epp=_to_decimal(row["vlr_lucros_me_epp"]),
                vlr_dividendos=_to_decimal(row["vlr_dividendos"]),
                vlr_lucros_scp=_to_decimal(row.get("vlr_lucros_scp", 0)),
                vlr_13_salario=_to_decimal(row["vlr_13_salario"]),
                vlr_irrf_13=_to_decimal(row["vlr_irrf_13"]),
                vlr_rescisao=_to_decimal(row["vlr_rescisao"]),
                vlr_pensao_alimenticia=_to_decimal(row["vlr_pensao_alimenticia"]),
                nat_rendimento=int(row["nat_rendimento"]),
                ind_retencao=int(row["ind_retencao"]),
                scp_cnpj=str(row["scp_cnpj"]).strip() if "scp_cnpj" in row and pd.notna(row.get("scp_cnpj")) else None,
                scp_percentual=_to_decimal(row.get("scp_percentual", 0)) if "scp_percentual" in row else None,
            )
            pagamentos.append(p)
        except Exception as e:
            logger.error(f"Erro na linha {row.to_dict()}: {e}")
            raise

    logger.info(f"Lidos {len(pagamentos)} pagamentos de {caminho.name}")
    return pagamentos


def validar(pagamentos: Iterable[Pagamento]) -> dict:
    """Validações cruzadas: CPFs duplicados, totais, dígitos verificadores, etc."""
    pgts = list(pagamentos)
    docs = [p.cpf_cnpj for p in pgts]

    duplicados = {d for d in docs if docs.count(d) > 1}
    cpfs_invalidos = [p.cpf_cnpj for p in pgts if p.tipo == TipoBenef.PF and not _cpf_valido(p.cpf_cnpj)]
    cnpjs_invalidos = [p.cpf_cnpj for p in pgts if p.tipo == TipoBenef.PJ and not _cnpj_valido(p.cpf_cnpj)]

    total_tributavel = sum((p.vlr_rendimentos_tributaveis for p in pgts), Decimal(0))
    total_isento = sum((p.total_isento() for p in pgts), Decimal(0))
    total_irrf = sum((p.vlr_irrf for p in pgts), Decimal(0))

    return {
        "total_registros": len(pgts),
        "duplicados": sorted(duplicados),
        "cpfs_invalidos": cpfs_invalidos,
        "cnpjs_invalidos": cnpjs_invalidos,
        "total_tributavel": total_tributavel,
        "total_isento": total_isento,
        "total_irrf": total_irrf,
        "ok": not (duplicados or cpfs_invalidos or cnpjs_invalidos),
    }


def _cpf_valido(cpf: str) -> bool:
    cpf = "".join(c for c in cpf if c.isdigit())
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for i in range(9, 11):
        soma = sum(int(cpf[j]) * ((i + 1) - j) for j in range(i))
        dig = (soma * 10) % 11 % 10
        if dig != int(cpf[i]):
            return False
    return True


def _cnpj_valido(cnpj: str) -> bool:
    cnpj = "".join(c for c in cnpj if c.isdigit())
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos2 = [6] + pesos1
    for pesos, idx in [(pesos1, 12), (pesos2, 13)]:
        soma = sum(int(cnpj[i]) * pesos[i] for i in range(len(pesos)))
        dig = (soma % 11)
        dig = 0 if dig < 2 else 11 - dig
        if dig != int(cnpj[idx]):
            return False
    return True
