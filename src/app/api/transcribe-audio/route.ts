import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import { AudioAnalysis, ContentBlock } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { audioPath } = await request.json();
    
    if (!audioPath) {
      return NextResponse.json({ error: 'Audio path is required' }, { status: 400 });
    }

    if (!fs.existsSync(audioPath)) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }

    const audioFile = fs.createReadStream(audioPath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"]
    });

    const transcriptionWithTimestamps = transcription.segments?.map(segment => ({
      timestamp: segment.start || 0,
      text: segment.text || '',
      confidence: 1.0
    })) || [];

    const groupingPrompt = `
    Analyze this audio transcription and group it into meaningful content blocks. 
    Each block should represent a distinct topic, section, or creative element.
    
    Transcription:
    ${transcriptionWithTimestamps.map(t => `[${t.timestamp}s] ${t.text}`).join('\n')}
    
    Return a JSON array of content blocks with this structure:
    [
      {
        "id": "unique_id",
        "name": "Block Name",
        "startTime": start_time_in_seconds,
        "endTime": end_time_in_seconds,
        "type": "audio",
        "content": "summary of content",
        "purpose": "purpose or goal of this block"
      }
    ]
    
    Make sure blocks don't overlap and cover the entire duration.
    `;

    const groupingResponse = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: groupingPrompt }],
      temperature: 0.2
    });

    let groups: ContentBlock[] = [];
    try {
      const groupsData = JSON.parse(groupingResponse.choices[0].message.content || '[]');
      groups = groupsData.map((group: any) => ({
        ...group,
        id: group.id || uuidv4()
      }));
    } catch (parseError) {
      console.error('Failed to parse grouping response:', parseError);
    }

    const audioAnalysis: AudioAnalysis = {
      transcription: transcriptionWithTimestamps,
      groups
    };

    return NextResponse.json(audioAnalysis);

  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json({ 
      error: 'Failed to transcribe audio',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 