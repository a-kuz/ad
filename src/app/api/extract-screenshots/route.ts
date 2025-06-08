import { NextRequest, NextResponse } from 'next/server';
import { extractScreenshots } from '@/lib/videoProcessing';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { videoPath, sessionId, duration, filePairId } = await request.json();
    
    if (!videoPath || !sessionId || !duration) {
      return NextResponse.json({ 
        error: 'Video path, session ID, and duration are required' 
      }, { status: 400 });
    }

    const fullVideoPath = path.join(process.cwd(), 'public', videoPath);
    
    if (!fs.existsSync(fullVideoPath)) {
      return NextResponse.json({ 
        error: 'Video file not found' 
      }, { status: 404 });
    }

    // Используем функцию из videoProcessing.ts, которая делает последовательную обработку
    const screenshots = await extractScreenshots(fullVideoPath, sessionId, duration, filePairId);
    
    return NextResponse.json({ 
      screenshots,
      screenshotsId: filePairId,
      totalFrames: screenshots.length,
      step: 0.5,
      message: 'Screenshots extracted successfully' 
    });

  } catch (error) {
    console.error('Error extracting screenshots:', error);
    return NextResponse.json({ 
      error: 'Failed to extract screenshots',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 