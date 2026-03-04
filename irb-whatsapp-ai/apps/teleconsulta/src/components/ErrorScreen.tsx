interface Props {
  message: string;
}

export default function ErrorScreen({ message }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Ops!</h2>
        <p className="text-gray-500 text-sm">{message}</p>
        <a
          href="https://wa.me/551130420366"
          className="inline-block px-6 py-3 bg-irb-primary text-white rounded-xl font-medium hover:bg-irb-dark transition"
        >
          Falar com a IRB
        </a>
      </div>
    </div>
  );
}
