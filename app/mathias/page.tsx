import { getActivities, getEvents } from '@/lib/intervals'
import { buildWeekStats, generateInsights, weeklyCalorieSurplus } from '@/lib/coach'
import { buildFitnessTimeline, raceCtlTarget } from '@/lib/fitness'
import { getNutritionPlan } from '@/lib/nutrition'
import { MATHIAS } from '@/lib/athletes'
import WorkoutDetail from '@/components/WorkoutDetail'
import FitnessChart from '@/components/FitnessChart'
import GoalProgress from '@/components/GoalProgress'
import ReadinessBar from '@/components/ReadinessBar'
import InsightCard from '@/components/InsightCard'
import TssChart from '@/components/TssChart'
import UpcomingEvents from '@/components/UpcomingEvents'
import PushWeekButton from '@/components/PushWeekButton'
import StatCard from '@/components/StatCard'

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

function whyThisWorkout(name: string, zone: string, programWeek: number): string {
  const n = name?.toLowerCase() || ''
  if (n.includes('terskel') || n.includes('threshold'))
    return `Terskelarbeid bygger din kritiske kraft (FTP). I uke ${programWeek} av programmet øker vi terskelbolkene progressivt — dette er kjerneøkten som driver fremgangen.`
  if (n.includes('sweet spot'))
    return `Sweet spot (88–93% FTP) gir maksimal stimulans per treningsminutt. Perfekt balanse mellom fysiologisk stress og restitusjonstid.`
  if (n.includes('aerob') || n.includes('z1') || n.includes('z2') || zone === 'I-1' || zone === 'I-2')
    return `Aerob volumtrening bygger mitokondrietthet og forbedrer fettforbrenning. Holder du deg i I-1/I-2 presser du CTL oppover uten å bruke restitusjonskapasiteten din.`
  if (n.includes('easy') || n.includes('rolig'))
    return `Aktiv restitusjon. Øker blodgjennomstrømning uten ny treningsstress — akselererer recovery etter harde dager.`
  if (n.includes('brick'))
    return `Brick-trening: Kroppen lærer å bytte fra sykkel- til løpemodus. T2-overgangen og løpsmekanikk etter utmattet sykkel — essensiell triatlonøkt.`
  if (n.includes('svøm') || n.includes('swim'))
    return `Svøm er din største flaskehals mot konkurransen. Teknikkfokus nå gir lavere laktatbelastning i T1, som direkte forbedrer sykkel-segmentet.`
  return `Planøkt for uke ${programWeek}. Følg intensitetssoner nøye — det er adherence over tid som gir fremgang, ikke enkeltøkter.`
}

