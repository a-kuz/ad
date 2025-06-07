import { NextRequest, NextResponse } from 'next/server';
import { getScreenshotFilesForFilePair } from '@/lib/database';

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

    const screenshotFiles = await getScreenshotFilesForFilePair(filePairId);

    return NextResponse.json({
      success: true,
      filePairId,
      screenshots: screenshotFiles
    });

  } catch (error) {
    console.error('Error getting screenshot files:', error);
    return NextResponse.json(
      { error: 'Failed to get screenshot files' },
      { status: 500 }
    );
  }
} 