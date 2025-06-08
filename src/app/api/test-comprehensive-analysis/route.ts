import { NextRequest, NextResponse } from 'next/server';
import { generateTestAnalysis } from '@/lib/testAnalysis';
import { getSession, saveVideoAnalysis, saveComprehensiveAnalysis } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, filePairId } = await request.json();
    
    if (!sessionId || !filePairId) {
      return NextResponse.json({ 
        error: 'Session ID and file pair ID are required' 
      }, { status: 400 });
    }

    console.log('Generating test comprehensive analysis...');
    
    const testAnalysis = generateTestAnalysis();

    const session = await getSession(sessionId);
    if (session) {
      const filePair = session.filePairs.find(fp => fp.id === filePairId);
      if (filePair) {
        const blockDropoutAnalysis = testAnalysis.blockDropoutAnalysis || [];
        const videoAnalysis = {
          id: filePairId,
          insights: `Тестовый комплексный анализ. Найдено ${blockDropoutAnalysis.length} блоков контента.`,
          recommendations: blockDropoutAnalysis
            .filter(block => block.relativeDropout > 20)
            .map(block => `Высокий отвал в блоке "${block.blockName}": ${block.relativeDropout.toFixed(1)}%`),
          criticalMoments: blockDropoutAnalysis
            .filter(block => block.relativeDropout > 30)
            .map(block => ({
              timestamp: block.startTime,
              reason: `Критический отвал в блоке "${block.blockName}"`,
              severity: 'high' as const
            })),
          overallScore: blockDropoutAnalysis.length > 0 ? 
            Math.max(0, Math.round(100 - blockDropoutAnalysis.reduce((avg, block) => avg + block.relativeDropout, 0) / blockDropoutAnalysis.length)) : 
            0,
          improvementAreas: blockDropoutAnalysis
            .filter(block => block.relativeDropout > 15)
            .map(block => `Оптимизировать блок "${block.blockName}"`),
          generatedAt: new Date().toISOString(),
          report: JSON.stringify(testAnalysis, null, 2)
        };
        
        await saveVideoAnalysis(filePairId, videoAnalysis);
        await saveComprehensiveAnalysis(filePairId, testAnalysis);
        
        console.log('Test comprehensive analysis completed');
        
        return NextResponse.json({
          success: true,
          analysis: testAnalysis,
          message: 'Test comprehensive analysis completed successfully'
        });
      }
    }

    return NextResponse.json({ 
      error: 'Session or file pair not found' 
    }, { status: 404 });

  } catch (error) {
    console.error('Error in test comprehensive analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to complete test analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 