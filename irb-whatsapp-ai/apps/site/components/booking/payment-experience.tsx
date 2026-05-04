"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BookingData = {
  kind?: "consultation" | "exam";
  doctorName: string;
  specialty: string;
  date: string;
  dateISO: string;
  time: string;
  doctorFee: number;
  totalCents?: number;
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
  doctorSubtitle: "Especialista em Cardiologia",
  doctorImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&q=80",
};

function formatPrice(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function PaymentExperience() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mode, setMode] = useState<"card" | "pix">("card");
  const [booking, setBooking] = useState<BookingData>(fallbackBooking);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [saveCard, setSaveCard] = useState(true);
  const [pixSecondsLeft, setPixSecondsLeft] = useState(1800);
  const isCardValid = cardName.trim().length >= 3 && cardNumber.replace(/\s/g, "").length === 16 && cardExpiry.length === 5 && cardCvv.length >= 3;

  useEffect(() => {
    const stored = window.localStorage.getItem("irb_booking");
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<BookingData>;
      setBooking({
        ...fallbackBooking,
        ...parsed,
        doctorFee: Number(parsed.doctorFee ?? fallbackBooking.doctorFee),
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (mode !== "pix") {
      setPixSecondsLeft(1800);
      return;
    }

    const timer = window.setInterval(() => {
      setPixSecondsLeft((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [mode]);

  const brand = useMemo(() => {
    const clean = cardNumber.replace(/\s/g, "");
    if (clean.startsWith("4")) return "visa";
    const prefix = Number(clean.slice(0, 2));
    if (prefix >= 51 && prefix <= 55) return "master";
    return "";
  }, [cardNumber]);

  const pixTimerLabel = `${String(Math.floor(pixSecondsLeft / 60)).padStart(2, "0")}:${String(pixSecondsLeft % 60).padStart(2, "0")}`;
  const canContinue = mode === "pix" || isCardValid;
  const isExamBooking = booking.kind === "exam";
  const itemLabel = isExamBooking ? "Exames" : "Consulta";

  function completePayment() {
    const nextBooking = {
      ...booking,
      paid: true,
      paymentMethod: mode,
      saveCard,
    };
    window.localStorage.setItem("irb_booking", JSON.stringify(nextBooking));
    router.push("/confirmado");
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
        .active-step-ring {
          box-shadow: 0 0 0 2px white, 0 0 0 4px #1152d4;
        }
      `}</style>
      <div className="bg-background text-slate-900 min-h-screen flex">
        <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-4">
          <button onClick={() => setMobileSidebarOpen((value) => !value)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100" type="button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1152d4" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-bold tracking-tight text-primary">IRB Prime Care</span>
          <a href="/agendar" className="flex items-center gap-1 text-xs font-semibold text-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1152d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Voltar
          </a>
        </header>

        <aside className={`fixed left-0 top-0 z-50 h-screen w-64 bg-slate-50 border-r border-transparent py-6 ${mobileSidebarOpen ? "flex" : "hidden md:flex"} flex-col`}>
          <a href="/" className="px-6 mb-8 block">
            <h1 className="text-xl font-extrabold tracking-tighter text-blue-700">IRB Prime Care</h1>
            <p className="text-xs font-medium text-slate-500">Portal do Paciente</p>
          </a>
          <nav className="flex-1 space-y-1">
            <a href="https://irb.klingo.app" className="hover:bg-slate-200 transition-all text-slate-600 mx-2 px-4 py-3 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="font-medium text-sm">Dashboard</span>
            </a>
            <a href="/agendar" className="bg-blue-50 text-blue-700 mx-2 px-4 py-3 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined">calendar_month</span>
              <span className="font-medium text-sm">Agendamentos</span>
            </a>
            <a href="https://irb.klingo.app" className="hover:bg-slate-200 transition-all text-slate-600 mx-2 px-4 py-3 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined">folder_shared</span>
              <span className="font-medium text-sm">Prontuário</span>
            </a>
            <a href="https://wa.me/5517997796014" className="hover:bg-slate-200 transition-all text-slate-600 mx-2 px-4 py-3 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined">chat</span>
              <span className="font-medium text-sm">Mensagens</span>
            </a>
          </nav>
          <div className="px-4 mt-auto space-y-1">
            <a href="https://wa.me/5517997796014" className="hover:bg-slate-200 transition-all text-slate-600 px-4 py-3 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined">help</span>
              <span className="font-medium text-sm">Central de Ajuda</span>
            </a>
          </div>
        </aside>

        {mobileSidebarOpen ? <button className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileSidebarOpen(false)} type="button" /> : null}

        <main className="flex-1 md:ml-64 flex flex-col lg:flex-row min-h-screen pt-14 md:pt-0">
          <div className="flex-1 p-6 lg:p-10 max-w-4xl">
            <header className="mb-6">
              <a href="/agendar" className="flex items-center gap-2 text-primary mb-2 hover:underline">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span className="text-xs font-bold uppercase tracking-widest">Voltar para Seleção</span>
              </a>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Revisão e Pagamento</h2>
            </header>

            <div className="mb-8">
              <div className="flex items-center justify-center gap-0">
                <div className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md shadow-green-500/30">
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <span className="hidden sm:block text-xs font-bold text-green-600 mt-1.5">Agendar</span>
                  </div>
                </div>
                <div className="w-12 sm:w-20 h-0.5 bg-green-500 mx-1 sm:mx-2 mt-[-18px] sm:mt-[-10px]" />
                <div className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-md shadow-primary/30">
                      <span className="material-symbols-outlined text-lg">credit_card</span>
                    </div>
                    <span className="hidden sm:block text-xs font-bold text-primary mt-1.5">Pagamento</span>
                  </div>
                </div>
                <div className="w-12 sm:w-20 h-0.5 bg-slate-300 mx-1 sm:mx-2 mt-[-18px] sm:mt-[-10px]" />
                <div className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full border-2 border-slate-300 text-slate-300 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                    </div>
                    <span className="hidden sm:block text-xs font-medium text-slate-400 mt-1.5">Confirmação</span>
                  </div>
                </div>
              </div>
            </div>

            <section className="bg-white rounded-xl p-6 shadow-sm mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resumo do Agendamento</h3>
                <span className="material-symbols-outlined text-slate-300">verified</span>
              </div>
              <div className="flex items-start gap-5">
                <img alt={booking.doctorName} className="w-16 h-16 rounded-xl object-cover shadow-sm" src={booking.doctorImage ?? fallbackBooking.doctorImage} />
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-slate-900">{isExamBooking ? "Agendamento de exames" : booking.doctorName}</h4>
                  <p className="text-sm text-primary font-medium mb-3">{isExamBooking ? booking.specialty : booking.doctorSubtitle ?? `Especialista em ${booking.specialty}`}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-3 rounded-lg">
                      <span className="material-symbols-outlined text-primary text-xl">calendar_today</span>
                      <span className="text-sm font-medium">{booking.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-3 rounded-lg">
                      <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                      <span className="text-sm font-medium">{booking.time} (BRT)</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-1">Forma de Pagamento</h3>
              <div className="flex gap-4 mb-6">
                <button onClick={() => setMode("card")} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${mode === "card" ? "border-primary bg-primary/5 text-primary font-bold" : "border-slate-200 bg-white text-slate-500 font-medium"}`} type="button">
                  <span className="material-symbols-outlined">credit_card</span>
                  Cartão de Crédito
                </button>
                <button onClick={() => setMode("pix")} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${mode === "pix" ? "border-primary bg-primary/5 text-primary font-bold" : "border-slate-200 bg-white text-slate-500 font-medium"}`} type="button">
                  <span className="material-symbols-outlined">qr_code_2</span>
                  PIX
                </button>
              </div>

              {mode === "card" ? (
                <div className="bg-white rounded-xl p-8 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nome no Cartão</label>
                      <input value={cardName} onChange={(event) => setCardName(event.target.value)} className="w-full bg-slate-50 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="João da Silva" type="text" />
                    </div>
                    <div className="md:col-span-2 relative">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Número do Cartão</label>
                      <input
                        value={cardNumber}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/\D/g, "").slice(0, 16);
                          const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
                          setCardNumber(formatted);
                        }}
                        className="w-full bg-slate-50 rounded-lg px-4 py-3 pr-24 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="**** **** **** 4242"
                        type="text"
                      />
                      <div className="absolute right-3 bottom-3 flex gap-2 items-center">
                        <svg className={brand === "visa" ? "opacity-100 scale-110" : "opacity-30 scale-90"} width="32" height="20" viewBox="0 0 32 20" fill="none"><rect width="32" height="20" rx="3" fill="#1A1F71" /><text x="4" y="14" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="10" fill="white">VISA</text></svg>
                        <svg className={brand === "master" ? "opacity-100 scale-110" : "opacity-30 scale-90"} width="32" height="20" viewBox="0 0 32 20" fill="none"><rect width="32" height="20" rx="3" fill="#252525" /><circle cx="13" cy="10" r="6" fill="#EB001B" opacity="0.9" /><circle cx="19" cy="10" r="6" fill="#F79E1B" opacity="0.9" /></svg>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Validade</label>
                      <input value={cardExpiry} onChange={(event) => {
                        const raw = event.target.value.replace(/\D/g, "").slice(0, 4);
                        const formatted = raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
                        setCardExpiry(formatted);
                      }} className="w-full bg-slate-50 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="MM/AA" type="text" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">CVV</label>
                      <input value={cardCvv} onChange={(event) => setCardCvv(event.target.value.replace(/\D/g, "").slice(0, 4))} className="w-full bg-slate-50 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="***" type="password" />
                    </div>
                  </div>
                  <button onClick={() => setSaveCard((value) => !value)} className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3 cursor-pointer select-none" type="button">
                    <div className={`w-5 h-5 rounded border-2 border-primary flex items-center justify-center transition-all ${saveCard ? "bg-primary" : "bg-white"}`}>
                      {saveCard ? <span className="material-symbols-outlined text-white text-[16px] font-bold">check</span> : null}
                    </div>
                    <p className="text-xs text-slate-500">Salvar este cartão para futuros agendamentos</p>
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl p-8 shadow-sm">
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="w-[200px] h-[200px] border-[3px] border-dashed border-slate-400 rounded-2xl flex items-center justify-center flex-col gap-2 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,transparent_0%_50%)] [background-size:20px_20px] mb-6">
                      <span className="material-symbols-outlined text-5xl text-slate-400">qr_code_2</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">QR Code PIX</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 mb-2">Pague com PIX</h4>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm">Escaneie o QR Code acima com o aplicativo do seu banco ou copie o código abaixo.</p>
                    <div className="w-full max-w-md bg-slate-50 rounded-lg p-4 flex items-center gap-3">
                      <input readOnly value="00020126580014br.gov.bcb.pix0136irb-prime-care-consulta-2026032414305250400" className="flex-1 bg-transparent text-xs text-slate-600 font-mono outline-none truncate" type="text" />
                      <button onClick={() => navigator.clipboard.writeText("00020126580014br.gov.bcb.pix0136irb-prime-care-consulta-2026032414305250400")} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors" type="button">Copiar</button>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
                      <span className="material-symbols-outlined text-sm">timer</span>
                      <span>O código expira em {pixTimerLabel}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="lg:hidden mt-8">
                <button onClick={completePayment} className={`w-full text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-all ${canContinue ? "bg-primary" : "bg-primary/50 pointer-events-none"}`} type="button">
                  Pagar e Confirmar
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            </section>
          </div>

          <aside className="w-full lg:w-96 bg-slate-100 border-l border-transparent p-6 lg:p-10 flex flex-col gap-8 shadow-sm">
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Progresso do Agendamento</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Passo 1: Seleção</p>
                    <p className="text-[10px] text-slate-500 font-medium">Concluído</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 relative">
                  <div className="absolute left-4 -top-6 bottom-8 w-0.5 bg-primary/20" />
                  <div className="w-8 h-8 rounded-full bg-white border-2 border-primary flex items-center justify-center active-step-ring z-10">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary">Passo 2: Pagamento</p>
                    <p className="text-[10px] text-slate-500 font-medium">{mode === "pix" ? "100% Processado" : "66% Processado"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 relative opacity-50">
                  <div className="absolute left-4 -top-6 bottom-8 w-0.5 bg-slate-200" />
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center z-10">
                    <span className="text-xs font-bold text-slate-400">3</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Passo 3: Confirmação</p>
                    <p className="text-[10px] text-slate-500 font-medium">Pendente</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full transition-all duration-700 ease-out" style={{ width: mode === "pix" ? "100%" : canContinue ? "85%" : "66%" }} />
              </div>
            </div>

            <div className="mt-4 bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Detalhamento do Valor</h3>
              <div className="space-y-4">
                {isExamBooking && booking.selectedExams?.length ? booking.selectedExams.map((exam) => (
                  <div key={exam.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">{exam.name}</span>
                    <span className="text-slate-900 font-bold">{exam.priceCents ? formatPrice(exam.priceCents / 100) : "A confirmar"}</span>
                  </div>
                )) : null}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">{itemLabel}</span>
                  <span className="text-slate-900 font-bold">{formatPrice(booking.doctorFee)}</span>
                </div>
                {booking.physicalRequestRequired ? (
                  <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700">
                    Leve o pedido medico fisico no dia do atendimento.
                  </div>
                ) : null}
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-slate-900 font-bold">Valor Total</span>
                  <span className="text-2xl font-black text-primary">{formatPrice(booking.doctorFee)}</span>
                </div>
              </div>
            </div>

            <div className="hidden lg:block mt-auto">
              <button onClick={completePayment} className={`w-full text-white font-bold py-5 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all ${canContinue ? "bg-primary hover:bg-blue-700" : "bg-primary/50 pointer-events-none"}`} type="button">
                Pagar e Confirmar Agendamento
                <span className="material-symbols-outlined">payments</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-4 leading-relaxed">
                Ao confirmar, você concorda com os Termos de Serviço e Política de Reembolso.
              </p>
            </div>
          </aside>
        </main>

        <div className="fixed bottom-6 right-6 z-50">
          <a href="https://wa.me/5517997796014" className="w-14 h-14 bg-white text-primary rounded-full shadow-xl flex items-center justify-center border border-slate-100 hover:scale-110 active:scale-95 transition-all">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'opsz' 32" }}>support_agent</span>
          </a>
        </div>
      </div>
    </>
  );
}
