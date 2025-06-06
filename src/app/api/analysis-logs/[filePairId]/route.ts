import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisLogs } from '@/lib/database';

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

    const logs = await getAnalysisLogs(filePairId);

    return NextResponse.json({
      success: true,
      filePairId,
      logs
    });

  } catch (error) {
    console.error('Error getting analysis logs:', error);
    return NextResponse.json(
      { error: 'Failed to get analysis logs' },
      { status: 500 }
    );
  }
} 