"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Exam = {
  id: string;
  name: string;
  category?: string;
  priceCents?: number;
  durationMinutes?: number;
};

type Slot = {
  date: string;
  time: string;
  dateTime: string;
  source: "klingo" | "fallback" | "none";
  klingoSlotId?: string | number;
  professional?: string;
  professionalId?: string | number;
};

type PatientLookup = {
  found: boolean;
  patient?: {
    name?: string;
    cpf?: string;
    phone?: string;
    email?: string;
    birthDate?: string;
    klingoId?: number;
  } | null;
};

const fallbackExams: Exam[] = [
  { id: "1431", name: "Exame De Sangue", category: "Laboratorio", priceCents: 8900, durationMinutes: 20 },
  { id: "1448", name: "Ultrassonografia", category: "Imagem", priceCents: 18000, durationMinutes: 30 },
  { id: "1429", name: "Raio-X", category: "Imagem", priceCents: 12000, durationMinutes: 20 },
  { id: "1277", name: "Ecocardiograma", category: "Cardiologia", priceCents: 26000, durationMinutes: 40 },
];

const paymentOptions = [
  { id: "pix", label: "PIX" },
  { id: "card", label: "Cartao" },
  { id: "clinic", label: "Pagar na recepcao" },
];

const preparationItems = [
  "Leve obrigatoriamente o pedido medico fisico no dia do atendimento.",
  "Documento com foto e carteirinha do convenio, se houver.",
  "Chegue 15 minutos antes para cadastro e conferencia.",
  "Alguns exames podem exigir jejum ou preparo especifico; confirme as orientacoes finais.",
];

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatMoney(cents?: number) {
  if (!cents) return "Valor sob consulta";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatDateTime(dateTime: string) {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function BookingExperience() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>(fallbackExams);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>(["1431"]);
  const [query, setQuery] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [patientStatus, setPatientStatus] = useState<"idle" | "checking" | "found" | "not-found">("idle");
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedExams = useMemo(
    () => exams.filter((exam) => selectedExamIds.includes(exam.id)),
    [exams, selectedExamIds],
  );

  const mainExam = selectedExams[0] ?? exams[0] ?? fallbackExams[0];
  const selectedSlot = slots.find((slot) => String(slot.klingoSlotId ?? slot.dateTime) === selectedSlotId) ?? slots[0];
  const totalCents = selectedExams.reduce((sum, exam) => sum + (exam.priceCents || 0), 0);
  const progress = [selectedExams.length > 0, patientName && patientPhone, selectedSlot, paymentMethod].filter(Boolean).length * 25;

  const visibleExams = useMemo(() => {
    const search = normalizeText(query.trim());
    if (!search) return exams.slice(0, 32);
    return exams.filter((exam) => normalizeText(`${exam.name} ${exam.category || ""}`).includes(search)).slice(0, 32);
  }, [exams, query]);

  useEffect(() => {
    let alive = true;

    async function loadExams() {
      try {
        const response = await fetch("/api/public/scheduling/exams");
        const payload = await response.json();
        if (!alive) return;
        if (Array.isArray(payload.exams) && payload.exams.length > 0) {
          setExams(payload.exams);
          setSelectedExamIds([String(payload.exams[0].id)]);
        }
      } catch {
        if (alive) setExams(fallbackExams);
      } finally {
        if (alive) setLoadingExams(false);
      }
    }

    loadExams();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!mainExam?.id) return;
    let alive = true;

    async function loadSlots() {
      setLoadingSlots(true);
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date();
      end.setDate(end.getDate() + 14);

      try {
        const params = new URLSearchParams({
          exame: mainExam.id,
          inicio: start.toISOString().split("T")[0],
          fim: end.toISOString().split("T")[0],
        });
        const response = await fetch(`/api/public/scheduling/slots?${params.toString()}`);
        const payload = await response.json();
        const nextSlots = Array.isArray(payload.slots) ? payload.slots : [];
        if (!alive) return;
        setSlots(nextSlots);
        setSelectedSlotId(nextSlots[0] ? String(nextSlots[0].klingoSlotId ?? nextSlots[0].dateTime) : "");
      } catch {
        if (alive) {
          setSlots([]);
          setSelectedSlotId("");
        }
      } finally {
        if (alive) setLoadingSlots(false);
      }
    }

    loadSlots();
    return () => {
      alive = false;
    };
  }, [mainExam?.id]);

  async function checkPatient() {
    const cpf = patientCpf.replace(/\D/g, "");
    const phone = patientPhone.replace(/\D/g, "");
    if (!cpf && !phone) return;

    setPatientStatus("checking");
    try {
      const params = new URLSearchParams();
      if (cpf) params.set("cpf", cpf);
      if (!cpf && phone) params.set("phone", phone);
      const response = await fetch(`/api/patients/klingo/search?${params.toString()}`);
      const payload = (await response.json()) as PatientLookup;

      if (payload.found && payload.patient) {
        setPatientStatus("found");
        setPatientName(payload.patient.name || patientName);
        setEmail(payload.patient.email || email);
        if (payload.patient.birthDate) setBirthDate(payload.patient.birthDate.slice(0, 10));
      } else {
        setPatientStatus("not-found");
        setPatientMode("new");
      }
    } catch {
      setPatientStatus("not-found");
      setPatientMode("new");
    }
  }

  function toggleExam(examId: string) {
    setSelectedExamIds((current) => {
      if (current.includes(examId)) {
        return current.length === 1 ? current : current.filter((id) => id !== examId);
      }
      return [...current, examId];
    });
  }

  async function uploadRequestIfNeeded() {
    if (!requestFile || requestId) return requestId;
    const fileBase64 = await toBase64(requestFile);
    const response = await fetch("/api/exam-requests/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientPhone,
        patientName,
        fileBase64,
        mimeType: requestFile.type,
        fileName: requestFile.name,
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    setRequestId(payload.requestId || null);
    return payload.requestId || null;
  }

  async function submitBooking() {
    setError("");

    if (!patientName.trim() || !patientPhone.replace(/\D/g, "")) {
      setError("Informe nome e telefone do paciente.");
      return;
    }

    if (!selectedSlot) {
      setError("Escolha um horario disponivel.");
      return;
    }

    setSubmitting(true);
    try {
      const uploadedRequestId = await uploadRequestIfNeeded();
      const response = await fetch("/api/public/scheduling/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientPhone,
          cpf: patientCpf,
          birthDate,
          email,
          specialty: selectedExams.map((exam) => exam.name).join(", "),
          doctorName: selectedSlot.professional,
          doctorId: selectedSlot.professionalId ? String(selectedSlot.professionalId) : undefined,
          slotDateTime: selectedSlot.dateTime,
          slotSource: selectedSlot.source,
          klingoSlotId: selectedSlot.klingoSlotId,
          selectedExams,
          paymentMethod,
          requestId: uploadedRequestId,
          requestFileName: requestFile?.name,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Erro ao registrar agendamento.");

      window.localStorage.setItem("irb_booking", JSON.stringify({
        kind: "exam",
        appointmentId: payload.appointmentId,
        doctorName: selectedSlot.professional || "Equipe IRB Prime Care",
        specialty: selectedExams.map((exam) => exam.name).join(", "),
        date: formatDateTime(selectedSlot.dateTime),
        dateISO: selectedSlot.date,
        time: selectedSlot.time,
        doctorFee: totalCents / 100,
        totalCents,
        paymentMethod,
        selectedExams,
        requestId: uploadedRequestId,
        requestFileName: requestFile?.name,
        physicalRequestRequired: true,
      }));

      router.push("/pagamento");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar agendamento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        body { font-family: Inter, system-ui, sans-serif; background: #f7f8fb; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
      `}</style>
      <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <a href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white">
                <span className="material-symbols-outlined text-xl">medical_services</span>
              </span>
              <div>
                <p className="text-base font-black tracking-tight text-blue-800">IRB Prime Care</p>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Agendamento de exames</p>
              </div>
            </a>
            <a className="text-sm font-bold text-blue-700 hover:underline" href="https://wa.me/5511975830513">
              WhatsApp: (11) 97583-0513
            </a>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-5 py-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Fluxo SOL-IRB-0405</p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight">Agendar exames pelo site</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Selecione os exames, envie uma foto do pedido medico se tiver, confirme seus dados e escolha um horario disponivel.
                  </p>
                </div>
                <div className="min-w-44">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Progresso</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {["Exames", "Paciente", "Horario", "Conferencia"].map((label, index) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Etapa {index + 1}</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black">1. Exames e pedido medico</h2>
                  <p className="text-sm text-slate-500">{loadingExams ? "Consultando catalogo Klingo..." : "Catalogo consultado para busca de exames e precos."}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Klingo</span>
              </div>

              <div className="mb-4">
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Buscar exame por nome..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <div className="grid max-h-80 grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
                {visibleExams.map((exam) => {
                  const active = selectedExamIds.includes(exam.id);
                  return (
                    <button
                      key={exam.id}
                      className={classNames(
                        "min-h-[86px] rounded-lg border p-4 text-left transition",
                        active ? "border-blue-700 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300",
                      )}
                      onClick={() => toggleExam(exam.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">{exam.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{exam.category || "Exame"}</p>
                        </div>
                        <span className={classNames("material-symbols-outlined", active ? "text-blue-700" : "text-slate-300")}>
                          {active ? "check_circle" : "add_circle"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-black text-blue-700">{formatMoney(exam.priceCents)}</p>
                    </button>
                  );
                })}
              </div>

              <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">Enviar foto do pedido medico</p>
                  <p className="text-xs text-slate-500">{requestFile ? requestFile.name : "JPG, PNG, GIF ou WEBP ate 10MB"}</p>
                </div>
                <span className="material-symbols-outlined text-blue-700">upload_file</span>
                <input
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  type="file"
                  onChange={(event) => setRequestFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-black">2. Dados do paciente</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">CPF</label>
                  <div className="flex gap-2">
                    <input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-700" value={patientCpf} onChange={(e) => setPatientCpf(e.target.value)} placeholder="000.000.000-00" />
                    <button className="rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={patientStatus === "checking"} onClick={checkPatient} type="button">
                      {patientStatus === "checking" ? "..." : "Buscar"}
                    </button>
                  </div>
                  {patientStatus === "found" ? <p className="mt-2 text-xs font-bold text-emerald-700">Conta encontrada no Klingo.</p> : null}
                  {patientStatus === "not-found" ? <p className="mt-2 text-xs font-bold text-amber-700">Cadastro nao encontrado. Vamos registrar os dados para criacao/validacao.</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Tipo de acesso</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "existing", label: "Tenho conta" },
                      { id: "new", label: "Criar cadastro" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        className={classNames("rounded-lg border px-4 py-3 text-sm font-bold", patientMode === mode.id ? "border-blue-700 bg-blue-50 text-blue-700" : "border-slate-200")}
                        onClick={() => setPatientMode(mode.id as "existing" | "new")}
                        type="button"
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Nome completo</label>
                  <input className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-700" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Telefone</label>
                  <input className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-700" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Nascimento</label>
                  <input className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-700" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} type="date" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">E-mail</label>
                  <input className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-700" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black">3. Data e horario</h2>
                  <p className="text-sm text-slate-500">{loadingSlots ? "Sincronizando agenda Klingo..." : "Horarios retornados da agenda online."}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Tempo real</span>
              </div>

              {slots.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                  Sem horario online para o exame selecionado. Use o WhatsApp para conferencia manual.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {slots.slice(0, 16).map((slot) => {
                    const id = String(slot.klingoSlotId ?? slot.dateTime);
                    const active = selectedSlotId === id;
                    return (
                      <button
                        key={id}
                        className={classNames("rounded-lg border px-3 py-4 text-center", active ? "border-blue-700 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-blue-300")}
                        onClick={() => setSelectedSlotId(id)}
                        type="button"
                      >
                        <p className="text-xs font-bold uppercase tracking-widest">{formatDateTime(slot.dateTime)}</p>
                        <p className="mt-1 text-lg font-black">{slot.time}</p>
                        {slot.professional ? <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{slot.professional}</p> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-black">Conferencia final</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Exames</p>
                  <ul className="mt-2 space-y-2">
                    {selectedExams.map((exam) => (
                      <li key={exam.id} className="flex justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">{exam.name}</span>
                        <span className="font-bold text-slate-900">{formatMoney(exam.priceCents)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Data e horario</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {selectedSlot ? `${formatDateTime(selectedSlot.dateTime)} as ${selectedSlot.time}` : "Selecione um horario"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Forma de pagamento</p>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {paymentOptions.map((option) => (
                      <button
                        key={option.id}
                        className={classNames("rounded-lg border px-3 py-2 text-left text-sm font-bold", paymentMethod === option.id ? "border-blue-700 bg-blue-50 text-blue-700" : "border-slate-200")}
                        onClick={() => setPaymentMethod(option.id)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-black">Total</span>
                    <span className="text-2xl font-black text-blue-700">{formatMoney(totalCents)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-black text-red-800">Pedido fisico obrigatorio</p>
                <p className="mt-1 text-xs leading-5 text-red-700">
                  Mesmo enviando foto, o paciente deve apresentar o pedido medico fisico na recepcao.
                </p>
              </div>

              <div className="mt-5 rounded-lg bg-slate-50 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Orientacoes</p>
                <ul className="space-y-2">
                  {preparationItems.map((item) => (
                    <li key={item} className="flex gap-2 text-xs leading-5 text-slate-600">
                      <span className="material-symbols-outlined mt-0.5 text-sm text-blue-700">check</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}

              <button
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-700/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submitting}
                onClick={submitBooking}
                type="button"
              >
                {submitting ? "Registrando..." : "Confirmar agendamento"}
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
              <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
                O registro entra no sistema e a equipe valida a confirmacao final com Klingo/WorkLab quando necessario.
              </p>
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}
