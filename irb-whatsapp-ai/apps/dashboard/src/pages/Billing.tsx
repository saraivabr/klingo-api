import React, { useEffect, useState } from 'react';
import { Plus, Eye, Download, Trash2, DollarSign, FileText } from 'lucide-react';
import { api } from '../services/api';
import InvoiceForm from '../components/billing/InvoiceForm';
import PaymentModal from '../components/billing/PaymentModal';

interface Bill {
  id: string;
  billNumber: string;
  status: 'pending' | 'partial' | 'paid' | 'cancelled';
  totalAmount: number;
  discountPercent: number;
  netAmount: number;
  createdAt: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
}

interface BillDetail extends Bill {
  notes: string;
  updatedAt: string;
  patientEmail: string;
  createdByName: string;
}

interface BillItem {
  id: string;
  chargeId: string;
  chargeName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface BillTransaction {
  id: string;
  amountPaid: number;
  paymentMethod: string;
  transactionRef: string;
  paidAt: string;
  notes: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700' },
  partial: { label: 'Parcial', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Pago', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-700' },
};

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

export default function Billing() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillDetail | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [billTransactions, setBillTransactions] = useState<BillTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paidAmount, setPaidAmount] = useState(0);

  // Fetch bills list
  useEffect(() => {
    fetchBills();
  }, [search, statusFilter]);

  async function fetchBills() {
    try {
      setLoading(true);
      const response = await api.getBillings({
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: '50',
      });
      setBills(response.bills || []);
    } catch (error) {
      console.error('Erro ao carregar faturas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBillDetail(billId: string) {
    try {
      const response = await api.getBillingDetail(billId);
      setSelectedBill(response.bill);
      setBillItems(response.items || []);
      setBillTransactions(response.transactions || []);
      setPaidAmount(response.paidAmount || 0);
    } catch (error) {
      console.error('Erro ao carregar detalhes da fatura:', error);
    }
  }

  async function handleCreateBill(billData: any) {
    try {
      await api.createBilling(billData);
      setShowNewForm(false);
      fetchBills();
    } catch (error) {
      console.error('Erro ao criar fatura:', error);
    }
  }

  async function handleRecordPayment(paymentData: any) {
    if (!selectedBill) return;
    try {
      await api.recordBillingPayment(selectedBill.id, paymentData);
      setShowPaymentModal(false);
      fetchBillDetail(selectedBill.id);
      fetchBills();
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
    }
  }

  async function handleDeleteBill(billId: string) {
    if (confirm('Tem certeza que deseja deletar esta fatura?')) {
      try {
        await api.deleteBilling(billId);
        setSelectedBill(null);
        fetchBills();
      } catch (error) {
        console.error('Erro ao deletar fatura:', error);
      }
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Faturamento</h2>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} /> Nova Fatura
        </button>
      </div>

      {showNewForm && (
        <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">Criar Nova Fatura</h3>
          <InvoiceForm
            onSubmit={handleCreateBill}
            onCancel={() => setShowNewForm(false)}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Buscar por paciente ou número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos os Status</option>
          <option value="pending">Pendente</option>
          <option value="partial">Parcial</option>
          <option value="paid">Pago</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bills List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Faturas</h3>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <p className="px-4 py-8 text-center text-slate-400">Carregando...</p>
              ) : bills.length === 0 ? (
                <p className="px-4 py-8 text-center text-slate-400">Nenhuma fatura encontrada</p>
              ) : (
                bills.map(bill => (
                  <button
                    key={bill.id}
                    onClick={() => fetchBillDetail(bill.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                      selectedBill?.id === bill.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="font-medium text-slate-900 text-sm">{bill.billNumber}</div>
                    <div className="text-xs text-slate-500">{bill.patientName}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-medium">{formatCurrency(bill.netAmount)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_BADGES[bill.status]?.className
                        }`}
                      >
                        {STATUS_BADGES[bill.status]?.label}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bill Details */}
        <div className="lg:col-span-2">
          {selectedBill ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{selectedBill.billNumber}</h3>
                  <p className="text-sm text-slate-500">{formatDate(selectedBill.createdAt)}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    STATUS_BADGES[selectedBill.status]?.className
                  }`}
                >
                  {STATUS_BADGES[selectedBill.status]?.label}
                </span>
              </div>

              <div className="p-6 space-y-6">
                {/* Patient Info */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">PACIENTE</p>
                    <p className="font-semibold text-slate-900">{selectedBill.patientName}</p>
                    <p className="text-sm text-slate-600">{selectedBill.patientPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">EMAIL</p>
                    <p className="font-semibold text-slate-900">{selectedBill.patientEmail || '-'}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Itens da Fatura</h4>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Descrição</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Qtd</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Valor Unit.</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {billItems.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-slate-900">{item.chargeName || item.description}</td>
                          <td className="text-right px-3 py-2 text-slate-600">{item.quantity}</td>
                          <td className="text-right px-3 py-2 text-slate-600">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-right px-3 py-2 font-medium text-slate-900">
                            {formatCurrency(item.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-500">Valor Total</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(selectedBill.totalAmount)}</p>
                  </div>
                  {selectedBill.discountPercent > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">Desconto ({selectedBill.discountPercent}%)</p>
                      <p className="text-lg font-bold text-red-600">
                        -{formatCurrency(selectedBill.totalAmount - selectedBill.netAmount)}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2 pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-500">Valor a Pagar</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(selectedBill.netAmount)}</p>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-2">PAGAMENTOS</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Pago até agora</span>
                    <span className="text-lg font-bold text-blue-600">{formatCurrency(paidAmount)}</span>
                  </div>
                  {paidAmount < selectedBill.netAmount && (
                    <div className="mt-3">
                      <span className="text-sm text-slate-600">Saldo a pagar</span>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(selectedBill.netAmount - paidAmount)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Transactions */}
                {billTransactions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3">Histórico de Pagamentos</h4>
                    <div className="space-y-2">
                      {billTransactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{formatCurrency(tx.amountPaid)}</p>
                            <p className="text-xs text-slate-500">
                              {tx.paymentMethod} • {formatDate(tx.paidAt)}
                            </p>
                          </div>
                          {tx.transactionRef && (
                            <span className="text-xs text-slate-500">Ref: {tx.transactionRef}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  {selectedBill.status !== 'paid' && selectedBill.status !== 'cancelled' && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
                    >
                      <DollarSign size={18} /> Registrar Pagamento
                    </button>
                  )}
                  <button
                    onClick={() => {
                      // TODO: implement download/print
                    }}
                    className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200"
                    title="Imprimir/Exportar"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteBill(selectedBill.id)}
                    className="flex items-center justify-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                    title="Deletar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <FileText size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Selecione uma fatura para ver os detalhes</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <PaymentModal
          billNumber={selectedBill.billNumber}
          remainingAmount={selectedBill.netAmount - paidAmount}
          onSubmit={handleRecordPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
}
