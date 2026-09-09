import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Flame,
  FileJson,
  Library,
  LayoutDashboard,
  ListChecks,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DAY_NAMES,
  formatDateLabel,
  getNextScheduledDate,
  isToday,
} from "@/lib/smart-due-date";

  type Subject = {
  id: string;
  name: string;
  code: string;
  color: string;
  days: number[];
  time: string;
  times: Record<number, string>;
};

type Task = {
  id: string;
  title: string;
  subjectId?: string;
  completed: boolean;
  dueDate: string;
  priority: "High" | "Medium" | "Low";
  recurringDays?: number[];
};

type LibraryBook = { id: string; title: string; author: string; issuedOn: string; returnBy: string };
type AttendanceItem = { code: string; name: string; type: string; present: number; absent: number; hoursPresent: number; hoursAbsent: number };
type CalendarEvent = { id: string; kind: "dayoff" | "holiday" | "exam"; title: string; start: string; end: string; subject?: string; examTime?: string; afterClass?: boolean; afterSubject?: string };
type CodingStats = { codeforcesSolved: number; codeforcesTarget: number; leetcodeSolved: number; leetcodeTarget: number; streak: number; recent: { platform: "Codeforces" | "LeetCode"; title: string; date: string }[] };

const colors = ["#f28b63", "#8ea7ff", "#69c2a3", "#d4a44d", "#b799e8"];

const initialSubjects: Subject[] = [
  { id: "math", name: "Mathematics", code: "MATH 204", color: colors[0], days: [1, 3], time: "09:00 AM", times: { 1: "09:00 AM", 3: "10:30 AM" } },
  { id: "physics", name: "Physics", code: "PHYS 112", color: colors[1], days: [2, 4], time: "11:30 AM", times: { 2: "11:30 AM", 4: "01:00 PM" } },
  { id: "history", name: "World History", code: "HIST 108", color: colors[2], days: [1, 5], time: "02:00 PM", times: { 1: "02:00 PM", 5: "02:00 PM" } },
  { id: "design", name: "Design Studio", code: "DSGN 301", color: colors[3], days: [3], time: "04:30 PM", times: { 3: "04:30 PM" } },
];

const initialTasks: Task[] = [
  { id: "t1", title: "Complete integration practice set", subjectId: "math", completed: false, dueDate: "2026-09-09", priority: "High" },
  { id: "t2", title: "Review lecture notes · Chapter 4", subjectId: "physics", completed: false, dueDate: "2026-09-09", priority: "Medium" },
  { id: "t3", title: "Outline essay: Cities & memory", subjectId: "history", completed: true, dueDate: "2026-09-09", priority: "Medium" },
  { id: "t4", title: "Read pages 142–168", subjectId: "math", completed: true, dueDate: "2026-09-09", priority: "Low" },
  { id: "t5", title: "Prepare lab questions", subjectId: "physics", completed: false, dueDate: "2026-09-10", priority: "Low" },
  { id: "t6", title: "Moodboard for final project", subjectId: "design", completed: false, dueDate: "2026-09-11", priority: "Medium" },
  { id: "t7", title: "15-minute vocabulary review", completed: false, dueDate: "2026-09-09", priority: "Low", recurringDays: [1, 2, 3, 4, 5, 6] },
];

