"""CLI principal — ponto de entrada do sistema."""
from pathlib import Path

import typer
import uvicorn
from rich.console import Console
from rich.table import Table

from irb_reinf.config import DATA_DIR, settings
from irb_reinf.orchestrator.pipeline import executar_pipeline, reabrir_periodo


app = typer.Typer(help="IRB EFD-Reinf — geração e transmissão de informes")
console = Console()


@app.command()
def run(
    planilha: Path = typer.Argument(..., help="Planilha XLSX/CSV de pagamentos"),
    ano: int = typer.Option(2025, "--ano", help="Ano-calendário"),
    mes: int = typer.Option(12, "--mes", help="Mês de competência (1-12)"),
    enviar: bool = typer.Option(False, "--enviar", help="Enviar à Receita Federal"),
    distribuir: bool = typer.Option(False, "--distribuir", help="Distribuir aos médicos"),
    force: bool = typer.Option(False, "--force", help="Continua mesmo com erros de validação (uso em testes)"),
    retificar: bool = typer.Option(False, "--retificar", help="Usa indRetif=2/ALT para retificar eventos já enviados"),
):
    """Executa o pipeline completo."""
    console.print(f"[bold blue]IRB EFD-Reinf — Pipeline[/]")
    console.print(f"  Planilha: {planilha}")
    console.print(f"  Período: {ano}-{mes:02d}")
    console.print(f"  Ambiente: [yellow]{settings.reinf_ambiente}[/]")
    console.print(f"  Enviar: {enviar}  |  Distribuir: {distribuir}  |  Force: {force}  |  Retificar: {retificar}\n")

    relatorio = executar_pipeline(planilha, ano, mes, enviar, distribuir, force=force, retificar=retificar)

    console.print("\n[bold green]📊 Relatório:[/]")
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Etapa")
    table.add_column("Resultado")
    for etapa, dados in relatorio.get("etapas", {}).items():
        table.add_row(etapa, str(dados))
    console.print(table)
    console.print(f"\nStatus final: [bold]{relatorio.get('status', '?')}[/]")


@app.command()
def dashboard():
    """Sobe o painel web."""
    console.print(f"[bold]🌐 Dashboard em http://localhost:{settings.dashboard_port}[/]")
    uvicorn.run(
        "irb_reinf.api.dashboard:app",
        host="0.0.0.0", port=settings.dashboard_port, reload=False,
    )


@app.command()
def gerar_pdf(
    cpf: str = typer.Argument(..., help="CPF do beneficiário"),
    planilha: Path = typer.Argument(..., help="Planilha de origem"),
):
    """Gera apenas o PDF de 1 beneficiário (debug)."""
    from irb_reinf.extractors.excel_extractor import ler_planilha
    from irb_reinf.generators.pdf_informe import gerar_pdf_informe

    pgts = ler_planilha(planilha)
    cpf_clean = "".join(c for c in cpf if c.isdigit())
    p = next((x for x in pgts if x.cpf_cnpj == cpf_clean), None)
    if not p:
        console.print(f"[red]CPF {cpf} não encontrado na planilha[/]")
        raise typer.Exit(1)
    pdf = gerar_pdf_informe(p, DATA_DIR / "output" / "pdfs" / "preview")
    console.print(f"[green]✅ PDF gerado:[/] {pdf}")


@app.command()
def reabrir(
    ano: int = typer.Option(2025, "--ano", help="Ano-calendário"),
    mes: int = typer.Option(12, "--mes", help="Mês de competência"),
    enviar: bool = typer.Option(False, "--enviar", help="Enviar à Receita Federal"),
):
    """Reabre período de apuração já fechado (R-4099 fechRet=0).

    Use antes de --retificar quando o período já foi fechado em envio anterior.
    """
    console.print(f"[bold yellow]Reabrindo período {ano}-{mes:02d}...[/]")
    r = reabrir_periodo(ano, mes, enviar_para_receita=enviar)
    console.print(r)


@app.command()
def init():
    """Inicializa o banco de dados."""
    from irb_reinf.audit.db import init_db
    init_db()
    console.print("[green]Banco inicializado[/]")


if __name__ == "__main__":
    app()
