import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisPrompt } from '@/lib/database';
import fs from 'fs';
import path from 'path';

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

export async function GET_LLM_LOGS(
  request: NextRequest,
  { params }: { params: { filePairId: string } }
) {
  try {
    const filePairId = params.filePairId;

    if (!filePairId) {
      return NextResponse.json(
        { error: 'File Pair ID is required' },
        { status: 400 }
      );
    }

    // Check if the logs directory exists for this filePairId
    const logsDir = path.join(process.cwd(), 'public', 'logs', 'llm', filePairId);
    
    if (!fs.existsSync(logsDir)) {
      return NextResponse.json(
        { error: 'No logs found for this File Pair ID' },
        { status: 404 }
      );
    }

    // Get all log files in the directory
    const logFiles = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.md'))
      .map(file => ({
        name: file,
        path: `/logs/llm/${filePairId}/${file}`,
        fullPath: path.join(logsDir, file),
        createdAt: fs.statSync(path.join(logsDir, file)).mtime.toISOString(),
        size: fs.statSync(path.join(logsDir, file)).size
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      filePairId,
      logs: logFiles
    });
  } catch (error) {
    console.error('Error getting LLM logs:', error);
    return NextResponse.json(
      { error: 'Failed to get LLM logs' },
      { status: 500 }
    );
  }
} 