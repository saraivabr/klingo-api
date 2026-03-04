import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Loader2, ChevronRight, AlertTriangle, Download,
  FileText, Beaker, Clock, CheckCircle, Package,
} from 'lucide-react';
import { api } from '../services/api';
import TestOrderForm from '../components/lab/TestOrderForm';
import ResultsEntry from '../components/lab/ResultsEntry';

/* ────── Types ────────────────────────────────── */

interface LabOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  orderedAt: string;
  patientName?: string;
  patientId: string;
  doctorId?: string;
}

interface LabOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  orderedAt: string;
  patientId: string;
  doctorId?: string;
  items: Array<{
    id: string;
    labTestId: string;
    status: string;
    sampleCollectedAt?: string;
    resultEnteredAt?: string;
    test?: { name: string; shortName?: string };
    results: Array<{
      id: string;
      parameterId: string;
      value: string;
      isAbnormal: boolean;
      parameter?: { parameterName: string; unit: string };
    }>;
  }>;
}

/* ────── Helpers ────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; bg: string; dot: string; icon: any }> = {
  ordered: {
    label: 'Solicitado',
    bg: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    icon: FileText,
  },
  collected: {
    label: 'Coletado',
    bg: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    icon: Package,
  },
  processing: {
    label: 'Processando',
    bg: 'bg-purple-50 text-purple-700',
    dot: 'bg-purple-500',
    icon: Clock,
  },
  completed: {
    label: 'Concluído',
    bg: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelado',
    bg: 'bg-slate-100 text-slate-500',
    dot: 'bg-slate-400',
    icon: AlertTriangle,
  },
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR');
}

/* ────── Components ────────────────────────────── */

