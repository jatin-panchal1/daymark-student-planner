import { describe, expect, it } from "vitest";
import { getAttendanceMath, parseAttendanceCsv } from "./attendance";

describe("attendance analytics", () => {
  it("groups CSV rows by subject and aggregates attendance", () => {
    const items = parseAttendanceCsv("#,Subject Code,Subject,Subject Type,Present,OD,Makeup,Absent,Percentage\n1,MA101,Math,Lecture,1,0,0,1,50.0\n2,CSL,Lab,Lab,2,0,0,0,100.0\n3,MA101,Math,Lecture,0,1,0,0,100.0");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ code: "MA101", present: 2, absent: 1 });
    expect(items[1]).toMatchObject({ code: "CSL", present: 2, absent: 0 });
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
