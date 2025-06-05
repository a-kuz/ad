import { NextResponse } from 'next/server';
import { generateSessionId, createSession } from '@/lib/database';

export async function POST() {
  try {
    const sessionId = generateSessionId();
    const session = await createSession(sessionId);
    
    return NextResponse.json({ sessionId: session.sessionId });
  } catch (error) {
    console.error('Error generating session:', error);
    return NextResponse.json(
      { error: 'Failed to generate session' },
      { status: 500 }
    );
  }
} 