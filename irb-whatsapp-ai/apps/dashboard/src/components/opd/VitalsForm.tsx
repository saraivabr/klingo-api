import React, { useState } from 'react';
import { Heart, Droplet, Wind, Thermometer, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface VitalsFormProps {
  visitId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VitalsForm({ visitId, onSuccess, onCancel }: VitalsFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vitals, setVitals] = useState({
    height: '',
    weight: '',
    bloodPressure: '',
    pulse: '',
    temperature: '',
    respirationRate: '',
  });

  const handleChange = (field: string, value: string) => {
    setVitals(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        height: vitals.height ? parseFloat(vitals.height) : undefined,
        weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
        bloodPressure: vitals.bloodPressure || undefined,
        pulse: vitals.pulse ? parseInt(vitals.pulse) : undefined,
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
        respirationRate: vitals.respirationRate ? parseInt(vitals.respirationRate) : undefined,
      };

      // Filter out undefined values
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== undefined)
      );

      await api.recordOPDVitals(visitId, cleanPayload);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar vitais');
    } finally {
      setLoading(false);
    }
  };

  const vitalFields = [
    { name: 'height', label: 'Altura (cm)', icon: Heart, placeholder: '170', type: 'number', step: '0.1' },
    { name: 'weight', label: 'Peso (kg)', icon: Droplet, placeholder: '75', type: 'number', step: '0.1' },
    { name: 'bloodPressure', label: 'Pressão (mmHg)', icon: Wind, placeholder: '120/80', type: 'text' },
    { name: 'pulse', label: 'Frequência cardíaca (bpm)', icon: Heart, placeholder: '70', type: 'number' },
    { name: 'temperature', label: 'Temperatura (°C)', icon: Thermometer, placeholder: '36.5', type: 'number', step: '0.1' },
    { name: 'respirationRate', label: 'Freq. respiratória (irpm)', icon: Wind, placeholder: '16', type: 'number' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {vitalFields.map(field => {
          const Icon = field.icon;
          return (
            <div key={field.name}>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Icon size={14} className="text-slate-500" />
                {field.label}
              </label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                step={field.step}
                value={(vitals as any)[field.name]}
                onChange={e => handleChange(field.name, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          );
        })}
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
            'Registrar Vitais'
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
