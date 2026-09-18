import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createSubject, createTask, deleteTask, listSchedules, listSubjects, listTasks, updateTask,
  deleteSubject, listCalendarEvents, createCalendarEvent, bulkCreateCalendarEvents, deleteCalendarEvent,
  listCheckins, upsertCheckin, getCodingSettings, upsertCodingSettings, createSchedules,
  upsertSubjectByName, deleteSchedulesForSubject, clearAllSubjects,
} from "./db";
import { getFullLeetCodeData } from "./services/leetcode";
import { getFullCodeforcesData, getUpcomingContests } from "./services/codeforces";

const daySchema = z.number().int().min(0).max(6);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  planner: router({
    subjects: protectedProcedure.query(({ ctx }) => listSubjects(ctx.user.id)),
    schedules: protectedProcedure.query(({ ctx }) => listSchedules(ctx.user.id)),
    tasks: protectedProcedure.query(({ ctx }) => listTasks(ctx.user.id)),
    createSubject: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), code: z.string().max(40).optional(), color: z.string().max(20).optional(), days: z.array(daySchema).min(1), startTime: z.string().max(10).optional(), times: z.record(z.string(), z.string().max(10)).optional() })).mutation(async ({ ctx, input }) => {
      const subjectId = await createSubject({ name: input.name, code: input.code, color: input.color, userId: ctx.user.id });
      // Use per-day times map if provided, otherwise fall back to single startTime for all days
      await createSchedules(input.days.map(day => {
        const t: string | undefined = input.times?.[String(day)] ?? input.startTime ?? undefined;
        return { subjectId, dayOfWeek: day, startTime: t, userId: ctx.user.id };
      }));
      return { subjectId, days: input.days };
    }),
    deleteSubject: protectedProcedure.input(z.object({ subjectId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteSubject(input.subjectId, ctx.user.id)),
    upsertSubject: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), code: z.string().max(40).optional(), color: z.string().max(20).optional(), days: z.array(daySchema).min(1), startTime: z.string().max(10).optional(), times: z.record(z.string(), z.string().max(10)).optional() })).mutation(async ({ ctx, input }) => {
      const subjectId = await upsertSubjectByName({ name: input.name, code: input.code, color: input.color, userId: ctx.user.id });
      // Clear old schedules and re-create
      await deleteSchedulesForSubject(subjectId);
      await createSchedules(input.days.map(day => {
        const t: string | undefined = input.times?.[String(day)] ?? input.startTime ?? undefined;
        return { subjectId, dayOfWeek: day, startTime: t, userId: ctx.user.id };
      }));
      return { subjectId, days: input.days };
    }),
    clearAllSubjects: protectedProcedure.mutation(async ({ ctx }) => {
      await clearAllSubjects(ctx.user.id);
      return { success: true };
    }),
    createTask: protectedProcedure.input(z.object({ title: z.string().min(1).max(255), subjectId: z.number().int().positive().optional(), dueDate: z.string().date().nullable().optional(), priority: z.enum(["High", "Medium", "Low"]).default("Medium"), recurringDays: z.array(z.number().int().min(1).max(6)).default([]) })).mutation(async ({ ctx, input }) => {
      const taskId = await createTask({ title: input.title, subjectId: input.subjectId, dueDate: input.dueDate || null, priority: input.priority, recurringDays: input.recurringDays.join(","), userId: ctx.user.id });
      return { taskId };
    }),
    toggleTask: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), isCompleted: z.boolean() })).mutation(({ ctx, input }) => updateTask(input.taskId, ctx.user.id, input.isCompleted)),
    deleteTask: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteTask(input.taskId, ctx.user.id)),

    // Calendar events
    events: protectedProcedure.query(({ ctx }) => listCalendarEvents(ctx.user.id)),
    createEvent: protectedProcedure.input(z.object({
      kind: z.enum(["holiday", "dayoff", "exam"]),
      title: z.string().min(1).max(255),
      startDate: z.string().date(),
      endDate: z.string().date().optional(),
      subject: z.string().max(255).optional(),
      examTime: z.string().max(16).optional(),
      afterClass: z.boolean().optional(),
      afterSubject: z.string().max(255).optional(),
    })).mutation(async ({ ctx, input }) => {
      const eventId = await createCalendarEvent({ ...input, endDate: input.endDate || input.startDate, userId: ctx.user.id });
      return { eventId };
    }),
    importEvents: protectedProcedure.input(z.object({
      events: z.array(z.object({
        kind: z.enum(["holiday", "dayoff", "exam"]),
        title: z.string().min(1).max(255),
        startDate: z.string().date(),
        endDate: z.string().date().optional(),
        subject: z.string().max(255).optional(),
        examTime: z.string().max(16).optional(),
      }))
    })).mutation(async ({ ctx, input }) => {
      const data = input.events.map(e => ({ ...e, endDate: e.endDate || e.startDate, userId: ctx.user.id }));
      const ids = await bulkCreateCalendarEvents(data);
      return { count: ids.length };
    }),
    deleteEvent: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteCalendarEvent(input.eventId, ctx.user.id)),

    // Class check-ins
    checkins: protectedProcedure.input(z.object({ date: z.string().date() })).query(({ ctx, input }) => listCheckins(ctx.user.id, input.date)),
    checkIn: protectedProcedure.input(z.object({ subjectId: z.number().int().positive(), checkinDate: z.string().date(), status: z.enum(["attended", "absent"]) })).mutation(({ ctx, input }) => upsertCheckin({ ...input, userId: ctx.user.id })),
  }),
  coding: router({
    getSettings: protectedProcedure.query(({ ctx }) => getCodingSettings(ctx.user.id)),
    saveSettings: protectedProcedure.input(z.object({ leetcodeUsername: z.string().optional(), codeforcesHandle: z.string().optional(), leetcodeTarget: z.number().int().min(0).optional(), codeforcesTarget: z.number().int().min(0).optional() })).mutation(({ ctx, input }) => upsertCodingSettings(ctx.user.id, input)),
    leetcodeProfile: publicProcedure.input(z.object({ username: z.string().min(1) })).query(async ({ input }) => {
      return getFullLeetCodeData(input.username);
    }),
    codeforcesProfile: publicProcedure.input(z.object({ handle: z.string().min(1) })).query(async ({ input }) => {
      return getFullCodeforcesData(input.handle);
    }),
    upcomingContests: publicProcedure.query(async () => {
      return getUpcomingContests();
    }),
  }),
  googleCalendar: router({
    connected: protectedProcedure.query(async ({ ctx }) => {
      return { connected: !!ctx.user.googleAccessToken };
    }),
    events: protectedProcedure.input(z.object({
      timeMin: z.string(),
      timeMax: z.string(),
    })).query(async ({ ctx, input }) => {
      const token = ctx.user.googleAccessToken;
      if (!token) return { events: [], connected: false };
      try {
        const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
        url.searchParams.set("timeMin", input.timeMin);
        url.searchParams.set("timeMax", input.timeMax);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("maxResults", "100");
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          console.warn("[GoogleCalendar] API error:", res.status, await res.text().catch(() => ""));
          return { events: [], connected: true, error: res.status === 401 ? "Token expired — please re-login" : "Could not fetch events" };
        }
        const data = await res.json() as { items?: any[] };
        const events = (data.items ?? []).map((item: any) => ({
          id: `gcal-${item.id}`,
          title: item.summary || "Untitled",
          start: item.start?.date || item.start?.dateTime?.split("T")[0] || "",
          end: item.end?.date || item.end?.dateTime?.split("T")[0] || "",
          kind: "google" as const,
          allDay: !!item.start?.date,
          time: item.start?.dateTime ? new Date(item.start.dateTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : undefined,
        }));
        return { events, connected: true };
      } catch (err) {
        console.error("[GoogleCalendar] Fetch error:", err);
        return { events: [], connected: true, error: "Network error" };
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
