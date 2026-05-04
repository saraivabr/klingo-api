"use client";

import { useEffect, useState } from "react";

type HeroSlide = {
  badge: string;
  badgeClassName: string;
  title: string;
  description: string;
  image: string;
  href: string;
  whatsappText: string;
  primaryLabel: string;
};

type SimpleLink = {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
};

type SearchItem = {
  name: string;
  icon: string;
  category: string;
  href: string;
};

const heroSlides: HeroSlide[] = [
  {
    badge: "Vagas Limitadas - Campanha Preventiva",
    badgeClassName: "bg-red-500/90",
    title: "Check Up Cardiológico",
    description:
      "Cuide do seu coração com tecnologia de ponta e os melhores especialistas. Exames completos e consulta no mesmo dia.",
    image: "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=1400&q=80",
    href: "/agendar?especialidade=cardiologia",
    whatsappText: "Olá, gostaria de agendar um Check Up Cardiologico",
    primaryLabel: "Ver Mais",
  },
  {
    badge: "Resultados em até 24h",
    badgeClassName: "bg-teal-500/90",
    title: "Exames Laboratoriais",
    description:
      "Análises clínicas completas com tecnologia de última geração. Resultados rápidos e precisos para o seu diagnóstico.",
    image: "https://images.unsplash.com/photo-1581595220892-b0739db3ba8c?w=1400&q=80",
    href: "/agendar?especialidade=exames",
    whatsappText: "Olá, gostaria de agendar exames laboratoriais",
    primaryLabel: "Agendar Exame",
  },
  {
    badge: "Atendimento Online",
    badgeClassName: "bg-indigo-500/90",
    title: "Teleconsulta",
    description:
      "Consulte seu médico de onde estiver. Atendimento por video com nossos especialistas, sem sair de casa.",
    image: "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=1400&q=80",
    href: "/agendar?especialidade=teleconsulta",
    whatsappText: "Olá, gostaria de agendar uma teleconsulta",
    primaryLabel: "Agendar Teleconsulta",
  },
];

const sidebarPrimaryLinks: SimpleLink[] = [
  { label: "Agendar Consulta", href: "/agendar", icon: "calendar_month" },
  { label: "Agendar Exames", href: "/agendar?especialidade=exames", icon: "biotech" },
  { label: "Resultado de Exames", href: "https://irb.klingo.app", icon: "description", external: true },
  { label: "Nossos Serviços", href: "#servicos", icon: "medical_services" },
  { label: "Especialidades", href: "#especialidades", icon: "stethoscope" },
  { label: "Associado Prime Care", href: "#associado", icon: "card_membership" },
];

const sidebarSecondaryLinks: SimpleLink[] = [
  { label: "Quem Somos", href: "#sobre", icon: "info" },
  { label: "Unidades", href: "#unidades", icon: "location_on" },
  { label: "Equipe Médica", href: "#equipe", icon: "group" },
  { label: "Blog / Instagram", href: "https://www.instagram.com/irbprimecare", icon: "article", external: true },
];

const trustBadges = [
  {
    label: "Acreditado pela ONA",
    tooltip: "Selo de qualidade da Organizacao Nacional de Acreditacao",
    icon: "workspace_premium",
    colorClassName: "text-amber-500",
  },
  {
    label: "ISO 9001",
    tooltip: "Certificacao internacional de gestao da qualidade",
    icon: "verified",
    colorClassName: "text-blue-500",
  },
  {
    label: "Google 4.9 estrelas",
    tooltip: "Avaliacao media no Google Maps com mais de 2.000 reviews",
    icon: "star",
    colorClassName: "text-yellow-500",
  },
  {
    label: "+200 mil pacientes",
    tooltip: "Mais de 200 mil pacientes atendidos desde a fundacao",
    icon: "shield",
    colorClassName: "text-green-500",
  },
];

