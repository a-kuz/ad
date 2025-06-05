import { NextRequest, NextResponse } from 'next/server';
import { 
  DropoutCurveTable, 
  ContentBlock, 
  BlockDropoutAnalysis,
  ComprehensiveVideoAnalysis,
  AudioAnalysis,
  TextualVisualAnalysis,
  VisualAnalysis
} from '@/types';

function getRetentionAtTime(dropoutCurve: DropoutCurveTable, timestamp: number): number {
  const point = dropoutCurve.points.find(p => Math.abs(p.timestamp - timestamp) < 0.25);
  if (point) {
    return point.retentionPercentage;
  }
  
  const beforePoint = dropoutCurve.points
    .filter(p => p.timestamp <= timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  
  const afterPoint = dropoutCurve.points
    .filter(p => p.timestamp >= timestamp)
    .sort((a, b) => a.timestamp - b.timestamp)[0];

  if (!beforePoint && afterPoint) return afterPoint.retentionPercentage;
  if (beforePoint && !afterPoint) return beforePoint.retentionPercentage;
  if (!beforePoint && !afterPoint) return 100;

  const ratio = (timestamp - beforePoint.timestamp) / (afterPoint.timestamp - beforePoint.timestamp);
  return beforePoint.retentionPercentage + 
         ratio * (afterPoint.retentionPercentage - beforePoint.retentionPercentage);
}

function analyzeBlockDropouts(blocks: ContentBlock[], dropoutCurve: DropoutCurveTable): BlockDropoutAnalysis[] {
  return blocks.map(block => {
    const startRetention = getRetentionAtTime(dropoutCurve, block.startTime);
    const endRetention = getRetentionAtTime(dropoutCurve, block.endTime);
    const absoluteDropout = startRetention - endRetention;
    // Относительный отвал = абсолютное падение в процентных пунктах
    const relativeDropout = Math.max(0, absoluteDropout);

    return {
      blockId: block.id,
      blockName: block.name,
      startTime: block.startTime,
      endTime: block.endTime,
      startRetention,
      endRetention,
      absoluteDropout,
      relativeDropout
    };
  });
}

function createTimelineAlignment(
  audioBlocks: ContentBlock[],
  textBlocks: ContentBlock[],
  visualBlocks: ContentBlock[],
  totalDuration: number
): Array<{
  timestamp: number;
  audioBlock?: string;
  textBlock?: string;
  visualBlock?: string;
}> {
  const timeline: Array<{
    timestamp: number;
    audioBlock?: string;
    textBlock?: string;
    visualBlock?: string;
  }> = [];

  const step = 0.5;
  for (let t = 0; t <= totalDuration; t += step) {
    const audioBlock = audioBlocks.find(b => t >= b.startTime && t <= b.endTime);
    const textBlock = textBlocks.find(b => t >= b.startTime && t <= b.endTime);
    const visualBlock = visualBlocks.find(b => t >= b.startTime && t <= b.endTime);

    timeline.push({
      timestamp: t,
      audioBlock: audioBlock?.name,
      textBlock: textBlock?.name,
      visualBlock: visualBlock?.name
    });
  }

  return timeline;
}

export async function POST(request: NextRequest) {
  try {
    const {
      dropoutCurve,
      audioAnalysis,
      textualVisualAnalysis,
      visualAnalysis
    }: {
      dropoutCurve: DropoutCurveTable;
      audioAnalysis: AudioAnalysis;
      textualVisualAnalysis: TextualVisualAnalysis;
      visualAnalysis: VisualAnalysis;
    } = await request.json();

    if (!dropoutCurve || !audioAnalysis || !textualVisualAnalysis || !visualAnalysis) {
      return NextResponse.json({ 
        error: 'All analysis data is required' 
      }, { status: 400 });
    }

    const audioDropouts = analyzeBlockDropouts(audioAnalysis.groups, dropoutCurve);
    const textDropouts = analyzeBlockDropouts(textualVisualAnalysis.groups, dropoutCurve);
    const visualDropouts = analyzeBlockDropouts(visualAnalysis.groups, dropoutCurve);

    const allBlockDropouts = [
      ...audioDropouts,
      ...textDropouts,
      ...visualDropouts
    ];

    const timelineAlignment = createTimelineAlignment(
      audioAnalysis.groups,
      textualVisualAnalysis.groups,
      visualAnalysis.groups,
      dropoutCurve.totalDuration
    );

    const comprehensiveAnalysis: ComprehensiveVideoAnalysis = {
      dropoutCurve,
      audioAnalysis,
      textualVisualAnalysis,
      visualAnalysis,
      blockDropoutAnalysis: allBlockDropouts,
      timelineAlignment
    };

    return NextResponse.json(comprehensiveAnalysis);

  } catch (error) {
    console.error('Error analyzing block dropouts:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze block dropouts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 