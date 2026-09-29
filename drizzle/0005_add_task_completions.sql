-- Create task_completions table for per-day completion tracking of recurring/daily tasks
CREATE TABLE IF NOT EXISTS "taskCompletions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "taskId" integer NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "completionDate" date NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "task_completions_user_idx" ON "taskCompletions" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "task_completions_task_date_uniq" ON "taskCompletions" ("taskId", "completionDate");
