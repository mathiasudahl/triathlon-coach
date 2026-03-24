import { NextRequest, NextResponse } from "next/server";
import { makeAnthropic, buildSystemPrompt, buildShortContext } from "@/lib/ai";
import { fetchEvents, fetchWellness } from "@/lib/intervals";
import { getAthlete } from "@/lib/athletes";
import { today, daysAgo, daysFromNow } from "@/lib/date-utils";

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

  const [events, wellness] = await Promise.allSettled([
    fetchEvents(athleteId, apiKey, t, daysFromNow(5)),
    fetchWellness(athleteId, apiKey, daysAgo(1), t),
  ]);

  const context = buildShortContext(
    athleteName,
    resolvedSlug,
    events.status === "fulfilled" ? events.value : [],
    wellness.status === "fulfilled" ? wellness.value : []
  );

  let userPrompt: string;
  if (customPrompt) {
    userPrompt = customPrompt;
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
