"use client";

import { useState } from "react";
import type { WorkoutEvent } from "@/lib/types";

const PRESET_ATHLETE_IDS: Record<string, string> = {
  mathias: "i303639",
  karoline: "i456432",
};

interface AddToIntervalsButtonProps {
  workout: WorkoutEvent;
  athleteSlug: string;
  athleteId?: string;
  apiKey?: string;
  color: string;
  onAdded: (url: string) => void;
}

export function AddToIntervalsButton({ workout, athleteSlug, athleteId, apiKey, color, onAdded }: AddToIntervalsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setLoading(true);
    setError(null);
    try {
      const body = athleteId && apiKey
        ? { athleteId, apiKey, event: workout }
        : { athleteSlug, event: workout };

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Feil");
      }
      const created: WorkoutEvent = await res.json();
      const dateStr = created.start_date_local ?? workout.start_date_local ?? "";
      const date = dateStr.slice(0, 10);
      const resolvedAthleteId = athleteId ?? PRESET_ATHLETE_IDS[athleteSlug] ?? athleteSlug;
      setDone(true);
      onAdded(`https://intervals.icu/athlete/${resolvedAthleteId}/activities?w=${date}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil");
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={add}
        disabled={loading || done}
        className="text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
        style={{
          backgroundColor: done ? `${color}25` : `${color}15`,
          color,
          border: `1px solid ${color}30`,
        }}
      >
        {done ? "✓ Lagt til" : loading ? "Legger til..." : "Legg til i Intervals"}
      </button>
      {error && <span className="text-xs" style={{ color: "#dc2626" }}>{error}</span>}
    </div>
  );
}
