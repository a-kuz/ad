import { NextRequest, NextResponse } from 'next/server';
import { getScreenshotFilesForFilePair, updateVisualAnalysisForFilePair, getFilePairData } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import { analyzeVisualScreenshots } from '@/lib/visualAnalysis';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { filePairId, prompt, model } = await request.json();

    if (!filePairId) {
      return NextResponse.json({ error: 'Missing filePairId' }, { status: 400 });
    }

    // Get session ID from file pair
    const filePairData = await getFilePairData(filePairId);
    if (!filePairData || !filePairData.session_id) {
      return NextResponse.json({ error: 'File pair not found' }, { status: 404 });
    }

    const sessionId = filePairData.session_id;

    // Get screenshot files
    const screenshotFiles = await getScreenshotFilesForFilePair(filePairId);
    
    if (!screenshotFiles || screenshotFiles.length === 0) {
      return NextResponse.json({ error: 'No screenshots found for this file pair' }, { status: 404 });
    }

    // Validate each screenshot path
    const validScreenshots = screenshotFiles.filter(screenshotPath => {
      const fullPath = path.join(process.cwd(), 'public', screenshotPath);
      return fs.existsSync(fullPath);
    });

    if (validScreenshots.length === 0) {
      return NextResponse.json({ error: 'No valid screenshots found' }, { status: 404 });
    }

    // Map public paths to full paths
    const fullPaths = validScreenshots.map(screenshotPath => 
      path.join(process.cwd(), 'public', screenshotPath)
    );

    // Call the analysis function directly
    const visualAnalysis = await analyzeVisualScreenshots({
      screenshots: fullPaths,
      filePairId,
      customPrompt: prompt,
      model
    });

    // Update database with new analysis
    await updateVisualAnalysisForFilePair(filePairId, visualAnalysis);

    return NextResponse.json({ 
      success: true, 
      message: 'Visual analysis regenerated',
      analysis: visualAnalysis
    });

  } catch (error) {
    console.error('Error regenerating visual analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to regenerate visual analysis', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 