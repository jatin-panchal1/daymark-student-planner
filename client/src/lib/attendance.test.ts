import { describe, expect, it } from "vitest";
import { getAttendanceMath, parseAttendanceCsv } from "./attendance";

describe("attendance analytics", () => {
  it("groups CSV rows by subject and preserves lab hours", () => {
    const items = parseAttendanceCsv("#,Subject Code,Subject,Subject Type,Number of Hours,Marked\n1,MA101,Math,Lecture,1,P\n2,MA101,Math,Lecture,1,A\n3,CSL,Lab,Lab,2,P");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ code: "MA101", present: 1, absent: 1 });
    expect(items[1]).toMatchObject({ code: "CSL", hoursPresent: 2 });
  });

  it("calculates classes needed to reach a target", () => {
    const result = getAttendanceMath({ code: "MA", name: "Math", type: "Lecture", present: 15, absent: 6, hoursPresent: 15, hoursAbsent: 6 }, 75);
    expect(result.percentage).toBeCloseTo(71.43, 2);
    expect(result.classesNeeded).toBe(3);
    expect(result.classesCanSkip).toBe(0);
  });

  it("calculates safe future absences when already above target", () => {
    const result = getAttendanceMath({ code: "CS", name: "CS", type: "Lecture", present: 18, absent: 2, hoursPresent: 18, hoursAbsent: 2 }, 75);
    expect(result.classesNeeded).toBe(0);
    expect(result.classesCanSkip).toBe(4);
  });
});
