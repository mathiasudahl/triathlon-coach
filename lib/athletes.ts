import type { Athlete } from "./types";

export const ATHLETES: Record<"mathias" | "karoline", Athlete> = {
  mathias: {
    id: process.env.MATHIAS_ATHLETE_ID!,
    apiKey: process.env.MATHIAS_API_KEY!,
    name: "Mathias",
    color: "#16a34a",
    slug: "mathias",
    programSlug: "mathias",
  },
  karoline: {
    id: process.env.KAROLINE_ATHLETE_ID!,
    apiKey: process.env.KAROLINE_API_KEY!,
    name: "Karoline",
    color: "#2563eb",
    slug: "karoline",
  },
};

export function getAthlete(slug: "mathias" | "karoline"): Athlete {
  return ATHLETES[slug];
}
