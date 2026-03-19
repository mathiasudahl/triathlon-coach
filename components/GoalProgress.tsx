'use client'
import { Goal } from '@/lib/athletes'

type Props = {
  goals: Goal[]
  athleteColor: string
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function progressPct(goal: Goal, currentCtl: number): number {
  // Enkel modell: fremgang estimert fra CTL/watt/pace
  if (goal.sport === 'bike') {
    // Nåværende FTP vs mål-FTP
    const currentFtp = currentCtl * 0.85 + 100 // veldig grov modell
    return Math.min(99, Math.round((currentFtp / goal.targetValue) * 100))
  }
  // For løp: estimert basert på at de trener mot målet
  return Math.min(85, 60 + Math.random() * 10) // placeholder til vi har løpe-tester
}

function formatTarget(goal: Goal): string {
  if (goal.sport === 'run') {
    const h = Math.floor(goal.targetValue / 3600)
    const m = Math.floor((goal.targetValue % 3600) / 60)
    const s = goal.targetValue % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }
  if (goal.sport === 'bike') return `${goal.targetValue}W`
  return String(goal.targetValue)
}

export default function GoalProgress({ goals, athleteColor }: Props) {
  if (!goals.length) return null

  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Mål</h3>
      <div className="flex flex-col gap-3">
        {goals.map((goal, i) => {
          const days = daysUntil(goal.targetDate)
          const pct = Math.min(99, 55 + i * 12) // placeholder
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-zinc-200">{goal.label}</span>
                  <span className="ml-2 text-xs text-zinc-500">mål: {formatTarget(goal)}</span>
                </div>
                <span className="text-xs text-zinc-500">{days > 0 ? `om ${days} dager` : 'passert'}</span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: athleteColor }}
                />
              </div>
              <p className="text-xs text-zinc-500 leading-snug">{goal.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
