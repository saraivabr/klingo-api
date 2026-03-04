import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface NewOPDVisitFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewOPDVisitForm({ onClose, onSuccess }: NewOPDVisitFormProps) {
  const [loading, setLoading] = useState(false);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);

  const [form, setForm] = useState({
    patientId: '',
    patientName: '',
    doctorId: '',
    doctorName: '',
    visitDate: new Date().toISOString().split('T')[0],
    caseId: '',
    symptoms: '',
    notes: '',
  });

  // Load doctors on mount
  useEffect(() => {
    // In a real app, we'd fetch doctors from the API
    // For now, we'll need to pass doctors as props or fetch from another endpoint
    // setDoctors([...]);
  }, []);

  const handlePatientSearch = async (search: string) => {
    if (!search || search.length < 2) {
      setPatients([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const results = await api.searchPatients(search);
      setPatients(results);
    } catch (err) {
      console.error('Failed to search patients:', err);
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleSelectPatient = (patient: any) => {
    setForm(prev => ({
      ...prev,
      patientId: patient.id,
      patientName: patient.name || patient.phone,
    }));
    setShowPatientDropdown(false);
    setPatients([]);
  };

  const handleSelectDoctor = (doctor: any) => {
    setForm(prev => ({
      ...prev,
      doctorId: doctor.id,
      doctorName: doctor.name,
    }));
    setShowDoctorDropdown(false);
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);

    if (field === 'patientName') {
      handlePatientSearch(value);
      setShowPatientDropdown(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId || !form.doctorId || !form.visitDate) {
      setError('Paciente, doutor e data são obrigatórios');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.createOPDVisit({
        patientId: form.patientId,
        doctorId: form.doctorId,
        visitDate: form.visitDate,
        caseId: form.caseId || undefined,
        symptoms: form.symptoms || undefined,
        notes: form.notes || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar consulta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Nova Consulta OPD</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Paciente *</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar paciente por nome ou telefone"
                value={form.patientName}
                onChange={e => handleChange('patientName', e.target.value)}
                onFocus={() => setShowPatientDropdown(true)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchingPatients && (
                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
              )}
              {showPatientDropdown && patients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                  {patients.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPatient(p)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 text-sm transition-colors"
                    >
                      <div className="font-medium text-slate-900">{p.name || 'Sem nome'}</div>
                      <div className="text-xs text-slate-600">{p.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.patientId && (
              <div className="mt-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                ✓ Paciente selecionado
              </div>
            )}
          </div>

          {/* Doctor Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Médico *</label>
            <input
              type="text"
              placeholder="Nome do médico"
              value={form.doctorName}
              onChange={e => handleChange('doctorName', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              ID do Médico: <input
                type="text"
                placeholder="UUID do médico"
                value={form.doctorId}
                onChange={e => setForm(prev => ({ ...prev, doctorId: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
              />
            </p>
          </div>

          {/* Visit Date */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data da Consulta *</label>
            <input
              type="date"
              value={form.visitDate}
              onChange={e => handleChange('visitDate', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Case ID */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">ID do Caso</label>
            <input
              type="text"
              placeholder="ID do caso (opcional)"
              value={form.caseId}
              onChange={e => handleChange('caseId', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sintomas</label>
            <input
              type="text"
              placeholder="Sintomas apresentados"
              value={form.symptoms}
              onChange={e => handleChange('symptoms', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notas</label>
            <textarea
              placeholder="Notas adicionais"
              rows={3}
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Consulta'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
