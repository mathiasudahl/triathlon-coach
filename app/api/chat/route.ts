import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { MATHIAS, KAROLINE } from '@/lib/athletes'
import { getActivities, getEvents, getFitness, dateStr } from '@/lib/intervals'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  const { messages, athleteId } = await req.json()

  const athlete = athleteId === MATHIAS.id ? MATHIAS : KAROLINE
  const today = dateStr(0)

  // Hent relevant kontekst fra Intervals
  const [recentActs, upcomingEvents, fitness] = await Promise.all([
    getActivities(athlete.id, athlete.apiKey, dateStr(-21), today),
    getEvents(athlete.id, athlete.apiKey, today, dateStr(14)),
    getFitness(athlete.id, athlete.apiKey, dateStr(-30), today),
  ])

  const fitnessLast = (fitness as any[]).at(-1)
  const ctl = fitnessLast?.ctl ?? 0
  const atl = fitnessLast?.atl ?? 0
  const form = ctl - atl

  const systemPrompt = `Du er en erfaren triathlon- og utholdenhetscoach. Du hjelper ${athlete.name} med trening.

## Profil
- Navn: ${athlete.name}
- Alder: ${athlete.age} år, ${athlete.heightCm} cm, ${athlete.weightKg} kg
- Mål: ${athlete.mainGoal} (${athlete.mainGoalDate})
${athlete.id === MATHIAS.id ? `- FTP: ${athlete.ftp}W
- Har en forhåndsdefinert treningsplan i Intervals.icu. Planen er fasiten — vurder avvik og juster rundt den.` : `- Baserer anbefalinger på historisk treningstrender, belastning og restitusjon.`}

## Dagsform (i dag ${today})
- CTL (fitness): ${ctl.toFixed(1)}
- ATL (fatigue): ${atl.toFixed(1)}
- Form (TSB): ${form > 0 ? '+' : ''}${form.toFixed(1)}

## Kommende plan (neste 14 dager)
${(upcomingEvents as any[]).slice(0, 10).map((e: any) => `- ${e.start_date_local?.split('T')[0]} [${e.type}] ${e.name} (${e.moving_time ? Math.round(e.moving_time/60) + 'min' : '?'}, TSS ${e.icu_training_load ?? '?'})`).join('\n') || 'Ingen planlagte økter.'}

## Siste 21 dager aktiviteter
${(recentActs as any[]).slice(-15).map((a: any) => `- ${a.start_date_local?.split('T')[0]} [${a.type}] ${a.name} (${a.moving_time ? Math.round(a.moving_time/60) + 'min' : '?'}, TSS ${a.icu_training_load ?? '?'})`).join('\n') || 'Ingen aktiviteter.'}

## Regler
- Svar alltid på norsk
- Vær direkte og konkret — ingen generiske råd
- Når du foreslår endringer i planen: vis alltid NÅVÆRENDE plan vs NY plan side om side, og be om bekreftelse FØR du skriver til Intervals
- Etter bekreftelse: bruk tool_use for å skrive endringer via MCP
- Ikke kall API eller gjør endringer uten eksplisitt bekreftelse fra bruker`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages,
    })

    const first = response.content?.[0]
    return NextResponse.json({ content: first })
  } catch (error) {
    console.error('Claude API error:', error)
    return NextResponse.json({ error: 'Feil ved API-kall' }, { status: 500 })
  }
}
