import { describe, expect, it } from "vitest";
import { formatDateLabel, getNextScheduledDate, isToday } from "./smart-due-date";

describe("smart due dates", () => {
  it("returns today when the current day is on the subject schedule", () => {
    const result = getNextScheduledDate(new Date("2026-09-09T09:00:00"), [3]);
    expect(result).toBe("2026-09-09");
  });

  it("rolls forward to the next upcoming scheduled day", () => {
    const result = getNextScheduledDate(new Date("2026-09-09T09:00:00"), [1, 4]);
    expect(result).toBe("2026-09-10");
  });

  it("returns null for an empty schedule and formats date labels", () => {
    expect(getNextScheduledDate(new Date("2026-09-09T09:00:00"), [])).toBeNull();
    expect(formatDateLabel("2026-09-10")).toBe("Sep 10");
  });

  it("recognizes a date string as today using local calendar fields", () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(isToday(date)).toBe(true);
  });
});
