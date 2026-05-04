"""Cliente REST API EFD-Reinf — modelo assíncrono (manual v2.7).

Endpoints (API atual economia.gov.br):
- POST {base}/recepcao/lotes      → envia lote de eventos (assíncrono)
- GET  {base}/consulta/lotes/{id} → consulta status do protocolo

A autenticação é feita via mTLS com o certificado digital A1.
"""
import base64
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Iterable

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12
from loguru import logger

from irb_reinf.config import settings
from irb_reinf.signer.xml_signer import carregar_pfx


class ReinfClient:
    """Cliente HTTP autenticado por certificado A1 para EFD-Reinf."""

    def __init__(self,
                 pfx_path: Path | str | None = None,
                 senha: str | None = None,
                 base_url: str | None = None):
        self.base_url = (base_url or settings.reinf_base_url).rstrip("/")
        self._pfx_path = pfx_path
        self._senha = senha
        self._client: httpx.Client | None = None

    def __enter__(self):
        # mTLS exige cert + key em arquivos temporários PEM
        pem_key, pem_cert = carregar_pfx(self._pfx_path, self._senha)
        cert_file = tempfile.NamedTemporaryFile("wb", suffix=".pem", delete=False)
        key_file = tempfile.NamedTemporaryFile("wb", suffix=".pem", delete=False)
        cert_file.write(pem_cert); cert_file.close()
        key_file.write(pem_key); key_file.close()
        self._cert_files = (cert_file.name, key_file.name)
        self._client = httpx.Client(
            base_url=self.base_url,
            cert=self._cert_files,
            timeout=60.0,
            headers={
                "Accept": "application/xml",
                "Content-Type": "application/xml",
                "User-Agent": "irb-reinf/1.0",
            },
        )
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._client:
            self._client.close()
        for f in getattr(self, "_cert_files", []):
            try: Path(f).unlink(missing_ok=True)
            except Exception: pass

    # ------------------------------------------------------------------ envio
    def montar_lote(self, eventos_xml: Iterable[str]) -> str:
        """Empacota N eventos assinados em um <loteEventos>."""
        ev_list = list(eventos_xml)
        # versão do schema do lote assíncrono (ideContribuinte conforme API economia.gov.br)
        envelope = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/envioLoteEventosAssincrono/v1_00_00">\n'
            '  <envioLoteEventos>\n'
            '    <ideContribuinte>\n'
            f'      <tpInsc>1</tpInsc>\n'
            f'      <nrInsc>{settings.contrib_cnpj[:8]}</nrInsc>\n'
            '    </ideContribuinte>\n'
            '    <eventos>\n'
        )
        for i, x in enumerate(ev_list, 1):
            if x.startswith("<?xml"):
                x = x.split("?>", 1)[1].lstrip()
            envelope += f'      <evento Id="evt-{i}">{x}</evento>\n'
        envelope += '    </eventos>\n'
        envelope += '  </envioLoteEventos>\n'
        envelope += '</Reinf>\n'
        return envelope

    def enviar_lote(self, lote_xml: str) -> dict:
        """POST do lote via /recepcao/lotes. Retorna dict com {protocolo, status, response_text}."""
        if not self._client:
            raise RuntimeError("Use 'with ReinfClient(...) as c:'")
        url = f"{self.base_url}/recepcao/lotes"
        logger.info(f"POST {url}  size={len(lote_xml)}")
        r = self._client.post("/recepcao/lotes", content=lote_xml.encode("utf-8"))
        return self._parse_resposta_envio(r)

    def consultar_protocolo(self, protocolo: str) -> dict:
        if not self._client:
            raise RuntimeError("Use 'with ReinfClient(...) as c:'")
        url = f"{self.base_url}/consulta/lotes/{protocolo}"
        logger.info(f"GET {url}")
        r = self._client.get(f"/consulta/lotes/{protocolo}")
        return self._parse_resposta_consulta(r)

    def consultar_recibo(self, evento_id: str) -> dict:
        if not self._client:
            raise RuntimeError("Use 'with ReinfClient(...) as c:'")
        r = self._client.get(f"/consulta/eventos/{evento_id}")
        return self._parse_resposta_consulta(r)

    # ----------------------------------------------------------------- parsers
    def _parse_resposta_envio(self, r: httpx.Response) -> dict:
        result = {
            "http_status": r.status_code,
            "response_text": r.text,
            "ok": r.is_success,
            "protocolo": None,
            "status_codigo": None,
            "status_descricao": None,
        }
        if r.is_success:
            try:
                from lxml import etree
                root = etree.fromstring(r.content)
                # tenta achar protocolo
                for tag in ("protocoloEnvio", "nrProtocolo", "protocolo"):
                    el = root.find(f".//{{*}}{tag}")
                    if el is not None and el.text:
                        result["protocolo"] = el.text.strip()
                        break
                cd = root.find(".//{*}cdResposta")
                ds = root.find(".//{*}descResposta")
                if cd is not None: result["status_codigo"] = cd.text
                if ds is not None: result["status_descricao"] = ds.text
            except Exception as e:
                logger.warning(f"Falha ao parsear resposta XML: {e}")
        return result

    def _parse_resposta_consulta(self, r: httpx.Response) -> dict:
        return self._parse_resposta_envio(r)
