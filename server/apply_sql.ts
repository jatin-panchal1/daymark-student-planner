import postgres from 'postgres';
import fs from 'fs';
import { ENV } from './_core/env.ts';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const sqlContent = fs.readFileSync('drizzle/0004_add_attendance_records.sql', 'utf-8');
  console.log('Connecting to', process.env.DATABASE_URL);
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql.unsafe(sqlContent);
    console.log('Successfully applied migration');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

run();
