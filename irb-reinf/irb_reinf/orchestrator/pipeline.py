"""Pipeline end-to-end:

1. Lê planilha de pagamentos
2. Valida (CPFs, duplicados, totais)
3. Gera R-1000 (uma vez), R-1050 (uma vez por SCP), R-4010 (cada PF), R-4020 (cada PJ), R-4099 (fechamento)
4. Assina cada XML com cert A1
5. Envia em lote para a Receita
6. Aguarda recibos
7. Gera PDFs do comprovante
8. Distribui aos beneficiários (email + WhatsApp)
9. Tudo registrado no SQLite
"""
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable

from loguru import logger

from irb_reinf.audit.db import (
    Beneficiario as BenefDB, Distribuicao, EventoREINF, get_session, init_db,
)
from irb_reinf.config import DATA_DIR, settings
from irb_reinf.distribution.email_sender import enviar_email_informe
from irb_reinf.distribution.whatsapp_uazapi import enviar_pdf_whatsapp
from irb_reinf.extractors.excel_extractor import ler_planilha, validar
from irb_reinf.generators.pdf_informe import gerar_pdf_informe
from irb_reinf.generators.xml_r1000 import gerar_r1000
from irb_reinf.generators.xml_r1050 import gerar_r1050
from irb_reinf.generators.xml_r4010 import gerar_r4010
from irb_reinf.generators.xml_r4020 import gerar_r4020
from irb_reinf.generators.xml_r4099 import gerar_r4099
from irb_reinf.models import Pagamento, TipoBenef
from irb_reinf.signer.xml_signer import assinar_xml
from irb_reinf.webservice.reinf_client import ReinfClient


def _salvar_recibos_db(consulta_resp: dict, competencia_ano: int, competencia_mes: int) -> None:
    """Parseia a resposta de consulta de protocolo e persiste nrRecArqBase nos EventoREINF."""
    try:
        from lxml import etree as _et
        xml_txt = consulta_resp.get("response_text", "")
        if not xml_txt:
            return
        root = _et.fromstring(xml_txt.encode())
        per_apur = f"{competencia_ano}-{competencia_mes:02d}"
        with get_session() as s:
            for evento in root.findall(".//{*}evento"):
                cd = evento.find(".//{*}cdRetorno")
                if cd is None or cd.text != "0":
                    continue  # só eventos aceitos
                id_ev = evento.find(".//{*}idEv")
                nr_rec = evento.find(".//{*}nrRecArqBase")
                cpf_benef = evento.find(".//{*}cpfBenef")
                if id_ev is None or nr_rec is None:
                    continue
                # atualiza pelo idEv (campo id da tabela)
                db_evt = s.get(EventoREINF, id_ev.text)
                if db_evt:
                    db_evt.recibo = nr_rec.text
                    db_evt.status = "aceito"
                else:
                    # fallback: busca por CPF/período se idEv não bater com chave local
                    if cpf_benef is not None:
                        from sqlalchemy import select as _sel
                        match = s.execute(
                            _sel(EventoREINF).where(
                                EventoREINF.cpf_cnpj_benef == cpf_benef.text,
                                EventoREINF.perApur == per_apur,
                                EventoREINF.tipo.in_(["R-4010", "R-4020"]),
                            )
                        ).scalars().first()
                        if match:
                            match.recibo = nr_rec.text
                            match.status = "aceito"
            s.commit()
        logger.info(f"nrRecArqBase persistidos no DB para {per_apur}")
    except Exception as e:
        logger.warning(f"Falha ao salvar recibos no DB: {e}")


def reabrir_periodo(
    competencia_ano: int,
    competencia_mes: int,
    enviar_para_receita: bool = False,
) -> dict:
    """Reabre período de apuração já fechado enviando R-4099 com fechRet=0."""
    r4099 = gerar_r4099(competencia_ano, competencia_mes, sequencial=1, fechar=False)
    if Path(settings.cert_a1_path).exists() and settings.cert_a1_senha:
        try:
            r4099 = assinar_xml(r4099)
        except Exception as e:
            logger.warning(f"Falha ao assinar reabertura: {e}")

    relatorio: dict = {"tipo": "reabertura", "perApur": f"{competencia_ano}-{competencia_mes:02d}"}
    if not enviar_para_receita:
        relatorio["status"] = "nao_enviado"
        return relatorio

    try:
        with ReinfClient() as c:
            lote = c.montar_lote([r4099])
            resp = c.enviar_lote(lote)
            relatorio["envio"] = resp
            if resp.get("protocolo"):
                for _ in range(20):
                    time.sleep(5)
                    st = c.consultar_protocolo(resp["protocolo"])
                    if st.get("status_codigo") and st["status_codigo"] not in ("100", "200"):
                        relatorio["consulta"] = st
                        break
        relatorio["status"] = "ok"
    except Exception as e:
        logger.exception("Falha na reabertura")
        relatorio["status"] = "erro"
        relatorio["erro"] = str(e)
    return relatorio


