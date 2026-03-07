import React, { useEffect, useState, useCallback } from 'react';
import { 
  Search, Plus, Filter, CheckCircle, XCircle, Clock, DollarSign, 
  AlertTriangle, ChevronDown, ChevronRight, Eye, Edit, Trash2, 
  Calendar, Building2, FileText, CreditCard, BarChart3, RefreshCw,
  Users, TrendingUp, PieChart
} from 'lucide-react';
import { api } from '../services/api';

interface AccountReceivable {
  id: string;
  patientName: string | null;
  doctorName: string | null;
  insuranceName: string | null;
  serviceType: string;
  procedureDescription: string | null;
  guideNumber: string | null;
  totalAmount: number;
  receivedAmount: number;
  glosaAmount: number;
  serviceDate: string;
  dueDate: string;
  status: string;
  paymentType: string;
  balance: number;
}

interface Summary {
  totalAmountCents: number;
  receivedAmountCents: number;
  glosaAmountCents: number;
  balanceCents: number;
}

interface InsuranceProvider {
  id: string;
  code: string | null;
  name: string;
  ansCode: string | null;
}

interface CostCenter {
  id: string;
  code: string;
  name: string;
}

interface AgingBucket {
  range: string;
  count: number;
  totalCents: number;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700', icon: Clock },
  partial: { label: 'Parcial', className: 'bg-blue-100 text-blue-700', icon: TrendingUp },
  received: { label: 'Recebido', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  glosa: { label: 'Glosado', className: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500', icon: XCircle },
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  particular: 'Particular',
  insurance: 'Convênio',
  sus: 'SUS',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  consultation: 'Consulta',
  exam: 'Exame',
  procedure: 'Procedimento',
  surgery: 'Cirurgia',
  hospitalization: 'Internação',
  other: 'Outros',
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
  if (status === 'received' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

export default function AccountsReceivable() {
  const [items, setItems] = useState<AccountReceivable[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('');
  const [insuranceFilter, setInsuranceFilter] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Auxiliary data
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  
  // Reports
  const [agingData, setAgingData] = useState<AgingBucket[] | null>(null);
  const [showAgingReport, setShowAgingReport] = useState(false);
  const [overdueData, setOverdueData] = useState<{ items: any[]; totalOverdueCents: number; overdueCount: number } | null>(null);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: page.toString(), limit: '20' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (paymentTypeFilter) params.paymentType = paymentTypeFilter;
      if (insuranceFilter) params.insuranceProviderId = insuranceFilter;
      if (dueDateFrom) params.dueDateFrom = dueDateFrom;
      if (dueDateTo) params.dueDateTo = dueDateTo;
      
      const data = await api.getAccountsReceivable(params);
      setItems(data.items);
      setTotal(data.total);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error loading accounts receivable:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, paymentTypeFilter, insuranceFilter, dueDateFrom, dueDateTo]);

  const loadAuxiliaryData = useCallback(async () => {
    try {
      const [ip, cc] = await Promise.all([
        api.getInsuranceProviders(),
        api.getCostCenters(),
      ]);
      setInsuranceProviders(ip.items);
      setCostCenters(cc.items);
    } catch (err) {
      console.error('Error loading auxiliary data:', err);
    }
  }, []);

  const loadAging = useCallback(async () => {
    try {
      const data = await api.getReceivablesAging();
      setAgingData(data.buckets || []);
    } catch (err) {
      console.error('Error loading aging:', err);
    }
  }, []);

  const loadOverdue = useCallback(async () => {
    try {
      const data = await api.getOverdueReceivables();
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
    loadAging();
    loadOverdue();
  }, [loadAuxiliaryData, loadAging, loadOverdue]);

  const handleReceive = async (id: string, amount: number, paymentMethod: string) => {
    try {
      await api.receivePayment(id, { amount, paymentMethod });
      loadData();
      loadAging();
      loadOverdue();
      setShowReceiveModal(false);
      setSelectedItem(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar esta conta a receber?')) return;
    try {
      await api.cancelAccountReceivable(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const data = await api.getAccountReceivable(id);
      setSelectedItem(data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Error loading detail:', err);
    }
  };

  const openReceiveModal = async (id: string) => {
    try {
      const data = await api.getAccountReceivable(id);
      setSelectedItem(data);
      setShowReceiveModal(true);
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
          <h2 className="text-xl font-bold text-slate-900">Contas a Receber</h2>
          <p className="text-sm text-slate-500">Gerencie receitas e recebimentos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAgingReport(!showAgingReport)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAgingReport 
                ? 'bg-purple-600 text-white' 
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            }`}
          >
            <PieChart size={16} />
            Aging Report
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
          icon={TrendingUp} 
          label="Total a Receber" 
          value={formatCurrency(summary?.totalAmountCents || 0)}
          subvalue={`${total} itens`}
          color="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          icon={CheckCircle} 
          label="Recebido" 
          value={formatCurrency(summary?.receivedAmountCents || 0)}
          color="bg-emerald-50 text-emerald-600" 
        />
        <StatCard 
          icon={AlertTriangle} 
          label="Glosa" 
          value={formatCurrency(summary?.glosaAmountCents || 0)}
          color="bg-orange-50 text-orange-600" 
        />
        <StatCard 
          icon={DollarSign} 
          label="Saldo em Aberto" 
          value={formatCurrency(summary?.balanceCents || 0)}
          subvalue={overdueData ? `${overdueData.overdueCount} em atraso` : ''}
          color="bg-slate-50 text-slate-600" 
        />
      </div>

      {/* Aging Report Panel */}
      {showAgingReport && agingData && (
        <div className="bg-purple-50 rounded-xl p-4 mb-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-purple-900">Aging Report - Análise de Vencimentos</h3>
            <button onClick={() => setShowAgingReport(false)} className="text-purple-600 hover:text-purple-800">
              <XCircle size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {agingData.map((bucket, index) => {
              const colors = [
                'bg-emerald-100 border-emerald-300 text-emerald-800',
                'bg-yellow-100 border-yellow-300 text-yellow-800',
                'bg-orange-100 border-orange-300 text-orange-800',
                'bg-red-100 border-red-300 text-red-800',
              ];
              return (
                <div key={bucket.range} className={`${colors[index] || colors[3]} rounded-lg p-4 border`}>
                  <p className="text-sm font-medium">{bucket.range}</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(bucket.totalCents)}</p>
                  <p className="text-xs mt-1">{bucket.count} títulos</p>
                </div>
              );
            })}
          </div>
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
                placeholder="Buscar por guia ou procedimento..."
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
            <option value="partial">Parcial</option>
            <option value="received">Recebido</option>
            <option value="glosa">Glosado</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select
            value={paymentTypeFilter}
            onChange={(e) => { setPaymentTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os tipos</option>
            <option value="particular">Particular</option>
            <option value="insurance">Convênio</option>
            <option value="sus">SUS</option>
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
            onClick={() => { loadData(); loadAging(); loadOverdue(); }}
            className="p-2 text-slate-400 hover:text-slate-600"
            title="Atualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Convênio</label>
              <select
                value={insuranceFilter}
                onChange={(e) => { setInsuranceFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {insuranceProviders.map((ip) => (
                  <option key={ip.id} value={ip.id}>{ip.name}</option>
                ))}
              </select>
            </div>
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
                setPaymentTypeFilter('');
                setInsuranceFilter('');
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
                  <th className="text-left px-4 py-3 font-medium">Paciente / Serviço</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Convênio</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Recebido</th>
                  <th className="text-right px-4 py-3 font-medium">Saldo</th>
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
                        <p className="font-medium text-slate-900">{item.patientName || 'Paciente não informado'}</p>
                        <p className="text-xs text-slate-500">
                          {SERVICE_TYPE_LABELS[item.serviceType] || item.serviceType}
                          {item.procedureDescription && ` - ${item.procedureDescription}`}
                        </p>
                        {item.guideNumber && (
                          <p className="text-xs text-slate-400">Guia: {item.guideNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.paymentType === 'particular' ? 'bg-blue-100 text-blue-700' :
                          item.paymentType === 'insurance' ? 'bg-purple-100 text-purple-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {PAYMENT_TYPE_LABELS[item.paymentType] || item.paymentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.insuranceName || '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(item.receivedAmount)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(item.balance)}
                        {item.glosaAmount > 0 && (
                          <p className="text-xs text-orange-600">Glosa: {formatCurrency(item.glosaAmount)}</p>
                        )}
                      </td>
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
                          
                          {(item.status === 'pending' || item.status === 'partial') && item.balance > 0 && (
                            <button
                              onClick={() => openReceiveModal(item.id)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Registrar recebimento"
                            >
                              <DollarSign size={16} />
                            </button>
                          )}
                          
                          {item.status === 'pending' && item.receivedAmount === 0 && (
                            <button
                              onClick={() => handleCancel(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Cancelar"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
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
        <CreateAccountReceivableModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
          }}
          insuranceProviders={insuranceProviders}
          costCenters={costCenters}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <AccountReceivableDetailModal
          item={selectedItem}
          onClose={() => { setShowDetailModal(false); setSelectedItem(null); }}
          onReceive={() => {
            setShowDetailModal(false);
            setShowReceiveModal(true);
          }}
        />
      )}

      {/* Receive Payment Modal */}
      {showReceiveModal && selectedItem && (
        <ReceivePaymentModal
          item={selectedItem}
          onClose={() => { setShowReceiveModal(false); setSelectedItem(null); }}
          onReceive={handleReceive}
        />
      )}
    </div>
  );
}

// Create Modal Component
function CreateAccountReceivableModal({ 
  onClose, 
  onSuccess, 
  insuranceProviders,
  costCenters,
}: { 
  onClose: () => void; 
  onSuccess: () => void;
  insuranceProviders: InsuranceProvider[];
  costCenters: CostCenter[];
}) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  
  const [form, setForm] = useState({
    patientId: '',
    serviceType: 'consultation',
    procedureCode: '',
    procedureDescription: '',
    guideNumber: '',
    authorizationNumber: '',
    totalAmount: '',
    serviceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    paymentType: 'particular',
    insuranceProviderId: '',
    costCenterId: '',
    notes: '',
    installments: '1',
  });

  useEffect(() => {
    const loadPatients = async () => {
      if (patientSearch.length < 2) return;
      try {
        const data = await api.searchPatients(patientSearch);
        setPatients(data);
      } catch (err) {
        console.error(err);
      }
    };
    const timeout = setTimeout(loadPatients, 300);
    return () => clearTimeout(timeout);
  }, [patientSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.totalAmount || !form.dueDate || !form.serviceType) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await api.createAccountReceivable({
        ...form,
        totalAmount: Math.round(parseFloat(form.totalAmount) * 100),
        installments: parseInt(form.installments) || 1,
        insuranceProviderId: form.paymentType === 'insurance' ? form.insuranceProviderId : undefined,
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
          <h3 className="text-lg font-semibold text-slate-900">Nova Conta a Receber</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Paciente</label>
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {patients.length > 0 && patientSearch.length >= 2 && (
                <div className="mt-1 border rounded-lg max-h-32 overflow-y-auto">
                  {patients.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, patientId: p.id });
                        setPatientSearch(p.name);
                        setPatients([]);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {p.name} {p.phone && `- ${p.phone}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Serviço *</label>
              <select
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="consultation">Consulta</option>
                <option value="exam">Exame</option>
                <option value="procedure">Procedimento</option>
                <option value="surgery">Cirurgia</option>
                <option value="hospitalization">Internação</option>
                <option value="other">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento *</label>
              <select
                value={form.paymentType}
                onChange={(e) => setForm({ ...form, paymentType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="particular">Particular</option>
                <option value="insurance">Convênio</option>
                <option value="sus">SUS</option>
              </select>
            </div>

            {form.paymentType === 'insurance' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Convênio</label>
                <select
                  value={form.insuranceProviderId}
                  onChange={(e) => setForm({ ...form, insuranceProviderId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {insuranceProviders.map((ip) => (
                    <option key={ip.id} value={ip.id}>{ip.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Parcelas</label>
              <select
                value={form.installments}
                onChange={(e) => setForm({ ...form, installments: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data do Serviço *</label>
              <input
                type="date"
                value={form.serviceDate}
                onChange={(e) => setForm({ ...form, serviceDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Nº Guia</label>
              <input
                type="text"
                value={form.guideNumber}
                onChange={(e) => setForm({ ...form, guideNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nº Autorização</label>
              <input
                type="text"
                value={form.authorizationNumber}
                onChange={(e) => setForm({ ...form, authorizationNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Procedimento</label>
              <input
                type="text"
                value={form.procedureDescription}
                onChange={(e) => setForm({ ...form, procedureDescription: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Consulta Cardiologia"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
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
function AccountReceivableDetailModal({ 
  item, 
  onClose, 
  onReceive,
}: { 
  item: any; 
  onClose: () => void;
  onReceive: () => void;
}) {
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const balance = item.totalAmount - item.receivedAmount - item.glosaAmount;

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
            <h4 className="text-sm font-medium text-slate-500 mb-2">Informações do Atendimento</h4>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">Paciente</p>
                <p className="font-medium text-slate-900">{item.patientName || 'Não informado'}</p>
                {item.patientPhone && <p className="text-xs text-slate-500">{item.patientPhone}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-400">Médico</p>
                <p className="text-slate-900">{item.doctorName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tipo de Serviço</p>
                <p className="text-slate-900">{SERVICE_TYPE_LABELS[item.serviceType] || item.serviceType}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Forma de Pagamento</p>
                <p className="text-slate-900">{PAYMENT_TYPE_LABELS[item.paymentType] || item.paymentType}</p>
              </div>
              {item.procedureDescription && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">Procedimento</p>
                  <p className="text-slate-900">{item.procedureDescription}</p>
                  {item.procedureCode && <p className="text-xs text-slate-500">Código: {item.procedureCode}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Insurance Info */}
          {item.paymentType === 'insurance' && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Informações do Convênio</h4>
              <div className="bg-purple-50 rounded-lg p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-purple-600">Convênio</p>
                  <p className="font-medium text-purple-900">{item.insuranceName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-600">Nº Guia</p>
                  <p className="text-purple-900">{item.guideNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-600">Nº Autorização</p>
                  <p className="text-purple-900">{item.authorizationNumber || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Financial Info */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2">Valores</h4>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-lg font-semibold text-slate-900">{formatCurrency(item.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Recebido</p>
                <p className="text-lg font-semibold text-emerald-600">{formatCurrency(item.receivedAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Glosa</p>
                <p className="text-lg font-semibold text-orange-600">{formatCurrency(item.glosaAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Saldo</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(balance)}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div>
            <h4 className="text-sm font-medium text-slate-500 mb-2">Datas</h4>
            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-400">Data do Serviço</p>
                <p className="text-slate-900">{formatDate(item.serviceDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Vencimento</p>
                <p className={`font-medium ${isOverdue(item.dueDate, item.status) ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatDate(item.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Recebimento</p>
                <p className="text-slate-900">{formatDate(item.receivedDate)}</p>
              </div>
            </div>
          </div>

          {/* Installments */}
          {item.installments && item.installments.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Parcelas</h4>
              <div className="space-y-2">
                {item.installments.map((inst: any) => (
                  <div key={inst.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Parcela {inst.installmentNumber}</p>
                      <p className="text-xs text-slate-500">Vence: {formatDate(inst.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-900">{formatCurrency(inst.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        inst.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        inst.status === 'partial' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {inst.status === 'paid' ? 'Pago' : inst.status === 'partial' ? 'Parcial' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments History */}
          {item.payments && item.payments.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Histórico de Recebimentos</h4>
              <div className="space-y-2">
                {item.payments.map((payment: any) => (
                  <div key={payment.id} className="bg-emerald-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-900">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-emerald-600">
                        {payment.paymentMethod} {payment.bankAccountNickname && `- ${payment.bankAccountNickname}`}
                      </p>
                    </div>
                    <p className="text-xs text-emerald-600">{formatDate(payment.paymentDate)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Observações</h4>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.notes}</p>
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
          {(item.status === 'pending' || item.status === 'partial') && balance > 0 && (
            <button
              onClick={onReceive}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <DollarSign size={16} />
              Registrar Recebimento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Receive Payment Modal
function ReceivePaymentModal({
  item,
  onClose,
  onReceive,
}: {
  item: any;
  onClose: () => void;
  onReceive: (id: string, amount: number, paymentMethod: string) => void;
}) {
  const balance = item.totalAmount - item.receivedAmount - item.glosaAmount;
  const [amount, setAmount] = useState((balance / 100).toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (amountCents <= 0 || amountCents > balance) {
      alert('Valor inválido');
      return;
    }
    setLoading(true);
    await onReceive(item.id, amountCents, paymentMethod);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-slate-900">Registrar Recebimento</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500">Paciente</p>
            <p className="font-medium text-slate-900">{item.patientName || 'Não informado'}</p>
            <div className="flex justify-between mt-3">
              <div>
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-slate-900">{formatCurrency(item.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Recebido</p>
                <p className="text-emerald-600">{formatCurrency(item.receivedAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Saldo</p>
                <p className="font-bold text-blue-600">{formatCurrency(balance)}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor a Receber (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={(balance / 100).toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pix">PIX</option>
              <option value="ted">TED</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="boleto">Boleto</option>
              <option value="deposito">Depósito</option>
            </select>
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
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              <DollarSign size={16} />
              {loading ? 'Salvando...' : 'Confirmar Recebimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
