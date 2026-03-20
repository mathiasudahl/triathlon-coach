"use client";

import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { useEffect, useState } from "react";
import type { WeatherData } from "@/lib/types";

const SYMBOL_EMOJI: [string, string][] = [
  ["clearsky", "☀️"], ["fair", "🌤️"], ["partlycloudy", "⛅"], ["cloudy", "☁️"],
  ["fog", "🌫️"], ["heavyrain", "🌧️"], ["heavyrainshowers", "🌧️"],
  ["lightrain", "🌦️"], ["lightrainshowers", "🌦️"], ["rain", "🌧️"], ["rainshowers", "🌧️"],
  ["lightsleet", "🌨️"], ["sleet", "🌨️"], ["lightsnow", "❄️"], ["snow", "❄️"], ["snowshowers", "❄️"],
  ["thunder", "⛈️"],
];
function symbolToEmoji(symbol: string): string {
  for (const [prefix, emoji] of SYMBOL_EMOJI) {
    if (symbol.startsWith(prefix)) return emoji;
  }
  return "🌡️";
}

export function Header() {
  const { theme, toggle } = useTheme();
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => setWeather(d.today ?? null))
      .catch(() => {});
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-lg tracking-tight" style={{ color: "var(--text)" }}>
          Innsats
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {weather && (
            <span style={{ color: "var(--text-subtle)" }}>
              {symbolToEmoji(weather.symbol)} {Math.round(weather.temperature)}°C
            </span>
          )}
          <button
            onClick={toggle}
            className="text-lg"
            title="Bytt tema"
            aria-label="Bytt tema"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </div>
    </header>
  );
}
