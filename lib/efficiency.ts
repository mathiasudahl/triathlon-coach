import type { Activity } from "./types";

export interface EFPoint {
  date: string;
  ef: number;
  intensity: number;
}

export interface EFWeekSummary {
  week: string; // ISO date of Monday
  ef: number;   // average EF for week
  count: number;
}

export type EFValidity = "god" | "usikker" | "lav";

export interface EFTrend {
  sport: "Ride" | "Run" | "Swim";
  groupLabel: string;
  currentWeekEF: number;
  baselineEF: number;
  changePercent: number;
  weekSummaries: EFWeekSummary[];
  unit: string;
  recentLabel: string;
  priorLabel: string;
  activityNames: string[];
  validity: EFValidity; // based on count and EF spread
  validityNote: string; // short explanation
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function isRide(type: string) {
  return type === "Ride" || type === "VirtualRide";
}
function isRun(type: string) {
  return type === "Run" || type === "VirtualRun";
}
function isSwim(type: string) {
  return type === "Swim";
}

// Groups workouts by intensity zone (icu_intensity is in percent, e.g. 77.8)
function activityGroup(intensity: number, sport: "Ride" | "Run" | "Swim"): { key: string; label: string } {
  if (sport === "Ride") {
    if (intensity < 65) return { key: "ride:easy", label: "rolige turer" };
    if (intensity < 85) return { key: "ride:tempo", label: "tempo/sweet spot" };
    return { key: "ride:hard", label: "harde intervaller" };
  } else if (sport === "Run") {
    if (intensity < 60) return { key: "run:easy", label: "rolige løp" };
    if (intensity < 80) return { key: "run:tempo", label: "tempoløp" };
    return { key: "run:hard", label: "harde intervaller" };
  } else {
    if (intensity < 65) return { key: "swim:easy", label: "rolige svømmeturer" };
    if (intensity < 85) return { key: "swim:tempo", label: "temposvømming" };
    return { key: "swim:hard", label: "harde intervaller" };
  }
}

function computeEFValue(a: Activity, sport: "Ride" | "Run" | "Swim"): number | null {
  if (!a.average_heartrate || a.average_heartrate < 100) return null;
  if (a.moving_time < 20 * 60) return null;
  if (a.icu_intensity != null && a.icu_intensity >= 95) return null;

  if (sport === "Ride") {
    const watts = a.icu_average_watts ?? a.average_watts;
    if (!watts || watts < 20) return null;
    return watts / a.average_heartrate;
  } else {
    // Run and Swim: pace-based EF (speed / heartrate × 1000)
    if (!a.distance || a.distance < 500) return null;
    const pace = a.moving_time / a.distance;
    return (1 / pace / a.average_heartrate) * 1000;
  }
}

function filterEFOutliers(points: EFPoint[]): EFPoint[] {
  if (points.length < 4) return points;
  const efs = points.map((p) => p.ef);
  const sorted = [...efs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const devs = efs.map((e) => Math.abs(e - median)).sort((a, b) => a - b);
  const mad = devs.length % 2 ? devs[Math.floor(devs.length / 2)] : (devs[devs.length / 2 - 1] + devs[devs.length / 2]) / 2;
  return points.filter((p) => mad === 0 || (0.6745 * Math.abs(p.ef - median)) / mad <= 2.5);
}

function buildWeekSummaries(points: EFPoint[]): EFWeekSummary[] {
  const byWeek: Record<string, number[]> = {};
  for (const p of points) {
    const wk = mondayOf(p.date);
    if (!byWeek[wk]) byWeek[wk] = [];
    byWeek[wk].push(p.ef);
  }
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, efs]) => ({
      week,
      ef: efs.reduce((s, v) => s + v, 0) / efs.length,
      count: efs.length,
    }));
}

function buildBiweekBlocks(summaries: EFWeekSummary[]): {
  recent: EFWeekSummary[];
  prior: EFWeekSummary[];
} | null {
  if (summaries.length < 2) return null;
  const sorted = summaries.slice(-8);
  const recentEnd = sorted.length;
  const recentStart = Math.max(0, recentEnd - 2);
  const recent = sorted.slice(recentStart, recentEnd);
  const priorEnd = recentStart;
  if (priorEnd === 0) return null;
  const priorStart = Math.max(0, priorEnd - 2);
  const prior = sorted.slice(priorStart, priorEnd);
  return { recent, prior };
}

