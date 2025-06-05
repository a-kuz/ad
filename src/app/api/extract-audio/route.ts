import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { videoPath, sessionId } = await request.json();
    
    if (!videoPath || !sessionId) {
      return NextResponse.json({ error: 'Video path and session ID are required' }, { status: 400 });
    }

    const audioId = uuidv4();
    const outputDir = path.join(process.cwd(), 'public', 'uploads', sessionId, 'audio');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const audioPath = path.join(outputDir, `${audioId}.mp3`);

    return new Promise((resolve) => {
      ffmpeg(videoPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .on('end', () => {
          resolve(NextResponse.json({ 
            audioPath,
            audioId,
            message: 'Audio extracted successfully' 
          }));
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          resolve(NextResponse.json({ 
            error: 'Failed to extract audio',
            details: err.message 
          }, { status: 500 }));
        })
        .save(audioPath);
    });

  } catch (error) {
    console.error('Error extracting audio:', error);
    return NextResponse.json({ 
      error: 'Failed to extract audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 