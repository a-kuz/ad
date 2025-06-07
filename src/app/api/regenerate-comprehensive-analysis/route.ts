import { NextRequest, NextResponse } from 'next/server';
import { 
  getComprehensiveAnalysis, 
  saveComprehensiveAnalysis, 
  getSession, 
  getFilePairData 
} from '@/lib/database';
import fs from 'fs';
import path from 'path';
import { analyzeVisualScreenshots } from '@/lib/visualAnalysis';
import { analyzeBlockDropouts } from '@/lib/blockDropoutAnalysis';

export async function POST(request: NextRequest) {
  try {
    const { 
      sessionId, 
      filePairId, 
      customPrompt, 
      model 
    } = await request.json();

    if (!sessionId || !filePairId) {
      return NextResponse.json({ 
        error: 'Session ID and file pair ID are required' 
      }, { status: 400 });
    }

    // Get the existing comprehensive analysis
    const existingAnalysis = await getComprehensiveAnalysis(filePairId);
    
    if (!existingAnalysis) {
      return NextResponse.json({ 
        error: 'No existing analysis found for this file pair' 
      }, { status: 404 });
    }

    // Get the session data to find the file pair
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 });
    }

    const filePair = session.filePairs.find(fp => fp.id === filePairId);
    if (!filePair) {
      return NextResponse.json({ 
        error: 'File pair not found in session' 
      }, { status: 404 });
    }

    // Search for screenshots directory in public/uploads/[sessionId]/screenshots
    const screenshotsBaseDir = path.join(process.cwd(), 'public', 'uploads', sessionId, 'screenshots', filePairId);
    
    if (!fs.existsSync(screenshotsBaseDir)) {
      return NextResponse.json({ 
        error: `Screenshots directory not found at ${screenshotsBaseDir}` 
      }, { status: 404 });
    }

    // List all screenshot directories (could be multiple from different analyses)
    const screenshotDirs = fs.readdirSync(screenshotsBaseDir)
      .map(dir => path.join(screenshotsBaseDir, dir))
      .filter(dir => fs.statSync(dir).isDirectory());
    
    if (screenshotDirs.length === 0) {
      return NextResponse.json({ 
        error: 'No screenshot directories found' 
      }, { status: 404 });
    }

    // Use the most recent screenshot directory (last one)
    const latestScreenshotsDir = screenshotDirs.sort().pop();
    
    if (!latestScreenshotsDir) {
      return NextResponse.json({ 
        error: 'Could not determine latest screenshots directory' 
      }, { status: 404 });
    }

    console.log(`Using screenshots from directory: ${latestScreenshotsDir}`);

    // Get all screenshots in the directory
    const screenshots = fs.readdirSync(latestScreenshotsDir)
      .filter(file => file.endsWith('.jpg'))
      .map(file => path.join(latestScreenshotsDir, file))
      .sort((a, b) => {
        // Extract timestamp from filename (e.g., "screenshot_10.5s.jpg" -> 10.5)
        const timeA = parseFloat(a.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
        const timeB = parseFloat(b.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
        return timeA - timeB;
      });

    if (screenshots.length === 0) {
      return NextResponse.json({ 
        error: `No screenshots found in directory ${latestScreenshotsDir}` 
      }, { status: 404 });
    }

    console.log(`Found ${screenshots.length} screenshots`);

    // Calculate step based on video duration and number of screenshots
    const step = existingAnalysis.dropoutCurve?.totalDuration ? 
      existingAnalysis.dropoutCurve.totalDuration / screenshots.length : 
      1;

    console.log('Starting visual analysis with custom prompt and model');

    // Call the visual analysis function directly
    const newVisualAnalysis = await analyzeVisualScreenshots({
      screenshots,
      filePairId,
      customPrompt,
      model,
      step
    });

    console.log('Visual analysis completed successfully');

    // Update the block dropout analysis based on the new visual analysis
    console.log('Starting block dropout analysis');
    
    // Call the block dropout analysis function directly
    if (!existingAnalysis.dropoutCurve || !existingAnalysis.audioAnalysis) {
      return NextResponse.json({ 
        error: 'Missing required analysis data (dropoutCurve or audioAnalysis)' 
      }, { status: 400 });
    }

    const updatedAnalysis = await analyzeBlockDropouts({
      dropoutCurve: existingAnalysis.dropoutCurve as any,
      audioAnalysis: existingAnalysis.audioAnalysis,
      textualVisualAnalysis: existingAnalysis.textualVisualAnalysis,
      visualAnalysis: newVisualAnalysis
    });

    console.log('Block dropout analysis completed successfully');

    // Save the updated comprehensive analysis
    await saveComprehensiveAnalysis(filePairId, updatedAnalysis);
    console.log('Comprehensive analysis saved successfully');

    return NextResponse.json({ 
      success: true, 
      analysis: updatedAnalysis,
      message: 'Visual analysis regenerated successfully'
    });

  } catch (error) {
    console.error('Error regenerating analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to regenerate analysis', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 