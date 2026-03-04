import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  billNumber: string;
  remainingAmount: number;
  onSubmit: (data: any) => Promise<void>;
  onClose: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'card', label: 'Cartão de Crédito' },
  { value: 'debit', label: 'Cartão de Débito' },
  { value: 'pix', label: 'PIX' },
  { value: 'check', label: 'Cheque' },
  { value: 'transfer', label: 'Transferência Bancária' },
];

export default function PaymentModal({ billNumber, remainingAmount, onSubmit, onClose }: Props) {
  const [amountPaid, setAmountPaid] = useState(remainingAmount);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountPaid || amountPaid <= 0) {
      alert('Valor do pagamento inválido');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        amountPaid,
        paymentMethod,
        transactionRef: transactionRef || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Registrar Pagamento</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Bill Info */}
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">Fatura</p>
            <p className="text-lg font-semibold text-slate-900">{billNumber}</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Valor do Pagamento (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              value={(amountPaid / 100).toFixed(2)}
              onChange={(e) => setAmountPaid(Math.round(parseFloat(e.target.value) * 100))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Saldo restante: R$ {(remainingAmount / 100).toFixed(2)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Método de Pagamento *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Reference */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Referência da Transação
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="Ex: número do cheque, ID da transferência..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre o pagamento..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 font-medium"
            >
              {submitting ? 'Processando...' : 'Registrar Pagamento'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
