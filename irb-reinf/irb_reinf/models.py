"""Modelos de domínio (Pydantic) — beneficiário, pagamento, lote, recibo."""
from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class TipoBenef(str, Enum):
    PF = "PF"
    PJ = "PJ"


class NaturezaRendimento(int, Enum):
    """Códigos da Tabela 01 EFD-Reinf (subset relevante)."""
    TRABALHO_VINCULO = 10001               # CLT (e ME/EPP via tpIsencao=5)
    DECISAO_JUSTICA_TRABALHO = 11001       # decisão JT
    LUCROS_DIVIDENDOS = 12001              # SCP, sócio/titular ME/EPP, dividendos
    HONORARIOS_PROFISSIONAIS_PJ = 17001    # serviços profissionais PJ
    SERVICOS_PJ_GENERICO = 20001           # outros serviços PJ


class Beneficiario(BaseModel):
    """Pessoa física ou jurídica que recebeu rendimento."""
    cpf_cnpj: str
    tipo: TipoBenef
    nome: str
    email: Optional[str] = None
    telefone_whatsapp: Optional[str] = None
    endereco: Optional[str] = None  # para mala direta

    @field_validator("cpf_cnpj")
    @classmethod
    def limpa_documento(cls, v: str) -> str:
        return "".join(c for c in v if c.isdigit())


class Pagamento(BaseModel):
    """Pagamento/rendimento de um beneficiário em um ano-calendário."""
    cpf_cnpj: str
    tipo: TipoBenef
    nome: str
    ano_cal: int

    # tributáveis (PF e PJ)
    vlr_rendimentos_tributaveis: Decimal = Decimal("0")
    vlr_contrib_prev_oficial: Decimal = Decimal("0")
    vlr_irrf: Decimal = Decimal("0")

    # isentos PF
    vlr_lucros_me_epp: Decimal = Decimal("0")     # pagos a sócio ME/EPP (cód 12001)
    vlr_dividendos: Decimal = Decimal("0")        # pagos a sócio (cód 12001)
    vlr_lucros_scp: Decimal = Decimal("0")        # pagos a sócio SCP (12001 + indFciScp=2)

    # 13o salário e tributação exclusiva
    vlr_13_salario: Decimal = Decimal("0")
    vlr_irrf_13: Decimal = Decimal("0")

    # rescisão / pensão
    vlr_rescisao: Decimal = Decimal("0")
    vlr_pensao_alimenticia: Decimal = Decimal("0")

    # natureza do rendimento principal
    nat_rendimento: int = NaturezaRendimento.LUCROS_DIVIDENDOS.value

    # indicativo de retenção
    ind_retencao: int = 1

    # SCP — quando lucros foram pagos via SCP
    scp_cnpj: Optional[str] = None
    scp_percentual: Optional[Decimal] = None  # % participação do sócio na SCP

    @field_validator("cpf_cnpj")
    @classmethod
    def limpa_documento(cls, v: str) -> str:
        return "".join(c for c in v if c.isdigit())

    def total_isento(self) -> Decimal:
        return (
            self.vlr_lucros_me_epp
            + self.vlr_dividendos
            + self.vlr_lucros_scp
        )

    def eh_scp(self) -> bool:
        return self.vlr_lucros_scp > 0 or (self.scp_cnpj is not None and self.tipo == TipoBenef.PF)


class StatusEnvio(str, Enum):
    PENDENTE = "pendente"
    GERADO = "gerado"
    ASSINADO = "assinado"
    ENVIADO = "enviado"
    PROCESSANDO = "processando"
    SUCESSO = "sucesso"
    ERRO = "erro"


class Evento(BaseModel):
    """Um evento individual EFD-Reinf (R-1000, R-1050, R-4010, R-4020 ou R-4099)."""
    id: str  # ex: ID9999... do XML
    tipo: str  # "R-4010", "R-4020", etc.
    cpf_cnpj_benef: Optional[str] = None
    xml_assinado: Optional[str] = None
    status: StatusEnvio = StatusEnvio.PENDENTE
    protocolo: Optional[str] = None
    recibo: Optional[str] = None
    erro_mensagem: Optional[str] = None
    criado_em: date = Field(default_factory=date.today)


class Lote(BaseModel):
    """Lote de eventos enviado conjuntamente."""
    id: str
    eventos: list[Evento]
    protocolo: Optional[str] = None
    status: StatusEnvio = StatusEnvio.PENDENTE
