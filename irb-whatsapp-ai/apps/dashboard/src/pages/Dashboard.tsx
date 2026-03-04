import React, { useState, useCallback } from 'react';
import KanbanBoard from '../components/kanban/KanbanBoard';
import ChatPanel from '../components/chat/ChatPanel';
import { useConversations } from '../hooks/useConversations';
import { api } from '../services/api';
import type { Conversation } from '../types/conversation';

export default function Dashboard() {
  const { pipeline, loading, refetch } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const handleCardClick = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation._id);
  }, []);

  const handleAssign = useCallback(async (id: string) => {
    try {
      await api.assignConversation(id);
      refetch();
    } catch (err) {
      console.error('Erro ao assumir conversa:', err);
    }
  }, [refetch]);

  const handleRelease = useCallback(async (id: string) => {
    try {
      await api.releaseConversation(id);
      refetch();
    } catch (err) {
      console.error('Erro ao devolver conversa:', err);
    }
  }, [refetch]);

  const handleClose = useCallback(async (id: string) => {
    try {
      await api.closeConversation(id);
      refetch();
    } catch (err) {
      console.error('Erro ao fechar conversa:', err);
    }
  }, [refetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Carregando conversas...</div>
      </div>
    );
  }

  return (
    <>
      <KanbanBoard
        pipeline={pipeline}
        onCardClick={handleCardClick}
        onAssign={handleAssign}
        onRelease={handleRelease}
        onClose={handleClose}
      />

      {selectedConversation && (
        <ChatPanel
          conversationId={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          onAction={refetch}
        />
      )}
    </>
  );
}
