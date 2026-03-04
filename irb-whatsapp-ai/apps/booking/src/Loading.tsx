export default function Loading({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-irb-bg">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-irb-light border-t-irb-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 text-sm">{text}</p>
      </div>
    </div>
  );
}
