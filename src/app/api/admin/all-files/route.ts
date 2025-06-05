import { NextResponse } from 'next/server';
import { getAllSessions } from '@/lib/database';
import { UploadedFilePair } from '@/types';

export async function GET() {
  try {
    // Optional: add token validation here as well for extra security
    // const url = new URL(request.url);
    // const token = url.searchParams.get('token');
    // if (!token || !isValidAdminToken(token)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const sessions = await getAllSessions();
    
    const allFiles = sessions.reduce((acc: (UploadedFilePair & { sessionId: string })[], session) => {
      session.filePairs.forEach(pair => {
        acc.push({ ...pair, sessionId: session.sessionId });
      });
      return acc;
    }, []);
    
    // Sort by upload date, newest first
    allFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json(allFiles);
  } catch (error) {
    console.error('Error fetching all files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch all files' },
      { status: 500 }
    );
  }
} 