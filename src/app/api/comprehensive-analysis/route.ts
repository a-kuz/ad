import { NextRequest, NextResponse } from 'next/server';
import { ComprehensiveVideoAnalysis } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, filePairId, videoPath, graphPath } = await request.json();
    
    if (!sessionId || !filePairId || !videoPath || !graphPath) {
      return NextResponse.json({ 
        error: 'Session ID, file pair ID, video path, and graph path are required' 
      }, { status: 400 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    console.log('Starting comprehensive analysis...');

    console.log('Analyzing dropout curve...');
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(graphPath);
    const formData = new FormData();
    const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image', imageBlob, 'graph.jpg');
    
    const dropoutCurveResponse = await fetch(`${baseUrl}/api/analyze-dropout-curve`, {
      method: 'POST',
      body: formData
    });

    console.log('Getting video info...');
    const videoInfoResponse = await fetch(`${baseUrl}/api/video-info/${sessionId}/${filePairId}`);

    if (!dropoutCurveResponse.ok) {
      throw new Error('Failed to analyze dropout curve');
    }

    const dropoutCurve = await dropoutCurveResponse.json();
    const videoInfo = await videoInfoResponse.json();
    const duration = videoInfo.videoMetadata?.duration || 60;

    console.log('Extracting audio...');
    const audioResponse = await fetch(`${baseUrl}/api/extract-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, sessionId })
    });

    if (!audioResponse.ok) {
      throw new Error('Failed to extract audio');
    }

    const audioData = await audioResponse.json();

    console.log('Extracting screenshots...');
    const screenshotsResponse = await fetch(`${baseUrl}/api/extract-screenshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, sessionId, duration })
    });

    if (!screenshotsResponse.ok) {
      throw new Error('Failed to extract screenshots');
    }

    const screenshotsData = await screenshotsResponse.json();

    console.log('Analyzing audio transcription...');
    const transcriptionResponse = await fetch(`${baseUrl}/api/transcribe-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioPath: audioData.audioPath })
    });

    if (!transcriptionResponse.ok) {
      throw new Error('Failed to transcribe audio');
    }

    const audioAnalysis = await transcriptionResponse.json();

    console.log('Analyzing text screenshots...');
    const textAnalysisResponse = await fetch(`${baseUrl}/api/analyze-text-screenshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        screenshots: screenshotsData.screenshots,
        step: screenshotsData.step
      })
    });

    if (!textAnalysisResponse.ok) {
      throw new Error('Failed to analyze text screenshots');
    }

    const textualVisualAnalysis = await textAnalysisResponse.json();

    console.log('Analyzing visual screenshots...');
    const visualAnalysisResponse = await fetch(`${baseUrl}/api/analyze-visual-screenshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        screenshots: screenshotsData.screenshots,
        step: screenshotsData.step
      })
    });

    if (!visualAnalysisResponse.ok) {
      throw new Error('Failed to analyze visual screenshots');
    }

    const visualAnalysis = await visualAnalysisResponse.json();

    console.log('Analyzing block dropouts...');
    const blockDropoutsResponse = await fetch(`${baseUrl}/api/analyze-block-dropouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dropoutCurve,
        audioAnalysis,
        textualVisualAnalysis,
        visualAnalysis
      })
    });

    if (!blockDropoutsResponse.ok) {
      throw new Error('Failed to analyze block dropouts');
    }

    const comprehensiveAnalysis: ComprehensiveVideoAnalysis = await blockDropoutsResponse.json();

    console.log('Comprehensive analysis completed successfully');

    return NextResponse.json({
      success: true,
      analysis: comprehensiveAnalysis,
      message: 'Comprehensive analysis completed successfully'
    });

  } catch (error) {
    console.error('Error in comprehensive analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to complete comprehensive analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 