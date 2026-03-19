import Link from 'next/link'
import { getActivities, getEvents } from '@/lib/intervals'
import { buildFitnessTimeline } from '@/lib/fitness'
import { MATHIAS, KAROLINE } from '@/lib/athletes'
import ReadinessBar from '@/components/ReadinessBar'

async function fetchForAthlete(athleteId: string, apiKey: string, path: string, params?: Record<string, string>) {
  const base = process.env.INTERVALS_BASE_URL || 'https://intervals.icu/api/v1'
  const url = new URL(`${base}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  const res = await fetch(url.toString(), { headers: { Authorization: `Basic ${auth}` }, next: { revalidate: 300 } })
  if (!res.ok) return []
  return res.json()
}

function dateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000)
}

function programWeek(): number {
  return Math.max(1, Math.ceil((new Date().getTime() - new Date('2026-02-23').getTime()) / 86400000 / 7) + 1)
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}t${m > 0 ? ` ${m}m` : ''}` : `${m}min`
}

function dayName(dateStr: string): string {
  return ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'][new Date(dateStr).getDay()]
}

const SPORT_COLORS: Record<string, string> = {
  Swim: '#38bdf8', Ride: '#f97316', VirtualRide: '#f97316',
  Run: '#4ade80', VirtualRun: '#4ade80', WeightTraining: '#facc15',
}

export default async function HomePage() {
  const today = dateStr(0)
  const dayOfWeek = (new Date().getDay() + 6) % 7
  const thisSun = dateStr(6 - dayOfWeek)

  const [mathiasActs, mathiasEvents, karolineActs, karolineEvents] = await Promise.all([
    getActivities(dateStr(-42), today),
    getEvents(today, thisSun),
    fetchForAthlete(KAROLINE.id, KAROLINE.apiKey, `/athlete/${KAROLINE.id}/activities`, { oldest: dateStr(-42), newest: today }),
    fetchForAthlete(KAROLINE.id, KAROLINE.apiKey, `/athlete/${KAROLINE.id}/events`, { oldest: today, newest: thisSun }),
  ])

  // Fitness for begge
  const mFitness = buildFitnessTimeline(mathiasActs, mathiasEvents, 0)
  const kFitness = buildFitnessTimeline(karolineActs, karolineEvents, 0)
  const mToday = mFitness.filter(d => !d.projected).at(-1)
  const kToday = kFitness.filter(d => !d.projected).at(-1)

  const mAtl = mToday?.totalAtl ?? 0, mCtl = mToday?.totalCtl ?? 0, mTsb = mCtl - mAtl
  const kAtl = kToday?.totalAtl ?? 0, kCtl = kToday?.totalCtl ?? 0, kTsb = kCtl - kAtl

  // Dagens økter
  const mTodays = mathiasEvents.filter((e: { start_date_local: string; paired_activity_id?: string }) =>
    e.start_date_local.startsWith(today) && !e.paired_activity_id
  )
  const kTodays = karolineEvents.filter((e: { start_date_local: string; paired_activity_id?: string }) =>
    e.start_date_local.startsWith(today) && !e.paired_activity_id
  )

  const daysLeft = daysUntil('2026-08-08')
  const pWeek = programWeek()

  return (
    <main className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 sticky top-0 z-20 bg-zinc-900/95 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight">Triathlon Coach</h1>
            <p className="text-xs text-zinc-500">Uke {pWeek} av 24</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold text-orange-400">{daysLeft}</div>
              <div className="text-xs text-zinc-500">dager til race</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">

        {/* Dagsoversikt — begge side om side */}
        <section>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">I dag — {new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mathias */}
            <Link href="/mathias" className="bg-zinc-800 rounded-xl p-4 hover:bg-zinc-750 transition-colors group block">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MATHIAS.color }} />
                  <span className="font-semibold text-zinc-200">Mathias</span>
                </div>
                <span className="text-xs text-zinc-500 group-hover:text-zinc-400">Se detaljer →</span>
              </div>
              <ReadinessBar tsb={mTsb} atl={mAtl} ctl={mCtl} athleteColor={MATHIAS.color} name={MATHIAS.name} />
              <div className="mt-3 space-y-2">
                {mTodays.length > 0 ? mTodays.map((e: { id: number; start_date_local: string; type: string; name: string; moving_time: number; icu_training_load: number }) => (
                  <div key={e.id} className="flex items-center gap-2.5 p-2 bg-zinc-700/40 rounded-lg">
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: SPORT_COLORS[e.type] || '#71717a' }} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">{e.name}</div>
                      <div className="flex gap-2 mt-0.5">
                        {e.moving_time > 0 && <span className="text-xs text-zinc-500">{formatTime(e.moving_time)}</span>}
                        {e.icu_training_load > 0 && <span className="text-xs text-zinc-500">TSS {e.icu_training_load}</span>}
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-zinc-500 py-1">Hviledag — ingen økt planlagt</p>
                )}
              </div>
            </Link>

            {/* Karoline */}
            <Link href="/karoline" className="bg-zinc-800 rounded-xl p-4 hover:bg-zinc-750 transition-colors group block">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: KAROLINE.color }} />
                  <span className="font-semibold text-zinc-200">Karoline</span>
                </div>
                <span className="text-xs text-zinc-500 group-hover:text-zinc-400">Se detaljer →</span>
              </div>
              <ReadinessBar tsb={kTsb} atl={kAtl} ctl={kCtl} athleteColor={KAROLINE.color} name={KAROLINE.name} />
              <div className="mt-3 space-y-2">
                {kTodays.length > 0 ? kTodays.map((e: { id: number; start_date_local: string; type: string; name: string; moving_time: number; icu_training_load: number }) => (
                  <div key={e.id} className="flex items-center gap-2.5 p-2 bg-zinc-700/40 rounded-lg">
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: SPORT_COLORS[e.type] || '#71717a' }} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">{e.name}</div>
                      <div className="flex gap-2 mt-0.5">
                        {e.moving_time > 0 && <span className="text-xs text-zinc-500">{formatTime(e.moving_time)}</span>}
                        {e.icu_training_load > 0 && <span className="text-xs text-zinc-500">TSS {e.icu_training_load}</span>}
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-zinc-500 py-1">Ingen planlagte økter i dag</p>
                )}
              </div>
            </Link>
          </div>
        </section>

        {/* Navigasjon til profiler */}
        <section>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Profiler</div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/mathias"
              className="bg-zinc-800 rounded-xl p-5 flex items-center gap-4 hover:bg-zinc-750 transition-all hover:ring-1 hover:ring-orange-500/40 group"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: MATHIAS.color + '20', color: MATHIAS.color }}>
                M
              </div>
              <div>
                <div className="font-semibold text-zinc-200 group-hover:text-white">Mathias</div>
                <div className="text-xs text-zinc-500">Olympisk triatlon · 8. aug 2026</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs" style={{ color: MATHIAS.color }}>CTL {mCtl.toFixed(0)}</span>
                  <span className={`text-xs ${mTsb > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                    TSB {mTsb > 0 ? '+' : ''}{mTsb.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="ml-auto text-zinc-600 group-hover:text-zinc-400">→</div>
            </Link>

            <Link
              href="/karoline"
              className="bg-zinc-800 rounded-xl p-5 flex items-center gap-4 hover:bg-zinc-750 transition-all hover:ring-1 hover:ring-fuchsia-500/40 group"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: KAROLINE.color + '20', color: KAROLINE.color }}>
                K
              </div>
              <div>
                <div className="font-semibold text-zinc-200 group-hover:text-white">Karoline</div>
                <div className="text-xs text-zinc-500">Løp + sykkel · Sub-50 10k · Sub-2t halvmaraton</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs" style={{ color: KAROLINE.color }}>CTL {kCtl.toFixed(0)}</span>
                  <span className={`text-xs ${kTsb > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                    TSB {kTsb > 0 ? '+' : ''}{kTsb.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="ml-auto text-zinc-600 group-hover:text-zinc-400">→</div>
            </Link>
          </div>
        </section>

        <footer className="text-xs text-zinc-700 text-center pb-4">
          Data fra intervals.icu · Revalideres hvert 5. min
        </footer>
      </div>
    </main>
  )
}
