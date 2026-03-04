export default function Loading({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5">
      <div className="w-12 h-12 border-4 border-irb-light border-t-irb-primary rounded-full animate-spin mb-4" />
      <p className="text-gray-600 text-sm">{text}</p>
    </div>
  );
}
