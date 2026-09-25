import { describe, expect, it } from "vitest";
import { getAttendanceMath, parseAttendanceCsv } from "./attendance";

describe("attendance analytics", () => {
  it("groups CSV rows by subject and tracks makeup separately", () => {
    const items = parseAttendanceCsv("#,Subject Code,Subject,Subject Type,Present,OD,Makeup,Absent,Percentage\n1,MA101,Math,Lecture,10,1,2,5,72.2\n2,CSL,Lab,Lab,8,0,0,2,80.0");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ code: "MA101", present: 11, absent: 5, makeup: 2 });
    expect(items[1]).toMatchObject({ code: "CSL", present: 8, absent: 2, makeup: 0 });
  });

  it("calculates with makeup boosting numerator only", () => {
    // 11 regular present + 2 makeup = 13 effective, total = 11 + 5 = 16
    // percentage = 13/16 * 100 = 81.25%
    const result = getAttendanceMath({ code: "MA", name: "Math", type: "Lecture", present: 11, absent: 5, hoursPresent: 13, hoursAbsent: 5, makeup: 2 }, 75);
    expect(result.percentage).toBeCloseTo(81.25, 2);
    expect(result.total).toBe(16); // makeup NOT in denominator
    expect(result.effective).toBe(13); // present + makeup
    expect(result.classesNeeded).toBe(0);
    expect(result.classesCanSkip).toBeGreaterThan(0);
  });

  it("calculates classes needed to reach a target", () => {
    const result = getAttendanceMath({ code: "MA", name: "Math", type: "Lecture", present: 15, absent: 6, hoursPresent: 15, hoursAbsent: 6, makeup: 0 }, 75);
    expect(result.percentage).toBeCloseTo(71.43, 2);
    expect(result.classesNeeded).toBe(3);
    expect(result.classesCanSkip).toBe(0);
  });

  it("calculates safe future absences when already above target", () => {
    const result = getAttendanceMath({ code: "CS", name: "CS", type: "Lecture", present: 18, absent: 2, hoursPresent: 18, hoursAbsent: 2, makeup: 0 }, 75);
    expect(result.classesNeeded).toBe(0);
    expect(result.classesCanSkip).toBe(4);
  });

  it("makeup alone can push percentage above target", () => {
    // 15 present, 6 absent, 3 makeup → effective = 18, total = 21
    // percentage = 18/21 = 85.7%
    const result = getAttendanceMath({ code: "PH", name: "Physics", type: "Lecture", present: 15, absent: 6, hoursPresent: 18, hoursAbsent: 6, makeup: 3 }, 75);
    expect(result.percentage).toBeCloseTo(85.71, 2);
    expect(result.classesNeeded).toBe(0);
  });
});
