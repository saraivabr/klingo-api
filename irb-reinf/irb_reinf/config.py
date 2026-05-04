"""Configurações centrais do sistema (Pydantic Settings)."""
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ambiente
    reinf_ambiente: Literal["pre_producao", "producao"] = "pre_producao"

    # contribuinte
    contrib_cnpj: str = ""
    contrib_nome: str = ""

    # SCP
    scp_cnpj: str = ""
    scp_nome: str = ""
    scp_inicio_validade: str = "2025-01"

    # certificado
    cert_a1_path: Path = PROJECT_ROOT / "certs" / "scp.pfx"
    cert_a1_senha: str = ""

    # responsável
    responsavel_nome: str = ""
    responsavel_cpf: str = ""
    responsavel_telefone: str = ""  # obrigatório no R-4099 ideRespInf

    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from_name: str = ""
    smtp_from_email: str = ""

    # WhatsApp uazapi
    uazapi_base_url: str = "https://free.uazapi.com"
    uazapi_token: str = ""
    uazapi_instance: str = ""

    # Dashboard
    dashboard_port: int = 8080
    dashboard_user: str = "admin"
    dashboard_pass: str = ""

    # DB
    database_url: str = "sqlite:///data/irb-reinf.db"

    # ============ derivados ============
    @property
    def reinf_base_url(self) -> str:
        """URL base da REST API EFD-Reinf assíncrono (economia.gov.br)."""
        if self.reinf_ambiente == "producao":
            return "https://reinf.receita.economia.gov.br"
        # pré-produção (homologação)
        return "https://pre-reinf.receita.economia.gov.br"

    @property
    def reinf_envio_url(self) -> str:
        return f"{self.reinf_base_url}/recepcao/lotes"

    @property
    def reinf_consulta_url_template(self) -> str:
        return f"{self.reinf_base_url}/consulta/lotes/{{protocolo}}"

    @property
    def tp_amb(self) -> int:
        """tpAmb conforme manual: 1=produção, 2=pré-produção restrita, 7=pré-produção dados reais."""
        return 1 if self.reinf_ambiente == "producao" else 2


settings = Settings()
