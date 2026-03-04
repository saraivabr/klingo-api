import React, { useState } from 'react';
import { api } from '../../services/api';
import { X, Loader2, Save } from 'lucide-react';

interface LabParameter {
  id: string;
  parameterName: string;
  unit: string;
  normalRange: string;
}

interface ResultValue {
  parameterId: string;
  value: string;
  isAbnormal: boolean;
  notes: string;
}

export default function ResultsEntry({
  order,
  onClose,
  onSuccess,
}: {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState(order.items[0]?.id || null);
  const [results, setResults] = useState<ResultValue[]>([]);
  const [parameters, setParameters] = useState<LabParameter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleItemSelect = async (itemId: string) => {
    setSelectedItem(itemId);
    const item = order.items.find((i: any) => i.id === itemId);
    if (item && item.test?.id) {
      setIsLoading(true);
      try {
        const testData = await api.labGetTest(item.test.id);
        setParameters(testData.parameters || []);
        setResults(
          (testData.parameters || []).map((p: any) => ({
            parameterId: p.id,
            value: '',
            isAbnormal: false,
            notes: '',
          }))
        );
      } catch (err) {
        console.error('Failed to load test parameters:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleResultChange = (parameterId: string, field: string, value: any) => {
    setResults((prev) =>
      prev.map((r) =>
        r.parameterId === parameterId ? { ...r, [field]: value } : r
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || results.length === 0 || !results.some((r) => r.value)) {
      alert('Por favor, preencha pelo menos um resultado');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.labCreateResults(order.id, {
        itemId: selectedItem,
        results: results.filter((r) => r.value),
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to create results:', err);
      alert('Erro ao salvar resultados');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentItem = order.items.find((i: any) => i.id === selectedItem);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-slate-200 p-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Inserir Resultados</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Test Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Selecione o Exame
            </label>
            <div className="grid grid-cols-2 gap-2">
              {order.items.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => handleItemSelect(item.id)}
                  className={`p-3 rounded-lg border-2 transition-colors text-left ${
                    selectedItem === item.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium text-slate-900">{item.test?.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.status === 'completed' ? '✓ Concluído' : 'Pendente'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Results Form */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          ) : parameters.length > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {results.map((result, idx) => {
                const param = parameters.find((p) => p.id === result.parameterId);
                return (
                  <div key={result.parameterId} className="border border-slate-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {param?.parameterName}
                          {param?.unit && <span className="text-slate-500 ml-1">({param.unit})</span>}
                        </label>
                        <input
                          type="text"
                          value={result.value}
                          onChange={(e) =>
                            handleResultChange(result.parameterId, 'value', e.target.value)
                          }
                          placeholder="Valor"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {param?.normalRange && (
                          <p className="text-xs text-slate-500 mt-1">
                            Normal: {param.normalRange}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Status
                        </label>
                        <select
                          value={result.isAbnormal ? 'abnormal' : 'normal'}
                          onChange={(e) =>
                            handleResultChange(
                              result.parameterId,
                              'isAbnormal',
                              e.target.value === 'abnormal'
                            )
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="normal">Normal</option>
                          <option value="abnormal">⚠️ Anormal</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Observações
                      </label>
                      <input
                        type="text"
                        value={result.notes}
                        onChange={(e) =>
                          handleResultChange(result.parameterId, 'notes', e.target.value)
                        }
                        placeholder="Notas adicionais (opcional)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Salvar Resultados
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-600">Nenhum parâmetro disponível para este exame</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
