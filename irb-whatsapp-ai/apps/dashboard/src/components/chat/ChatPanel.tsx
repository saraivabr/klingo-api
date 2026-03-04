import React, { useEffect, useState, useRef } from 'react';
import { X, User, Bot, Send, UserPlus, PanelRightOpen, PanelRightClose } from 'lucide-react';
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

export default function ChatPanel({ conversationId: initialConversationId, onClose, onAction }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [manualMessage, setManualMessage] = useState('');
  const [loading, setLoading] = useState(true);
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

  const handleAssign = async () => { await api.assignConversation(conversationId); load(); onAction(); };
  const handleRelease = async () => { await api.releaseConversation(conversationId); load(); onAction(); };
  const handleCloseConv = async () => { await api.closeConversation(conversationId); load(); onAction(); };

  const handleViewConversation = (id: string) => {
    setConversationId(id);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40 animate-fade-in" onClick={onClose} />

      {/* Modal full-screen */}
      <div className="fixed inset-4 bg-white rounded-2xl shadow-2xl z-50 flex overflow-hidden animate-fade-in">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-white shrink-0">
            <Avatar name={conversation?.patientName || conversation?.patientPhone} size="md" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">
                {conversation?.patientName || conversation?.patientPhone || 'Carregando...'}
              </h3>
              <p className="text-xs text-slate-500">{conversation?.patientPhone} — {conversation?.state}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {conversation && conversation.status !== 'closed' && (
                <>
                  {conversation.isAiHandling ? (
                    <button onClick={handleAssign} className="px-2.5 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 flex items-center gap-1">
                      <UserPlus size={12} /> Assumir
                    </button>
                  ) : (
                    <button onClick={handleRelease} className="px-2.5 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600 flex items-center gap-1">
                      <Bot size={12} /> Devolver IA
                    </button>
                  )}
                  <button onClick={handleCloseConv} className="px-2.5 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg hover:bg-slate-300">
                    Fechar
                  </button>
                </>
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
                  <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${
                    msg.sender === 'patient' ? 'bg-white text-slate-900 shadow-sm' :
                    msg.sender === 'ai' ? 'bg-primary-500 text-white' :
                    'bg-amber-500 text-white'
                  }`}>
                    <div className="flex items-center gap-1 mb-0.5 opacity-70 text-[10px]">
                      {msg.sender === 'patient' ? <User size={9} /> : <Bot size={9} />}
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
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setManualMessage(''); }}>
                <input
                  value={manualMessage}
                  onChange={e => setManualMessage(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Digite sua mensagem..."
                />
                <button type="submit" className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700">
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
