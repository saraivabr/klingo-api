import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Loader2, X, Plus, Trash2 } from 'lucide-react';

interface LabTest {
  id: string;
  name: string;
  shortName?: string;
  categoryId: string;
  chargeCents?: number;
}

interface LabCategory {
  id: string;
  name: string;
}

export default function TestOrderForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [categories, setCategories] = useState<LabCategory[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const cats = await api.labGetCategories();
        setCategories(cats || []);
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCategoryChange = async (catId: string) => {
    setSelectedCategory(catId);
    setSelectedTests([]);
    try {
      const testList = await api.labGetTests({ categoryId: catId });
      setTests(testList || []);
    } catch (err) {
      console.error('Failed to load tests:', err);
    }
  };

  const toggleTest = (testId: string) => {
    setSelectedTests((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || selectedTests.length === 0) {
      alert('Por favor, selecione um paciente e pelo menos um teste');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.labCreateOrder({
        patientId,
        doctorId: doctorId || undefined,
        testIds: selectedTests,
        priority,
        notes,
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to create order:', err);
      alert('Erro ao criar pedido de exame');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-slate-200 p-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Novo Pedido de Exames</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Patient & Doctor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Paciente *
              </label>
              <input
                type="text"
                placeholder="ID ou buscar paciente"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Médico
              </label>
              <input
                type="text"
                placeholder="ID do médico (opcional)"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Priority & Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Categoria de Exames
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione uma categoria...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tests Selection */}
          {selectedCategory && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Exames ({selectedTests.length})
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {tests.length > 0 ? (
                  tests.map((test) => (
                    <label
                      key={test.id}
                      className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTests.includes(test.id)}
                        onChange={() => toggleTest(test.id)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <span className="flex-1 text-sm text-slate-700">
                        {test.name}
                        {test.shortName && <span className="text-slate-500 ml-2">({test.shortName})</span>}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Nenhum exame disponível
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Selected Tests List */}
          {selectedTests.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Exames Selecionados
              </label>
              <div className="space-y-2">
                {tests
                  .filter((t) => selectedTests.includes(t.id))
                  .map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between bg-blue-50 p-3 rounded-lg"
                    >
                      <span className="text-sm font-medium text-blue-900">{test.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleTest(test.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={(e) => handleSubmit(e as any)}
            disabled={isSubmitting || !patientId || selectedTests.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus size={18} />
                Criar Pedido
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
