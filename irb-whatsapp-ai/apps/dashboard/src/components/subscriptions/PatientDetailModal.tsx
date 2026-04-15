import React, { useEffect, useState } from 'react';
import {
  X, Loader2, User, Phone, Mail, Calendar, Hash,
  Edit3, Save, XCircle, Crown,
  Stethoscope, CheckCircle2, MapPin,
} from 'lucide-react';
import { api } from '../../services/api';

/* ── types ─────────────────────────────────── */

interface PatientDetail {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  birthDate: string | null;
  source: string | null;
  klingoPatientId: number | null;
  createdAt: string;
  cpf: string | null;
  subscription: {
    id: string;
    status: string;
    planName: string;
    planPriceCents: number;
    billingCycle: string;
    nextDueDate: string | null;
  } | null;
}

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  doctorName: string | null;
  doctorSpecialty: string | null;
  serviceName: string | null;
}

interface Props {
  patientId: string;
  onClose: () => void;
}

/* ── helpers ───────────────────────────────── */

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  whatsapp:  { label: 'WhatsApp',  color: 'bg-green-50 text-green-700' },
  dashboard: { label: 'Dashboard', color: 'bg-blue-50 text-blue-700' },
  booking:   { label: 'Agendamento', color: 'bg-violet-50 text-violet-700' },
};

