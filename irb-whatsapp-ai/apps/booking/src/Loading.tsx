export default function Loading({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-irb-bg">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-irb-accent border-t-irb-gold rounded-full animate-spin mx-auto mb-4" />
        <p className="text-irb-primary font-medium text-sm">{text}</p>
        <p className="text-xs text-gray-400 mt-2">IRB Prime Care</p>
      </div>
    </div>
  );
}
