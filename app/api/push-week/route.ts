import { NextRequest, NextResponse } from "next/server";
import { getAthlete } from "@/lib/athletes";
import { fetchEvents, createEvent } from "@/lib/intervals";
import { MATHIAS_PROGRAM } from "@/lib/programs/parse-program";
import { getNextProgramWeek, getWeeksInMonth } from "@/lib/programs/program-utils";
import type { ProgramWeek, ProgramWorkout } from "@/lib/types";

function workoutDate(week: ProgramWeek, workout: ProgramWorkout): string {
  const start = new Date(week.startDate + "T12:00:00");
  start.setDate(start.getDate() + (workout.dayOfWeek - 1));
  return start.toISOString().slice(0, 10);
}

function startTime(timeOfDay: ProgramWorkout["timeOfDay"]): string {
  return timeOfDay === "PM" ? "17:00:00" : "07:00:00";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { athleteSlug, mode } = body;

  if (athleteSlug !== "mathias") {
    return NextResponse.json({ error: "Only supported for Mathias" }, { status: 400 });
  }
  if (mode !== "week" && mode !== "month") {
    return NextResponse.json({ error: "mode must be week or month" }, { status: 400 });
  }

  const athlete = getAthlete("mathias");
  const now = new Date();

  let weeks: ProgramWeek[];
  let weekLabels: string[];

  if (mode === "week") {
    const next = getNextProgramWeek(MATHIAS_PROGRAM, now);
    if (!next) {
      return NextResponse.json({ error: "Ingen neste uke funnet i programmet" }, { status: 404 });
    }
    weeks = [next];
    const s = new Date(next.startDate + "T12:00:00");
    const e = new Date(next.endDate + "T12:00:00");
    weekLabels = [`Uke ${next.weekNumber} (${s.getDate()}.–${e.getDate()}. ${e.toLocaleString("nb-NO", { month: "long" })})`];
  } else {
    // next calendar month
    const nextMonth = now.getMonth() + 2; // getMonth() is 0-based, so +1 for next month, +1 for 1-based
    const nextMonthYear = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const nextMonthNum = nextMonth > 12 ? 1 : nextMonth;
    weeks = getWeeksInMonth(MATHIAS_PROGRAM, nextMonthYear, nextMonthNum);
    if (weeks.length === 0) {
      return NextResponse.json({ error: "Ingen uker funnet for neste måned" }, { status: 404 });
    }
    weekLabels = weeks.map((w) => {
      const s = new Date(w.startDate + "T12:00:00");
      const e = new Date(w.endDate + "T12:00:00");
      return `Uke ${w.weekNumber} (${s.getDate()}.–${e.getDate()}. ${e.toLocaleString("nb-NO", { month: "long" })})`;
    });
  }

  // Determine date range to fetch existing events
  const allDates = weeks.flatMap((w) => [w.startDate, w.endDate]);
  const rangeStart = allDates.reduce((a, b) => (a < b ? a : b));
  const rangeEnd = allDates.reduce((a, b) => (a > b ? a : b));

  const existingEvents = await fetchEvents(athlete.id, athlete.apiKey, rangeStart, rangeEnd);

  let added = 0;
  let skipped = 0;

  for (const week of weeks) {
    for (const workout of week.workouts) {
      // Skip optional (sykkelklubb etc.)
      if (workout.optional) { skipped++; continue; }

      const date = workoutDate(week, workout);

      // Deduplication: skip if same type on same date
      const duplicate = existingEvents.some(
        (e) => e.type === workout.type && e.start_date_local.slice(0, 10) === date
      );
      if (duplicate) { skipped++; continue; }

      await createEvent(athlete.id, athlete.apiKey, {
        start_date_local: `${date}T${startTime(workout.timeOfDay)}`,
        category: "WORKOUT",
        type: workout.type,
        name: workout.name,
        moving_time: workout.durationMinutes * 60,
        icu_training_load: workout.tss,
        description: workout.description || undefined,
        indoor_workout: workout.indoor === true ? true : undefined,
      });
      added++;
    }
  }

  return NextResponse.json({ added, skipped, weekLabels });
}
