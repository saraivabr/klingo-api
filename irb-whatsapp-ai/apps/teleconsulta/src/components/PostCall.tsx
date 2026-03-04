import { useState } from 'react';

interface Props {
  doctorName: string;
  duration: number;
}

export default function PostCall({ doctorName, duration }: Props) {
  const [nps, setNps] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s} segundos`;
    return `${m} min ${s > 0 ? `${s}s` : ''}`;
  };

  const handleNps = (score: number) => {
    setNps(score);
    setSubmitted(true);
    // Could POST to API for NPS tracking
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 space-y-6 text-center">
        {/* Success icon */}
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900">Consulta Finalizada</h1>
        <p className="text-gray-500 text-sm">
          Sua teleconsulta com {doctorName} foi concluída com sucesso.
        </p>

        {duration > 0 && (
          <p className="text-sm text-gray-400">Duração: {formatDuration(duration)}</p>
        )}

        {/* NPS */}
        {!submitted ? (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium text-gray-700">Como foi sua experiência?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  onClick={() => handleNps(score)}
                  className="w-10 h-10 rounded-lg border-2 border-gray-200 text-gray-600 font-semibold hover:border-irb-primary hover:text-irb-primary transition active:scale-95"
                >
                  {score}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">1 = Ruim, 5 = Excelente</p>
          </div>
        ) : (
          <div className="pt-4 border-t">
            <p className="text-sm text-irb-primary font-medium">Obrigado pelo feedback!</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <a
            href="https://wa.me/551130420366"
            className="block w-full py-3 bg-irb-primary text-white rounded-xl font-medium hover:bg-irb-dark transition active:scale-95"
          >
            Voltar ao WhatsApp
          </a>
          <p className="text-xs text-gray-400">
            Se o médico gerou uma receita, ela será enviada no seu WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
}
