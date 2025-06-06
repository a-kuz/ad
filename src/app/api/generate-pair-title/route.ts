import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { sessionId, filePairId } = await request.json();
    
    if (!sessionId || !filePairId) {
      return NextResponse.json({ error: 'Session ID and file pair ID are required' }, { status: 400 });
    }
    
    // Get the session data directly using the database function
    const session = await getSession(sessionId);
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const filePair = session.filePairs.find(pair => pair.id === filePairId);
    
    if (!filePair) {
      return NextResponse.json({ error: 'File pair not found in session' }, { status: 404 });
    }
    
    const prompt = `
    You are helping generate a concise, descriptive title for a video analytics session.
    
    Video file name: ${filePair.videoName}
    Graph file name: ${filePair.graphName}
    
    Generate a short, concise title (maximum 50 characters) that clearly describes what this video is likely about,
    based on the file names. Do not include extensions like .mp4 or .jpg in your title.
    
    Title:
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0.7,
    });
    
    const title = response.choices[0].message.content?.trim() || `Video Analysis ${new Date().toLocaleDateString()}`;
    
    return NextResponse.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json({ 
      error: 'Failed to generate title', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 