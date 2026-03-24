import { NextRequest, NextResponse } from "next/server";
import { makeAnthropic } from "@/lib/ai";
import { fetchActivities, fetchWellness } from "@/lib/intervals";
import { getAthlete } from "@/lib/athletes";
import { today, daysAgo, daysFromNow } from "@/lib/date-utils";
import type { WorkoutEvent } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    athleteSlug,
    athleteId: directAthleteId,
    apiKey: directApiKey,
    anthropicKey,
    athleteName: directName,
    mode,
  } = body;

  if (mode !== "week" && mode !== "month" && mode !== "current_week") {
    return NextResponse.json({ error: "mode must be week, current_week or month" }, { status: 400 });
  }

  let athleteId: string;
  let apiKey: string;
  let athleteName: string;

  if (directAthleteId && directApiKey) {
    athleteId = directAthleteId;
    apiKey = directApiKey;
    athleteName = directName ?? "Bruker";
  } else if (athleteSlug === "mathias" || athleteSlug === "karoline") {
    const athlete = getAthlete(athleteSlug);
    athleteId = athlete.id;
    apiKey = athlete.apiKey;
    athleteName = athlete.name;
  } else {
    return NextResponse.json({ error: "Invalid athlete" }, { status: 400 });
  }

  if (!anthropicKey && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No AI key provided" }, { status: 400 });
  }

  const client = makeAnthropic(anthropicKey);
  const t = today();
  const thirtyDaysAgo = daysAgo(30);

  const [activitiesRes, wellnessRes] = await Promise.allSettled([
    fetchActivities(athleteId, apiKey, thirtyDaysAgo, t, 30),
    fetchWellness(athleteId, apiKey, daysAgo(7), t),
  ]);

  const activities = activitiesRes.status === "fulfilled" ? activitiesRes.value : [];
  const wellness = wellnessRes.status === "fulfilled" ? wellnessRes.value : [];

  const now = new Date();
  let periodLabel: string;
  let startDate: string;
  let endDate: string;

  if (mode === "current_week") {
    // Current Monday–Sunday (rest of this week from today)
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - daysFromMonday);
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);
    startDate = now.toISOString().slice(0, 10); // start from today (don't overwrite past days)
    endDate = thisSunday.toISOString().slice(0, 10);
    periodLabel = `denne uken (${startDate} – ${endDate})`;
  } else if (mode === "week") {
    // Next Monday–Sunday
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    startDate = nextMonday.toISOString().slice(0, 10);
    endDate = nextSunday.toISOString().slice(0, 10);
    periodLabel = `neste uke (${startDate} – ${endDate})`;
  } else {
    // Next calendar month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    startDate = nextMonth.toISOString().slice(0, 10);
    endDate = lastDay.toISOString().slice(0, 10);
    periodLabel = `neste måned (${startDate} – ${endDate})`;
  }

  const activityLines = activities
    .slice(-20)
    .map((a) => {
      const parts = [a.start_date_local.slice(0, 10), a.type, a.name, `${Math.round(a.moving_time / 60)}min`];
      if (a.distance > 0) parts.push(`${(a.distance / 1000).toFixed(1)}km`);
      if (a.icu_training_load) parts.push(`${Math.round(a.icu_training_load)} TSS`);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  const latestWellness = wellness.length > 0 ? wellness[wellness.length - 1] : null;
  const wellnessLine = latestWellness
    ? `CTL=${Math.round(latestWellness.ctl ?? 0)}, ATL=${Math.round(latestWellness.atl ?? 0)}, TSB=${Math.round(latestWellness.tsb ?? 0)}`
    : "Ingen wellness-data";

  const tomorrowIso = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  const prompt = `Du er en treningscoach. Lag en treningsplan for ${athleteName} for ${periodLabel}.

Dagsform: ${wellnessLine}

Siste aktiviteter:
${activityLines || "Ingen aktiviteter"}

Instruksjoner:
- Generer 4–7 treningsøkter fordelt utover perioden
- Varier sport og intensitet basert på historikk
- Bruk datointervallet ${startDate} til ${endDate}
- Returner BARE et JSON-array med WorkoutEvent-objekter, ingen annen tekst

JSON-format for hvert element:
{"start_date_local":"${tomorrowIso}T09:00:00","category":"WORKOUT","type":"Run","name":"Løp: Rolig langtur (i2)","moving_time":3600,"icu_training_load":60,"description":"- 60m Z2 Pace"}

Gyldige typer: Run, Ride, Swim, WeightTraining
Returner BARE JSON-array (ingen markdown, ingen tekst utenfor JSON):`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let workouts: WorkoutEvent[];
    try {
      workouts = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
    }

    return NextResponse.json({ workouts, periodLabel });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
