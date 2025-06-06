import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/database';
import { getAnalysisLogs } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const resolvedParams = await params;
    const sessionId = resolvedParams.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Получаем логи для всех файлов в сессии
    const allLogs = await Promise.all(
      session.filePairs.map(async (filePair) => {
        const logs = await getAnalysisLogs(filePair.id);
        return {
          filePairId: filePair.id,
          videoName: filePair.videoName,
          logs
        };
      })
    );

    return NextResponse.json({
      success: true,
      sessionId,
      filePairsLogs: allLogs
    });

  } catch (error) {
    console.error('Error getting session analysis logs:', error);
    return NextResponse.json(
      { error: 'Failed to get session analysis logs' },
      { status: 500 }
    );
  }
} 