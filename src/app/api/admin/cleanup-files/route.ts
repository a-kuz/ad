import { NextResponse } from 'next/server';
import { cleanupPublicFiles } from '@/lib/database';

export async function POST() {
  try {
    const result = await cleanupPublicFiles();
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error cleaning up files:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup files' },
      { status: 500 }
    );
  }
} 