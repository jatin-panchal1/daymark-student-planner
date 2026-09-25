import { boolean, date, index, integer, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).default("user").notNull(),
  googleAccessToken: text("googleAccessToken"),
  googleRefreshToken: text("googleRefreshToken"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const subjects = pgTable("subjects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 40 }),
  color: varchar("color", { length: 20 }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("subjects_user_idx").on(table.userId), nameUserUniq: uniqueIndex("subjects_name_user_uniq").on(table.name, table.userId) }));

export const schedules = pgTable("schedule", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  subjectId: integer("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  dayOfWeek: integer("dayOfWeek").notNull(),
  startTime: varchar("startTime", { length: 10 }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({ subjectIdx: index("schedule_subject_idx").on(table.subjectId), userIdx: index("schedule_user_idx").on(table.userId) }));

export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 255 }).notNull(),
  subjectId: integer("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  dueDate: date("dueDate"),
  priority: varchar("priority", { length: 16 }).default("Medium").notNull(),
  recurringDays: varchar("recurringDays", { length: 32 }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("tasks_user_idx").on(table.userId), dueIdx: index("tasks_due_idx").on(table.dueDate) }));

export const libraryBooks = pgTable("libraryBooks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 255 }).notNull(),
  author: varchar("author", { length: 180 }),
  issuedOn: date("issuedOn"),
  returnBy: date("returnBy"),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("library_books_user_idx").on(table.userId) }));

export const calendarEvents = pgTable("calendarEvents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  kind: varchar("kind", { length: 16 }).notNull(), // "holiday" | "dayoff" | "exam"
  title: varchar("title", { length: 255 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate"),
  subject: varchar("subject", { length: 255 }),
  examTime: varchar("examTime", { length: 16 }),
  afterClass: boolean("afterClass").default(false),
  afterSubject: varchar("afterSubject", { length: 255 }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("calendar_events_user_idx").on(table.userId) }));

export const classCheckins = pgTable("classCheckins", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  subjectId: integer("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  checkinDate: date("checkinDate").notNull(),
  status: varchar("status", { length: 16 }).notNull(), // "attended" | "absent"
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("checkins_user_idx").on(table.userId), dateIdx: index("checkins_date_idx").on(table.checkinDate) }));

export const codingSettings = pgTable("codingSettings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  leetcodeUsername: varchar("leetcodeUsername", { length: 100 }),
  codeforcesHandle: varchar("codeforcesHandle", { length: 100 }),
  leetcodeTarget: integer("leetcodeTarget").default(150).notNull(),
  codeforcesTarget: integer("codeforcesTarget").default(200).notNull(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const attendanceRecords = pgTable("attendanceRecords", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  subjectCode: varchar("subjectCode", { length: 40 }).notNull(),
  subjectName: varchar("subjectName", { length: 120 }).notNull(),
  subjectType: varchar("subjectType", { length: 40 }).notNull(),
  present: integer("present").default(0).notNull(),
  absent: integer("absent").default(0).notNull(),
  makeup: integer("makeup").default(0).notNull(),
  hoursPresent: integer("hoursPresent").default(0).notNull(),
  hoursAbsent: integer("hoursAbsent").default(0).notNull(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("attendance_user_idx").on(table.userId), codeUserUniq: uniqueIndex("attendance_code_user_uniq").on(table.subjectCode, table.userId) }));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = typeof subjects.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type LibraryBook = typeof libraryBooks.$inferSelect;
export type InsertLibraryBook = typeof libraryBooks.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;
export type ClassCheckin = typeof classCheckins.$inferSelect;
export type InsertClassCheckin = typeof classCheckins.$inferInsert;
export type CodingSetting = typeof codingSettings.$inferSelect;
export type InsertCodingSetting = typeof codingSettings.$inferInsert;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;