def executar_pipeline(
    planilha: Path | str,
    competencia_ano: int,
    competencia_mes: int = 12,
    enviar_para_receita: bool = False,
    distribuir: bool = False,
    force: bool = False,
    retificar: bool = False,
) -> dict:
    """Executa o pipeline completo.

    Args:
        retificar: Usa operacao=ALT (indRetif=2) para eventos já enviados anteriormente.
                   Útil para corrigir dados já registrados na Receita Federal.
    """
    init_db()
    relatorio = {
        "inicio": datetime.now().isoformat(),
        "etapas": {},
    }

    # ===== 1. Ler planilha =====
    pagamentos = ler_planilha(planilha)
    val = validar(pagamentos)
    relatorio["etapas"]["leitura"] = {
        "registros": len(pagamentos),
        "validacao": val,
    }
    if not val["ok"] and not force:
        relatorio["status"] = "erro_validacao"
        return relatorio
    if not val["ok"] and force:
        logger.warning(f"Validacao com avisos (--force): {val}")

    # ===== 2. Persistir beneficiários =====
    with get_session() as s:
        for p in pagamentos:
            s.merge(BenefDB(
                cpf_cnpj=p.cpf_cnpj, tipo=p.tipo.value, nome=p.nome,
            ))
        s.commit()

    # ===== 3. Gerar XMLs =====
    # Pré-calcula percentual SCP proporcional ao valor distribuído
    from decimal import Decimal as D
    total_scp = sum(p.vlr_lucros_scp for p in pagamentos if p.vlr_lucros_scp > 0)
    if total_scp > 0:
        for p in pagamentos:
            if p.vlr_lucros_scp > 0 and (p.scp_percentual is None or p.scp_percentual <= 0):
                p.scp_percentual = (p.vlr_lucros_scp / total_scp * 100).quantize(D("0.1"))

    xmls = []
    out_xmls = DATA_DIR / "output" / "xmls" / f"{competencia_ano}-{competencia_mes:02d}"
    out_xmls.mkdir(parents=True, exist_ok=True)

    op_cadastro = "ALT" if retificar else "INC"  # R-1000 / R-1050
    op_pagamento = "ALT" if retificar else "INC"  # R-4010 / R-4020 (ALT → indRetif=2)

    seq = 1
    # R-1000 — cadastro do contribuinte
    r1000 = gerar_r1000(operacao=op_cadastro, sequencial=seq); seq += 1
    xmls.append(("R-1000", None, r1000))
    (out_xmls / f"r1000_{seq:03d}.xml").write_text(r1000)

    # R-1050 — cadastro da SCP (uma vez por SCP)
    if settings.scp_cnpj:
        r1050 = gerar_r1050(operacao=op_cadastro, sequencial=seq); seq += 1
        xmls.append(("R-1050", None, r1050))
        (out_xmls / f"r1050_{seq:03d}.xml").write_text(r1050)

    # R-4010 / R-4020
    per_apur_str = f"{competencia_ano}-{competencia_mes:02d}"
    # Em modo retificação, busca os nrRecibo salvos no DB
    recibos_map: dict[str, str] = {}
    if retificar:
        with get_session() as s:
            from sqlalchemy import select
            rows = s.execute(
                select(EventoREINF.cpf_cnpj_benef, EventoREINF.recibo).where(
                    EventoREINF.tipo.in_(["R-4010", "R-4020"]),
                    EventoREINF.perApur == per_apur_str,
                    EventoREINF.recibo.isnot(None),
                )
            ).all()
            recibos_map = {cpf: rec for cpf, rec in rows if cpf and rec}
    if retificar and not recibos_map:
        logger.warning("Modo retificação ativo mas nenhum nrRecibo encontrado no DB — envio pode falhar.")

    for p in pagamentos:
        nr_rec = recibos_map.get(p.cpf_cnpj) if retificar else None
        if p.tipo == TipoBenef.PF:
            xml = gerar_r4010(p, competencia_ano, competencia_mes, sequencial=seq,
                              operacao=op_pagamento, nrRecibo=nr_rec)
            tipo = "R-4010"
        else:
            xml = gerar_r4020(p, competencia_ano, competencia_mes, sequencial=seq,
                              operacao=op_pagamento, nrRecibo=nr_rec)
            tipo = "R-4020"
        xmls.append((tipo, p.cpf_cnpj, xml))
        (out_xmls / f"{tipo.lower().replace('-', '')}_{p.cpf_cnpj}.xml").write_text(xml)
        seq += 1

    # R-4099 — fechamento (indica quais séries foram enviadas)
    tem_pf = any(p.tipo == TipoBenef.PF for p in pagamentos)
    tem_pj = any(p.tipo != TipoBenef.PF for p in pagamentos)
    r4099 = gerar_r4099(
        competencia_ano, competencia_mes, sequencial=seq,
        tem_r4010=tem_pf, tem_r4020=tem_pj,
    ); seq += 1
    xmls.append(("R-4099", None, r4099))
    (out_xmls / f"r4099_{seq:03d}.xml").write_text(r4099)

    relatorio["etapas"]["geracao_xml"] = {"total": len(xmls)}

    # ===== 4. Assinar =====
    xmls_assinados = []
    if Path(settings.cert_a1_path).exists() and settings.cert_a1_senha:
        for tipo, doc, xml in xmls:
            try:
                signed = assinar_xml(xml)
                xmls_assinados.append((tipo, doc, signed))
            except Exception as e:
                logger.error(f"Falha ao assinar {tipo} {doc}: {e}")
                xmls_assinados.append((tipo, doc, xml))  # fica não assinado
        relatorio["etapas"]["assinatura"] = {"assinados": len(xmls_assinados), "ok": True}
    else:
        logger.warning("Certificado não disponível — XMLs não serão assinados")
        xmls_assinados = xmls
        relatorio["etapas"]["assinatura"] = {"ok": False, "motivo": "cert ausente"}

    # ===== 5. Persistir eventos no DB =====
    with get_session() as s:
        for tipo, doc, xml in xmls_assinados:
            from lxml import etree
            try:
                root = etree.fromstring(xml.encode("utf-8"))
                evt = root.find(".//*[@id]")
                ev_id = evt.get("id") if evt is not None else f"unknown_{seq}"
            except Exception:
                ev_id = f"unknown_{datetime.now().timestamp()}"
            s.merge(EventoREINF(
                id=ev_id, tipo=tipo, cpf_cnpj_benef=doc,
                perApur=f"{competencia_ano}-{competencia_mes:02d}",
                xml_assinado=xml, status="assinado",
            ))
        s.commit()

    # ===== 6. Enviar à Receita =====
    if enviar_para_receita:
        try:
            with ReinfClient() as c:
                if retificar:
                    # Retificação (3 lotes sequenciais):
                    # Lote 0: reabertura (R-4099 fechRet=0) — abre período se fechado
                    # Lote 1: eventos ALT (R-1000 + R-1050 + R-4010/R-4020)
                    # Lote 2: fechamento (R-4099 fechRet=1)
                    r4099_reabertura = gerar_r4099(
                        competencia_ano, competencia_mes, sequencial=999, fechar=False,
                    )
                    try:
                        r4099_reabertura = assinar_xml(r4099_reabertura)
                    except Exception as e:
                        logger.warning(f"Falha ao assinar reabertura: {e}")

                    lote0 = c.montar_lote([r4099_reabertura])
                    resp0 = c.enviar_lote(lote0)
                    relatorio["etapas"]["envio_reabertura"] = resp0
                    if resp0.get("protocolo"):
                        for _ in range(20):
                            time.sleep(5)
                            st0 = c.consultar_protocolo(resp0["protocolo"])
                            if st0.get("status_codigo") and st0["status_codigo"] not in ("100", "200"):
                                relatorio["etapas"]["consulta_reabertura"] = st0
                                logger.info(f"Reabertura resultado: {st0.get('status_codigo')}")
                                break
                    # Reabertura pode falhar (período já aberto) — apenas logamos e seguimos

                    sem_r4099 = [x for t, _, x in xmls_assinados if t != "R-4099"]
                    so_r4099  = [x for t, _, x in xmls_assinados if t == "R-4099"]

                    if sem_r4099:
                        lote1 = c.montar_lote(sem_r4099)
                        resp1 = c.enviar_lote(lote1)
                        relatorio["etapas"]["envio_retif"] = resp1
                        if resp1.get("protocolo"):
                            for _ in range(20):
                                time.sleep(5)
                                st1 = c.consultar_protocolo(resp1["protocolo"])
                                if st1.get("status_codigo") and st1["status_codigo"] not in ("100", "200"):
                                    relatorio["etapas"]["consulta_retif"] = st1
                                    _salvar_recibos_db(st1, competencia_ano, competencia_mes)
                                    break

                    if so_r4099:
                        lote2 = c.montar_lote(so_r4099)
                        resp2 = c.enviar_lote(lote2)
                        relatorio["etapas"]["envio_fechamento"] = resp2
                        if resp2.get("protocolo"):
                            for _ in range(20):
                                time.sleep(5)
                                st2 = c.consultar_protocolo(resp2["protocolo"])
                                if st2.get("status_codigo") and st2["status_codigo"] not in ("100", "200"):
                                    relatorio["etapas"]["consulta_fechamento"] = st2
                                    break
                else:
                    lote = c.montar_lote([x for _, _, x in xmls_assinados])
                    resp = c.enviar_lote(lote)
                    relatorio["etapas"]["envio"] = resp

                    if resp.get("protocolo"):
                        # polling do recibo
                        for tentativa in range(20):
                            time.sleep(5)
                            st = c.consultar_protocolo(resp["protocolo"])
                            if st.get("status_codigo") and st["status_codigo"] not in ("100", "200"):
                                relatorio["etapas"]["consulta_protocolo"] = st
                                _salvar_recibos_db(st, competencia_ano, competencia_mes)
                                break
        except Exception as e:
            logger.exception("Falha no envio à Receita")
            relatorio["etapas"]["envio"] = {"ok": False, "erro": str(e)}

    # ===== 7. Gerar PDFs =====
    out_pdfs = DATA_DIR / "output" / "pdfs" / f"{competencia_ano}"
    out_pdfs.mkdir(parents=True, exist_ok=True)
    pdfs_gerados = []
    for p in pagamentos:
        if p.tipo == TipoBenef.PF:
            pdf = gerar_pdf_informe(p, out_pdfs)
            pdfs_gerados.append((p, pdf))
    relatorio["etapas"]["pdfs"] = {"gerados": len(pdfs_gerados)}

    # ===== 8. Distribuir =====
    if distribuir:
        dist_stats = {"email_ok": 0, "email_erro": 0, "wpp_ok": 0, "wpp_erro": 0}
        with get_session() as s:
            for p, pdf in pdfs_gerados:
                bdb = s.get(BenefDB, p.cpf_cnpj)
                if bdb and bdb.email:
                    r = enviar_email_informe(bdb.email, p.nome, pdf, p.ano_cal)
                    s.add(Distribuicao(
                        cpf_cnpj_benef=p.cpf_cnpj, canal="email", pdf_path=str(pdf),
                        status="ok" if r["ok"] else "erro", erro=r["erro"],
                    ))
                    dist_stats["email_ok" if r["ok"] else "email_erro"] += 1
                if bdb and bdb.telefone_whatsapp:
                    r = enviar_pdf_whatsapp(bdb.telefone_whatsapp, p.nome, pdf, p.ano_cal)
                    s.add(Distribuicao(
                        cpf_cnpj_benef=p.cpf_cnpj, canal="whatsapp", pdf_path=str(pdf),
                        status="ok" if r["ok"] else "erro", erro=r["erro"],
                    ))
                    dist_stats["wpp_ok" if r["ok"] else "wpp_erro"] += 1
            s.commit()
        relatorio["etapas"]["distribuicao"] = dist_stats

    relatorio["fim"] = datetime.now().isoformat()
    relatorio["status"] = "ok"
    return relatorio
