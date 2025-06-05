import { NextResponse } from 'next/server';
import { getAllSessions } from '@/lib/database';

export async function GET() {
  try {
    const sessions = await getAllSessions();
    
    const stats = {
      totalSessions: sessions.length,
      totalFilePairs: sessions.reduce((sum, session) => sum + session.filePairs.length, 0),
      sessionsWithUploads: sessions.filter(session => session.filePairs.length > 0).length,
    };
    
    return NextResponse.json({
      sessions,
      stats
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
} 