import { NextRequest, NextResponse } from 'next/server';
import { analyzeBlockDropouts } from '@/lib/blockDropoutAnalysis';

export async function POST(request: NextRequest) {
  try {
    const { dropoutCurve, audioAnalysis, textualVisualAnalysis, visualAnalysis } = await request.json();
    
    // Call the block dropout analysis function directly
    const analysis = await analyzeBlockDropouts({
      dropoutCurve,
      audioAnalysis,
      textualVisualAnalysis,
      visualAnalysis
    });
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing block dropouts:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze block dropouts', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 