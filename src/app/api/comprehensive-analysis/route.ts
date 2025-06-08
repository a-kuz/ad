import { NextRequest, NextResponse } from 'next/server';
import { analyzeVisualScreenshots } from '@/lib/visualAnalysis';
import { analyzeBlockDropouts } from '@/lib/blockDropoutAnalysis';
import { 
  VideoMetadata, 
  ComprehensiveVideoAnalysis,
  DropoutCurve,
  DropoutPoint,
  AudioAnalysis,
  TextualVisualAnalysis,
  VisualAnalysis
} from '@/types';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { saveComprehensiveAnalysis } from '@/lib/database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log("Starting comprehensive analysis");
    
    const { 
      sessionId, 
      filePairId, 
      videoPath, 
      graphPath, 
      videoMetadata,
      dropoutCurveData
    } = await request.json();
    
    if (!sessionId || !filePairId || !videoPath || !videoMetadata) {
      return NextResponse.json({ 
        error: 'Session ID, file pair ID, video path, and video metadata are required' 
      }, { status: 400 });
    }
    
    console.log(`Processing comprehensive analysis for session ${sessionId}, file pair ${filePairId}`);
    
    // Check if the video file exists
    const absoluteVideoPath = path.join(process.cwd(), 'public', videoPath);
    if (!fs.existsSync(absoluteVideoPath)) {
      return NextResponse.json({ error: `Video file not found at ${absoluteVideoPath}` }, { status: 404 });
    }
    
    // Check if the graph file exists, if provided
    let absoluteGraphPath;
    if (graphPath) {
      absoluteGraphPath = path.join(process.cwd(), 'public', graphPath);
      if (!fs.existsSync(absoluteGraphPath)) {
        return NextResponse.json({ error: `Graph file not found at ${absoluteGraphPath}` }, { status: 404 });
      }
    } else {
      console.log("No graph path provided, skipping dropout curve analysis");
    }
    
    // Convert the provided dropout curve data if available
    let dropoutCurve: DropoutCurve;
    
    if (dropoutCurveData) {
      console.log("Using provided dropout curve data");
      
      // Convert the data to the DropoutCurve format
      const dropouts: DropoutPoint[] = [];
      let viewersRemaining = dropoutCurveData.initialViewers || 100;
      
      for (const point of dropoutCurveData.points) {
        const viewersBefore = viewersRemaining;
        const dropoutCount = Math.round((point.dropoutPercentage / 100) * viewersBefore);
        viewersRemaining -= dropoutCount;
        
        dropouts.push({
          time: point.timestamp,
          count: dropoutCount,
          viewersBefore: viewersBefore,
          viewersAfter: viewersRemaining
        });
      }
      
      dropoutCurve = {
        initialViewers: dropoutCurveData.initialViewers || 100,
        dropouts,
        totalDuration: videoMetadata.duration
      };
    } else {
      console.log("No dropout curve data provided, creating a placeholder");
      // Create a placeholder dropout curve if none provided
      dropoutCurve = {
        initialViewers: 100,
        dropouts: [],
        totalDuration: videoMetadata.duration
      };
    }
    
    // Generate screenshots for visual analysis
    console.log("Generating screenshots for visual analysis");
    const step = 0.5;
    
    try {
      // Используем функцию из videoProcessing.ts для последовательной обработки
      const { extractScreenshots } = await import('@/lib/videoProcessing');
      await extractScreenshots(absoluteVideoPath, sessionId, videoMetadata.duration, filePairId);
      console.log("Screenshots generated successfully");
    } catch (error) {
      console.error("Error generating screenshots:", error);
      return NextResponse.json({ 
        error: 'Failed to generate screenshots', 
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
    
    // Analyze visual screenshots
    console.log("Starting visual analysis");
    const visualAnalysis = await analyzeVisualScreenshots({
      screenshotsDir,
      sessionId,
      step,
      filePairId
    });
    
    console.log("Visual analysis completed");
    
    // Create a placeholder for audio analysis
    const audioAnalysis: AudioAnalysis = {
      transcription: [],
      groups: []
    };
    
    // Generate block dropout analysis
    console.log("Starting block dropout analysis");
    const analysis = await analyzeBlockDropouts({
      dropoutCurve,
      audioAnalysis,
      visualAnalysis
    });
    
    console.log("Block dropout analysis completed");
    
    // Save the comprehensive analysis to the database
    await saveComprehensiveAnalysis(filePairId, analysis);
    
    console.log("Comprehensive analysis saved to database");
    
    return NextResponse.json({
      success: true,
      analysis
    });
    
  } catch (error) {
    console.error("Error in comprehensive analysis:", error);
    return NextResponse.json({ 
      error: 'Failed to perform comprehensive analysis', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 