export default function LabTests() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<LabOrderDetail | null>(null);
  const [showResultsEntry, setShowResultsEntry] = useState(false);

  const loadOrders = useCallback(() => {
    setLoading(true);
    api.labGetOrders({ status: filter, search })
      .then((data) => setOrders(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleOrderClick = async (orderId: string) => {
    try {
      const detail = await api.labGetOrder(orderId);
      setSelectedOrder(detail);
    } catch (err) {
      console.error('Failed to load order:', err);
    }
  };

  const handleNewOrderSuccess = () => {
    setShowNewOrderForm(false);
    loadOrders();
  };

  const filters = [
    { key: 'all', label: 'Todos', count: orders.length },
    { key: 'ordered', label: 'Solicitados' },
    { key: 'collected', label: 'Coletados' },
    { key: 'processing', label: 'Processando' },
    { key: 'completed', label: 'Concluídos' },
  ];

  // Quick stats
  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const pendingCount = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;

  return (
    <div className="px-8 py-7 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Exames Laboratoriais</h2>
          <p className="text-sm text-slate-500 mt-1">Gerenciamento de pedidos e resultados</p>
        </div>
        <button
          onClick={() => setShowNewOrderForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Novo Pedido
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Total de Pedidos</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{orders.length}</p>
            </div>
            <Beaker className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Pendentes</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
            </div>
            <Clock className="text-amber-500" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Concluídos</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
            </div>
            <CheckCircle className="text-emerald-500" size={32} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
            {f.count !== undefined && <span className="ml-2">({f.count})</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por número do pedido ou paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <Beaker className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="text-slate-600 font-medium">Nenhum pedido encontrado</p>
            <p className="text-sm text-slate-500 mt-1">Crie um novo pedido para começar</p>
          </div>
        ) : (
          orders.map((order) => {
            const config = STATUS_CONFIG[order.status];
            const StatusIcon = config?.icon;
            return (
              <div
                key={order.id}
                onClick={() => handleOrderClick(order.id)}
                className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${config?.bg || 'bg-slate-100'}`}>
                      {StatusIcon && <StatusIcon size={20} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${config?.bg}`}>
                          {config?.label}
                        </span>
                        {order.priority === 'urgent' && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                            URGENTE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">Solicitado em {fmtDate(order.orderedAt)}</p>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-400" size={20} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onRefresh={loadOrders}
          onShowResults={() => setShowResultsEntry(true)}
        />
      )}

      {/* New Order Form Modal */}
      {showNewOrderForm && (
        <TestOrderForm onClose={() => setShowNewOrderForm(false)} onSuccess={handleNewOrderSuccess} />
      )}

      {/* Results Entry Modal */}
      {showResultsEntry && selectedOrder && (
        <ResultsEntry
          order={selectedOrder}
          onClose={() => setShowResultsEntry(false)}
          onSuccess={() => {
            setShowResultsEntry(false);
            loadOrders();
          }}
        />
      )}
    </div>
  );
}

/* ────── Order Detail Modal ────────────────────── */

function OrderDetailModal({
  order,
  onClose,
  onRefresh,
  onShowResults,
}: {
  order: LabOrderDetail;
  onClose: () => void;
  onRefresh: () => void;
  onShowResults: () => void;
}) {
  const [isCollecting, setIsCollecting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleCollectSample = async () => {
    setIsCollecting(true);
    try {
      const itemIds = order.items.map((i) => i.id);
      await api.labCollectSample(order.id, { itemIds });
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to collect sample:', err);
    } finally {
      setIsCollecting(false);
    }
  };

  const handleCompleteOrder = async () => {
    setIsCompleting(true);
    try {
      await api.labCompleteOrder(order.id);
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to complete order:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      const { pdfUrl } = await api.labGetReport(order.id);
      window.open(pdfUrl, '_blank');
    } catch (err) {
      console.error('Failed to generate report:', err);
    }
  };

  const config = STATUS_CONFIG[order.status];
  const allCollected = order.items.every((i) => i.sampleCollectedAt);
  const allResultsEntered = order.items.every((i) => i.resultEnteredAt);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{order.orderNumber}</h3>
              <p className="text-sm text-slate-500 mt-1">
                Solicitado em {fmtDate(order.orderedAt)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="text-sm font-semibold text-slate-600">Status</label>
            <div className={`mt-2 px-3 py-2 rounded-lg w-fit ${config?.bg}`}>
              {config?.label}
            </div>
          </div>

          {/* Items */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Exames</h4>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{item.test?.name}</p>
                      <p className="text-xs text-slate-500 mt-1">Status: {item.status}</p>
                      {item.sampleCollectedAt && (
                        <p className="text-xs text-emerald-600 mt-1">
                          ✓ Coletado em {fmtDate(item.sampleCollectedAt)}
                        </p>
                      )}
                      {item.resultEnteredAt && (
                        <p className="text-xs text-blue-600 mt-1">
                          ✓ Resultados inseridos em {fmtDate(item.resultEnteredAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Results */}
                  {item.results.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      {item.results.map((result) => (
                        <div key={result.id} className="text-sm flex justify-between py-1">
                          <span className="text-slate-600">
                            {result.parameter?.parameterName}: {result.value}{' '}
                            {result.parameter?.unit}
                          </span>
                          {result.isAbnormal && (
                            <span className="text-red-600 font-medium">⚠️ Anormal</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
          >
            Fechar
          </button>

          {!allCollected && (
            <button
              onClick={handleCollectSample}
              disabled={isCollecting}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {isCollecting ? 'Processando...' : 'Coletar Amostra'}
            </button>
          )}

          {allCollected && !allResultsEntered && (
            <button
              onClick={onShowResults}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Inserir Resultados
            </button>
          )}

          {allResultsEntered && order.status !== 'completed' && (
            <button
              onClick={handleCompleteOrder}
              disabled={isCompleting}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {isCompleting ? 'Finalizando...' : 'Finalizar Pedido'}
            </button>
          )}

          {order.status === 'completed' && (
            <button
              onClick={handleDownloadReport}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 inline-flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Baixar Relatório
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