const initialAttendance: AttendanceItem[] = [
  { code: "CAUP320", name: "Data Structures and Algorithms Lab", type: "Lab", present: 14, absent: 1, hoursPresent: 28, hoursAbsent: 2 },
  { code: "MAUL301", name: "Statistics and Probability Theory", type: "Lecture", present: 15, absent: 6, hoursPresent: 15, hoursAbsent: 6 },
  { code: "NU99.4", name: "Technical Training", type: "Lab", present: 6, absent: 1, hoursPresent: 6, hoursAbsent: 1 },
  { code: "CAUL304", name: "Digital Electronics", type: "Lecture", present: 20, absent: 3, hoursPresent: 20, hoursAbsent: 3 },
  { code: "CAUL303", name: "Software Engineering and Project Management", type: "Lecture", present: 19, absent: 2, hoursPresent: 19, hoursAbsent: 2 },
  { code: "CAUP322", name: "Logic Programming Lab", type: "Lab", present: 7, absent: 1, hoursPresent: 21, hoursAbsent: 3 },
  { code: "CAUL301", name: "Data Structures and Algorithms", type: "Lecture", present: 21, absent: 2, hoursPresent: 21, hoursAbsent: 2 },
  { code: "CAUL302", name: "Foundation of Artificial Intelligence", type: "Lecture", present: 24, absent: 1, hoursPresent: 24, hoursAbsent: 1 },
  { code: "CAUP321", name: "Programming in Java Lab", type: "Lab", present: 14, absent: 0, hoursPresent: 28, hoursAbsent: 0 },
  { code: "CAUP323", name: "Digital Electronics Lab", type: "Lab", present: 6, absent: 2, hoursPresent: 18, hoursAbsent: 6 },
  { code: "CAUT330", name: "Industrial Training", type: "Lab", present: 7, absent: 1, hoursPresent: 7, hoursAbsent: 1 },
  { code: "HSUL302", name: "Technical Communication", type: "Lecture", present: 6, absent: 1, hoursPresent: 6, hoursAbsent: 1 },
];

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
  const codeIndex = indexOf("subject code"); const nameIndex = indexOf("subject"); const typeIndex = indexOf("subject type"); const hoursIndex = indexOf("number of hours"); const markedIndex = indexOf("marked");
  if ([codeIndex, nameIndex, typeIndex, hoursIndex, markedIndex].some((index) => index < 0)) throw new Error("CSV must include Subject Code, Subject, Subject Type, Number of Hours, and Marked columns.");
  const grouped = new Map<string, AttendanceItem>();
  lines.slice(1).forEach((line) => { const cells = parseCsvLine(line); const code = cells[codeIndex]; if (!code) return; const item = grouped.get(code) || { code, name: cells[nameIndex], type: cells[typeIndex], present: 0, absent: 0, hoursPresent: 0, hoursAbsent: 0 }; const hours = Number(cells[hoursIndex]) || 1; const present = cells[markedIndex].toUpperCase().startsWith("P"); if (present) { item.present += 1; item.hoursPresent += hours; } else { item.absent += 1; item.hoursAbsent += hours; } grouped.set(code, item); });
  return Array.from(grouped.values());
}

function getAttendanceMath(item: AttendanceItem, target: number) {
  const total = item.present + item.absent; const percentage = total ? (item.present / total) * 100 : 0;
  const classesNeeded = percentage >= target ? 0 : Math.ceil((target * total - 100 * item.present) / (100 - target));
  const classesCanSkip = percentage < target ? 0 : Math.max(0, Math.floor((100 * item.present / target) - total));
  return { total, percentage, classesNeeded, classesCanSkip };
}

const initialCalendarEvents: CalendarEvent[] = [
  { id: "holiday-1", kind: "holiday", title: "University Foundation Day", start: "2026-09-18", end: "2026-09-18" },
  { id: "exam-1", kind: "exam", title: "Digital Electronics Midterm", start: "2026-09-21", end: "2026-09-21", subject: "Digital Electronics", examTime: "09:00 AM", afterClass: true, afterSubject: "Data Structures and Algorithms" },
];

const weekDays = [
  { label: "Mon", date: 7, full: "Monday", dow: 1 },
  { label: "Tue", date: 8, full: "Tuesday", dow: 2 },
  { label: "Wed", date: 9, full: "Wednesday", dow: 3 },
  { label: "Thu", date: 10, full: "Thursday", dow: 4 },
  { label: "Fri", date: 11, full: "Friday", dow: 5 },
  { label: "Sat", date: 12, full: "Saturday", dow: 6 },
];

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

