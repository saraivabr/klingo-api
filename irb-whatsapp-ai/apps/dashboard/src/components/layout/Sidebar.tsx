import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Settings, LogOut, CreditCard, DollarSign, Video, Calendar, Stethoscope, Receipt, FlaskConical, Pill, Activity } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

const NAV_ITEMS = [
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
  { to: '/finance', icon: DollarSign, label: 'Financeiro' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

export default function Sidebar() {
  const { connected } = useWebSocket();
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    window.location.reload();
  };

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0 h-screen sticky top-0">
      <div className="px-5 py-6">
        <h1 className="text-lg font-bold tracking-tight">IRB Prime Care</h1>
        <p className="text-xs text-slate-400 mt-0.5">Atendimento IA</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
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
