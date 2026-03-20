import { NextResponse } from "next/server";
import type { WeatherData, WeatherForecast } from "@/lib/types";

const WMO_DESCRIPTION: Record<number, string> = {
  0: "Klart", 1: "Stort sett klart", 2: "Delvis skyet", 3: "Overskyet",
  45: "Tåke", 48: "Rimtåke",
  51: "Lett yr", 53: "Yr", 55: "Tett yr",
  61: "Lett regn", 63: "Regn", 65: "Kraftig regn",
  71: "Lett snø", 73: "Snø", 75: "Kraftig snø",
  80: "Lett regnbyger", 81: "Regnbyger", 82: "Kraftige regnbyger",
  85: "Snøbyger", 86: "Kraftige snøbyger",
  95: "Tordenvær", 96: "Tordenvær med hagl", 99: "Tordenvær med kraftig hagl",
};

export async function GET() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=59.91&longitude=10.75" +
    "&daily=temperature_2m_max,weathercode,windspeed_10m_max" +
    "&timezone=Europe%2FOslo" +
    "&forecast_days=14";

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
    const data = await res.json();

    // Daily forecast keyed by date (windspeed from km/h → m/s)
    const forecast: WeatherForecast = {};
    const daily = data.daily;
    for (let i = 0; i < daily.time.length; i++) {
      const date: string = daily.time[i];
      const code: number = daily.weathercode[i];
      forecast[date] = {
        temperature: Math.round(daily.temperature_2m_max[i]),
        windspeed: Math.round(daily.windspeed_10m_max[i] / 3.6),
        weathercode: code,
        description: WMO_DESCRIPTION[code] ?? "Ukjent",
      };
    }

    // today = first entry in forecast
    const todayKey = daily.time[0] as string;
    const today: WeatherData = forecast[todayKey];

    return NextResponse.json({ today, forecast });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
