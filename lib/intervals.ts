import type { Activity, WorkoutEvent, Wellness } from "./types";

const BASE_URL = process.env.INTERVALS_BASE_URL!;

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64");
}

async function intervalsFetch(
  apiKey: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

export async function fetchActivities(
  athleteId: string,
  apiKey: string,
  oldest: string,
  newest: string,
  limit = 50
): Promise<Activity[]> {
  const params = new URLSearchParams({ oldest, newest, limit: String(limit) });
  const res = await intervalsFetch(
    apiKey,
    `/athlete/${athleteId}/activities?${params}`
  );
  if (!res.ok) throw new Error(`Activities fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchEvents(
  athleteId: string,
  apiKey: string,
  oldest: string,
  newest: string
): Promise<WorkoutEvent[]> {
  const params = new URLSearchParams({ oldest, newest });
  const res = await intervalsFetch(
    apiKey,
    `/athlete/${athleteId}/events?${params}`
  );
  if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchWellness(
  athleteId: string,
  apiKey: string,
  oldest: string,
  newest: string
): Promise<Wellness[]> {
  "use cache";
  const params = new URLSearchParams({ oldest, newest });
  const res = await intervalsFetch(
    apiKey,
    `/athlete/${athleteId}/wellness?${params}`
  );
  if (!res.ok) throw new Error(`Wellness fetch failed: ${res.status}`);
  const data: Wellness[] = await res.json();
  // Intervals.icu does not return tsb — compute it as CTL - ATL
  return data.map((w) => ({
    ...w,
    tsb: w.tsb ?? (w.ctl != null && w.atl != null ? w.ctl - w.atl : undefined),
  }));
}

export async function createEvent(
  athleteId: string,
  apiKey: string,
  event: Omit<WorkoutEvent, "id">
): Promise<WorkoutEvent> {
  const res = await intervalsFetch(apiKey, `/athlete/${athleteId}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Create event failed: ${res.status}`);
  return res.json();
}

export async function updateEvent(
  athleteId: string,
  apiKey: string,
  eventId: number,
  event: Partial<WorkoutEvent>
): Promise<WorkoutEvent> {
  const res = await intervalsFetch(
    apiKey,
    `/athlete/${athleteId}/events/${eventId}`,
    {
      method: "PUT",
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) throw new Error(`Update event failed: ${res.status}`);
  return res.json();
}

export async function deleteEvent(
  athleteId: string,
  apiKey: string,
  eventId: number
): Promise<void> {
  const res = await intervalsFetch(
    apiKey,
    `/athlete/${athleteId}/events/${eventId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Delete event failed: ${res.status}`);
}

export async function deleteEventsForDate(
  athleteId: string,
  apiKey: string,
  date: string
): Promise<number> {
  const events = await fetchEvents(athleteId, apiKey, date, date);
  // Only delete planned events, never completed activities
  const planned = events.filter(
    (e) => e.id !== undefined && e.category !== "ACTIVITY"
  );
  await Promise.all(planned.map((e) => deleteEvent(athleteId, apiKey, e.id!)));
  return planned.length;
}