function ProgressRing({ value }: { value: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (value / 100) * circumference;

  return (
    <div className="progress-ring" aria-label={`${value}% of tasks completed`}>
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle className="ring-track" cx="56" cy="56" r={radius} />
        <circle
          className="ring-value"
          cx="56"
          cy="56"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dash}
        />
      </svg>
      <div className="ring-label">
        <strong>{value}%</strong>
        <span>complete</span>
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedDay, setSelectedDay] = useState(9);
  const [activeView, setActiveView] = useState<"today" | "planner" | "library" | "attendance" | "coding">("today");
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
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([
    { id: "book-1", title: "The Design of Everyday Things", author: "Don Norman", issuedOn: "Sep 02, 2026", returnBy: "Sep 23, 2026" },
    { id: "book-2", title: "A Brief History of Time", author: "Stephen Hawking", issuedOn: "Sep 05, 2026", returnBy: "Sep 26, 2026" },
  ]);
  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookReturnBy, setBookReturnBy] = useState("");
  const [attendance, setAttendance] = useState<AttendanceItem[]>(initialAttendance);
  const [attendanceTarget, setAttendanceTarget] = useState(75);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(initialCalendarEvents);
  const [classCheckins, setClassCheckins] = useState<Record<string, boolean>>({});
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventKind, setEventKind] = useState<CalendarEvent["kind"]>("holiday");
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventSubject, setEventSubject] = useState("");
  const [eventTime, setEventTime] = useState("09:00 AM");
  const [afterExamClass, setAfterExamClass] = useState(false);
  const [afterExamSubject, setAfterExamSubject] = useState("");
  const [codingStats, setCodingStats] = useState<CodingStats>({ codeforcesSolved: 128, codeforcesTarget: 200, leetcodeSolved: 86, leetcodeTarget: 150, streak: 12, recent: [{ platform: "LeetCode", title: "Valid Parentheses", date: "Sep 08" }, { platform: "Codeforces", title: "Array and Operations", date: "Sep 07" }] });

  const completedCount = tasks.filter((task) => task.completed && task.dueDate === "2026-09-09").length;
  const selectedWeekDay = weekDays.find((day) => day.date === selectedDay)?.dow || 3;
  const todaysTasks = tasks.filter((task) => task.dueDate === `2026-09-${String(selectedDay).padStart(2, "0")}` || task.recurringDays?.includes(selectedWeekDay));
  const progress = todaysTasks.length ? Math.round((completedCount / todaysTasks.length) * 100) : 0;
  const openCount = todaysTasks.length - completedCount;
  const greeting = "Good morning, Alex";
  const selectedDateLabel = selectedDay === 9 ? "Today, September 9" : `${weekDays.find((day) => day.date === selectedDay)?.full}, September ${selectedDay}`;

  const upcomingTasks = useMemo(() => tasks.filter((task) => !task.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [tasks]);

  const subjectById = (id?: string) => subjects.find((subject) => subject.id === id);
  const selectedDate = `2026-09-${String(selectedDay).padStart(2, "0")}`;
  const todaysClasses = calendarEvents.some((event) => (event.kind === "dayoff" || event.kind === "holiday") && event.start <= selectedDate && event.end >= selectedDate) ? [] : subjects.filter((subject) => subject.days.includes(selectedWeekDay)).map((subject) => ({ subject, time: subject.times[selectedWeekDay] || subject.time }));

  const toggleTask = (id: string) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
  };

  const addTask = (event: FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    const subject = subjectById(taskSubject);
    const smartDate = !taskDate && subject ? getNextScheduledDate(new Date("2026-09-09T09:00:00"), subject.days) : null;
    const nextTask: Task = {
      id: `task-${Date.now()}`,
      title: taskTitle.trim(),
      subjectId: taskSubject || undefined,
      completed: false,
      dueDate: taskDate || smartDate || "2026-09-09",
      priority: taskPriority,
      recurringDays: isDailyTask ? taskDays : undefined,
    };
    setTasks((current) => [nextTask, ...current]);
    setTaskTitle("");
    setTaskSubject("");
    setTaskDate("");
    setTaskPriority("Medium");
    setIsDailyTask(false);
    setTaskDays([1, 2, 3, 4, 5, 6]);
    setShowTaskForm(false);
    toast.success(taskDate ? "Task added with your due date" : subject ? `Task added · due ${formatDateLabel(nextTask.dueDate)}` : "Task added to your day");
  };

  const addSubject = (event: FormEvent) => {
    event.preventDefault();
    if (!subjectName.trim() || subjectDays.length === 0) return;
    const subject: Subject = {
      id: `subject-${Date.now()}`,
      name: subjectName.trim(),
      code: "NEW 101",
      color: colors[subjects.length % colors.length],
      days: subjectDays,
      time: subjectTime,
      times: Object.fromEntries(subjectDays.map((day) => [day, subjectTime])),
    };
    setSubjects((current) => [...current, subject]);
    setSubjectName("");
    setSubjectDays([1, 3]);
    setShowSubjectForm(false);
    toast.success(`${subject.name} added to your timetable`);
  };

  const toggleSubjectDay = (day: number) => {
    setSubjectDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  };

  const toggleTaskDay = (day: number) => setTaskDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());

  const importPlannerFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parsePlannerJson(JSON.parse(await file.text()), subjects.length);
      setSubjects(imported);
      toast.success(`${imported.length} subjects imported from JSON`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that planner JSON");
    }
    event.target.value = "";
  };

  const addBook = (event: FormEvent) => {
    event.preventDefault();
    if (!bookTitle.trim()) return;
    setLibraryBooks((current) => [{ id: `book-${Date.now()}`, title: bookTitle.trim(), author: bookAuthor.trim() || "Unknown author", issuedOn: "Sep 09, 2026", returnBy: bookReturnBy ? formatDateLabel(bookReturnBy) : "Not set", }, ...current]);
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
    setCalendarEvents((current) => [...current, { id: `event-${Date.now()}`, kind: eventKind, title: eventTitle.trim(), start: eventStart, end: eventEnd || eventStart, subject: eventKind === "exam" ? eventSubject.trim() || "Custom subject" : undefined, examTime: eventKind === "exam" ? eventTime : undefined, afterClass: eventKind === "exam" ? afterExamClass : undefined, afterSubject: eventKind === "exam" ? afterExamSubject : undefined }]);
    setEventTitle(""); setEventStart(""); setEventEnd(""); setEventSubject(""); setAfterExamClass(false); setAfterExamSubject(""); setShowEventForm(false); toast.success(`${eventKind === "dayoff" ? "Day off" : eventKind === "holiday" ? "Holiday" : "Exam"} added to planner`);
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
          <button className="nav-item" onClick={() => toast.info("Focus mode is ready for your next study block.")}><Timer size={18} /> Focus mode</button>
        </nav>
        <div className="sidebar-label subject-label">Your subjects <button aria-label="Add subject" onClick={() => setShowSubjectForm(true)}><Plus size={15} /></button></div>
        <div className="subject-list">
          {subjects.map((subject) => <button className="subject-nav" key={subject.id} onClick={() => { setActiveView("planner"); toast.info(`${subject.name} · ${subject.days.map((day) => DAY_NAMES[day].slice(0, 3)).join(" + ")}`); }}><span className="subject-dot" style={{ background: subject.color }} />{subject.name}<span className="subject-chevron">›</span></button>)}
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => toast.info("Settings are coming soon.")}><Settings2 size={18} /> Settings</button>
          <div className="profile-card"><div className="avatar">AS</div><div><strong>Alex Smith</strong><span>Personal workspace</span></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{activeView === "today" ? "Today" : activeView === "planner" ? "Planner" : activeView === "library" ? "Library" : activeView === "attendance" ? "Attendance" : "Coding journey"}</strong></div>
          <div className="topbar-actions"><button className="icon-button" aria-label="Search" onClick={() => toast.info("Search across your tasks is coming soon.")}><Search size={18} /></button><button className="help-button" onClick={() => toast.info("Tip: leave a due date blank to let Daymark find the next class day.")}><CircleHelp size={17} /> Help</button><div className="mini-avatar">AS</div></div>
        </header>

        <div className="content-wrap">
          {activeView === "today" ? <>
            <section className="hero-row">
              <div><p className="eyebrow coral">WEDNESDAY · SEPTEMBER 09, 2026</p><h1>{greeting}</h1><p className="hero-subtitle">A clear day starts with one small step.</p></div>
              <button className="primary-button" onClick={() => setShowTaskForm(true)}><Plus size={18} /> Add task <span className="shortcut">⌘ K</span></button>
            </section>

            <section className="week-strip" aria-label="Select a day">
              <div className="week-month"><span>September</span><strong>2026</strong></div>
              <div className="week-days">{weekDays.map((day) => <button key={day.date} className={`day-pill ${selectedDay === day.date ? "selected" : ""}`} onClick={() => setSelectedDay(day.date)}><span>{day.label}</span><strong>{day.date}</strong>{day.date === 9 && <i />}</button>)}</div>
              <button className="calendar-button" onClick={() => toast.info("Calendar view is coming soon.")}><CalendarDays size={18} /></button>
            </section>

            <section className="panel classes-today-panel"><SectionTitle eyebrow="Class check-in" title={selectedDay === 9 ? "Classes today" : `Classes on ${weekDays.find((day) => day.date === selectedDay)?.full}`} action={<span className="class-check-note">Mark attendance yourself</span>} /><div className="classes-today-list">{todaysClasses.length ? todaysClasses.map(({ subject, time }) => { const key = `${subject.id}-${selectedDay}`; const checked = classCheckins[key]; return <div className={`class-today-row ${checked ? "class-attended" : ""}`} key={key}><span className="subject-dot" style={{ background: subject.color }} /><div className="class-today-main"><strong>{subject.name}</strong><span>{subject.code} · {time}</span></div><button className={`class-check-button ${checked ? "checked" : ""}`} onClick={() => setClassCheckins((current) => ({ ...current, [key]: !current[key] }))}>{checked ? <Check size={14} /> : ""}<span>{checked ? "Attended" : "Mark attended"}</span></button></div>; }) : <div className="class-empty"><CalendarDays size={18} /><span>No classes scheduled — add a holiday or day off in Planner.</span></div>}</div></section>

            <section className="stats-grid">
              <div className="stat-card progress-card"><div><p className="eyebrow">Daily progress</p><h3>{progress === 100 ? "Day complete" : `${openCount} tasks to go`}</h3><p className="muted">Keep your momentum going.</p></div><ProgressRing value={progress} /></div>
              <div className="stat-card accent-card"><div className="stat-icon"><Flame size={19} /></div><p className="eyebrow">Current streak</p><strong className="stat-number">6 <small>days</small></strong><div className="stat-trend"><TrendingUp size={14} /> +2 from last week</div></div>
              <div className="stat-card"><div className="stat-icon lavender"><Target size={19} /></div><p className="eyebrow">Weekly focus</p><strong className="stat-number">12.5 <small>hrs</small></strong><div className="stat-trend neutral"><Clock3 size={14} /> 3.5 hrs remaining</div></div>
            </section>

            <div className="dashboard-grid">
              <section className="panel tasks-panel">
                <SectionTitle eyebrow={selectedDay === 9 ? "Your focus list" : "Selected day"} title={selectedDateLabel} action={<button className="text-button" onClick={() => setShowTaskForm(true)}>Add task <ArrowRight size={15} /></button>} />
                <div className="task-list">
                  {todaysTasks.map((task, index) => { const subject = subjectById(task.subjectId); return <div className={`task-row ${task.completed ? "task-done" : ""}`} key={task.id} style={{ animationDelay: `${index * 40}ms` }}><button className={`task-checkbox ${task.completed ? "checked" : ""}`} onClick={() => toggleTask(task.id)} aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}>{task.completed && <Check size={14} />}</button><div className="task-main"><strong>{task.title}</strong><div className="task-meta">{subject && <span className="subject-tag"><span className="subject-dot" style={{ background: subject.color }} />{subject.name}</span>}<span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></div></div><span className="task-time">{task.completed ? "Done" : task.dueDate === "2026-09-09" ? "Today" : formatDateLabel(task.dueDate)}</span><button className="row-menu" aria-label="More actions" onClick={() => { setTasks((current) => current.filter((item) => item.id !== task.id)); toast.success("Task removed"); }}><Trash2 size={15} /></button></div>; })}
                  {todaysTasks.length === 0 && <div className="empty-state"><ListChecks size={26} /><strong>No tasks here yet</strong><span>Add a task to shape your day.</span></div>}
                </div>
                <div className="list-footer"><span><Check size={15} /> {completedCount} of {todaysTasks.length} completed</span><button onClick={() => setTasks((current) => current.filter((task) => task.dueDate !== "2026-09-09" || !task.completed))}>Clear completed</button></div>
              </section>

              <aside className="right-column">
                <section className="panel next-panel"><SectionTitle eyebrow="Up next" title="Coming up" action={<button className="dots-button" onClick={() => toast.info("You are all caught up for today.")}><MoreHorizontal size={18} /></button>} /><div className="upcoming-list">{upcomingTasks.slice(0, 3).map((task) => { const subject = subjectById(task.subjectId); return <button className="upcoming-row" key={task.id} onClick={() => toast.info(`${task.title} · due ${formatDateLabel(task.dueDate)}`)}><span className="upcoming-date">{formatDateLabel(task.dueDate).split(" ")[0]}<strong>{formatDateLabel(task.dueDate).split(" ")[1]}</strong></span><span className="upcoming-detail"><strong>{task.title}</strong><span>{subject?.name || "Personal"}</span></span><ChevronDown size={15} className="chevron-right" /></button>; })}</div><button className="view-all" onClick={() => setActiveView("planner")}>View planner <ArrowRight size={15} /></button></section>
                <section className="panel quote-panel"><div className="quote-mark">“</div><p>Consistency is not about perfection. It’s about returning to what matters.</p><span>— your future self</span></section>
              </aside>
            </div>
          </> : activeView === "planner" ? <PlannerView subjects={subjects} tasks={tasks} onAddSubject={() => setShowSubjectForm(true)} onAddTask={() => setShowTaskForm(true)} onImport={importPlannerFile} onDeleteSubject={(id) => { setSubjects((current) => current.filter((subject) => subject.id !== id)); toast.success("Subject removed"); }} events={calendarEvents} onAddEvent={(kind) => { setEventKind(kind); setShowEventForm(true); }} onRemoveEvent={(id) => setCalendarEvents((current) => current.filter((item) => item.id !== id))} /> : activeView === "library" ? <LibraryView books={libraryBooks} onAdd={() => setShowLibraryForm(true)} onRemove={(id) => { setLibraryBooks((current) => current.filter((book) => book.id !== id)); toast.success("Book removed"); }} /> : activeView === "attendance" ? <AttendanceView attendance={attendance} target={attendanceTarget} onTargetChange={setAttendanceTarget} onImport={importAttendanceCsv} /> : <CodingView stats={codingStats} onChange={setCodingStats} />}
        </div>
      </main>

      {showTaskForm && <div className="modal-backdrop" onMouseDown={() => setShowTaskForm(false)}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">New entry</p><h2>Add a task</h2></div><button className="close-button" onClick={() => setShowTaskForm(false)}><X size={19} /></button></div><form onSubmit={addTask}><label>What needs your attention?<input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Finish chemistry worksheet" /></label><div className="form-grid"><label>Subject<select value={taskSubject} onChange={(event) => setTaskSubject(event.target.value)}><option value="">No subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>Priority<select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as Task["priority"])}><option>High</option><option>Medium</option><option>Low</option></select></label></div><label>Due date <span className="optional">optional</span><input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} /></label><label className="recurring-toggle"><input type="checkbox" checked={isDailyTask} onChange={(event) => setIsDailyTask(event.target.checked)} /><span>Make this a daily task</span></label>{isDailyTask && <div className="recurring-days"><span className="optional">Repeat on</span><div className="day-selector">{weekDays.map((day) => <button type="button" key={day.label} className={taskDays.includes(day.dow) ? "day-select selected" : "day-select"} onClick={() => toggleTaskDay(day.dow)}>{day.label}</button>)}</div></div>}{taskSubject && !taskDate && <div className="smart-note"><Sparkles size={15} /><span>Smart date will use the next {subjectById(taskSubject)?.name} class: <strong>{formatDateLabel(getNextScheduledDate(new Date("2026-09-09T09:00:00"), subjectById(taskSubject)?.days || []))}</strong></span></div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowTaskForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!taskTitle.trim()}>Create task <ArrowRight size={16} /></button></div></form></div></div>}

      {showLibraryForm && <div className="modal-backdrop" onMouseDown={() => setShowLibraryForm(false)}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">Library desk</p><h2>Add issued book</h2></div><button className="close-button" onClick={() => setShowLibraryForm(false)}><X size={19} /></button></div><form onSubmit={addBook}><label>Book title<input autoFocus value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} placeholder="e.g. The Design of Everyday Things" /></label><label>Author<input value={bookAuthor} onChange={(event) => setBookAuthor(event.target.value)} placeholder="e.g. Don Norman" /></label><label>Return by <span className="optional">optional</span><input type="date" value={bookReturnBy} onChange={(event) => setBookReturnBy(event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowLibraryForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!bookTitle.trim()}>Add book <ArrowRight size={16} /></button></div></form></div></div>}

      {showEventForm && <div className="modal-backdrop" onMouseDown={() => setShowEventForm(false)}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">Planner calendar</p><h2>Add {eventKind === "dayoff" ? "a day off" : eventKind === "holiday" ? "a holiday" : "an exam"}</h2></div><button className="close-button" onClick={() => setShowEventForm(false)}><X size={19} /></button></div><form onSubmit={addCalendarEvent}><label>Title<input autoFocus value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder={eventKind === "exam" ? "e.g. Digital Electronics Midterm" : "e.g. Diwali break"} /></label><div className="form-grid"><label>Starts<input type="date" value={eventStart} onChange={(event) => setEventStart(event.target.value)} /></label><label>Ends <span className="optional">for multi-day holidays</span><input type="date" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} /></label></div>{eventKind === "exam" && <><label>Exam subject <span className="optional">or type a custom subject</span><input value={eventSubject} onChange={(event) => setEventSubject(event.target.value)} placeholder="e.g. Advanced Algorithms" /></label><label>Exam time<input value={eventTime} onChange={(event) => setEventTime(event.target.value)} /></label><label className="recurring-toggle"><input type="checkbox" checked={afterExamClass} onChange={(event) => setAfterExamClass(event.target.checked)} /><span>Classes continue after the exam</span></label>{afterExamClass && <label>After-exam class subject<input value={afterExamSubject} onChange={(event) => setAfterExamSubject(event.target.value)} placeholder="e.g. Data Structures and Algorithms" /></label>}</>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowEventForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!eventTitle.trim() || !eventStart}>Add to planner <ArrowRight size={16} /></button></div></form></div></div>}

      {showSubjectForm && <div className="modal-backdrop" onMouseDown={() => setShowSubjectForm(false)}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow coral">Build your week</p><h2>Add a subject</h2></div><button className="close-button" onClick={() => setShowSubjectForm(false)}><X size={19} /></button></div><form onSubmit={addSubject}><label>Subject name<input autoFocus value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="e.g. Creative Writing" /></label><label>Meets on</label><div className="day-selector">{weekDays.slice(0, 5).map((day, index) => <button type="button" key={day.label} className={subjectDays.includes(index + 1) ? "day-select selected" : "day-select"} onClick={() => toggleSubjectDay(index + 1)}>{day.label}</button>)}</div><label>Class time<input type="time" value={subjectTime.replace(" AM", "").replace(" PM", "")} onChange={(event) => setSubjectTime(event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowSubjectForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!subjectName.trim() || subjectDays.length === 0}>Add subject <ArrowRight size={16} /></button></div></form></div></div>}
    </div>
  );
}

function PlannerView({ subjects, tasks, onAddSubject, onAddTask, onImport, onDeleteSubject, events, onAddEvent, onRemoveEvent }: { subjects: Subject[]; tasks: Task[]; onAddSubject: () => void; onAddTask: () => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; onDeleteSubject: (id: string) => void; events: CalendarEvent[]; onAddEvent: (kind: CalendarEvent["kind"]) => void; onRemoveEvent: (id: string) => void }) {
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
                {weekDays.map((day) => (
                  <div className={subject.days.includes(day.dow) ? "schedule-cell active" : "schedule-cell"} key={day.label}>{subject.days.includes(day.dow) && <span style={{ background: subject.color }}><small>{subject.times[day.dow] || subject.time}</small></span>}</div>
                ))}
                <button className="schedule-delete" onClick={() => onDeleteSubject(subject.id)} aria-label={`Remove ${subject.name}`}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel planner-summary">
          <SectionTitle eyebrow="This week" title="Task load" />
          <div className="load-number"><strong>{tasks.filter((task) => !task.completed).length}</strong><span>open tasks</span></div>
          <div className="load-bars">{weekDays.map((day) => { const count = tasks.filter((task) => Number(task.dueDate.slice(-2)) === day.date).length; return <div className="load-bar" key={day.date}><div className="bar-track"><span style={{ height: `${Math.max(14, Math.min(100, count * 28))}%` }} /></div><small>{day.label}</small></div>; })}</div>
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
      <section className="panel calendar-events-panel"><SectionTitle eyebrow="Calendar exceptions" title="Days off, holidays & exams" action={<div className="event-actions"><button className="secondary-button" onClick={() => onAddEvent("dayoff")}>Day off</button><button className="secondary-button" onClick={() => onAddEvent("holiday")}>Holiday</button><button className="primary-button" onClick={() => onAddEvent("exam")}>Add exam</button></div>} /><div className="event-list">{events.map((event) => <div className="event-row" key={event.id}><span className={`event-kind ${event.kind}`}>{event.kind === "exam" ? "EXAM" : event.kind === "holiday" ? "HOLIDAY" : "DAY OFF"}</span><div><strong>{event.title}</strong><small>{event.start}{event.end !== event.start ? ` → ${event.end}` : ""}{event.subject ? ` · ${event.subject}` : ""}{event.afterClass ? ` · after exam: ${event.afterSubject || "class"}` : ""}</small></div><button className="row-menu" onClick={() => onRemoveEvent(event.id)}><Trash2 size={15} /></button></div>)}</div></section>
    </>
  );
}

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

