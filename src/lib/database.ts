import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  UserSession, 
  UploadedFilePair, 
  VideoAnalysis, 
  VideoMetadata,
  ComprehensiveVideoAnalysis
} from '@/types';

const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  const dbDir = path.dirname(DB_PATH);
  const fs = await import('fs');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await initializeSchema();
  return db;
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
      FOREIGN KEY (file_pair_id) REFERENCES file_pairs (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_logs (
      id TEXT PRIMARY KEY,
      file_pair_id TEXT NOT NULL,
      step TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (file_pair_id) REFERENCES file_pairs (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_file_pairs_session_id ON file_pairs (session_id);
    CREATE INDEX IF NOT EXISTS idx_video_analyses_file_pair_id ON video_analyses (file_pair_id);
    CREATE INDEX IF NOT EXISTS idx_comprehensive_analyses_file_pair_id ON comprehensive_analyses (file_pair_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_logs_file_pair_id ON analysis_logs (file_pair_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON analysis_logs (created_at);
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
}

export function generateSessionId(): string {
  return uuidv4();
}

export async function createSession(sessionId: string): Promise<UserSession> {
  const database = await getDatabase();
  const createdAt = new Date().toISOString();
  
  await database.run(
    'INSERT INTO sessions (id, created_at) VALUES (?, ?)',
    [sessionId, createdAt]
  );
  
  return {
    sessionId,
    createdAt,
    filePairs: []
  };
}

export async function getSession(sessionId: string): Promise<UserSession | null> {
  const database = await getDatabase();
  
  const session = await database.get(
    'SELECT * FROM sessions WHERE id = ?',
    [sessionId]
  );
  
  if (!session) return null;
  
  const filePairs = await database.all(`
    SELECT fp.*, 
           vm.duration, vm.width, vm.height, vm.fps, vm.bitrate, vm.format, vm.size, vm.title, vm.thumbnail_path, vm.streams,
           va.id as analysis_id, va.insights, va.recommendations, va.critical_moments, va.overall_score, va.improvement_areas, va.generated_at, va.report
    FROM file_pairs fp
    LEFT JOIN video_metadata vm ON fp.id = vm.file_pair_id
    LEFT JOIN video_analyses va ON fp.id = va.file_pair_id
    WHERE fp.session_id = ?
    ORDER BY fp.uploaded_at
  `, [sessionId]);
  
  const processedFilePairs: UploadedFilePair[] = filePairs.map((row: Record<string, any>) => {
    const filePair: UploadedFilePair = {
      id: row.id,
      videoPath: row.video_path,
      graphPath: row.graph_path,
      videoName: row.video_name,
      graphName: row.graph_name,
      uploadedAt: row.uploaded_at,
      generatedTitle: row.generated_title
    };
    
    if (row.duration !== null) {
      filePair.videoMetadata = {
        duration: row.duration,
        width: row.width,
        height: row.height,
        fps: row.fps,
        bitrate: row.bitrate,
        format: row.format,
        size: row.size,
        title: row.title,
        thumbnailPath: row.thumbnail_path,
        streams: row.streams ? JSON.parse(row.streams) : undefined
      };
    }
    
    if (row.analysis_id) {
      filePair.analysis = {
        id: row.analysis_id,
        insights: row.insights,
        recommendations: JSON.parse(row.recommendations),
        criticalMoments: JSON.parse(row.critical_moments),
        overallScore: row.overall_score,
        improvementAreas: JSON.parse(row.improvement_areas),
        generatedAt: row.generated_at,
        report: row.report
      };
    }
    
    return filePair;
  });
  
  return {
    sessionId: session.id,
    createdAt: session.created_at,
    filePairs: processedFilePairs
  };
}

export async function addFilePairToSession(sessionId: string, filePair: UploadedFilePair): Promise<void> {
  const database = await getDatabase();
  
  await database.run(`
    INSERT INTO file_pairs (id, session_id, video_path, graph_path, video_name, graph_name, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    filePair.id,
    sessionId,
    filePair.videoPath,
    filePair.graphPath,
    filePair.videoName,
    filePair.graphName,
    filePair.uploadedAt
  ]);
  
  if (filePair.videoMetadata) {
    await database.run(`
      INSERT INTO video_metadata (file_pair_id, duration, width, height, fps, bitrate, format, size, title, thumbnail_path, streams)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      filePair.id,
      filePair.videoMetadata.duration,
      filePair.videoMetadata.width,
      filePair.videoMetadata.height,
      filePair.videoMetadata.fps,
      filePair.videoMetadata.bitrate,
      filePair.videoMetadata.format,
      filePair.videoMetadata.size,
      filePair.videoMetadata.title || null,
      filePair.videoMetadata.thumbnailPath || null,
      filePair.videoMetadata.streams ? JSON.stringify(filePair.videoMetadata.streams) : null
    ]);
  }
  
  if (filePair.analysis) {
    await saveVideoAnalysis(filePair.id, filePair.analysis);
  }
}

export async function saveVideoAnalysis(filePairId: string, analysis: VideoAnalysis): Promise<void> {
  const database = await getDatabase();
  
  await database.run(`
    INSERT OR REPLACE INTO video_analyses (id, file_pair_id, insights, recommendations, critical_moments, overall_score, improvement_areas, generated_at, report)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    analysis.id,
    filePairId,
    analysis.insights,
    JSON.stringify(analysis.recommendations),
    JSON.stringify(analysis.criticalMoments),
    analysis.overallScore,
    JSON.stringify(analysis.improvementAreas),
    analysis.generatedAt,
    analysis.report || null
  ]);
}

export async function getVideoAnalysis(filePairId: string): Promise<VideoAnalysis | null> {
  const database = await getDatabase();
  
  const row = await database.get(
    'SELECT * FROM video_analyses WHERE file_pair_id = ?',
    [filePairId]
  );
  
  if (!row) return null;
  
  return {
    id: row.id,
    insights: row.insights,
    recommendations: JSON.parse(row.recommendations),
    criticalMoments: JSON.parse(row.critical_moments),
    overallScore: row.overall_score,
    improvementAreas: JSON.parse(row.improvement_areas),
    generatedAt: row.generated_at,
    report: row.report
  };
}

export async function saveComprehensiveAnalysis(filePairId: string, analysis: ComprehensiveVideoAnalysis): Promise<string> {
  const database = await getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  await database.run(`
    INSERT OR REPLACE INTO comprehensive_analyses (
      id, file_pair_id, dropout_curve, audio_analysis, textual_visual_analysis, 
      visual_analysis, block_dropout_analysis, timeline_alignment, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    filePairId,
    JSON.stringify(analysis.dropoutCurve),
    JSON.stringify(analysis.audioAnalysis),
    JSON.stringify(analysis.textualVisualAnalysis),
    JSON.stringify(analysis.visualAnalysis),
    JSON.stringify(analysis.blockDropoutAnalysis),
    JSON.stringify(analysis.timelineAlignment),
    createdAt
  ]);
  
  return id;
}

export async function getComprehensiveAnalysis(filePairId: string): Promise<ComprehensiveVideoAnalysis | null> {
  const database = await getDatabase();
  
  const row = await database.get(
    'SELECT * FROM comprehensive_analyses WHERE file_pair_id = ? ORDER BY created_at DESC LIMIT 1',
    [filePairId]
  );
  
  if (!row) return null;
  
  return {
    dropoutCurve: JSON.parse(row.dropout_curve),
    audioAnalysis: JSON.parse(row.audio_analysis),
    textualVisualAnalysis: JSON.parse(row.textual_visual_analysis),
    visualAnalysis: JSON.parse(row.visual_analysis),
    blockDropoutAnalysis: JSON.parse(row.block_dropout_analysis),
    timelineAlignment: JSON.parse(row.timeline_alignment)
  };
}

export async function getAllSessions(): Promise<UserSession[]> {
  const database = await getDatabase();
  
  const sessions = await database.all('SELECT * FROM sessions ORDER BY created_at DESC');
  
  const result: UserSession[] = [];
  for (const session of sessions) {
    const fullSession = await getSession(session.id);
    if (fullSession) {
      result.push(fullSession);
    }
  }
  
  return result;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const database = await getDatabase();
  await database.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

export async function updateVideoMetadata(filePairId: string, metadata: VideoMetadata): Promise<void> {
  const database = await getDatabase();
  
  await database.run(`
    INSERT OR REPLACE INTO video_metadata (file_pair_id, duration, width, height, fps, bitrate, format, size, title, thumbnail_path, streams)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    filePairId,
    metadata.duration,
    metadata.width,
    metadata.height,
    metadata.fps,
    metadata.bitrate,
    metadata.format,
    metadata.size,
    metadata.title || null,
    metadata.thumbnailPath || null,
    metadata.streams ? JSON.stringify(metadata.streams) : null
  ]);
}

export async function savePairTitle(filePairId: string, title: string): Promise<void> {
  const database = await getDatabase();
  
  await database.run(`
    UPDATE file_pairs SET generated_title = ? WHERE id = ?
  `, [title, filePairId]);
}

export interface AnalysisLog {
  id: string;
  filePairId: string;
  step: string;
  message: string;
  status: 'running' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
}

export async function createAnalysisLog(filePairId: string, step: string, message: string): Promise<string> {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await database.run(
    'INSERT INTO analysis_logs (id, file_pair_id, step, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, filePairId, step, message, 'running', now, now]
  );
  
  return id;
}

export async function updateAnalysisLog(logId: string, message: string, status: 'running' | 'completed' | 'error'): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  
  await database.run(
    'UPDATE analysis_logs SET message = ?, status = ?, updated_at = ? WHERE id = ?',
    [message, status, now, logId]
  );
}

export async function getAnalysisLogs(filePairId: string): Promise<AnalysisLog[]> {
  const database = await getDatabase();
  
  const rows = await database.all(
    'SELECT * FROM analysis_logs WHERE file_pair_id = ? ORDER BY created_at ASC',
    [filePairId]
  );
  
  return rows.map((row: any) => ({
    id: row.id,
    filePairId: row.file_pair_id,
    step: row.step,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function clearAnalysisLogs(filePairId: string): Promise<void> {
  const database = await getDatabase();
  
  await database.run(
    'DELETE FROM analysis_logs WHERE file_pair_id = ?',
    [filePairId]
  );
} 