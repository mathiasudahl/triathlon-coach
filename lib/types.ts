export interface Athlete {
  id: string;
  apiKey: string;
  name: string;
  color: string;
  slug: "mathias" | "karoline";
  programSlug?: string;
  goals?: AthleteGoals;
  prs?: AthletePRs;
}

export interface TrainingProgram {
  athleteSlug: "mathias" | "karoline";
  targetRace: string;
  targetDate: string;
  profile: AthleteProfile;
  weeks: ProgramWeek[];
}

export interface AthleteProfile {
  ftp: number;
  cs: string;
  css: string;
  vo2max: number;
}

export interface ProgramWeek {
  weekNumber: number;
  phase: string;
  weekType: string;
  startDate: string;
  endDate: string;
  workouts: ProgramWorkout[];
}

export interface ProgramWorkout {
  dayOfWeek: number;
  timeOfDay: "AM" | "PM" | null;
  type: "Ride" | "Run" | "Swim" | "WeightTraining";
  name: string;
  durationMinutes: number;
  tss?: number;
  description: string;
  optional: boolean;
  indoor: boolean | null; // true=inne, false=ute, null=ukjent
}

export interface AthleteGoals {
  runWeeklyKm?: number;
  rideWeeklyKm?: number;
  swimWeeklyKm?: number;
  targetRace?: string;
  targetDate?: string;
  ctlTarget?: number;
}

export interface AthletePRs {
  run5k?: string;
  run10k?: string;
  runHalf?: string;
  runMarathon?: string;
  swim100m?: string;
  swim1500m?: string;
  rideFTP?: number;
  rideMaxHour?: number;
}

export interface Activity {
  id: number;
  start_date_local: string;
  type: string;
  name: string;
  moving_time: number;
  distance: number;
  icu_training_load?: number;
  average_heartrate?: number;
  average_watts?: number;
  total_elevation_gain?: number;
  icu_intensity?: number;
  indoor_workout?: boolean;
  trainer?: boolean;
}

export interface WorkoutEvent {
  id?: number;
  start_date_local: string;
  category: string;
  type: string;
  name: string;
  moving_time?: number;
  icu_training_load?: number;
  description?: string;
  indoor_workout?: boolean;
}

export interface Wellness {
  id: string; // date YYYY-MM-DD
  ctl?: number;
  atl?: number;
  tsb?: number;
  weight?: number;
  restingHR?: number;
  hrv?: number;
  sleepSecs?: number;
  sleepScore?: number;
  readiness?: number;
  form?: number;
}

export interface WeatherData {
  temperature: number;
  windspeed: number;
  symbol: string;
  description: string;
}

export type WeatherForecast = Record<string, WeatherData>; // keyed by "yyyy-MM-dd"

export interface FitnessPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
}

export interface DailyAnalysis {
  date: string;
  athleteSlug: string;
  weekType: string;
  summary: string;
  nutritionAdvice: string;
  weatherNote?: string;
  adaptWeek: boolean;
  adaptSuggestion?: string;
  generatedAt: string;
}
