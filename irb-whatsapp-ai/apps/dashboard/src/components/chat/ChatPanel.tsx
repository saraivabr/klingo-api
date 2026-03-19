import React, { useEffect, useState, useRef } from 'react';
import { X, User, Bot, Send, UserPlus, PanelRightOpen, PanelRightClose, Phone, Clock, MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { usePatientContext } from '../../hooks/usePatientContext';
import Avatar from '../shared/Avatar';
import PatientSidebar from './PatientSidebar';
import type { Conversation } from '../../types/conversation';

interface ChatPanelProps {
  conversationId: string;
  onClose: () => void;
  onAction: () => void;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativa', color: 'bg-emerald-100 text-emerald-700' },
  escalated: { label: 'Escalada', color: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Fechada', color: 'bg-slate-100 text-slate-500' },
};

export default function ChatPanel({ conversationId: initialConversationId, onClose, onAction }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [manualMessage, setManualMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { lastMessage } = useWebSocket();
  const { context: patientContext, loading: contextLoading } = usePatientContext(conversationId);

  const load = async () => {
    try {
      const data = await api.getConversation(conversationId);
      setConversation(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); load(); }, [conversationId]);
  useEffect(() => {
    if (lastMessage?.data?.payload?.conversationId === conversationId) load();
  }, [lastMessage]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation?.messages]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleAssign = async () => {
    setActionLoading('assign');
    try { await api.assignConversation(conversationId); await load(); onAction(); }
    catch (e: any) { console.error('Erro ao assumir:', e); alert(`Erro ao assumir conversa: ${e.message}`); }
    finally { setActionLoading(null); }
  };

  const handleRelease = async () => {
    setActionLoading('release');
    try { await api.releaseConversation(conversationId); await load(); onAction(); }
    catch (e: any) { console.error('Erro ao devolver:', e); alert(`Erro ao devolver para IA: ${e.message}`); }
    finally { setActionLoading(null); }
  };

  const handleCloseConv = async () => {
    if (!confirm('Deseja fechar esta conversa?')) return;
    setActionLoading('close');
    try { await api.closeConversation(conversationId); await load(); onAction(); }
    catch (e: any) { console.error('Erro ao fechar:', e); alert(`Erro ao fechar conversa: ${e.message}`); }
    finally { setActionLoading(null); }
  };

  const handleViewConversation = (id: string) => {
    setConversationId(id);
  };

  const statusInfo = STATUS_BADGE[conversation?.status || 'active'] || STATUS_BADGE.active;
  const msgCount = conversation?.messages?.length || 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />

      {/* Modal full-screen */}
      <div className="fixed inset-4 bg-white rounded-2xl shadow-2xl z-50 flex overflow-hidden animate-fade-in">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
            <Avatar name={conversation?.patientName || conversation?.patientPhone} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate">
                  {conversation?.patientName || conversation?.patientPhone || 'Carregando...'}
                </h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Phone size={10} />
                  {conversation?.patientPhone}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={10} />
                  {msgCount} msgs
                </span>
                {conversation?.isAiHandling && (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Bot size={10} />
                    IA ativa
                  </span>
                )}
                {!conversation?.isAiHandling && conversation?.status !== 'closed' && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <User size={10} />
                    Atendimento humano
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {conversation && conversation.status !== 'closed' && (
                <>
                  {conversation.isAiHandling ? (
                    <button
                      onClick={handleAssign}
                      disabled={actionLoading !== null}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <UserPlus size={13} /> Assumir
                    </button>
                  ) : (
                    <button
                      onClick={handleRelease}
                      disabled={actionLoading !== null}
                      className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <Bot size={13} /> Devolver IA
                    </button>
                  )}
                  <button
                    onClick={handleCloseConv}
                    disabled={actionLoading !== null}
                    className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 border border-red-200 disabled:opacity-50 transition-colors"
                  >
                    Fechar
                  </button>
                </>
              )}
              {conversation?.status === 'closed' && (
                <span className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-lg">
                  Conversa fechada
                </span>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 ml-1"
                title={sidebarOpen ? 'Fechar contexto' : 'Abrir contexto'}
              >
                {sidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-sm">Carregando mensagens...</div>
            ) : (
              conversation?.messages?.map((msg: any, i: number) => (
                <div key={i} className={`flex ${msg.sender === 'patient' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm ${
                    msg.sender === 'patient' ? 'bg-white text-slate-900 rounded-tl-sm' :
                    msg.sender === 'ai' ? 'bg-primary-500 text-white rounded-tr-sm' :
                    'bg-amber-500 text-white rounded-tr-sm'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-0.5 opacity-70 text-[10px]">
                      {msg.sender === 'patient' ? <User size={9} /> : msg.sender === 'ai' ? <Bot size={9} /> : <User size={9} />}
                      {msg.sender === 'patient' ? 'Paciente' : msg.sender === 'ai' ? 'Julia (IA)' : 'Atendente'}
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    <p className="text-[10px] opacity-60 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {conversation && !conversation.isAiHandling && conversation.status !== 'closed' && (
            <div className="border-t bg-white p-3 shrink-0">
              <form className="flex gap-2" onSubmit={async (e) => {
                e.preventDefault();
                if (!manualMessage.trim() || sending) return;
                setSending(true);
                try {
                  await api.sendMessage(conversationId, manualMessage.trim());
                  setManualMessage('');
                  await load();
                } catch (err: any) {
                  alert(`Erro ao enviar: ${err.message}`);
                } finally {
                  setSending(false);
                }
              }}>
                <input
                  value={manualMessage}
                  onChange={e => setManualMessage(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Digite sua mensagem..."
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !manualMessage.trim()}
                  className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <PatientSidebar
            context={patientContext}
            loading={contextLoading}
            currentConversationId={conversationId}
            onViewConversation={handleViewConversation}
          />
        )}
      </div>
    </>
  );
}
