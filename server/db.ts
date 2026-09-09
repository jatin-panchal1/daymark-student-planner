import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertSubject, InsertSchedule, InsertTask, InsertCalendarEvent, InsertClassCheckin, InsertCodingSetting, InsertUser,
  calendarEvents, classCheckins, codingSettings, schedules, subjects, tasks, users
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL);
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ──────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (['name', 'email', 'loginMethod', 'avatarUrl'] as const).forEach((field) => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  updateSet.updatedAt = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ──────────────────────────────────────────────
// Subjects
// ──────────────────────────────────────────────

export async function listSubjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(asc(subjects.name));
}

export async function createSubject(data: InsertSubject) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(subjects).values(data).returning({ id: subjects.id });
  return result[0].id;
}

export async function deleteSubject(subjectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
}

// ──────────────────────────────────────────────
// Schedules
// ──────────────────────────────────────────────

export async function listSchedules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schedules).where(eq(schedules.userId, userId)).orderBy(asc(schedules.dayOfWeek));
}

export async function createSchedules(data: InsertSchedule[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (data.length === 0) return;
  await db.insert(schedules).values(data);
}

// ──────────────────────────────────────────────
// Tasks
// ──────────────────────────────────────────────

export async function listTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.isCompleted), asc(tasks.dueDate), desc(tasks.createdAt));
}

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(tasks).values(data).returning({ id: tasks.id });
  return result[0].id;
}

export async function updateTask(taskId: number, userId: number, isCompleted: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(tasks).set({ isCompleted }).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

export async function deleteTask(taskId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

// ──────────────────────────────────────────────
// Calendar Events
// ──────────────────────────────────────────────

export async function listCalendarEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(calendarEvents).where(eq(calendarEvents.userId, userId)).orderBy(asc(calendarEvents.startDate));
}

export async function createCalendarEvent(data: InsertCalendarEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(calendarEvents).values(data).returning({ id: calendarEvents.id });
  return result[0].id;
}

export async function bulkCreateCalendarEvents(data: InsertCalendarEvent[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (data.length === 0) return [];
  const result = await db.insert(calendarEvents).values(data).returning({ id: calendarEvents.id });
  return result.map(r => r.id);
}

export async function deleteCalendarEvent(eventId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(calendarEvents).where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));
}

// ──────────────────────────────────────────────
// Class Check-ins
// ──────────────────────────────────────────────

export async function listCheckins(userId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(classCheckins).where(and(eq(classCheckins.userId, userId), eq(classCheckins.checkinDate, date)));
}

export async function upsertCheckin(data: InsertClassCheckin) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  // Check if a checkin already exists for this subject + date + user
  const existing = await db.select().from(classCheckins).where(
    and(
      eq(classCheckins.subjectId, data.subjectId),
      eq(classCheckins.checkinDate, data.checkinDate),
      eq(classCheckins.userId, data.userId)
    )
  ).limit(1);
  if (existing.length > 0) {
    await db.update(classCheckins).set({ status: data.status }).where(eq(classCheckins.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(classCheckins).values(data).returning({ id: classCheckins.id });
    return result[0].id;
  }
}

// ──────────────────────────────────────────────
// Coding Settings
// ──────────────────────────────────────────────

export async function getCodingSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(codingSettings).where(eq(codingSettings.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function upsertCodingSettings(userId: number, data: { leetcodeUsername?: string; codeforcesHandle?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(codingSettings).where(eq(codingSettings.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(codingSettings).set({ ...data, updatedAt: new Date() }).where(eq(codingSettings.userId, userId));
  } else {
    await db.insert(codingSettings).values({ userId, ...data });
  }
}
