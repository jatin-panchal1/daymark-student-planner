-- Create attendance records table for persisting CSV-imported attendance data
CREATE TABLE IF NOT EXISTS "attendanceRecords" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "subjectCode" varchar(40) NOT NULL,
  "subjectName" varchar(120) NOT NULL,
  "subjectType" varchar(40) NOT NULL,
  "present" integer NOT NULL DEFAULT 0,
  "absent" integer NOT NULL DEFAULT 0,
  "makeup" integer NOT NULL DEFAULT 0,
  "hoursPresent" integer NOT NULL DEFAULT 0,
  "hoursAbsent" integer NOT NULL DEFAULT 0,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "attendance_user_idx" ON "attendanceRecords" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_code_user_uniq" ON "attendanceRecords" ("subjectCode", "userId");
