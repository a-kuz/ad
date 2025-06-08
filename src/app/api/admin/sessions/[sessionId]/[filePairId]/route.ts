import { NextResponse } from 'next/server';
import { deleteFilePair } from '@/lib/database';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; filePairId: string }> }
) {
  try {
    const { sessionId, filePairId } = await params;
    
    if (!sessionId || !filePairId) {
      return NextResponse.json(
        { error: 'Session ID and File Pair ID are required' },
        { status: 400 }
      );
    }
    
    await deleteFilePair(sessionId, filePairId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file pair:', error);
    return NextResponse.json(
      { error: 'Failed to delete file pair' },
      { status: 500 }
    );
  }
} 