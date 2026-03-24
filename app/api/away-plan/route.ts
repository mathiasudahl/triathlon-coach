import { NextRequest, NextResponse } from "next/server";
import { makeAnthropic, buildSystemPrompt } from "@/lib/ai";
import { fetchEvents, fetchActivities, fetchWellness } from "@/lib/intervals";
import { getAthlete } from "@/lib/athletes";
import { daysAgo, formatDate, formatTime } from "@/lib/date-utils";
import type { WorkoutEvent, AwayPlanResult, AthleteAwayResult } from "@/lib/types";

// Which sport types require which equipment key
const SPORT_REQUIRES: Record<string, string> = {
  Swim: "Swim",
  Ride: "Ride",
  VirtualRide: "Ride",
  Run: "Run",
  VirtualRun: "Run",
  WeightTraining: "WeightTraining",
  NordicSki: "NordicSki",
  Rowing: "Rowing",
  IceClimbing: "IceClimbing",
  RockClimbing: "RockClimbing",
  Boxing: "Boxing",
  Kayaking: "Kayaking",
  // Walk/Hike need no equipment
};

function sportFitsEquipment(type: string, equipment: string[]): boolean {
  const required = SPORT_REQUIRES[type];
  if (!required) return true; // Walk, Hike, etc. — no equipment needed
  return equipment.includes(required);
}

interface AthleteTarget {
  id: string;
  apiKey: string;
  name: string;
  slug: string;
  color: string;
}

async function planForAthlete(
  athlete: AthleteTarget,
  startDate: string,
  endDate: string,
  equipment: string[],
  anthropicKey: string | undefined
): Promise<AthleteAwayResult> {
  const [eventsRes, activitiesRes, wellnessRes] = await Promise.allSettled([
    fetchEvents(athlete.id, athlete.apiKey, startDate, endDate),
    fetchActivities(athlete.id, athlete.apiKey, daysAgo(14), startDate, 10),
    fetchWellness(athlete.id, athlete.apiKey, daysAgo(7), startDate),
  ]);

  const events = eventsRes.status === "fulfilled" ? eventsRes.value : [];
  const activities = activitiesRes.status === "fulfilled" ? activitiesRes.value : [];
  const wellness = wellnessRes.status === "fulfilled" ? wellnessRes.value : [];

  // Pre-classify without AI for events that obviously fit or don't
  const toKeep: WorkoutEvent[] = [];
  const toReplace: WorkoutEvent[] = [];

  for (const e of events) {
    if (e.category === "ACTIVITY") continue; // skip completed
    if (sportFitsEquipment(e.type, equipment)) {
      toKeep.push(e);
    } else {
      toReplace.push(e);
    }
  }

  // If nothing to replace, return early without AI call
  if (toReplace.length === 0) {
    return {
      athleteSlug: athlete.slug,
      athleteName: athlete.name,
      athleteColor: athlete.color,
      results: toKeep.map((e) => ({ eventId: e.id!, action: "keep", originalEvent: e })),
    };
  }

  const equipmentLabel = equipment.length > 0 ? equipment.join(", ") : "ingen (kroppsvekt/gange)";
  const latestWellness = wellness[wellness.length - 1];
  const wellnessLine = latestWellness
    ? `CTL=${Math.round(latestWellness.ctl ?? 0)}, ATL=${Math.round(latestWellness.atl ?? 0)}, TSB=${Math.round(latestWellness.tsb ?? 0)}`
    : "";

  const recentLines = activities
    .slice(-5)
    .map((a) => `- ${a.start_date_local.slice(0, 10)} ${a.type} ${a.name} ${Math.round(a.moving_time / 60)}min${a.icu_training_load ? ` ${Math.round(a.icu_training_load)}TSS` : ""}`)
    .join("\n");

  const replaceLines = toReplace
    .map((e) => `{"eventId":${e.id},"date":"${e.start_date_local.slice(0, 10)}","type":"${e.type}","name":"${e.name}","tss":${e.icu_training_load ?? 0},"duration":${e.moving_time ?? 3600}}`)
    .join("\n");

  const prompt = `Utøver: ${athlete.name}${wellnessLine ? `\nDagsform: ${wellnessLine}` : ""}${recentLines ? `\nSiste aktiviteter:\n${recentLines}` : ""}

Tilgjengelig utstyr bortereise ${startDate}–${endDate}: ${equipmentLabel}

Disse øktene passer IKKE utstyret og må erstattes:
${replaceLines}

For hver økt: lag en alternativ økt med tilgjengelig utstyr. Hold TSS og varighet tilnærmet likt originalen. Bruk workout-builder-syntaks i description.

Returner BARE JSON-array (ingen markdown):
[{"eventId":123,"newWorkout":{"start_date_local":"DATO T09:00:00","category":"WORKOUT","type":"Run","name":"Løp: Rolig (i2)","moving_time":3600,"icu_training_load":60,"description":"- 60m Z2 Pace"}}]`;

  const client = makeAnthropic(anthropicKey);
  const systemPrompt = buildSystemPrompt();

  let replacements: { eventId: number; newWorkout: WorkoutEvent }[] = [];
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    replacements = JSON.parse(jsonStr);
  } catch {
    // Fall back: mark as replace with no newWorkout if AI fails
    replacements = toReplace.map((e) => ({ eventId: e.id!, newWorkout: undefined as unknown as WorkoutEvent }));
  }

  const results: AwayPlanResult[] = [
    ...toKeep.map((e): AwayPlanResult => ({ eventId: e.id!, action: "keep", originalEvent: e })),
    ...toReplace.map((e): AwayPlanResult => {
      const match = replacements.find((r) => r.eventId === e.id);
      return {
        eventId: e.id!,
        action: "replace",
        originalEvent: e,
        newWorkout: match?.newWorkout,
      };
    }),
  ];

  // Sort by date
  results.sort((a, b) =>
    a.originalEvent.start_date_local.localeCompare(b.originalEvent.start_date_local)
  );

  return {
    athleteSlug: athlete.slug,
    athleteName: athlete.name,
    athleteColor: athlete.color,
    results,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { startDate, endDate, equipment, athleteSlugs, athleteId: directAthleteId, apiKey: directApiKey, anthropicKey, athleteName: directName } = body;

  if (!startDate || !endDate || !Array.isArray(equipment)) {
    return NextResponse.json({ error: "startDate, endDate og equipment er påkrevd" }, { status: 400 });
  }

  let athletes: AthleteTarget[];

  if (directAthleteId && directApiKey) {
    athletes = [{ id: directAthleteId, apiKey: directApiKey, name: directName ?? "Bruker", slug: "custom", color: "#7c3aed" }];
  } else if (Array.isArray(athleteSlugs) && athleteSlugs.length > 0) {
    athletes = athleteSlugs
      .filter((s: string): s is "mathias" | "karoline" => s === "mathias" || s === "karoline")
      .map((slug) => {
        const a = getAthlete(slug);
        return { id: a.id, apiKey: a.apiKey, name: a.name, slug, color: slug === "mathias" ? "#16a34a" : "#2563eb" };
      });
  } else {
    return NextResponse.json({ error: "Ingen gyldig atlet" }, { status: 400 });
  }

  try {
    const allResults = await Promise.all(
      athletes.map((a) => planForAthlete(a, startDate, endDate, equipment, anthropicKey))
    );
    return NextResponse.json({ athletes: allResults });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
