import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Settings() {
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [tab, setTab] = useState<'kb' | 'services'>('kb');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getKnowledgeBase(), api.getServices()])
      .then(([kb, svc]) => { setKnowledgeBase(kb); setServices(svc); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-6 py-6">
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('kb')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'kb' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>Base de Conhecimento</button>
        <button onClick={() => setTab('services')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'services' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>Serviços e Preços</button>
      </div>

      {loading ? <p className="text-slate-400">Carregando...</p> : tab === 'kb' ? (
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {knowledgeBase.map(item => (
            <div key={item.id} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{item.category}</span>
                <span className="font-medium text-sm">{item.key}</span>
              </div>
              <p className="text-sm text-slate-600 mb-1"><strong>P:</strong> {item.question}</p>
              <p className="text-sm text-slate-800"><strong>R:</strong> {item.answer}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {services.map(svc => (
            <div key={svc.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{svc.name}</p>
                <p className="text-sm text-slate-500">{svc.category} — {svc.durationMinutes}min</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-slate-900">{svc.priceCents ? `R$ ${(svc.priceCents / 100).toFixed(2)}` : 'Consultar'}</p>
                <span className={`text-xs ${svc.isActive ? 'text-green-600' : 'text-red-500'}`}>{svc.isActive ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
