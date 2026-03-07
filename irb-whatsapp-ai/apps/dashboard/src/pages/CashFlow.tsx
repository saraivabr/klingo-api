import React, { useEffect, useState, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Building2, Calendar, 
  BarChart3, PieChart, RefreshCw, ChevronLeft, ChevronRight,
  ArrowUpCircle, ArrowDownCircle, Wallet, FileText, XCircle
} from 'lucide-react';
import { api } from '../services/api';

interface DailyPosition {
  date: string;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  details?: {
    credits: Array<{ description: string; amount: number }>;
    debits: Array<{ description: string; amount: number }>;
  };
}

interface BankAccount {
  id: string;
  nickname: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
}

interface MonthlyFlow {
  month: string;
  year: number;
  openingBalance: number;
  totalRevenue: number;
  totalExpenses: number;
  closingBalance: number;
  revenueByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

interface DRE {
  period: string;
  revenue: {
    particular: number;
    insurance: number;
    sus: number;
    total: number;
  };
  deductions: number;
  netRevenue: number;
  operationalExpenses: Record<string, number>;
  totalOperationalExpenses: number;
  operationalResult: number;
  financialExpenses: number;
  financialRevenue: number;
  netResult: number;
}

interface CostCenter {
  id: string;
  code: string;
  name: string;
}

function formatCurrency(cents: number): string {
  const isNegative = cents < 0;
  const absValue = Math.abs(cents);
  const formatted = `R$ ${(absValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  return isNegative ? `-${formatted}` : formatted;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function CashFlow() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'projection' | 'dre' | 'banks'>('daily');
  
  // Daily view state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyPosition, setDailyPosition] = useState<DailyPosition | null>(null);
  
  // Monthly view state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyFlow, setMonthlyFlow] = useState<MonthlyFlow | null>(null);
  
  // Projection state
  const [projectionDays, setProjectionDays] = useState(30);
  const [projection, setProjection] = useState<any>(null);
  
  // DRE state
  const [dre, setDRE] = useState<DRE | null>(null);
  
  // Bank position state
  const [bankPosition, setBankPosition] = useState<{ accounts: BankAccount[]; totalBalance: number } | null>(null);
  
  // Summary
  const [summary, setSummary] = useState<any>(null);
  
  // Cost centers
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [selectedCostCenter, setSelectedCostCenter] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.getCashFlowSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  }, []);

  const loadDailyPosition = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDailyCashFlow(selectedDate, selectedCostCenter || undefined);
      setDailyPosition(data);
    } catch (err) {
      console.error('Error loading daily position:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedCostCenter]);

  const loadMonthlyFlow = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMonthlyCashFlow(selectedYear, selectedMonth, selectedCostCenter || undefined);
      setMonthlyFlow(data);
    } catch (err) {
      console.error('Error loading monthly flow:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedCostCenter]);

  const loadProjection = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCashFlowProjection(projectionDays, selectedCostCenter || undefined);
      setProjection(data);
    } catch (err) {
      console.error('Error loading projection:', err);
    } finally {
      setLoading(false);
    }
  }, [projectionDays, selectedCostCenter]);

  const loadDRE = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDRE(selectedYear, selectedMonth);
      setDRE(data);
    } catch (err) {
      console.error('Error loading DRE:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const loadBankPosition = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBankPosition();
      setBankPosition(data);
    } catch (err) {
      console.error('Error loading bank position:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCostCenters = useCallback(async () => {
    try {
      const data = await api.getCostCenters();
      setCostCenters(data.items);
    } catch (err) {
      console.error('Error loading cost centers:', err);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadCostCenters();
  }, [loadSummary, loadCostCenters]);

  useEffect(() => {
    if (activeTab === 'daily') loadDailyPosition();
    else if (activeTab === 'monthly') loadMonthlyFlow();
    else if (activeTab === 'projection') loadProjection();
    else if (activeTab === 'dre') loadDRE();
    else if (activeTab === 'banks') loadBankPosition();
  }, [activeTab, loadDailyPosition, loadMonthlyFlow, loadProjection, loadDRE, loadBankPosition]);

  const goToPrevDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().slice(0, 10));
  };

  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const StatCard = ({ icon: Icon, label, value, trend, color }: { 
    icon: any; 
    label: string; 
    value: string; 
    trend?: 'up' | 'down' | 'neutral';
    color: string;
  }) => (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}><Icon size={20} /></div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${
        trend === 'up' ? 'text-emerald-600' : 
        trend === 'down' ? 'text-red-600' : 
        'text-slate-900'
      }`}>
        {value}
      </p>
    </div>
  );

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Fluxo de Caixa</h2>
          <p className="text-sm text-slate-500">Acompanhe entradas, saidas e projecoes</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCostCenter}
            onChange={(e) => setSelectedCostCenter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Centros de Custo</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>{cc.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (activeTab === 'daily') loadDailyPosition();
              else if (activeTab === 'monthly') loadMonthlyFlow();
              else if (activeTab === 'projection') loadProjection();
              else if (activeTab === 'dre') loadDRE();
              else if (activeTab === 'banks') loadBankPosition();
            }}
            className="p-2 text-slate-400 hover:text-slate-600"
            title="Atualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard 
            icon={Wallet} 
            label="Saldo Atual" 
            value={formatCurrency(summary.currentBalance || 0)}
            trend={summary.currentBalance >= 0 ? 'up' : 'down'}
            color="bg-blue-50 text-blue-600" 
          />
          <StatCard 
            icon={ArrowUpCircle} 
            label="Entradas Hoje" 
            value={formatCurrency(summary.todayCredits || 0)}
            trend="up"
            color="bg-emerald-50 text-emerald-600" 
          />
          <StatCard 
            icon={ArrowDownCircle} 
            label="Saidas Hoje" 
            value={formatCurrency(summary.todayDebits || 0)}
            trend="down"
            color="bg-red-50 text-red-600" 
          />
          <StatCard 
            icon={TrendingUp} 
            label="Projecao 30 dias" 
            value={formatCurrency(summary.projection30Days || 0)}
            trend={summary.projection30Days >= 0 ? 'up' : 'down'}
            color="bg-purple-50 text-purple-600" 
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {[
          { id: 'daily', label: 'Diario', icon: Calendar },
          { id: 'monthly', label: 'Mensal', icon: BarChart3 },
          { id: 'projection', label: 'Projecao', icon: TrendingUp },
          { id: 'dre', label: 'DRE', icon: FileText },
          { id: 'banks', label: 'Contas Bancarias', icon: Building2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-slate-400">
          Carregando...
        </div>
      ) : (
        <>
          {/* Daily View */}
          {activeTab === 'daily' && dailyPosition && (
            <div className="space-y-6">
              {/* Date Navigation */}
              <div className="flex items-center justify-center gap-4">
                <button onClick={goToPrevDay} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronLeft size={20} />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-lg font-medium"
                />
                <button onClick={goToNextDay} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Daily Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Saldo Inicial</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(dailyPosition.openingBalance)}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-sm text-emerald-600">Entradas</p>
                  <p className="text-xl font-bold text-emerald-700">{formatCurrency(dailyPosition.totalCredits)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-sm text-red-600">Saidas</p>
                  <p className="text-xl font-bold text-red-700">{formatCurrency(dailyPosition.totalDebits)}</p>
                </div>
                <div className={`${dailyPosition.closingBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-xl p-4`}>
                  <p className={`text-sm ${dailyPosition.closingBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo Final</p>
                  <p className={`text-xl font-bold ${dailyPosition.closingBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    {formatCurrency(dailyPosition.closingBalance)}
                  </p>
                </div>
              </div>

              {/* Daily Details */}
              {dailyPosition.details && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Credits */}
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <h4 className="font-semibold text-emerald-700 mb-4 flex items-center gap-2">
                      <ArrowUpCircle size={18} />
                      Entradas do Dia
                    </h4>
                    {dailyPosition.details.credits.length === 0 ? (
                      <p className="text-slate-400 text-sm">Nenhuma entrada</p>
                    ) : (
                      <div className="space-y-2">
                        {dailyPosition.details.credits.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                            <span className="text-sm text-slate-700">{item.description}</span>
                            <span className="font-medium text-emerald-600">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Debits */}
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <h4 className="font-semibold text-red-700 mb-4 flex items-center gap-2">
                      <ArrowDownCircle size={18} />
                      Saidas do Dia
                    </h4>
                    {dailyPosition.details.debits.length === 0 ? (
                      <p className="text-slate-400 text-sm">Nenhuma saida</p>
                    ) : (
                      <div className="space-y-2">
                        {dailyPosition.details.debits.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                            <span className="text-sm text-slate-700">{item.description}</span>
                            <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monthly View */}
          {activeTab === 'monthly' && monthlyFlow && (
            <div className="space-y-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-center gap-4">
                <button onClick={goToPrevMonth} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronLeft size={20} />
                </button>
                <div className="text-lg font-semibold text-slate-900 min-w-[200px] text-center">
                  {MONTH_NAMES[selectedMonth]} / {selectedYear}
                </div>
                <button onClick={goToNextMonth} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Monthly Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-500">Saldo Inicial</p>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(monthlyFlow.openingBalance)}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-sm text-emerald-600">Receitas</p>
                  <p className="text-xl font-bold text-emerald-700">{formatCurrency(monthlyFlow.totalRevenue)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-sm text-red-600">Despesas</p>
                  <p className="text-xl font-bold text-red-700">{formatCurrency(monthlyFlow.totalExpenses)}</p>
                </div>
                <div className={`${monthlyFlow.closingBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-xl p-4`}>
                  <p className={`text-sm ${monthlyFlow.closingBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo Final</p>
                  <p className={`text-xl font-bold ${monthlyFlow.closingBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    {formatCurrency(monthlyFlow.closingBalance)}
                  </p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Revenue by Category */}
                {monthlyFlow.revenueByCategory && Object.keys(monthlyFlow.revenueByCategory).length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <h4 className="font-semibold text-emerald-700 mb-4">Receitas por Categoria</h4>
                    <div className="space-y-3">
                      {Object.entries(monthlyFlow.revenueByCategory)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([category, amount]) => {
                          const percentage = (amount as number) / monthlyFlow.totalRevenue * 100;
                          return (
                            <div key={category}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-700">{category}</span>
                                <span className="font-medium text-emerald-600">{formatCurrency(amount as number)}</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Expenses by Category */}
                {monthlyFlow.expensesByCategory && Object.keys(monthlyFlow.expensesByCategory).length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <h4 className="font-semibold text-red-700 mb-4">Despesas por Categoria</h4>
                    <div className="space-y-3">
                      {Object.entries(monthlyFlow.expensesByCategory)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([category, amount]) => {
                          const percentage = (amount as number) / monthlyFlow.totalExpenses * 100;
                          return (
                            <div key={category}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-700">{category}</span>
                                <span className="font-medium text-red-600">{formatCurrency(amount as number)}</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-red-500 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Projection View */}
          {activeTab === 'projection' && projection && (
            <div className="space-y-6">
              {/* Days Selection */}
              <div className="flex items-center justify-center gap-4">
                <span className="text-sm text-slate-500">Projetar para:</span>
                {[7, 15, 30, 60, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setProjectionDays(days)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      projectionDays === days
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {days} dias
                  </button>
                ))}
              </div>

              {/* Projection Summary */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h4 className="font-semibold text-slate-900 mb-4">Projecao de {projectionDays} dias</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-sm text-slate-500">Saldo Atual</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(projection.currentBalance || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-emerald-600">Receitas Previstas</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(projection.expectedCredits || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-red-600">Despesas Previstas</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(projection.expectedDebits || 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-500">Variacao</p>
                    <p className={`text-lg font-bold ${
                      (projection.expectedCredits - projection.expectedDebits) >= 0 
                        ? 'text-emerald-600' 
                        : 'text-red-600'
                    }`}>
                      {formatCurrency((projection.expectedCredits || 0) - (projection.expectedDebits || 0))}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className={`text-sm ${projection.projectedBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      Saldo Projetado
                    </p>
                    <p className={`text-lg font-bold ${
                      projection.projectedBalance >= 0 ? 'text-blue-700' : 'text-orange-700'
                    }`}>
                      {formatCurrency(projection.projectedBalance || 0)}
                    </p>
                  </div>
                </div>

                {/* Daily Projection Chart (simple bars) */}
                {projection.daily && projection.daily.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      <div className="flex items-end gap-1 h-48">
                        {projection.daily.slice(0, 30).map((day: any, idx: number) => {
                          const maxBalance = Math.max(...projection.daily.map((d: any) => Math.abs(d.balance)));
                          const height = maxBalance > 0 ? (Math.abs(day.balance) / maxBalance) * 100 : 0;
                          const isPositive = day.balance >= 0;
                          
                          return (
                            <div 
                              key={idx}
                              className="flex-1 flex flex-col items-center"
                              title={`${day.date}: ${formatCurrency(day.balance)}`}
                            >
                              <div 
                                className={`w-full rounded-t ${isPositive ? 'bg-blue-400' : 'bg-orange-400'}`}
                                style={{ height: `${height}%`, minHeight: '4px' }}
                              />
                              {idx % 5 === 0 && (
                                <span className="text-[10px] text-slate-400 mt-1 rotate-45 origin-left">
                                  {day.date.slice(5)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Alerts */}
                {projection.alerts && projection.alerts.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h5 className="font-medium text-slate-700">Alertas</h5>
                    {projection.alerts.map((alert: any, idx: number) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded-lg ${
                          alert.type === 'danger' ? 'bg-red-50 text-red-700' :
                          alert.type === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {alert.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DRE View */}
          {activeTab === 'dre' && dre && (
            <div className="space-y-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-center gap-4">
                <button onClick={goToPrevMonth} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronLeft size={20} />
                </button>
                <div className="text-lg font-semibold text-slate-900 min-w-[200px] text-center">
                  {MONTH_NAMES[selectedMonth]} / {selectedYear}
                </div>
                <button onClick={goToNextMonth} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium" colSpan={2}>
                        Demonstracao do Resultado do Exercicio (DRE)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Revenue */}
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900" colSpan={2}>
                        RECEITA BRUTA
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 text-slate-600">Particular</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(dre.revenue.particular)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 text-slate-600">Convenios</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(dre.revenue.insurance)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 text-slate-600">SUS</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(dre.revenue.sus)}</td>
                    </tr>
                    <tr className="bg-emerald-50">
                      <td className="px-4 py-3 font-semibold text-emerald-800">RECEITA BRUTA TOTAL</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(dre.revenue.total)}</td>
                    </tr>

                    {/* Deductions */}
                    <tr>
                      <td className="px-6 py-2 text-slate-600">(-) Deducoes (impostos, glosas)</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatCurrency(dre.deductions)}</td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="px-4 py-3 font-semibold text-blue-800">RECEITA LIQUIDA</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCurrency(dre.netRevenue)}</td>
                    </tr>

                    {/* Operational Expenses */}
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900" colSpan={2}>
                        DESPESAS OPERACIONAIS
                      </td>
                    </tr>
                    {dre.operationalExpenses && Object.entries(dre.operationalExpenses).map(([category, amount]) => (
                      <tr key={category}>
                        <td className="px-6 py-2 text-slate-600">{category}</td>
                        <td className="px-4 py-2 text-right text-red-600">{formatCurrency(amount as number)}</td>
                      </tr>
                    ))}
                    <tr className="bg-red-50">
                      <td className="px-4 py-3 font-semibold text-red-800">TOTAL DESPESAS OPERACIONAIS</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">{formatCurrency(dre.totalOperationalExpenses)}</td>
                    </tr>

                    {/* Operational Result */}
                    <tr className={dre.operationalResult >= 0 ? 'bg-emerald-100' : 'bg-orange-100'}>
                      <td className={`px-4 py-3 font-semibold ${dre.operationalResult >= 0 ? 'text-emerald-800' : 'text-orange-800'}`}>
                        RESULTADO OPERACIONAL
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${dre.operationalResult >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                        {formatCurrency(dre.operationalResult)}
                      </td>
                    </tr>

                    {/* Financial */}
                    <tr>
                      <td className="px-6 py-2 text-slate-600">(+) Receitas Financeiras</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(dre.financialRevenue)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 text-slate-600">(-) Despesas Financeiras</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatCurrency(dre.financialExpenses)}</td>
                    </tr>

                    {/* Net Result */}
                    <tr className={`${dre.netResult >= 0 ? 'bg-emerald-200' : 'bg-red-200'}`}>
                      <td className={`px-4 py-4 font-bold text-lg ${dre.netResult >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                        RESULTADO LIQUIDO
                      </td>
                      <td className={`px-4 py-4 text-right font-bold text-lg ${dre.netResult >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                        {formatCurrency(dre.netResult)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bank Accounts View */}
          {activeTab === 'banks' && bankPosition && (
            <div className="space-y-6">
              {/* Total Balance */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 text-white">
                <p className="text-sm text-blue-200">Saldo Consolidado em Bancos</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(bankPosition.totalBalance)}</p>
                <p className="text-sm text-blue-200 mt-2">{bankPosition.accounts?.length || 0} contas ativas</p>
              </div>

              {/* Bank Accounts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bankPosition.accounts?.map((account) => (
                  <div key={account.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Building2 size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{account.nickname}</p>
                        <p className="text-xs text-slate-500">{account.bankName}</p>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-400">Conta: {account.accountNumber}</p>
                      <p className={`text-xl font-bold mt-1 ${account.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(account.currentBalance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {bankPosition.accounts?.length === 0 && (
                <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-500">
                  Nenhuma conta bancaria cadastrada
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
