import { useState, useEffect, useMemo } from 'react';
import SlotPicker from './SlotPicker';
import PatientForm from './PatientForm';
import Confirmation from './Confirmation';
import Expired from './Expired';
import Loading from './Loading';
import ProgressBar from './ProgressBar';

interface BookingData {
  specialty: string;
  patientName: string | null;
  patientPhone: string | null;
  expiresAt: string;
  doctors: { id: string; name: string; crm: string }[];
  service: { id: string; name: string; priceCents: number | null; durationMinutes: number | null } | null;
  slots: { date: string; time: string; dateTime: string; source?: 'klingo' | 'fallback'; klingoSlotId?: string | number }[];
}

type Step = 'loading' | 'slots' | 'form' | 'confirming' | 'done' | 'expired' | 'error';
type PublicStep = 'exams' | 'request' | 'patient' | 'schedule' | 'payment' | 'review';

interface Exam {
  id: string;
  name: string;
  category?: string;
  priceCents?: number;
  durationMinutes?: number;
}

interface PublicSlot {
  date: string;
  time: string;
  dateTime: string;
  source?: 'klingo' | 'fallback' | 'none';
  klingoSlotId?: string | number;
  professional?: string;
  professionalId?: string | number;
}

interface ExtractedExam {
  name: string;
  quantity?: number;
  observations?: string | null;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

function getTokenFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/\/agendar\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const [step, setStep] = useState<Step>('loading');
  const [data, setData] = useState<BookingData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedSlotSource, setSelectedSlotSource] = useState<'klingo' | 'fallback' | undefined>(undefined);
  const [selectedKlingoSlotId, setSelectedKlingoSlotId] = useState<string | number | undefined>(undefined);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = getTokenFromUrl();

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch(`${API_BASE}/api/booking/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (body.status === 'booked' || body.status === 'expired' || res.status === 410) {
            setStep('expired');
            setError(body.error || 'Link expirado');
            return;
          }
          throw new Error(body.error || 'Erro ao carregar');
        }
        const json = await res.json();
        setData(json);
        setStep('slots');
        if (json.doctors.length === 1) {
          setSelectedDoctor(json.doctors[0].id);
        }
      })
      .catch((err) => {
        setStep('error');
        setError(err.message);
      });
  }, [token]);

  if (!token) {
    return <PublicExamScheduling />;
  }

  const handleSlotSelect = (slot: { dateTime: string; source?: 'klingo' | 'fallback'; klingoSlotId?: string | number }) => {
    setSelectedSlot(slot.dateTime);
    setSelectedSlotSource(slot.source);
    setSelectedKlingoSlotId(slot.klingoSlotId);
    setStep('form');
  };

  const handleConfirm = async (patientName: string, cpf: string, birthDate: string, sexo: 'M' | 'F', email?: string) => {
    if (!token || !selectedSlot) return;

    setStep('confirming');
    try {
      const res = await fetch(`${API_BASE}/api/booking/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          cpf,
          birthDate,
          sexo,
          email: email || undefined,
          doctorId: selectedDoctor || undefined,
          slotDateTime: selectedSlot,
          slotSource: selectedSlotSource,
          klingoSlotId: selectedKlingoSlotId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao confirmar');
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('form');
    }
  };

  const handleBack = () => {
    setStep('slots');
    setSelectedSlot(null);
    setSelectedSlotSource(undefined);
    setSelectedKlingoSlotId(undefined);
    setError(null);
  };

  if (step === 'loading' || step === 'confirming') {
    return <Loading text={step === 'confirming' ? 'Confirmando agendamento...' : 'Carregando horários...'} />;
  }

  if (step === 'expired') {
    return <Expired message={error} />;
  }

  if (step === 'error') {
    return <Expired message={error || 'Ocorreu um erro'} />;
  }

  if (step === 'done') {
    const slot = data?.slots.find(s => s.dateTime === selectedSlot);
    const doctor = data?.doctors.find(d => d.id === selectedDoctor);
    return (
      <>
        <div className="bg-irb-bg">
          <ProgressBar currentStep="done" />
        </div>
        <Confirmation
          specialty={data?.specialty || ''}
          doctorName={doctor?.name}
          date={slot?.date || ''}
          time={slot?.time || ''}
          patientPhone={data?.patientPhone}
        />
      </>
    );
  }

  if (step === 'form' && data) {
    return (
      <>
        <div className="bg-irb-bg">
          <ProgressBar currentStep="form" />
        </div>
        <PatientForm
          defaultName={data.patientName || ''}
          phone={data.patientPhone || ''}
          specialty={data.specialty}
          selectedTime={selectedSlot || ''}
          doctors={data.doctors}
          selectedDoctor={selectedDoctor}
          onSelectDoctor={setSelectedDoctor}
          onConfirm={handleConfirm}
          onBack={handleBack}
          error={error}
          service={data.service}
        />
      </>
    );
  }

  if (step === 'slots' && data) {
    return (
      <>
        <div className="bg-irb-bg">
          <ProgressBar currentStep="slots" />
        </div>
        <SlotPicker
          specialty={data.specialty}
          slots={data.slots}
          service={data.service}
          onSelect={handleSlotSelect}
        />
      </>
    );
  }

  return null;
}

