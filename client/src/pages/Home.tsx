import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Clock3, Flame, FileJson, Library, LayoutDashboard, ListChecks, Menu, MoreHorizontal,
  Plus, RefreshCw, Search, Settings2, Sparkles, Target, Timer, Trash2, TrendingUp, X,
} from "lucide-react";
import { toast } from "sonner";
import { DAY_NAMES, formatDateLabel, getNextScheduledDate, isToday } from "@/lib/smart-due-date";
import { getAttendanceMath } from "@/lib/attendance";
import SettingsModal from "@/components/SettingsModal";
import ProfilePanel from "@/components/ProfilePanel";
import type { AuthUser } from "@/App";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────
type Subject = { id: string; name: string; code: string; color: string; days: number[]; time: string; times: Record<number, string> };
type Task = { id: string; title: string; subjectId?: string; completed: boolean; dueDate: string; priority: "High" | "Medium" | "Low"; recurringDays?: number[] };
type LibraryBook = { id: string; title: string; author: string; issuedOn: string; returnBy: string };
type AttendanceItem = { code: string; name: string; type: string; present: number; absent: number; hoursPresent: number; hoursAbsent: number; makeup: number };
type CalendarEvent = { id: string; kind: "dayoff" | "holiday" | "exam"; title: string; start: string; end: string; subject?: string; examTime?: string; afterClass?: boolean; afterSubject?: string };
type CodingStats = { codeforcesSolved: number; codeforcesTarget: number; leetcodeSolved: number; leetcodeTarget: number; streak: number; recent: { platform: "Codeforces" | "LeetCode"; title: string; date: string }[] };

