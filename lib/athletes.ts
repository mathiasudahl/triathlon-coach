export type AthleteConfig = {
  id: string
  apiKey: string
  name: string
  color: string // accent-farge for denne utøveren
  weight: number
  goals: Goal[]
  sport: 'triathlon' | 'cycling' | 'running' | 'multisport'
  raceDate?: string // ISO dato for A-mål
  ftp?: number
  criticalSpeed?: number // min/km
  hrMax?: number
}

export type Goal = {
  label: string
  sport: 'run' | 'bike' | 'swim'
  targetValue: number // sekunder (run/swim) eller watt (bike)
  targetDate: string  // ISO dato
  unit: string        // '10k', 'halvmaraton', 'FTP'
  description: string
}

export const MATHIAS: AthleteConfig = {
  id: 'i303639',
  apiKey: '5zxq2q3lz5rrphkcmssymootd',
  name: 'Mathias',
  color: '#f97316', // orange
  weight: 70,
  sport: 'triathlon',
  raceDate: '2026-08-08',
  ftp: 237,
  criticalSpeed: 3.93, // 3:56/km i m/s
  hrMax: 199,
  goals: [
    {
      label: 'Olympisk triatlon',
      sport: 'bike',
      targetValue: 280,
      targetDate: '2026-08-08',
      unit: 'FTP mål',
      description: 'Race-day FTP ~280W for å holde 40km på terskel',
    },
  ],
}

export const KAROLINE: AthleteConfig = {
  id: 'i456432',
  apiKey: '7k8kuy3j0wqxg2y7x4ucg6epd',
  name: 'Karoline',
  color: '#e879f9', // fuchsia
  weight: 60, // estimert
  sport: 'multisport',
  ftp: 180, // estimert fra HF/watt-data
  hrMax: 195, // estimert
  goals: [
    {
      label: '10 km',
      sport: 'run',
      targetValue: 50 * 60, // sub-50 min
      targetDate: '2026-06-01',
      unit: '10k',
      description: 'Sub-50 min på 10k. Nåværende form tilsier ~48–49 min.',
    },
    {
      label: 'Halvmaraton',
      sport: 'run',
      targetValue: 120 * 60, // sub-2t
      targetDate: '2026-10-01',
      unit: 'halvmaraton',
      description: 'Sub-2t halvmaraton. Nåværende Z2-pace (5:40/km) tilsier dette er innen rekkevidde.',
    },
    {
      label: 'Sykkel FTP',
      sport: 'bike',
      targetValue: 210,
      targetDate: '2026-08-01',
      unit: 'FTP mål',
      description: 'FTP 210W — fra estimert ~180W nå. ~17% vekst over 5 måneder.',
    },
  ],
}

export const ATHLETES = [MATHIAS, KAROLINE]
