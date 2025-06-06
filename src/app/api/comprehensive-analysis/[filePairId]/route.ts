import { NextRequest, NextResponse } from 'next/server';
import { getComprehensiveAnalysis } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filePairId: string }> }
) {
  try {
    const resolvedParams = await params;
    const filePairId = resolvedParams.filePairId;

    if (!filePairId) {
      return NextResponse.json(
        { error: 'File Pair ID is required' },
        { status: 400 }
      );
    }

    const comprehensiveAnalysis = await getComprehensiveAnalysis(filePairId);

    if (!comprehensiveAnalysis) {
      return NextResponse.json(
        { error: 'Comprehensive analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: comprehensiveAnalysis
    });

  } catch (error) {
    console.error('Error getting comprehensive analysis:', error);
    return NextResponse.json(
      { error: 'Failed to get comprehensive analysis' },
      { status: 500 }
    );
  }
} 