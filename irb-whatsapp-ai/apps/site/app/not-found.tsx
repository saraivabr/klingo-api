import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="shell not-found-card">
        <p className="section-kicker">404</p>
        <h1>Esta página ainda não faz parte da nova arquitetura do site.</h1>
        <p>
          O site está sendo migrado para uma base estruturada em Next.js. Volte para a home e siga
          pela nova navegação.
        </p>
        <Link className="button button-primary" href="/">
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}
