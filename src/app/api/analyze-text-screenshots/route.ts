import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import { TextualVisualAnalysis, ContentBlock } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { screenshots, step } = await request.json();
    
    if (!screenshots || !Array.isArray(screenshots)) {
      return NextResponse.json({ error: 'Screenshots array is required' }, { status: 400 });
    }

    const textAnalysis: Array<{
      timestamp: number;
      text: string;
      confidence: number;
    }> = [];

    for (let i = 0; i < screenshots.length; i++) {
      const screenshotPath = screenshots[i];
      const timestamp = i * (step || 0.5);

      try {
        if (!fs.existsSync(screenshotPath)) {
          console.warn(`Screenshot not found: ${screenshotPath}`);
          continue;
        }

        const imageBuffer = fs.readFileSync(screenshotPath);
        const base64Image = imageBuffer.toString('base64');

        const response = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract ALL visible text from this screenshot. Return ONLY the text content, nothing else. If no text is visible, return "NO_TEXT".`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        });

        const extractedText = response.choices[0].message.content?.trim() || '';
        
        textAnalysis.push({
          timestamp,
          text: extractedText === 'NO_TEXT' ? '' : extractedText,
          confidence: 0.9
        });

      } catch (error) {
        console.error(`Error analyzing screenshot at ${timestamp}s:`, error);
        textAnalysis.push({
          timestamp,
          text: '',
          confidence: 0
        });
      }
    }

    const groupingPrompt = `
    Analyze these text screenshots and group them into meaningful content blocks.
    Each block should represent a distinct text section or UI element that appears on screen.
    
    Text Analysis:
    ${textAnalysis.map(t => `[${t.timestamp}s] ${t.text || '(no text)'}`).join('\n')}
    
    Return a JSON array of content blocks with this structure:
    [
      {
        "id": "unique_id",
        "name": "Block Name (e.g., 'Title Screen', 'Instruction Text', 'Button Labels')",
        "startTime": start_time_in_seconds,
        "endTime": end_time_in_seconds,
        "type": "text",
        "content": "summary of text content",
        "purpose": "purpose of this text block"
      }
    ]
    
    Make sure blocks don't overlap and cover periods where similar text content appears.
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

    const textualAnalysis: TextualVisualAnalysis = {
      screenshots: textAnalysis,
      groups
    };

    return NextResponse.json(textualAnalysis);

  } catch (error) {
    console.error('Error analyzing text screenshots:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze text screenshots',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 