"""Envio de email com PDF do informe via SMTP."""
import smtplib
from email.message import EmailMessage
from pathlib import Path

from loguru import logger

from irb_reinf.config import settings


def enviar_email_informe(
    destinatario: str,
    nome_beneficiario: str,
    pdf_path: Path | str,
    ano_calendario: int,
    cc: list[str] | None = None,
) -> dict:
    """Envia email com o PDF anexo. Retorna {ok, erro}."""
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return {"ok": False, "erro": f"PDF não encontrado: {pdf_path}"}

    if not settings.smtp_host or not settings.smtp_user:
        return {"ok": False, "erro": "SMTP não configurado"}

    msg = EmailMessage()
    msg["Subject"] = f"Informe de Rendimentos {ano_calendario} — {settings.contrib_nome}"
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email or settings.smtp_user}>"
    msg["To"] = destinatario
    if cc:
        msg["Cc"] = ", ".join(cc)

    msg.set_content(f"""\
Olá {nome_beneficiario},

Segue em anexo seu Comprovante de Rendimentos referente ao ano-calendário {ano_calendario},
para fins de Declaração do Imposto de Renda Pessoa Física {ano_calendario + 1}.

Em caso de dúvidas, entre em contato com a contabilidade.

Atenciosamente,
{settings.contrib_nome}

---
Este é um envio automático. Não responda este e-mail.
""")
    msg.add_alternative(f"""\
<html><body style="font-family:Arial,sans-serif;color:#222">
<p>Olá <b>{nome_beneficiario}</b>,</p>
<p>Segue em anexo seu <b>Comprovante de Rendimentos</b> referente ao ano-calendário <b>{ano_calendario}</b>,
para fins de Declaração do Imposto de Renda Pessoa Física {ano_calendario + 1}.</p>
<p>Em caso de dúvidas, entre em contato com a contabilidade.</p>
<p>Atenciosamente,<br><b>{settings.contrib_nome}</b></p>
<hr><p style="color:#888;font-size:11px">Envio automático — não responda este e-mail.</p>
</body></html>
""", subtype="html")

    with pdf_path.open("rb") as f:
        msg.add_attachment(f.read(), maintype="application",
                           subtype="pdf", filename=pdf_path.name)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_pass)
            smtp.send_message(msg)
        logger.info(f"Email enviado para {destinatario}")
        return {"ok": True, "erro": None}
    except Exception as e:
        logger.error(f"Falha SMTP {destinatario}: {e}")
        return {"ok": False, "erro": str(e)}
