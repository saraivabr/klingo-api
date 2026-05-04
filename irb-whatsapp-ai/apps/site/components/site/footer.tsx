import Link from "next/link";

import { navigation, siteMeta } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="section-kicker">IRB Prime Care</p>
          <h2>Clínica integrada com jornada mais clara, humana e precisa.</h2>
        </div>
        <div>
          <p className="footer-title">Explorar</p>
          <div className="footer-links">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="footer-title">Contato</p>
          <div className="footer-links">
            <a href={siteMeta.whatsappUrl} target="_blank" rel="noreferrer">
              WhatsApp clínico
            </a>
            <a href={siteMeta.patientAreaUrl} target="_blank" rel="noreferrer">
              Portal do paciente
            </a>
            <Link href="/agendar">Iniciar agendamento</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
