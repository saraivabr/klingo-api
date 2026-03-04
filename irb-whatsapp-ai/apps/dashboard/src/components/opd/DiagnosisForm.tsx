import React, { useState } from 'react';
import { Pill, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface DiagnosisFormProps {
  visitId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const commonDiagnoses = [
  { code: 'A00', description: 'Cólera' },
  { code: 'A01', description: 'Febre tifoide' },
  { code: 'A02', description: 'Infecções por Salmonella' },
  { code: 'J00', description: 'Nasofaringite aguda [resfriado comum]' },
  { code: 'J01', description: 'Sinusite aguda' },
  { code: 'J02', description: 'Faringite aguda' },
  { code: 'J03', description: 'Amigdalite aguda' },
  { code: 'J04', description: 'Laryngite aguda' },
  { code: 'J05', description: 'Laryngotraqueobronquite aguda' },
  { code: 'J06', description: 'Infecção aguda do trato respiratório superior não especificada' },
  { code: 'J09', description: 'Influenza devido a vírus certos identificados' },
  { code: 'J10', description: 'Influenza devido a vírus da gripe identificado' },
  { code: 'J11', description: 'Influenza devida a vírus não identificado' },
  { code: 'J12', description: 'Pneumonia viral não classificada em outra parte' },
  { code: 'J13', description: 'Pneumonia devida a Streptococcus pneumoniae' },
  { code: 'I10', description: 'Hipertensão essencial [primária]' },
  { code: 'E11', description: 'Diabetes mellitus tipo 2' },
  { code: 'E10', description: 'Diabetes mellitus tipo 1' },
];

export default function DiagnosisForm({ visitId, onSuccess, onCancel }: DiagnosisFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [diagnosis, setDiagnosis] = useState({
    diagnosisCode: '',
    description: '',
    notes: '',
  });

  const filteredSuggestions = diagnosis.diagnosisCode
    ? commonDiagnoses.filter(d =>
        d.code.toLowerCase().includes(diagnosis.diagnosisCode.toLowerCase()) ||
        d.description.toLowerCase().includes(diagnosis.diagnosisCode.toLowerCase())
      )
    : commonDiagnoses;

  const handleSelectDiagnosis = (d: typeof commonDiagnoses[0]) => {
    setDiagnosis(prev => ({
      ...prev,
      diagnosisCode: d.code,
      description: d.description,
    }));
    setShowSuggestions(false);
  };

  const handleChange = (field: string, value: string) => {
    setDiagnosis(prev => ({ ...prev, [field]: value }));
    setError(null);
    if (field === 'diagnosisCode') {
      setShowSuggestions(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.diagnosisCode) {
      setError('Código de diagnóstico é obrigatório');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.addOPDDiagnosis(visitId, {
        diagnosisCode: diagnosis.diagnosisCode,
        description: diagnosis.description || undefined,
        notes: diagnosis.notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
          <Pill size={14} className="text-slate-500" />
          Código CID-10 *
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Ex: A00, J01, I10"
            value={diagnosis.diagnosisCode}
            onChange={e => handleChange('diagnosisCode', e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
              {filteredSuggestions.map(d => (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => handleSelectDiagnosis(d)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 text-sm transition-colors"
                >
                  <div className="font-medium text-slate-900">{d.code}</div>
                  <div className="text-xs text-slate-600">{d.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Descrição</label>
        <input
          type="text"
          placeholder="Descrição do diagnóstico"
          value={diagnosis.description}
          onChange={e => handleChange('description', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notas Adicionais</label>
        <textarea
          placeholder="Notas, observações adicionais..."
          rows={3}
          value={diagnosis.notes}
          onChange={e => handleChange('notes', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Salvando...
            </>
          ) : (
            'Adicionar Diagnóstico'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
