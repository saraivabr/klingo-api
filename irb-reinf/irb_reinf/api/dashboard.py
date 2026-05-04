"""Dashboard FastAPI — visualização do estado dos eventos e distribuições."""
from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func

from irb_reinf.audit.db import (
    Beneficiario, Distribuicao, EventoREINF, get_session, init_db,
)
from irb_reinf.config import settings


app = FastAPI(title="IRB EFD-Reinf — Dashboard")
security = HTTPBasic()


def auth(creds: HTTPBasicCredentials = Depends(security)):
    if creds.username != settings.dashboard_user or creds.password != settings.dashboard_pass:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, headers={"WWW-Authenticate": "Basic"})
    return creds.username


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/", response_class=HTMLResponse)
def home(_: str = Depends(auth)):
    with get_session() as s:
        tot_evt = s.query(EventoREINF).count()
        por_status = dict(s.query(EventoREINF.status, func.count()).group_by(EventoREINF.status).all())
        por_tipo = dict(s.query(EventoREINF.tipo, func.count()).group_by(EventoREINF.tipo).all())
        tot_benef = s.query(Beneficiario).count()
        tot_dist = s.query(Distribuicao).count()
        dist_ok = s.query(Distribuicao).filter(Distribuicao.status == "ok").count()

    return f"""
    <html><head><title>IRB EFD-Reinf</title>
    <style>
      body {{ font-family: -apple-system, sans-serif; background:#f7f8fb; margin:0; padding:24px; }}
      h1 {{ color:#1a3870; }}
      .grid {{ display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin:24px 0; }}
      .card {{ background:#fff; border-radius:12px; padding:18px; box-shadow:0 1px 3px rgba(0,0,0,.05); }}
      .card h3 {{ margin:0; color:#888; font-weight:500; font-size:13px; text-transform:uppercase; }}
      .card .v {{ font-size:32px; font-weight:700; color:#1a3870; margin-top:8px; }}
      table {{ width:100%; background:#fff; border-collapse: collapse; border-radius:12px; overflow:hidden; }}
      th, td {{ padding:10px; text-align:left; border-bottom:1px solid #eef; font-size:13px; }}
      th {{ background:#1a3870; color:#fff; }}
      .badge {{ padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; }}
      .badge.ok {{ background:#dcfce7; color:#166534; }}
      .badge.erro {{ background:#fee2e2; color:#991b1b; }}
      .badge.pending {{ background:#fef9c3; color:#854d0e; }}
    </style></head><body>
    <h1>IRB EFD-Reinf — Painel</h1>
    <p>Ambiente: <b>{settings.reinf_ambiente}</b> | Atualizado: {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
    <div class="grid">
      <div class="card"><h3>Eventos REINF</h3><div class="v">{tot_evt}</div></div>
      <div class="card"><h3>Beneficiários</h3><div class="v">{tot_benef}</div></div>
      <div class="card"><h3>Distribuições</h3><div class="v">{tot_dist}</div></div>
      <div class="card"><h3>Distrib. OK</h3><div class="v">{dist_ok}</div></div>
    </div>
    <h2>Eventos por status</h2>
    <table>
      <tr><th>Status</th><th>Quantidade</th></tr>
      {"".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in por_status.items())}
    </table>
    <h2 style="margin-top:32px">Eventos por tipo</h2>
    <table>
      <tr><th>Tipo</th><th>Quantidade</th></tr>
      {"".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in por_tipo.items())}
    </table>
    <p style="margin-top:32px"><a href="/eventos">Ver todos os eventos →</a></p>
    </body></html>
    """


@app.get("/eventos", response_class=HTMLResponse)
def eventos(_: str = Depends(auth)):
    with get_session() as s:
        evs = s.query(EventoREINF).order_by(EventoREINF.criado_em.desc()).limit(500).all()
    rows = []
    for e in evs:
        st_class = "ok" if e.status == "sucesso" else ("erro" if e.status == "erro" else "pending")
        rows.append(f"""<tr>
            <td>{e.id[:24]}…</td><td>{e.tipo}</td>
            <td>{e.cpf_cnpj_benef or ''}</td><td>{e.perApur or ''}</td>
            <td><span class="badge {st_class}">{e.status}</span></td>
            <td>{e.protocolo or ''}</td><td>{e.criado_em.strftime('%d/%m %H:%M')}</td>
        </tr>""")
    return f"""
    <html><head><title>Eventos</title><style>
      body {{font-family:-apple-system,sans-serif;background:#f7f8fb;padding:24px}}
      table{{width:100%;background:#fff;border-collapse:collapse;border-radius:12px;overflow:hidden}}
      th,td{{padding:8px 10px;text-align:left;border-bottom:1px solid #eef;font-size:12px}}
      th{{background:#1a3870;color:#fff}}
      .badge{{padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600}}
      .badge.ok{{background:#dcfce7;color:#166534}}
      .badge.erro{{background:#fee2e2;color:#991b1b}}
      .badge.pending{{background:#fef9c3;color:#854d0e}}
    </style></head><body>
    <h1>Eventos REINF (últimos 500)</h1>
    <table><tr><th>ID</th><th>Tipo</th><th>Benef.</th><th>perApur</th><th>Status</th><th>Protocolo</th><th>Criado</th></tr>
    {''.join(rows)}
    </table>
    <p><a href="/">← voltar</a></p>
    </body></html>
    """
