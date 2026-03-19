import Link from 'next/link'
import AiChat from './AiChat'
import FitnessChart from './FitnessChart'
import { Athlete, SPORT_COLOR, SPORT_LABEL } from '@/lib/athletes'
import { estimateCalories } from '@/lib/calories'
import { dateStr, type Activity, type Event, type FitnessPoint } from '@/lib/intervals'

type Props = {
  athlete: Athlete
  acts: Activity[]
  events: Event[]
  fitness: FitnessPoint[]
  wellness: any[]
  profile: any
}

function formatTime(secs: number) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}t ${m > 0 ? m + 'm' : ''}`.trim() : `${m}min`
}

function formatDist(m: number, type?: string) {
  if (!m) return ''
  if (type === 'Swim') return `${m}m`
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

const today = dateStr(0)

export default function ProfilePage({ athlete, acts, events, fitness, wellness, profile }: Props) {
  const fitnessLast = (fitness as FitnessPoint[]).at(-1)
  const ctl = fitnessLast?.ctl ?? 0
  const atl = fitnessLast?.atl ?? 0
  const form = ctl - atl
  const readiness = Math.min(100, Math.max(0, Math.round(50 + form * 1.5)))

  function readColor(r: number) {
    if (r >= 65) return '#16a34a'
    if (r >= 45) return '#d97706'
    return '#dc2626'
  }
  function readLabel(r: number) {
    if (r >= 70) return 'Toppform'
    if (r >= 55) return 'Klar'
    if (r >= 40) return 'Nøytral'
    if (r >= 25) return 'Sliten'
    return 'Trenger hvile'
  }

  // Wellness
  const latestWellness = wellness.filter((w: any) => w.weight).at(-1)
  const weight = latestWellness?.weight ?? athlete.weightKg
  const hrv = wellness.filter((w: any) => w.hrv).at(-1)?.hrv
  const restHR = wellness.filter((w: any) => w.restingHR).at(-1)?.restingHR

  // Dagens plan
  const todayEvents = events.filter((e: Event) => e.start_date_local?.startsWith(today))
  const todayTss = todayEvents.reduce((s, e) => s + (e.icu_training_load ?? 0), 0)
  const cal = estimateCalories({ weightKg: weight, heightCm: athlete.heightCm, age: athlete.age, plannedTss: todayTss, sport: todayEvents[0]?.type })

  // Ukesplan (neste 21 dager)
  const upcomingByDay = events.reduce((acc: Record<string, Event[]>, e: Event) => {
    const d = e.start_date_local?.split('T')[0]
    if (!d) return acc
    if (!acc[d]) acc[d] = []
    acc[d].push(e)
    return acc
  }, {})

  // Siste 10 aktiviteter
  const recent = [...acts].reverse().slice(0, 10)

  // Sportfordeling siste 30 dager
  const last30 = acts.filter(a => a.start_date_local != null && a.start_date_local >= dateStr(-30))
  const bySport = last30.reduce((acc: Record<string, { count: number; time: number }>, a: Activity) => {
    if (!acc[a.type]) acc[a.type] = { count: 0, time: 0 }
    acc[a.type].count++
    acc[a.type].time += a.moving_time ?? 0
    return acc
  }, {})

  const daysLeft = daysUntil(athlete.mainGoalDate)
  const goalDate = new Date(athlete.mainGoalDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      {/* Header */}
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-blue-600 transition-colors text-sm">← Tilbake</Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
              style={{ backgroundColor: athlete.color }}>
              {athlete.name[0]}
            </div>
            <span className="font-bold text-gray-800 text-lg">{athlete.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-center">
              <div className="text-xs text-gray-400">CTL</div>
              <div className="text-sm font-bold" style={{ color: athlete.color }}>{ctl.toFixed(0)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-center">
              <div className="text-xs text-gray-400">Form</div>
              <div className={`text-sm font-bold ${form > 5 ? 'text-green-600' : form < -15 ? 'text-red-500' : 'text-amber-500'}`}>
                {form > 0 ? '+' : ''}{form.toFixed(0)}
              </div>
            </div>
            <div className="text-right ml-2">
              <div className="text-2xl font-bold leading-none" style={{ color: athlete.color }}>{daysLeft}</div>
              <div className="text-xs text-gray-400">dager til {athlete.mainGoal}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-5">

          {/* ── VENSTRE KOLONNE ── */}
          <div className="col-span-2 space-y-5">

            {/* Formkurve */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-4">Formutvikling</h2>
              <FitnessChart data={fitness as FitnessPoint[]} color={athlete.color} />
              <div className="flex gap-6 mt-3 text-xs text-gray-500">
                <span><span className="font-semibold" style={{ color: athlete.color }}>CTL</span> = treningsform (siste 42 dager)</span>
                <span><span className="font-semibold text-orange-400">ATL</span> = ferskt stress (7 dager)</span>
                <span><span className="font-semibold text-gray-500">Form</span> = CTL − ATL</span>
              </div>
            </div>

            {/* Ukesplan */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-4">Kommende plan</h2>
              {Object.keys(upcomingByDay).length === 0
                ? <p className="text-sm text-gray-400">Ingen planlagte økter</p>
                : (
                  <div className="space-y-2">
                    {Object.entries(upcomingByDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, evts]) => {
                      const isToday = day === today
                      return (
                        <div key={day} className={`rounded-xl p-3 ${isToday ? 'ring-2' : 'bg-gray-50'}`}
                          style={isToday ? { outline: `2px solid ${athlete.color}`, backgroundColor: athlete.colorBg } : {}}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-bold ${isToday ? '' : 'text-gray-500'}`}
                              style={isToday ? { color: athlete.color } : {}}>
                              {isToday ? 'I DAG' : new Date(day).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {(evts as Event[]).map(e => (
                              <div key={e.id} className="flex items-center gap-2.5 bg-white rounded-lg px-3 py-2 shadow-sm">
                                <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: SPORT_COLOR[e.type] ?? '#6b7280' }} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-800">{e.name}</div>
                                  <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                                    {(e.moving_time ?? 0) > 0 && <span>{formatTime(e.moving_time ?? 0)}</span>}
                                    {(e.icu_training_load ?? 0) > 0 && <span>TSS {e.icu_training_load}</span>}
                                    {e.description && <span className="truncate max-w-[200px]">{e.description}</span>}
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                  {e.paired_activity_id && <span className="text-xs text-green-600 font-medium">✓</span>}
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: SPORT_COLOR[e.type] ?? '#6b7280' }}>
                                    {SPORT_LABEL[e.type] ?? e.type}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </div>

            {/* Siste aktiviteter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-4">Siste aktiviteter</h2>
              <div className="space-y-2">
                {recent.map((a: Activity) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: SPORT_COLOR[a.type] ?? '#6b7280' }}>
                      {(SPORT_LABEL[a.type ?? ''] ?? a.type ?? '').substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{a.name}</div>
                      <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                        <span>{new Date(a.start_date_local).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        {(a.moving_time ?? 0) > 0 && <span>{formatTime(a.moving_time ?? 0)}</span>}
                        {(a.distance ?? 0) > 0 && <span>{formatDist(a.distance ?? 0, a.type)}</span>}
                        {a.average_heartrate && <span>❤️ {Math.round(a.average_heartrate)}</span>}
                        {a.average_watts && <span>⚡ {Math.round(a.average_watts)}W</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-gray-700">{a.icu_training_load?.toFixed(0) ?? '—'}</div>
                      <div className="text-xs text-gray-400">TSS</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── HØYRE KOLONNE ── */}
          <div className="space-y-5">

            {/* Dagsform */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-3">Dagsform</h2>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full border-[3px] flex items-center justify-center text-lg font-bold"
                  style={{ borderColor: readColor(readiness), color: readColor(readiness) }}>
                  {readiness}
                </div>
                <div>
                  <div className="font-semibold" style={{ color: readColor(readiness) }}>{readLabel(readiness)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Basert på CTL/ATL</div>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className="h-full rounded-full" style={{ width: `${readiness}%`, backgroundColor: readColor(readiness) }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'CTL', value: ctl.toFixed(1), sub: 'fitness' },
                  { label: 'ATL', value: atl.toFixed(1), sub: 'fatigue' },
                  { label: 'Form', value: (form > 0 ? '+' : '') + form.toFixed(1), sub: 'TSB' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-2">
                    <div className="text-xs text-gray-400">{s.label}</div>
                    <div className="font-bold text-gray-800">{s.value}</div>
                    <div className="text-[10px] text-gray-300">{s.sub}</div>
                  </div>
                ))}
              </div>
              {(hrv || restHR || weight) && (
                <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
                  {weight && <div className="bg-gray-50 rounded-xl p-2"><div className="text-xs text-gray-400">Vekt</div><div className="font-bold text-gray-800 text-sm">{weight.toFixed(1)}</div><div className="text-[10px] text-gray-300">kg</div></div>}
                  {hrv && <div className="bg-gray-50 rounded-xl p-2"><div className="text-xs text-gray-400">HRV</div><div className="font-bold text-gray-800 text-sm">{Math.round(hrv)}</div><div className="text-[10px] text-gray-300">ms</div></div>}
                  {restHR && <div className="bg-gray-50 rounded-xl p-2"><div className="text-xs text-gray-400">Hvile-HF</div><div className="font-bold text-gray-800 text-sm">{Math.round(restHR)}</div><div className="text-[10px] text-gray-300">bpm</div></div>}
                </div>
              )}
            </div>

            {/* Mål og nedtelling */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-3">Mål</h2>
              <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: athlete.colorBg }}>
                <div className="text-sm font-semibold text-gray-700">{athlete.mainGoal}</div>
                <div className="text-xs text-gray-400 mt-0.5">{goalDate}</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold" style={{ color: athlete.color }}>{daysLeft}</span>
                  <span className="text-sm text-gray-400">dager igjen</span>
                </div>
              </div>
            </div>

            {/* Kalorier */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-3">Kalorier i dag</h2>
              <div className="text-3xl font-bold text-gray-800 mb-1">{cal.total.toLocaleString('nb-NO')}</div>
              <div className="text-xs text-gray-400 mb-3">kcal totalt{cal.training > 0 ? ` (${cal.training} fra trening)` : ''}</div>
              <div className="space-y-1.5">
                {[
                  { label: 'Karbohydrater', value: cal.carbs, unit: 'g', pct: 50 },
                  { label: 'Protein', value: cal.protein, unit: 'g', pct: 20 },
                  { label: 'Fett', value: cal.fat, unit: 'g', pct: 30 },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-500">{m.label}</span>
                      <span className="font-semibold text-gray-700">{m.value}g</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.pct}%`, backgroundColor: athlete.color + 'aa' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Treningsfordeling */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-3">Siste 30 dager</h2>
              <div className="space-y-2">
                {Object.entries(bySport).map(([type, stats]: [string, any]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SPORT_COLOR[type] ?? '#6b7280' }} />
                    <span className="text-sm text-gray-600 w-20 shrink-0">{SPORT_LABEL[type] ?? type}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min(100, (stats.time / 7200) * 100)}%`,
                        backgroundColor: SPORT_COLOR[type] ?? '#6b7280'
                      }} />
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right shrink-0">{stats.count}x · {formatTime(stats.time)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI-assistent */}
            <AiChat athleteId={athlete.id} athleteName={athlete.name} color={athlete.color} />
          </div>
        </div>
      </main>
    </div>
  )
}
