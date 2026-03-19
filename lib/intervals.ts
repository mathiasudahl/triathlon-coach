const BASE = 'https://intervals.icu/api/v1'

function auth(apiKey: string) {
  return 'Basic ' + Buffer.from(`API_KEY:${apiKey}`).toString('base64')
}

async function get<T>(athleteId: string, apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/athlete/${athleteId}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: { Authorization: auth(apiKey) },
    next: { revalidate: 300 },
  })
  if (!res.ok) {
    console.error(`Intervals API error ${res.status}: ${path}`)
    return [] as T
  }
  return res.json()
}

export type Activity = {
  id: string
  start_date_local: string
  type: string
  name: string
  moving_time?: number
  distance?: number
  total_elevation_gain: number
  average_watts?: number
  average_heartrate?: number
  icu_training_load?: number
  icu_atl: number
  icu_ctl: number
}

export type Event = {
  id: number
  start_date_local: string
  type: string
  name: string
  description?: string
  moving_time?: number
  icu_training_load?: number
  paired_activity_id?: string
}

export type Wellness = {
  id: string // date YYYY-MM-DD
  weight?: number
  hrv?: number
  restingHR?: number
  sleepSecs?: number
  sleepScore?: number
  spO2?: number
}

export type FitnessPoint = {
  id: string // date YYYY-MM-DD
  ctl: number
  atl: number
  form: number
  weight?: number
  hrv?: number
  restingHR?: number
}

function dateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

export async function getActivities(athleteId: string, apiKey: string, oldest: string, newest: string): Promise<Activity[]> {
  return get(athleteId, apiKey, '/activities', { oldest, newest })
}

export async function getEvents(athleteId: string, apiKey: string, oldest: string, newest: string): Promise<Event[]> {
  return get(athleteId, apiKey, '/events', { oldest, newest })
}

export async function getWellness(athleteId: string, apiKey: string, oldest: string, newest: string): Promise<Wellness[]> {
  return get(athleteId, apiKey, '/wellness', { oldest, newest })
}

export async function getFitness(athleteId: string, apiKey: string, oldest: string, newest: string): Promise<FitnessPoint[]> {
  // Wellness inneholder CTL/ATL — vi mapper til FitnessPoint
  const raw = await get<any[]>(athleteId, apiKey, '/wellness', { oldest, newest })
  return raw
    .filter((w: any) => w.ctl != null)
    .map((w: any) => ({
      id: w.id,
      ctl: w.ctl,
      atl: w.atl,
      form: (w.ctl ?? 0) - (w.atl ?? 0),
      weight: w.weight ?? undefined,
      hrv: w.hrv ?? undefined,
      restingHR: w.restingHR ?? undefined,
    }))
}

export async function getAthlete(athleteId: string, apiKey: string) {
  const url = `${BASE}/athlete/${athleteId}`
  const res = await fetch(url, {
    headers: { Authorization: auth(apiKey) },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

// Write event to Intervals.icu
export async function createEvent(athleteId: string, apiKey: string, event: Partial<Event>): Promise<Event | null> {
  const url = `${BASE}/athlete/${athleteId}/events`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: auth(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })
  if (!res.ok) return null
  return res.json()
}

export async function updateEvent(athleteId: string, apiKey: string, eventId: number, event: Partial<Event>): Promise<Event | null> {
  const url = `${BASE}/athlete/${athleteId}/events/${eventId}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: auth(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })
  if (!res.ok) return null
  return res.json()
}

export async function deleteEvent(athleteId: string, apiKey: string, eventId: number): Promise<boolean> {
  const url = `${BASE}/athlete/${athleteId}/events/${eventId}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: auth(apiKey) },
  })
  return res.ok
}

export { dateStr }
