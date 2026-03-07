import React, { useEffect, useState, useCallback } from 'react';
import { 
  Search, Plus, Filter, CheckCircle, XCircle, Clock, DollarSign, 
  AlertTriangle, ChevronDown, ChevronRight, Eye, Edit, Trash2, 
  Calendar, Building2, FileText, CreditCard, BarChart3, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

interface AccountPayable {
  id: string;
  documentNumber: string | null;
  documentType: string | null;
  description: string;
  grossAmount: number;
  netAmount: number;
  dueDate: string;
  paymentDate: string | null;
  status: string;
  paymentMethod: string | null;
  supplierName: string | null;
  costCenterName: string | null;
  chartAccountName: string | null;
  createdAt: string;
}

interface Summary {
  pendingCount: number;
  pendingTotalCents: number;
  approvedCount: number;
  approvedTotalCents: number;
}

interface CostCenter {
  id: string;
  code: string;
  name: string;
}

interface Supplier {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BankAccount {
  id: string;
  nickname: string;
  bankName: string;
  accountNumber: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Aprovado', className: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  paid: { label: 'Pago', className: 'bg-emerald-100 text-emerald-700', icon: DollarSign },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500', icon: XCircle },
};

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === 'paid' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

export default function AccountsPayable() {
  const [items, setItems] = useState<AccountPayable[]>([]);
  const [total, setTotal] = useState(0);
  const [totalGross, setTotalGross] = useState(0);
  const [totalNet, setTotalNet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [costCenterFilter, setCostCenterFilter] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Auxiliary data
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  // Daily queue
  const [dailyQueue, setDailyQueue] = useState<{ items: any[]; summary: Summary } | null>(null);
  const [showDailyQueue, setShowDailyQueue] = useState(false);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Overdue
  const [overdueData, setOverdueData] = useState<{ items: any[]; totalOverdueCents: number; overdueCount: number } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: page.toString(), limit: '20' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (costCenterFilter) params.costCenterId = costCenterFilter;
      if (dueDateFrom) params.dueDateFrom = dueDateFrom;
      if (dueDateTo) params.dueDateTo = dueDateTo;
      
      const data = await api.getAccountsPayable(params);
      setItems(data.items);
      setTotal(data.total);
      setTotalGross(data.totalGrossCents);
      setTotalNet(data.totalNetCents);
    } catch (err) {
      console.error('Error loading accounts payable:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, costCenterFilter, dueDateFrom, dueDateTo]);

  const loadAuxiliaryData = useCallback(async () => {
    try {
      const [cc, ba, ca] = await Promise.all([
        api.getCostCenters(),
        api.getBankAccounts(),
        api.getChartOfAccounts('expense'),
      ]);
      setCostCenters(cc.items);
      setBankAccounts(ba.items);
      setChartAccounts(ca.items);
    } catch (err) {
      console.error('Error loading auxiliary data:', err);
    }
  }, []);

  const loadDailyQueue = useCallback(async () => {
    try {
      const data = await api.getDailyPaymentQueue();
      setDailyQueue(data);
    } catch (err) {
      console.error('Error loading daily queue:', err);
    }
  }, []);

  const loadOverdue = useCallback(async () => {
    try {
      const data = await api.getOverduePayables();
      setOverdueData(data);
    } catch (err) {
      console.error('Error loading overdue:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAuxiliaryData();
    loadDailyQueue();
    loadOverdue();
  }, [loadAuxiliaryData, loadDailyQueue, loadOverdue]);

  const handleApprove = async (id: string) => {
    if (!confirm('Aprovar este pagamento?')) return;
    try {
      await api.approvePayment(id);
      loadData();
      loadDailyQueue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePay = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    if (!confirm(`Confirmar pagamento de ${formatCurrency(item.netAmount)}?`)) return;
    
    try {
      await api.payAccount(id, { paymentDate: new Date().toISOString().slice(0, 10) });
      loadData();
      loadDailyQueue();
      loadOverdue();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar este pagamento?')) return;
    try {
      await api.cancelAccountPayable(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const data = await api.getAccountPayable(id);
      setSelectedItem(data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Error loading detail:', err);
    }
  };

  const StatCard = ({ icon: Icon, label, value, subvalue, color }: { icon: any; label: string; value: string | number; subvalue?: string; color: string }) => (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}><Icon size={20} /></div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subvalue && <p className="text-xs text-slate-400 mt-1">{subvalue}</p>}
    </div>
  );

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Contas a Pagar</h2>
          <p className="text-sm text-slate-500">Gerencie pagamentos e aprovações</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDailyQueue(!showDailyQueue)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showDailyQueue 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            <Calendar size={16} />
            Fila do Dia
            {dailyQueue && dailyQueue.summary.pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {dailyQueue.summary.pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus size={16} />
            Nova Conta
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          icon={Clock} 
          label="Pendentes Hoje" 
          value={dailyQueue?.summary.pendingCount || 0}
          subvalue={dailyQueue ? formatCurrency(dailyQueue.summary.pendingTotalCents) : ''}
          color="bg-yellow-50 text-yellow-600" 
        />
        <StatCard 
          icon={CheckCircle} 
          label="Aprovados p/ Pagar" 
          value={dailyQueue?.summary.approvedCount || 0}
          subvalue={dailyQueue ? formatCurrency(dailyQueue.summary.approvedTotalCents) : ''}
          color="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          icon={AlertTriangle} 
          label="Em Atraso" 
          value={overdueData?.overdueCount || 0}
          subvalue={overdueData ? formatCurrency(overdueData.totalOverdueCents) : ''}
          color="bg-red-50 text-red-600" 
        />
        <StatCard 
          icon={DollarSign} 
          label="Total Filtrado" 
          value={formatCurrency(totalNet)}
          subvalue={`${total} itens`}
          color="bg-emerald-50 text-emerald-600" 
        />
      </div>

      {/* Daily Queue Panel */}
      {showDailyQueue && dailyQueue && (
        <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-blue-900">Fila de Pagamentos do Dia</h3>
            <button onClick={() => setShowDailyQueue(false)} className="text-blue-600 hover:text-blue-800">
              <XCircle size={20} />
            </button>
          </div>
          
          {dailyQueue.items.length === 0 ? (
            <p className="text-blue-700 text-sm">Nenhum pagamento pendente ou aprovado para hoje.</p>
          ) : (
            <div className="space-y-2">
              {dailyQueue.items.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.description}</p>
                    <p className="text-sm text-slate-500">
                      {item.supplierName || 'Sem fornecedor'} 
                      {item.costCenterName && ` • ${item.costCenterName}`}
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="font-semibold text-slate-900">{formatCurrency(item.netAmount)}</p>
                    <p className={`text-xs ${isOverdue(item.dueDate, item.status) ? 'text-red-600' : 'text-slate-500'}`}>
                      Venc: {formatDate(item.dueDate)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'pending' && (
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                        title="Aprovar"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {item.status === 'approved' && (
                      <button
                        onClick={() => handlePay(item.id)}
                        className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"
                        title="Pagar"
                      >
                        <DollarSign size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por descrição ou documento..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="paid">Pago</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select
            value={costCenterFilter}
            onChange={(e) => { setCostCenterFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os centros de custo</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>{cc.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${
              showFilters ? 'border-blue-500 text-blue-600' : 'border-slate-200 text-slate-600'
            }`}
          >
            <Filter size={16} />
            Mais Filtros
            {showFilters ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          <button
            onClick={() => { loadData(); loadDailyQueue(); loadOverdue(); }}
            className="p-2 text-slate-400 hover:text-slate-600"
            title="Atualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Vencimento De</label>
              <input
                type="date"
                value={dueDateFrom}
                onChange={(e) => { setDueDateFrom(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Vencimento Até</label>
              <input
                type="date"
                value={dueDateTo}
                onChange={(e) => { setDueDateTo(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setCostCenterFilter('');
                setDueDateFrom('');
                setDueDateTo('');
                setPage(1);
              }}
              className="self-end px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando...</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium">Fornecedor</th>
                  <th className="text-left px-4 py-3 font-medium">Centro de Custo</th>
                  <th className="text-right px-4 py-3 font-medium">Valor Bruto</th>
                  <th className="text-right px-4 py-3 font-medium">Valor Líquido</th>
                  <th className="text-left px-4 py-3 font-medium">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  const overdue = isOverdue(item.dueDate, item.status);
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{item.description}</p>
                        {item.documentNumber && (
                          <p className="text-xs text-slate-500">Doc: {item.documentNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.supplierName || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{item.costCenterName || '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.grossAmount)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(item.netAmount)}</td>
                      <td className={`px-4 py-3 ${overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {formatDate(item.dueDate)}
                        {overdue && <span className="ml-1 text-xs">(Atrasado)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
                          <statusCfg.icon size={12} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetail(item.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver detalhes"
                          >
                            <Eye size={16} />
                          </button>
                          
                          {item.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(item.id)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Aprovar"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={() => handleCancel(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Cancelar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                          
                          {item.status === 'approved' && (
                            <button
                              onClick={() => handlePay(item.id)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Registrar pagamento"
                            >
                              <DollarSign size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma conta encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {total > 20 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Mostrando {((page - 1) * 20) + 1} a {Math.min(page * 20, total)} de {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * 20 >= total}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAccountPayableModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
            loadDailyQueue();
          }}
          costCenters={costCenters}
          chartAccounts={chartAccounts}
          bankAccounts={bankAccounts}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <AccountPayableDetailModal
          item={selectedItem}
          onClose={() => { setShowDetailModal(false); setSelectedItem(null); }}
          onApprove={() => { handleApprove(selectedItem.id); setShowDetailModal(false); }}
          onPay={() => { handlePay(selectedItem.id); setShowDetailModal(false); }}
        />
      )}
    </div>
  );
}

// Create Modal Component
function CreateAccountPayableModal({ 
  onClose, 
  onSuccess, 
  costCenters, 
  chartAccounts,
  bankAccounts,
}: { 
  onClose: () => void; 
  onSuccess: () => void;
  costCenters: CostCenter[];
  chartAccounts: ChartAccount[];
  bankAccounts: BankAccount[];
}) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  
  const [form, setForm] = useState({
    description: '',
    grossAmount: '',
    dueDate: '',
    supplierId: '',
    costCenterId: '',
    chartAccountId: '',
    bankAccountId: '',
    documentNumber: '',
    documentType: 'NF',
    paymentMethod: 'pix',
    notes: '',
    barcode: '',
    pixCode: '',
  });

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await api.getSuppliers(supplierSearch);
        setSuppliers(data.items);
      } catch (err) {
        console.error(err);
      }
    };
    loadSuppliers();
  }, [supplierSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.grossAmount || !form.dueDate) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await api.createAccountPayable({
        ...form,
        grossAmount: Math.round(parseFloat(form.grossAmount) * 100),
      });
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-slate-900">Nova Conta a Pagar</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição *</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Aluguel Janeiro/2026"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Bruto (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.grossAmount}
                onChange={(e) => setForm({ ...form, grossAmount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Vencimento *</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
              <select
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.legalName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Centro de Custo</label>
              <select
                value={form.costCenterId}
                onChange={(e) => setForm({ ...form, costCenterId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>{cc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria Contábil</label>
              <select
                value={form.chartAccountId}
                onChange={(e) => setForm({ ...form, chartAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {chartAccounts.map((ca) => (
                  <option key={ca.id} value={ca.id}>{ca.code} - {ca.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária</label>
              <select
                value={form.bankAccountId}
                onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>{ba.nickname} - {ba.bankName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nº Documento</label>
              <input
                type="text"
                value={form.documentNumber}
                onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: NF-12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Documento</label>
              <select
                value={form.documentType}
                onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="NF">Nota Fiscal</option>
                <option value="BOLETO">Boleto</option>
                <option value="FATURA">Fatura</option>
                <option value="RECIBO">Recibo</option>
                <option value="CONTRATO">Contrato</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pix">PIX</option>
                <option value="ted">TED</option>
                <option value="boleto">Boleto</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="debito_automatico">Débito Automático</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Código PIX / Código de Barras</label>
              <input
                type="text"
                value={form.pixCode || form.barcode}
                onChange={(e) => setForm({ ...form, pixCode: e.target.value, barcode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cole aqui o código PIX ou código de barras"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Observações adicionais..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Detail Modal Component
function AccountPayableDetailModal({ 
  item, 
  onClose, 
  onApprove,
  onPay,
}: { 
  item: any; 
  onClose: () => void;
  onApprove: () => void;
  onPay: () => void;
}) {
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Detalhes da Conta</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
              <statusCfg.icon size={12} />
              {statusCfg.label}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Main Info */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2">Informações Principais</h4>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-xs text-slate-400">Descrição</p>
                <p className="font-medium text-slate-900">{item.description}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Fornecedor</p>
                <p className="text-slate-900">{item.supplierName || '-'}</p>
                {item.supplierCnpj && <p className="text-xs text-slate-500">CNPJ: {item.supplierCnpj}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-400">Documento</p>
                <p className="text-slate-900">{item.documentNumber || '-'}</p>
                <p className="text-xs text-slate-500">{item.documentType || '-'}</p>
              </div>
            </div>
          </div>

          {/* Financial Info */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2">Valores</h4>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-400">Valor Bruto</p>
                <p className="text-lg font-semibold text-slate-900">{formatCurrency(item.grossAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Retenções</p>
                <p className="text-sm text-red-600">
                  {formatCurrency(
                    (item.inssRetention || 0) + 
                    (item.irpjRetention || 0) + 
                    (item.csllRetention || 0) +
                    (item.cofinsRetention || 0) +
                    (item.pisRetention || 0) +
                    (item.issRetention || 0)
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Valor Líquido</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(item.netAmount)}</p>
              </div>
            </div>
          </div>

          {/* Tax Retentions */}
          {(item.inssRetention > 0 || item.irpjRetention > 0 || item.issRetention > 0) && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Retenções de Impostos</h4>
              <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-3 gap-3 text-sm">
                {item.inssRetention > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">INSS</p>
                    <p className="text-slate-900">{formatCurrency(item.inssRetention)}</p>
                  </div>
                )}
                {item.irpjRetention > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">IRPJ</p>
                    <p className="text-slate-900">{formatCurrency(item.irpjRetention)}</p>
                  </div>
                )}
                {item.csllRetention > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">CSLL</p>
                    <p className="text-slate-900">{formatCurrency(item.csllRetention)}</p>
                  </div>
                )}
                {item.cofinsRetention > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">COFINS</p>
                    <p className="text-slate-900">{formatCurrency(item.cofinsRetention)}</p>
                  </div>
                )}
                {item.pisRetention > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">PIS</p>
                    <p className="text-slate-900">{formatCurrency(item.pisRetention)}</p>
                  </div>
                )}
                {item.issRetention > 0 && (
                  <div>
                    <p className="text-xs text-slate-400">ISS</p>
                    <p className="text-slate-900">{formatCurrency(item.issRetention)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Classification */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2">Classificação</h4>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">Centro de Custo</p>
                <p className="text-slate-900">{item.costCenterName || '-'}</p>
                {item.costCenterCode && <p className="text-xs text-slate-500">Cód: {item.costCenterCode}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-400">Categoria Contábil</p>
                <p className="text-slate-900">{item.chartAccountName || '-'}</p>
                {item.chartAccountCode && <p className="text-xs text-slate-500">Cód: {item.chartAccountCode}</p>}
              </div>
            </div>
          </div>

          {/* Dates & Payment */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2">Datas e Pagamento</h4>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-400">Emissão</p>
                <p className="text-slate-900">{formatDate(item.issueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Vencimento</p>
                <p className={`font-medium ${isOverdue(item.dueDate, item.status) ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatDate(item.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Pagamento</p>
                <p className="text-slate-900">{formatDate(item.paymentDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Forma de Pagamento</p>
                <p className="text-slate-900">{item.paymentMethod || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Conta Bancária</p>
                <p className="text-slate-900">{item.bankAccountNickname || '-'}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {item.notes && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Observações</h4>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.notes}</p>
              </div>
            </div>
          )}

          {/* Payment Codes */}
          {(item.pixCode || item.barcode) && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Códigos de Pagamento</h4>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                {item.pixCode && (
                  <div>
                    <p className="text-xs text-slate-400">Código PIX</p>
                    <p className="text-xs font-mono text-slate-900 break-all">{item.pixCode}</p>
                  </div>
                )}
                {item.barcode && (
                  <div>
                    <p className="text-xs text-slate-400">Código de Barras</p>
                    <p className="text-xs font-mono text-slate-900 break-all">{item.barcode}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Approval History */}
          {item.approvals && item.approvals.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Histórico de Aprovações</h4>
              <div className="space-y-2">
                {item.approvals.map((approval: any) => (
                  <div key={approval.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-900">
                        {approval.status === 'approved' ? 'Aprovado' : 
                         approval.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                      </p>
                      {approval.notes && <p className="text-xs text-slate-500">{approval.notes}</p>}
                      {approval.rejectionReason && <p className="text-xs text-red-500">{approval.rejectionReason}</p>}
                    </div>
                    <p className="text-xs text-slate-400">{formatDate(approval.approvedAt || approval.requestedAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Fechar
          </button>
          {item.status === 'pending' && (
            <button
              onClick={onApprove}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Aprovar
            </button>
          )}
          {item.status === 'approved' && (
            <button
              onClick={onPay}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <DollarSign size={16} />
              Pagar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
