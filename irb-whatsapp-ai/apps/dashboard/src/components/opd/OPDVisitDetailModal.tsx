import React, { useState, useEffect } from 'react';
import { X, Loader2, Heart, Pill, FileText, Plus } from 'lucide-react';
import { api } from '../../services/api';
import VitalsForm from './VitalsForm';
import DiagnosisForm from './DiagnosisForm';

interface OPDVisitDetailModalProps {
  visitId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function OPDVisitDetailModal({ visitId, onClose, onUpdate }: OPDVisitDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<any>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'vitals' | 'diagnosis' | 'timeline'>('info');
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);

  useEffect(() => {
    loadVisitDetails();
  }, [visitId]);

  const loadVisitDetails = async () => {
    setLoading(true);
    try {
      const data = await api.getOPDVisit(visitId);
      setVisit(data.visit);
      setVitals(data.vitals || []);
      setDiagnoses(data.diagnoses || []);
      setTimeline(data.timeline || []);
    } catch (err) {
      console.error('Failed to load visit:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteVisit = async () => {
    try {
      await api.completeOPDVisit(visitId);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Failed to complete visit:', err);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <Loader2 className="animate-spin" size={32} />
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <p className="text-slate-600">Consulta não encontrada</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'info', label: 'Informações', icon: FileText },
    { id: 'vitals', label: 'Vitais', icon: Heart },
    { id: 'diagnosis', label: 'Diagnósticos', icon: Pill },
    { id: 'timeline', label: 'Linha do Tempo', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-cyan-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{visit.patientName || 'Paciente'}</h2>
            <p className="text-xs text-slate-600">{visit.patientPhone}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6 flex gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors border-b-2 -mb-[2px] ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-600 mb-1">Paciente</p>
                  <p className="font-semibold text-slate-900">{visit.patientName || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-600 mb-1">Médico</p>
                  <p className="font-semibold text-slate-900">{visit.doctorName || '—'}</p>
                  {visit.doctorSpecialty && <p className="text-xs text-slate-600">{visit.doctorSpecialty}</p>}
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-600 mb-1">Data da Consulta</p>
                  <p className="font-semibold text-slate-900">{new Date(visit.visitDate).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-600 mb-1">Status</p>
                  <p className="font-semibold text-slate-900">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      visit.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      visit.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {visit.status === 'completed' ? 'Concluído' :
                       visit.status === 'in-progress' ? 'Em Atendimento' :
                       'Aguardando'}
                    </span>
                  </p>
                </div>
              </div>

              {visit.symptoms && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs text-blue-700 font-medium mb-1">Sintomas</p>
                  <p className="text-blue-900">{visit.symptoms}</p>
                </div>
              )}

              {visit.notes && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-600 font-medium mb-1">Notas</p>
                  <p className="text-slate-900">{visit.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Vitals Tab */}
          {activeTab === 'vitals' && (
            <div className="space-y-4">
              {showVitalsForm ? (
                <VitalsForm
                  visitId={visitId}
                  onSuccess={() => {
                    setShowVitalsForm(false);
                    loadVisitDetails();
                  }}
                  onCancel={() => setShowVitalsForm(false)}
                />
              ) : (
                <>
                  <button
                    onClick={() => setShowVitalsForm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    Adicionar Vitais
                  </button>

                  {vitals.length === 0 ? (
                    <p className="text-center text-slate-600 py-8">Nenhum vital registrado</p>
                  ) : (
                    <div className="space-y-3">
                      {vitals.map((vital, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <p className="text-xs text-slate-600 mb-2">{new Date(vital.recordedAt).toLocaleString('pt-BR')}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {vital.height && <div><span className="text-slate-600">Altura:</span> <span className="font-medium">{vital.height} cm</span></div>}
                            {vital.weight && <div><span className="text-slate-600">Peso:</span> <span className="font-medium">{vital.weight} kg</span></div>}
                            {vital.bloodPressure && <div><span className="text-slate-600">Pressão:</span> <span className="font-medium">{vital.bloodPressure}</span></div>}
                            {vital.pulse && <div><span className="text-slate-600">FC:</span> <span className="font-medium">{vital.pulse} bpm</span></div>}
                            {vital.temperature && <div><span className="text-slate-600">Temp:</span> <span className="font-medium">{vital.temperature}°C</span></div>}
                            {vital.respirationRate && <div><span className="text-slate-600">FR:</span> <span className="font-medium">{vital.respirationRate} irpm</span></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Diagnosis Tab */}
          {activeTab === 'diagnosis' && (
            <div className="space-y-4">
              {showDiagnosisForm ? (
                <DiagnosisForm
                  visitId={visitId}
                  onSuccess={() => {
                    setShowDiagnosisForm(false);
                    loadVisitDetails();
                  }}
                  onCancel={() => setShowDiagnosisForm(false)}
                />
              ) : (
                <>
                  <button
                    onClick={() => setShowDiagnosisForm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    Adicionar Diagnóstico
                  </button>

                  {diagnoses.length === 0 ? (
                    <p className="text-center text-slate-600 py-8">Nenhum diagnóstico registrado</p>
                  ) : (
                    <div className="space-y-3">
                      {diagnoses.map((diag, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-slate-900">{diag.diagnosisCode}</p>
                              <p className="text-sm text-slate-600">{diag.description}</p>
                            </div>
                          </div>
                          {diag.notes && <p className="text-xs text-slate-600 mt-2">{diag.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-2">
              {timeline.length === 0 ? (
                <p className="text-center text-slate-600 py-8">Sem eventos registrados</p>
              ) : (
                <div className="space-y-2">
                  {timeline.map((entry, idx) => (
                    <div key={idx} className="border-l-4 border-blue-400 pl-4 py-2">
                      <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                      {entry.description && <p className="text-xs text-slate-600 mt-1">{entry.description}</p>}
                      <p className="text-xs text-slate-500 mt-1">{new Date(entry.date).toLocaleString('pt-BR')}</p>
                      {entry.createdBy && <p className="text-xs text-slate-500">Por: {entry.createdBy}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex items-center gap-2 bg-slate-50">
          {visit.status !== 'completed' && (
            <button
              onClick={handleCompleteVisit}
              className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Marcar como Concluído
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-100 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
