import Anthropic from "@anthropic-ai/sdk";
import type { Activity, WorkoutEvent, Wellness, WeatherData } from "./types";
import { formatDate, formatTime, formatDistance, today, daysAgo } from "./date-utils";
import { MATHIAS_PROGRAM } from "./programs/parse-program";
import { getCurrentProgramWeek, buildProgramSummary } from "./programs/program-utils";

export function buildProgramContext(athleteSlug: string): string {
  if (athleteSlug !== "mathias") return "";
  const week = getCurrentProgramWeek(MATHIAS_PROGRAM, new Date());
  return buildProgramSummary(MATHIAS_PROGRAM, week);
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function buildSystemPrompt(): string {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const tomorrowIso = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  return `Du er en personlig treningscoach for Mathias og Karoline. Du svarer alltid på norsk.
Du har tilgang til deres treningshistorikk, planlagte økter og dagsform (CTL/ATL/TSB).
Gi konkrete, personlige råd basert på dataene du ser.

DAGENS DATO: ${todayIso}
Bruk alltid datoer fra og med ${todayIso} eller senere. Bruk aldri datoer fra fortiden.

## Øktformat
Når du foreslår en treningsøkt, embed alltid et JSON-objekt. Feltet "description" MÅ inneholde strukturert økt i Intervals.icu workout-builder-syntaks.

## Øktnavn
Bruk korte, konsise navn på formatet "Sport: Type (intensitetssone)".
Eksempler: "Løp: Terskel (i4)", "Sykkel: VO2max (i5)", "Løp: Rolig langtur (i2)", "Sykkel: Sweet spot (i3-i4)", "Svøm: Pyramideintervaller", "Løp: Stigningsløp (ramp)".
Aldri generiske navn som "Treningsøkt" eller "Workout".

## Workout-builder-syntaks
- Steg: \`- [varighet] [mål]\`
- Varighet: \`10m\`, \`30s\`, \`1h\`, \`2km\`, \`500mtr\` (merk: \`m\` = minutter, \`mtr\` = meter)
- Watt-mål: \`75%\` (% av FTP), \`220w\` (absolutt), \`Z2\`, \`95-105%\`
- Puls-mål: \`70% HR\`, \`Z2 HR\`, \`95% LTHR\`
- Pace-mål: \`5:00/km Pace\`, \`Z2 Pace\`, \`78-82% Pace\`
- Intervaller: Seksjon med \`Navn Nx\` etterfulgt av steg (tom linje før og etter)
- Ramp (jevn økning): \`- 10m ramp 50%-75%\` — bruk for stigningsløp/oppvarming med progressiv intensitet
- Cue-tekst: legg inn som del av steget

Stigningsløp på løp = ramp-steg i workout-builder: \`- 20s ramp 85%-105% Pace\`

Eksempel løpeøkt med stigningsløp:
\`\`\`
- Oppvarming 15m Z2 Pace

Stigningsløp 6x
- 20s ramp 85%-105% Pace
- 40s Z1 Pace

- Nedkjøring 10m Z2 Pace
\`\`\`

Eksempel terskeløkt løp:
\`\`\`
- Oppvarming 15m Z2 Pace

Terskel 4x
- 6m 92-96% Pace
- 2m 60% Pace

- Nedkjøring 10m Z2 Pace
\`\`\`

Eksempel sykkeløkt:
\`\`\`
- Oppvarming 15m ramp 50%-75% 90rpm

Terskel 3x
- 8m 95-105% 88-92rpm
- 4m 55%

- Nedkjøring 10m 55%
\`\`\`

JSON-format (description er workout-builder-tekst):
\`\`\`json
{"workout_suggestion":true,"start_date_local":"${tomorrowIso}T09:00:00","type":"Run","name":"Løp: Terskel (i4)","moving_time":3600,"icu_training_load":80,"description":"- Oppvarming 15m Z2 Pace\\n\\nTerskel 4x\\n- 6m 92-96% Pace\\n- 2m 60% Pace\\n\\n- Nedkjøring 10m Z2 Pace"}
\`\`\`

Gyldige sport-typer: Run, Ride, Swim, WeightTraining, NordicSki, Rowing.
Hold tekstsvaret kort (2-3 setninger). Øktdetaljene ligger i JSON-blokken.

## Styrkeøkter (WeightTraining)
Styrkeøkter for triatleter bruker IKKE workout-builder-syntaks i description. Feltet "description" skal være fritekst med øvelsesliste.
Øvelsene MÅ støtte løping, sykling og svømming. Fokus på:
- Hofteekstensjon og kjernemuskulatur (glutes, hamstrings, core)
- Skulderstabilitet og trekk (relevant for svømming)
- Single-leg-bevegelser (relevant for løp og sykkel)
- Unngå isolasjonsøvelser som bicep curls, leg extensions o.l.

Eksempel styrkeøkt for triatlet:
\`\`\`json
{"workout_suggestion":true,"start_date_local":"${tomorrowIso}T07:00:00","type":"WeightTraining","name":"Styrke: Funksjonell (triatlon)","moving_time":2700,"icu_training_load":40,"description":"3 runder, 60 sek hvile mellom øvelser\\n\\n- Rumensk markløft: 3x10\\n- Bulgarsk splittknebøy: 3x8 per ben\\n- Planke med rotasjon: 3x10\\n- Banded pull-apart: 3x15\\n- Hip thrust: 3x12\\n- Pallof press: 3x10 per side"}
\`\`\`

Navn for styrkeøkter: "Styrke: Funksjonell (triatlon)", "Styrke: Overkropp/Skulder", "Styrke: Ben og hofte", "Styrke: Core og stabilitet".

## Mathias — Intensitetssoner (referanse)
| Sone | Watt | HF bpm | Løpspace | Svømpace |
|------|------|--------|----------|----------|
| I-1 | <183W | 109–129 | >5:05/km | >2:50 |
| I-2 | 183–210W | 130–150 | 4:35–5:05/km | 2:33–2:50 |
| I-3 | 210–229W | 151–171 | 4:10–4:35/km | 2:25–2:33 |
| I-4 | 229–260W | 172–182 | 3:42–4:10/km | 2:15–2:25 |
| I-5 | >260W | 183+ | <3:42/km | <2:15 |
FTP=269W · CS=3:56/km · CSS=2:25/100m`;
}

export function buildContext(
  athleteName: string,
  activities: Activity[],
  events: WorkoutEvent[],
  wellness: Wellness[]
): string {
  const latest = wellness.length > 0 ? wellness[wellness.length - 1] : null;

  const todayIso = new Date().toISOString().slice(0, 10);
  let ctx = `## ${athleteName} — Treningskontekst (dato: ${todayIso})\n\n`;

  if (latest) {
    ctx += `**Dagsform:** CTL=${Math.round(latest.ctl ?? 0)}, ATL=${Math.round(latest.atl ?? 0)}, TSB=${Math.round(latest.tsb ?? 0)}`;
    if (latest.weight) ctx += `, Vekt=${latest.weight.toFixed(1)}kg`;
    if (latest.readiness) ctx += `, Readiness=${latest.readiness}`;
    ctx += "\n\n";
  }

  const recentActivities = activities.slice(-10);
  if (recentActivities.length > 0) {
    ctx += "**Siste aktiviteter:**\n";
    for (const a of recentActivities) {
      const parts = [
        formatDate(a.start_date_local),
        a.type,
        a.name,
        formatTime(a.moving_time),
      ];
      if (a.distance > 0) parts.push(formatDistance(a.distance));
      if (a.icu_training_load) parts.push(`${Math.round(a.icu_training_load)} TSS`);
      if (a.average_heartrate) parts.push(`${Math.round(a.average_heartrate)} bpm`);
      ctx += `- ${parts.join(" | ")}\n`;
    }
    ctx += "\n";
  }

  const upcomingEvents = events.slice(0, 10);
  if (upcomingEvents.length > 0) {
    ctx += "**Planlagte økter:**\n";
    for (const e of upcomingEvents) {
      const parts = [formatDate(e.start_date_local), e.type, e.name];
      if (e.moving_time) parts.push(formatTime(e.moving_time));
      if (e.icu_training_load) parts.push(`${Math.round(e.icu_training_load)} TSS`);
      ctx += `- ${parts.join(" | ")}\n`;
    }
  }

  return ctx;
}

export function buildDailyAnalysisPrompt(
  athleteName: string,
  athleteSlug: string,
  activities: Activity[],
  todayEvents: WorkoutEvent[],
  futureEvents: WorkoutEvent[],
  wellness: Wellness[],
  weather: WeatherData | null
): string {
  const todayStr = today();
  const yesterdayStr = daysAgo(1);

  const yesterdayActivities = activities.filter(
    (a) => a.start_date_local.slice(0, 10) === yesterdayStr
  );
  const latestWellness = wellness.length > 0 ? wellness[wellness.length - 1] : null;

  const programCtx = buildProgramContext(athleteSlug);

  let prompt = `Du er en treningscoach. Analyser dataene nedenfor og returner BARE et JSON-objekt (ingen markdown, ingen tekst utenfor JSON).

Utøver: ${athleteName}
Dato i dag: ${todayStr}
`;

  if (programCtx) {
    prompt += `\n${programCtx}\n`;
  }


  if (latestWellness) {
    prompt += `\nDagsform: CTL=${Math.round(latestWellness.ctl ?? 0)}, ATL=${Math.round(latestWellness.atl ?? 0)}, TSB=${Math.round(latestWellness.tsb ?? 0)}`;
    if (latestWellness.weight) prompt += `, Vekt=${latestWellness.weight.toFixed(1)}kg`;
    if (latestWellness.hrv) prompt += `, HRV=${latestWellness.hrv}`;
    if (latestWellness.sleepSecs) prompt += `, Søvn=${Math.round(latestWellness.sleepSecs / 3600 * 10) / 10}t`;
    if (latestWellness.readiness) prompt += `, Readiness=${latestWellness.readiness}`;
    prompt += "\n";
  }

  if (yesterdayActivities.length > 0) {
    prompt += "\nGårsdagens gjennomførte økt(er):\n";
    for (const a of yesterdayActivities) {
      const parts = [a.type, a.name, formatTime(a.moving_time)];
      if (a.distance > 0) parts.push(formatDistance(a.distance));
      if (a.icu_training_load) parts.push(`${Math.round(a.icu_training_load)} TSS`);
      if (a.average_heartrate) parts.push(`${Math.round(a.average_heartrate)} bpm`);
      prompt += `- ${parts.join(" | ")}\n`;
    }
  } else {
    prompt += "\nGårsdagens aktivitet: HVILEDAG (ingen registrert økt — dette er normalt og etter plan).\n";
  }

  if (todayEvents.length > 0) {
    prompt += "\nPlanlagt for i dag:\n";
    for (const e of todayEvents) {
      const parts = [e.type, e.name];
      if (e.moving_time) parts.push(formatTime(e.moving_time));
      if (e.icu_training_load) parts.push(`${Math.round(e.icu_training_load)} TSS`);
      prompt += `- ${parts.join(" | ")}\n`;
    }
  } else {
    prompt += "\nPlanlagt for i dag: Ingen planlagte økter.\n";
  }

  if (futureEvents.length > 0) {
    prompt += "\nØkter planlagt neste 7 dager:\n";
    for (const e of futureEvents.slice(0, 10)) {
      const parts = [formatDate(e.start_date_local), e.type, e.name];
      if (e.moving_time) parts.push(formatTime(e.moving_time));
      if (e.icu_training_load) parts.push(`${Math.round(e.icu_training_load)} TSS`);
      prompt += `- ${parts.join(" | ")}\n`;
    }
  }

  if (weather) {
    prompt += `\nVær i dag: ${weather.temperature}°C, vind ${weather.windspeed} m/s, kode ${weather.weathercode}\n`;
  }

  prompt += `
Instruksjoner:
1. weekType: Bruk programfasen direkte fra konteksten om tilgjengelig (f.eks. "Build 1: Restitusjon"). Ellers bestem basert på kommende plan. Maks 4 ord.
2. summary: Kommenter gårsdagens økt KORT (maks 2 setninger). Hvis hviledag: si noe positivt om hvile og hva som venter. ALDRI kall hviledag et "avvik fra plan" — hvile ER planen.
3. nutritionAdvice: Gi en KORT kostholdsanbefaling for i dag (maks 1 setning). Fokuser på praktiske tips.
4. weatherNote: Bare hvis regn (kode 51-82) eller sterk vind (>10 m/s) treffer planlagt utendørsøkt (Run/Ride). Null ellers.
5. adaptWeek: Sett true BARE om gjennomført økt avvek >20% fra planlagt TSS (ikke hviledag). Hviledag = adaptWeek=false.
6. adaptSuggestion: Konkret forslag kun om adaptWeek=true.

Returner BARE dette JSON-objektet:
{
  "date": "${todayStr}",
  "athleteSlug": "${athleteSlug}",
  "weekType": "Restitusjonsuke",
  "summary": "Kort kommentar om i går",
  "nutritionAdvice": "Konkret anbefaling for i dag",
  "weatherNote": null,
  "adaptWeek": false,
  "adaptSuggestion": null,
  "generatedAt": "${new Date().toISOString()}"
}`;

  return prompt;
}

export function buildShortContext(
  athleteName: string,
  athleteSlug: string,
  events: WorkoutEvent[],
  wellness: Wellness[]
): string {
  const latest = wellness.length > 0 ? wellness[wellness.length - 1] : null;
  let ctx = `## ${athleteName}\n`;
  if (latest) {
    ctx += `CTL=${Math.round(latest.ctl ?? 0)}, TSB=${Math.round(latest.tsb ?? 0)}\n`;
  }
  const next5 = events.slice(0, 5);
  if (next5.length > 0) {
    ctx += "Neste 5 planlagte: " + next5.map((e) => `${e.type} ${formatDate(e.start_date_local)}`).join(", ") + "\n";
  }
  const programCtx = buildProgramContext(athleteSlug);
  if (programCtx) {
    ctx += "\n" + programCtx + "\n";
  }
  return ctx;
}
