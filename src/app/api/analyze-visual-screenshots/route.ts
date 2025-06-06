import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import { VisualAnalysis, ContentBlock } from '@/types';
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

    const visualAnalysis: Array<{
      timestamp: number;
      description: string;
      actions: string[];
      elements: string[];
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
                  text: `Analyze this screenshot and describe what's happening. Return a JSON object with this structure:
                  {
                    "description": "Brief description of what's happening in the video",
                    "actions": ["action1", "action2"],
                    "elements": ["element1", "element2"]
                  }
                  
                  Focus on:
                  - Actions: What is happening (e.g., "person speaking", "demonstration", "transition")
                  - Elements: Visual elements present (e.g., "person", "product", "text overlay", "background")
                  
                  Keep descriptions concise and factual.`
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
          max_tokens: 500,
          temperature: 0.2
        });

        const content = response.choices[0].message.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            visualAnalysis.push({
              timestamp,
              description: parsed.description || '',
              actions: Array.isArray(parsed.actions) ? parsed.actions : [],
              elements: Array.isArray(parsed.elements) ? parsed.elements : []
            });
          } catch (parseError) {
            visualAnalysis.push({
              timestamp,
              description: content,
              actions: [],
              elements: []
            });
          }
        } else {
          visualAnalysis.push({
            timestamp,
            description: '',
            actions: [],
            elements: []
          });
        }

      } catch (error) {
        console.error(`Error analyzing screenshot at ${timestamp}s:`, error);
        visualAnalysis.push({
          timestamp,
          description: '',
          actions: [],
          elements: []
        });
      }
    }

    const groupingPrompt = `
    You are analyzing an advertising video to study audience retention over the timeline. Analyze these visual descriptions and group them into small, fine-grained content blocks.
    IMPORTANT: Create short blocks of 1-3 seconds duration, don't combine different scenes into long blocks.
    
    CONTEXT: This is analysis of an advertising video to understand how visual elements and scenes affect viewer retention at specific moments in time.
    
    Visual Analysis:
    ${visualAnalysis.map(v => `[${v.timestamp}s] ${v.description} | Actions: ${v.actions.join(', ')} | Elements: ${v.elements.join(', ')}`).join('\n')}
    
    Grouping rules:
    - Each block should be maximum 1-3 seconds long
    - Create separate blocks for each scene change or action
    - Don't combine different visual elements into one long block
    - Focus on micro-scenes and specific moments
    - If actions or elements change, create new blocks
    - Consider advertising specifics: product demonstrations, people's faces, scene transitions, brand elements
    
    Return a JSON array of content blocks with this structure:
    [
      {
        "id": "unique_id",
        "name": "Block Name (e.g., 'Introduction Scene', 'Product Demo', 'Call to Action')",
        "startTime": start_time_in_seconds,
        "endTime": end_time_in_seconds,
        "type": "visual",
        "content": "summary of visual content and actions",
        "purpose": "purpose of this visual block"
      }
    ]
    
    Make sure blocks don't overlap and represent cohesive visual sequences.
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

    const analysis: VisualAnalysis = {
      screenshots: visualAnalysis,
      groups
    };

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('Error analyzing visual screenshots:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze visual screenshots',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 