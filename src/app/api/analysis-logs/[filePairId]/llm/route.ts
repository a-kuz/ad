import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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