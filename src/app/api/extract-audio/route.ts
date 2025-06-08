import { NextRequest, NextResponse } from 'next/server';
import { extractAudioFromVideo } from '@/lib/audioProcessing';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { videoPath, sessionId } = await request.json();
    
    if (!videoPath || !sessionId) {
      return NextResponse.json({ error: 'Video path and session ID are required' }, { status: 400 });
    }

    const fullVideoPath = path.join(process.cwd(), 'public', videoPath);
    
    if (!fs.existsSync(fullVideoPath)) {
      return NextResponse.json({ 
        error: 'Video file not found' 
      }, { status: 404 });
    }

    // Используем функцию из audioProcessing.ts для правильной асинхронной обработки
    const audioPath = await extractAudioFromVideo(fullVideoPath, sessionId);
    
    const audioId = path.basename(audioPath, '.mp3');
    
    return NextResponse.json({ 
      audioPath,
      audioId,
      message: 'Audio extracted successfully' 
    });

  } catch (error) {
    console.error('Error extracting audio:', error);
    return NextResponse.json({ 
      error: 'Failed to extract audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 