const fallbackExams: Exam[] = [
  { id: '1431', name: 'Exame De Sangue', category: 'Laboratorio', priceCents: 8900, durationMinutes: 20 },
  { id: '1448', name: 'Ultrassonografia', category: 'Imagem', priceCents: 18000, durationMinutes: 30 },
  { id: '1429', name: 'Raio-X', category: 'Imagem', priceCents: 12000, durationMinutes: 20 },
  { id: '1277', name: 'Ecocardiograma', category: 'Cardiologia', priceCents: 26000, durationMinutes: 40 },
];

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function scoreExamMatch(extractedName: string, catalogExam: Exam) {
  const extracted = normalizeText(extractedName);
  const catalog = normalizeText(`${catalogExam.name} ${catalogExam.category || ''}`);
  if (!extracted || !catalog) return 0;
  if (catalog.includes(extracted) || extracted.includes(normalizeText(catalogExam.name))) return 100;
  const tokens = extracted.split(/\s+/).filter((token) => token.length > 2);
  if (tokens.length === 0) return 0;
  return tokens.filter((token) => catalog.includes(token)).length / tokens.length;
}

function formatMoney(cents?: number) {
  if (!cents) return 'Valor sob consulta';
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatDate(dateTime: string) {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formatFullDate(dateTime: string) {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function PublicExamScheduling() {
  const [currentStep, setCurrentStep] = useState<PublicStep>('exams');
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsSource, setExamsSource] = useState<'klingo' | 'none'>('none');
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [slotsSource, setSlotsSource] = useState<'klingo' | 'none'>('none');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientCpf, setPatientCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestFileName, setRequestFileName] = useState('');
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'reading' | 'matched' | 'needs-review' | 'error'>('idle');
  const [ocrMessage, setOcrMessage] = useState('');
  const [extractedExams, setExtractedExams] = useState<ExtractedExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState('');
  const [slotsMessage, setSlotsMessage] = useState('');
  const [checkingPatient, setCheckingPatient] = useState(false);
  const [patientLookup, setPatientLookup] = useState<'idle' | 'found' | 'not-found'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ appointmentId: string } | null>(null);
  const [error, setError] = useState('');

  const selectedExams = useMemo(
    () => exams.filter((exam) => selectedExamIds.includes(String(exam.id))),
    [exams, selectedExamIds],
  );
  const mainExam = selectedExams[0] || exams[0];
  const selectedSlot = slots.find((slot) => String(slot.klingoSlotId ?? slot.dateTime) === selectedSlotId) || slots[0];
  const totalCents = selectedExams.reduce((sum, exam) => sum + (exam.priceCents || 0), 0);
  const paymentLabel = paymentMethod === 'pix'
    ? 'Pix'
    : paymentMethod === 'card'
      ? 'Cartao'
      : paymentMethod === 'clinic'
        ? 'Dinheiro/na unidade'
        : paymentMethod === 'insurance'
          ? 'Convenio'
          : 'Confirmar com atendente';
  const publicSteps: Array<{ id: PublicStep; label: string }> = [
    { id: 'exams', label: 'Exames' },
    { id: 'request', label: 'Pedido' },
    { id: 'patient', label: 'Paciente' },
    { id: 'schedule', label: 'Horario' },
    { id: 'payment', label: 'Pagamento' },
    { id: 'review', label: 'Revisao' },
  ];
  const currentStepIndex = publicSteps.findIndex((item) => item.id === currentStep);
  const progress = Math.round(((currentStepIndex + 1) / publicSteps.length) * 100);

  const visibleExams = useMemo(() => {
    const search = normalizeText(query.trim());
    if (!search) return exams.slice(0, 30);
    return exams.filter((exam) => normalizeText(`${exam.name} ${exam.category || ''}`).includes(search)).slice(0, 30);
  }, [exams, query]);

  const groupedSlots = useMemo(() => {
    return slots.slice(0, 24).reduce<Array<{ date: string; label: string; slots: PublicSlot[] }>>((groups, slot) => {
      const date = slot.date || slot.dateTime.split('T')[0];
      let group = groups.find((item) => item.date === date);
      if (!group) {
        group = { date, label: formatFullDate(slot.dateTime), slots: [] };
        groups.push(group);
      }
      group.slots.push(slot);
      return groups;
    }, []);
  }, [slots]);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/public/scheduling/exams`)
      .then((res) => res.json())
      .then((payload) => {
        if (!alive) return;
        if (Array.isArray(payload.exams) && payload.exams.length > 0) {
          setExams(payload.exams);
          setExamsSource(payload.source === 'klingo' ? 'klingo' : 'none');
          setSelectedExamIds([String(payload.exams[0].id)]);
          setCatalogMessage('');
        } else {
          setExams([]);
          setSelectedExamIds([]);
          setExamsSource('none');
          setCatalogMessage(payload.error || 'Catalogo de exames indisponivel no Klingo.');
        }
      })
      .catch(() => {
        if (alive) {
          setExams([]);
          setSelectedExamIds([]);
          setExamsSource('none');
          setCatalogMessage('Falha ao carregar o catalogo de exames do Klingo.');
        }
      })
      .finally(() => {
        if (alive) setLoadingExams(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!mainExam?.id) {
      setSlots([]);
      setSlotsSource('none');
      setSelectedSlotId('');
      setSlotsMessage('Selecione um exame do catalogo do Klingo para consultar horarios online.');
      return;
    }
    let alive = true;
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const params = new URLSearchParams({
      exame: String(mainExam.id),
      inicio: start.toISOString().split('T')[0],
      fim: end.toISOString().split('T')[0],
    });

    setLoadingSlots(true);
    fetch(`${API_BASE}/api/public/scheduling/slots?${params.toString()}`)
      .then((res) => res.json())
      .then((payload) => {
        const nextSlots = Array.isArray(payload.slots) ? payload.slots : [];
        if (!alive) return;
        setSlots(nextSlots);
        setSlotsSource(payload.source === 'klingo' ? 'klingo' : 'none');
        setSelectedSlotId(nextSlots[0] ? String(nextSlots[0].klingoSlotId ?? nextSlots[0].dateTime) : '');
        setSlotsMessage(payload.message || (nextSlots.length === 0 ? 'Sem horarios online disponiveis no Klingo para este exame.' : ''));
      })
      .catch(() => {
        if (alive) {
          setSlots([]);
          setSlotsSource('none');
          setSelectedSlotId('');
          setSlotsMessage('Falha ao consultar horarios online no Klingo.');
        }
      })
      .finally(() => {
        if (alive) setLoadingSlots(false);
      });

    return () => { alive = false; };
  }, [mainExam?.id]);

  const toggleExam = (examId: string) => {
    setSelectedExamIds((current) => {
      if (current.includes(examId)) {
        return current.length === 1 ? current : current.filter((id) => id !== examId);
      }
      return [...current, examId];
    });
  };

  const checkPatient = async () => {
    const cpf = patientCpf.replace(/\D/g, '');
    const phone = patientPhone.replace(/\D/g, '');
    if (!cpf && !phone) return;
    setCheckingPatient(true);
    setPatientLookup('idle');
    try {
      const params = new URLSearchParams();
      if (cpf) params.set('cpf', cpf);
      if (!cpf && phone) params.set('phone', phone);
      const response = await fetch(`${API_BASE}/api/public/scheduling/patient-search?${params.toString()}`);
      const payload = await response.json();
      if (payload.found && payload.patient) {
        setPatientLookup('found');
        setPatientName(payload.patient.name || patientName);
        setEmail(payload.patient.email || email);
        if (payload.patient.birthDate) setBirthDate(String(payload.patient.birthDate).slice(0, 10));
      } else {
        setPatientLookup('not-found');
      }
    } catch {
      setPatientLookup('not-found');
    } finally {
      setCheckingPatient(false);
    }
  };

  const applyExtractedExams = (examsRequested: ExtractedExam[]) => {
    setExtractedExams(examsRequested);
    const matchedIds = examsRequested
      .map((extracted) => {
        const ranked = exams
          .map((exam) => ({ exam, score: scoreExamMatch(extracted.name, exam) }))
          .sort((a, b) => b.score - a.score);
        const best = ranked[0];
        return best && best.score >= 0.5 ? String(best.exam.id) : null;
      })
      .filter((id): id is string => Boolean(id));

    const uniqueIds = Array.from(new Set(matchedIds));
    if (uniqueIds.length > 0) {
      setSelectedExamIds(uniqueIds);
      setQuery('');
      setOcrStatus('matched');
      setOcrMessage(`${uniqueIds.length} exame(s) selecionado(s) automaticamente pelo OCR. Confira antes de continuar.`);
      return;
    }

    setOcrStatus('needs-review');
    setOcrMessage('O OCR leu o pedido, mas nao encontrou correspondencia segura no catalogo. Selecione os exames manualmente.');
  };

  const handleRequestFile = async (file: File | null) => {
    setError('');
    setRequestId(null);
    setRequestFile(file);
    setRequestFileName(file?.name || '');
    setExtractedExams([]);

    if (!file) {
      setOcrStatus('idle');
      setOcrMessage('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setRequestFile(null);
      setRequestFileName('');
      setOcrStatus('error');
      setOcrMessage('Envie uma imagem do pedido medico em JPG, PNG, GIF ou WEBP.');
      setError('Arquivo invalido. Envie uma imagem do pedido medico.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setRequestFile(null);
      setRequestFileName('');
      setOcrStatus('error');
      setOcrMessage('Arquivo maior que 10MB. Tire uma foto mais leve do pedido.');
      setError('Arquivo maior que 10MB.');
      return;
    }

    setOcrStatus('reading');
    setOcrMessage('Lendo o pedido medico e procurando exames no catalogo...');

    try {
      const fileBase64 = await toBase64(file);
      const response = await fetch(`${API_BASE}/api/exam-requests/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientPhone,
          patientName,
          fileBase64,
          mimeType: file.type,
          fileName: file.name,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel ler o pedido medico.');
      }

      setRequestId(payload.requestId || null);
      const examsRequested = Array.isArray(payload.extraction?.examsRequested)
        ? payload.extraction.examsRequested
        : [];
      if (payload.extraction?.patientName && !patientName) setPatientName(payload.extraction.patientName);
      if (payload.extraction?.patientCpf && !patientCpf) setPatientCpf(payload.extraction.patientCpf);
      applyExtractedExams(examsRequested);
    } catch (err: any) {
      setOcrStatus('error');
      setOcrMessage(err.message || 'Nao foi possivel ler o pedido medico. Tente outra foto ou fale pelo WhatsApp.');
      setError(err.message || 'Nao foi possivel ler o pedido medico.');
    }
  };

  const uploadRequestIfNeeded = async () => {
    if (!requestFile || requestId) return requestId;
    const fileBase64 = await toBase64(requestFile);
    const response = await fetch(`${API_BASE}/api/exam-requests/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  };

  const goToStep = (targetStep: PublicStep, clearCurrentError = true) => {
    if (clearCurrentError) setError('');
    setCurrentStep(targetStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const advanceFrom = (sourceStep: PublicStep) => {
    setError('');
    if (ocrStatus === 'reading') {
      setError('Aguarde a leitura OCR do pedido medico.');
      return;
    }
    if (sourceStep === 'exams' && selectedExams.length === 0) {
      setError('Selecione pelo menos um exame.');
      return;
    }
    if (sourceStep === 'request' && (!requestFile || !requestId)) {
      setError('Envie a foto do pedido medico e aguarde a leitura OCR para continuar.');
      return;
    }
    if (sourceStep === 'patient' && (!patientName.trim() || !patientPhone.replace(/\D/g, ''))) {
      setError('Informe nome e telefone do paciente.');
      return;
    }
    if (sourceStep === 'schedule' && !selectedSlot) {
      setError('Escolha uma data e horario.');
      return;
    }
    const nextIndex = Math.min(publicSteps.length - 1, publicSteps.findIndex((item) => item.id === sourceStep) + 1);
    goToStep(publicSteps[nextIndex].id);
  };

  const submitBooking = async () => {
    setError('');
    if (selectedExams.length === 0) {
      setError('Selecione pelo menos um exame.');
      goToStep('exams', false);
      return;
    }
    if (!requestFile || !requestId) {
      setError('Envie a foto do pedido medico e aguarde a leitura OCR para continuar.');
      goToStep('request', false);
      return;
    }
    if (!patientName.trim() || !patientPhone.replace(/\D/g, '')) {
      setError('Informe nome e telefone do paciente.');
      goToStep('patient', false);
      return;
    }
    if (!selectedSlot) {
      setError('Escolha um horario disponivel.');
      goToStep('schedule', false);
      return;
    }

    setSubmitting(true);
    try {
      const uploadedRequestId = await uploadRequestIfNeeded();
      if (!uploadedRequestId) {
        throw new Error('Nao foi possivel validar o pedido medico enviado. Tente novamente ou fale pelo WhatsApp.');
      }
      const response = await fetch(`${API_BASE}/api/public/scheduling/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          patientPhone,
          cpf: patientCpf,
          birthDate,
          email,
          specialty: selectedExams.map((exam) => exam.name).join(', '),
          doctorName: selectedSlot.professional,
          doctorId: selectedSlot.professionalId ? String(selectedSlot.professionalId) : undefined,
          slotDateTime: selectedSlot.dateTime,
          slotSource: selectedSlot.source,
          klingoSlotId: selectedSlot.klingoSlotId,
          selectedExams,
          paymentMethod,
          requestId: uploadedRequestId,
          requestFileName: requestFile?.name,
          schedulingSource: 'klingo',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erro ao registrar agendamento.');
      setDone({ appointmentId: payload.appointmentId });
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-irb-bg flex items-center justify-center px-5">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-5">
          <div className="w-20 h-20 bg-irb-gold rounded-full flex items-center justify-center mx-auto shadow-lg">
            <svg className="w-10 h-10 text-irb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-irb-primary">Agendamento registrado!</h1>
            <p className="text-gray-500 mt-2">A equipe IRB vai validar o registro no Klingo/WorkLab e enviar a confirmacao por e-mail ou WhatsApp.</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-left">
            <p className="font-bold text-red-800">Pedido fisico obrigatorio</p>
            <p className="text-sm text-red-700 mt-1">Apresente o pedido medico fisico na recepcao, mesmo que tenha enviado a foto pelo site.</p>
          </div>
          <a className="inline-flex justify-center bg-irb-primary text-white rounded-xl px-5 py-3 font-bold" href="https://wa.me/5511975830513">
            Suporte via WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-irb-bg text-gray-900">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-irb-primary">IRB Prime Care</p>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Agendamento de exames</p>
          </div>
          <a className="text-sm font-bold text-irb-primary" href="https://wa.me/5511975830513">WhatsApp: (11) 97583-0513</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <section className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-irb-primary">SOL-IRB-0405</p>
                <h1 className="text-3xl font-black mt-1">Agendar exames pelo site</h1>
                <p className="text-gray-500 mt-2 max-w-2xl">Selecione exames, envie foto do pedido medico, valide seu cadastro e escolha data e horario.</p>
              </div>
              <div className="w-full md:w-48">
                <div className="flex justify-between text-xs font-bold text-gray-400 mb-2"><span>Progresso</span><span>{progress}%</span></div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-irb-primary" style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-5">
              {publicSteps.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToStep(item.id)}
                  className={`rounded-xl px-2 py-3 text-xs font-black border ${currentStep === item.id ? 'border-irb-primary bg-teal-50 text-irb-primary' : index < currentStepIndex ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                >
                  <span className="block text-[10px] uppercase tracking-widest">Etapa {index + 1}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {currentStep === 'exams' ? <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-black">1. Escolha os exames</h2>
                <p className="text-sm text-gray-500">{loadingExams ? 'Consultando catalogo Klingo...' : 'Envie o pedido para o OCR selecionar os exames, ou ajuste manualmente no catalogo.'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${examsSource === 'klingo' ? 'bg-teal-50 text-irb-primary' : 'bg-amber-50 text-amber-700'}`}>
                {examsSource === 'klingo' ? 'Klingo' : 'Confirmacao manual'}
              </span>
            </div>
            <label className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-teal-200 bg-teal-50 px-4 py-5 cursor-pointer">
              <div>
                <p className="text-sm font-black text-irb-primary">Ler pedido medico com OCR</p>
                <p className="text-xs text-gray-600 mt-1">{requestFileName || 'Envie foto do pedido para identificar e selecionar os exames automaticamente.'}</p>
              </div>
              <span className="bg-irb-primary text-white rounded-xl px-4 py-2 text-sm font-black">{ocrStatus === 'reading' ? 'Lendo...' : 'Enviar foto'}</span>
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/gif,image/webp" capture="environment" disabled={ocrStatus === 'reading'} onChange={(event) => handleRequestFile(event.target.files?.[0] || null)} />
            </label>
            {ocrMessage ? <div className={`mb-4 rounded-2xl border p-4 text-sm font-semibold ${ocrStatus === 'matched' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ocrStatus === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{ocrMessage}</div> : null}
            {extractedExams.length > 0 ? <div className="mb-4 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Exames lidos no pedido</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {extractedExams.map((exam, index) => (
                  <li key={`${exam.name}-${index}`} className="font-semibold text-gray-700">{exam.quantity || 1}x {exam.name}</li>
                ))}
              </ul>
            </div> : null}
            <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-4" placeholder="Buscar exame por nome..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
              {visibleExams.map((exam) => {
                const active = selectedExamIds.includes(String(exam.id));
                return (
                  <button key={exam.id} type="button" onClick={() => toggleExam(String(exam.id))} className={`text-left border rounded-2xl p-4 min-h-[92px] ${active ? 'border-irb-primary bg-teal-50' : 'border-gray-200 hover:border-teal-300'}`}>
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-black">{exam.name}</p>
                        <p className="text-xs font-semibold text-gray-500 mt-1">{exam.category || 'Exame'}</p>
                      </div>
                      <span className={active ? 'text-irb-primary font-black' : 'text-gray-300'}>{active ? 'OK' : '+'}</span>
                    </div>
                    <p className="font-black text-irb-primary mt-3">{formatMoney(exam.priceCents)}</p>
                  </button>
                );
              })}
            </div>
            {examsSource === 'fallback' ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Os valores exibidos sao estimativas. A equipe IRB confirma valor e disponibilidade antes do atendimento.</div> : null}
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => advanceFrom('exams')} disabled={ocrStatus === 'reading'} className="bg-irb-primary text-white rounded-2xl px-5 py-3 font-black disabled:opacity-50">Continuar para pedido medico</button>
            </div>
          </div> : null}

          {currentStep === 'request' ? <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-black">2. Pedido medico</h2>
                <p className="text-sm text-gray-500">Envie a foto do pedido antes de identificar o paciente.</p>
              </div>
              <span className="bg-red-50 text-red-700 rounded-full px-3 py-1 text-xs font-bold">Obrigatorio</span>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 cursor-pointer">
              <div>
                <p className="text-sm font-bold">{requestId ? 'Pedido lido pelo OCR' : 'Enviar foto do pedido medico'}</p>
                <p className="text-xs text-gray-500">{requestFile ? requestFile.name : 'JPG, PNG, GIF ou WEBP ate 10MB'}</p>
              </div>
              <span className="text-irb-primary font-black">{ocrStatus === 'reading' ? 'Lendo...' : requestId ? 'Trocar foto' : 'Upload'}</span>
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/gif,image/webp" capture="environment" disabled={ocrStatus === 'reading'} onChange={(event) => handleRequestFile(event.target.files?.[0] || null)} />
            </label>
            {ocrMessage ? <div className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${ocrStatus === 'matched' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ocrStatus === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{ocrMessage}</div> : null}
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-5">
              <p className="text-sm font-black text-red-800">Pedido fisico obrigatorio</p>
              <p className="text-xs text-red-700 mt-1 leading-5">Mesmo enviando foto pelo site, o paciente deve apresentar o pedido medico fisico na recepcao.</p>
            </div>
            <div className="flex flex-col sm:flex-row justify-between gap-3 mt-5">
              <a className="text-center border border-gray-200 rounded-2xl px-5 py-3 font-black text-irb-primary" href="https://wa.me/5511975830513">Nao tenho o pedido</a>
              <button type="button" onClick={() => advanceFrom('request')} className="bg-irb-primary text-white rounded-2xl px-5 py-3 font-black">Continuar para paciente</button>
            </div>
          </div> : null}

          {currentStep === 'patient' ? <div className="bg-white rounded-3xl shadow-sm p-6">
            <h2 className="text-lg font-black">3. Dados do paciente</h2>
            <p className="text-sm text-gray-500 mt-1">Busque por CPF para reaproveitar o cadastro. Se nao encontrar, preencha os dados para validacao.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">CPF</label>
                <div className="flex gap-2">
                  <input className="min-w-0 flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm" value={patientCpf} onChange={(event) => setPatientCpf(event.target.value)} placeholder="000.000.000-00" />
                  <button type="button" onClick={checkPatient} disabled={checkingPatient} className="bg-gray-900 text-white rounded-xl px-4 text-sm font-bold">{checkingPatient ? '...' : 'Buscar'}</button>
                </div>
                {patientLookup === 'found' ? <p className="text-xs font-bold text-emerald-700 mt-2">Conta encontrada no Klingo.</p> : null}
                {patientLookup === 'not-found' ? <p className="text-xs font-bold text-amber-700 mt-2">Cadastro nao encontrado. Os dados serao enviados para criacao/validacao.</p> : null}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Telefone</label>
                <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" value={patientPhone} onChange={(event) => setPatientPhone(event.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nome completo</label>
                <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" value={patientName} onChange={(event) => setPatientName(event.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">E-mail</label>
                <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Nascimento</label>
                <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} type="date" />
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => advanceFrom('patient')} className="bg-irb-primary text-white rounded-2xl px-5 py-3 font-black">Continuar para horario</button>
            </div>
          </div> : null}

          {currentStep === 'schedule' ? <div className="bg-white rounded-3xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-black">4. Data e horario</h2>
                <p className="text-sm text-gray-500">{loadingSlots ? 'Sincronizando agenda Klingo...' : slotsSource === 'klingo' ? 'Horarios integrados ao Klingo.' : 'Escolha uma preferencia de horario para confirmacao manual.'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${slotsSource === 'klingo' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {slotsSource === 'klingo' ? 'Tempo real' : 'Preferencia'}
              </span>
            </div>
            {slots.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Sem horario online para o exame selecionado. Use o WhatsApp para conferencia manual.</div>
            ) : (
              <div className="space-y-4">
                {groupedSlots.map((group) => (
                  <div key={group.date}>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{group.label}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {group.slots.map((slot) => {
                        const id = String(slot.klingoSlotId ?? slot.dateTime);
                        const active = selectedSlotId === id;
                        return (
                          <button key={id} type="button" onClick={() => setSelectedSlotId(id)} className={`border rounded-2xl px-3 py-4 text-center ${active ? 'border-irb-primary bg-teal-50 text-irb-primary' : 'border-gray-200 hover:border-teal-300'}`}>
                            <p className="text-lg font-black">{slot.time}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{slot.source === 'fallback' ? 'Confirmacao manual' : 'Klingo'}</p>
                            {slot.professional ? <p className="text-[11px] text-gray-500 truncate mt-1">{slot.professional}</p> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {manualConfirmationRequired ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Este horario sera tratado como preferencia ate a equipe IRB validar no Klingo/WorkLab.</div> : null}
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => advanceFrom('schedule')} className="bg-irb-primary text-white rounded-2xl px-5 py-3 font-black">Continuar para pagamento</button>
            </div>
          </div> : null}

          {currentStep === 'payment' ? <div className="bg-white rounded-3xl shadow-sm p-6">
            <h2 className="text-lg font-black">5. Forma de pagamento</h2>
            <p className="text-sm text-gray-500 mt-1">A forma escolhida sera registrada para triagem financeira. Nao ha cobranca online nesta etapa.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
              {[
                { id: 'pix', label: 'Pix', help: 'Receber orientacao da equipe.' },
                { id: 'card', label: 'Cartao', help: 'Registrar intencao de pagar no cartao.' },
                { id: 'clinic', label: 'Dinheiro/na unidade', help: 'Resolver na recepcao.' },
                { id: 'insurance', label: 'Convenio', help: 'Equipe confere cobertura.' },
                { id: 'attendant', label: 'Confirmar com atendente', help: 'Deixar financeiro em aberto.' },
              ].map((option) => (
                <button key={option.id} type="button" onClick={() => setPaymentMethod(option.id)} className={`border rounded-2xl p-4 text-left ${paymentMethod === option.id ? 'border-irb-primary bg-teal-50 text-irb-primary' : 'border-gray-200 hover:border-teal-300'}`}>
                  <p className="font-black">{option.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{option.help}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => advanceFrom('payment')} className="bg-irb-primary text-white rounded-2xl px-5 py-3 font-black">Revisar agendamento</button>
            </div>
          </div> : null}

          {currentStep === 'review' ? <div className="bg-white rounded-3xl shadow-sm p-6">
            <h2 className="text-lg font-black">6. Revisao e confirmacao</h2>
            <p className="text-sm text-gray-500 mt-1">Confira os dados antes de enviar para a fila operacional IRB.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-sm">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Paciente</p>
                <p className="font-black mt-2">{patientName || 'Nao informado'}</p>
                <p className="text-gray-500">{patientPhone || 'Telefone nao informado'}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pedido</p>
                <p className="font-black mt-2">{requestFile?.name || 'Pendente'}</p>
                <p className="text-gray-500">Fisico obrigatorio na recepcao</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Horario</p>
                <p className="font-black mt-2">{selectedSlot ? `${formatFullDate(selectedSlot.dateTime)} as ${selectedSlot.time}` : 'Nao selecionado'}</p>
                <p className="text-gray-500">{manualConfirmationRequired ? 'Confirmacao manual' : 'Integrado ao Klingo'}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pagamento</p>
                <p className="font-black mt-2">{paymentLabel}</p>
                <p className="text-gray-500">Sem cobranca online</p>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" disabled={submitting} onClick={submitBooking} className="bg-irb-primary text-white rounded-2xl px-5 py-4 font-black disabled:opacity-50">{submitting ? 'Registrando...' : 'Enviar para confirmacao IRB'}</button>
            </div>
          </div> : null}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          <div className="bg-white rounded-3xl shadow-sm p-6">
            <h2 className="text-lg font-black">Conferencia final</h2>
            <div className="space-y-4 mt-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Exames</p>
                <ul className="mt-2 space-y-2">
                  {selectedExams.map((exam) => (
                    <li key={exam.id} className="flex justify-between gap-3 text-sm">
                      <span className="font-semibold">{exam.name}</span>
                      <span className="font-bold">{formatMoney(exam.priceCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Data e horario</p>
                <p className="text-sm font-bold mt-1">{selectedSlot ? `${formatDate(selectedSlot.dateTime)} as ${selectedSlot.time}` : 'Selecione um horario'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Pagamento</p>
                <p className="text-sm font-bold mt-1">{paymentLabel}</p>
                <p className="text-xs text-gray-500 mt-1">Sem cobranca online.</p>
              </div>
              <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                <span className="font-black">Total</span>
                <span className="text-2xl font-black text-irb-primary">{formatMoney(totalCents)}</span>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-5">
              <p className="text-sm font-black text-red-800">Pedido fisico obrigatorio</p>
              <p className="text-xs text-red-700 mt-1 leading-5">{requestFile ? `Foto enviada: ${requestFile.name}` : 'Envie a foto do pedido para liberar o envio.'}</p>
            </div>
            {manualConfirmationRequired ? <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-5">
              <p className="text-sm font-black text-amber-800">Confirmacao manual</p>
              <p className="text-xs text-amber-700 mt-1 leading-5">A solicitacao entra na fila `pending_manual_confirmation` para validacao no Klingo/WorkLab.</p>
            </div> : null}
            <div className="bg-gray-50 rounded-2xl p-4 mt-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Orientacoes</p>
              <ul className="space-y-2 text-xs text-gray-600 leading-5">
                <li>Leve documento com foto e carteirinha do convenio, se houver.</li>
                <li>Chegue 15 minutos antes para cadastro e conferencia.</li>
                <li>Alguns exames podem exigir jejum ou preparo especifico.</li>
              </ul>
            </div>
            {error ? <p className="mt-4 bg-red-50 text-red-700 rounded-xl px-3 py-2 text-sm font-semibold">{error}</p> : null}
            <button type="button" disabled={submitting} onClick={() => currentStep === 'review' ? submitBooking() : advanceFrom(currentStep)} className="w-full bg-irb-primary text-white rounded-2xl px-5 py-4 font-black mt-5 disabled:opacity-50">
              {submitting ? 'Registrando...' : currentStep === 'review' ? 'Enviar para confirmacao IRB' : 'Continuar'}
            </button>
            <p className="text-[11px] text-gray-400 text-center leading-5 mt-3">O registro entra no sistema e a equipe valida a confirmacao final com Klingo/WorkLab quando necessario.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
