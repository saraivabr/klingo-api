import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Bot, Send, UserPlus, X } from 'lucide-react';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<any>(null);
  const [manualMessage, setManualMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { lastMessage } = useWebSocket();

  const load = async () => {
    if (!id) return;
    try {
      const data = await api.getConversation(id);
      setConversation(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (lastMessage?.data?.payload?.conversationId === id) load();
  }, [lastMessage]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation?.messages]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Carregando...</div>;
  if (!conversation) return <div className="min-h-screen flex items-center justify-center text-gray-400">Conversa não encontrada</div>;

  const handleAssign = async () => { await api.assignConversation(id!); load(); };
  const handleRelease = async () => { await api.releaseConversation(id!); load(); };
  const handleClose = async () => { await api.closeConversation(id!); load(); };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link to="/conversations" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h2 className="font-medium text-gray-900">{conversation.patientName || conversation.patientPhone}</h2>
          <p className="text-xs text-gray-500">{conversation.patientPhone} — {conversation.state}</p>
        </div>
        <div className="flex gap-2">
          {conversation.isAiHandling ? (
            <button onClick={handleAssign} className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 flex items-center gap-1"><UserPlus size={14} /> Assumir</button>
          ) : (
            <button onClick={handleRelease} className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 flex items-center gap-1"><Bot size={14} /> Devolver à IA</button>
          )}
          <button onClick={handleClose} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 flex items-center gap-1"><X size={14} /> Fechar</button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {conversation.messages?.map((msg: any, i: number) => (
          <div key={i} className={`flex ${msg.sender === 'patient' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
              msg.sender === 'patient' ? 'bg-white text-gray-900 shadow-sm' :
              msg.sender === 'ai' ? 'bg-primary-500 text-white' :
              'bg-orange-500 text-white'
            }`}>
              <div className="flex items-center gap-1 mb-1 opacity-70 text-xs">
                {msg.sender === 'patient' ? <User size={10} /> : <Bot size={10} />}
                {msg.sender === 'patient' ? 'Paciente' : msg.sender === 'ai' ? 'Julia (IA)' : 'Atendente'}
              </div>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              <p className="text-[10px] opacity-60 mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Manual input (only when human is handling) */}
      {!conversation.isAiHandling && conversation.status !== 'closed' && (
        <div className="bg-white border-t p-4">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); /* TODO: send manual message via API */ setManualMessage(''); }}>
            <input value={manualMessage} onChange={e => setManualMessage(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="Digite sua mensagem..." />
            <button type="submit" className="bg-primary-600 text-white p-2.5 rounded-lg hover:bg-primary-700"><Send size={18} /></button>
          </form>
        </div>
      )}
    </div>
  );
}
