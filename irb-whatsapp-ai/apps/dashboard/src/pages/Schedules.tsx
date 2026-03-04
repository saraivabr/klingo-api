import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Trash2, AlertCircle, Clock } from 'lucide-react';

interface Schedule {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  perPatientTime: number;
  isActive: boolean;
}

interface DoctorHoliday {
  id: string;
  doctorId: string;
  date: string;
  reason?: string;
}

interface Doctor {
  id: string;
  name: string;
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [holidays, setHolidays] = useState<DoctorHoliday[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);

  const [formData, setFormData] = useState({
    doctorId: '',
    dayOfWeek: 0,
    startTime: '08:00',
    endTime: '17:00',
    perPatientTime: 30,
  });

  const [holidayForm, setHolidayForm] = useState({
    doctorId: '',
    date: '',
    reason: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDoctorId) {
      loadDoctorSchedules(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  async function apiRequest(path: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  async function loadData() {
    try {
      setLoading(true);
      // Fetch doctors from dashboard metrics endpoint
      const response = await apiRequest('/dashboard/metrics');
      // For demo, create dummy doctors list or fetch from patients
      // In a real app, there would be a /api/doctors endpoint
      const mockDoctors = [{ id: 'doc-1', name: 'Dr. João Silva' }];
      setDoctors(mockDoctors);
      if (mockDoctors.length > 0) {
        setSelectedDoctorId(mockDoctors[0].id);
      }
    } catch (error) {
      console.error('Failed to load doctors:', error);
      // Fallback to mock data for UI testing
      setDoctors([{ id: 'doc-1', name: 'Dr. João Silva' }]);
      setSelectedDoctorId('doc-1');
    } finally {
      setLoading(false);
    }
  }

  async function loadDoctorSchedules(doctorId: string) {
    try {
      const response = await apiRequest(`/schedules/${doctorId}`);
      setSchedules(response.schedules || []);
      setHolidays(response.holidays || []);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      // Start with empty lists
      setSchedules([]);
      setHolidays([]);
    }
  }

  async function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        doctorId: selectedDoctorId || formData.doctorId,
      };
      await apiRequest('/schedules', { method: 'POST', body: JSON.stringify(payload) });
      setFormData({
        doctorId: '',
        dayOfWeek: 0,
        startTime: '08:00',
        endTime: '17:00',
        perPatientTime: 30,
      });
      setShowScheduleForm(false);
      if (selectedDoctorId) {
        loadDoctorSchedules(selectedDoctorId);
      }
    } catch (error) {
      console.error('Failed to add schedule:', error);
      alert('Erro ao adicionar horário');
    }
  }

  async function handleDeleteSchedule(scheduleId: string) {
    if (!window.confirm('Tem certeza que deseja deletar este horário?')) return;
    try {
      await apiRequest(`/schedules/${scheduleId}`, { method: 'DELETE' });
      if (selectedDoctorId) {
        loadDoctorSchedules(selectedDoctorId);
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      alert('Erro ao deletar horário');
    }
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    try {
      const doctorId = selectedDoctorId || holidayForm.doctorId;
      await apiRequest(`/schedules/${doctorId}/holidays`, {
        method: 'POST',
        body: JSON.stringify({
          date: holidayForm.date,
          reason: holidayForm.reason,
        }),
      });
      setHolidayForm({ doctorId: '', date: '', reason: '' });
      setShowHolidayForm(false);
      if (selectedDoctorId) {
        loadDoctorSchedules(selectedDoctorId);
      }
    } catch (error) {
      console.error('Failed to add holiday:', error);
      alert('Erro ao adicionar feriado');
    }
  }

  async function handleDeleteHoliday(holidayId: string) {
    if (!window.confirm('Tem certeza que deseja remover este feriado?')) return;
    try {
      const doctorId = selectedDoctorId;
      await apiRequest(`/schedules/${doctorId}/holidays/${holidayId}`, { method: 'DELETE' });
      if (selectedDoctorId) {
        loadDoctorSchedules(selectedDoctorId);
      }
    } catch (error) {
      console.error('Failed to delete holiday:', error);
      alert('Erro ao remover feriado');
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-6">
        <p className="text-slate-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar size={28} />
          Agendas Médicas
        </h1>
      </div>

      {/* Doctor Selection */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Selecione o Médico
        </label>
        <select
          value={selectedDoctorId}
          onChange={(e) => setSelectedDoctorId(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Selecione um médico --</option>
          {doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name}
            </option>
          ))}
        </select>
      </div>

      {selectedDoctorId && (
        <>
          {/* Weekly Schedule Section */}
          <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Clock size={20} />
                Horários da Semana
              </h2>
              <button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Adicionar Horário
              </button>
            </div>

            {/* Add Schedule Form */}
            {showScheduleForm && (
              <form onSubmit={handleAddSchedule} className="p-6 border-b border-slate-200 bg-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Dia da Semana
                    </label>
                    <select
                      value={formData.dayOfWeek}
                      onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <option key={idx} value={idx}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tempo por Paciente (minutos)
                    </label>
                    <input
                      type="number"
                      value={formData.perPatientTime}
                      onChange={(e) => setFormData({ ...formData, perPatientTime: parseInt(e.target.value) })}
                      min="5"
                      max="120"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Horário Inicial
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Horário Final
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleForm(false)}
                    className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Schedules List */}
            <div className="p-6">
              {schedules.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Nenhum horário cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {DAYS_OF_WEEK[schedule.dayOfWeek]}
                        </p>
                        <p className="text-sm text-slate-600">
                          {schedule.startTime} - {schedule.endTime} ({schedule.perPatientTime} min/paciente)
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Holidays Section */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle size={20} />
                Feriados e Licenças
              </h2>
              <button
                onClick={() => setShowHolidayForm(!showHolidayForm)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Adicionar Feriado
              </button>
            </div>

            {/* Add Holiday Form */}
            {showHolidayForm && (
              <form onSubmit={handleAddHoliday} className="p-6 border-b border-slate-200 bg-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Data
                    </label>
                    <input
                      type="date"
                      value={holidayForm.date}
                      onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Motivo
                    </label>
                    <input
                      type="text"
                      value={holidayForm.reason}
                      onChange={(e) => setHolidayForm({ ...holidayForm, reason: e.target.value })}
                      placeholder="Ex: Feriado Nacional, Licença Médica"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHolidayForm(false)}
                    className="px-4 py-2 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Holidays List */}
            <div className="p-6">
              {holidays.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Nenhum feriado ou licença cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {holidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {new Date(holiday.date).toLocaleDateString('pt-BR')}
                        </p>
                        {holiday.reason && (
                          <p className="text-sm text-slate-600">{holiday.reason}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteHoliday(holiday.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
