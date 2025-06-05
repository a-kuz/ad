import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/database';

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

    // Подготавливаем информацию о статусе анализа для каждой пары файлов
    const analysisStatus = session.filePairs.map(filePair => ({
      id: filePair.id,
      videoName: filePair.videoName,
      graphName: filePair.graphName,
      uploadedAt: filePair.uploadedAt,
      hasAnalysis: !!filePair.analysis,
      analysisCompleted: !!filePair.analysis,
      overallScore: filePair.analysis?.overallScore || null,
      analysisGeneratedAt: filePair.analysis?.generatedAt || null
    }));

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      totalFilePairs: session.filePairs.length,
      completedAnalysis: session.filePairs.filter(fp => fp.analysis).length,
      analysisStatus
    });

  } catch (error) {
    console.error('Error checking analysis status:', error);
    return NextResponse.json(
      { error: 'Failed to check analysis status' },
      { status: 500 }
    );
  }
} 