// ─── Helpers ──────────────────────────────────────────────────────────
const colors = ["#f28b63", "#8ea7ff", "#69c2a3", "#d4a44d", "#b799e8"];

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getGreeting(name: string) {
  const h = new Date().getHours();
  const period = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${period}, ${name}`;
}

function getHeroDateLabel() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "2-digit", year: "numeric" }).toUpperCase();
}

function getCurrentWeekDays() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek === 0 ? 7 : dayOfWeek) - 1));
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fullNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, date: d.getDate(), full: fullNames[i], dow: i + 1, dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, month: d.toLocaleDateString("en-US", { month: "long" }), year: d.getFullYear() };
  });
}

function parseTimeToDate(timeStr: string, baseDate?: string): Date {
  const d = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date();
  d.setSeconds(0, 0);
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) { d.setHours(9, 0); return d; }
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  d.setHours(hours, minutes);
  return d;
}

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

function parseAttendanceCsv(raw: string): AttendanceItem[] {
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

const dayNumber = (value: unknown) => {
  if (typeof value === "number" && value >= 0 && value <= 6) return value;
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().slice(0, 3);
  const found = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(normalized);
  return found >= 0 ? found : null;
};

function parsePlannerJson(raw: unknown, subjectCount: number): Subject[] {
  const root = raw as { subjects?: unknown[] };
  if (!root || !Array.isArray(root.subjects)) throw new Error("The JSON must contain a subjects array.");
  return root.subjects.map((entry, index) => {
    const item = entry as { id?: string; name?: string; code?: string; color?: string; schedule?: unknown[]; days?: unknown[]; time?: string };
    if (!item.name || !Array.isArray(item.schedule || item.days)) throw new Error(`Subject ${index + 1} needs a name and schedule.`);
    const entries = Array.isArray(item.schedule) ? item.schedule : (item.days || []).map((day) => ({ day, time: item.time || "09:00 AM" }));
    const times: Record<number, string> = {};
    entries.forEach((slot) => {
      const data = slot as { day?: unknown; dayOfWeek?: unknown; time?: string; start?: string; startTime?: string };
      const day = dayNumber(data.day ?? data.dayOfWeek);
      if (day !== null && day !== 0) times[day] = data.time || data.start || data.startTime || item.time || "09:00 AM";
    });
    const days = Object.keys(times).map(Number).sort();
    if (!days.length) throw new Error(`${item.name} must include at least one Monday–Saturday class slot.`);
    return { id: item.id || `imported-${Date.now()}-${index}`, name: item.name, code: item.code || "IMPT 101", color: item.color || colors[(subjectCount + index) % colors.length], days, time: times[days[0]], times };
  });
}

function parseCalendarJson(raw: unknown): CalendarEvent[] {
  const root = raw as { holidays?: unknown[]; exams?: unknown[] };
  if (!root || (!Array.isArray(root.holidays) && !Array.isArray(root.exams))) {
    throw new Error('JSON must contain a "holidays" and/or "exams" array.');
  }
  const events: CalendarEvent[] = [];
  if (Array.isArray(root.holidays)) {
    root.holidays.forEach((h: any, i) => {
      if (!h.title || !h.start) throw new Error(`Holiday ${i + 1} needs a title and start date.`);
      events.push({ id: `import-h-${Date.now()}-${i}`, kind: "holiday", title: h.title, start: h.start, end: h.end || h.start });
    });
  }
  if (Array.isArray(root.exams)) {
    root.exams.forEach((e: any, i) => {
      if (!e.title || (!e.date && !e.start)) throw new Error(`Exam ${i + 1} needs a title and date.`);
      events.push({ id: `import-e-${Date.now()}-${i}`, kind: "exam", title: e.title, start: e.date || e.start, end: e.date || e.start, subject: e.subject, examTime: e.time });
    });
  }
  return events;
}

// ─── Initial data ─────────────────────────────────────────────────────
const todayStr = getTodayString();
const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
const dayAfterDate = new Date(); dayAfterDate.setDate(dayAfterDate.getDate() + 2);
const dayAfterStr = `${dayAfterDate.getFullYear()}-${String(dayAfterDate.getMonth() + 1).padStart(2, "0")}-${String(dayAfterDate.getDate()).padStart(2, "0")}`;





const initialAttendance: AttendanceItem[] = [];

const initialCalendarEvents: CalendarEvent[] = [];

// ─── Subcomponents ────────────────────────────────────────────────────
function ProgressRing({ value }: { value: number }) {
  const radius = 42; const circumference = 2 * Math.PI * radius; const dash = circumference - (value / 100) * circumference;
  return (<div className="progress-ring" aria-label={`${value}% of tasks completed`}><svg width="112" height="112" viewBox="0 0 112 112"><circle className="ring-track" cx="56" cy="56" r={radius} /><circle className="ring-value" cx="56" cy="56" r={radius} strokeDasharray={circumference} strokeDashoffset={dash} /></svg><div className="ring-label"><strong>{value}%</strong><span>complete</span></div></div>);
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (<div className="section-title"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>);
}

// ─── Main Component ───────────────────────────────────────────────────
export default function Home({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const todayDate = useMemo(() => getTodayString(), []);
  const todayDow = new Date().getDay(); // 0=Sun

  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [activeView, setActiveView] = useState<"today" | "planner" | "library" | "attendance" | "coding" | "calendar">("today");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("Medium");
  const [isDailyTask, setIsDailyTask] = useState(false);
  const [taskDays, setTaskDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [subjectName, setSubjectName] = useState("");
  const [subjectDays, setSubjectDays] = useState<number[]>([1, 3]);
  const [subjectTime, setSubjectTime] = useState("09:00 AM");
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookReturnBy, setBookReturnBy] = useState("");
  const [attendance, setAttendance] = useState<AttendanceItem[]>(initialAttendance);
  const [attendanceTarget, setAttendanceTarget] = useState(75);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventKind, setEventKind] = useState<CalendarEvent["kind"]>("holiday");
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventSubject, setEventSubject] = useState("");
  const [eventTime, setEventTime] = useState("09:00 AM");
  const [afterExamClass, setAfterExamClass] = useState(false);
  const [afterExamSubject, setAfterExamSubject] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [codeforcesHandle, setCodeforcesHandle] = useState("");
  const [, setNow] = useState(Date.now());
  const [showProfile, setShowProfile] = useState(false);
  const [lcInput, setLcInput] = useState("");
  const [cfInput, setCfInput] = useState("");
  const [importModeFile, setImportModeFile] = useState<File | null>(null);
  const [showImportMode, setShowImportMode] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const trpcCtx = trpc.useContext();
  
  const { data: rawSubjects = [] } = trpc.planner.subjects.useQuery();
  const { data: rawSchedules = [] } = trpc.planner.schedules.useQuery();
  const subjects = useMemo(() => {
    return rawSubjects.map(sub => {
      const subSchedules = rawSchedules.filter(s => s.subjectId === sub.id);
      const days = subSchedules.map(s => s.dayOfWeek);
      const times: Record<number, string> = {};
      subSchedules.forEach(s => {
        if (s.startTime) times[s.dayOfWeek] = s.startTime;
      });
      const time = subSchedules[0]?.startTime || "09:00 AM";
      return { ...sub, id: String(sub.id), code: sub.code || "", color: sub.color || "", days, time, times };
    });
  }, [rawSubjects, rawSchedules]);

  const { data: rawTasks = [] } = trpc.planner.tasks.useQuery();
  const tasks = useMemo(() => {
    return rawTasks.map(t => ({
      ...t,
      id: String(t.id),
      subjectId: t.subjectId ? String(t.subjectId) : undefined,
      title: t.title,
      dueDate: t.dueDate || "",
      completed: t.isCompleted,
      recurringDays: t.recurringDays ? t.recurringDays.split(",").map(Number) : undefined,
      priority: t.priority as Task["priority"]
    }));
  }, [rawTasks]);

  const { data: rawEvents = [] } = trpc.planner.events.useQuery();
  const calendarEvents = useMemo(() => {
    return rawEvents.map(e => ({
      ...e,
      id: String(e.id),
      kind: e.kind as CalendarEvent["kind"],
      title: e.title,
      start: e.startDate,
      end: e.endDate || e.startDate,
      subject: e.subject || undefined,
      examTime: e.examTime || undefined,
      afterClass: e.afterClass || undefined,
      afterSubject: e.afterSubject || undefined
    }));
  }, [rawEvents]);

  const selectedWeekDay = weekDays.find((day) => day.date === selectedDay);
  const selectedDow = selectedWeekDay?.dow || todayDow;
  const selectedDateStr = selectedWeekDay?.dateStr || todayDate;

  const { data: rawCheckins = [] } = trpc.planner.checkins.useQuery({ date: selectedDateStr });
  const classCheckins = useMemo(() => {
    const acc: Record<string, "attended" | "absent"> = {};
    rawCheckins.forEach(c => {
      // Use full date string as part of the key to prevent cross-week key collisions
      acc[`${c.subjectId}-${selectedDateStr}`] = c.status as "attended" | "absent";
    });
    return acc;
  }, [rawCheckins, selectedDateStr]);

  const { data: codingSettings } = trpc.coding.getSettings.useQuery();

  // Sync saved usernames from DB into local state when settings load
  useEffect(() => {
    if (codingSettings) {
      const lc = codingSettings.leetcodeUsername || "";
      const cf = codingSettings.codeforcesHandle || "";
      setLeetcodeUsername(lc);
      setCodeforcesHandle(cf);
      setLcInput(lc);
      setCfInput(cf);
    }
  }, [codingSettings]);

  // Fetch live stats (only when usernames are saved)
  const { data: lcData } = trpc.coding.leetcodeProfile.useQuery(
    { username: leetcodeUsername },
    { enabled: !!leetcodeUsername, retry: 1, staleTime: 5 * 60 * 1000 }
  );
  const { data: cfData } = trpc.coding.codeforcesProfile.useQuery(
    { handle: codeforcesHandle },
    { enabled: !!codeforcesHandle, retry: 1, staleTime: 5 * 60 * 1000 }
  );

  const codingStats = useMemo<CodingStats>(() => {
    const lcSolved = lcData?.profile?.totalSolved ?? 0;
    const cfSolved = (cfData as any)?.solvedCount?.total ?? 0;
    const streak = lcData?.calendar?.streak ?? 0;
    const lcRecent = (lcData?.submissions ?? []).slice(0, 3).map((s: any) => ({
      platform: "LeetCode" as const,
      title: s.title,
      date: new Date(s.timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
    const cfRecent = ((cfData as any)?.submissions ?? []).filter((s: any) => s.verdict === "OK").slice(0, 3).map((s: any) => ({
      platform: "Codeforces" as const,
      title: s.problemName ?? String(s.id),
      date: new Date(s.timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
    return {
      codeforcesSolved: cfSolved,
      codeforcesTarget: codingSettings?.codeforcesTarget ?? 200,
      leetcodeSolved: lcSolved,
      leetcodeTarget: codingSettings?.leetcodeTarget ?? 150,
      streak,
      recent: [...lcRecent, ...cfRecent].slice(0, 5),
    };
  }, [lcData, cfData, codingSettings]);

  const createSubjectMut = trpc.planner.createSubject.useMutation({ onSuccess: () => { trpcCtx.planner.subjects.invalidate(); trpcCtx.planner.schedules.invalidate(); }});
  const upsertSubjectMut = trpc.planner.upsertSubject.useMutation({ onSuccess: () => { trpcCtx.planner.subjects.invalidate(); trpcCtx.planner.schedules.invalidate(); }});
  const clearAllSubjectsMut = trpc.planner.clearAllSubjects.useMutation({ onSuccess: () => { trpcCtx.planner.subjects.invalidate(); trpcCtx.planner.schedules.invalidate(); trpcCtx.planner.tasks.invalidate(); trpcCtx.planner.checkins.invalidate(); }});
  const createTaskMut = trpc.planner.createTask.useMutation({ onSuccess: () => trpcCtx.planner.tasks.invalidate() });
  const createEventMut = trpc.planner.createEvent.useMutation({ onSuccess: () => trpcCtx.planner.events.invalidate() });
  const importEventsMut = trpc.planner.importEvents.useMutation({ onSuccess: () => trpcCtx.planner.events.invalidate() });

  // ── Optimistic: Delete Subject ──
  const deleteSubjectMut = trpc.planner.deleteSubject.useMutation({
    onMutate: async (input) => {
      await trpcCtx.planner.subjects.cancel();
      const prev = trpcCtx.planner.subjects.getData();
      trpcCtx.planner.subjects.setData(undefined, (old) => old?.filter(s => s.id !== input.subjectId) ?? []);
      return { prev };
    },
    onError: (_err, _input, ctx) => { if (ctx?.prev) trpcCtx.planner.subjects.setData(undefined, ctx.prev); toast.error("Failed to delete subject"); },
    onSettled: () => { trpcCtx.planner.subjects.invalidate(); trpcCtx.planner.schedules.invalidate(); trpcCtx.planner.tasks.invalidate(); trpcCtx.planner.checkins.invalidate(); },
  });

  // ── Optimistic: Toggle Task ──
  const toggleTaskMut = trpc.planner.toggleTask.useMutation({
    onMutate: async (input) => {
      await trpcCtx.planner.tasks.cancel();
      const prev = trpcCtx.planner.tasks.getData();
      trpcCtx.planner.tasks.setData(undefined, (old) => old?.map(t => t.id === input.taskId ? { ...t, isCompleted: !t.isCompleted } : t) ?? []);
      return { prev };
    },
    onError: (_err, _input, ctx) => { if (ctx?.prev) trpcCtx.planner.tasks.setData(undefined, ctx.prev); toast.error("Failed to update task"); },
    onSettled: () => trpcCtx.planner.tasks.invalidate(),
  });

  // ── Optimistic: Delete Task ──
  const deleteTaskMut = trpc.planner.deleteTask.useMutation({
    onMutate: async (input) => {
      await trpcCtx.planner.tasks.cancel();
      const prev = trpcCtx.planner.tasks.getData();
      trpcCtx.planner.tasks.setData(undefined, (old) => old?.filter(t => t.id !== input.taskId) ?? []);
      return { prev };
    },
    onError: (_err, _input, ctx) => { if (ctx?.prev) trpcCtx.planner.tasks.setData(undefined, ctx.prev); toast.error("Failed to delete task"); },
    onSettled: () => trpcCtx.planner.tasks.invalidate(),
  });

  // ── Optimistic: Check-in ──
  const markCheckinMut = trpc.planner.checkIn.useMutation({
    onMutate: async (input) => {
      await trpcCtx.planner.checkins.cancel();
      const prev = trpcCtx.planner.checkins.getData({ date: input.checkinDate });
      trpcCtx.planner.checkins.setData({ date: input.checkinDate }, (old) => {
        const filtered = old?.filter(c => c.subjectId !== input.subjectId) ?? [];
        return [...filtered, { id: -1, subjectId: input.subjectId, checkinDate: input.checkinDate, status: input.status, userId: 0, createdAt: new Date() }];
      });
      return { prev, date: input.checkinDate };
    },
    onError: (_err, _input, ctx) => { if (ctx?.prev) trpcCtx.planner.checkins.setData({ date: ctx.date }, ctx.prev); toast.error("Failed to save check-in"); },
    onSettled: (_d, _e, input) => trpcCtx.planner.checkins.invalidate({ date: input.checkinDate }),
  });

  // ── Optimistic: Delete Event ──
  const deleteEventMut = trpc.planner.deleteEvent.useMutation({
    onMutate: async (input) => {
      await trpcCtx.planner.events.cancel();
      const prev = trpcCtx.planner.events.getData();
      trpcCtx.planner.events.setData(undefined, (old) => old?.filter(e => e.id !== input.eventId) ?? []);
      return { prev };
    },
    onError: (_err, _input, ctx) => { if (ctx?.prev) trpcCtx.planner.events.setData(undefined, ctx.prev); toast.error("Failed to delete event"); },
    onSettled: () => trpcCtx.planner.events.invalidate(),
  });

  // ── Optimistic: Save Coding Settings ──
  const saveSettingsMut = trpc.coding.saveSettings.useMutation({
    onMutate: async (input) => {
      await trpcCtx.coding.getSettings.cancel();
      const prev = trpcCtx.coding.getSettings.getData();
      trpcCtx.coding.getSettings.setData(undefined, (old) => old ? { ...old, ...input } : old);
      return { prev };
    },
    onError: (_err, _input, ctx) => { if (ctx?.prev) trpcCtx.coding.getSettings.setData(undefined, ctx.prev); toast.error("Failed to save settings"); },
    onSettled: () => trpcCtx.coding.getSettings.invalidate(),
  });

  // Re-evaluate attendance button states every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  
  const todaysTasks = tasks.filter((task) => task.dueDate === selectedDateStr || task.recurringDays?.includes(selectedDow));
  const completedCount = todaysTasks.filter((task) => task.completed).length;
  const progress = todaysTasks.length ? Math.round((completedCount / todaysTasks.length) * 100) : 0;
  const openCount = todaysTasks.length - completedCount;
  const firstName = user?.name?.split(" ")[0] || "Student";
  const greeting = getGreeting(firstName);
  const selectedDateLabel = selectedDateStr === todayDate ? `Today, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : `${selectedWeekDay?.full}, ${new Date(selectedDateStr + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  const userInitials = user?.name ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  const upcomingTasks = useMemo(() => tasks.filter((task) => !task.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [tasks]);

  const subjectById = (id?: string) => subjects.find((subject) => subject.id === id);
  const todaysClasses = calendarEvents.some((event) => (event.kind === "dayoff" || event.kind === "holiday") && event.start <= selectedDateStr && event.end >= selectedDateStr) ? [] : subjects.filter((subject) => subject.days.includes(selectedDow)).map((subject) => ({ subject, time: subject.times[selectedDow] || subject.time }));

  // Attendance window helpers
  const getCheckinState = (subjectId: string, time: string) => {
    // Use full date string in key to prevent cross-week collisions (e.g. day "5" this week vs next week)
    const key = `${subjectId}-${selectedDateStr}`;
    const checkinStatus = classCheckins[key];
    const now = new Date();
    const classStart = parseTimeToDate(time, selectedDateStr);
    const classEnd = new Date(classStart.getTime() + 12 * 60 * 60 * 1000);
    const isBeforeClass = now < classStart;
    const isInWindow = now >= classStart && now <= classEnd;
    const isExpired = now > classEnd;
    return { key, checkinStatus, isBeforeClass, isInWindow, isExpired, classStart, classEnd };
  };

  const toggleTask = (id: string) => { 
    const task = tasks.find(t => t.id === id);
    if (task) toggleTaskMut.mutate({ taskId: Number(id), isCompleted: !task.completed }); 
  };

  const addTask = (event: FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    const subject = subjectById(taskSubject);
    const smartDate = !taskDate && subject ? getNextScheduledDate(new Date(), subject.days) : null;
    
    createTaskMut.mutate({
      title: taskTitle.trim(),
      subjectId: taskSubject ? Number(taskSubject) : undefined,
      dueDate: taskDate || smartDate || todayDate,
      priority: taskPriority,
      recurringDays: isDailyTask ? taskDays : []
    }, {
      onSuccess: () => {
        setTaskTitle(""); setTaskSubject(""); setTaskDate(""); setTaskPriority("Medium"); setIsDailyTask(false); setTaskDays([1, 2, 3, 4, 5, 6]); setShowTaskForm(false);
        toast.success(taskDate ? "Task added with your due date" : subject ? `Task added · due ${formatDateLabel(taskDate || smartDate || todayDate)}` : "Task added to your day");
      },
      onError: (err) => toast.error(`Could not add task: ${err.message}`),
    });
  };

  const addSubject = (event: FormEvent) => {
    event.preventDefault();
    if (!subjectName.trim() || subjectDays.length === 0) return;
    createSubjectMut.mutate({
      name: subjectName.trim(),
      days: subjectDays,
      startTime: subjectTime
    }, {
      onSuccess: () => {
        setSubjectName(""); setSubjectDays([1, 3]); setShowSubjectForm(false);
        toast.success(`${subjectName.trim()} added to your timetable`);
      },
      onError: (err) => toast.error(`Could not add subject: ${err.message}`),
    });
  };

  const toggleSubjectDay = (day: number) => { setSubjectDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort()); };
  const toggleTaskDay = (day: number) => setTaskDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());

  const importPlannerFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = "";
    // Show import mode dialog
    setImportModeFile(file);
    setShowImportMode(true);
  };

  const executeImport = async (mode: "replace" | "merge") => {
    const file = importModeFile;
    setShowImportMode(false);
    setImportModeFile(null);
    if (!file) return;
    let parsed: ReturnType<typeof parsePlannerJson>;
    try {
      parsed = parsePlannerJson(JSON.parse(await file.text()), subjects.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that planner JSON");
      return;
    }
    // If replace mode, clear all subjects first
    if (mode === "replace") {
      await new Promise<void>((resolve) => {
        clearAllSubjectsMut.mutate(undefined, {
          onSuccess: () => { toast.info("Existing subjects cleared"); resolve(); },
          onError: (err) => { toast.error(`Could not clear subjects: ${err.message}`); resolve(); },
        });
      });
    }
    // Import sequentially — use upsert for merge, create for replace
    const mutation = mode === "merge" ? upsertSubjectMut : createSubjectMut;
    let successCount = 0;
    const errors: string[] = [];
    for (const sub of parsed) {
      await new Promise<void>((resolve) => {
        mutation.mutate(
          { name: sub.name, code: sub.code, color: sub.color, days: sub.days, startTime: sub.time, times: Object.fromEntries(Object.entries(sub.times).map(([k, v]) => [k, v])) },
          {
            onSuccess: () => { successCount += 1; resolve(); },
            onError: (err) => { errors.push(`${sub.name}: ${err.message}`); resolve(); },
          }
        );
      });
    }
    if (successCount > 0) toast.success(`${successCount} subject${successCount > 1 ? "s" : ""} imported successfully`);
    if (errors.length > 0) toast.error(`${errors.length} subject${errors.length > 1 ? "s" : ""} failed to import: ${errors.join("; ")}`);
  };

  const importCalendarJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const imported = parseCalendarJson(JSON.parse(await file.text()));
      importEventsMut.mutate({
        events: imported.map(e => ({
          kind: e.kind,
          title: e.title,
          startDate: e.start,
          endDate: e.end,
          subject: e.subject,
          examTime: e.examTime
        }))
      }, {
        onSuccess: (data) => {
          toast.success(`${data.count} calendar events imported`);
        }
      });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not read that JSON file"); }
    event.target.value = "";
  };

  const addBook = (event: FormEvent) => {
    event.preventDefault(); if (!bookTitle.trim()) return;
    setLibraryBooks((current) => [{ id: `book-${Date.now()}`, title: bookTitle.trim(), author: bookAuthor.trim() || "Unknown author", issuedOn: formatDateLabel(todayDate), returnBy: bookReturnBy ? formatDateLabel(bookReturnBy) : "Not set" }, ...current]);
    setBookTitle(""); setBookAuthor(""); setBookReturnBy(""); setShowLibraryForm(false); toast.success("Book added to your library list");
  };

  const importAttendanceCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { const imported = parseAttendanceCsv(await file.text()); setAttendance(imported); toast.success(`${imported.length} subjects loaded from attendance CSV`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not read that CSV"); }
    event.target.value = "";
  };

  const addCalendarEvent = (event: FormEvent) => {
    event.preventDefault(); if (!eventTitle.trim() || !eventStart) return;
    createEventMut.mutate({
      kind: eventKind,
      title: eventTitle.trim(),
      startDate: eventStart,
      endDate: eventEnd || eventStart,
      subject: eventKind === "exam" ? eventSubject.trim() || "Custom subject" : undefined,
      examTime: eventKind === "exam" ? eventTime : undefined,
      afterClass: eventKind === "exam" ? afterExamClass : undefined,
      afterSubject: eventKind === "exam" ? afterExamSubject : undefined
    }, {
      onSuccess: () => {
        setEventTitle(""); setEventStart(""); setEventEnd(""); setEventSubject(""); setAfterExamClass(false); setAfterExamSubject(""); setShowEventForm(false);
        toast.success(`${eventKind === "dayoff" ? "Day off" : eventKind === "holiday" ? "Holiday" : "Exam"} added to planner`);
      },
      onError: (err) => toast.error(`Could not save: ${err.message}`),
    });
  };

  const markAttendance = (key: string, subjectId: string, status: "attended" | "absent") => {
    markCheckinMut.mutate({ subjectId: Number(subjectId), checkinDate: selectedDateStr, status });
    // Optimistic local update to attendance stats
    if (status === "absent") {
      const subject = subjects.find(s => s.id === subjectId);
      if (subject) {
        setAttendance((current) => current.map(item => {
          if (item.name === subject.name || item.code === subject.code) return { ...item, absent: item.absent + 1, hoursAbsent: item.hoursAbsent + 1, makeup: item.makeup };
          return item;
        }));
      }
    } else if (status === "attended") {
      const subject = subjects.find(s => s.id === subjectId);
      if (subject) {
        setAttendance((current) => current.map(item => {
          if (item.name === subject.name || item.code === subject.code) return { ...item, present: item.present + 1, hoursPresent: item.hoursPresent + 1, makeup: item.makeup };
          return item;
        }));
      }
    }
    toast.success(status === "attended" ? "Marked as attended" : "Marked as absent");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={18} strokeWidth={2.5} /></div>
          <div><strong>Daymark</strong><span>student planner</span></div>
        </div>
        <div className="sidebar-label">Workspace</div>
        <nav className="side-nav">
          <button className={activeView === "today" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("today"); setMobileNav(false); }}><LayoutDashboard size={18} /> Today <span className="nav-count">{openCount}</span></button>
          <button className={activeView === "planner" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("planner"); setMobileNav(false); }}><CalendarDays size={18} /> Planner</button>
          <button className={activeView === "library" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("library"); setMobileNav(false); }}><Library size={18} /> Library <span className="nav-count">{libraryBooks.length}</span></button>
          <button className={activeView === "attendance" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("attendance"); setMobileNav(false); }}><BarChart3 size={18} /> Attendance</button>
          <button className={activeView === "coding" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("coding"); setMobileNav(false); }}><Target size={18} /> Coding journey</button>
          <button className={activeView === "calendar" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("calendar"); setMobileNav(false); }}><CalendarDays size={18} /> Calendar</button>
          <button className="nav-item" onClick={() => toast.info("Focus mode is ready for your next study block.")}><Timer size={18} /> Focus mode</button>
        </nav>
        <div className="sidebar-label subject-label">Your subjects <button aria-label="Add subject" onClick={() => setShowSubjectForm(true)}><Plus size={15} /></button></div>
        <div className="subject-list">
          {subjects.map((subject) => <button className="subject-nav" key={subject.id} onClick={() => { setActiveView("planner"); toast.info(`${subject.name} · ${subject.days.map((day) => DAY_NAMES[day].slice(0, 3)).join(" + ")}`); }}><span className="subject-dot" style={{ background: subject.color }} />{subject.name}<span className="subject-chevron">›</span></button>)}
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setShowSettings(true)}><Settings2 size={18} /> Settings</button>
          <div className="profile-card">
            <div className="avatar">{userInitials}</div>
            <div><strong>{user?.name || "Student"}</strong><span>{user?.email || "Personal workspace"}</span></div>
            <button onClick={() => setShowProfile(true)} title="View profile"><MoreHorizontal size={17} /></button>
          </div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{activeView === "today" ? "Today" : activeView === "planner" ? "Planner" : activeView === "library" ? "Library" : activeView === "attendance" ? "Attendance" : activeView === "calendar" ? "Calendar" : "Coding journey"}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Settings" onClick={() => setShowSettings(true)}><Settings2 size={18} /></button>
            <button className="icon-button" aria-label="Search" onClick={() => toast.info("Search across your tasks is coming soon.")}><Search size={18} /></button>
            <button className="help-button" onClick={() => toast.info("Tip: leave a due date blank to let Daymark find the next class day.")}><CircleHelp size={17} /> Help</button>
            <div className="mini-avatar">{userInitials}</div>
          </div>
        </header>

        <div className="content-wrap">
          {activeView === "today" ? <>
            <section className="hero-row">
              <div><p className="eyebrow coral">{getHeroDateLabel()}</p><h1>{greeting}</h1><p className="hero-subtitle">A clear day starts with one small step.</p></div>
              <button className="primary-button" onClick={() => setShowTaskForm(true)}><Plus size={18} /> Add task <span className="shortcut">⌘ K</span></button>
            </section>

            <section className="week-strip" aria-label="Select a day">
              <div className="week-month"><span>{weekDays[0].month}</span><strong>{weekDays[0].year}</strong></div>
              <div className="week-days">{weekDays.map((day) => <button key={day.date} className={`day-pill ${selectedDay === day.date ? "selected" : ""}`} onClick={() => setSelectedDay(day.date)}><span>{day.label}</span><strong>{day.date}</strong>{day.dateStr === todayDate && <i />}</button>)}</div>
              <button className="calendar-button" onClick={() => toast.info("Calendar view is coming soon.")}><CalendarDays size={18} /></button>
            </section>

            <section className="panel classes-today-panel">
              <SectionTitle eyebrow="Class check-in" title={selectedDateStr === todayDate ? "Classes today" : `Classes on ${selectedWeekDay?.full}`} action={<span className="class-check-note">Mark attendance yourself</span>} />
              <div className="classes-today-list">
                {todaysClasses.length ? todaysClasses.map(({ subject, time }) => {
                  const { key, checkinStatus, isBeforeClass, isInWindow, isExpired } = getCheckinState(subject.id, time);
                  const isLocked = checkinStatus !== undefined;
                  return <div className={`class-today-row ${checkinStatus === "attended" ? "class-attended" : checkinStatus === "absent" ? "class-absent" : ""}`} key={key}>
                    <span className="subject-dot" style={{ background: subject.color }} />
                    <div className="class-today-main"><strong>{subject.name}</strong><span>{subject.code} · {time}</span></div>
                    {isBeforeClass && !isLocked ? (
                      <span className="class-starts-at"><Clock3 size={13} /> Starts at {time}</span>
                    ) : isLocked ? (
                      <span className={`class-check-button ${checkinStatus === "attended" ? "checked" : "absent-checked"}`}>
                        {checkinStatus === "attended" ? <Check size={14} /> : <X size={14} />}
                        <span>{checkinStatus === "attended" ? "Attended" : "Absent"}</span>
                      </span>
                    ) : (isInWindow || selectedDateStr !== todayDate) ? (
                      <div className="class-check-actions">
                        <button className="class-check-button" onClick={() => markAttendance(key, subject.id, "attended")}><Check size={14} /><span>Attended</span></button>
                        <button className="class-check-button absent-btn" onClick={() => markAttendance(key, subject.id, "absent")}><X size={14} /><span>Absent</span></button>
                      </div>
                    ) : (
                      <span className="class-starts-at"><Clock3 size={13} /> Window closed</span>
                    )}
                  </div>;
                }) : <div className="class-empty"><CalendarDays size={18} /><span>No classes scheduled — add a holiday or day off in Planner.</span></div>}
              </div>
            </section>

            <section className="stats-grid">
              <div className="stat-card progress-card"><div><p className="eyebrow">Daily progress</p><h3>{progress === 100 ? "Day complete" : `${openCount} tasks to go`}</h3><p className="muted">Keep your momentum going.</p></div><ProgressRing value={progress} /></div>
              <div className="stat-card accent-card"><div className="stat-icon"><Flame size={19} /></div><p className="eyebrow">Current streak</p><strong className="stat-number">{codingStats.streak} <small>days</small></strong><div className="stat-trend">{codingStats.streak > 0 ? <><TrendingUp size={14} /> Keep it going!</> : <>Start solving to build a streak</>}</div></div>
              {(() => { const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0,0,0,0); const weekCompleted = tasks.filter(t => t.completed && weekDays.some(d => d.dateStr === t.dueDate)).length; return <div className="stat-card"><div className="stat-icon lavender"><Target size={19} /></div><p className="eyebrow">Tasks this week</p><strong className="stat-number">{weekCompleted} <small>done</small></strong><div className="stat-trend neutral"><Clock3 size={14} /> {tasks.filter(t => !t.completed && weekDays.some(d => d.dateStr === t.dueDate)).length} remaining</div></div>; })()}
            </section>

            <div className="dashboard-grid">
              <section className="panel tasks-panel">
                <SectionTitle eyebrow={selectedDateStr === todayDate ? "Your focus list" : "Selected day"} title={selectedDateLabel} action={<button className="text-button" onClick={() => setShowTaskForm(true)}>Add task <ArrowRight size={15} /></button>} />
                <div className="task-list">
                  {todaysTasks.map((task, index) => { const subject = subjectById(task.subjectId); return <div className={`task-row ${task.completed ? "task-done" : ""}`} key={task.id} style={{ animationDelay: `${index * 40}ms` }}><button className={`task-checkbox ${task.completed ? "checked" : ""}`} onClick={() => toggleTask(task.id)} aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}>{task.completed && <Check size={14} />}</button><div className="task-main"><strong>{task.title}</strong><div className="task-meta">{subject && <span className="subject-tag"><span className="subject-dot" style={{ background: subject.color }} />{subject.name}</span>}<span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></div></div><span className="task-time">{task.completed ? "Done" : task.dueDate === todayDate ? "Today" : formatDateLabel(task.dueDate)}</span><button className="row-menu" aria-label="More actions" onClick={() => { deleteTaskMut.mutate({ taskId: Number(task.id) }); toast.success("Task removed"); }}><Trash2 size={15} /></button></div>; })}
                  {todaysTasks.length === 0 && <div className="empty-state"><ListChecks size={26} /><strong>No tasks here yet</strong><span>Add a task to shape your day.</span></div>}
                </div>
                <div className="list-footer"><span><Check size={15} /> {completedCount} of {todaysTasks.length} completed</span><button onClick={() => { todaysTasks.filter(t => t.completed).forEach(t => deleteTaskMut.mutate({ taskId: Number(t.id) })); toast.success("Cleared completed tasks"); }}>Clear completed</button></div>
              </section>

              <aside className="right-column">
                <section className="panel next-panel"><SectionTitle eyebrow="Up next" title="Coming up" action={<button className="dots-button" onClick={() => toast.info("You are all caught up for today.")}><MoreHorizontal size={18} /></button>} /><div className="upcoming-list">{upcomingTasks.slice(0, 3).map((task) => { const subject = subjectById(task.subjectId); return <button className="upcoming-row" key={task.id} onClick={() => toast.info(`${task.title} · due ${formatDateLabel(task.dueDate)}`)}><span className="upcoming-date">{formatDateLabel(task.dueDate).split(" ")[0]}<strong>{formatDateLabel(task.dueDate).split(" ")[1]}</strong></span><span className="upcoming-detail"><strong>{task.title}</strong><span>{subject?.name || "Personal"}</span></span><ChevronDown size={15} className="chevron-right" /></button>; })}</div><button className="view-all" onClick={() => setActiveView("planner")}>View planner <ArrowRight size={15} /></button></section>
                <section className="panel quote-panel"><div className="quote-mark">"</div><p>Consistency is not about perfection. It's about returning to what matters.</p><span>— your future self</span></section>
              </aside>
            </div>
          </> : activeView === "planner" ? <PlannerView subjects={subjects} tasks={tasks} weekDays={weekDays} todayDate={todayDate} onAddSubject={() => setShowSubjectForm(true)} onAddTask={() => setShowTaskForm(true)} onImport={importPlannerFile} onImportCalendar={importCalendarJson} onDeleteSubject={(id) => { deleteSubjectMut.mutate({ subjectId: Number(id) }); toast.success("Subject removed"); }} events={calendarEvents} onAddEvent={(kind) => { setEventKind(kind); setShowEventForm(true); }} onRemoveEvent={(id) => deleteEventMut.mutate({ eventId: Number(id) })} /> : activeView === "library" ? <LibraryView books={libraryBooks} onAdd={() => setShowLibraryForm(true)} onRemove={(id) => { setLibraryBooks((current) => current.filter((book) => book.id !== id)); toast.success("Book removed"); }} /> : activeView === "attendance" ? <AttendanceView attendance={attendance} target={attendanceTarget} onTargetChange={setAttendanceTarget} onImport={importAttendanceCsv} subjects={subjects} onAddMakeup={(subjectCode, hours) => { setAttendance((current) => current.map(item => item.code === subjectCode ? { ...item, makeup: item.makeup + hours, hoursPresent: item.hoursPresent + hours } : item)); toast.success(`Added ${hours} makeup hour${hours > 1 ? "s" : ""} for ${subjectCode}`); }} /> : activeView === "calendar" ? <CalendarGridView month={calMonth} year={calYear} onMonthChange={(m, y) => { setCalMonth(m); setCalYear(y); }} events={calendarEvents} onAddEvent={(kind, date) => { setEventKind(kind); setEventStart(date); setShowEventForm(true); }} onRemoveEvent={(id) => deleteEventMut.mutate({ eventId: Number(id) })} /> : <CodingView stats={codingStats} onChange={(updated) => { saveSettingsMut.mutate({ leetcodeTarget: updated.leetcodeTarget, codeforcesTarget: updated.codeforcesTarget }); }} />}
        </div>
      </main>

      {showTaskForm && <div className="modal-backdrop" onMouseDown={() => setShowTaskForm(false)}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">New entry</p><h2>Add a task</h2></div><button className="close-button" onClick={() => setShowTaskForm(false)}><X size={19} /></button></div><form onSubmit={addTask}><label>What needs your attention?<input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Finish chemistry worksheet" /></label><div className="form-grid"><label>Subject<select value={taskSubject} onChange={(event) => setTaskSubject(event.target.value)}><option value="">No subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>Priority<select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Task["priority"])}><option>High</option><option>Medium</option><option>Low</option></select></label></div><label>Due date <span className="optional">optional</span><input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} /></label><label className="recurring-toggle"><input type="checkbox" checked={isDailyTask} onChange={(event) => setIsDailyTask(event.target.checked)} /><span>Make this a daily task</span></label>{isDailyTask && <div className="recurring-days"><span className="optional">Repeat on</span><div className="day-selector">{weekDays.map((day) => <button type="button" key={day.label} className={taskDays.includes(day.dow) ? "day-select selected" : "day-select"} onClick={() => toggleTaskDay(day.dow)}>{day.label}</button>)}</div></div>}{taskSubject && !taskDate && <div className="smart-note"><Sparkles size={15} /><span>Smart date will use the next {subjectById(taskSubject)?.name} class: <strong>{formatDateLabel(getNextScheduledDate(new Date(), subjectById(taskSubject)?.days || []))}</strong></span></div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowTaskForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!taskTitle.trim()}>Create task <ArrowRight size={16} /></button></div></form></div></div>}

      {showLibraryForm && <div className="modal-backdrop" onMouseDown={() => setShowLibraryForm(false)}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">Library desk</p><h2>Add issued book</h2></div><button className="close-button" onClick={() => setShowLibraryForm(false)}><X size={19} /></button></div><form onSubmit={addBook}><label>Book title<input autoFocus value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="e.g. The Design of Everyday Things" /></label><label>Author<input value={bookAuthor} onChange={(event) => setBookAuthor(event.target.value)} placeholder="e.g. Don Norman" /></label><label>Return by <span className="optional">optional</span><input type="date" value={bookReturnBy} onChange={(event) => setBookReturnBy(event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowLibraryForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!bookTitle.trim()}>Add book <ArrowRight size={16} /></button></div></form></div></div>}

      {showEventForm && <div className="modal-backdrop" onMouseDown={() => setShowEventForm(false)}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">Planner calendar</p><h2>Add {eventKind === "dayoff" ? "a day off" : eventKind === "holiday" ? "a holiday" : "an exam"}</h2></div><button className="close-button" onClick={() => setShowEventForm(false)}><X size={19} /></button></div><form onSubmit={addCalendarEvent}><label>Title<input autoFocus value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder={eventKind === "exam" ? "e.g. Digital Electronics Midterm" : "e.g. Diwali break"} /></label><div className="form-grid"><label>Starts<input type="date" value={eventStart} onChange={(event) => setEventStart(event.target.value)} /></label><label>Ends <span className="optional">for multi-day holidays</span><input type="date" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} /></label></div>{eventKind === "exam" && <><label>Exam subject <span className="optional">or type a custom subject</span><input value={eventSubject} onChange={(event) => setEventSubject(event.target.value)} placeholder="e.g. Advanced Algorithms" /></label><label>Exam time<input value={eventTime} onChange={(event) => setEventTime(event.target.value)} /></label><label className="recurring-toggle"><input type="checkbox" checked={afterExamClass} onChange={(event) => setAfterExamClass(event.target.checked)} /><span>Classes continue after the exam</span></label>{afterExamClass && <label>After-exam class subject<input value={afterExamSubject} onChange={(event) => setAfterExamSubject(event.target.value)} placeholder="e.g. Data Structures and Algorithms" /></label>}</>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowEventForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!eventTitle.trim() || !eventStart}>Add to planner <ArrowRight size={16} /></button></div></form></div></div>}

      {showSubjectForm && <div className="modal-backdrop" onMouseDown={() => setShowSubjectForm(false)}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">Build your week</p><h2>Add a subject</h2></div><button className="close-button" onClick={() => setShowSubjectForm(false)}><X size={19} /></button></div><form onSubmit={addSubject}><label>Subject name<input autoFocus value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="e.g. Creative Writing" /></label><label>Meets on</label><div className="day-selector">{weekDays.slice(0, 5).map((day, index) => <button type="button" key={day.label} className={subjectDays.includes(index + 1) ? "day-select selected" : "day-select"} onClick={() => toggleSubjectDay(index + 1)}>{day.label}</button>)}</div><label>Class time<input type="time" value={subjectTime.replace(/ (AM|PM)$/i, "").replace(/^(\d):/, "0$1:")} onChange={(event) => { const [h, m] = event.target.value.split(":").map(Number); const period = h >= 12 ? "PM" : "AM"; const hour12 = h % 12 || 12; setSubjectTime(`${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`); }} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowSubjectForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!subjectName.trim() || subjectDays.length === 0}>Add subject <ArrowRight size={16} /></button></div></form></div></div>}

      {showImportMode && <div className="modal-backdrop" onMouseDown={() => { setShowImportMode(false); setImportModeFile(null); }}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">Import options</p><h2>How should we import?</h2></div><button className="close-button" onClick={() => { setShowImportMode(false); setImportModeFile(null); }}><X size={19} /></button></div><p style={{ padding: "0 24px", color: "var(--text-muted, #aaa)", fontSize: 14, lineHeight: 1.6 }}>Choose whether to replace your existing subjects or merge the imported ones with your current planner.</p><div className="modal-actions" style={{ flexDirection: "column", gap: 10 }}><button className="primary-button" style={{ width: "100%", justifyContent: "center" }} onClick={() => executeImport("merge")}><RefreshCw size={16} /> Add / Merge — keep existing, update matches</button><button className="secondary-button" style={{ width: "100%", justifyContent: "center", color: "#ef4444" }} onClick={() => executeImport("replace")}><Trash2 size={16} /> Replace all — clear everything and import fresh</button></div></div></div>}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} leetcodeUsername={leetcodeUsername} codeforcesHandle={codeforcesHandle} onSave={(lc, cf) => { saveSettingsMut.mutate({ leetcodeUsername: lc, codeforcesHandle: cf }); }} />
      <ProfilePanel open={showProfile} onClose={() => setShowProfile(false)} user={user} onLogout={onLogout} subjectsCount={subjects.length} tasksCount={tasks.length} />
    </div>
  );
}

// ─── Planner View ─────────────────────────────────────────────────────
function PlannerView({ subjects, tasks, weekDays, todayDate, onAddSubject, onAddTask, onImport, onImportCalendar, onDeleteSubject, events, onAddEvent, onRemoveEvent }: { subjects: Subject[]; tasks: Task[]; weekDays: ReturnType<typeof getCurrentWeekDays>; todayDate: string; onAddSubject: () => void; onAddTask: () => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; onImportCalendar: (event: React.ChangeEvent<HTMLInputElement>) => void; onDeleteSubject: (id: string) => void; events: CalendarEvent[]; onAddEvent: (kind: CalendarEvent["kind"]) => void; onRemoveEvent: (id: string) => void }) {
  return (
    <>
      <section className="hero-row planner-hero">
        <div><p className="eyebrow coral">YOUR WEEK AT A GLANCE</p><h1>Planner</h1><p className="hero-subtitle">Six working days, with a different rhythm every day.</p></div>
        <div className="hero-actions"><label className="secondary-button file-button"><FileJson size={16} /> Import JSON<input type="file" accept="application/json,.json" onChange={onImport} /></label><button className="secondary-button" onClick={onAddSubject}><Plus size={17} /> Subject</button><button className="primary-button" onClick={onAddTask}><Plus size={17} /> Task</button></div>
      </section>
      <section className="planner-layout">
        <section className="panel schedule-panel">
          <SectionTitle eyebrow="Weekly timetable" title="Class rhythm" action={<button className="text-button" onClick={onAddSubject}>Manage <Settings2 size={15} /></button>} />
          <div className="schedule-table">
            <div className="schedule-head"><span>Subject</span>{weekDays.map((day) => <span key={day.label}>{day.label}<small>{day.date}</small></span>)}</div>
            {subjects.map((subject) => (
              <div className="schedule-row" key={subject.id}>
                <div className="schedule-subject"><span className="subject-dot" style={{ background: subject.color }} /><div><strong>{subject.name}</strong><small>{subject.code} · {subject.time}</small></div></div>
                {weekDays.map((day) => (<div className={subject.days.includes(day.dow) ? "schedule-cell active" : "schedule-cell"} key={day.label}>{subject.days.includes(day.dow) && <span style={{ background: subject.color }}><small>{subject.times[day.dow] || subject.time}</small></span>}</div>))}
                <button className="schedule-delete" onClick={() => onDeleteSubject(subject.id)} aria-label={`Remove ${subject.name}`}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel planner-summary">
          <SectionTitle eyebrow="This week" title="Task load" />
          <div className="load-number"><strong>{tasks.filter((task) => !task.completed).length}</strong><span>open tasks</span></div>
          <div className="load-bars">{weekDays.map((day) => { const count = tasks.filter((task) => task.dueDate === day.dateStr).length; return <div className="load-bar" key={day.date}><div className="bar-track"><span style={{ height: `${Math.max(14, Math.min(100, count * 28))}%` }} /></div><small>{day.label}</small></div>; })}</div>
          <button className="view-all" onClick={onAddTask}>Plan another task <ArrowRight size={15} /></button>
        </section>
      </section>
      <section className="panel smart-panel"><div className="smart-panel-icon"><Sparkles size={20} /></div><div><p className="eyebrow">Smart due dates</p><h3>Let your timetable do the remembering.</h3><p>When you create a task for a subject without a due date, Daymark automatically finds the next class day and assigns it for you.</p></div><button className="secondary-button" onClick={onAddTask}>Try it <ArrowRight size={16} /></button></section>
      <section className="json-help panel"><div><p className="eyebrow">One-click planner import</p><h3>Use this JSON shape</h3><p>Save it as <strong>my-planner.json</strong>, then choose Import JSON above. Each class can have its own time.</p></div><pre>{`{
  "subjects": [
    {
      "name": "Mathematics",
      "code": "MATH 204",
      "schedule": [
        { "day": "Monday", "time": "09:00 AM" },
        { "day": "Wednesday", "time": "10:30 AM" },
        { "day": "Saturday", "time": "08:30 AM" }
      ]
    }
  ]
}`}</pre></section>
      <section className="panel calendar-events-panel">
        <SectionTitle eyebrow="Calendar exceptions" title="Days off, holidays & exams" action={<div className="event-actions"><label className="secondary-button file-button"><FileJson size={16} /> Import JSON<input type="file" accept="application/json,.json" onChange={onImportCalendar} /></label><button className="secondary-button" onClick={() => onAddEvent("dayoff")}>Day off</button><button className="secondary-button" onClick={() => onAddEvent("holiday")}>Holiday</button><button className="primary-button" onClick={() => onAddEvent("exam")}>Add exam</button></div>} />
        <div className="event-list">{events.map((event) => <div className="event-row" key={event.id}><span className={`event-kind ${event.kind}`}>{event.kind === "exam" ? "EXAM" : event.kind === "holiday" ? "HOLIDAY" : "DAY OFF"}</span><div><strong>{event.title}</strong><small>{event.start}{event.end !== event.start ? ` → ${event.end}` : ""}{event.subject ? ` · ${event.subject}` : ""}{event.afterClass ? ` · after exam: ${event.afterSubject || "class"}` : ""}</small></div><button className="row-menu" onClick={() => onRemoveEvent(event.id)}><Trash2 size={15} /></button></div>)}</div>
      </section>
      <section className="json-help panel"><div><p className="eyebrow">Exam & holiday JSON import</p><h3>Bulk import format</h3><p>Save as <strong>events.json</strong> and use the Import JSON button in the Calendar section above.</p></div><pre>{`{
  "holidays": [
    { "title": "Diwali", "start": "2026-10-20", "end": "2026-10-22" }
  ],
  "exams": [
    { "title": "Physics Midterm", "date": "2026-09-25",
      "time": "09:00 AM", "subject": "Physics" }
  ]
}`}</pre></section>
    </>
  );
}

// ─── Coding View ──────────────────────────────────────────────────────
function CodingView({ stats, onChange }: { stats: CodingStats; onChange: (stats: CodingStats) => void }) {
  const update = (key: "codeforcesSolved" | "codeforcesTarget" | "leetcodeSolved" | "leetcodeTarget", value: number) => onChange({ ...stats, [key]: Math.max(0, value) });
  return <>
    <section className="hero-row"><div><p className="eyebrow coral">PROBLEM SOLVING LOG</p><h1>Coding journey</h1><p className="hero-subtitle">Turn every accepted solution into visible momentum.</p></div><button className="primary-button" onClick={() => toast.success("Nice work — log your next solve when it is accepted.")}><Plus size={18} /> Log a solve</button></section>
    <section className="coding-stats"><CodingPlatformCard platform="Codeforces" accent="blue" solved={stats.codeforcesSolved} target={stats.codeforcesTarget} onSolved={(value) => update("codeforcesSolved", value)} onTarget={(value) => update("codeforcesTarget", value)} /><CodingPlatformCard platform="LeetCode" accent="gold" solved={stats.leetcodeSolved} target={stats.leetcodeTarget} onSolved={(value) => update("leetcodeSolved", value)} onTarget={(value) => update("leetcodeTarget", value)} /><div className="stat-card coding-streak"><p className="eyebrow">Current solve streak</p><strong className="stat-number">{stats.streak}<small> days</small></strong><div className="stat-trend"><TrendingUp size={14} /> Keep the chain alive</div></div></section>
    <section className="coding-grid"><section className="panel recent-solves"><SectionTitle eyebrow="Recent wins" title="Solved recently" /><div className="solve-list">{stats.recent.map((solve) => <div className="solve-row" key={`${solve.platform}-${solve.title}`}><span className={`platform-icon ${solve.platform === "LeetCode" ? "leetcode" : "codeforces"}`}>{solve.platform === "LeetCode" ? "LC" : "CF"}</span><div><strong>{solve.title}</strong><small>{solve.platform}</small></div><span className="solve-date">{solve.date}</span></div>)}</div></section><section className="panel coding-goal"><p className="eyebrow">Your next milestone</p><h2>One solve closer.</h2><p>Use the editable counters above to keep the dashboard aligned with your real profiles and semester goal.</p><div className="goal-line"><span style={{ width: `${Math.min(100, Math.round((stats.codeforcesSolved / Math.max(1, stats.codeforcesTarget)) * 100))}%` }} /></div><small>{stats.codeforcesTarget - stats.codeforcesSolved > 0 ? `${stats.codeforcesTarget - stats.codeforcesSolved} Codeforces solves to target` : "Codeforces target reached"}</small></section></section>
  </>;
}

function CodingPlatformCard({ platform, accent, solved, target, onSolved, onTarget }: { platform: string; accent: "blue" | "gold"; solved: number; target: number; onSolved: (value: number) => void; onTarget: (value: number) => void }) {
  const percentage = Math.min(100, Math.round((solved / Math.max(1, target)) * 100));
  return <div className={`stat-card coding-platform ${accent}`}><div className="platform-head"><span className={`platform-icon ${platform === "LeetCode" ? "leetcode" : "codeforces"}`}>{platform === "LeetCode" ? "LC" : "CF"}</span><p className="eyebrow">{platform}</p></div><strong className="stat-number">{solved}<small> solved</small></strong><div className="coding-progress"><span style={{ width: `${percentage}%` }} /></div><div className="coding-inputs"><label>Solved<input type="number" value={solved} onChange={(event) => onSolved(Number(event.target.value))} /></label><label>Target<input type="number" value={target} onChange={(event) => onTarget(Number(event.target.value))} /></label></div></div>;
}

// ─── Library View ─────────────────────────────────────────────────────
function LibraryView({ books, onAdd, onRemove }: { books: LibraryBook[]; onAdd: () => void; onRemove: (id: string) => void }) {
  return <>
    <section className="hero-row"><div><p className="eyebrow coral">YOUR READING DESK</p><h1>Library</h1><p className="hero-subtitle">Keep every issued book and return date in one calm place.</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> Add issued book</button></section>
    <section className="library-grid">{books.map((book) => <article className="panel book-card" key={book.id}><div className="book-cover"><BookOpen size={22} /></div><div className="book-info"><p className="eyebrow">Issued book</p><h2>{book.title}</h2><p>{book.author}</p><div className="book-dates"><span>Issued <strong>{book.issuedOn}</strong></span><span>Return by <strong>{book.returnBy}</strong></span></div></div><button className="row-menu book-remove" onClick={() => onRemove(book.id)} aria-label={`Remove ${book.title}`}><Trash2 size={15} /></button></article>)}{books.length === 0 && <div className="panel empty-library"><Library size={28} /><strong>No issued books yet</strong><span>Add a book when you borrow it.</span></div>}</section>
  </>;
}

// ─── Attendance View ──────────────────────────────────────────────────
function AttendanceView({ attendance, target, onTargetChange, onImport, subjects, onAddMakeup }: { attendance: AttendanceItem[]; target: number; onTargetChange: (value: number) => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; subjects: Subject[]; onAddMakeup: (subjectCode: string, hours: number) => void }) {
  const [showMakeupForm, setShowMakeupForm] = useState(false);
  const [makeupSubject, setMakeupSubject] = useState("");
  const [makeupHours, setMakeupHours] = useState(1);
  const [makeupTime, setMakeupTime] = useState("09:00 AM");
  const totalPresent = attendance.reduce((sum, item) => sum + item.present + item.makeup, 0);
  const totalClasses = attendance.reduce((sum, item) => sum + item.present + item.absent, 0);
  const overall = totalClasses ? (totalPresent / totalClasses) * 100 : 0;
  const atRisk = attendance.filter((item) => getAttendanceMath(item, target).percentage < target).length;
  const totalMakeup = attendance.reduce((sum, item) => sum + item.makeup, 0);

  const handleAddMakeup = (e: FormEvent) => {
    e.preventDefault();
    if (!makeupSubject || makeupHours < 1) return;
    onAddMakeup(makeupSubject, makeupHours);
    setMakeupSubject(""); setMakeupHours(1); setMakeupTime("09:00 AM"); setShowMakeupForm(false);
  };

  return <>
    <section className="hero-row"><div><p className="eyebrow coral">ATTENDANCE CONTROL CENTRE</p><h1>Attendance</h1><p className="hero-subtitle">Know exactly how many classes to attend—or safely miss.</p></div><div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}><button className="primary-button" onClick={() => setShowMakeupForm(true)}><Plus size={16} /> Add Makeup Class</button><label className="secondary-button file-button"><FileJson size={16} /> Import CSV<input type="file" accept="text/csv,.csv" onChange={onImport} /></label></div></section>
    <section className="attendance-toolbar panel"><div><p className="eyebrow">Your target</p><h2>Maintain at least</h2></div><div className="target-control"><input type="range" min="50" max="100" step="1" value={target} onChange={(event) => onTargetChange(Number(event.target.value))} /><strong>{target}%</strong></div><p className="toolbar-note">Makeup classes add to your attended count without increasing total classes. This boosts your percentage.</p></section>
    <section className="attendance-stats"><div className="stat-card"><p className="eyebrow">Overall attendance</p><strong className="stat-number">{overall.toFixed(1)}<small>%</small></strong><div className="stat-trend neutral">{totalPresent} present of {totalClasses} classes</div></div><div className="stat-card accent-card"><p className="eyebrow">Target percentage</p><strong className="stat-number">{target}<small>%</small></strong><div className="stat-trend">{atRisk} subjects need attention</div></div><div className="stat-card"><p className="eyebrow">Makeup hours</p><strong className="stat-number">{totalMakeup}<small> {totalMakeup === 1 ? "hour" : "hours"}</small></strong><div className="stat-trend neutral">Boosts attendance without adding to total</div></div></section>
    <section className="panel attendance-panel"><SectionTitle eyebrow="Subject-by-subject forecast" title="Your attendance runway" action={<span className="attendance-legend"><i className="legend-good" /> on track <i className="legend-risk" /> action needed</span>} /><div className="attendance-table"><div className="attendance-head"><span>Subject</span><span>Current</span><span>Effective / total</span><span>Makeup</span><span>To reach {target}%</span><span>Can miss</span></div>{attendance.map((item) => { const math = getAttendanceMath(item, target); const good = math.percentage >= target; return <div className="attendance-row" key={item.code}><div className="attendance-subject"><span className={`attendance-status ${good ? "good" : "risk"}`} /><div><strong>{item.name}</strong><small>{item.code} · {item.type} · {item.hoursPresent + item.hoursAbsent} hours</small></div></div><strong className={good ? "attendance-percent good-text" : "attendance-percent risk-text"}>{math.percentage.toFixed(1)}%</strong><span className="attendance-count">{math.effective} / {math.total}</span><span className="attendance-count">{item.makeup > 0 ? <span style={{ color: "#8ea7ff", fontWeight: 600 }}>+{item.makeup}</span> : "—"}</span><span className={`attendance-action ${good ? "good-box" : "risk-box"}`}>{good ? "Already there" : `${math.classesNeeded} more ${math.classesNeeded === 1 ? "class" : "classes"}`}</span><span className="attendance-skip">{good ? `${math.classesCanSkip} ${math.classesCanSkip === 1 ? "class" : "classes"}` : "0 classes"}</span></div>; })}</div></section>
    <section className="attendance-explainer"><div className="smart-panel-icon"><BarChart3 size={20} /></div><div><p className="eyebrow">How makeup classes work</p><h3>Makeup hours boost your numerator without increasing total classes.</h3><p>For example, if you have 15 present out of 21 total (71.4%), adding 3 makeup hours gives you 18/21 = 85.7%. The total stays at 21 because makeup doesn't count as a scheduled class — it only adds to your attended count.</p></div></section>
    {showMakeupForm && <div className="modal-backdrop" onClick={() => setShowMakeupForm(false)}><form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleAddMakeup}><div className="modal-head"><h2>Add Makeup Class</h2><button type="button" className="icon-button" onClick={() => setShowMakeupForm(false)}><X size={18} /></button></div><p style={{ margin: "0 0 18px", color: "#819486", fontSize: "12px", lineHeight: 1.5 }}>Makeup hours add to your attended count <strong>without</strong> increasing the total number of classes. This boosts your attendance percentage.</p><label className="field-label">Subject<select value={makeupSubject} onChange={(e) => setMakeupSubject(e.target.value)} required><option value="">Select a subject</option>{attendance.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</select></label><label className="field-label">Class time<input type="text" value={makeupTime} onChange={(e) => setMakeupTime(e.target.value)} placeholder="e.g. 10:00 AM" /></label><label className="field-label">Number of hours<input type="number" min="1" max="10" value={makeupHours} onChange={(e) => setMakeupHours(Number(e.target.value))} required /><span style={{ marginTop: "4px", color: "#a7afa9", fontSize: "10px" }}>How many hours this makeup class counts for</span></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowMakeupForm(false)}>Cancel</button><button type="submit" className="primary-button"><Plus size={16} /> Add Makeup Hours</button></div></form></div>}
  </>;
}

// ─── Calendar Grid View ──────────────────────────────────────────────
type GoogleCalEvent = { id: string; title: string; start: string; end: string; kind: "google"; allDay: boolean; time?: string };

function CalendarGridView({ month, year, onMonthChange, events, onAddEvent, onRemoveEvent }: {
  month: number; year: number;
  onMonthChange: (month: number, year: number) => void;
  events: CalendarEvent[];
  onAddEvent: (kind: CalendarEvent["kind"], date: string) => void;
  onRemoveEvent: (id: string) => void;
}) {
  const monthLabel = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = lastDay.getDate();
  const todayStr = getTodayString();

  // Google Calendar integration
  const timeMin = `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const timeMax = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01T00:00:00Z`;

  const { data: gcalStatus } = trpc.googleCalendar.connected.useQuery(undefined, { staleTime: 10 * 60 * 1000, retry: false });
  const { data: gcalData } = trpc.googleCalendar.events.useQuery(
    { timeMin, timeMax },
    { enabled: !!gcalStatus?.connected, staleTime: 10 * 60 * 1000, retry: false, refetchOnWindowFocus: false }
  );

  const googleEvents: GoogleCalEvent[] = useMemo(() => gcalData?.events ?? [], [gcalData]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const dateStr = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const localEventsForDate = (d: number) => {
    const ds = dateStr(d);
    return events.filter(e => ds >= e.start && ds <= e.end);
  };
  const googleEventsForDate = (d: number) => {
    const ds = dateStr(d);
    return googleEvents.filter(e => ds >= e.start && ds <= e.end);
  };
  const allEventsForDate = (d: number) => [...localEventsForDate(d), ...googleEventsForDate(d)];

  const prev = () => { if (month === 0) onMonthChange(11, year - 1); else onMonthChange(month - 1, year); };
  const next = () => { if (month === 11) onMonthChange(0, year + 1); else onMonthChange(month + 1, year); };

  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const selectedLocal = selectedDate ? localEventsForDate(selectedDate) : [];
  const selectedGoogle = selectedDate ? googleEventsForDate(selectedDate) : [];
  const selectedStr = selectedDate ? dateStr(selectedDate) : "";

  return <>
    <section className="hero-row"><div><p className="eyebrow coral">PLAN YOUR SEMESTER</p><h1>Calendar</h1><p className="hero-subtitle">See your holidays, exams, and events at a glance.</p></div>
      <div className="hero-actions">
        <button className="secondary-button" onClick={() => onAddEvent("holiday", todayStr)}><Plus size={17} /> Holiday</button>
        <button className="primary-button" onClick={() => onAddEvent("exam", todayStr)}><Plus size={17} /> Exam</button>
      </div>
    </section>

    {gcalStatus && !gcalStatus.connected && <section className="panel smart-panel" style={{ marginBottom: 16 }}>
      <div className="smart-panel-icon"><CalendarDays size={20} /></div>
      <div><p className="eyebrow">Google Calendar</p><h3>Connect your Google Calendar</h3><p>Log out and sign in again to grant calendar access. Your Google events will appear alongside Daymark events.</p></div>
      <button className="secondary-button" onClick={() => window.location.href = "/api/auth/google"}>Re-authorize <ArrowRight size={16} /></button>
    </section>}

    {gcalData?.error && <section className="panel smart-panel" style={{ marginBottom: 16, borderLeft: "3px solid #ef4444" }}>
      <div className="smart-panel-icon" style={{ color: "#ef4444" }}><CalendarDays size={20} /></div>
      <div><p className="eyebrow" style={{ color: "#ef4444" }}>Google Calendar issue</p><p>{gcalData.error}</p></div>
      {gcalData.error.includes("re-login") && <button className="secondary-button" onClick={() => window.location.href = "/api/auth/google"}>Re-authorize <ArrowRight size={16} /></button>}
    </section>}

    <section className="panel calendar-grid-panel">
      <div className="calendar-nav">
        <button className="icon-button" onClick={prev} aria-label="Previous month"><ChevronLeft size={20} /></button>
        <h2>{monthLabel}</h2>
        <button className="icon-button" onClick={next} aria-label="Next month"><ChevronRight size={20} /></button>
      </div>

      <div className="calendar-grid">
        <div className="calendar-header"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        <div className="calendar-body">
          {cells.map((d, i) => {
            if (d === null) return <div className="calendar-cell empty" key={`e-${i}`} />;
            const ds = dateStr(d);
            const allEvents = allEventsForDate(d);
            const isToday = ds === todayStr;
            const isSelected = d === selectedDate;
            return (
              <button className={`calendar-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${allEvents.length ? "has-events" : ""}`} key={d} onClick={() => setSelectedDate(d === selectedDate ? null : d)}>
                <span className="cal-day-num">{d}</span>
                {allEvents.length > 0 && <div className="cal-dots">
                  {allEvents.slice(0, 3).map(e => <span key={e.id} className={`cal-dot ${e.kind}`} />)}
                </div>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="calendar-legend">
        <span><i className="cal-dot holiday" /> Holiday</span>
        <span><i className="cal-dot exam" /> Exam</span>
        <span><i className="cal-dot dayoff" /> Day off</span>
        {gcalStatus?.connected && <span><i className="cal-dot google" /> Google</span>}
      </div>
    </section>

    {selectedDate && <section className="panel calendar-detail-panel">
      <SectionTitle eyebrow={selectedStr} title={new Date(`${selectedStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} action={
        <div className="event-actions">
          <button className="secondary-button" onClick={() => onAddEvent("dayoff", selectedStr)}>Day off</button>
          <button className="secondary-button" onClick={() => onAddEvent("holiday", selectedStr)}>Holiday</button>
          <button className="primary-button" onClick={() => onAddEvent("exam", selectedStr)}>Add exam</button>
        </div>
      } />
      {(selectedLocal.length > 0 || selectedGoogle.length > 0) ? <div className="event-list">
        {selectedLocal.map(e => (
          <div className="event-row" key={e.id}>
            <span className={`event-kind ${e.kind}`}>{e.kind === "exam" ? "EXAM" : e.kind === "holiday" ? "HOLIDAY" : "DAY OFF"}</span>
            <div><strong>{e.title}</strong><small>{e.start}{e.end !== e.start ? ` → ${e.end}` : ""}{e.subject ? ` · ${e.subject}` : ""}</small></div>
            <button className="row-menu" onClick={() => onRemoveEvent(e.id)}><Trash2 size={15} /></button>
          </div>
        ))}
        {selectedGoogle.map(e => (
          <div className="event-row" key={e.id}>
            <span className="event-kind google">GOOGLE</span>
            <div><strong>{e.title}</strong><small>{e.time || "All day"}</small></div>
          </div>
        ))}
      </div> : <div className="class-empty" style={{ padding: "20px 0" }}><CalendarDays size={18} /><span>No events on this date — add one above.</span></div>}
    </section>}

    {events.length > 0 && <section className="panel calendar-events-panel">
      <SectionTitle eyebrow="All events" title="Upcoming events" />
      <div className="event-list">{events.map(e => (
        <div className="event-row" key={e.id}>
          <span className={`event-kind ${e.kind}`}>{e.kind === "exam" ? "EXAM" : e.kind === "holiday" ? "HOLIDAY" : "DAY OFF"}</span>
          <div><strong>{e.title}</strong><small>{e.start}{e.end !== e.start ? ` → ${e.end}` : ""}{e.subject ? ` · ${e.subject}` : ""}</small></div>
          <button className="row-menu" onClick={() => onRemoveEvent(e.id)}><Trash2 size={15} /></button>
        </div>
      ))}</div>
    </section>}
  </>;
}
