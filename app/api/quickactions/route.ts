import { NextRequest, NextResponse } from "next/server";
import { makeAnthropic, buildSystemPrompt, buildShortContext } from "@/lib/ai";
import { fetchActivities, fetchEvents, fetchWellness } from "@/lib/intervals";
import { getAthlete } from "@/lib/athletes";
import { today, daysAgo, daysFromNow, formatDate, formatTime, formatDistance } from "@/lib/date-utils";

const QUICK_PROMPTS: Record<string, (sport?: string) => string> = {
  extra_today: (sport) =>
    `Jeg har tid til en ekstraøkt i dag${sport ? ` (${sport})` : ""}. Foreslå noe lett som passer dagsformen og ikke ødelegger ukens plan. Plasser økten på dagens dato.`,
  extra_load: (sport) =>
    `Jeg ønsker å øke treningsbelastningen denne uka${sport ? ` med en ekstra ${sport}-økt` : " med en ekstraøkt"}. Foreslå en økt som gir god treningsstimulus uten å overbelaste. Legg den på best mulig dag basert på planen.`,
  adapt_week: (suggestion) =>
    `Basert på følgende analyse, tilpass ukens treningsplan: ${suggestion ?? ""}. Foreslå konkrete endringer på eksisterende planlagte økter (kortere varighet, lavere intensitet, eller flytt økt). Vær presis om hvilke dager som berøres.`,
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { athleteSlug, action, sport, customPrompt, athleteId: directAthleteId, apiKey: directApiKey, anthropicKey, athleteName: directName } = body;

  let athleteId: string;
  let apiKey: string;
  let athleteName: string;
  let resolvedSlug: string;

  if (directAthleteId && directApiKey) {
    athleteId = directAthleteId;
    apiKey = directApiKey;
    athleteName = directName ?? "Bruker";
    resolvedSlug = "custom";
  } else if (athleteSlug === "mathias" || athleteSlug === "karoline") {
    const athlete = getAthlete(athleteSlug);
    athleteId = athlete.id;
    apiKey = athlete.apiKey;
    athleteName = athlete.name;
    resolvedSlug = athleteSlug;
  } else {
    return NextResponse.json({ error: "Invalid athlete" }, { status: 400 });
  }

  const client = makeAnthropic(anthropicKey);
  const t = today();

  const [events, wellness, activities] = await Promise.allSettled([
    fetchEvents(athleteId, apiKey, t, daysFromNow(7)),
    fetchWellness(athleteId, apiKey, daysAgo(7), t),
    fetchActivities(athleteId, apiKey, daysAgo(7), t, 10),
  ]);

  const eventsData = events.status === "fulfilled" ? events.value : [];
  const wellnessData = wellness.status === "fulfilled" ? wellness.value : [];
  const activitiesData = activities.status === "fulfilled" ? activities.value : [];

  const context = buildShortContext(athleteName, resolvedSlug, eventsData, wellnessData);

  // Build a richer week context for workout-editing actions
  function buildWeekContext(): string {
    let ctx = "";
    const latestWellness = wellnessData[wellnessData.length - 1];
    if (latestWellness) {
      ctx += `Dagsform: CTL=${Math.round(latestWellness.ctl ?? 0)}, ATL=${Math.round(latestWellness.atl ?? 0)}, TSB=${Math.round(latestWellness.tsb ?? 0)}\n`;
    }
    if (activitiesData.length > 0) {
      ctx += "Siste aktiviteter:\n";
      for (const a of activitiesData.slice(-5)) {
        const parts = [formatDate(a.start_date_local), a.type, a.name, formatTime(a.moving_time)];
        if (a.distance > 0) parts.push(formatDistance(a.distance));
        if (a.icu_training_load) parts.push(`${Math.round(a.icu_training_load)} TSS`);
        ctx += `- ${parts.join(" | ")}\n`;
      }
    }
    if (eventsData.length > 0) {
      ctx += "Planlagt denne og neste uke:\n";
      for (const e of eventsData.slice(0, 7)) {
        const parts = [formatDate(e.start_date_local), e.type, e.name];
        if (e.moving_time) parts.push(formatTime(e.moving_time));
        if (e.icu_training_load) parts.push(`${Math.round(e.icu_training_load)} TSS`);
        ctx += `- ${parts.join(" | ")}\n`;
      }
    }
    return ctx;
  }

  let userPrompt: string;
  if (customPrompt) {
    // customPrompt already contains the workout description — prepend week context so KI can make informed suggestions
    userPrompt = `${buildWeekContext()}\n${customPrompt}`;
  } else {
    const promptFn = QUICK_PROMPTS[action];
    if (!promptFn) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    userPrompt = promptFn(sport);
  }
  const systemPrompt = buildSystemPrompt() + "\n\n" + context;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
