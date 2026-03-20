import type { TrainingProgram, ProgramWeek } from "../types";

function dateInWeek(dateStr: string, week: ProgramWeek): boolean {
  return dateStr >= week.startDate && dateStr <= week.endDate;
}

export function getCurrentProgramWeek(
  program: TrainingProgram,
  today: Date
): ProgramWeek | null {
  const todayStr = today.toISOString().slice(0, 10);
  return program.weeks.find((w) => dateInWeek(todayStr, w)) ?? null;
}

export function getNextProgramWeek(
  program: TrainingProgram,
  today: Date
): ProgramWeek | null {
  const current = getCurrentProgramWeek(program, today);
  if (!current) {
    // Find first future week
    const todayStr = today.toISOString().slice(0, 10);
    return program.weeks.find((w) => w.startDate > todayStr) ?? null;
  }
  const idx = program.weeks.findIndex((w) => w.weekNumber === current.weekNumber);
  return idx >= 0 && idx + 1 < program.weeks.length ? program.weeks[idx + 1] : null;
}

export function getWeeksInMonth(
  program: TrainingProgram,
  year: number,
  month: number
): ProgramWeek[] {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return program.weeks.filter(
    (w) => w.endDate >= monthStart && w.startDate <= monthEnd
  );
}

export function buildProgramSummary(
  program: TrainingProgram,
  currentWeek: ProgramWeek | null
): string {
  const { profile, targetRace, targetDate } = program;

  const tDate = new Date(targetDate);
  const dateLabel = `${tDate.getDate()}. august ${tDate.getFullYear()}`;

  if (!currentWeek) {
    return [
      `Treningsprogram: ${targetRace}, ${dateLabel}`,
      `Profil: FTP=${profile.ftp}W, CS=${profile.cs}, CSS=${profile.css}, VO₂max=${profile.vo2max}`,
    ].join("\n");
  }

  const { weekNumber, phase, weekType, startDate, endDate, workouts } = currentWeek;

  const startD = new Date(startDate + "T12:00:00");
  const endD = new Date(endDate + "T12:00:00");
  const weekLabel = `${startD.getDate()}.–${endD.getDate()}. ${endD.toLocaleString("nb-NO", { month: "long" })}`;

  const dayNames: Record<number, string> = {
    1: "Man", 2: "Tir", 3: "Ons", 4: "Tor", 5: "Fre", 6: "Lør", 7: "Søn",
  };
  const sportNames: Record<string, string> = {
    Ride: "Sykkel", Run: "Løp", Swim: "Svøm", WeightTraining: "Styrke",
  };

  const nonSwim = workouts.filter((w) => w.type !== "Swim" && !w.optional);
  const workoutList = nonSwim
    .map((w) => `${dayNames[w.dayOfWeek]} ${sportNames[w.type]} ${w.durationMinutes}min`)
    .join(", ");

  return [
    `Treningsprogram: Uke ${weekNumber} — ${phase}: ${weekType} (${weekLabel})`,
    `Mål: ${targetRace}, ${dateLabel}`,
    `Profil: FTP=${profile.ftp}W, CS=${profile.cs}, CSS=${profile.css}, VO₂max=${profile.vo2max}`,
    `Denne uken (ikke svøm): ${workoutList || "Ingen planlagte økter"}`,
  ].join("\n");
}
