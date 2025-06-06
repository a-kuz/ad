import { NextRequest, NextResponse } from 'next/server';
import { saveAnalysisPrompt } from '@/lib/database';
import { analyzeVisualScreenshots } from '@/lib/visualAnalysis';

export async function POST(request: NextRequest) {
  try {
    console.log('Received visual analysis request');
    const { screenshotsDir, sessionId, step, filePairId, customPrompt, model } = await request.json();
    
    console.log(`Processing visual analysis request for sessionId: ${sessionId}, screenshotsDir: ${screenshotsDir}`);
    
    // Call the visual analysis function directly
    const visualAnalysis = await analyzeVisualScreenshots({
      screenshotsDir,
      sessionId,
      step,
      filePairId,
      customPrompt,
      model
    });
    
    return NextResponse.json(visualAnalysis);
  } catch (error) {
    console.error('Error analyzing visual screenshots:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze visual screenshots', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 