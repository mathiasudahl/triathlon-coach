// Abstraksjonslag for localStorage — enkelt å bytte til DB senere
// All persistering per atlet skjer her

export type PersonalRecord = {
  sport: string
  label: string
  value: string
  date: string
}

export type AthleteSettings = {
  mainGoal: string
  mainGoalDate: string
  records: PersonalRecord[]
  weightKg?: number
}

const DEFAULT_SETTINGS: Record<string, AthleteSettings> = {
  mathias: {
    mainGoal: 'Olympisk triatlon',
    mainGoalDate: '2026-08-08',
    weightKg: 70,
    records: [
      { sport: 'Run', label: '5k', value: '20:12', date: '2025-11-01' },
      { sport: 'Run', label: '10k', value: '42:30', date: '2025-09-15' },
      { sport: 'Ride', label: 'FTP', value: '237 W', date: '2026-02-26' },
      { sport: 'Swim', label: '400m', value: '6:45', date: '2025-12-01' },
    ],
  },
  karoline: {
    mainGoal: 'Sub-50 10k',
    mainGoalDate: '2026-06-01',
    weightKg: 60,
    records: [
      { sport: 'Run', label: '5k', value: '24:10', date: '2025-10-01' },
      { sport: 'Run', label: '10k', value: '50:45', date: '2025-11-01' },
      { sport: 'Ride', label: 'FTP', value: '180 W', date: '2026-01-15' },
    ],
  },
}

function key(athleteId: string) {
  return `tc_athlete_${athleteId}`
}

export function loadSettings(athleteId: string): AthleteSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS[athleteId] ?? DEFAULT_SETTINGS.mathias
  const raw = localStorage.getItem(key(athleteId))
  if (!raw) return DEFAULT_SETTINGS[athleteId] ?? DEFAULT_SETTINGS.mathias
  try {
    return { ...DEFAULT_SETTINGS[athleteId], ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS[athleteId] ?? DEFAULT_SETTINGS.mathias
  }
}

export function saveSettings(athleteId: string, settings: AthleteSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key(athleteId), JSON.stringify(settings))
}
