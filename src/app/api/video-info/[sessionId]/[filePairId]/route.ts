import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/database';
import { getVideoMetadata, getVideoStreams, extractVideoThumbnail } from '@/lib/videoProcessor';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; filePairId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { sessionId, filePairId } = resolvedParams;

    if (!sessionId || !filePairId) {
      return NextResponse.json(
        { error: 'Session ID and File Pair ID are required' },
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

    const filePair = session.filePairs.find(fp => fp.id === filePairId);
    if (!filePair) {
      return NextResponse.json(
        { error: 'File pair not found' },
        { status: 404 }
      );
    }

    try {
      // Получаем метаданные видео
      const metadata = await getVideoMetadata(filePair.videoPath);
      
      // Получаем информацию о потоках
      const streams = await getVideoStreams(filePair.videoPath);
      
      // Создаем превью если его еще нет
      let thumbnailPath;
      try {
        thumbnailPath = await extractVideoThumbnail(filePair.videoPath, Math.min(5, metadata.duration / 2));
      } catch (thumbnailError) {
        console.warn('Failed to create thumbnail:', thumbnailError);
        thumbnailPath = null;
      }

      const videoInfo = {
        ...metadata,
        streams,
        thumbnailPath,
        filePair: {
          id: filePair.id,
          videoName: filePair.videoName,
          graphName: filePair.graphName,
          uploadedAt: filePair.uploadedAt,
          hasAnalysis: !!filePair.analysis
        }
      };

      return NextResponse.json({
        success: true,
        videoInfo
      });

    } catch (error) {
      console.error('Error getting video info:', error);
      return NextResponse.json(
        { error: 'Failed to analyze video file' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in video-info API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 