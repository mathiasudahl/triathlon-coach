import { NextResponse } from "next/server";
import type { WeatherData, WeatherForecast } from "@/lib/types";

const SYMBOL_DESCRIPTION: [string, string][] = [
  ["clearsky", "Klarvær"],
  ["fair", "Lettskyet"],
  ["partlycloudy", "Delvis skyet"],
  ["cloudy", "Skyet"],
  ["fog", "Tåke"],
  ["heavyrain", "Kraftig regn"],
  ["heavyrainshowers", "Kraftig regn"],
  ["lightrain", "Lett regn"],
  ["lightrainshowers", "Lett regn"],
  ["rain", "Regn"],
  ["rainshowers", "Regn"],
  ["lightsleet", "Sludd"],
  ["sleet", "Sludd"],
  ["lightsnow", "Snø"],
  ["snow", "Snø"],
  ["snowshowers", "Snø"],
  ["thunder", "Torden"],
];

function symbolDescription(symbol: string): string {
  for (const [prefix, desc] of SYMBOL_DESCRIPTION) {
    if (symbol.startsWith(prefix)) return desc;
  }
  return "Ukjent";
}

function toOsloDate(utcTimeStr: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(utcTimeStr));
}

interface YrEntry {
  time: string;
  data: {
    instant: { details: { air_temperature: number; wind_speed: number } };
    next_1_hours?: { summary: { symbol_code: string } };
    next_12_hours?: { summary: { symbol_code: string } };
  };
}

export async function GET() {
  const url = "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=59.91&lon=10.75";

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "innsats-treningsapp/1.0 github.com/mathiasudahl/innsats" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
    const data = await res.json();

    const timeseries: YrEntry[] = data.properties.timeseries;

    // Group entries by Oslo local date
    const byDate = new Map<string, YrEntry[]>();
    for (const entry of timeseries) {
      const date = toOsloDate(entry.time);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(entry);
    }

    const forecast: WeatherForecast = {};
    for (const [date, entries] of byDate) {
      // Max temperature and wind for the day
      let maxTemp = -Infinity;
      let maxWind = 0;
      for (const e of entries) {
        const t = e.data.instant.details.air_temperature;
        const w = e.data.instant.details.wind_speed;
        if (t > maxTemp) maxTemp = t;
        if (w > maxWind) maxWind = w;
      }

      // Symbol: prefer next_12_hours from the 06:00 UTC entry, fallback to first next_1_hours
      const entry06 = entries.find((e) => e.time.endsWith("T06:00:00Z"));
      let symbol =
        entry06?.data.next_12_hours?.summary.symbol_code ??
        entries.find((e) => e.data.next_1_hours)?.data.next_1_hours?.summary.symbol_code ??
        "cloudy";

      forecast[date] = {
        temperature: Math.round(maxTemp),
        windspeed: Math.round(maxWind),
        symbol,
        description: symbolDescription(symbol),
      };
    }

    // today = first date in forecast
    const todayKey = [...byDate.keys()][0];
    const today: WeatherData = forecast[todayKey];

    return NextResponse.json({ today, forecast });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
