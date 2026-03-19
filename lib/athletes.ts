export type Athlete = {
  id: string
  name: string
  apiKey: string
  color: string
  colorLight: string
  colorBg: string
  age: number
  heightCm: number
  weightKg: number
  ftp: number
  mainGoal: string
  mainGoalDate: string
  sports: string[]
}

export const MATHIAS: Athlete = {
  id: 'i303639',
  name: 'Mathias',
  apiKey: '5zxq2q3lz5rrphkcmssymootd',
  color: '#16a34a',
  colorLight: '#86efac',
  colorBg: '#f0fdf4',
  age: 31,
  heightCm: 176,
  weightKg: 70,
  ftp: 237,
  mainGoal: 'Olympisk triatlon',
  mainGoalDate: '2026-08-08',
  sports: ['Swim', 'Ride', 'Run'],
}

export const KAROLINE: Athlete = {
  id: 'i456432',
  name: 'Karoline',
  apiKey: '7k8kuy3j0wqxg2y7x4ucg6epd',
  color: '#2563eb',
  colorLight: '#93c5fd',
  colorBg: '#eff6ff',
  age: 29,
  heightCm: 173,
  weightKg: 60,
  ftp: 180,
  mainGoal: 'Sub-50 10k',
  mainGoalDate: '2026-06-01',
  sports: ['Run', 'Ride'],
}

export const ATHLETES = [MATHIAS, KAROLINE]

export const SPORT_COLOR: Record<string, string> = {
  Swim: '#0ea5e9',
  Ride: '#f97316',
  VirtualRide: '#f97316',
  Run: '#22c55e',
  VirtualRun: '#22c55e',
  WeightTraining: '#a855f7',
  Walk: '#84cc16',
}

export const SPORT_LABEL: Record<string, string> = {
  Swim: 'Svøm',
  Ride: 'Sykkel',
  VirtualRide: 'Zwift',
  Run: 'Løp',
  VirtualRun: 'Løp',
  WeightTraining: 'Styrke',
  Walk: 'Gange',
}
