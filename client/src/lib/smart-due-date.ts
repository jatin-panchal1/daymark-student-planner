export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Returns the next calendar date on which a subject meets.
 * Day numbers follow JavaScript's convention: 0 = Sunday ... 6 = Saturday.
 * The current day is included, so a task created on a class day is due today.
 */
export function getNextScheduledDate(
  currentDate: Date,
  scheduleDays: number[],
): string | null {
  const normalizedDays = scheduleDays
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  if (normalizedDays.length === 0) return null;

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(currentDate);
    candidate.setHours(12, 0, 0, 0);
    candidate.setDate(currentDate.getDate() + offset);

    if (normalizedDays.includes(candidate.getDay())) {
      const year = candidate.getFullYear();
      const month = String(candidate.getMonth() + 1).padStart(2, "0");
      const day = String(candidate.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

export function formatDateLabel(dateString: string | null): string {
  if (!dateString) return "No date set";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function isToday(dateString: string): boolean {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateString === current;
}
