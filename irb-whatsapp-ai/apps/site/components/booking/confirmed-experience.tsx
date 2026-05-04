"use client";

import { useEffect, useMemo, useState } from "react";

type BookingData = {
  kind?: "consultation" | "exam";
  doctorName: string;
  specialty: string;
  date: string;
  dateISO: string;
  time: string;
  doctorFee: number;
  selectedExams?: Array<{ id: string; name: string; priceCents?: number }>;
  physicalRequestRequired?: boolean;
  doctorSubtitle?: string;
  doctorImage?: string;
};

const fallbackBooking: BookingData = {
  doctorName: "Dr. Roberto Silva",
  specialty: "Cardiologia",
  date: "12 Mar, 2026",
  dateISO: "2026-03-12",
  time: "14:30",
  doctorFee: 250,
  doctorSubtitle: "Cardiologista Senior - 12+ Anos Exp.",
  doctorImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&q=80",
};

function formatDateForReceipt(dateISO: string) {
  const [year, month, day] = dateISO.split("-");
  return `${day}/${month}/${year}`;
}

export function ConfirmedExperience() {
  const [booking, setBooking] = useState(fallbackBooking);
  const [countdownText, setCountdownText] = useState("Calculando...");
  const [confettiDots, setConfettiDots] = useState<Array<{ left: number; delay: number; duration: number; color: string }>>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("irb_booking");
    if (stored) {
      try {
        setBooking({ ...fallbackBooking, ...JSON.parse(stored) });
      } catch {}
    }

    setConfettiDots(
      Array.from({ length: 24 }, (_, index) => ({
        left: Math.random() * 100,
        delay: index * 0.08,
        duration: 3 + Math.random() * 2,
        color: ["#1152d4", "#25D366", "#f59e0b", "#ef4444", "#8b5cf6"][index % 5],
      })),
    );
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const appointmentDate = new Date(`${booking.dateISO}T${booking.time}:00-03:00`);
      const diff = appointmentDate.getTime() - Date.now();
      if (diff <= 0) {
        setCountdownText("Consulta em andamento ou concluída");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days === 0 && hours === 0) {
        setCountdownText(`Sua consulta começa em ${mins} min!`);
      } else if (days === 0) {
        setCountdownText(`Sua consulta é hoje! Faltam ${hours}h ${mins}min`);
      } else if (days === 1) {
        setCountdownText(`Sua consulta é amanhã! Faltam ${hours}h`);
      } else {
        setCountdownText(`Sua consulta é em ${days} dias e ${hours}h`);
      }
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 60000);
    return () => window.clearInterval(timer);
  }, [booking]);

  const appointmentDate = useMemo(() => new Date(`${booking.dateISO}T${booking.time}:00-03:00`), [booking]);
  const appointmentEnd = useMemo(() => new Date(appointmentDate.getTime() + 60 * 60 * 1000), [appointmentDate]);
  const receiptDate = formatDateForReceipt(booking.dateISO);
  const isExamBooking = booking.kind === "exam";

  function openGoogleCalendar() {
    const formatCalendarDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const url =
      "https://www.google.com/calendar/render?action=TEMPLATE" +
      `&text=${encodeURIComponent(`${isExamBooking ? "Exames" : "Consulta"} - IRB Prime Care - ${booking.specialty}`)}` +
      `&dates=${formatCalendarDate(appointmentDate)}/${formatCalendarDate(appointmentEnd)}` +
      `&details=${encodeURIComponent(`${isExamBooking ? "Agendamento de exames" : `Consulta de ${booking.specialty} com ${booking.doctorName}`}. Chegar 15 min antes. Pedido medico fisico obrigatorio quando houver.`)}` +
      `&location=${encodeURIComponent("IRB Prime Care - Unidade Central, São José do Rio Preto - SP")}` +
      "&sf=true&output=xml";
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadReceipt() {
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Comprovante - IRB Prime Care</title><style>body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:20px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #1152d4;padding-bottom:20px;margin-bottom:30px}.header h1{color:#1152d4;margin:0;font-size:24px}.badge{display:inline-block;background:#059669;color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:bold;margin:15px 0}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:25px 0}.info-item{background:#f8fafc;padding:15px;border-radius:8px;border-left:3px solid #1152d4}.label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:bold;margin-bottom:5px}.value{font-size:15px;font-weight:bold;color:#1e293b}.total{text-align:right;font-size:22px;font-weight:bold;color:#1152d4;margin:25px 0;padding:15px;background:#eff6ff;border-radius:8px}</style></head><body><div class="header"><h1>IRB Prime Care</h1><div class="badge">CONFIRMADO</div></div><div class="info-grid"><div class="info-item"><div class="label">Especialista</div><div class="value">${booking.doctorName}</div></div><div class="info-item"><div class="label">Especialidade</div><div class="value">${booking.specialty}</div></div><div class="info-item"><div class="label">Data</div><div class="value">${receiptDate}</div></div><div class="info-item"><div class="label">Horário</div><div class="value">${booking.time}</div></div></div><div class="total">Valor: R$ ${booking.doctorFee},00</div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "comprovante-irb-prime-care.html";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        body {
          font-family: 'Inter', sans-serif;
          background-color: #f6f6f8;
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 25v10M25 30h10' stroke='%231152d4' stroke-opacity='0.04' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        @keyframes checkBounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        .success-check {
          animation: checkBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scale(0.5); opacity: 0; }
        }
      `}</style>
      <div className="text-slate-900">
        <div className="flex min-h-screen pt-14 md:pt-0">
          <aside className="hidden md:flex flex-col w-80 bg-slate-50 border-r border-transparent py-8 px-6">
            <a href="/" className="mb-12">
              <h1 className="text-xl font-extrabold tracking-tighter text-primary">IRB Prime Care</h1>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Portal do Paciente</p>
            </a>
            <nav className="space-y-8 flex-grow">
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progresso do Agendamento</p>
                {["Selecionar Especialista", "Escolher Horário"].map((label, index) => (
                  <div key={label} className="flex items-center gap-4 opacity-50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Passo {index + 1}</p>
                      <p className="text-sm font-medium text-slate-600">{label}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary">Passo 3</p>
                    <p className="text-sm font-semibold text-slate-900">Confirmado</p>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-200">
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Progresso Geral</p>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-primary rounded-full" />
                  </div>
                  <p className="text-xs font-bold text-primary mt-2 text-right">100% Concluído</p>
                </div>
              </div>
            </nav>
          </aside>

          <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-background">
            <div className="max-w-2xl w-full">
              <div className="mb-8">
                <div className="flex items-center justify-center gap-0">
                  {["Agendar", "Pagamento", "Confirmação"].map((label, index) => (
                    <div key={label} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md shadow-green-500/30">
                          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        </div>
                        <span className="hidden sm:block text-xs font-bold text-green-600 mt-1.5">{label}</span>
                      </div>
                      {index < 2 ? <div className="w-12 sm:w-20 h-0.5 bg-green-500 mx-1 sm:mx-2 mt-[-18px] sm:mt-[-10px]" /> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center mb-10">
                <div className="success-check inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 mb-6 border-2 border-emerald-100">
                  <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'wght' 600" }}>check_circle</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Agendamento Confirmado!</h2>
                <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                  {isExamBooking ? "Seu agendamento de exames foi registrado com sucesso." : <>Sua consulta com <span className="text-slate-900 font-semibold">{booking.doctorName}</span> foi agendada com sucesso.</>} Você receberá um e-mail de confirmação em breve.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 bg-primary/10 text-primary font-bold text-sm px-5 py-2.5 rounded-full">
                  <span className="material-symbols-outlined text-lg">timer</span>
                  <span>{countdownText}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-transparent hover:border-primary/20 transition-all flex items-center gap-5">
                  <img alt={booking.doctorName} className="w-16 h-16 rounded-full object-cover grayscale-[20%]" src={booking.doctorImage ?? fallbackBooking.doctorImage} />
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{isExamBooking ? "Exames" : "Especialista"}</p>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{isExamBooking ? "IRB Prime Care" : booking.doctorName}</h3>
                    <p className="text-sm text-slate-500">{booking.doctorSubtitle ?? booking.specialty}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-transparent flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-primary mb-2">calendar_today</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data</p>
                  <p className="text-sm font-bold text-slate-900">{booking.date}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-transparent flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-primary mb-2">schedule</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Horário</p>
                  <p className="text-sm font-bold text-slate-900">{booking.time}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-transparent flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-primary mb-2">location_on</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Local</p>
                  <p className="text-sm font-bold text-slate-900">IRB Prime - Unidade Central</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <a href="https://irb.klingo.app" className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-3 transition-all hover:bg-blue-700">
                  Ir para o Dashboard
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </a>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button onClick={openGoogleCalendar} className="flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 font-semibold py-3 px-6 rounded-xl hover:bg-slate-50 transition-colors" type="button">
                    <span className="material-symbols-outlined text-xl">event</span>
                    Adicionar ao Google Calendar
                  </button>
                  <div className="flex gap-2">
                    <button onClick={downloadReceipt} className="flex-1 flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors" type="button">
                      <span className="material-symbols-outlined text-xl">download</span>
                      Baixar
                    </button>
                    <button onClick={() => window.print()} className="flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors" title="Imprimir" type="button">
                      <span className="material-symbols-outlined text-xl">print</span>
                      Imprimir
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button onClick={() => navigator.share?.({ title: "Consulta - IRB Prime Care", text: `${booking.doctorName} - ${receiptDate} às ${booking.time}`, url: window.location.href })} className="flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 font-semibold py-3 px-6 rounded-xl hover:bg-slate-50 transition-colors" type="button">
                    <span className="material-symbols-outlined text-xl">share</span>
                    Compartilhar
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(`${booking.doctorName} | ${booking.specialty} | ${receiptDate} às ${booking.time}`)} className="flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 font-semibold py-3 px-6 rounded-xl hover:bg-slate-50 transition-colors" type="button">
                    <span className="material-symbols-outlined text-xl">content_copy</span>
                    Copiar Detalhes
                  </button>
                </div>
              </div>

              <footer className="mt-12 text-center">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em]">IRB Prime Care - Agendamento Seguro</p>
              </footer>
            </div>
          </main>

          <aside className="hidden lg:flex flex-col w-96 bg-white border-l border-transparent py-12 px-8 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-8 uppercase tracking-widest">Guia de Preparação</h3>
            <div className="space-y-8">
              {(isExamBooking ? [
                { title: "Pedido Físico Obrigatório", description: "Apresente o pedido médico físico na recepção, mesmo que tenha enviado foto pelo site." },
                { title: "Documento e Convênio", description: "Leve documento com foto e carteirinha do convênio, se o exame for por convênio." },
                { title: "Preparo do Exame", description: "Alguns exames exigem jejum ou preparo específico. Confirme a orientação final antes do horário." },
              ] : [
                { title: "Jejum Necessário", description: "Por favor, não consuma alimentos ou bebidas (exceto água) por 8 horas antes da consulta." },
                { title: "Exames Anteriores", description: "Traga cópias de exames de sangue recentes ou avaliações cardiovasculares que possua." },
                { title: "Horário de Check-in", description: "Chegue pelo menos 15 minutos antes do horário agendado para coleta de sinais vitais." },
              ]).map((item, index) => (
                <div key={item.title} className="relative pl-8">
                  <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center border border-slate-200">{String(index + 1).padStart(2, "0")}</div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-auto">
              <div className="bg-blue-50/50 rounded-2xl p-6 border-2 border-primary/10">
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-outlined text-primary">info</span>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest">Política de Cancelamento</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cancelamentos devem ser feitos com pelo menos 24 horas de antecedência para evitar taxa de serviço.
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          {confettiDots.map((dot, index) => (
            <span
              key={`${dot.left}-${index}`}
              className="absolute top-[-10px] w-2 h-2 rounded-full"
              style={{
                left: `${dot.left}%`,
                background: dot.color,
                animation: `confettiFall ${dot.duration}s linear ${dot.delay}s forwards`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
