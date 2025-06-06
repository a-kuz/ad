import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisPrompt } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { filePairId: string } }
) {
  try {
    console.log('GET /api/analysis-prompts/[filePairId]', params);
    
    const filePairId = (await params).filePairId;
    if (!filePairId) {
      console.error('Missing filePairId in params', params);
      return NextResponse.json({ error: 'File pair ID is required' }, { status: 400 });
    }
    
    const type = request.nextUrl.searchParams.get('type');
    if (!type) {
      console.error('Missing type in query params', request.nextUrl.searchParams.toString());
      return NextResponse.json({ error: 'Analysis type is required' }, { status: 400 });
    }

    console.log(`Fetching analysis prompt for filePairId=${filePairId}, type=${type}`);
    const prompt = await getAnalysisPrompt(filePairId, type);
    console.log('Prompt result:', prompt ? 'Found' : 'Not found');
    
    return NextResponse.json({ prompt });

  } catch (error) {
    console.error('Error fetching analysis prompt:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch analysis prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 