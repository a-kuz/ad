import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { videoPath, sessionId, duration } = await request.json();
    
    if (!videoPath || !sessionId || !duration) {
      return NextResponse.json({ 
        error: 'Video path, session ID, and duration are required' 
      }, { status: 400 });
    }

    const screenshotsId = uuidv4();
    const outputDir = path.join(process.cwd(), 'public', 'uploads', sessionId, 'screenshots', screenshotsId);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const screenshots: string[] = [];
    const step = 0.5;
    const totalFrames = Math.ceil(duration / step);

    return new Promise((resolve) => {
      let processedFrames = 0;
      let hasError = false;

      for (let i = 0; i < totalFrames; i++) {
        const timestamp = i * step;
        const filename = `screenshot_${timestamp.toFixed(1)}s.jpg`;
        const outputPath = path.join(outputDir, filename);
        
        ffmpeg(videoPath)
          .seekInput(timestamp)
          .frames(1)
          .output(outputPath)
          .on('end', () => {
            screenshots.push(outputPath);
            processedFrames++;
            
            if (processedFrames === totalFrames && !hasError) {
              screenshots.sort((a, b) => {
                const aTime = parseFloat(a.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
                const bTime = parseFloat(b.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
                return aTime - bTime;
              });
              
              resolve(NextResponse.json({ 
                screenshots,
                screenshotsId,
                totalFrames: screenshots.length,
                step,
                message: 'Screenshots extracted successfully' 
              }));
            }
          })
          .on('error', (err) => {
            if (!hasError) {
              hasError = true;
              console.error('FFmpeg error:', err);
              resolve(NextResponse.json({ 
                error: 'Failed to extract screenshots',
                details: err.message 
              }, { status: 500 }));
            }
          })
          .run();
      }
    });

  } catch (error) {
    console.error('Error extracting screenshots:', error);
    return NextResponse.json({ 
      error: 'Failed to extract screenshots',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 