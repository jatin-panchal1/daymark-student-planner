-- Add unique index on subjects (name, userId) to support upsert-by-name
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_name_user_uniq" ON "subjects" ("name", "userId");

-- Add target columns to codingSettings
ALTER TABLE "codingSettings" ADD COLUMN IF NOT EXISTS "leetcodeTarget" integer NOT NULL DEFAULT 150;
ALTER TABLE "codingSettings" ADD COLUMN IF NOT EXISTS "codeforcesTarget" integer NOT NULL DEFAULT 200;

-- Add Google OAuth token columns to users for Calendar API access
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleAccessToken" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleRefreshToken" text;
