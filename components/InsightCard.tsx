'use client'
import { CoachInsight } from '@/lib/coach'

const styles = {
  good:    { border: 'border-green-200',  bg: 'bg-green-50',  icon: '✓', text: 'text-green-600',  body: 'text-green-900' },
  warning: { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: '!', text: 'text-amber-600',  body: 'text-amber-900' },
  info:    { border: 'border-sky-200',    bg: 'bg-sky-50',    icon: 'i', text: 'text-sky-600',    body: 'text-sky-900' },
}

export default function InsightCard({ insight }: { insight: CoachInsight }) {
  const s = styles[insight.type]
  return (
    <div className={`border ${s.border} ${s.bg} rounded-xl p-3 flex gap-3 items-start`}>
      <span className={`font-bold text-sm mt-0.5 ${s.text} w-4 shrink-0`}>{s.icon}</span>
      <p className={`text-sm ${s.body} leading-snug`}>{insight.text}</p>
    </div>
  )
}
