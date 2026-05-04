"""Distribuição via WhatsApp usando uazapi.

API: POST {base}/send/media (envia documento PDF)
     POST {base}/send/text  (envia mensagem)
Headers: token: <UAZAPI_TOKEN>
"""
import base64
from pathlib import Path

import httpx
from loguru import logger

from irb_reinf.config import settings


def _normalizar_telefone(tel: str) -> str:
    """Mantém apenas dígitos e prefixa 55 se necessário."""
    digitos = "".join(c for c in tel if c.isdigit())
    if not digitos.startswith("55"):
        digitos = "55" + digitos
    return digitos


def enviar_pdf_whatsapp(
    telefone: str,
    nome_beneficiario: str,
    pdf_path: Path | str,
    ano_calendario: int,
    legenda: str | None = None,
) -> dict:
    """Envia o PDF do informe via WhatsApp uazapi."""
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return {"ok": False, "erro": f"PDF não encontrado: {pdf_path}"}
    if not settings.uazapi_token:
        return {"ok": False, "erro": "UAZAPI_TOKEN não configurado"}

    numero = _normalizar_telefone(telefone)
    legenda = legenda or (
        f"Olá {nome_beneficiario}! 👋\n\n"
        f"Segue seu *Comprovante de Rendimentos {ano_calendario}* para sua Declaração de IR {ano_calendario + 1}.\n\n"
        f"_{settings.contrib_nome}_"
    )

    pdf_b64 = base64.b64encode(pdf_path.read_bytes()).decode()

    payload = {
        "number": numero,
        "type": "document",
        "file": pdf_b64,
        "fileName": pdf_path.name,
        "text": legenda,
    }
    headers = {
        "token": settings.uazapi_token,
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(base_url=settings.uazapi_base_url, timeout=60.0) as c:
            r = c.post("/send/media", json=payload, headers=headers)
            ok = r.is_success
            if ok:
                logger.info(f"WhatsApp enviado para {numero}")
            else:
                logger.warning(f"Falha WhatsApp {numero}: {r.status_code} {r.text[:200]}")
            return {"ok": ok, "erro": None if ok else r.text, "response": r.json() if ok else None}
    except Exception as e:
        logger.error(f"Erro WhatsApp {numero}: {e}")
        return {"ok": False, "erro": str(e)}


def enviar_texto_whatsapp(telefone: str, texto: str) -> dict:
    """Envia mensagem de texto avulsa (lembrete, status, etc.)."""
    numero = _normalizar_telefone(telefone)
    payload = {"number": numero, "text": texto}
    headers = {"token": settings.uazapi_token, "Content-Type": "application/json"}
    try:
        with httpx.Client(base_url=settings.uazapi_base_url, timeout=30.0) as c:
            r = c.post("/send/text", json=payload, headers=headers)
            return {"ok": r.is_success, "erro": None if r.is_success else r.text}
    except Exception as e:
        return {"ok": False, "erro": str(e)}
