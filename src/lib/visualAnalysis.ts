import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { VisualAnalysis, ContentBlock } from '@/types';
import { saveAnalysisPrompt } from '@/lib/database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_VISUAL_PROMPT = `Analyze this screenshot and describe what's happening. Return a JSON object with this structure:
{
  "description": "Brief description of what's happening in the video",
  "actions": ["action1", "action2"],
  "elements": ["element1", "element2"]
}

Focus on:
- Actions: What is happening (e.g., "person speaking", "demonstration", "transition")
- Elements: Visual elements present (e.g., "person", "product", "text overlay", "background")

Keep descriptions concise and factual.`;

const DEFAULT_MODEL = "gpt-4.1-mini";

/**
 * Performs visual analysis on a set of screenshots
 */
export async function analyzeVisualScreenshots({
  screenshots,
  screenshotsDir,
  sessionId,
  step = 0.5,
  filePairId,
  customPrompt,
  model
}: {
  screenshots?: string[];
  screenshotsDir?: string;
  sessionId?: string;
  step?: number;
  filePairId?: string;
  customPrompt?: string;
  model?: string;
}): Promise<VisualAnalysis> {
  try {
    console.log('Starting visual screenshots analysis');
    
    // Use custom prompt and model if provided, otherwise use defaults
    const prompt = customPrompt || DEFAULT_VISUAL_PROMPT;
    const aiModel = model || DEFAULT_MODEL;
    
    console.log(`Using model: ${aiModel}`);
    console.log(`Processing request with prompt length: ${prompt.length} characters`);
    
    // Save the prompt and model to the database if filePairId is provided
    if (filePairId) {
      console.log(`Saving prompt for filePairId: ${filePairId}`);
      await saveAnalysisPrompt(filePairId, 'visual', prompt, aiModel);
    }

    // Determine how to get the screenshot files
    let screenshotFiles: string[] = [];
    
    if (Array.isArray(screenshots) && screenshots.length > 0) {
      // Screenshots array was provided directly
      console.log(`Using ${screenshots.length} provided screenshot paths`);
      screenshotFiles = screenshots;
    } else if (screenshotsDir && sessionId) {
      // Find screenshots based on directory and session
      const fullScreenshotsDir = path.join(process.cwd(), 'public', 'uploads', sessionId, 'screenshots', screenshotsDir);
      console.log(`Looking for screenshots in: ${fullScreenshotsDir}`);
      
      if (fs.existsSync(fullScreenshotsDir)) {
        screenshotFiles = fs.readdirSync(fullScreenshotsDir)
          .filter(file => file.endsWith('.jpg'))
          .map(file => path.join(fullScreenshotsDir, file))
          .sort((a, b) => {
            const timeA = parseFloat(a.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
            const timeB = parseFloat(b.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
            return timeA - timeB;
          });
        console.log(`Found ${screenshotFiles.length} screenshots in directory`);
      } else {
        console.error(`Screenshots directory not found: ${fullScreenshotsDir}`);
        throw new Error('Screenshots directory not found');
      }
    } else {
      console.error('Neither screenshots array nor directory info provided');
      throw new Error('Screenshots array or directory info is required');
    }
    
    if (screenshotFiles.length === 0) {
      console.error('No screenshots available for analysis');
      throw new Error('No screenshots available for analysis');
    }

    const visualAnalysis: Array<{
      timestamp: number;
      description: string;
      actions: string[];
      elements: string[];
    }> = [];

    console.log(`Processing ${screenshotFiles.length} screenshots with step ${step}s`);

    // Select a subset of screenshots to reduce processing time
    const maxScreenshots = 20;
    const sampleInterval = Math.max(1, Math.floor(screenshotFiles.length / maxScreenshots));
    const selectedScreenshots = screenshotFiles.filter((_, index) => index % sampleInterval === 0);
    
    console.log(`Selected ${selectedScreenshots.length} out of ${screenshotFiles.length} screenshots for analysis (interval: ${sampleInterval})`);

    for (let i = 0; i < selectedScreenshots.length; i++) {
      const screenshotPath = selectedScreenshots[i];
      const timestamp = i * sampleInterval * step;

      try {
        console.log(`Processing screenshot ${i+1}/${selectedScreenshots.length}: ${path.basename(screenshotPath)}`);
        
        if (!fs.existsSync(screenshotPath)) {
          console.warn(`Screenshot not found: ${screenshotPath}`);
          continue;
        }

        let imageBuffer;
        try {
          imageBuffer = fs.readFileSync(screenshotPath);
        } catch (readError) {
          console.error(`Error reading screenshot file at ${screenshotPath}:`, readError);
          continue;
        }

        if (!imageBuffer || imageBuffer.length === 0) {
          console.error(`Empty image buffer for screenshot: ${screenshotPath}`);
          continue;
        }

        const base64Image = imageBuffer.toString('base64');
        console.log(`Sending screenshot to OpenAI (size: ${(base64Image.length / 1024).toFixed(2)} KB)`);

        try {
          const response = await openai.chat.completions.create({
            model: aiModel,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: prompt
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
              console.log(`Successfully parsed response for screenshot ${i+1}`);
            } catch (parseError) {
              console.error(`Error parsing OpenAI response: ${parseError.message}`);
              console.log('Raw content:', content);
              
              // Добавляем неразобранный контент как описание
              visualAnalysis.push({
                timestamp,
                description: content.substring(0, 200), // Ограничиваем длину описания
                actions: [],
                elements: []
              });
              console.log(`Added raw content as description for screenshot ${i+1}`);
            }
          } else {
            console.warn(`Empty response from OpenAI for screenshot ${i+1}`);
            visualAnalysis.push({
              timestamp,
              description: '',
              actions: [],
              elements: []
            });
          }
        } catch (apiError) {
          console.error(`API error for screenshot ${i+1}:`, apiError);
          visualAnalysis.push({
            timestamp,
            description: `Error analyzing screenshot: ${apiError.message}`,
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

    console.log(`Visual analysis complete for ${visualAnalysis.length} screenshots. Grouping content...`);

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

    console.log('Sending grouping request to OpenAI');
    const groupingResponse = await openai.chat.completions.create({
      model: aiModel,
      messages: [{ role: "user", content: groupingPrompt }],
      temperature: 0.2
    });

    let groups: ContentBlock[] = [];
    try {
      const content = groupingResponse.choices[0].message.content || '[]';
      console.log(`Received grouping response (${content.length} characters)`);
      
      try {
        const groupsData = JSON.parse(content);
        groups = groupsData.map((group: any) => ({
          ...group,
          id: group.id || uuidv4()
        }));
        console.log(`Successfully parsed ${groups.length} content groups`);
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        console.log('Raw content:', content);
        
        // Попытка исправить часто встречающиеся проблемы с JSON
        let fixedContent = content.trim();
        // Если контент не начинается с [, добавим его
        if (!fixedContent.startsWith('[')) {
          const startBracketIndex = fixedContent.indexOf('[');
          if (startBracketIndex > -1) {
            fixedContent = fixedContent.substring(startBracketIndex);
          } else {
            fixedContent = '[]'; // Если [ вообще нет, вернем пустой массив
          }
        }
        
        try {
          const fixedGroupsData = JSON.parse(fixedContent);
          groups = fixedGroupsData.map((group: any) => ({
            ...group,
            id: group.id || uuidv4()
          }));
          console.log(`Successfully parsed ${groups.length} content groups after fixing JSON`);
        } catch (fixedJsonError) {
          console.error('Failed to parse fixed JSON, using empty array for groups:', fixedJsonError);
          groups = [];
        }
      }
    } catch (parseError) {
      console.error('Failed to parse grouping response:', parseError);
      groups = [];
    }

    const analysis: VisualAnalysis = {
      screenshots: visualAnalysis,
      groups,
      prompt,
      model: aiModel,
      screenshotsDir: screenshotsDir // Сохраняем ID папки со скриншотами
    };

    console.log('Analysis complete, returning results');
    return analysis;

  } catch (error) {
    console.error('Error analyzing visual screenshots:', error);
    throw error;
  }
} 