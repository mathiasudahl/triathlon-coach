// Grenspesifikk fitness-modell
// Løp-TSS multipliseres med 1.3 for å reflektere høyere muskelskade

export type SportType = 'swim' | 'bike' | 'run' | 'other'

export type DailyLoad = {
  date: string
  tss: number
  sport: SportType
}

export type FitnessPoint = {
  date: string
  swimCtl: number
  bikeCtl: number
  runCtl: number
  totalCtl: number   // vektet sum
  swimAtl: number
  bikeAtl: number
  runAtl: number
  totalAtl: number
  tsb: number        // totalCtl - totalAtl
  readiness: number  // 0-100
  projected: boolean // fremskrevet, ikke historisk
}

// Konstanter
const CTL_DAYS = 42
const ATL_DAYS = 7
const RUN_WEIGHT = 1.3  // løp gir mer muskelskade

function ema(prev: number, tss: number, days: number): number {
  const k = 2 / (days + 1)
  return prev * (1 - k) + tss * k
}

export function getSportType(activityType: string): SportType {
  if (activityType === 'Swim') return 'swim'
  if (activityType === 'Ride' || activityType === 'VirtualRide') return 'bike'
  if (activityType === 'Run' || activityType === 'VirtualRun') return 'run'
  return 'other'
}

type RawActivity = {
  start_date_local: string
  type: string
  icu_training_load?: number
}

export function buildFitnessTimeline(
  activities: RawActivity[],
  projectedEvents?: { start_date_local: string; type: string; icu_training_load?: number }[],
  daysForward = 0,
): FitnessPoint[] {
  // Finn datospenn
  const allDates = activities.map(a => a.start_date_local.split('T')[0]).filter(Boolean)
  if (allDates.length === 0) return []

  const startDate = new Date(allDates.sort()[0])
  startDate.setDate(startDate.getDate() - 42) // warm-up periode

  const endDate = new Date()
  endDate.setDate(endDate.getDate() + daysForward)

  // Bygg daglig TSS per gren
  const dailyByDate = new Map<string, { swim: number; bike: number; run: number }>()

  for (const a of activities) {
    const date = a.start_date_local?.split('T')[0]
    if (!date) continue
    const tss = a.icu_training_load || 0
    const sport = getSportType(a.type || '')
    if (!dailyByDate.has(date)) dailyByDate.set(date, { swim: 0, bike: 0, run: 0 })
    const d = dailyByDate.get(date)!
    if (sport === 'swim') d.swim += tss
    else if (sport === 'bike') d.bike += tss
    else if (sport === 'run') d.run += tss * RUN_WEIGHT
  }

  // Legg til projected events
  if (projectedEvents) {
    for (const e of projectedEvents) {
      const date = e.start_date_local?.split('T')[0]
      if (!date) continue
      const tss = e.icu_training_load || 0
      const sport = getSportType(e.type || '')
      if (!dailyByDate.has(date)) dailyByDate.set(date, { swim: 0, bike: 0, run: 0 })
      const d = dailyByDate.get(date)!
      if (sport === 'swim') d.swim += tss
      else if (sport === 'bike') d.bike += tss
      else if (sport === 'run') d.run += tss * RUN_WEIGHT
    }
  }

  // Bygg tidslinje
  const result: FitnessPoint[] = []
  let swimCtl = 0, bikeCtl = 0, runCtl = 0
  let swimAtl = 0, bikeAtl = 0, runAtl = 0

  const todayStr = new Date().toISOString().split('T')[0]
  const cur = new Date(startDate)

  while (cur <= endDate) {
    const dateStr = cur.toISOString().split('T')[0]
    const day = dailyByDate.get(dateStr) || { swim: 0, bike: 0, run: 0 }

    swimCtl = ema(swimCtl, day.swim, CTL_DAYS)
    bikeCtl = ema(bikeCtl, day.bike, CTL_DAYS)
    runCtl  = ema(runCtl,  day.run,  CTL_DAYS)

    swimAtl = ema(swimAtl, day.swim, ATL_DAYS)
    bikeAtl = ema(bikeAtl, day.bike, ATL_DAYS)
    runAtl  = ema(runAtl,  day.run,  ATL_DAYS)

    // Vektet total: sykkel 40%, løp 40%, svøm 20% (for triatlon/multisport)
    const totalCtl = swimCtl * 0.2 + bikeCtl * 0.4 + runCtl * 0.4
    const totalAtl = swimAtl * 0.2 + bikeAtl * 0.4 + runAtl * 0.4
    const tsb = totalCtl - totalAtl

    // Readiness: 50 = nøytral, 100 = toppform, 0 = utmattet
    const readiness = Math.min(100, Math.max(0, 50 + tsb * 2.5))

    result.push({
      date: dateStr,
      swimCtl, bikeCtl, runCtl, totalCtl,
      swimAtl, bikeAtl, runAtl, totalAtl,
      tsb,
      readiness,
      projected: dateStr > todayStr,
    })

    cur.setDate(cur.getDate() + 1)
  }

  return result
}

// Beregn CTL-target for racedag basert på ønsket prestasjon
export function raceCtlTarget(sport: 'triathlon' | 'multisport' | 'running' | 'cycling'): number {
  const targets: Record<string, number> = {
    triathlon: 80,
    multisport: 75,
    running: 65,
    cycling: 85,
  }
  return targets[sport] ?? 70
}
