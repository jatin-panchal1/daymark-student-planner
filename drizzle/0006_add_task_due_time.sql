-- Add dueTime column to tasks table for optional task time
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dueTime" varchar(16);