const serviceCards = [
  {
    label: "Agendar Consulta",
    description: "Mais de 40 especialidades médicas disponíveis.",
    href: "/agendar?servico=consulta",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="12" y1="14" x2="12" y2="18" />
        <line x1="10" y1="16" x2="14" y2="16" />
      </svg>
    ),
    accentClassName: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white",
  },
  {
    label: "Agendar Exames",
    description: "Análises clínicas e exames de imagem avançados.",
    href: "/agendar?servico=exames",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 3h6v2H9V3z" />
        <path d="M10 5v6.5L6 18a2 2 0 002 2h8a2 2 0 002-2l-4-6.5V5" />
        <path d="M7 15h10" />
      </svg>
    ),
    accentClassName: "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 group-hover:bg-teal-600 group-hover:text-white",
  },
  {
    label: "IRB Odonto",
    description: "Saúde bucal completa para você e sua família.",
    href: "/agendar?especialidade=odontologia",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2C9 2 7 4 7 6.5c0 2 .5 3.5-1 7-.5 1.5 0 3 1 4s2.5 1.5 3 4c.3 1.5 1.5 1.5 2 0 .5-2.5 2-3 3-4s1.5-2.5 1-4c-1.5-3.5-1-5-1-7C15 4 13 2 12 2z" />
      </svg>
    ),
    accentClassName: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white",
  },
  {
    label: "Fisioterapia IRB",
    description: "Reabilitação especializada e cuidados preventivos.",
    href: "/agendar?especialidade=fisioterapia",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="4" r="2" />
        <path d="M12 6v4" />
        <path d="M8 10h8" />
        <path d="M10 14l-3 7" />
        <path d="M14 14l3 7" />
        <path d="M8 10l-3 4" />
        <path d="M16 10l3 4" />
      </svg>
    ),
    accentClassName: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white",
  },
];

const specialties = [
  { label: "Clínica Geral", icon: "medical_services", href: "/agendar?especialidade=clinica-geral" },
  { label: "Cardiologia", icon: "cardiology", href: "/agendar?especialidade=cardiologia" },
  { label: "Neurologia", icon: "neurology", href: "/agendar?especialidade=neurologia" },
  { label: "Reumatologia", icon: "rheumatology", href: "/agendar?especialidade=reumatologia" },
  { label: "Urologia", icon: "urology", href: "/agendar?especialidade=urologia" },
  { label: "Cirurgia Vascular", icon: "blood_pressure", href: "/agendar?especialidade=cirurgia-vascular" },
  { label: "Ortopedia", icon: "orthopedics", href: "/agendar?especialidade=ortopedia" },
  { label: "Ginecologia", icon: "female", href: "/agendar?especialidade=ginecologia" },
  { label: "Psiquiatria", icon: "psychology", href: "/agendar?especialidade=psiquiatria" },
  { label: "Odontologia", icon: "dentistry", href: "/agendar?especialidade=odontologia", badge: "Avaliação gratuita" },
  { label: "Nutrição", icon: "restaurant", href: "/agendar?especialidade=nutricao" },
  { label: "Fonoaudiologia", icon: "hearing", href: "/agendar?especialidade=fonoaudiologia" },
  { label: "Psicologia", icon: "self_improvement", href: "/agendar?especialidade=psicologia" },
];

const doctors = [
  {
    name: "Dr. Roberto Silva",
    specialty: "Cardiologia",
    details: "CRM 12345 | 12 anos exp.",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&q=80",
  },
  {
    name: "Dra. Maria Santos",
    specialty: "Cardiovascular",
    details: "CRM 23456 | 8 anos exp.",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&q=80",
  },
  {
    name: "Dr. Carlos Mendes",
    specialty: "Ortopedia",
    details: "CRM 34567 | 15 anos exp.",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&q=80",
  },
  {
    name: "Dra. Ana Oliveira",
    specialty: "Pediatria",
    details: "CRM 45678 | 10 anos exp.",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80",
  },
];

