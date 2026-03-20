import { NextRequest, NextResponse } from "next/server";
import { anthropic, buildDailyAnalysisPrompt } from "@/lib/ai";
import { fetchActivities, fetchEvents, fetchWellness } from "@/lib/intervals";
import { getAthlete } from "@/lib/athletes";
import { today, daysAgo, daysFromNow } from "@/lib/date-utils";
import type { DailyAnalysis, WeatherData } from "@/lib/types";

async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=59.91&longitude=10.75" +
      "&current_weather=true" +
      "&timezone=Europe%2FOslo" +
      "&forecast_days=1";
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cw = data.current_weather;
    return {
      temperature: Math.round(cw.temperature),
      windspeed: Math.round(cw.windspeed),
      symbol: String(cw.weathercode ?? ""),
      description: "",
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { athleteSlug } = body;

  if (athleteSlug !== "mathias" && athleteSlug !== "karoline") {
    return NextResponse.json({ error: "Invalid athlete" }, { status: 400 });
  }

  const athlete = getAthlete(athleteSlug);
  const t = today();
  const twoDaysAgo = daysAgo(2);
  const yesterday = daysAgo(1);

  const weekAhead = daysFromNow(7);

  const [activitiesRes, eventsRes, futureEventsRes, wellnessRes, weather] = await Promise.allSettled([
    fetchActivities(athlete.id, athlete.apiKey, twoDaysAgo, t, 5),
    fetchEvents(athlete.id, athlete.apiKey, t, t),
    fetchEvents(athlete.id, athlete.apiKey, t, weekAhead),
    fetchWellness(athlete.id, athlete.apiKey, yesterday, t),
    fetchWeather(),
  ]);

  const activities = activitiesRes.status === "fulfilled" ? activitiesRes.value : [];
  const events = eventsRes.status === "fulfilled" ? eventsRes.value : [];
  const futureEvents = futureEventsRes.status === "fulfilled" ? futureEventsRes.value : [];
  const wellness = wellnessRes.status === "fulfilled" ? wellnessRes.value : [];
  const weatherData = weather.status === "fulfilled" ? weather.value : null;

  const prompt = buildDailyAnalysisPrompt(
    athlete.name,
    athleteSlug,
    activities,
    events,
    futureEvents,
    wellness,
    weatherData
  );

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";

    // Strip potential markdown fences
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let analysis: DailyAnalysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
    }

    return NextResponse.json(analysis);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
