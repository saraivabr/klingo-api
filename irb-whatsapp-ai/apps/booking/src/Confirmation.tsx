interface Props {
  specialty: string;
  doctorName?: string;
  date: string;
  time: string;
  patientPhone?: string | null;
}

const IRB_WHATSAPP = '5511999999999'; // TODO: set actual number

export default function Confirmation({ specialty, doctorName, date, time, patientPhone }: Props) {
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
  const formatted = `${weekday}, ${day}/${String(month).padStart(2, '0')} às ${time}`;

  return (
    <div className="min-h-screen bg-irb-bg flex items-center justify-center px-5">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Success icon */}
        <div className="w-20 h-20 bg-irb-primary rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamento confirmado!</h1>
          <p className="text-gray-500 mt-2">Tudo certo para a sua consulta</p>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-2xl p-5 text-left space-y-3 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Especialidade</p>
            <p className="font-medium text-gray-900">{specialty}</p>
          </div>
          {doctorName && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Médico(a)</p>
              <p className="font-medium text-gray-900">{doctorName}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Data e horário</p>
            <p className="font-medium text-gray-900 capitalize">{formatted}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Local</p>
            <p className="font-medium text-gray-900">Rua Boa Vista, 99 - 6º Andar, São Paulo</p>
          </div>
        </div>

        {/* WhatsApp back link */}
        <a
          href={`https://wa.me/${IRB_WHATSAPP}`}
          className="inline-flex items-center justify-center gap-2 w-full py-4 bg-[#25D366] text-white font-semibold rounded-xl hover:bg-[#1da851] active:scale-[0.98] transition-all text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.592-.838-6.318-2.236l-.44-.366-3.17 1.063 1.063-3.17-.366-.44A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          Voltar ao WhatsApp
        </a>
      </div>
    </div>
  );
}
