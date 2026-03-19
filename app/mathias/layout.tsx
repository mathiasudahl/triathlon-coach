import Link from 'next/link'

export default function MathiasLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f8f7f4]">
      <header className="bg-white border-b border-stone-200 px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-stone-400 hover:text-stone-600 text-sm">← Hjem</Link>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">M</div>
            <span className="font-semibold text-stone-800">Mathias</span>
          </div>
          <div className="ml-auto text-xs text-stone-400">Olympisk triatlon · 8. aug 2026</div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-5">
        {children}
      </div>
    </main>
  )
}
