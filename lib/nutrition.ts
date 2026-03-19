import { Activity } from './intervals'
import { getSportType } from './fitness'

export type NutritionPlan = {
  before: { timing: string; carbs: number; protein: number; notes: string }
  during: { carbsPerHour: number; fluidMl: number; notes: string } | null
  after: { window: string; carbs: number; protein: number; notes: string }
  totalExtra: number // kcal utover basis
}

// kcal/min per sone og gren (per 70kg — skaleres med vekt)
const KCAL_PER_MIN: Record<string, Record<string, number>> = {
  swim:  { 'I-1': 7, 'I-2': 9,  'I-3': 11, 'I-4': 13, 'I-5': 15 },
  bike:  { 'I-1': 8, 'I-2': 10, 'I-3': 12, 'I-4': 14, 'I-5': 16 },
  run:   { 'I-1': 9, 'I-2': 11, 'I-3': 13, 'I-4': 15, 'I-5': 17 },
  other: { 'I-1': 6, 'I-2': 8,  'I-3': 10, 'I-4': 12, 'I-5': 14 },
}

export function estimateWorkoutKcal(
  durationMin: number,
  zone: string,
  sportType: string,
  weightKg = 70,
): number {
  const sport = getSportType(sportType)
  const base = KCAL_PER_MIN[sport]?.[zone] ?? 10
  return Math.round(base * durationMin * (weightKg / 70))
}

export function getNutritionPlan(
  durationMin: number,
  zone: string,
  sportType: string,
  weightKg = 70,
): NutritionPlan {
  const kcal = estimateWorkoutKcal(durationMin, zone, sportType, weightKg)
  const isHard = zone === 'I-3' || zone === 'I-4' || zone === 'I-5'
  const isLong = durationMin >= 75

  const before = isHard
    ? {
        timing: '2–3 timer før',
        carbs: Math.round(weightKg * 1.5),
        protein: 20,
        notes: 'Fullkornsris/pasta + kylling/egg. Unngå fett og fiber siste time.',
      }
    : {
        timing: '1–2 timer før',
        carbs: Math.round(weightKg * 0.5),
        protein: 10,
        notes: 'Lett måltid — banan, havregrøt eller toast. Ikke trening på tom mage.',
      }

  const during =
    durationMin >= 60
      ? {
          carbsPerHour: isHard ? 60 : 40,
          fluidMl: isHard ? 600 : 500,
          notes:
            isHard
              ? 'Gel/sportsdrikk hvert 20–30 min. Drikk jevnt — ikke vent til du er tørst.'
              : 'Sportsdrikk eller vann. Banan ved >75 min.',
        }
      : null

  const after = {
    window: '30 min',
    carbs: Math.round(weightKg * 1.0),
    protein: Math.round(weightKg * 0.4),
    notes: isHard
      ? 'Recovery-shake eller: sjokolademelk + brød m/ egg. Recovery-vinduet er kritisk.'
      : 'Normalt neste måltid holder. Fokus på væske.',
  }

  return { before, during, after, totalExtra: kcal }
}

// Ukentlig kalori-oppsummering
export function weeklyNutritionSummary(
  activities: Activity[],
  weightKg = 70,
): { totalKcal: number; extraPerDay: number; totalPerDay: number } {
  let total = 0
  for (const a of activities) {
    const min = (a.moving_time || 0) / 60
    const zone = 'I-2' // forenklet — bruk sonedata hvis tilgjengelig
    total += estimateWorkoutKcal(min, zone, a.type || '', weightKg)
  }
  const extraPerDay = Math.round(total / 7)
  const basis = weightKg * 40 // ~2800 for 70kg
  return { totalKcal: total, extraPerDay, totalPerDay: basis + extraPerDay }
}
