import Link from 'next/link'

export default function KarolineLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-900 text-white">
      <header className="border-b border-zinc-800 px-4 py-3 sticky top-0 z-20 bg-zinc-900/95 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm">← Hjem</Link>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-fuchsia-400" />
            <span className="font-semibold text-zinc-200">Karoline</span>
          </div>
          <div className="ml-auto text-xs text-zinc-500">Løp + sykkel · Sub-50 10k · Sub-2t halvmaraton</div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-5">
        {children}
      </div>
    </main>
  )
}
