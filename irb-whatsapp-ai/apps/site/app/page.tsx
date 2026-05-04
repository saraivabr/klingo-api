import type { Metadata } from "next";
import Script from "next/script";

import { LegacyHomeExperience } from "@/components/site/legacy-home-experience";

export const metadata: Metadata = {
  title: "IRB Prime Care | Clínica Médica em São José do Rio Preto - Saúde e Bem-estar",
  description:
    "IRB Prime Care - Referencia em cuidados integrados de saude em Sao Jose do Rio Preto. Cardiologia, Ortopedia, Neurologia, Ginecologia, Estetica e mais. Agende sua consulta online.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://irb.saraiva.ai/",
  },
  openGraph: {
    type: "website",
    siteName: "IRB Prime Care",
    title: "IRB Prime Care | Clínica Médica em São José do Rio Preto",
    description:
      "Referencia em cuidados integrados de saude. Cardiologia, Ortopedia, Neurologia, Ginecologia, Estetica e mais. Agende online.",
    url: "https://irb.saraiva.ai/",
    images: ["https://irb.saraiva.ai/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "IRB Prime Care | Clínica Médica em São José do Rio Preto",
    description: "Referência em cuidados integrados de saúde. Agende sua consulta online.",
  },
};

export default function HomePage() {
  const jsonLdBlocks = [
    `{
      "@context": "https://schema.org",
      "@type": "MedicalOrganization",
      "name": "IRB Prime Care",
      "url": "https://irb.saraiva.ai",
      "logo": "https://irb.saraiva.ai/og-image.png",
      "description": "Referencia em cuidados integrados de saude em Sao Jose do Rio Preto. Especialidades: Cardiologia, Ortopedia, Neurologia, Ginecologia, Estetica e mais.",
      "telephone": "+55-17-99779-6014",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "São José do Rio Preto",
        "addressRegion": "SP",
        "addressCountry": "BR"
      }
    }`,
    `{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Como agendar uma consulta na IRB Prime Care?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Voce pode agendar sua consulta online pelo nosso site, pelo WhatsApp (17) 99779-6014, ou presencialmente em qualquer unidade IRB Prime Care."
          }
        },
        {
          "@type": "Question",
          "name": "Quais especialidades medicas estao disponiveis?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "A IRB Prime Care oferece mais de 40 especialidades medicas, incluindo Cardiologia, Ortopedia, Pediatria, Neurologia, Oftalmologia, Odontologia e Clinica Geral."
          }
        }
      ]
    }`,
  ];

  return (
    <>
      {jsonLdBlocks.map((jsonLd, index) => (
        <Script
          id={`legacy-jsonld-${index}`}
          key={`legacy-jsonld-${index}`}
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      ))}
      <LegacyHomeExperience />
    </>
  );
}
