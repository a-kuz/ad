import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

export async function GET() {
  try {
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    const sessionCount = await db.get('SELECT COUNT(*) as count FROM sessions');
    const filePairCount = await db.get('SELECT COUNT(*) as count FROM file_pairs');
    const analysisCount = await db.get('SELECT COUNT(*) as count FROM video_analyses');
    const comprehensiveAnalysisCount = await db.get('SELECT COUNT(*) as count FROM comprehensive_analyses');
    
    const dbSize = await db.get("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
    
    const recentSessions = await db.all(`
      SELECT s.id, s.created_at, COUNT(fp.id) as file_pairs_count 
      FROM sessions s 
      LEFT JOIN file_pairs fp ON s.id = fp.session_id 
      GROUP BY s.id, s.created_at 
      ORDER BY s.created_at DESC 
      LIMIT 10
    `);

    await db.close();

    return NextResponse.json({
      success: true,
      stats: {
        sessions: sessionCount.count,
        filePairs: filePairCount.count,
        videoAnalyses: analysisCount.count,
        comprehensiveAnalyses: comprehensiveAnalysisCount.count,
        databaseSizeBytes: dbSize.size,
        databaseSizeMB: Math.round(dbSize.size / (1024 * 1024) * 100) / 100
      },
      recentSessions: recentSessions.map(session => ({
        sessionId: session.id,
        createdAt: session.created_at,
        filePairsCount: session.file_pairs_count
      }))
    });

  } catch (error) {
    console.error('Error getting database stats:', error);
    return NextResponse.json(
      { error: 'Failed to get database statistics' },
      { status: 500 }
    );
  }
} 