const units = [
  {
    name: "IRB Prime - Sede",
    description: "Unidade principal com todas as especialidades",
    hours: "Seg a Sex: 7h - 19h | Sab: 7h - 12h",
    phone: "(17) 3222-1234",
    accentClassName: "bg-primary/10 text-primary",
  },
  {
    name: "IRB Odonto",
    description: "Centro de odontologia especializada",
    hours: "Seg a Sex: 8h - 18h",
    phone: "(17) 3222-5678",
    accentClassName: "bg-teal-50 text-teal-600",
  },
  {
    name: "IRB Fisioterapia",
    description: "Reabilitação e cuidados preventivos",
    hours: "Seg a Sex: 7h - 20h",
    phone: "(17) 3222-9012",
    accentClassName: "bg-indigo-50 text-indigo-600",
  },
];

const associatedBenefits = [
  { icon: "savings", title: "Até 40% OFF", description: "Descontos em consultas e exames" },
  { icon: "priority_high", title: "Prioridade", description: "Agendamento prioritário em todas as unidades" },
  { icon: "family_restroom", title: "Plano Familiar", description: "Inclua toda sua família no mesmo plano" },
];

const accessLinks = [
  { label: "Agendamento Online", description: "Agende consultas e exames pela internet", icon: "calendar_month", href: "/agendar", accentClassName: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white" },
  { label: "Área do Paciente", description: "Acesse seu histórico e agendamentos", icon: "person", href: "https://irb.klingo.app", accentClassName: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white" },
  { label: "Resultados de Exames", description: "Consulte seus laudos e resultados", icon: "description", href: "https://irb.klingo.app", accentClassName: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white" },
  { label: "Teleconsulta", description: "Consulte seu médico por vídeo", icon: "videocam", href: "/agendar?especialidade=teleconsulta", accentClassName: "bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white" },
  { label: "Associado Prime Care", description: "Descontos de até 40% em consultas", icon: "card_membership", href: "https://wa.me/5517997796014?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20sobre%20o%20plano%20Associado%20Prime%20Care", accentClassName: "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white" },
  { label: "WhatsApp", description: "Atendimento via chat 24h", icon: "chat", href: "https://wa.me/5517997796014", accentClassName: "bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white" },
];

const searchItems: SearchItem[] = [
  { name: "Cardiologia", icon: "cardiology", category: "Especialidade", href: "/agendar?especialidade=cardiologia" },
  { name: "Ortopedia", icon: "orthopedics", category: "Especialidade", href: "/agendar?especialidade=ortopedia" },
  { name: "Pediatria", icon: "child_care", category: "Especialidade", href: "/agendar?especialidade=pediatria" },
  { name: "Dermatologia", icon: "dermatology", category: "Especialidade", href: "/agendar?especialidade=dermatologia" },
  { name: "Neurologia", icon: "neurology", category: "Especialidade", href: "/agendar?especialidade=neurologia" },
  { name: "Oftalmologia", icon: "ophthalmology", category: "Especialidade", href: "/agendar?especialidade=oftalmologia" },
  { name: "Odontologia", icon: "dentistry", category: "Especialidade", href: "/agendar?especialidade=odontologia" },
  { name: "Clínica Geral", icon: "medical_services", category: "Especialidade", href: "/agendar?especialidade=clinica-geral" },
  { name: "Exame de Sangue", icon: "biotech", category: "Exame", href: "/agendar?especialidade=exames" },
  { name: "Ultrassom", icon: "radiology", category: "Exame", href: "/agendar?especialidade=exames" },
  { name: "Ressonância", icon: "radiology", category: "Exame", href: "/agendar?especialidade=exames" },
  { name: "Teleconsulta", icon: "videocam", category: "Serviço", href: "/agendar?especialidade=teleconsulta" },
  { name: "Agendar Consulta", icon: "calendar_add_on", category: "Ação", href: "/agendar" },
  { name: "Resultado de Exames", icon: "description", category: "Ação", href: "https://irb.klingo.app" },
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.63 1.434h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function LegacyHomeExperience() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [counterValues, setCounterValues] = useState([15, 500, 200, 24]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const filteredSearchItems = searchItems.filter((item) =>
    item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
      searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    ),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSlide((value) => (value + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    const animateCounters = () => {
      const targets = [15, 500, 200, 24];
      const start = performance.now();
      const duration = 1800;

      const step = (time: number) => {
        const progress = Math.min((time - start) / duration, 1);
        const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
        setCounterValues(targets.map((target) => Math.round(target * eased)));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    };

    onScroll();
    animateCounters();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchQuery.length === 0) {
      setActiveSearchIndex(-1);
    }
  }, [searchQuery]);

  return (
    <>
      <style suppressHydrationWarning>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
          font-family: 'Inter', sans-serif;
        }
        html { scroll-behavior: smooth; }
        .card-hover {
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-hover:hover {
          transform: translateY(-6px) scale(1.015);
          box-shadow: 0 20px 40px -12px rgba(17, 82, 212, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.1);
        }
        @keyframes heroSlideIn {
          from { opacity: 0; transform: translateX(-48px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .hero-animate > * {
          opacity: 0;
          animation: heroSlideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hero-animate > *:nth-child(1) { animation-delay: 0.1s; }
        .hero-animate > *:nth-child(2) { animation-delay: 0.25s; }
        .hero-animate > *:nth-child(3) { animation-delay: 0.4s; }
        .hero-animate > *:nth-child(4) { animation-delay: 0.55s; }
        .trust-bar-enhanced {
          background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(241,245,249,0.95));
          backdrop-filter: blur(12px);
        }
        .dark .trust-bar-enhanced {
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95));
        }
        .trust-badge {
          transition: transform 0.3s ease, background 0.3s ease;
          border-radius: 12px;
          padding: 12px 16px;
          cursor: default;
          position: relative;
        }
        .trust-badge:hover {
          transform: translateY(-2px);
          background: rgba(17, 82, 212, 0.06);
        }
        .dark .trust-badge:hover {
          background: rgba(17, 82, 212, 0.15);
        }
        .trust-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          background: #1e293b;
          color: white;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease, transform 0.3s ease;
          z-index: 10;
        }
        .trust-badge:hover .trust-tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(-4px);
        }
        .gradient-border-card {
          position: relative;
          z-index: 0;
        }
        .gradient-border-card::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 18px;
          background: conic-gradient(from 0deg, #1152d4, #25D366, #06b6d4, #8b5cf6, #1152d4);
          z-index: -1;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .gradient-border-card:hover::before {
          opacity: 1;
        }
        @keyframes waPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.5); }
          50% { box-shadow: 0 0 0 14px rgba(37, 211, 102, 0); }
        }
        .wa-pulse {
          animation: waPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
      <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
        <div className="flex min-h-screen">
          <aside
            className={classNames(
              "w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col sticky top-0 h-screen overflow-y-auto",
              mobileSidebarOpen ? "fixed left-0 top-0 z-50 flex" : "hidden lg:flex",
            )}
          >
            <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
              <div className="bg-primary p-1.5 rounded-lg">
                <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
                  <path d="M16 2L4 7v8c0 7.73 5.12 14.96 12 16.9C22.88 29.96 28 22.73 28 15V7L16 2z" fill="white" opacity="0.2" />
                  <path d="M16 2L4 7v8c0 7.73 5.12 14.96 12 16.9C22.88 29.96 28 22.73 28 15V7L16 2z" stroke="white" strokeWidth="1.5" fill="none" />
                  <rect x="14.25" y="10" width="3.5" height="12" rx="1" fill="white" />
                  <rect x="10" y="14.25" width="12" height="3.5" rx="1" fill="white" />
                </svg>
              </div>
              <h1 className="font-bold text-xl tracking-tight text-primary">IRB Prime Care</h1>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1">
              {sidebarPrimaryLinks.map((link) => (
                <a
                  key={link.label}
                  className="flex items-center gap-3 px-4 py-3 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors group"
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noreferrer" : undefined}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <span className="material-symbols-outlined">{link.icon}</span>
                  <span className="font-medium">{link.label}</span>
                </a>
              ))}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                {sidebarSecondaryLinks.map((link) => (
                  <a
                    key={link.label}
                    className="flex items-center gap-3 px-4 py-3 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors group"
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noreferrer" : undefined}
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    <span className="material-symbols-outlined">{link.icon}</span>
                    <span className="font-medium">{link.label}</span>
                  </a>
                ))}
              </div>
            </nav>
            <div className="p-6">
              <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-xl border border-primary/20">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Suporte</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Precisa de ajuda com seu agendamento?</p>
                <a
                  href="https://wa.me/5517997796014"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 w-full py-2 px-4 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors inline-block text-center"
                >
                  Fale Conosco
                </a>
              </div>
            </div>
          </aside>

          {mobileSidebarOpen ? (
            <button
              aria-label="Fechar menu"
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
              type="button"
            />
          ) : null}

          <main className="flex-1 flex flex-col min-w-0">
            <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 flex items-center justify-between">
              <div className="lg:hidden flex items-center gap-3 cursor-pointer" onClick={() => setMobileSidebarOpen(true)}>
                <span className="material-symbols-outlined text-primary text-3xl">menu</span>
                <h1 className="font-bold text-lg text-primary">IRB Prime Care</h1>
              </div>
              <div className="flex-1 hidden md:flex items-center px-4 max-w-md">
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-full py-2 pl-10 text-sm focus:ring-2 focus:ring-primary/50"
                    placeholder="Buscar serviços ou exames..."
                    type="text"
                    autoComplete="off"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActiveSearchIndex((value) => Math.min(value + 1, filteredSearchItems.length - 1));
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveSearchIndex((value) => Math.max(value - 1, 0));
                      }
                      if (event.key === "Enter" && activeSearchIndex >= 0 && filteredSearchItems[activeSearchIndex]) {
                        window.location.href = filteredSearchItems[activeSearchIndex].href;
                      }
                    }}
                  />
                  {searchQuery.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-y-auto max-h-80 z-50">
                      {filteredSearchItems.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400">Nenhum resultado encontrado</div>
                      ) : (
                        filteredSearchItems.map((item, index) => (
                          <a
                            key={item.name}
                            href={item.href}
                            className={classNames(
                              "flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 cursor-pointer",
                              activeSearchIndex === index && "bg-primary/10 text-primary",
                            )}
                          >
                            <span className="material-symbols-outlined text-primary text-lg">{item.icon}</span>
                            <span className="flex-1">{item.name}</span>
                            <span className="text-xs text-slate-400">{item.category}</span>
                          </a>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  id="darkModeToggle"
                  className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-yellow-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Alternar modo escuro"
                  onClick={() => setIsDark((value) => !value)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-xl">{isDark ? "light_mode" : "dark_mode"}</span>
                </button>
                <a
                  href="https://irb.klingo.app"
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">person</span>
                  <span className="hidden sm:inline">Área do Paciente</span>
                </a>
              </div>
            </header>

            <section className="p-6 lg:p-10" id="heroSection">
              <div className="relative h-[380px] md:h-[480px] w-full rounded-2xl overflow-hidden group shadow-2xl" id="heroCarousel">
                {heroSlides.map((slide, index) => (
                  <div
                    key={slide.title}
                    className={classNames(
                      "absolute inset-0 transition-opacity duration-700",
                      currentSlide === index ? "opacity-100 z-10" : "opacity-0 z-0",
                    )}
                  >
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url("${slide.image}")` }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-transparent" />
                    </div>
                    <div className={classNames("absolute inset-0 flex flex-col justify-center px-8 md:px-20 max-w-3xl", currentSlide === index && "hero-animate")}>
                      <span className={classNames("backdrop-blur-md text-white border border-white/20 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest w-fit mb-6", slide.badgeClassName)}>
                        {slide.badge}
                      </span>
                      <h2 className="text-3xl md:text-6xl font-bold text-white leading-tight mb-6">{slide.title}</h2>
                      <p className="text-base md:text-lg text-slate-200 mb-8 max-w-xl">{slide.description}</p>
                      <div className="flex flex-wrap gap-4">
                        <a href={slide.href} className="px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2">
                          {slide.primaryLabel} <span className="material-symbols-outlined">arrow_forward</span>
                        </a>
                        <a
                          href={`https://wa.me/5517997796014?text=${encodeURIComponent(slide.whatsappText)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-8 py-4 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#20bd5a] transition-all flex items-center gap-2 shadow-lg"
                        >
                          <WhatsAppIcon className="w-5 h-5" />
                          Agendar pelo WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full hidden md:flex items-center justify-center text-white hover:bg-white/40 transition-all"
                  aria-label="Slide anterior"
                  onClick={() => setCurrentSlide((value) => (value - 1 + heroSlides.length) % heroSlides.length)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-2xl">chevron_left</span>
                </button>
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full hidden md:flex items-center justify-center text-white hover:bg-white/40 transition-all"
                  aria-label="Próximo slide"
                  onClick={() => setCurrentSlide((value) => (value + 1) % heroSlides.length)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-2xl">chevron_right</span>
                </button>
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                  {heroSlides.map((slide, index) => (
                    <button
                      key={slide.title}
                      className={classNames("h-1.5 rounded-full bg-white transition-all", currentSlide === index ? "w-10" : "w-2 bg-white/40")}
                      aria-label={`Slide ${index + 1}`}
                      onClick={() => setCurrentSlide(index)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="px-6 lg:px-10 -mt-4 mb-2" id="trustBar">
              <div className="max-w-5xl mx-auto trust-bar-enhanced rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg px-6 py-5 flex flex-wrap items-center justify-center gap-4 md:gap-8">
                {trustBadges.map((badge, index) => (
                  <div key={badge.label} className="contents">
                    <div className="trust-badge flex items-center gap-3 text-slate-600 dark:text-slate-400">
                      <span className={classNames("material-symbols-outlined text-2xl", badge.colorClassName)}>{badge.icon}</span>
                      <span className="text-sm font-semibold">{badge.label}</span>
                      <div className="trust-tooltip">{badge.tooltip}</div>
                    </div>
                    {index < trustBadges.length - 1 ? <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700" /> : null}
                  </div>
                ))}
              </div>
            </section>

            <section id="servicos" className="px-6 lg:px-10 pb-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {serviceCards.map((card) => (
                  <a key={card.label} href={card.href} className="gradient-border-card card-hover bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm group block">
                    <div className={classNames("w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-colors", card.accentClassName)}>
                      {card.icon}
                    </div>
                    <h3 className="font-bold text-lg mb-2">{card.label}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{card.description}</p>
                  </a>
                ))}
              </div>
            </section>

            <section id="sobre" className="px-6 lg:px-10 py-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">Bem-vindo à IRB Prime Care</h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                  Somos referência em cuidados integrados de saúde, unindo tecnologia de ponta e atendimento humanizado. Com uma rede de centros de excelência, estamos prontos para acompanhar você e sua família em todas as etapas da vida, garantindo precisão nos diagnósticos e eficácia nos tratamentos.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {[
                    { label: "Unidades", suffix: "+", value: counterValues[0] },
                    { label: "Especialistas", suffix: "+", value: counterValues[1] },
                    { label: "Pacientes Felizes", suffix: "k+", value: counterValues[2] },
                    { label: "Atendimento", suffix: "h", value: counterValues[3] },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-3xl font-extrabold text-primary mb-1">{item.value}{item.suffix}</p>
                      <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="especialidades" className="px-6 lg:px-10 py-12">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold mb-3 text-center">Nossas Especialidades</h2>
                <p className="text-slate-500 text-center mb-2">Consultas com especialistas qualificados para cuidar da sua saude</p>
                <p className="text-primary font-semibold text-center mb-8">Consultas a partir de R$ 210,00</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {specialties.map((specialty) => (
                    <a key={specialty.label} href={specialty.href} className="card-hover bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:shadow-md text-center group block">
                      <div className="w-10 h-10 mx-auto bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-2 group-hover:bg-primary group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined">{specialty.icon}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{specialty.label}</p>
                      {specialty.badge ? <p className="text-xs text-green-600 font-semibold mt-1">{specialty.badge}</p> : null}
                    </a>
                  ))}
                </div>
              </div>
            </section>

            <section id="equipe" className="px-6 lg:px-10 py-12 bg-white border-t border-slate-200">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold mb-3 text-center">Equipe Médica</h2>
                <p className="text-slate-500 text-center mb-10">Profissionais altamente qualificados e dedicados ao seu cuidado</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {doctors.map((doctor) => (
                    <div key={doctor.name} className="text-center group">
                      <div className="w-28 h-28 mx-auto rounded-full bg-slate-100 overflow-hidden mb-4 ring-4 ring-transparent group-hover:ring-primary/20 transition-all">
                        <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <h3 className="font-bold text-slate-900">{doctor.name}</h3>
                      <p className="text-sm text-primary font-medium">{doctor.specialty}</p>
                      <p className="text-xs text-slate-400 mt-1">{doctor.details}</p>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-8">
                  <a href="/agendar" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all">
                    Agendar com um especialista <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </a>
                </div>
              </div>
            </section>

            <section id="unidades" className="px-6 lg:px-10 py-12">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold mb-3 text-center">Nossas Unidades</h2>
                <p className="text-slate-500 text-center mb-10">Presente em diversas localidades para estar sempre perto de você</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {units.map((unit) => (
                    <div key={unit.name} className="card-hover bg-white p-6 rounded-2xl border border-slate-200">
                      <div className="flex items-start gap-4">
                        <div className={classNames("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", unit.accentClassName)}>
                          <span className="material-symbols-outlined">location_on</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-1">{unit.name}</h3>
                          <p className="text-sm text-slate-500 mb-3">{unit.description}</p>
                          <div className="space-y-2 text-xs text-slate-400">
                            <p className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span>{unit.hours}</p>
                            <p className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">call</span>{unit.phone}</p>
                          </div>
                          <a href="https://wa.me/5517997796014" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-primary text-xs font-bold hover:underline">
                            <span className="material-symbols-outlined text-sm">chat</span> Falar via WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="associado" className="px-6 lg:px-10 py-12 bg-primary text-white">
              <div className="max-w-4xl mx-auto text-center">
                <span className="material-symbols-outlined text-5xl mb-4">card_membership</span>
                <h2 className="text-3xl font-bold mb-4">Seja um Associado Prime Care</h2>
                <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
                  Tenha acesso a descontos exclusivos em consultas, exames e procedimentos. Planos individuais e familiares com atendimento prioritário.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  {associatedBenefits.map((item) => (
                    <div key={item.title} className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                      <span className="material-symbols-outlined text-3xl mb-3">{item.icon}</span>
                      <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                      <p className="text-sm text-blue-100">{item.description}</p>
                    </div>
                  ))}
                </div>
                <a href="https://wa.me/5517997796014?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20plano%20Associado%20Prime%20Care" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary font-bold rounded-xl hover:shadow-xl transition-all">
                  Quero ser Associado <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </a>
              </div>
            </section>

            <section className="px-6 lg:px-10 py-12 bg-slate-50 border-t border-slate-200">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold mb-3 text-center">Acesso Rápido</h2>
                <p className="text-slate-500 text-center mb-10">Acesse nossos sistemas e serviços online</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {accessLinks.map((link) => (
                    <a key={link.label} href={link.href} className="card-hover bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 group">
                      <div className={classNames("w-14 h-14 rounded-xl flex items-center justify-center transition-colors shrink-0", link.accentClassName)}>
                        <span className="material-symbols-outlined text-2xl">{link.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-bold mb-1">{link.label}</h3>
                        <p className="text-sm text-slate-500">{link.description}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </section>

            <footer className="mt-auto px-6 lg:px-10 py-10 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
              <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
                      <path d="M16 2L4 7v8c0 7.73 5.12 14.96 12 16.9C22.88 29.96 28 22.73 28 15V7L16 2z" fill="#1152d4" opacity="0.15" />
                      <path d="M16 2L4 7v8c0 7.73 5.12 14.96 12 16.9C22.88 29.96 28 22.73 28 15V7L16 2z" stroke="#1152d4" strokeWidth="1.5" fill="none" />
                      <rect x="14.25" y="10" width="3.5" height="12" rx="1" fill="#1152d4" />
                      <rect x="10" y="14.25" width="12" height="3.5" rx="1" fill="#1152d4" />
                    </svg>
                    <p className="font-bold text-slate-900 dark:text-white">IRB Prime Care</p>
                  </div>
                  <div className="flex gap-8 text-sm text-slate-500 dark:text-slate-400">
                    <a className="hover:text-primary transition-colors" href="https://wa.me/5517997796014?text=Gostaria%20de%20informacoes%20sobre%20os%20termos%20de%20uso">Termos de Uso</a>
                    <a className="hover:text-primary transition-colors" href="https://wa.me/5517997796014?text=Gostaria%20de%20informacoes%20sobre%20a%20politica%20de%20privacidade">Privacidade</a>
                    <button className="hover:text-primary transition-colors" type="button">Cookies</button>
                  </div>
                  <div className="flex items-center gap-4">
                    <a href="https://www.instagram.com/irbprimecare" target="_blank" rel="noreferrer" className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white transition-colors" aria-label="Instagram">
                      <span className="sr-only">Instagram</span>
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    </a>
                    <a href="https://www.facebook.com/irbprimecare" target="_blank" rel="noreferrer" className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white transition-colors" aria-label="Facebook">
                      <span className="sr-only">Facebook</span>
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                    <a href="https://www.linkedin.com/company/irbprimecare" target="_blank" rel="noreferrer" className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white transition-colors" aria-label="LinkedIn">
                      <span className="sr-only">LinkedIn</span>
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-sm text-slate-400">2026 IRB Prime Care. Todos os direitos reservados. <span className="text-[10px] text-slate-300 dark:text-slate-600 ml-2">Fotos: Unsplash</span></p>
                  <a href="https://wa.me/5517997796014?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20consulta" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#20bd5a] transition-all shadow-md">
                    <WhatsAppIcon className="w-4 h-4" />
                    Agendar pelo WhatsApp
                  </a>
                </div>
              </div>
            </footer>
          </main>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className="flex gap-2">
            <a href="/agendar" className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold rounded-xl text-sm shadow-lg hover:bg-primary/90 transition-all">
              <span className="material-symbols-outlined text-lg">calendar_month</span>
              Agendar Online
            </a>
            <a href="https://wa.me/5517997796014?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20consulta" target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#25D366] text-white font-bold rounded-xl text-sm shadow-lg hover:bg-[#20bd5a] transition-all">
              <WhatsAppIcon className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>

        <a className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-[#25D366] rounded-full hidden lg:flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform group wa-pulse" href="https://wa.me/5517997796014" target="_blank" rel="noreferrer">
          <WhatsAppIcon className="w-8 h-8" />
          <span className="absolute right-full mr-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-2 rounded-lg text-sm font-bold shadow-xl opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all whitespace-nowrap">Agende pelo WhatsApp</span>
        </a>

        <button
          className={classNames(
            "fixed bottom-24 right-8 z-50 w-12 h-12 bg-primary text-white rounded-full shadow-xl items-center justify-center hover:bg-primary/90 transition-all",
            showBackToTop ? "flex opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-4 hidden md:flex",
          )}
          aria-label="Voltar ao topo"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          type="button"
        >
          <span className="material-symbols-outlined">keyboard_arrow_up</span>
        </button>
      </div>
    </>
  );
}
