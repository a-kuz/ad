import { ComprehensiveVideoAnalysis, VisualAnalysis, AudioAnalysis, TextualVisualAnalysis, DropoutCurve, ContentBlock, BlockDropoutAnalysis } from '@/types';
import OpenAI from 'openai';
import { createLoggingOpenAI } from './llmLogger';

// Default OpenAI client, will be replaced with logging client when needed
let openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Finds blocks that intersect with a given time range
 */
function findBlocksInTimeRange(
  blocks: ContentBlock[],
  startTime: number,
  endTime: number
): ContentBlock[] {
  return blocks.filter(block => {
    // A block intersects with our range if:
    // 1. Block start is within our range, or
    // 2. Block end is within our range, or
    // 3. Block contains our range completely
    const blockStartsInRange = block.startTime >= startTime && block.startTime < endTime;
    const blockEndsInRange = block.endTime > startTime && block.endTime <= endTime;
    const blockContainsRange = block.startTime <= startTime && block.endTime >= endTime;
    
    return blockStartsInRange || blockEndsInRange || blockContainsRange;
  });
}

/**
 * Calculates dropout percentages for content blocks
 */
export async function analyzeBlockDropouts({
  dropoutCurve,
  audioAnalysis,
  textualVisualAnalysis,
  visualAnalysis,
  filePairId
}: {
  dropoutCurve: DropoutCurve;
  audioAnalysis: AudioAnalysis;
  textualVisualAnalysis?: TextualVisualAnalysis;
  visualAnalysis: VisualAnalysis;
  filePairId?: string;
}): Promise<ComprehensiveVideoAnalysis> {
  // Set up logging OpenAI client if filePairId is provided
  let llmLogger;
  if (filePairId) {
    console.log(`Setting up LLM logging for blockDropoutAnalysis with filePairId: ${filePairId}`);
    const loggingClient = createLoggingOpenAI(filePairId);
    openai = loggingClient.openai;
    llmLogger = loggingClient.logger;
  }
  // Combine all content blocks from different analysis types
  const allBlocks: ContentBlock[] = [
    ...(audioAnalysis?.groups || []),
    ...(textualVisualAnalysis?.groups || []),
    ...(visualAnalysis?.groups || [])
  ];
  
  // Sort blocks by start time
  allBlocks.sort((a, b) => a.startTime - b.startTime);
  
  // For each block, calculate the dropout percentage
  for (const block of allBlocks) {
    try {
      // Find the dropout points that fall within this content block's time range
      const relevantDropouts = dropoutCurve.dropouts.filter(
        dropout => dropout.time >= block.startTime && dropout.time <= block.endTime
      );
      
      if (relevantDropouts.length === 0) {
        // No dropouts in this block
        block.dropoutPercentage = 0;
        block.dropoutCount = 0;
        continue;
      }
      
      // Find the viewer count at the start of the block
      // First find the closest point before the block starts
      const pointsBeforeBlock = dropoutCurve.dropouts.filter(point => point.time <= block.startTime)
        .sort((a, b) => b.time - a.time); // Sort in descending order by time
      
      // The starting viewers is the viewers after the most recent dropout before the block starts
      // If no such point exists, use the initial viewer count
      const startingViewers = pointsBeforeBlock.length > 0 
        ? pointsBeforeBlock[0].viewersAfter
        : dropoutCurve.initialViewers;
      
      // Sum up all dropouts within the block
      const totalDropouts = relevantDropouts.reduce((sum, dropout) => sum + dropout.count, 0);
      
      // Calculate dropout percentage relative to viewers at the start of the block
      const dropoutPercentage = startingViewers > 0 
        ? (totalDropouts / startingViewers) * 100
        : 0;
      
      block.dropoutPercentage = dropoutPercentage;
      block.dropoutCount = totalDropouts;
      
    } catch (error) {
      console.error(`Error calculating dropout for block ${block.id}:`, error);
      block.dropoutPercentage = 0;
      block.dropoutCount = 0;
    }
  }
  
  // For high dropout blocks, add a prompt to analyze why these blocks might have high dropout
  const highDropoutBlocks = allBlocks.filter(block => block.dropoutPercentage > 5);
  
  if (highDropoutBlocks.length > 0) {
    console.log(`Analyzing ${highDropoutBlocks.length} high dropout blocks`);
    
    // Format blocks for analysis
    const blocksForAnalysis = highDropoutBlocks.map(block => ({
      id: block.id,
      name: block.name,
      startTime: block.startTime,
      endTime: block.endTime,
      content: block.content,
      purpose: block.purpose,
      type: block.type,
      dropoutPercentage: block.dropoutPercentage,
      dropoutCount: block.dropoutCount
    }));
    
    // Create an analysis prompt
    const analysisPrompt = `
    You are analyzing content blocks from an advertising video where viewers dropped out at a higher than normal rate.
    For each block, suggest possible reasons for the dropouts based on the content and timing.
    
    Here are the high dropout blocks:
    ${JSON.stringify(blocksForAnalysis, null, 2)}
    
    For each block, provide:
    1. A brief analysis of why viewers might be dropping out during this block
    2. Suggestions for how to improve this part of the video
    3. Whether this dropout is expected or concerning
    
    Return a JSON object with this structure:
    {
      "blockAnalyses": [
        {
          "blockId": "id of the block",
          "analysis": "analysis of why viewers might be dropping out",
          "suggestions": ["suggestion 1", "suggestion 2"],
          "isExpectedDropout": true/false
        }
      ]
    }
    `;
    
    try {
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: analysisPrompt }],
        temperature: 0.5
      });
      
      const analysisContent = analysisResponse.choices[0].message.content;
      if (analysisContent) {
        try {
          const dropoutAnalysis = JSON.parse(analysisContent);
          
          // Attach analysis to blocks
          for (const blockAnalysis of dropoutAnalysis.blockAnalyses || []) {
            if (!blockAnalysis || !blockAnalysis.blockId) continue;
            
            const block = allBlocks.find(b => b.id === blockAnalysis.blockId);
            if (block) {
              block.dropoutAnalysis = {
                analysis: blockAnalysis.analysis || '',
                suggestions: Array.isArray(blockAnalysis.suggestions) ? blockAnalysis.suggestions : [],
                isExpectedDropout: !!blockAnalysis.isExpectedDropout
              };
            }
          }
        } catch (jsonError) {
          console.error('Error parsing dropout analysis JSON:', jsonError);
          console.log('Raw content:', analysisContent);
        }
      }
    } catch (error) {
      console.error('Error analyzing high dropout blocks:', error);
    }
  }
  
  // Create blockDropoutAnalysis array with statistics for each block
  const blockDropoutAnalysis: BlockDropoutAnalysis[] = allBlocks.map(block => {
    // Find the viewer count at the start and end of the block
    const pointsBeforeStart = dropoutCurve.dropouts.filter(point => point.time <= block.startTime)
      .sort((a, b) => b.time - a.time);
    const pointsBeforeEnd = dropoutCurve.dropouts.filter(point => point.time <= block.endTime)
      .sort((a, b) => b.time - a.time);
    
    const startViewers = pointsBeforeStart.length > 0 
      ? pointsBeforeStart[0].viewersAfter
      : dropoutCurve.initialViewers;
    const endViewers = pointsBeforeEnd.length > 0 
      ? pointsBeforeEnd[0].viewersAfter
      : dropoutCurve.initialViewers;
    
    const startRetention = (startViewers / dropoutCurve.initialViewers) * 100;
    const endRetention = (endViewers / dropoutCurve.initialViewers) * 100;
    const absoluteDropout = startRetention - endRetention;
    const relativeDropout = startRetention > 0 ? (absoluteDropout / startRetention) * 100 : 0;
    
    return {
      blockId: block.id,
      blockName: block.name,
      startTime: block.startTime,
      endTime: block.endTime,
      startRetention: Math.round(startRetention * 100) / 100,
      endRetention: Math.round(endRetention * 100) / 100,
      absoluteDropout: Math.round(absoluteDropout * 100) / 100,
      relativeDropout: Math.round(relativeDropout * 100) / 100,
      dropoutPercentage: Math.round((100 - endRetention) * 100) / 100
    };
  });

  // Save the LLM logs to a file if we have a logger
  if (llmLogger && llmLogger.getLogCount() > 0) {
    try {
      const logFilePath = await llmLogger.saveToFile();
      console.log(`LLM prompts and responses saved to: ${logFilePath}`);
    } catch (logError) {
      console.error('Error saving LLM logs:', logError);
    }
  }

  // Return the comprehensive analysis with the updated blocks and dropout analysis
  return {
    dropoutCurve,
    audioAnalysis,
    textualVisualAnalysis,
    visualAnalysis,
    contentBlocks: allBlocks,
    blockDropoutAnalysis
  };
} 