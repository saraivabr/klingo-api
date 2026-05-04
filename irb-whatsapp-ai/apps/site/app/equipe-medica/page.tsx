import type { Metadata } from "next";

import { PageIntro } from "@/components/site/page-intro";
import { doctors } from "@/content/site";

export const metadata: Metadata = {
  title: "Equipe médica",
};

export default function MedicalTeamPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Equipe médica"
        title="Perfis preparados para autoridade clínica, reputação e descoberta orgânica."
        text="O próximo passo natural é conectar cada médico a especialidades, conteúdo, agenda e prova de confiança."
      />
      <section className="content-section">
        <div className="shell card-grid">
          {doctors.map((doctor) => (
            <article key={doctor.name} className="doctor-card doctor-card-detailed">
              <div className="doctor-avatar" aria-hidden="true">
                {doctor.initials}
              </div>
              <div>
                <p className="card-label">{doctor.role}</p>
                <h2>{doctor.name}</h2>
                <p>{doctor.summary}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
