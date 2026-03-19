import { Activity, activityZone, sportLabel } from './intervals'

export type WeekStats = {
  weekKey: string
  weekLabel: string
  swim: { count: number; minutes: number; tss: number }
  bike: { count: number; minutes: number; tss: number }
  run: { count: number; minutes: number; tss: number }
  other: { minutes: number; tss: number }
  totalTss: number
  zones: Record<string, number> // sone → antall aktiviteter
}

export type FormData = {
  atl: number
  ctl: number
  tsb: number // positiv = form, negativ = fatigue
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const thu = new Date(d)
  thu.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3)
  const year = thu.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const week = Math.ceil(((thu.getTime() - jan4.getTime()) / 86400000 + ((jan4.getDay() + 6) % 7) + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function weekLabel(key: string): string {
  // "2026-W11" → finn mandag
  const [year, wPart] = key.split('-W')
  const week = parseInt(wPart)
  const jan4 = new Date(parseInt(year), 0, 4)
  const mon = new Date(jan4.getTime() + (week - 1) * 7 * 86400000)
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
  const sun = new Date(mon.getTime() + 6 * 86400000)
  const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}`
  return `${fmt(mon)}–${fmt(sun)}`
}

export function buildWeekStats(activities: Activity[]): WeekStats[] {
  const byWeek = new Map<string, Activity[]>()
  for (const a of activities) {
    if (!a.start_date_local) continue
    const key = isoWeekKey(a.start_date_local)
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key)!.push(a)
  }

  const result: WeekStats[] = []
  for (const [key, acts] of [...byWeek.entries()].sort()) {
    const stat: WeekStats = {
      weekKey: key,
      weekLabel: weekLabel(key),
      swim: { count: 0, minutes: 0, tss: 0 },
      bike: { count: 0, minutes: 0, tss: 0 },
      run: { count: 0, minutes: 0, tss: 0 },
      other: { minutes: 0, tss: 0 },
      totalTss: 0,
      zones: {},
    }
    for (const a of acts) {
      const min = Math.round((a.moving_time || 0) / 60)
      const tss = a.icu_training_load || 0
      const zone = activityZone(a)
      stat.zones[zone] = (stat.zones[zone] || 0) + 1

      if (a.type === 'Swim') {
        stat.swim.count++; stat.swim.minutes += min; stat.swim.tss += tss
      } else if (a.type === 'Ride' || a.type === 'VirtualRide') {
        stat.bike.count++; stat.bike.minutes += min; stat.bike.tss += tss
      } else if (a.type === 'Run') {
        stat.run.count++; stat.run.minutes += min; stat.run.tss += tss
      } else {
        stat.other.minutes += min; stat.other.tss += tss
      }
    }
    stat.totalTss = stat.swim.tss + stat.bike.tss + stat.run.tss + stat.other.tss
    result.push(stat)
  }
  return result
}

// Kalorieforbruk estimat basert på TSS og kroppsvekt
// Grov modell: 1 TSS ≈ 1 kcal/kg ≈ ~70 kcal for 70kg utøver
export function estimateCaloriesBurned(totalTss: number, weightKg = 70): number {
  return Math.round(totalTss * weightKg * 0.014 * 100) // kJ → kcal konvertering
  // Mer presist: cycling TSS ≈ kJ brukt ≈ kJ/4.18 kcal. Bruk ~750 kcal/time i I-3.
  // Enkel tilnærming: TSS*0.8 kcal per kg for blandede idretter
}

export function weeklyCalorieSurplus(activities: Activity[], weightKg = 70): number {
  // Basalmetabolisme 70kg aktiv: ~2800 kcal/dag
  // Treningsforbruk: sum av aktiviteter
  let totalKcal = 0
  for (const a of activities) {
    const min = (a.moving_time || 0) / 60
    const zone = activityZone(a)
    // kcal/min per sone (70kg)
    const kcalPerMin: Record<string, number> = { 'I-1': 8, 'I-2': 10, 'I-3': 12, 'I-4': 14, 'I-5': 16 }
    totalKcal += min * (kcalPerMin[zone] ?? 9)
  }
  return Math.round(totalKcal)
}

export type CoachInsight = {
  type: 'good' | 'warning' | 'info'
  text: string
}

export function generateInsights(
  weeks: WeekStats[],
  form: FormData,
  currentWeekKey: string,
): CoachInsight[] {
  const insights: CoachInsight[] = []
  const recent = weeks.filter(w => w.weekKey <= currentWeekKey).slice(-4)
  if (recent.length === 0) return insights

  const last = recent[recent.length - 1]
  const avgSwimPerWeek = recent.reduce((s, w) => s + w.swim.count, 0) / recent.length
  const avgTss = recent.reduce((s, w) => s + w.totalTss, 0) / recent.length

  // Svøm (Mathias: 3x/uke, Karoline: 1x/uke — sjekkes per context)
  const swimTarget = 2.5 // brukes for Mathias; Karoline-siden overskriver
  if (avgSwimPerWeek < swimTarget) {
    insights.push({ type: 'warning', text: `Svøm: Snittet er ${avgSwimPerWeek.toFixed(1)}x/uke de siste 4 ukene — planen krever 3x. Svøm er den største flaskehalsen mot konkurransen.` })
  } else {
    insights.push({ type: 'good', text: `Svøm: ${avgSwimPerWeek.toFixed(1)}x/uke i snitt — godt i rute!` })
  }

  // Form (TSB)
  if (form.tsb > 5) {
    insights.push({ type: 'good', text: `Form: TSB er +${form.tsb.toFixed(0)} — du er frisk og klar for belastning. Grønt lys for hard økt.` })
  } else if (form.tsb < -15) {
    insights.push({ type: 'warning', text: `Form: TSB er ${form.tsb.toFixed(0)} — du er i akkumulert fatigue. Vurder å kutte en økt denne uken.` })
  } else {
    insights.push({ type: 'info', text: `Form: TSB er ${form.tsb.toFixed(0)} — nøytral belastning. Tren etter plan.` })
  }

  // CTL-utvikling
  if (form.ctl > 55) {
    insights.push({ type: 'good', text: `Fitness (CTL): ${form.ctl.toFixed(0)} — solid base for basebyggingsfasen.` })
  } else {
    insights.push({ type: 'info', text: `Fitness (CTL): ${form.ctl.toFixed(0)} — rom for å bygge mer volum.` })
  }

  // 80/20-sjekk siste uke
  const totalZones = Object.values(last.zones).reduce((s, n) => s + n, 0)
  const hardZones = (last.zones['I-3'] || 0) + (last.zones['I-4'] || 0) + (last.zones['I-5'] || 0)
  if (totalZones > 0) {
    const pctHard = hardZones / totalZones
    if (pctHard > 0.30) {
      insights.push({ type: 'warning', text: `80/20: ${Math.round(pctHard * 100)}% av øktene er I-3+ siste uke — litt høyt. Behold neste rolige økt rolig.` })
    } else {
      insights.push({ type: 'good', text: `80/20: ${Math.round((1 - pctHard) * 100)}% I-1/I-2 siste uke — riktig fordeling.` })
    }
  }

  // TSS-snitt
  if (avgTss < 200) {
    insights.push({ type: 'warning', text: `Ukentlig TSS snitt: ${avgTss.toFixed(0)} — lavt for basebyggingsfasen. Planen tilsier ~300–400 TSS/uke.` })
  }

  return insights
}
