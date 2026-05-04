import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const MAX_MB = 10;

interface ExtractedExam {
  patientName: string | null;
  patientCpf: string | null;
  requestingDoctor: string | null;
  doctorCrm: string | null;
  requestDate: string | null;
  examsRequested: Array<{ name: string; quantity: number; observations: string | null }>;
  clinicalIndication: string | null;
  confidence: 'high' | 'medium' | 'low';
}

interface SuccessResponse {
  ok: true;
  requestId: string;
  summary: string;
  patientMatched: boolean;
  extraction: ExtractedExam;
  nextStep: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ExamUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResponse | null>(null);

  const handleFile = (f: File | null) => {
    setError(null);
    if (!f) { setFile(null); setPreview(null); return; }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`Arquivo maior que ${MAX_MB}MB. Use uma foto mais leve.`);
      return;
    }
    if (!f.type.startsWith('image/')) {
      setError('Envie uma imagem (JPG, PNG, WEBP). Para PDF, tire uma foto da tela.');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file) { setError('Selecione o pedido médico'); return; }
    if (!patientPhone || patientPhone.replace(/\D/g, '').length < 10) {
      setError('Informe um WhatsApp válido para contato');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const resp = await fetch(`${API_BASE}/api/exam-requests/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: file.type,
          fileName: file.name,
          patientName,
          patientPhone,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Falha (${resp.status})`);
      }
      const data = (await resp.json()) as SuccessResponse;
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao enviar');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl">✓</div>
            <h1 className="text-xl font-bold text-slate-900">Pedido recebido</h1>
          </div>
          <p className="text-slate-600 mb-6">{result.nextStep}</p>

          <div className="bg-slate-50 rounded-xl p-5 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Exames identificados</h2>
            {result.extraction.examsRequested.length === 0 ? (
              <p className="text-sm text-slate-500">Não foi possível ler os exames automaticamente. Nossa equipe vai revisar o pedido manualmente.</p>
            ) : (
              <ul className="space-y-2">
                {result.extraction.examsRequested.map((exam, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-800">
                    <span className="font-medium">{exam.quantity}x</span>
                    <span>{exam.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {result.extraction.requestingDoctor && (
            <p className="text-sm text-slate-500">Médico solicitante: <span className="text-slate-800">{result.extraction.requestingDoctor}{result.extraction.doctorCrm ? ` (CRM ${result.extraction.doctorCrm})` : ''}</span></p>
          )}
          <p className="text-xs text-slate-400 mt-4">Protocolo: {result.requestId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Enviar pedido de exames</h1>
          <p className="text-slate-500 text-sm mb-6">Tire uma foto clara do pedido médico. Vamos identificar os exames e agendar para você.</p>

          <label className="block text-sm font-medium text-slate-700 mb-1">Seu nome</label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nome completo"
          />

          <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp para contato</label>
          <input
            type="tel"
            value={patientPhone}
            onChange={(e) => setPatientPhone(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="(11) 99999-9999"
          />

          <label className="block text-sm font-medium text-slate-700 mb-1">Foto do pedido</label>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center mb-4">
            {preview ? (
              <div className="space-y-3">
                <img src={preview} alt="Pedido" className="max-h-64 mx-auto rounded-lg" />
                <button
                  onClick={() => handleFile(null)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remover
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                />
                <div className="text-slate-500 text-sm">
                  <div className="text-4xl mb-2">📷</div>
                  Toque para tirar foto ou escolher imagem
                  <div className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP — até {MAX_MB}MB</div>
                </div>
              </label>
            )}
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

          <button
            onClick={submit}
            disabled={loading || !file}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Analisando pedido...' : 'Enviar pedido'}
          </button>

          <p className="text-xs text-slate-400 mt-4 text-center">
            Ao enviar, você concorda que analisemos a imagem para identificar os exames solicitados.
          </p>
        </div>
      </div>
    </div>
  );
}
