import { boolean, date, index, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 40 }),
  color: varchar("color", { length: 20 }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("subjects_user_idx").on(table.userId) }));

export const schedules = mysqlTable("schedule", {
  id: int("id").autoincrement().primaryKey(),
  subjectId: int("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  dayOfWeek: int("dayOfWeek").notNull(),
  startTime: varchar("startTime", { length: 10 }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({ subjectIdx: index("schedule_subject_idx").on(table.subjectId), userIdx: index("schedule_user_idx").on(table.userId) }));

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subjectId: int("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  dueDate: date("dueDate"),
  priority: varchar("priority", { length: 16 }).default("Medium").notNull(),
  recurringDays: varchar("recurringDays", { length: 32 }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("tasks_user_idx").on(table.userId), dueIdx: index("tasks_due_idx").on(table.dueDate) }));

export const libraryBooks = mysqlTable("libraryBooks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  author: varchar("author", { length: 180 }),
  issuedOn: date("issuedOn"),
  returnBy: date("returnBy"),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("library_books_user_idx").on(table.userId) }));

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
