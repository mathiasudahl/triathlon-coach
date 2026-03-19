import Link from 'next/link'

export default function KarolineLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f8f7f4]">
      <header className="bg-white border-b border-stone-200 px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-stone-400 hover:text-stone-600 text-sm">← Hjem</Link>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-fuchsia-100 flex items-center justify-center text-xs font-bold text-fuchsia-600">K</div>
            <span className="font-semibold text-stone-800">Karoline</span>
          </div>
          <div className="ml-auto text-xs text-stone-400">Løp + sykkel · Sub-50 10k · Sub-2t halvmaraton</div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-5">
        {children}
      </div>
    </main>
  )
}
