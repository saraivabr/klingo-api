import Link from "next/link";

import { navigation, siteMeta } from "@/content/site";

import { ButtonLink } from "./button-link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            IRB
          </span>
          <span>
            <strong>{siteMeta.name}</strong>
            <small>Saúde integrada com direção clínica</small>
          </span>
        </Link>
        <nav className="nav">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <ButtonLink href={siteMeta.patientAreaUrl} variant="ghost">
            Área do paciente
          </ButtonLink>
          <ButtonLink href="/agendar">Agendar</ButtonLink>
        </div>
      </div>
    </header>
  );
}
