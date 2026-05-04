interface Props {
  currentStep: 'slots' | 'form' | 'done';
}

const STEPS = [
  { key: 'slots', label: 'Hor\u00e1rios' },
  { key: 'form', label: 'Seus dados' },
  { key: 'done', label: 'Confirmado' },
] as const;

export default function ProgressBar({ currentStep }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="max-w-lg mx-auto px-5 py-4">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIndex;
          const isActive = i === currentIndex;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? 'bg-[#1B2A4A] text-white'
                        : 'border-2 border-gray-300 text-gray-400 bg-white'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium ${
                    isCompleted
                      ? 'text-emerald-600'
                      : isActive
                        ? 'text-[#1B2A4A]'
                        : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-4 ${
                    i < currentIndex ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
