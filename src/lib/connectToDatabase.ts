import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

let db: Database | null = null;

export async function connectToDatabase(): Promise<{ db: Database }> {
  if (db) {
    return { db };
  }

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await initializeSchema();
  return { db };
}

async function initializeSchema() {
  if (!db) return;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_pairs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      video_path TEXT NOT NULL,
      graph_path TEXT NOT NULL,
      video_name TEXT NOT NULL,
      graph_name TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      generated_title TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_metadata (
      file_pair_id TEXT PRIMARY KEY,
      duration REAL NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      fps REAL NOT NULL,
      bitrate INTEGER NOT NULL,
      format TEXT NOT NULL,
      size INTEGER NOT NULL,
      title TEXT,
      thumbnail_path TEXT,
      streams TEXT,
      FOREIGN KEY (file_pair_id) REFERENCES file_pairs (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_analyses (
      id TEXT PRIMARY KEY,
      file_pair_id TEXT NOT NULL,
      insights TEXT NOT NULL,
      recommendations TEXT NOT NULL,
      critical_moments TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      improvement_areas TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      report TEXT,
      FOREIGN KEY (file_pair_id) REFERENCES file_pairs (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comprehensive_analyses (
      id TEXT PRIMARY KEY,
      file_pair_id TEXT NOT NULL,
      dropout_curve TEXT NOT NULL,
      audio_analysis TEXT NOT NULL,
      textual_visual_analysis TEXT NOT NULL,
      visual_analysis TEXT NOT NULL,
      block_dropout_analysis TEXT NOT NULL,
      timeline_alignment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      screenshots_dir TEXT,
      FOREIGN KEY (file_pair_id) REFERENCES file_pairs (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_logs (
      id TEXT PRIMARY KEY,
      file_pair_id TEXT NOT NULL,
      step TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      details TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (file_pair_id) REFERENCES file_pairs (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_prompts (
      id TEXT PRIMARY KEY,
      file_pair_id TEXT NOT NULL,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (file_pair_id) REFERENCES file_pairs (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_file_pairs_session_id ON file_pairs (session_id);
    CREATE INDEX IF NOT EXISTS idx_video_analyses_file_pair_id ON video_analyses (file_pair_id);
    CREATE INDEX IF NOT EXISTS idx_comprehensive_analyses_file_pair_id ON comprehensive_analyses (file_pair_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_logs_file_pair_id ON analysis_logs (file_pair_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON analysis_logs (created_at);
    CREATE INDEX IF NOT EXISTS idx_analysis_prompts_file_pair_id ON analysis_prompts (file_pair_id);
  `);

  // Migration: Add generated_title column if it doesn't exist
  try {
    await db.exec(`ALTER TABLE file_pairs ADD COLUMN generated_title TEXT;`);
  } catch (error: any) {
    // Column already exists or other error - ignore if it's a "duplicate column" error
    if (!error.message.includes('duplicate column name')) {
      console.warn('Migration warning:', error.message);
    }
  }

  // Migration: Add details column to analysis_logs if it doesn't exist
  try {
    await db.exec(`ALTER TABLE analysis_logs ADD COLUMN details TEXT;`);
  } catch (error: any) {
    // Column already exists or other error - ignore if it's a "duplicate column" error
    if (!error.message.includes('duplicate column name')) {
      console.warn('Migration warning:', error.message);
    }
  }

  // Migration: Add screenshots_dir column to comprehensive_analyses if it doesn't exist
  try {
    await db.exec(`ALTER TABLE comprehensive_analyses ADD COLUMN screenshots_dir TEXT;`);
  } catch (error: any) {
    // Column already exists or other error - ignore if it's a "duplicate column" error
    if (!error.message.includes('duplicate column name')) {
      console.warn('Migration warning:', error.message);
    }
  }
} 