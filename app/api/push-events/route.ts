import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.INTERVALS_BASE_URL || 'https://intervals.icu/api/v1'

type EventPayload = {
  start_date_local: string
  type: string
  name: string
  description?: string
  moving_time?: number
  icu_training_load?: number
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { athleteId, apiKey, events } = body as {
    athleteId: string
    apiKey: string
    events: EventPayload[]
  }

  if (!athleteId || !apiKey || !events?.length) {
    return NextResponse.json({ error: 'Mangler data' }, { status: 400 })
  }

  const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  const results = []
  const errors = []

  for (const event of events) {
    try {
      const res = await fetch(`${BASE_URL}/athlete/${athleteId}/events`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      })
      if (res.ok) {
        results.push(await res.json())
      } else {
        errors.push({ event: event.name, status: res.status })
      }
    } catch (e) {
      errors.push({ event: event.name, error: String(e) })
    }
  }

  return NextResponse.json({ pushed: results.length, errors })
}
