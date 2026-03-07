import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Settings, LogOut, CreditCard, DollarSign, Video, Calendar, Stethoscope, Receipt, FlaskConical, Pill, Activity, ChevronDown, ChevronRight, ArrowDownCircle, ArrowUpCircle, TrendingUp, Users } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

const ALL_NAV_ITEMS = [
  { to: '/', icon: Activity, label: 'Jornadas' },
  { to: '/conversations', icon: LayoutDashboard, label: 'Conversas' },
  { to: '/teleconsulta', icon: Video, label: 'Teleconsulta' },
  { to: '/schedules', icon: Calendar, label: 'Agendas' },
  { to: '/opd', icon: Stethoscope, label: 'Consultas' },
  { to: '/billing', icon: Receipt, label: 'Faturamento' },
  { to: '/lab', icon: FlaskConical, label: 'Laboratório' },
  { to: '/pharmacy', icon: Pill, label: 'Farmácia' },
  { to: '/metrics', icon: BarChart3, label: 'Métricas' },
  { to: '/subscriptions', icon: CreditCard, label: 'Assinaturas' },
  { to: '/users', icon: Users, label: 'Usuarios', adminOnly: true as const },
] as const;

function getUserRole(): string {
  try {
    const token = localStorage.getItem('token');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || '';
  } catch { return ''; }
}

const FINANCE_SUBITEMS = [
  { to: '/finance', icon: DollarSign, label: 'Visão Geral' },
  { to: '/finance/payable', icon: ArrowDownCircle, label: 'Contas a Pagar' },
  { to: '/finance/receivable', icon: ArrowUpCircle, label: 'Contas a Receber' },
  { to: '/finance/cashflow', icon: TrendingUp, label: 'Fluxo de Caixa' },
];

export default function Sidebar() {
  const { connected } = useWebSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [financeExpanded, setFinanceExpanded] = useState(location.pathname.startsWith('/finance'));
  const userRole = getUserRole();
  const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => !('adminOnly' in item && item.adminOnly) || userRole === 'admin');

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    window.location.reload();
  };

  const isFinanceActive = location.pathname.startsWith('/finance');

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0 h-screen sticky top-0">
      <div className="px-5 py-6">
        <h1 className="text-lg font-bold tracking-tight">IRB Prime Care</h1>
        <p className="text-xs text-slate-400 mt-0.5">Atendimento IA</p>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/10 text-white border-l-2 border-primary-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
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
              {FINANCE_SUBITEMS.map(({ to, icon: Icon, label }) => (
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
