import { readFileSync } from "fs";
import { join } from "path";
import type { TrainingProgram, ProgramWeek, ProgramWorkout } from "../types";

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, des: 12,
};

const DAY_MAP: Record<string, number> = {
  Man: 1, Tir: 2, Ons: 3, Tor: 4, Fre: 5, Lør: 6, Søn: 7,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(day: number, month: number, year = 2026): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseDateRange(header: string): { start: string; end: string } | null {
  // Cross-month: "23. feb – 1. mars" or "23. feb - 1. mars"
  const crossMonth = header.match(/(\d+)\.\s+(\w+)\s+[–\-]\s+(\d+)\.\s+(\w+)/);
  if (crossMonth) {
    const [, d1, m1raw, d2, m2raw] = crossMonth;
    const m1 = MONTH_MAP[m1raw.slice(0, 3).toLowerCase()];
    const m2 = MONTH_MAP[m2raw.slice(0, 3).toLowerCase()];
    if (m1 && m2) {
      return { start: isoDate(+d1, m1), end: isoDate(+d2, m2) };
    }
  }
  // Same-month: "2.–8. mars" or "2.-8. mars"
  const sameMonth = header.match(/(\d+)\.[–\-](\d+)\.\s+(\w+)/);
  if (sameMonth) {
    const [, d1, d2, mraw] = sameMonth;
    const m = MONTH_MAP[mraw.slice(0, 3).toLowerCase()];
    if (m) {
      return { start: isoDate(+d1, m), end: isoDate(+d2, m) };
    }
  }
  return null;
}

function parsePhaseName(header: string): { phase: string; weekType: string } {
  // "Uke N — Build 1: Restitusjon" or "Uke N — Testbatteri"
  const m = header.match(/Uke\s+\d+\s+[—\-]+\s+(.+?)\s+\|/);
  if (!m) return { phase: "Ukjent", weekType: "Ukjent" };
  const full = m[1].trim();
  const colonIdx = full.indexOf(":");
  if (colonIdx >= 0) {
    return {
      phase: full.slice(0, colonIdx).trim(),
      weekType: full.slice(colonIdx + 1).trim(),
    };
  }
  return { phase: full, weekType: full };
}

function inferSportType(headerLine: string): ProgramWorkout["type"] | null {
  const upper = headerLine.toUpperCase();
  if (upper.includes("SYKKEL") || upper.includes("SYK") || upper.includes("BRICK")) return "Ride";
  if (upper.includes("LØP") || upper.includes("LØPING")) return "Run";
  if (upper.includes("SVØ") || upper.includes("SVØM") || upper.includes("SVØMM")) return "Swim";
  if (upper.includes("STYRKE")) return "WeightTraining";
  return null;
}

function inferIndoor(type: ProgramWorkout["type"], fullHeaderLine: string): boolean | null {
  // Swim = always indoor (pool)
  if (type === "Swim") return true;
  // WeightTraining = always indoor (gym)
  if (type === "WeightTraining") return true;
  // Run = always outdoor
  if (type === "Run") return false;
  // Ride: check for Tacx/Zwift markers
  // "Tacx/ute" = could be either, but the main session is often on trainer → null
  // "Tacx" or "Zwift" alone (without "/ute") = indoor
  // "ute" alone = outdoor
  const lower = fullHeaderLine.toLowerCase();
  const hasTacxOrZwift = lower.includes("tacx") || lower.includes("zwift");
  const hasUte = lower.includes("/ute") || lower.includes("ute ·");
  if (hasTacxOrZwift && !hasUte) return true;
  if (hasUte && !hasTacxOrZwift) return false;
  return null; // "Tacx/ute" or unknown
}

function inferTimeOfDay(headerLine: string): "AM" | "PM" | null {
  const lower = headerLine.toLowerCase();
  if (lower.includes("morgen") || lower.includes(" am")) return "AM";
  if (lower.includes("ettermiddag") || lower.includes(" pm")) return "PM";
  return null;
}

function parseDayOfWeek(headerLine: string): number | null {
  for (const [name, num] of Object.entries(DAY_MAP)) {
    if (headerLine.startsWith(name)) return num;
  }
  return null;
}

function parseDuration(headerLine: string): number {
  const m = headerLine.match(/(\d+)\s*min/);
  return m ? +m[1] : 60;
}

function parseTSS(block: string): number | undefined {
  const m = block.match(/\*\*Load:\s*(\d+)\*\*/);
  return m ? +m[1] : undefined;
}

function extractCodeBlock(text: string): string {
  const m = text.match(/```\n([\s\S]*?)```/);
  return m ? m[1].trim() : "";
}

function parseWorkoutsFromWeekBlock(weekBlock: string): ProgramWorkout[] {
  const workouts: ProgramWorkout[] = [];

  // Split on bold headers: **Dag — Name** or **Dag morgen — Name** etc.
  // Pattern: line starting with **<day> ... — ...**
  const headerRegex = /^\*\*([A-ZÆØÅa-zæøå]+(?:\s+(?:morgen|ettermiddag))?)\s+[—–]\s+(.+?)\*\*([^\n]*)(\d+)\s+min/gm;

  let match: RegExpExecArray | null;
  const headers: Array<{ index: number; dayPart: string; namePart: string; fullLine: string; duration: number }> = [];

  while ((match = headerRegex.exec(weekBlock)) !== null) {
    headers.push({
      index: match.index,
      dayPart: match[1],
      namePart: match[2],
      fullLine: match[0],
      duration: +match[4],
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const nextIndex = i + 1 < headers.length ? headers[i + 1].index : weekBlock.length;
    const block = weekBlock.slice(h.index, nextIndex);

    const dayLine = h.dayPart;
    const namePart = h.namePart;
    const optional = /VALGFRI/i.test(block.split("\n")[0]);

    const dow = parseDayOfWeek(dayLine);
    if (dow === null) continue;

    const type = inferSportType(dayLine + " " + namePart);
    if (!type) continue;

    const timeOfDay = inferTimeOfDay(dayLine);
    const tss = parseTSS(block);
    const description = extractCodeBlock(block);
    const indoor = inferIndoor(type, h.fullLine);

    workouts.push({
      dayOfWeek: dow,
      timeOfDay,
      type,
      name: buildWorkoutName(namePart, type),
      durationMinutes: h.duration,
      tss,
      description,
      optional,
      indoor,
    });
  }

  return workouts;
}

function buildWorkoutName(rawName: string, type: ProgramWorkout["type"]): string {
  // rawName is like "Sykkel: easy", "Sykkel: sweet spot", "Løp: terskel", etc.
  // Already includes sport prefix in most cases
  const clean = rawName.trim();
  // Map sport to prefix
  const prefix: Record<string, string> = {
    Ride: "Sykkel",
    Run: "Løp",
    Swim: "Svøm",
    WeightTraining: "Styrke",
  };
  // If name already starts with a sport prefix, return as-is
  const hasPrefix = ["Sykkel", "Syk", "Løp", "Svøm", "Svømm", "Styrke", "Brick", "TEST"].some(
    (p) => clean.toUpperCase().startsWith(p.toUpperCase())
  );
  if (hasPrefix) return clean;
  return `${prefix[type] ?? type}: ${clean}`;
}

function parseWeeks(content: string): ProgramWeek[] {
  // Split on "## Uke N" headings
  const weekSections = content.split(/(?=^## Uke \d+)/m);
  const weeks: ProgramWeek[] = [];

  for (const section of weekSections) {
    const firstLine = section.split("\n")[0];
    if (!firstLine.startsWith("## Uke ")) continue;

    const weekNumMatch = firstLine.match(/## Uke (\d+)/);
    if (!weekNumMatch) continue;
    const weekNumber = +weekNumMatch[1];

    const dateRange = parseDateRange(firstLine);
    if (!dateRange) continue;

    const { phase, weekType } = parsePhaseName(firstLine);
    const workouts = parseWorkoutsFromWeekBlock(section);

    weeks.push({
      weekNumber,
      phase,
      weekType,
      startDate: dateRange.start,
      endDate: dateRange.end,
      workouts,
    });
  }

  return weeks;
}

function loadProgram(): TrainingProgram {
  const filePath = join(process.cwd(), "lib", "programs", "mathias.md");
  const content = readFileSync(filePath, "utf-8");

  return {
    athleteSlug: "mathias",
    targetRace: "Olympisk triatlon, Oslo",
    targetDate: "2026-08-08",
    profile: {
      ftp: 269,
      cs: "3:56/km",
      css: "2:25/100m",
      vo2max: 61.4,
    },
    weeks: parseWeeks(content),
  };
}

export const MATHIAS_PROGRAM: TrainingProgram = loadProgram();
