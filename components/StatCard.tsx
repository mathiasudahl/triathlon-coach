'use client'

type Props = {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export default function StatCard({ label, value, sub, color = 'text-stone-800' }: Props) {
  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-1 shadow-sm border border-stone-100">
      <span className="text-xs text-stone-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-stone-400">{sub}</span>}
    </div>
  )
}
