const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousDay(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function summarizeStudyDays(activityDates: string[], today: string) {
  const dates = [...new Set(activityDates)].sort((left, right) =>
    right.localeCompare(left),
  );
  const dateSet = new Set(dates);

  let currentStreak = 0;
  let currentDate = dateSet.has(today) ? today : previousDay(today);
  while (dateSet.has(currentDate)) {
    currentStreak += 1;
    currentDate = previousDay(currentDate);
  }

  let bestStreak = 0;
  let runLength = 0;
  let previousTimestamp: number | null = null;
  for (const date of dates) {
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);
    runLength =
      previousTimestamp !== null &&
      previousTimestamp - timestamp === DAY_MS
        ? runLength + 1
        : 1;
    bestStreak = Math.max(bestStreak, runLength);
    previousTimestamp = timestamp;
  }

  return {
    currentStreak,
    bestStreak,
    studiedToday: dateSet.has(today),
    lastStudyDate: dates[0] ?? null,
  };
}
