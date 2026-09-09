import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createSubject, createTask, deleteTask, listSchedules, listSubjects, listTasks, updateTask } from "./db";

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
    createSubject: protectedProcedure.input(z.object({ name: z.string().min(1).max(120), code: z.string().max(40).optional(), color: z.string().max(20).optional(), days: z.array(daySchema).min(1), startTime: z.string().max(10).optional() })).mutation(async ({ ctx, input }) => {
      const subjectId = await createSubject({ name: input.name, code: input.code, color: input.color, userId: ctx.user.id });
      // Schedule rows intentionally share the same user id for straightforward ownership checks.
      return { subjectId, days: input.days };
    }),
    createTask: protectedProcedure.input(z.object({ title: z.string().min(1).max(255), subjectId: z.number().int().positive().optional(), dueDate: z.string().date().nullable().optional(), priority: z.enum(["High", "Medium", "Low"]).default("Medium"), recurringDays: z.array(z.number().int().min(1).max(6)).default([]) })).mutation(async ({ ctx, input }) => {
      const taskId = await createTask({ title: input.title, subjectId: input.subjectId, dueDate: input.dueDate ? new Date(`${input.dueDate}T12:00:00`) : null, priority: input.priority, recurringDays: input.recurringDays.join(","), userId: ctx.user.id });
      return { taskId };
    }),
    toggleTask: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), isCompleted: z.boolean() })).mutation(({ ctx, input }) => updateTask(input.taskId, ctx.user.id, input.isCompleted)),
    deleteTask: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteTask(input.taskId, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
