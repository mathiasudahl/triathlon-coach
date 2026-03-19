'use client'

type Props = {
  tsb: number
  atl: number
  ctl: number
  athleteColor: string
  name: string
}

export default function ReadinessBar({ tsb, atl, ctl, athleteColor, name }: Props) {
  // Readiness: 0–100 basert på TSB
  const readiness = Math.min(100, Math.max(0, 50 + tsb * 2))
  const isReady = readiness >= 55
  const label =
    readiness >= 70 ? 'Toppform' :
    readiness >= 55 ? 'Klar' :
    readiness >= 40 ? 'Nøytral' :
    readiness >= 25 ? 'Sliten' :
    'Utmattet'

  const color =
    readiness >= 70 ? '#4ade80' :
    readiness >= 55 ? '#86efac' :
    readiness >= 40 ? '#facc15' :
    readiness >= 25 ? '#fb923c' :
    '#f87171'

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center w-12">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2"
          style={{ borderColor: color, color }}
        >
          {Math.round(readiness)}
        </div>
        <span className="text-xs mt-1" style={{ color }}>{label}</span>
      </div>
      <div className="flex-1">
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${readiness}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-zinc-500">CTL {ctl.toFixed(0)}</span>
          <span className="text-xs text-zinc-500">ATL {atl.toFixed(0)}</span>
          <span className="text-xs" style={{ color }}>TSB {tsb > 0 ? '+' : ''}{tsb.toFixed(0)}</span>
        </div>
      </div>
    </div>
  )
}