const APPT_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  scheduled:  { label: 'Agendada',   color: 'text-blue-600',    dot: 'bg-blue-500' },
  confirmed:  { label: 'Confirmada', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  completed:  { label: 'Realizada',  color: 'text-slate-500',   dot: 'bg-slate-400' },
  cancelled:  { label: 'Cancelada',  color: 'text-rose-500',    dot: 'bg-rose-400' },
  no_show:    { label: 'Faltou',     color: 'text-amber-600',   dot: 'bg-amber-500' },
};

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR');
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' ' +
    dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function maskPhone(v: string): string {
  const nums = v.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function maskCpf(v: string): string {
  const nums = v.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function billingCycleLabel(cycle: string | null | undefined): string {
  if (cycle === 'SEMIANNUALLY') return 'Semestral';
  if (cycle === 'YEARLY') return 'Anual';
  return 'Mensal';
}

function billingCycleSuffix(cycle: string | null | undefined): string {
  if (cycle === 'SEMIANNUALLY') return '/6 meses';
  if (cycle === 'YEARLY') return '/ano';
  return '/mês';
}

/* ── component ─────────────────────────────── */

export default function PatientDetailModal({ patientId, onClose }: Props) {
  const [data, setData] = useState<PatientDetail | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', birthDate: '' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getPatient(patientId),
      api.getPatientAppointments(patientId),
    ]).then(([patient, appts]) => {
      setData(patient);
      setAppointments(appts.appointments);
      setEditForm({
        name: patient.name || '',
        phone: patient.phone || '',
        email: patient.email || '',
        birthDate: patient.birthDate || '',
      });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [patientId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.updatePatient(patientId, {
        name: editForm.name,
        phone: editForm.phone.replace(/\D/g, ''),
        email: editForm.email || undefined,
        birthDate: editForm.birthDate || undefined,
      });
      setSaveSuccess(true);
      setEditing(false);
      loadData();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl shadow-black/15 overflow-hidden animate-slide-up max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {loading || !data ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
            <p className="text-sm text-slate-400 mt-4">Carregando paciente...</p>
          </div>
        ) : (
          <>
            {/* Header with avatar */}
            <div className="relative bg-gradient-to-b from-slate-50 to-white px-7 pt-6 pb-5 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar with gradient ring */}
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/15">
                      <span className="text-white font-bold text-lg tracking-tight">{getInitials(data.name)}</span>
                    </div>
                    {data.klingoPatientId && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center shadow-sm">
                        <Hash size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{data.name || 'Sem nome'}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      {data.source && (
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${SOURCE_CONFIG[data.source]?.color || 'bg-slate-100 text-slate-500'}`}>
                          {SOURCE_CONFIG[data.source]?.label || data.source}
                        </span>
                      )}
                      {data.klingoPatientId && (
                        <span className="text-[10px] font-semibold text-emerald-600 tabular-nums">
                          Klingo #{data.klingoPatientId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {!editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                    >
                      <Edit3 size={13} />
                    </button>
                  )}
                  <button onClick={onClose} className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-black/10 transition-all">
                    <X size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-7 space-y-5 modal-scroll">

              {saveSuccess && (
                <div className="flex items-center gap-2.5 text-emerald-700 text-sm bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200/50 animate-slide-up">
                  <CheckCircle2 size={15} /> Dados salvos com sucesso
                </div>
              )}
              {saveError && (
                <div className="flex items-center gap-2.5 text-rose-600 text-sm bg-rose-50 px-4 py-3 rounded-xl border border-rose-200/50">
                  <XCircle size={15} /> {saveError}
                </div>
              )}

              {/* Personal info */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Dados Pessoais</p>

                {editing ? (
                  <div className="space-y-3 animate-fade-in bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Nome</label>
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Telefone</label>
                        <input
                          value={maskPhone(editForm.phone)}
                          onChange={e => setEditForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Nascimento</label>
                        <input
                          type="date"
                          value={editForm.birthDate}
                          onChange={e => setEditForm(f => ({ ...f, birthDate: e.target.value }))}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@exemplo.com"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-300"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditing(false);
                          setSaveError('');
                          setEditForm({ name: data.name || '', phone: data.phone || '', email: data.email || '', birthDate: data.birthDate || '' });
                        }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { icon: <User size={12} />, label: 'CPF', value: data.cpf ? maskCpf(data.cpf) : '—' },
                      { icon: <Phone size={12} />, label: 'Telefone', value: maskPhone(data.phone) },
                      { icon: <Mail size={12} />, label: 'Email', value: data.email || '—' },
                      { icon: <Calendar size={12} />, label: 'Nascimento', value: fmtDate(data.birthDate) },
                    ].map((field, i) => (
                      <div
                        key={field.label}
                        className="bg-white rounded-xl p-3.5 border border-slate-100 hover:border-slate-200 transition-colors animate-stagger-in"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-slate-400">{field.icon}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{field.label}</span>
                        </div>
                        <p className={`text-sm font-semibold text-slate-800 ${field.label === 'CPF' || field.label === 'Telefone' ? 'tabular-nums' : ''}`}>
                          {field.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active subscription card */}
              {data.subscription && (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Crown size={12} className="text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Assinatura Ativa</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{data.subscription.planName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">Vence em {fmtDate(data.subscription.nextDueDate)}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-700 tabular-nums text-lg" title={billingCycleLabel(data.subscription.billingCycle)}>
                        {fmt(data.subscription.planPriceCents)}
                      </span>
                      <span className="text-emerald-500 font-normal text-[11px]">{billingCycleSuffix(data.subscription.billingCycle)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Appointments — Timeline style */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Consultas Recentes</p>
                {appointments.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/60 flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <Stethoscope size={20} className="text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Nenhuma consulta registrada</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[17px] top-3 bottom-3 w-px bg-slate-200" />
                    <div className="space-y-1">
                      {appointments.map((appt, i) => {
                        const as = APPT_STATUS[appt.status] || { label: appt.status, color: 'text-slate-600', dot: 'bg-slate-400' };
                        return (
                          <div
                            key={appt.id}
                            className="relative flex items-start gap-3.5 pl-1 py-2 animate-stagger-in"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            {/* Timeline dot */}
                            <div className="relative z-10 mt-1.5">
                              <div className={`w-[9px] h-[9px] rounded-full ${as.dot} ring-2 ring-white`} />
                            </div>
                            <div className="flex-1 bg-white rounded-xl px-3.5 py-2.5 border border-slate-100 hover:border-slate-200 transition-colors min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[13px] font-semibold text-slate-800 truncate">{appt.doctorName || 'Médico'}</span>
                                <span className={`text-[10px] font-bold shrink-0 ${as.color}`}>{as.label}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span className="tabular-nums">{fmtDateTime(appt.scheduledAt)}</span>
                                {appt.doctorSpecialty && (
                                  <>
                                    <span className="text-slate-200">·</span>
                                    <span className="text-slate-500">{appt.doctorSpecialty}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
