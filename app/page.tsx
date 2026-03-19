import Link from 'next/link'
import { getActivities, getEvents } from '@/lib/intervals'
import { buildFitnessTimeline } from '@/lib/fitness'
import { MATHIAS, KAROLINE } from '@/lib/athletes'
import PushWeekButton from '@/components/PushWeekButton'

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

function nextMondaySunday(): { mon: string; sun: string } {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow + 7)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { mon: mon.toISOString().split('T')[0], sun: sun.toISOString().split('T')[0] }
}

// Bygg en 7-dagers kalender (man–søn denne uken)
function getWeekDays(): string[] {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

const SPORT_COLORS: Record<string, string> = {
  Swim: '#0ea5e9', Ride: '#f97316', VirtualRide: '#f97316',
  Run: '#22c55e', VirtualRun: '#22c55e', WeightTraining: '#a855f7',
  NordicSki: '#8b5cf6',
}

const SPORT_BG: Record<string, string> = {
  Swim: '#e0f2fe', Ride: '#fff7ed', VirtualRide: '#fff7ed',
  Run: '#f0fdf4', VirtualRun: '#f0fdf4', WeightTraining: '#faf5ff',
  NordicSki: '#ede9fe',
}

const DAY_NAMES = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

const NEXT_WORKOUT_WHY: Record<string, string> = {
  terskel: 'Terskelarbeid er kjernen — bygger FTP og kritisk hastighet.',
  threshold: 'Terskelarbeid er kjernen — bygger FTP og kritisk hastighet.',
  'sweet spot': 'Sweet spot: maks stimulans per treningsminutt.',
  sweetspot: 'Sweet spot: maks stimulans per treningsminutt.',
  aerob: 'Aerobt volum bygger mitokondrier og fettforbrenning.',
  easy: 'Aktiv restitusjon — bena henter seg, uten ny stress.',
  rolig: 'Aktiv restitusjon — bena henter seg, uten ny stress.',
  intervall: 'Intervaller presser VO₂max og løpsøkonomi.',
  brick: 'Brick: kroppen lærer T2-overgangen fra sykkel til løp.',
  svøm: 'Svøm er flaskehalsen — teknikk og terskel nå gir lavere laktat i T1.',
  swim: 'Svøm er flaskehalsen — teknikk og terskel nå gir lavere laktat i T1.',
  styrke: 'Styrke forbedrer løps- og sykkeløkonomi uten VO₂-kostnad.',
}

function getWhyText(name: string): string {
  const n = name.toLowerCase()
  for (const [key, val] of Object.entries(NEXT_WORKOUT_WHY)) {
    if (n.includes(key)) return val
  }
  return 'Følg planen, hold intensitetssoner — konsistens er alt.'
}

type EventItem = {
  id: number
  start_date_local: string
  type: string
  name: string
  moving_time: number
  icu_training_load: number
  paired_activity_id?: string
  description?: string
}

export default async function HomePage() {
  const today = dateStr(0)
  const dayOfWeek = (new Date().getDay() + 6) % 7
  const thisSun = dateStr(6 - dayOfWeek)
  const { mon: nextMon, sun: nextSun } = nextMondaySunday()
  const weekDays = getWeekDays()

  const [mathiasActs, mathiasEventsWeek, mathiasEventsNext, mathiasWeekActs,
         karolineActs, karolineEventsWeek, karolineEventsNext, karolineWeekActs] =
    await Promise.all([
      getActivities(dateStr(-42), today),
      getEvents(weekDays[0], thisSun),
      getEvents(nextMon, nextSun),
      getActivities(weekDays[0], today),
      fetchForAthlete(KAROLINE.id, KAROLINE.apiKey, `/athlete/${KAROLINE.id}/activities`, { oldest: dateStr(-42), newest: today }),
      fetchForAthlete(KAROLINE.id, KAROLINE.apiKey, `/athlete/${KAROLINE.id}/events`, { oldest: weekDays[0], newest: thisSun }),
      fetchForAthlete(KAROLINE.id, KAROLINE.apiKey, `/athlete/${KAROLINE.id}/events`, { oldest: nextMon, newest: nextSun }),
      fetchForAthlete(KAROLINE.id, KAROLINE.apiKey, `/athlete/${KAROLINE.id}/activities`, { oldest: weekDays[0], newest: today }),
    ])

  // Fitness
  const mFitness = buildFitnessTimeline(mathiasActs, [], 0)
  const kFitness = buildFitnessTimeline(karolineActs, [], 0)
  const mToday = mFitness.filter(d => !d.projected).at(-1)
  const kToday = kFitness.filter(d => !d.projected).at(-1)
  const mCtl = mToday?.totalCtl ?? 0, mAtl = mToday?.totalAtl ?? 0, mTsb = mCtl - mAtl
  const kCtl = kToday?.totalCtl ?? 0, kAtl = kToday?.totalAtl ?? 0, kTsb = kCtl - kAtl

  // Readiness 0–100
  const mReadiness = Math.min(100, Math.max(0, 50 + mTsb * 2))
  const kReadiness = Math.min(100, Math.max(0, 50 + kTsb * 2))

  function readinessColor(r: number) {
    if (r >= 65) return '#22c55e'
    if (r >= 45) return '#f59e0b'
    return '#ef4444'
  }
  function readinessLabel(r: number) {
    if (r >= 70) return 'Toppform'
    if (r >= 55) return 'Klar'
    if (r >= 40) return 'Nøytral'
    if (r >= 25) return 'Sliten'
    return 'Trenger hvile'
  }

  // Neste uplanlagte økt per utøver
  const mNextEvent = mathiasEventsWeek.find((e: EventItem) => !e.paired_activity_id && e.start_date_local >= today)
    ?? mathiasEventsNext[0]
  const kNextEvent = karolineEventsWeek.find((e: EventItem) => !e.paired_activity_id && e.start_date_local >= today)
    ?? karolineEventsNext[0]

  // Bygg uke-kart: kombiner events (planlagte) og activities (gjennomførte)
  // Activities som allerede er paired med et event vises ikke dobbelt
  type CalItem = { id: number | string; type: string; name: string; moving_time: number; icu_training_load: number; done: boolean }
  const weekMap = new Map<string, { mathias: CalItem[]; karoline: CalItem[] }>()
  for (const d of weekDays) weekMap.set(d, { mathias: [], karoline: [] })

  // Samle paired activity IDs fra events (for å unngå dobbel-visning)
  const mPairedIds = new Set((mathiasEventsWeek as EventItem[]).map(e => e.paired_activity_id).filter(Boolean))
  const kPairedIds = new Set((karolineEventsWeek as EventItem[]).map(e => e.paired_activity_id).filter(Boolean))

  // Mathias events
  for (const e of mathiasEventsWeek as EventItem[]) {
    const d = e.start_date_local.split('T')[0]
    if (weekMap.has(d)) weekMap.get(d)!.mathias.push({ id: e.id, type: e.type, name: e.name, moving_time: e.moving_time, icu_training_load: e.icu_training_load, done: !!e.paired_activity_id })
  }
  // Mathias activities som IKKE er paired (dvs. ikke allerede vist via event)
  for (const a of (mathiasWeekActs as unknown as EventItem[])) {
    if (mPairedIds.has(String(a.id))) continue
    const d = a.start_date_local.split('T')[0]
    if (weekMap.has(d)) weekMap.get(d)!.mathias.push({ id: a.id, type: a.type, name: a.name, moving_time: a.moving_time, icu_training_load: a.icu_training_load, done: true })
  }

  // Karoline events
  for (const e of karolineEventsWeek as EventItem[]) {
    const d = e.start_date_local.split('T')[0]
    if (weekMap.has(d)) weekMap.get(d)!.karoline.push({ id: e.id, type: e.type, name: e.name, moving_time: e.moving_time, icu_training_load: e.icu_training_load, done: !!e.paired_activity_id })
  }
  // Karoline activities som ikke er paired
  for (const a of (karolineWeekActs as unknown as EventItem[])) {
    if (kPairedIds.has(String(a.id))) continue
    const d = a.start_date_local.split('T')[0]
    if (weekMap.has(d)) weekMap.get(d)!.karoline.push({ id: a.id, type: a.type, name: a.name, moving_time: a.moving_time, icu_training_load: a.icu_training_load, done: true })
  }

  const daysLeft = daysUntil('2026-08-08')
  const pWeek = programWeek()
  const todayNorwegian = new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <main className="min-h-screen bg-[#f8f7f4]">
      {/* Header — lys med gradient-stripe */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white text-sm font-bold">T</div>
            <div>
              <h1 className="text-sm font-bold text-stone-800 leading-tight">Triathlon Coach</h1>
              <p className="text-xs text-stone-400">Uke {pWeek} av 24</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-stone-400 capitalize">{todayNorwegian}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5 text-right">
              <div className="text-xl font-bold text-orange-500 leading-none">{daysLeft}</div>
              <div className="text-xs text-orange-400">dager igjen</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* DAGSOVERSIKT — to kort, fargerike */}
        <section>
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">I dag</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Mathias */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
              {/* Fargetopp */}
              <div className="h-1.5 bg-gradient-to-r from-orange-400 to-amber-300" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">M</div>
                    <div>
                      <div className="font-semibold text-stone-800">Mathias</div>
                      <div className="text-xs text-stone-400">Olympisk triatlon · 8. aug</div>
                    </div>
                  </div>
                  {/* Readiness-sirkel */}
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                      style={{ borderColor: readinessColor(mReadiness), color: readinessColor(mReadiness) }}>
                      {Math.round(mReadiness)}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: readinessColor(mReadiness) }}>
                      {readinessLabel(mReadiness)}
                    </div>
                  </div>
                </div>

                {/* CTL / TSB */}
                <div className="flex gap-3 mb-3">
                  <div className="bg-orange-50 rounded-lg px-2.5 py-1.5 flex-1 text-center">
                    <div className="text-xs text-stone-400">CTL</div>
                    <div className="text-base font-bold text-orange-500">{mCtl.toFixed(0)}</div>
                  </div>
                  <div className="bg-stone-50 rounded-lg px-2.5 py-1.5 flex-1 text-center">
                    <div className="text-xs text-stone-400">TSB</div>
                    <div className={`text-base font-bold ${mTsb > 0 ? 'text-green-600' : mTsb < -10 ? 'text-red-500' : 'text-amber-500'}`}>
                      {mTsb > 0 ? '+' : ''}{mTsb.toFixed(0)}
                    </div>
                  </div>
                  <div className="bg-stone-50 rounded-lg px-2.5 py-1.5 flex-1 text-center">
                    <div className="text-xs text-stone-400">ATL</div>
                    <div className="text-base font-bold text-stone-600">{mAtl.toFixed(0)}</div>
                  </div>
                </div>

                {/* Dagens planlagte */}
                {(() => {
                  const todays = mathiasEventsWeek.filter((e: EventItem) => e.start_date_local.startsWith(today))
                  if (todays.length === 0) return <p className="text-sm text-stone-400 py-1">Hviledag — ingen økt planlagt i dag</p>
                  return (
                    <div className="space-y-2">
                      {todays.map((e: EventItem) => (
                        <div key={e.id} className="rounded-xl p-2.5 flex items-center gap-2.5"
                          style={{ backgroundColor: SPORT_BG[e.type] || '#f5f5f4' }}>
                          <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: SPORT_COLORS[e.type] || '#a1a1aa' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-stone-800 truncate">{e.name}</div>
                            <div className="flex gap-2 mt-0.5">
                              {e.moving_time > 0 && <span className="text-xs text-stone-500">{formatTime(e.moving_time)}</span>}
                              {e.icu_training_load > 0 && <span className="text-xs text-stone-400">TSS {e.icu_training_load}</span>}
                              {e.paired_activity_id && <span className="text-xs text-green-600 font-medium">✓ gjennomført</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Neste økt (hvis ikke i dag) */}
                {mNextEvent && !mNextEvent.start_date_local.startsWith(today) && (
                  <div className="mt-3 pt-3 border-t border-stone-100">
                    <div className="text-xs text-stone-400 mb-1">Neste økt</div>
                    <div className="flex items-start gap-2">
                      <div className="w-1 h-full min-h-[2rem] rounded-full shrink-0 mt-0.5" style={{ backgroundColor: SPORT_COLORS[mNextEvent.type] || '#a1a1aa' }} />
                      <div>
                        <div className="text-sm font-medium text-stone-700">{mNextEvent.name}</div>
                        <div className="text-xs text-stone-400 mt-0.5">
                          {new Date(mNextEvent.start_date_local).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'short' })}
                          {mNextEvent.moving_time > 0 && ` · ${formatTime(mNextEvent.moving_time)}`}
                        </div>
                        <div className="text-xs text-stone-500 mt-1 italic">{getWhyText(mNextEvent.name)}</div>
                      </div>
                    </div>
                  </div>
                )}

                <Link href="/mathias" className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium py-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                  Full profil →
                </Link>
              </div>
            </div>

            {/* Karoline */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-fuchsia-400 to-pink-300" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-fuchsia-100 flex items-center justify-center text-sm font-bold text-fuchsia-600">K</div>
                    <div>
                      <div className="font-semibold text-stone-800">Karoline</div>
                      <div className="text-xs text-stone-400">Løp + sykkel · sub-50 10k</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                      style={{ borderColor: readinessColor(kReadiness), color: readinessColor(kReadiness) }}>
                      {Math.round(kReadiness)}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: readinessColor(kReadiness) }}>
                      {readinessLabel(kReadiness)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mb-3">
                  <div className="bg-fuchsia-50 rounded-lg px-2.5 py-1.5 flex-1 text-center">
                    <div className="text-xs text-stone-400">CTL</div>
                    <div className="text-base font-bold text-fuchsia-500">{kCtl.toFixed(0)}</div>
                  </div>
                  <div className="bg-stone-50 rounded-lg px-2.5 py-1.5 flex-1 text-center">
                    <div className="text-xs text-stone-400">TSB</div>
                    <div className={`text-base font-bold ${kTsb > 0 ? 'text-green-600' : kTsb < -10 ? 'text-red-500' : 'text-amber-500'}`}>
                      {kTsb > 0 ? '+' : ''}{kTsb.toFixed(0)}
                    </div>
                  </div>
                  <div className="bg-stone-50 rounded-lg px-2.5 py-1.5 flex-1 text-center">
                    <div className="text-xs text-stone-400">ATL</div>
                    <div className="text-base font-bold text-stone-600">{kAtl.toFixed(0)}</div>
                  </div>
                </div>

                {(() => {
                  const todayEvents = karolineEventsWeek.filter((e: EventItem) => e.start_date_local.startsWith(today))
                  const todayActs = (karolineWeekActs as unknown as EventItem[]).filter(a => a.start_date_local.startsWith(today) && !kPairedIds.has(String(a.id)))
                  const todays = [...todayEvents, ...todayActs]
                  if (todays.length === 0) return <p className="text-sm text-stone-400 py-1">Ingen planlagte økter i dag</p>
                  return (
                    <div className="space-y-2">
                      {todays.map((e: EventItem) => (
                        <div key={e.id} className="rounded-xl p-2.5 flex items-center gap-2.5"
                          style={{ backgroundColor: SPORT_BG[e.type] || '#f5f5f4' }}>
                          <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: SPORT_COLORS[e.type] || '#a1a1aa' }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-stone-800 truncate">{e.name}</div>
                            <div className="flex gap-2 mt-0.5">
                              {e.moving_time > 0 && <span className="text-xs text-stone-500">{formatTime(e.moving_time)}</span>}
                              {e.icu_training_load > 0 && <span className="text-xs text-stone-400">TSS {e.icu_training_load}</span>}
                              {(e.paired_activity_id || todayActs.some(a => a.id === e.id)) && <span className="text-xs text-green-600 font-medium">✓ gjennomført</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {kNextEvent && !kNextEvent.start_date_local.startsWith(today) && (
                  <div className="mt-3 pt-3 border-t border-stone-100">
                    <div className="text-xs text-stone-400 mb-1">Neste økt</div>
                    <div className="flex items-start gap-2">
                      <div className="w-1 h-full min-h-[2rem] rounded-full shrink-0 mt-0.5" style={{ backgroundColor: SPORT_COLORS[kNextEvent.type] || '#a1a1aa' }} />
                      <div>
                        <div className="text-sm font-medium text-stone-700">{kNextEvent.name}</div>
                        <div className="text-xs text-stone-400 mt-0.5">
                          {new Date(kNextEvent.start_date_local).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'short' })}
                          {kNextEvent.moving_time > 0 && ` · ${formatTime(kNextEvent.moving_time)}`}
                        </div>
                        <div className="text-xs text-stone-500 mt-1 italic">{getWhyText(kNextEvent.name)}</div>
                      </div>
                    </div>
                  </div>
                )}

                <Link href="/karoline" className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-fuchsia-500 hover:text-fuchsia-600 font-medium py-1.5 rounded-lg hover:bg-fuchsia-50 transition-colors">
                  Full profil →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* UKESKALENDER */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Denne uken</h2>
            <div className="flex items-center gap-3">
              <PushWeekButton events={mathiasEventsNext} athleteId={MATHIAS.id} apiKey={MATHIAS.apiKey} label="Push Mathias neste uke" />
              <PushWeekButton events={karolineEventsNext} athleteId={KAROLINE.id} apiKey={KAROLINE.apiKey} label="Push Karoline neste uke" />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
            {/* Dag-header */}
            <div className="grid grid-cols-7 border-b border-stone-100">
              {weekDays.map((d, i) => {
                const isToday = d === today
                return (
                  <div key={d} className={`p-2 text-center border-r border-stone-100 last:border-r-0 ${isToday ? 'bg-orange-50' : ''}`}>
                    <div className={`text-xs font-semibold ${isToday ? 'text-orange-500' : 'text-stone-400'}`}>{DAY_NAMES[i]}</div>
                    <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-orange-600' : 'text-stone-600'}`}>
                      {new Date(d).getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Mathias-rad */}
            <div className="grid grid-cols-7 border-b border-stone-100">
              {weekDays.map((d) => {
                const cell = weekMap.get(d)!
                return (
                  <div key={d} className={`p-1.5 border-r border-stone-100 last:border-r-0 min-h-[4.5rem] ${d === today ? 'bg-orange-50/50' : ''}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                      <span className="text-xs text-stone-400 font-medium">M</span>
                    </div>
                    <div className="space-y-0.5">
                      {cell.mathias.length === 0
                        ? <div className="text-xs text-stone-300 leading-tight">—</div>
                        : cell.mathias.map((e) => (
                          <div key={e.id}
                            className="text-xs leading-tight rounded px-1 py-0.5 truncate"
                            style={{ backgroundColor: SPORT_COLORS[e.type] + '20', color: e.done ? '#16a34a' : (SPORT_COLORS[e.type] || '#78716c') }}
                            title={e.name}>
                            {e.done ? '✓ ' : ''}{e.name.replace(/^(Sykkel|Løp|Svøm|Zwift - )[:·\s]*/i, '').substring(0, 14) || e.name.substring(0, 14)}
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Karoline-rad */}
            <div className="grid grid-cols-7">
              {weekDays.map((d) => {
                const cell = weekMap.get(d)!
                return (
                  <div key={d} className={`p-1.5 border-r border-stone-100 last:border-r-0 min-h-[4.5rem] ${d === today ? 'bg-fuchsia-50/50' : ''}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                      <span className="text-xs text-stone-400 font-medium">K</span>
                    </div>
                    <div className="space-y-0.5">
                      {cell.karoline.length === 0
                        ? <div className="text-xs text-stone-300 leading-tight">—</div>
                        : cell.karoline.map((e) => (
                          <div key={e.id}
                            className="text-xs leading-tight rounded px-1 py-0.5 truncate"
                            style={{ backgroundColor: SPORT_COLORS[e.type] + '20', color: e.done ? '#16a34a' : (SPORT_COLORS[e.type] || '#78716c') }}
                            title={e.name}>
                            {e.done ? '✓ ' : ''}{e.name.replace(/^(Sykkel|Løp|Svøm|Zwift - )[:·\s]*/i, '').substring(0, 14) || e.name.substring(0, 14)}
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Fargeforklaring */}
        <div className="flex flex-wrap gap-4">
          {[['Svøm', '#0ea5e9'], ['Sykkel', '#f97316'], ['Løp', '#22c55e'], ['Styrke', '#a855f7']].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c + '40', borderLeft: `3px solid ${c}` }} />
              <span className="text-xs text-stone-400">{l}</span>
            </div>
          ))}
        </div>

        <footer className="text-xs text-stone-300 text-center pb-4">
          Data fra intervals.icu · Oppdateres hvert 5. min
        </footer>
      </div>
    </main>
  )
}
