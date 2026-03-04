import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../services/api';

interface Charge {
  id: string;
  name: string;
  code: string;
  standardCharge: number;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface InvoiceItem {
  chargeId: string;
  quantity: number;
  unitPrice: number;
}

interface Props {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export default function InvoiceForm({ onSubmit, onCancel }: Props) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCharge, setSelectedCharge] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  useEffect(() => {
    Promise.all([
      api.getCharges().catch(() => ({ charges: [] })),
      api.getPatients().catch(() => ({ patients: [] })),
    ]).then(([chargesRes, patientsRes]) => {
      setCharges(chargesRes.charges || []);
      setPatients(patientsRes.patients || []);
    }).finally(() => setLoading(false));
  }, []);

  function addItem() {
    if (!selectedCharge) return;
    const charge = charges.find(c => c.id === selectedCharge);
    if (!charge) return;

    setItems([...items, {
      chargeId: selectedCharge,
      quantity: selectedQuantity,
      unitPrice: charge.standardCharge,
    }]);
    setSelectedCharge('');
    setSelectedQuantity(1);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function calculateTotal() {
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    return Math.round(subtotal * (1 - discount / 100));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient || items.length === 0) {
      alert('Selecione um paciente e adicione itens');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        patientId: selectedPatient,
        discountPercent: discount,
        notes,
        items,
      });
    } catch (error) {
      console.error('Erro ao criar fatura:', error);
      alert('Erro ao criar fatura');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-slate-400">Carregando dados...</p>;

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const total = calculateTotal();
  const chargeMap = charges.reduce((acc, c) => ({ ...acc, [c.id]: c }), {} as Record<string, Charge>);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Patient Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Paciente *</label>
        <select
          value={selectedPatient}
          onChange={(e) => setSelectedPatient(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Selecionar paciente...</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.phone})
            </option>
          ))}
        </select>
      </div>

      {/* Add Items */}
      <div className="p-4 bg-slate-50 rounded-lg space-y-3">
        <h3 className="font-semibold text-slate-900">Adicionar Itens</h3>
        <div className="flex gap-2">
          <select
            value={selectedCharge}
            onChange={(e) => setSelectedCharge(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecionar cobrança...</option>
            {charges.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} (R$ {(c.standardCharge / 100).toFixed(2)})
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={selectedQuantity}
            onChange={(e) => setSelectedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={addItem}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Items Table */}
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Descrição</th>
                <th className="text-right px-3 py-2 font-medium">Qtd</th>
                <th className="text-right px-3 py-2 font-medium">Valor Unit.</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-center px-3 py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => {
                const charge = chargeMap[item.chargeId];
                const itemTotal = item.unitPrice * item.quantity;
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2">{charge?.name || 'Desconhecido'}</td>
                    <td className="text-right px-3 py-2">{item.quantity}</td>
                    <td className="text-right px-3 py-2">R$ {(item.unitPrice / 100).toFixed(2)}</td>
                    <td className="text-right px-3 py-2 font-medium">R$ {(itemTotal / 100).toFixed(2)}</td>
                    <td className="text-center px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Discount and Notes */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Desconto (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={discount}
            onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Adicione notas sobre esta fatura..."
        />
      </div>

      {/* Summary */}
      <div className="p-4 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
        <div className="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span className="font-medium">R$ {(subtotal / 100).toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-red-600">
            <span>Desconto ({discount}%):</span>
            <span className="font-medium">-R$ {((subtotal - total) / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold border-t border-blue-200 pt-2">
          <span>Total:</span>
          <span>R$ {(total / 100).toFixed(2)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || items.length === 0}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300"
        >
          {submitting ? 'Criando...' : 'Criar Fatura'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
