import { useState } from 'react';

interface Props {
  teleconsultationId: string;
  onClose: () => void;
}

type PrescriptionType = 'prescription' | 'certificate' | 'referral' | 'exam_request';

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

const TYPE_LABELS: Record<PrescriptionType, string> = {
  prescription: 'Receita',
  certificate: 'Atestado',
  referral: 'Encaminhamento',
  exam_request: 'Solicitação de Exame',
};

const API_BASE = import.meta.env.VITE_API_BASE || '';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function PrescriptionModal({ teleconsultationId, onClose }: Props) {
  const [type, setType] = useState<PrescriptionType>('prescription');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Prescription fields
  const [medications, setMedications] = useState<Medication[]>([
    { name: '', dosage: '', frequency: '', duration: '' },
  ]);

  // Certificate fields
  const [certDays, setCertDays] = useState('');
  const [certCid, setCertCid] = useState('');
  const [certText, setCertText] = useState('');

  // Referral fields
  const [referralSpecialty, setReferralSpecialty] = useState('');
  const [referralReason, setReferralReason] = useState('');

  // Exam request fields
  const [exams, setExams] = useState('');
  const [examJustification, setExamJustification] = useState('');

  function addMedication() {
    setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '' }]);
  }

  function updateMedication(index: number, field: keyof Medication, value: string) {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  }

  function removeMedication(index: number) {
    if (medications.length <= 1) return;
    setMedications(medications.filter((_, i) => i !== index));
  }

  function buildContent(): Record<string, unknown> {
    switch (type) {
      case 'prescription':
        return { medications: medications.filter((m) => m.name.trim()) };
      case 'certificate':
        return { days: certDays, cid: certCid, text: certText };
      case 'referral':
        return { specialty: referralSpecialty, reason: referralReason };
      case 'exam_request':
        return { exams: exams.split('\n').filter(Boolean), justification: examJustification };
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/teleconsultation/${teleconsultationId}/prescription`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type, content: buildContent() }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(onClose, 1500);
      }
    } catch (err) {
      console.error('Save prescription error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndSend() {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/teleconsultation/${teleconsultationId}/prescription`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type, content: buildContent() }),
      });
      if (res.ok) {
        const data = await res.json();
        // Send via WhatsApp
        await fetch(`${API_BASE}/api/teleconsultation/${teleconsultationId}/send-prescription`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ prescriptionId: data.id }),
        });
        setSaved(true);
        setTimeout(onClose, 1500);
      }
    } catch (err) {
      console.error('Save+send prescription error:', err);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-md text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-slate-700 font-medium">Prescrição salva com sucesso!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Nova Prescrição</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            {(Object.entries(TYPE_LABELS) as [PrescriptionType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  type === key
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Type-specific forms */}
          {type === 'prescription' && (
            <div className="space-y-3">
              {medications.map((med, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Medicamento {i + 1}</span>
                    {medications.length > 1 && (
                      <button onClick={() => removeMedication(i)} className="text-red-400 hover:text-red-600 text-xs">
                        Remover
                      </button>
                    )}
                  </div>
                  <input
                    value={med.name}
                    onChange={(e) => updateMedication(i, 'name', e.target.value)}
                    placeholder="Nome do medicamento"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={med.dosage}
                      onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                      placeholder="Dosagem"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      value={med.frequency}
                      onChange={(e) => updateMedication(i, 'frequency', e.target.value)}
                      placeholder="Posologia"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      value={med.duration}
                      onChange={(e) => updateMedication(i, 'duration', e.target.value)}
                      placeholder="Duração"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addMedication}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                + Adicionar medicamento
              </button>
            </div>
          )}

          {type === 'certificate' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Dias de afastamento</label>
                  <input
                    value={certDays}
                    onChange={(e) => setCertDays(e.target.value)}
                    type="number"
                    placeholder="Ex: 3"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">CID (opcional)</label>
                  <input
                    value={certCid}
                    onChange={(e) => setCertCid(e.target.value)}
                    placeholder="Ex: J06"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Texto do atestado</label>
                <textarea
                  value={certText}
                  onChange={(e) => setCertText(e.target.value)}
                  rows={3}
                  placeholder="Atesto para os devidos fins que..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
          )}

          {type === 'referral' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Especialidade destino</label>
                <input
                  value={referralSpecialty}
                  onChange={(e) => setReferralSpecialty(e.target.value)}
                  placeholder="Ex: Cardiologia"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Motivo do encaminhamento</label>
                <textarea
                  value={referralReason}
                  onChange={(e) => setReferralReason(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
          )}

          {type === 'exam_request' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Exames (um por linha)</label>
                <textarea
                  value={exams}
                  onChange={(e) => setExams(e.target.value)}
                  rows={3}
                  placeholder="Hemograma completo&#10;Glicemia em jejum&#10;TSH"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Justificativa clínica</label>
                <textarea
                  value={examJustification}
                  onChange={(e) => setExamJustification(e.target.value)}
                  rows={2}
                  placeholder="Investigação de..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            onClick={handleSaveAndSend}
            disabled={saving}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50"
          >
            {saving ? 'Enviando...' : 'Salvar e Enviar via WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}
