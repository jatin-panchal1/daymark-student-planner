export type AttendanceItem = { code: string; name: string; type: string; present: number; absent: number; hoursPresent: number; hoursAbsent: number; makeup: number };

function parseCsvLine(line: string): string[] {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim()); return values;
}

export function parseAttendanceCsv(raw: string): AttendanceItem[] {
  const lines = raw.split(/\r?\n/).filter(Boolean); const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const codeIndex = indexOf("subject code"); const nameIndex = indexOf("subject"); const typeIndex = indexOf("subject type"); const presentIndex = indexOf("present"); const odIndex = indexOf("od"); const makeupIndex = indexOf("makeup"); const absentIndex = indexOf("absent");
  if ([codeIndex, nameIndex, typeIndex, presentIndex, absentIndex].some((index) => index < 0)) throw new Error("CSV must include Subject Code, Subject, Subject Type, Present, and Absent columns.");
  const grouped = new Map<string, AttendanceItem>();
  lines.slice(1).forEach((line) => {
    const cells = parseCsvLine(line); const code = cells[codeIndex]; if (!code) return;
    const item = grouped.get(code) || { code, name: cells[nameIndex], type: cells[typeIndex], present: 0, absent: 0, hoursPresent: 0, hoursAbsent: 0, makeup: 0 };
    const present = Number(cells[presentIndex]) || 0;
    const od = (odIndex >= 0 ? Number(cells[odIndex]) : 0) || 0;
    const makeupVal = (makeupIndex >= 0 ? Number(cells[makeupIndex]) : 0) || 0;
    const absent = Number(cells[absentIndex]) || 0;
    item.present += present + od;
    item.makeup += makeupVal;
    item.absent += absent;
    item.hoursPresent += present + od + makeupVal;
    item.hoursAbsent += absent;
    grouped.set(code, item);
  });
  return Array.from(grouped.values());
}

export function getAttendanceMath(item: AttendanceItem, target: number) {
  // total = regular present + absent (makeup does NOT count in denominator)
  const total = item.present + item.absent;
  // effective present = regular present + makeup hours (makeup boosts numerator only)
  const effective = item.present + item.makeup;
  const percentage = total ? (effective / total) * 100 : 0;
  const classesNeeded = percentage >= target ? 0 : Math.ceil((target * total - 100 * effective) / (100 - target));
  const classesCanSkip = percentage < target ? 0 : Math.max(0, Math.floor((100 * effective / target) - total));
  return { total, percentage, classesNeeded, classesCanSkip, effective };
}
