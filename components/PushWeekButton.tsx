'use client'
import { useState } from 'react'
import { Event } from '@/lib/intervals'

type Props = {
  events: Event[]
  athleteId: string
  apiKey: string
  label?: string
}

export default function PushWeekButton({ events, athleteId, apiKey, label = 'Push til intervals.icu' }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<{ pushed: number; errors: unknown[] } | null>(null)

  const unpushed = events.filter(e => !e.paired_activity_id)

  if (unpushed.length === 0) return null

  async function handlePush() {
    setState('loading')
    try {
      const res = await fetch('/api/push-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId,
          apiKey,
          events: unpushed.map(e => ({
            start_date_local: e.start_date_local,
            type: e.type,
            name: e.name,
            description: e.description,
            moving_time: e.moving_time,
            icu_training_load: e.icu_training_load,
          })),
        }),
      })
      const data = await res.json()
      setResult(data)
      setState(data.errors?.length > 0 ? 'error' : 'success')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handlePush}
        disabled={state === 'loading' || state === 'success'}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
          state === 'success'
            ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
            : state === 'error'
            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:border-stone-300 active:scale-95 shadow-sm'
        }`}
      >
        {state === 'loading' ? 'Pusher...' :
         state === 'success' ? `✓ ${result?.pushed} økter pushet` :
         state === 'error' ? 'Feil — prøv igjen' :
         `${label} (${unpushed.length} økter)`}
      </button>
      {result?.errors && result.errors.length > 0 && (
        <span className="text-xs text-red-400">{result.errors.length} feil</span>
      )}
    </div>
  )
}
