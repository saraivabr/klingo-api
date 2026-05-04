"""Banco SQLite com modelos de auditoria (eventos, distribuições, recibos)."""
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, String, Text, create_engine, Numeric,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship

from irb_reinf.config import settings, DATA_DIR


DB_PATH = Path(settings.database_url.replace("sqlite:///", ""))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


class Base(DeclarativeBase):
    pass


class EventoREINF(Base):
    __tablename__ = "eventos_reinf"
    id = Column(String(40), primary_key=True)         # ID...
    tipo = Column(String(8))                           # R-1000 / R-1050 / R-4010 / etc.
    cpf_cnpj_benef = Column(String(14), nullable=True)
    perApur = Column(String(7))
    xml_assinado = Column(Text)
    status = Column(String(20), default="gerado")
    protocolo = Column(String(60), nullable=True)
    recibo = Column(String(60), nullable=True)
    erro_mensagem = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    enviado_em = Column(DateTime, nullable=True)
    confirmado_em = Column(DateTime, nullable=True)


class Beneficiario(Base):
    __tablename__ = "beneficiarios"
    cpf_cnpj = Column(String(14), primary_key=True)
    tipo = Column(String(2))
    nome = Column(String(120))
    email = Column(String(120), nullable=True)
    telefone_whatsapp = Column(String(20), nullable=True)
    endereco = Column(Text, nullable=True)


class Distribuicao(Base):
    __tablename__ = "distribuicoes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    cpf_cnpj_benef = Column(String(14))
    canal = Column(String(20))             # email | whatsapp | portal | mala_direta
    pdf_path = Column(String(255))
    status = Column(String(20))            # ok | erro | pendente
    erro = Column(Text, nullable=True)
    enviado_em = Column(DateTime, default=datetime.utcnow)
    visualizado_em = Column(DateTime, nullable=True)


_engine = create_engine(settings.database_url, future=True)


def init_db():
    Base.metadata.create_all(_engine)


def get_session() -> Session:
    return Session(_engine, future=True)
