'use client'
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { FitnessPoint } from '@/lib/fitness'

type Props = {
  data: FitnessPoint[]
  raceDate?: string
  raceCtlTarget?: number
  athleteColor: string
  goals?: { label: string; date: string }[]
}

const fmt = (d: string) => {
  const dt = new Date(d)
  return `${dt.getDate()}.${dt.getMonth() + 1}`
}

// Filtrer til annenhver uke for X-akse
function filterForAxis(data: FitnessPoint[]) {
  return data.filter((_, i) => i % 14 === 0)
}

export default function FitnessChart({ data, raceDate, raceCtlTarget, athleteColor, goals }: Props) {
  if (!data.length) return null

  // Skill historikk og fremskrevet
  const historical = data.filter(d => !d.projected)
  const projected = data.filter(d => d.projected)

  // Sammenslå for chart (projected som eget felt)
  const chartData = data.map(d => ({
    date: d.date,
    bikeCtl: Math.round(d.bikeCtl * 10) / 10,
    runCtl: Math.round(d.runCtl * 10) / 10,
    swimCtl: Math.round(d.swimCtl * 10) / 10,
    totalCtl: Math.round(d.totalCtl * 10) / 10,
    tsb: Math.round(d.tsb * 10) / 10,
    projBikeCtl: d.projected ? Math.round(d.bikeCtl * 10) / 10 : null,
    projRunCtl: d.projected ? Math.round(d.runCtl * 10) / 10 : null,
    projTotalCtl: d.projected ? Math.round(d.totalCtl * 10) / 10 : null,
  }))

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Fitness-utvikling</h3>
        <div className="flex gap-3 text-xs text-zinc-500">
          <span>— historikk</span>
          <span className="opacity-50">- - fremskrevet</span>
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Grenspesifikk CTL · Løp-TSS vektet ×1.3 · Stiplet = planlagte økter
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
          <XAxis
            dataKey="date"
            tickFormatter={fmt}
            ticks={filterForAxis(data).map(d => d.date)}
            tick={{ fill: '#52525b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#52525b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#a1a1aa', marginBottom: 4 }}
            labelFormatter={(v) => fmt(v)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => {
              const labels: Record<string, string> = {
                bikeCtl: 'Sykkel CTL', runCtl: 'Løp CTL', swimCtl: 'Svøm CTL',
                totalCtl: 'Total CTL', tsb: 'TSB',
                projBikeCtl: 'Sykkel (proj)', projRunCtl: 'Løp (proj)', projTotalCtl: 'Total (proj)',
              }
              return [typeof v === 'number' ? v.toFixed(1) : v, labels[String(name)] ?? name]
            }}
          />

          {/* TSB som bakgrunns-area */}
          <Area dataKey="tsb" fill="#4ade8015" stroke="none" />

          {/* Historiske linjer */}
          <Line dataKey="bikeCtl" stroke="#f97316" strokeWidth={2} dot={false} name="bikeCtl" connectNulls />
          <Line dataKey="runCtl" stroke="#4ade80" strokeWidth={2} dot={false} name="runCtl" connectNulls />
          <Line dataKey="swimCtl" stroke="#38bdf8" strokeWidth={1.5} dot={false} name="swimCtl" connectNulls />
          <Line dataKey="totalCtl" stroke={athleteColor} strokeWidth={2.5} dot={false} name="totalCtl" strokeOpacity={0.7} connectNulls />

          {/* Fremskrevne linjer (stiplet) */}
          <Line dataKey="projBikeCtl" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
          <Line dataKey="projRunCtl" stroke="#4ade80" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
          <Line dataKey="projTotalCtl" stroke={athleteColor} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />

          {/* I dag */}
          <ReferenceLine x={todayStr} stroke="#52525b" strokeDasharray="2 4" />

          {/* Race/mål-dato */}
          {raceDate && (
            <ReferenceLine x={raceDate} stroke="#f87171" strokeWidth={1.5} strokeDasharray="3 3"
              label={{ value: 'Race', fill: '#f87171', fontSize: 10, position: 'top' }} />
          )}

          {/* Mål-CTL */}
          {raceCtlTarget && (
            <ReferenceLine y={raceCtlTarget} stroke="#facc15" strokeDasharray="3 3" strokeWidth={1}
              label={{ value: `Mål CTL ${raceCtlTarget}`, fill: '#facc15', fontSize: 9, position: 'right' }} />
          )}

          {/* Ekstra mål-datoer */}
          {goals?.map(g => (
            <ReferenceLine key={g.label} x={g.date} stroke="#a78bfa" strokeDasharray="2 4"
              label={{ value: g.label, fill: '#a78bfa', fontSize: 9, position: 'top' }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Forklaring */}
      <div className="flex flex-wrap gap-4 mt-3">
        {[
          ['Sykkel', '#f97316'],
          ['Løp (×1.3)', '#4ade80'],
          ['Svøm', '#38bdf8'],
          ['Total', athleteColor],
        ].map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: c }} />
            <span className="text-xs text-zinc-500">{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