export default async function MathiasPage() {
  const now = new Date()
  const today = dateStr(0)
  const currentWeekKey = isoWeekKey(now)
  const dayOfWeek = (now.getDay() + 6) % 7
  const thisSun = dateStr(6 - dayOfWeek)
  const { mon: nextMon, sun: nextSun } = nextMondaySunday()
  const programWeek = Math.max(1, Math.ceil((now.getTime() - new Date('2026-02-23').getTime()) / 86400000 / 7) + 1)

  const [activities, eventsThisWeek, eventsNextWeek] = await Promise.all([
    getActivities(dateStr(-84), today), // 12 uker tilbake
    getEvents(today, thisSun),
    getEvents(nextMon, nextSun),
  ])

  // Fitness tidslinje med fremskriving (12 uker frem)
  const allEvents = [...eventsThisWeek, ...eventsNextWeek]
  const fitnessData = buildFitnessTimeline(activities, allEvents, 84)
  const today_fitness = fitnessData.filter(d => !d.projected).at(-1)
  const atl = today_fitness?.totalAtl ?? 0
  const ctl = today_fitness?.totalCtl ?? 0
  const tsb = ctl - atl

  const weeks = buildWeekStats(activities)
  const currentWeekActs = activities.filter(a =>
    a.start_date_local && isoWeekKey(new Date(a.start_date_local)) === currentWeekKey
  )
  const insights = generateInsights(weeks, { atl, ctl, tsb }, currentWeekKey)
  const weekKcal = weeklyCalorieSurplus(currentWeekActs, MATHIAS.weight)

  // Neste økt
  const todayEvents = eventsThisWeek.filter(e => e.start_date_local.startsWith(today) && !e.paired_activity_id)
  const nextEvent = todayEvents[0] ?? eventsThisWeek.find(e => !e.paired_activity_id) ?? eventsNextWeek[0]
  const nextEventZone = nextEvent?.icu_training_load && nextEvent.moving_time
    ? (nextEvent.icu_training_load / (nextEvent.moving_time / 3600) > 90 ? 'I-4' : 'I-3')
    : 'I-2'
  const nutrition = nextEvent
    ? getNutritionPlan(Math.round((nextEvent.moving_time || 3600) / 60), nextEventZone, nextEvent.type || '', MATHIAS.weight)
    : null

  const restOfWeek = eventsThisWeek.filter(e => !e.start_date_local.startsWith(today) && !e.paired_activity_id)
  const goalDates = MATHIAS.goals.map(g => ({ label: g.unit, date: g.targetDate }))

  // Filter fitness til siste 12 uker + 12 uker frem for chartet
  const chartStart = dateStr(-84)
  const chartFitness = fitnessData.filter(d => d.date >= chartStart)

  return (
    <div className="space-y-5">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Programuke" value={`Uke ${programWeek}`} sub="av 24" />
        <StatCard label="Fitness (CTL)" value={ctl.toFixed(0)} sub="grensvektet" color="text-blue-400" />
        <StatCard
          label="Form (TSB)"
          value={`${tsb > 0 ? '+' : ''}${tsb.toFixed(0)}`}
          sub={tsb > 5 ? 'Klar for hard økt' : tsb > -5 ? 'Nøytral' : 'Akkumulert fatigue'}
          color={tsb > 5 ? 'text-green-400' : tsb < -10 ? 'text-red-400' : 'text-amber-400'}
        />
        <StatCard label="Kcal ekstra denne uken" value={weekKcal.toLocaleString('nb-NO')} sub={`+${Math.round(weekKcal / 7)} kcal/dag`} color="text-amber-300" />
      </div>

      {/* Readiness */}
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Dagsform</div>
        <ReadinessBar tsb={tsb} atl={atl} ctl={ctl} athleteColor={MATHIAS.color} name={MATHIAS.name} />
      </div>

      {/* Neste økt — stor og sentral */}
      {nextEvent && nutrition && (
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            {todayEvents.length > 0 ? 'I dag' : 'Neste økt'}
          </div>
          <WorkoutDetail
            event={nextEvent}
            nutrition={nutrition}
            athleteColor={MATHIAS.color}
            why={whyThisWorkout(nextEvent.name, nextEventZone, programWeek)}
          />
        </div>
      )}

      {/* Coach-analyse */}
      <div>
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Coach-vurdering</div>
        <div className="flex flex-col gap-2">
          {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
        </div>
      </div>

      {/* To kolonner: fitness-graf + mål */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <FitnessChart
            data={chartFitness}
            raceDate={MATHIAS.raceDate}
            raceCtlTarget={raceCtlTarget('triathlon')}
            athleteColor={MATHIAS.color}
            goals={goalDates}
          />
        </div>
        <div>
          <GoalProgress goals={MATHIAS.goals} athleteColor={MATHIAS.color} />
        </div>
      </div>

      {/* TSS-historikk */}
      <TssChart weeks={weeks} />

      {/* Kommende øktplan */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Neste uke</div>
          <PushWeekButton
            events={eventsNextWeek}
            athleteId={MATHIAS.id}
            apiKey={MATHIAS.apiKey}
            label="Push neste uke"
          />
        </div>
        <UpcomingEvents events={eventsNextWeek} title="" />
      </div>

      {restOfWeek.length > 0 && (
        <UpcomingEvents events={restOfWeek} title="Resten av uken" />
      )}
    </div>
  )
}
