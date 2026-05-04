import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Settings, LogOut, CreditCard, DollarSign, Calendar, Stethoscope, Receipt, Activity, ChevronDown, ChevronRight, ArrowDownCircle, ArrowUpCircle, TrendingUp, Users, ClipboardCheck, WalletCards, Building2, ShoppingCart, X, Zap, Crown, MessageCircle, BarChart3 } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

const ALL_NAV_ITEMS = [
  { to: '/', icon: Activity, label: 'Painel', key: 'journeys' },
  { to: '/conversations', icon: MessageCircle, label: 'Conversas', key: 'conversations' },
  { to: '/schedules', icon: Calendar, label: 'Agendas' },
  { to: '/opd', icon: Stethoscope, label: 'Consultas' },
  { to: '/billing', icon: Receipt, label: 'Faturamento' },
  { to: '/pdv', icon: ShoppingCart, label: 'PDV Cobrança' },
  { to: '/subscriptions', icon: CreditCard, label: 'Assinaturas' },
  { to: '/plans', icon: Crown, label: 'Planos' },
  { to: '/indicators', icon: BarChart3, label: 'Indicadores' },
  { to: '/users', icon: Users, label: 'Usuários', adminOnly: true as const },
] as const;

function getUserAccess(): { role: string; permissions: string[] } {
  try {
    const token = localStorage.getItem('token');
    if (!token) return { role: '', permissions: [] };
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      role: payload.role || '',
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    };
  } catch { return { role: '', permissions: [] }; }
}

// CRM oculto — fase futura
// const CRM_SUBITEMS = [
//   { to: '/crm/pipeline', icon: Columns3, label: 'Pipeline', permission: 'crm.view' },
//   { to: '/crm/metrics', icon: Target, label: 'Metricas', permission: 'crm.view' },
//   { to: '/crm/campaigns', icon: Megaphone, label: 'Campanhas', permission: 'crm.view' },
// ];

const FINANCE_SUBITEMS = [
  { to: '/finance', icon: DollarSign, label: 'Visão Geral', permission: 'finance.view' },
  { to: '/finance/payable', icon: ArrowDownCircle, label: 'Contas a Pagar', permission: 'finance.payable.view' },
  { to: '/finance/receivable', icon: ArrowUpCircle, label: 'Contas a Receber', permission: 'finance.receivable.view' },
  { to: '/finance/daily', icon: ClipboardCheck, label: 'Pagamento Diário', permission: 'finance.daily.view' },
  { to: '/finance/cashflow', icon: TrendingUp, label: 'Fluxo de Caixa', permission: 'finance.cashflow.view' },
  { to: '/finance/reimbursements', icon: CreditCard, label: 'Reembolsos', permission: 'finance.reimbursements.view' },
  { to: '/finance/orders', icon: WalletCards, label: 'Ordens de Pagamento', permission: 'finance.orders.view' },
  { to: '/finance/cadastros', icon: Building2, label: 'Cadastros', permission: 'finance.cadastros.view' },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { connected, unreadCount, resetUnread } = useWebSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [financeExpanded, setFinanceExpanded] = useState(location.pathname.startsWith('/finance'));
  const { role: userRole, permissions } = getUserAccess();
  const canManageUsers = userRole === 'admin' || permissions.includes('users.manage');
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => !('adminOnly' in item && item.adminOnly) || canManageUsers);
  const visibleFinanceItems = FINANCE_SUBITEMS.filter((item) => userRole === 'admin' || permissions.includes(item.permission));

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    window.location.reload();
  };

  const isFinanceActive = location.pathname.startsWith('/finance');

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0 h-screen sticky top-0">
      <div className="px-5 py-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">IRB Prime Care</h1>
          <p className="text-xs text-slate-400 mt-0.5">Gestão Clínica</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => {
              if ('key' in rest && (rest as any).key === 'conversations') resetUnread();
              onClose?.();
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/10 text-white border-l-2 border-primary-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {'key' in rest && (rest as any).key === 'conversations' && unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}

        {/* Finance Section with Submenu */}
        <div>
          <button
            onClick={() => setFinanceExpanded(!financeExpanded)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isFinanceActive
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <DollarSign size={18} />
              Financeiro
            </div>
            {financeExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
          {financeExpanded && (
            <div className="ml-4 mt-1 space-y-0.5">
              {visibleFinanceItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-400'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <NavLink
          to="/hub"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white/10 text-white border-l-2 border-primary-400'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Zap size={18} />
          Hub
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white/10 text-white border-l-2 border-primary-400'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <Settings size={18} />
          Configurações
        </NavLink>
      </nav>

      <div className="px-5 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-xs text-slate-400">{connected ? 'Conectado' : 'Desconectado'}</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
