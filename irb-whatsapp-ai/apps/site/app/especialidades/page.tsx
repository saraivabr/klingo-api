import type { Metadata } from "next";

import { PageIntro } from "@/components/site/page-intro";
import { specialties } from "@/content/site";

export const metadata: Metadata = {
  title: "Especialidades",
};

export default function SpecialtiesPage() {
  return (
    <main>
      <PageIntro
        eyebrow="Especialidades"
        title="Uma arquitetura pensada para transformar cada serviço em uma página com narrativa e conversão."
        text="Essa base já separa conteúdo, componentes e rotas para que cada especialidade possa crescer sem duplicação."
      />
      <section className="content-section">
        <div className="shell card-grid card-grid-three">
          {specialties.map((specialty) => (
            <article key={specialty.slug} className="content-card">
              <p className="card-index">{specialty.slug}</p>
              <h2>{specialty.name}</h2>
              <p>{specialty.blurb}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
