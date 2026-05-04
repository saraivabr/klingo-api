import React, { useState, useCallback, useRef, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Menu, X, CheckCircle, AlertCircle, Info } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Toast System                                                       */
/* ------------------------------------------------------------------ */

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_STYLES: Record<ToastType, { bg: string; icon: React.ElementType }> = {
  success: { bg: 'bg-emerald-600', icon: CheckCircle },
  error:   { bg: 'bg-red-600',     icon: AlertCircle },
  info:    { bg: 'bg-blue-600',    icon: Info },
};

let toastIdCounter = 0;

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timersRef.current.delete(id);
    }, 5000);
    timersRef.current.set(id, timer);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className="flex min-h-screen bg-slate-50">
        {/* Desktop sidebar - always visible on lg+ */}
        <div className="hidden lg:flex">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Sliding sidebar */}
            <div className="relative w-60 h-full sidebar-slide-in">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header with hamburger */}
          <div className="flex items-center gap-3 px-4 py-3 lg:hidden bg-white border-b border-slate-200">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">IRB Prime Care</h1>
          </div>

          <TopBar />
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>

        {/* Toast container - bottom right */}
        {toasts.length > 0 && (
          <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => {
              const style = TOAST_STYLES[toast.type];
              const Icon = style.icon;
              return (
                <div
                  key={toast.id}
                  className={`${style.bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-[400px] pointer-events-auto toast-slide-in`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="text-sm font-medium flex-1">{toast.message}</span>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
                    aria-label="Fechar"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
