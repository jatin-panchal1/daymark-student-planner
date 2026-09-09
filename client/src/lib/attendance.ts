export type AttendanceItem = { code: string; name: string; type: string; present: number; absent: number; hoursPresent: number; hoursAbsent: number };

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
  const codeIndex = indexOf("subject code"); const nameIndex = indexOf("subject"); const typeIndex = indexOf("subject type"); const hoursIndex = indexOf("number of hours"); const markedIndex = indexOf("marked");
  if ([codeIndex, nameIndex, typeIndex, hoursIndex, markedIndex].some((index) => index < 0)) throw new Error("CSV must include Subject Code, Subject, Subject Type, Number of Hours, and Marked columns.");
  const grouped = new Map<string, AttendanceItem>();
  lines.slice(1).forEach((line) => { const cells = parseCsvLine(line); const code = cells[codeIndex]; if (!code) return; const item = grouped.get(code) || { code, name: cells[nameIndex], type: cells[typeIndex], present: 0, absent: 0, hoursPresent: 0, hoursAbsent: 0 }; const hours = Number(cells[hoursIndex]) || 1; const present = cells[markedIndex].toUpperCase().startsWith("P"); if (present) { item.present += 1; item.hoursPresent += hours; } else { item.absent += 1; item.hoursAbsent += hours; } grouped.set(code, item); });
  return Array.from(grouped.values());
}

export function getAttendanceMath(item: AttendanceItem, target: number) {
  const total = item.present + item.absent; const percentage = total ? (item.present / total) * 100 : 0;
  const classesNeeded = percentage >= target ? 0 : Math.ceil((target * total - 100 * item.present) / (100 - target));
  const classesCanSkip = percentage < target ? 0 : Math.max(0, Math.floor((100 * item.present / target) - total));
  return { total, percentage, classesNeeded, classesCanSkip };
}