function LibraryView({ books, onAdd, onRemove }: { books: LibraryBook[]; onAdd: () => void; onRemove: (id: string) => void }) {
  return <>
    <section className="hero-row"><div><p className="eyebrow coral">YOUR READING DESK</p><h1>Library</h1><p className="hero-subtitle">Keep every issued book and return date in one calm place.</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> Add issued book</button></section>
    <section className="library-grid">{books.map((book) => <article className="panel book-card" key={book.id}><div className="book-cover"><BookOpen size={22} /></div><div className="book-info"><p className="eyebrow">Issued book</p><h2>{book.title}</h2><p>{book.author}</p><div className="book-dates"><span>Issued <strong>{book.issuedOn}</strong></span><span>Return by <strong>{book.returnBy}</strong></span></div></div><button className="row-menu book-remove" onClick={() => onRemove(book.id)} aria-label={`Remove ${book.title}`}><Trash2 size={15} /></button></article>)}{books.length === 0 && <div className="panel empty-library"><Library size={28} /><strong>No issued books yet</strong><span>Add a book when you borrow it.</span></div>}</section>
  </>;
}

function AttendanceView({ attendance, target, onTargetChange, onImport }: { attendance: AttendanceItem[]; target: number; onTargetChange: (value: number) => void; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  const totalPresent = attendance.reduce((sum, item) => sum + item.present, 0);
  const totalClasses = attendance.reduce((sum, item) => sum + item.present + item.absent, 0);
  const overall = totalClasses ? (totalPresent / totalClasses) * 100 : 0;
  const atRisk = attendance.filter((item) => getAttendanceMath(item, target).percentage < target).length;
  return <>
    <section className="hero-row"><div><p className="eyebrow coral">ATTENDANCE CONTROL CENTRE</p><h1>Attendance</h1><p className="hero-subtitle">Know exactly how many classes to attend—or safely miss.</p></div><label className="secondary-button file-button"><FileJson size={16} /> Import Attendance CSV<input type="file" accept="text/csv,.csv" onChange={onImport} /></label></section>
    <section className="attendance-toolbar panel"><div><p className="eyebrow">Your target</p><h2>Maintain at least</h2></div><div className="target-control"><input type="range" min="50" max="100" step="1" value={target} onChange={(event) => onTargetChange(Number(event.target.value))} /><strong>{target}%</strong></div><p className="toolbar-note">Calculations use class sessions from your CSV. Lab hours remain visible in each subject row.</p></section>
    <section className="attendance-stats"><div className="stat-card"><p className="eyebrow">Overall attendance</p><strong className="stat-number">{overall.toFixed(1)}<small>%</small></strong><div className="stat-trend neutral">{totalPresent} present of {totalClasses} classes</div></div><div className="stat-card accent-card"><p className="eyebrow">Target percentage</p><strong className="stat-number">{target}<small>%</small></strong><div className="stat-trend">{atRisk} subjects need attention</div></div><div className="stat-card"><p className="eyebrow">Imported records</p><strong className="stat-number">{totalClasses}<small> classes</small></strong><div className="stat-trend neutral">{attendance.length} subjects from report</div></div></section>
    <section className="panel attendance-panel"><SectionTitle eyebrow="Subject-by-subject forecast" title="Your attendance runway" action={<span className="attendance-legend"><i className="legend-good" /> on track <i className="legend-risk" /> action needed</span>} /><div className="attendance-table"><div className="attendance-head"><span>Subject</span><span>Current</span><span>Present / total</span><span>To reach {target}%</span><span>Can miss</span></div>{attendance.map((item) => { const math = getAttendanceMath(item, target); const good = math.percentage >= target; return <div className="attendance-row" key={item.code}><div className="attendance-subject"><span className={`attendance-status ${good ? "good" : "risk"}`} /><div><strong>{item.name}</strong><small>{item.code} · {item.type} · {item.hoursPresent + item.hoursAbsent} hours</small></div></div><strong className={good ? "attendance-percent good-text" : "attendance-percent risk-text"}>{math.percentage.toFixed(1)}%</strong><span className="attendance-count">{item.present} / {math.total}</span><span className={`attendance-action ${good ? "good-box" : "risk-box"}`}>{good ? "Already there" : `${math.classesNeeded} more ${math.classesNeeded === 1 ? "class" : "classes"}`}</span><span className="attendance-skip">{good ? `${math.classesCanSkip} ${math.classesCanSkip === 1 ? "class" : "classes"}` : "0 classes"}</span></div>; })}</div></section>
    <section className="attendance-explainer"><div className="smart-panel-icon"><BarChart3 size={20} /></div><div><p className="eyebrow">How to read this</p><h3>Attend every “more classes” number before taking a break.</h3><p>For example, at a 75% target, 15 present out of 21 classes means you need to attend the next 3 classes to reach 75%. Once you are on track, “Can miss” shows the maximum future absences before falling below your target.</p></div></section>
  </>;
}
