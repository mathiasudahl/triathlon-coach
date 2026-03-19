import { getActivities, getEvents } from '@/lib/intervals'
import { buildWeekStats, generateInsights } from '@/lib/coach'
import { buildFitnessTimeline } from '@/lib/fitness'
import { getNutritionPlan } from '@/lib/nutrition'
import { KAROLINE } from '@/lib/athletes'
import WorkoutDetail from '@/components/WorkoutDetail'
import FitnessChart from '@/components/FitnessChart'
import GoalProgress from '@/components/GoalProgress'
import ReadinessBar from '@/components/ReadinessBar'
import InsightCard from '@/components/InsightCard'
import TssChart from '@/components/TssChart'
import UpcomingEvents from '@/components/UpcomingEvents'
import PushWeekButton from '@/components/PushWeekButton'
import StatCard from '@/components/StatCard'

// Karoline bruker sin egen intervals-klient
async function fetchForKaroline(path: string, params?: Record<string, string>) {
  const base = process.env.INTERVALS_BASE_URL || 'https://intervals.icu/api/v1'
  const url = new URL(`${base}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const auth = Buffer.from(`API_KEY:${KAROLINE.apiKey}`).toString('base64')
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`intervals ${path} → ${res.status}`)
  return res.json()
}

function dateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

function isoWeekKey(d: Date): string {
  const thu = new Date(d)
  thu.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3)
  const year = thu.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const week = Math.ceil(((thu.getTime() - jan4.getTime()) / 86400000 + ((jan4.getDay() + 6) % 7) + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function nextMondaySunday(): { mon: string; sun: string } {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - dayOfWeek + 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { mon: mon.toISOString().split('T')[0], sun: sun.toISOString().split('T')[0] }
}

function whyKaroline(name: string, type: string): string {
  const n = name?.toLowerCase() || ''
  if (type === 'Run' || type === 'VirtualRun') {
    if (n.includes('interval') || n.includes('4x4') || n.includes('4x'))
      return 'Intervaller presser VO₂max og løpsøkonomi. Med din løpebakgrunn er dette den raskeste veien til sub-50 på 10k. Hvert intervall skal gjøre vondt — det er meningen.'
    if (n.includes('rolig') || n.includes('z2') || n.includes('aerob'))
      return 'Aerob rolig løping er fundamentet. Bygger mitokondrie-tetthet og forbedrer fettforbrenning. Prat-test hele veien — ikke raskere.'
    return 'Løpetur som bygger aerob base og løpsøkonomi. Grunnsteinen mot halvmaraton-målet.'
  }
  if (type === 'Ride' || type === 'VirtualRide') {
    if (n.includes('group') || n.includes('of'))
      return 'Gruppeøkt på Zwift gir naturlig terskelstimulans og sosial motivasjon. Bra for FTP-fremgang uten å planlegge intervaller selv.'
    return 'Sykkelvolum bygger aerob kapasitet på en lavskadig måte — bra komplement til løpingen.'
  }
  if (type === 'WeightTraining')
    return 'Styrke forbedrer løpsøkonomi og reduserer skaderisiko. Enbeins-øvelser og core er spesielt viktig for løpere.'
  return 'Planøkt. Følg intensitetssoner — konsistens over tid gir resultater.'
}

export default async function KarolinePage() {
  const now = new Date()
  const today = dateStr(0)
  const currentWeekKey = isoWeekKey(now)
  const dayOfWeek = (now.getDay() + 6) % 7
  const thisSun = dateStr(6 - dayOfWeek)
  const { mon: nextMon, sun: nextSun } = nextMondaySunday()

  const [activities, eventsThisWeek, eventsNextWeek] = await Promise.all([
    fetchForKaroline(`/athlete/${KAROLINE.id}/activities`, { oldest: dateStr(-84), newest: today }),
    fetchForKaroline(`/athlete/${KAROLINE.id}/events`, { oldest: today, newest: thisSun }),
    fetchForKaroline(`/athlete/${KAROLINE.id}/events`, { oldest: nextMon, newest: nextSun }),
  ])

  const allEvents = [...eventsThisWeek, ...eventsNextWeek]
  const fitnessData = buildFitnessTimeline(activities, allEvents, 120)
  const today_fitness = fitnessData.filter(d => !d.projected).at(-1)
  const atl = today_fitness?.totalAtl ?? 0
  const ctl = today_fitness?.totalCtl ?? 0
  const tsb = ctl - atl

  const weeks = buildWeekStats(activities)
  const currentWeekActs = activities.filter((a: { start_date_local?: string }) =>
    a.start_date_local && isoWeekKey(new Date(a.start_date_local)) === currentWeekKey
  )
  const insights = generateInsights(weeks, { atl, ctl, tsb }, currentWeekKey)

  const todayEvents = eventsThisWeek.filter((e: { start_date_local: string; paired_activity_id?: string }) =>
    e.start_date_local.startsWith(today) && !e.paired_activity_id
  )
  const nextEvent = todayEvents[0] ??
    eventsThisWeek.find((e: { paired_activity_id?: string }) => !e.paired_activity_id) ??
    eventsNextWeek[0]

  const nextEventZone = nextEvent?.icu_training_load && nextEvent?.moving_time
    ? (nextEvent.icu_training_load / (nextEvent.moving_time / 3600) > 90 ? 'I-4' : 'I-3')
    : 'I-2'

  const nutrition = nextEvent
    ? getNutritionPlan(Math.round((nextEvent.moving_time || 3600) / 60), nextEventZone, nextEvent.type || '', KAROLINE.weight)
    : null

  const restOfWeek = eventsThisWeek.filter((e: { start_date_local: string; paired_activity_id?: string }) =>
    !e.start_date_local.startsWith(today) && !e.paired_activity_id
  )

  const goalDates = KAROLINE.goals.map(g => ({ label: g.unit, date: g.targetDate }))
  const chartStart = dateStr(-84)
  const chartFitness = fitnessData.filter((d: { date: string }) => d.date >= chartStart)

  // Ukentlig kcal for Karoline
  const weekKcal = currentWeekActs.reduce((sum: number, a: { moving_time?: number }) => {
    return sum + Math.round((a.moving_time || 0) / 60 * 11)
  }, 0)

  return (
    <div className="space-y-5">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Aktiviteter (12 uker)" value={activities.length} sub="siste 84 dager" />
        <StatCard label="Fitness (CTL)" value={ctl.toFixed(0)} sub="grensvektet" color="text-fuchsia-400" />
        <StatCard
          label="Form (TSB)"
          value={`${tsb > 0 ? '+' : ''}${tsb.toFixed(0)}`}
          sub={tsb > 5 ? 'Klar for hard økt' : tsb > -5 ? 'Nøytral' : tsb > -20 ? 'Sliten' : 'Veldig sliten'}
          color={tsb > 5 ? 'text-green-400' : tsb < -15 ? 'text-red-400' : 'text-amber-400'}
        />
        <StatCard label="Kcal ekstra denne uken" value={weekKcal.toLocaleString('nb-NO')} sub={`+${Math.round(weekKcal / 7)} kcal/dag`} color="text-amber-300" />
      </div>

      {/* Readiness */}
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Dagsform</div>
        <ReadinessBar tsb={tsb} atl={atl} ctl={ctl} athleteColor={KAROLINE.color} name={KAROLINE.name} />
        {tsb < -10 && (
          <p className="text-xs text-amber-400 mt-2">
            TSB {tsb.toFixed(0)}: Du er i akkumulert fatigue. Vurder å bytte neste harde økt til rolig/restitusjon.
          </p>
        )}
      </div>

      {/* Neste økt */}
      {nextEvent && nutrition && (
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            {todayEvents.length > 0 ? 'I dag' : 'Neste økt'}
          </div>
          <WorkoutDetail
            event={nextEvent}
            nutrition={nutrition}
            athleteColor={KAROLINE.color}
            why={whyKaroline(nextEvent.name, nextEvent.type)}
          />
        </div>
      )}

      {!nextEvent && (
        <div className="bg-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Ingen planlagte økter i intervals.icu. Bruk "Push neste uke" for å legge inn plan.</p>
        </div>
      )}

      {/* Mål */}
      <GoalProgress goals={KAROLINE.goals} athleteColor={KAROLINE.color} />

      {/* Coach-vurdering */}
      <div>
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Coach-vurdering</div>
        <div className="flex flex-col gap-2">
          {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
        </div>
      </div>

      {/* Fitness-graf */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <FitnessChart
            data={chartFitness}
            raceCtlTarget={65}
            athleteColor={KAROLINE.color}
            goals={goalDates}
          />
        </div>
        <div className="space-y-3">
          <div className="bg-zinc-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Løpeprestasjon</div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400">Estimert 10k-tid</span>
                <span className="text-xs font-medium text-fuchsia-400">~48–50 min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400">Z2-pace nå</span>
                <span className="text-xs font-medium text-zinc-300">~5:20–5:40/km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400">Halvmaraton (estimert)</span>
                <span className="text-xs font-medium text-zinc-300">~1:55–2:05</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-zinc-400">Sykkel FTP (estimert)</span>
                <span className="text-xs font-medium text-zinc-300">~175–185W</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TSS */}
      <TssChart weeks={weeks} />

      {/* Neste uke + push */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Neste uke</div>
          <PushWeekButton
            events={eventsNextWeek}
            athleteId={KAROLINE.id}
            apiKey={KAROLINE.apiKey}
            label="Push neste uke"
          />
        </div>
        {eventsNextWeek.length > 0
          ? <UpcomingEvents events={eventsNextWeek} title="" />
          : <div className="bg-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-400">Ingen planlagte neste uke ennå.</p>
            </div>
        }
      </div>

      {restOfWeek.length > 0 && <UpcomingEvents events={restOfWeek} title="Resten av uken" />}
    </div>
  )
}
