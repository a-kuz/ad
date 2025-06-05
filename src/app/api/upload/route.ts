import { NextRequest, NextResponse } from 'next/server';
import { saveFileToDisk } from '@/lib/fileStorage';
import { addFilePairToSession, getSession } from '@/lib/database';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { UploadedFilePair } from '@/types';

export const dynamic = 'force-dynamic';

// Configure for large files
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '20mb',
  },
};

// Helper function to parse a form with files
async function parseForm(req: NextRequest): Promise<{
  fields: Record<string, string>;
  files: Record<string, { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> }>;
}> {
  const data = await req.formData();
  const files: Record<string, { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> }> = {};
  const fields: Record<string, string> = {};

  for (const entry of Array.from(data.entries())) {
    const [name, value] = entry;
    
    if (typeof value === 'object' && value !== null && 'arrayBuffer' in value && typeof value.arrayBuffer === 'function') {
      files[name as string] = {
        name: 'name' in value ? String(value.name) : 'unknown',
        type: 'type' in value ? String(value.type) : 'application/octet-stream',
        arrayBuffer: () => (value as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
      };
    } else {
      fields[name as string] = String(value);
    }
  }

  return { fields, files };
}

export async function POST(req: NextRequest) {
  try {
    const dataDir = join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true });

    const { fields, files } = await parseForm(req);
    
    if (!files.video || !files.graph) {
      return NextResponse.json(
        { error: 'Both video and graph files are required' },
        { status: 400 }
      );
    }

    const sessionId = fields.sessionId;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const videoBuffer = await files.video.arrayBuffer();
    const graphBuffer = await files.graph.arrayBuffer();

    const videoPath = await saveFileToDisk(
      Buffer.from(videoBuffer),
      files.video.name,
      'videos'
    );

    const graphPath = await saveFileToDisk(
      Buffer.from(graphBuffer),
      files.graph.name,
      'graphs'
    );

    const uploadedFilePair: UploadedFilePair = {
      id: uuidv4(),
      videoPath,
      graphPath,
      videoName: files.video.name,
      graphName: files.graph.name,
      uploadedAt: new Date().toISOString(),
    };

    addFilePairToSession(sessionId, uploadedFilePair);

    return NextResponse.json({ 
      success: true, 
      id: uploadedFilePair.id, 
      message: 'Files uploaded successfully' 
    });
  } catch (error) {
    console.error('Error handling upload:', error);
    return NextResponse.json(
      { error: 'Failed to process upload', details: String(error) },
      { status: 500 }
    );
  }
} 