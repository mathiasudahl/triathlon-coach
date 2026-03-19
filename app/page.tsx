import Link from 'next/link'
import { MATHIAS, KAROLINE, SPORT_COLOR, SPORT_LABEL } from '@/lib/athletes'
import { getActivities, getEvents, getFitness, getWellness, dateStr, type Activity, type Event, type FitnessPoint } from '@/lib/intervals'
import { getOsloWeather } from '@/lib/weather'
import { estimateCalories } from '@/lib/calories'

// ─── helpers ────────────────────────────────────────────────────────────────

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

function weekDays(): string[] {
  const d = new Date()
  const dow = (d.getDay() + 6) % 7
  const mon = new Date(d)
  mon.setDate(d.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon)
    x.setDate(mon.getDate() + i)
    return x.toISOString().split('T')[0]
  })
}

function formatTime(secs: number) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}t ${m > 0 ? m + 'm' : ''}`.trim() : `${m}min`
}

function formatDist(m: number) {
  if (!m) return ''
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

const DAY_NO = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

// ─── component ──────────────────────────────────────────────────────────────

export default async function HomePage() {
  const today = dateStr(0)
  const days = weekDays()
  const monStr = days[0]
  const sunStr = days[6]

  const [
    mActs, mEvents, mFitness, mWellness,
    kActs, kEvents, kFitness, kWellness,
    weather,
  ] = await Promise.all([
    getActivities(MATHIAS.id, MATHIAS.apiKey, dateStr(-42), today),
    getEvents(MATHIAS.id, MATHIAS.apiKey, monStr, sunStr),
    getFitness(MATHIAS.id, MATHIAS.apiKey, dateStr(-60), today),
    getWellness(MATHIAS.id, MATHIAS.apiKey, dateStr(-7), today),
    getActivities(KAROLINE.id, KAROLINE.apiKey, dateStr(-42), today),
    getEvents(KAROLINE.id, KAROLINE.apiKey, monStr, sunStr),
    getFitness(KAROLINE.id, KAROLINE.apiKey, dateStr(-60), today),
    getWellness(KAROLINE.id, KAROLINE.apiKey, dateStr(-7), today),
    getOsloWeather(),
  ])

  // Fitness
  const mLast = (mFitness as FitnessPoint[]).at(-1)
  const kLast = (kFitness as FitnessPoint[]).at(-1)
  const mCtl = mLast?.ctl ?? 0, mAtl = mLast?.atl ?? 0, mForm = mCtl - mAtl
  const kCtl = kLast?.ctl ?? 0, kAtl = kLast?.atl ?? 0, kForm = kCtl - kAtl

  // Wellness
  const mW = (mWellness as any[]).filter(w => w.weight).at(-1)
  const kW = (kWellness as any[]).filter(w => w.weight).at(-1)
  const mWeight = mW?.weight ?? MATHIAS.weightKg
  const kWeight = kW?.weight ?? KAROLINE.weightKg

  // Dagens planlagte TSS
  const mTodayEvents = (mEvents as Event[]).filter(e => e.start_date_local?.startsWith(today))
  const kTodayEvents = (kEvents as Event[]).filter(e => e.start_date_local?.startsWith(today))
  const mTodayTss = mTodayEvents.reduce((s, e) => s + (e.icu_training_load ?? 0), 0)
  const kTodayTss = kTodayEvents.reduce((s, e) => s + (e.icu_training_load ?? 0), 0)
  const mSport = mTodayEvents[0]?.type
  const kSport = kTodayEvents[0]?.type

  // Kalorier
  const mCal = estimateCalories({ weightKg: mWeight, heightCm: MATHIAS.heightCm, age: MATHIAS.age, plannedTss: mTodayTss, sport: mSport })
  const kCal = estimateCalories({ weightKg: kWeight, heightCm: KAROLINE.heightCm, age: KAROLINE.age, plannedTss: kTodayTss, sport: kSport })

  // Readiness
  function readiness(form: number) {
    return Math.min(100, Math.max(0, Math.round(50 + form * 1.5)))
  }
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

  const mRead = readiness(mForm)
  const kRead = readiness(kForm)

  // Ukesoversikt per dag
  type DayCell = { events: Event[]; acts: Activity[] }
  const mWeek = new Map<string, DayCell>()
  const kWeek = new Map<string, DayCell>()
  days.forEach(d => { mWeek.set(d, { events: [], acts: [] }); kWeek.set(d, { events: [], acts: [] }) })

  const mActsWeek = (mActs as Activity[]).filter(a => a.start_date_local >= monStr && a.start_date_local <= sunStr + 'T23:59')
  const kActsWeek = (kActs as Activity[]).filter(a => a.start_date_local >= monStr && a.start_date_local <= sunStr + 'T23:59')
  const mPaired = new Set((mEvents as Event[]).map(e => e.paired_activity_id).filter(Boolean) as string[])
  const kPaired = new Set((kEvents as Event[]).map(e => e.paired_activity_id).filter(Boolean) as string[])

  for (const e of mEvents as Event[]) {
    const d = e.start_date_local?.split('T')[0]
    if (d && mWeek.has(d)) mWeek.get(d)!.events.push(e)
  }
  for (const a of mActsWeek) {
    const d = a.start_date_local?.split('T')[0]
    if (d && mWeek.has(d) && !mPaired.has(String(a.id))) mWeek.get(d)!.acts.push(a)
  }
  for (const e of kEvents as Event[]) {
    const d = e.start_date_local?.split('T')[0]
    if (d && kWeek.has(d)) kWeek.get(d)!.events.push(e)
  }
  for (const a of kActsWeek) {
    const d = a.start_date_local?.split('T')[0]
    if (d && kWeek.has(d) && !kPaired.has(String(a.id))) kWeek.get(d)!.acts.push(a)
  }

  // Uke-statistikk
  const mWeekTss = [...(mEvents as Event[])].reduce((s, e) => s + (e.icu_training_load ?? 0), 0)
  const kWeekTss = [...(kEvents as Event[])].reduce((s, e) => s + (e.icu_training_load ?? 0), 0)
  const mWeekTime = mActsWeek.reduce((s, a) => s + (a.moving_time ?? 0), 0)
  const kWeekTime = kActsWeek.reduce((s, a) => s + (a.moving_time ?? 0), 0)

  const todayNO = new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
  const mDaysLeft = daysUntil(MATHIAS.mainGoalDate)
  const kDaysLeft = daysUntil(KAROLINE.mainGoalDate)

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">T</span>
            </div>
            <span className="font-bold text-gray-800 text-lg tracking-tight">Triathlon Coach</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="capitalize">{todayNO}</span>
            {weather && (
              <span className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-1 text-blue-700 font-medium">
                <span className="text-base">{weather.icon}</span>
                {weather.temp}°C · {weather.description}
                <span className="text-blue-400 font-normal">· {weather.windspeed} km/t</span>
              </span>
            )}
            <Link href="/settings" className="text-gray-400 hover:text-blue-600 transition-colors text-xs">Innstillinger</Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* ── PROFILKORT ── */}
        <div className="grid grid-cols-2 gap-5">
          {[
            { athlete: MATHIAS, events: mTodayEvents, ctl: mCtl, form: mForm, read: mRead, cal: mCal, daysLeft: mDaysLeft, weight: mWeight },
            { athlete: KAROLINE, events: kTodayEvents, ctl: kCtl, form: kForm, read: kRead, cal: kCal, daysLeft: kDaysLeft, weight: kWeight },
          ].map(({ athlete, events, ctl, form, read, cal, daysLeft, weight }) => (
            <Link href={`/${athlete.name.toLowerCase()}`} key={athlete.id}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
              {/* Toppstripe */}
              <div className="h-1.5" style={{ backgroundColor: athlete.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base"
                      style={{ backgroundColor: athlete.color }}>
                      {athlete.name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 text-lg leading-none">{athlete.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{athlete.mainGoal}</div>
                    </div>
                  </div>
                  {/* Nedtelling */}
                  <div className="text-right">
                    <div className="text-2xl font-bold leading-none" style={{ color: athlete.color }}>{daysLeft}</div>
                    <div className="text-xs text-gray-400">dager igjen</div>
                  </div>
                </div>

                {/* Fitness-stats */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'CTL', value: ctl.toFixed(0), color: athlete.color },
                    { label: 'Form', value: (form > 0 ? '+' : '') + form.toFixed(0), color: form > 5 ? '#16a34a' : form < -15 ? '#dc2626' : '#d97706' },
                    { label: 'Vekt', value: weight ? weight.toFixed(1) + ' kg' : '—', color: '#6b7280' },
                    { label: 'Readiness', value: read.toString(), color: readColor(read) },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <div className="text-xs text-gray-400 mb-0.5">{s.label}</div>
                      <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Readiness-bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Form i dag</span>
                    <span className="text-xs font-semibold" style={{ color: readColor(read) }}>{readLabel(read)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${read}%`, backgroundColor: readColor(read) }} />
                  </div>
                </div>

                {/* Dagens økt */}
                <div className="border-t border-gray-50 pt-3 mb-3">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">I dag</div>
                  {events.length === 0
                    ? <div className="text-sm text-gray-400">Hviledag</div>
                    : events.map(e => (
                      <div key={e.id} className="flex items-center gap-2 rounded-xl px-3 py-2 mb-1.5 last:mb-0"
                        style={{ backgroundColor: (SPORT_COLOR[e.type] ?? '#6b7280') + '18' }}>
                        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: SPORT_COLOR[e.type] ?? '#6b7280' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{e.name}</div>
                          <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                            {(e.moving_time ?? 0) > 0 && <span>{formatTime(e.moving_time ?? 0)}</span>}
                            {(e.icu_training_load ?? 0) > 0 && <span>TSS {e.icu_training_load}</span>}
                            {e.paired_activity_id && <span className="text-green-600 font-medium">✓ gjennomført</span>}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: SPORT_COLOR[e.type] ?? '#6b7280' }}>
                            {SPORT_LABEL[e.type] ?? e.type}
                          </span>
                        </div>
                      </div>
                    ))
                  }
                </div>

                {/* Kalorier */}
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <div className="text-xs text-gray-400 mb-2 font-medium">Anbefalt kalorier i dag</div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-xl font-bold text-gray-800">{cal.total.toLocaleString('nb-NO')}</span>
                    <span className="text-sm text-gray-400">kcal</span>
                    {cal.training > 0 && <span className="text-xs text-gray-400 ml-1">(inkl. {cal.training} fra trening)</span>}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>Karbo <strong className="text-gray-700">{cal.carbs}g</strong></span>
                    <span>Protein <strong className="text-gray-700">{cal.protein}g</strong></span>
                    <span>Fett <strong className="text-gray-700">{cal.fat}g</strong></span>
                  </div>
                </div>

                <div className="mt-3 text-xs text-blue-600 group-hover:text-blue-700 font-medium flex items-center gap-1">
                  Se full profil <span>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── UKESOVERSIKT ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Ukens plan</h2>
            <div className="flex gap-6 text-sm text-gray-500">
              <span>
                <span className="font-semibold" style={{ color: MATHIAS.color }}>{MATHIAS.name}</span>
                {' '}{mWeekTss > 0 ? `${mWeekTss} TSS` : ''}{mWeekTime > 0 ? ` · ${formatTime(mWeekTime)}` : ''}
              </span>
              <span>
                <span className="font-semibold" style={{ color: KAROLINE.color }}>{KAROLINE.name}</span>
                {' '}{kWeekTss > 0 ? `${kWeekTss} TSS` : ''}{kWeekTime > 0 ? ` · ${formatTime(kWeekTime)}` : ''}
              </span>
            </div>
          </div>

          {/* Dag-grid */}
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const isToday = d === today
              const mc = mWeek.get(d)!
              const kc = kWeek.get(d)!
              const mItems = [...mc.events.map(e => ({ ...e, done: !!e.paired_activity_id })), ...mc.acts.map(a => ({ ...a, done: true, icu_training_load: a.icu_training_load }))]
              const kItems = [...kc.events.map(e => ({ ...e, done: !!e.paired_activity_id })), ...kc.acts.map(a => ({ ...a, done: true, icu_training_load: a.icu_training_load }))]

              return (
                <div key={d} className={`border-r border-gray-50 last:border-r-0 min-h-[140px] ${isToday ? 'bg-blue-50/60' : ''}`}>
                  {/* Dag-header */}
                  <div className={`px-2 py-2 text-center border-b ${isToday ? 'border-blue-100 bg-blue-50' : 'border-gray-50'}`}>
                    <div className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>{DAY_NO[i]}</div>
                    <div className={`text-base font-bold mt-0.5 ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                      {new Date(d).getDate()}
                    </div>
                  </div>

                  {/* Mathias */}
                  <div className="px-1.5 pt-1.5 pb-1">
                    <div className="flex items-center gap-0.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MATHIAS.color }} />
                      <span className="text-[10px] text-gray-400 font-medium">M</span>
                    </div>
                    {mItems.length === 0
                      ? <div className="text-[11px] text-gray-200">—</div>
                      : mItems.map((e: any) => (
                        <div key={e.id} className="text-[11px] leading-tight rounded px-1 py-0.5 mb-0.5 truncate"
                          style={{ backgroundColor: (SPORT_COLOR[e.type] ?? '#6b7280') + '25', color: e.done ? '#16a34a' : (SPORT_COLOR[e.type] ?? '#78716c') }}
                          title={e.name}>
                          {e.done ? '✓ ' : ''}{(e.name ?? '').substring(0, 16)}
                        </div>
                      ))
                    }
                  </div>

                  {/* Divider */}
                  <div className="mx-2 border-t border-dashed border-gray-100" />

                  {/* Karoline */}
                  <div className="px-1.5 pt-1 pb-1.5">
                    <div className="flex items-center gap-0.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: KAROLINE.color }} />
                      <span className="text-[10px] text-gray-400 font-medium">K</span>
                    </div>
                    {kItems.length === 0
                      ? <div className="text-[11px] text-gray-200">—</div>
                      : kItems.map((e: any) => (
                        <div key={e.id} className="text-[11px] leading-tight rounded px-1 py-0.5 mb-0.5 truncate"
                          style={{ backgroundColor: (SPORT_COLOR[e.type] ?? '#6b7280') + '25', color: e.done ? '#16a34a' : (SPORT_COLOR[e.type] ?? '#78716c') }}
                          title={e.name}>
                          {e.done ? '✓ ' : ''}{(e.name ?? '').substring(0, 16)}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )
            })}
          </div>

          {/* Fargeforklaring */}
          <div className="px-5 py-3 border-t border-gray-50 flex gap-5">
            {Object.entries(SPORT_LABEL).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: (SPORT_COLOR[type] ?? '#6b7280') + '40', borderLeft: `3px solid ${SPORT_COLOR[type] ?? '#6b7280'}` }} />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── VÆR-INFO ── */}
        {weather && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800 mb-1">Vær i Oslo</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="text-3xl">{weather.icon}</span>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{weather.temp}°C</div>
                    <div className="text-gray-400">{weather.description} · Føles {weather.feelsLike}°C</div>
                  </div>
                  <div className="ml-4 text-gray-500 space-y-0.5">
                    <div>Vind: <strong>{weather.windspeed} km/t</strong></div>
                    <div>Nedbør: <strong>{weather.precipitation} mm</strong></div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">Anbefalt for utendørs?</div>
                <div className={`text-sm font-semibold ${weather.temp >= 5 && weather.precipitation === 0 && weather.windspeed < 30 ? 'text-green-600' : weather.temp < 0 || weather.precipitation > 2 ? 'text-red-500' : 'text-amber-500'}`}>
                  {weather.temp >= 5 && weather.precipitation === 0 && weather.windspeed < 30 ? '✓ Bra forhold' : weather.temp < 0 || weather.precipitation > 2 ? '✗ Krevende' : '~ Akseptabelt'}
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-gray-300 pb-4">
          Data fra intervals.icu · Oppdateres hvert 5. min · Vær fra Open-Meteo
        </footer>
      </main>
    </div>
  )
}
