"""Assina XML EFD-Reinf com certificado A1 (PFX) usando signxml.

Padrões EFD-Reinf:
- Algorithm: RSA-SHA256
- Digest: SHA256
- Canonicalization: C14N (http://www.w3.org/TR/2001/REC-xml-c14n-20010315)
- Reference URI: "" (raiz) ou "#ID" do evento
- Transforms: enveloped-signature + C14N
"""
from pathlib import Path
from typing import Tuple

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12
from lxml import etree
from signxml import XMLSigner, methods, algorithms

from irb_reinf.config import settings


def carregar_pfx(pfx_path: Path | str | None = None,
                 senha: str | None = None) -> Tuple[bytes, bytes]:
    """Lê o PFX e devolve (private_key_pem, certificate_pem)."""
    pfx_path = Path(pfx_path or settings.cert_a1_path)
    senha = (senha if senha is not None else settings.cert_a1_senha).encode()

    if not pfx_path.exists():
        raise FileNotFoundError(f"Certificado não encontrado: {pfx_path}")

    pfx_data = pfx_path.read_bytes()
    private_key, certificate, _ = pkcs12.load_key_and_certificates(pfx_data, senha)

    if private_key is None or certificate is None:
        raise ValueError("PFX não contém chave privada ou certificado válidos")

    pem_key = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pem_cert = certificate.public_bytes(serialization.Encoding.PEM)
    return pem_key, pem_cert


def assinar_xml(xml_str: str,
                pfx_path: Path | str | None = None,
                senha: str | None = None,
                reference_id: str | None = None) -> str:
    """Assina o XML conforme padrões EFD-Reinf e devolve string XML assinado."""
    pem_key, pem_cert = carregar_pfx(pfx_path, senha)

    parser = etree.XMLParser(remove_blank_text=True)
    root = etree.fromstring(xml_str.encode("utf-8"), parser=parser)

    # encontra elemento alvo da assinatura: o filho de Reinf que tem id=
    alvo = None
    if reference_id is None:
        for child in root:
            if child.get("id"):
                alvo = child
                reference_id = child.get("id")
                break
    else:
        alvo = root.find(f".//*[@id='{reference_id}']")

    if alvo is None:
        # se não houver atributo id, assina root inteiro
        alvo = root

    signer = XMLSigner(
        method=methods.enveloped,
        signature_algorithm=algorithms.SignatureMethod.RSA_SHA256,
        digest_algorithm=algorithms.DigestAlgorithm.SHA256,
        c14n_algorithm=algorithms.CanonicalizationMethod.CANONICAL_XML_1_0,
    )

    result = signer.sign(
        alvo,
        key=pem_key,
        cert=pem_cert,
        reference_uri=f"#{reference_id}" if reference_id else "",
    )

    # signxml retorna um NOVO elemento (não modifica alvo in-place).
    # O XSD EFD-Reinf exige Signature como filha de Reinf (irmã do evento).
    # Estratégia:
    #   1. Extrai Signature do result (está dentro do evento assinado)
    #   2. Substitui alvo por result em root
    #   3. Appenda Signature em root
    DS_NS = "http://www.w3.org/2000/09/xmldsig#"
    sig = result.find(f"{{{DS_NS}}}Signature")
    if sig is not None:
        result.remove(sig)

    if alvo is not root:
        root.replace(alvo, result)
        if sig is not None:
            root.append(sig)
        serialize_root = root
    else:
        # alvo era o root (caso sem id) — coloca Signature dentro
        if sig is not None:
            result.append(sig)
        serialize_root = result

    return etree.tostring(
        serialize_root, pretty_print=False, xml_declaration=True, encoding="UTF-8"
    ).decode("utf-8")