export function computeEFTrend(
  activities: Activity[],
  sport: "Ride" | "Run" | "Swim"
): EFTrend | null {
  const relevant = activities.filter((a) =>
    sport === "Ride" ? isRide(a.type) : sport === "Run" ? isRun(a.type) : isSwim(a.type)
  );

  // Group activities by workout type, collect EF points per group
  const groups: Record<string, { label: string; points: EFPoint[]; names: string[] }> = {};
  for (const a of relevant) {
    const ef = computeEFValue(a, sport);
    if (ef == null) continue;
    const { key, label } = activityGroup(a.icu_intensity ?? 70, sport);
    if (!groups[key]) groups[key] = { label, points: [], names: [] };
    groups[key].points.push({
      date: a.start_date_local.slice(0, 10),
      ef,
      intensity: a.icu_intensity ?? 0,
    });
    if (!groups[key].names.includes(a.name)) groups[key].names.push(a.name);
  }

  // Find the group with the most activities spanning at least 2 weeks
  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [key, g] of Object.entries(groups)) {
    const weeks = new Set(g.points.map((p) => mondayOf(p.date)));
    if (weeks.size >= 2 && g.points.length > bestCount) {
      bestCount = g.points.length;
      bestKey = key;
    }
  }

  // Fallback: if no group spans 2 weeks, use all activities regardless of group
  const chosenGroup = bestKey
    ? groups[bestKey]
    : (() => {
        const allPoints: EFPoint[] = Object.values(groups).flatMap((g) => g.points);
        const allNames: string[] = [...new Set(Object.values(groups).flatMap((g) => g.names))];
        return allPoints.length >= 2 ? { label: sport === "Ride" ? "sykkelturer" : "løpeturer", points: allPoints, names: allNames } : null;
      })();

  if (!chosenGroup) return null;

  const filteredPoints = filterEFOutliers(chosenGroup.points);
  const summaries = buildWeekSummaries(filteredPoints);
  if (summaries.length < 2) return null;

  const blocks = buildBiweekBlocks(summaries);
  if (!blocks) return null;

  const { recent, prior } = blocks;
  const recentEF = recent.reduce((s, w) => s + w.ef * w.count, 0) / recent.reduce((s, w) => s + w.count, 0);
  const priorEF = prior.reduce((s, w) => s + w.ef * w.count, 0) / prior.reduce((s, w) => s + w.count, 0);
  const changePercent = ((recentEF - priorEF) / priorEF) * 100;

  // Validity: based on total activity count and EF coefficient of variation (spread)
  const allEFs = filteredPoints.map((p) => p.ef);
  const mean = allEFs.reduce((s, v) => s + v, 0) / allEFs.length;
  const stddev = Math.sqrt(allEFs.reduce((s, v) => s + (v - mean) ** 2, 0) / allEFs.length);
  const cv = stddev / mean; // coefficient of variation; higher = more spread

  const totalCount = recent.reduce((s, w) => s + w.count, 0) + prior.reduce((s, w) => s + w.count, 0);
  let validity: EFValidity;
  let validityNote: string;
  if (totalCount >= 6 && cv < 0.05) {
    validity = "god";
    validityNote = `${totalCount} sammenlignbare økter, lav spredning`;
  } else if (totalCount >= 3 && cv < 0.10) {
    validity = "usikker";
    validityNote = cv >= 0.07
      ? `${totalCount} økter, noe varierende intensitet`
      : `${totalCount} økter — trenger mer data`;
  } else {
    validity = "lav";
    validityNote = cv >= 0.10
      ? `høy intensitetsspredning (${(cv * 100).toFixed(0)}% CV) — bland økttyper`
      : `kun ${totalCount} økt${totalCount !== 1 ? "er" : ""} — trenger mer data`;
  }

  return {
    sport,
    groupLabel: chosenGroup.label,
    currentWeekEF: recentEF,
    baselineEF: priorEF,
    changePercent,
    weekSummaries: summaries.slice(-6),
    unit: sport === "Ride" ? "W/bpm" : sport === "Run" ? "min/km per bpm" : "min/100m per bpm",
    recentLabel: `${recent[0].week}–${recent[recent.length - 1].week}`,
    priorLabel: `${prior[0].week}–${prior[prior.length - 1].week}`,
    activityNames: chosenGroup.names.slice(0, 6),
    validity,
    validityNote,
  };
}

export function getAllEFTrends(activities: Activity[]): EFTrend[] {
  return (["Ride", "Run", "Swim"] as const)
    .map((sport) => computeEFTrend(activities, sport))
    .filter((t): t is EFTrend => t !== null);
}

export function formatEFTrendForPrompt(activities: Activity[]): string {
  const lines: string[] = [];
  const sportLabels: Record<string, string> = { Ride: "sykkel", Run: "løp", Swim: "svøm" };

  for (const trend of getAllEFTrends(activities)) {
    const sportLabel = sportLabels[trend.sport] ?? trend.sport;
    lines.push(`Efficiency Factor trend (${sportLabel} — ${trend.groupLabel}, ekskl. maks-innsats):`);
    for (const s of trend.weekSummaries) {
      lines.push(`- uke ${s.week}: EF=${s.ef.toFixed(2)} (${s.count} økt${s.count !== 1 ? "er" : ""})`);
    }
    const dir = trend.changePercent >= 0 ? "+" : "";
    lines.push(`→ Siste 2 uker (${trend.recentLabel}) vs. forrige 2 uker (${trend.priorLabel}): ${dir}${trend.changePercent.toFixed(1)}% (EF ${trend.baselineEF.toFixed(2)} → ${trend.currentWeekEF.toFixed(2)})`);
  }

  return lines.join("\n");
}
