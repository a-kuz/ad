import { ComprehensiveVideoAnalysis, DropoutCurveTable, AudioAnalysis, TextualVisualAnalysis, VisualAnalysis, BlockDropoutAnalysis } from '@/types';
import { analyzeDropoutCurveImage } from './dropoutAnalysis';
import { extractAudioFromVideo, transcribeAudioFile } from './audioProcessing';
import { extractScreenshots, analyzeTextInScreenshots, analyzeVisualContent } from './videoProcessing';
import { getVideoMetadata } from './videoProcessor';

export async function performComprehensiveAnalysis(
  sessionId: string,
  filePairId: string,
  videoPath: string,
  graphPath: string
): Promise<ComprehensiveVideoAnalysis> {
  try {
    console.log('=== COMPREHENSIVE ANALYSIS START ===');
    console.log('Session ID:', sessionId);
    console.log('File Pair ID:', filePairId);
    console.log('Video path (original):', videoPath);
    console.log('Graph path (original):', graphPath);
    
    // Конвертируем относительные пути в абсолютные
    const path = require('path');
    const fs = require('fs');
    
    // Если путь начинается с /uploads, добавляем public/
    const absoluteVideoPath = videoPath.startsWith('/uploads') ? 
      path.join(process.cwd(), 'public', videoPath) : 
      (videoPath.startsWith('/') ? 
        path.join(process.cwd(), 'public', videoPath) : 
        videoPath);
    
    const absoluteGraphPath = graphPath.startsWith('/uploads') ? 
      path.join(process.cwd(), 'public', graphPath) : 
      (graphPath.startsWith('/') ? 
        path.join(process.cwd(), 'public', graphPath) : 
        graphPath);
    
    console.log('Video path (absolute):', absoluteVideoPath);
    console.log('Graph path (absolute):', absoluteGraphPath);
    
    // Проверяем существование файлов
    console.log('Video file exists:', fs.existsSync(absoluteVideoPath));
    console.log('Graph file exists:', fs.existsSync(absoluteGraphPath));
    
    if (!fs.existsSync(absoluteVideoPath)) {
      throw new Error(`Video file not found: ${absoluteVideoPath}`);
    }
    
    if (!fs.existsSync(absoluteGraphPath)) {
      throw new Error(`Graph file not found: ${absoluteGraphPath}`);
    }
    
    // 0. Получаем метаданные видео для определения реальной продолжительности
    console.log('Step 0: Getting video metadata...');
    const videoMetadata = await getVideoMetadata(videoPath);
    console.log('Video duration:', videoMetadata.duration, 'seconds');
    
    // 1. Анализ кривой досмотра из изображения
    console.log('Step 1: Analyzing dropout curve...');
    const dropoutCurve = await analyzeDropoutCurveImage(absoluteGraphPath, videoMetadata.duration);
    
    // 2. Извлечение и анализ аудио
    console.log('Step 2: Processing audio...');
    const audioPath = await extractAudioFromVideo(absoluteVideoPath, sessionId);
    const audioAnalysis = await transcribeAudioFile(audioPath);
    
    // 3. Извлечение скриншотов
    console.log('Step 3: Extracting screenshots...');
    const screenshots = await extractScreenshots(absoluteVideoPath, sessionId, videoMetadata.duration);
    
    // 4. Анализ текста на скриншотах
    console.log('Step 4: Analyzing text in screenshots...');
    const textualVisualAnalysis = await analyzeTextInScreenshots(screenshots, 0.5);
    
    // 5. Визуальный анализ скриншотов
    console.log('Step 5: Analyzing visual content...');
    const visualAnalysis = await analyzeVisualContent(screenshots, 0.5);
    
    // 6. Сопоставление блоков с отвалами
    console.log('Step 6: Analyzing block dropouts...');
    const blockDropoutAnalysis = analyzeBlockDropouts(
      [...audioAnalysis.groups, ...textualVisualAnalysis.groups, ...visualAnalysis.groups],
      dropoutCurve
    );
    
    // 7. Создание временной шкалы
    console.log('Step 7: Creating timeline alignment...');
    const timelineAlignment = createTimelineAlignment(
      audioAnalysis.groups,
      textualVisualAnalysis.groups,
      visualAnalysis.groups,
      videoMetadata.duration
    );
    
    const result: ComprehensiveVideoAnalysis = {
      dropoutCurve,
      audioAnalysis,
      textualVisualAnalysis,
      visualAnalysis,
      blockDropoutAnalysis,
      timelineAlignment
    };
    
    console.log('Comprehensive analysis completed successfully');
    console.log('=== COMPREHENSIVE ANALYSIS END ===');
    return result;
    
  } catch (error) {
    console.error('=== COMPREHENSIVE ANALYSIS ERROR ===');
    console.error('Error in comprehensive analysis:', error);
    console.error('Session ID:', sessionId);
    console.error('File Pair ID:', filePairId);
    console.error('Video path:', videoPath);
    console.error('Graph path:', graphPath);
    console.error('=== END COMPREHENSIVE ANALYSIS ERROR ===');
    throw error;
  }
}

function analyzeBlockDropouts(blocks: any[], dropoutCurve: DropoutCurveTable): BlockDropoutAnalysis[] {
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

function createTimelineAlignment(
  audioBlocks: any[],
  textBlocks: any[],
  visualBlocks: any[],
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

// Функция для реального анализа (пока заглушка)
export async function performRealAnalysis(
  videoPath: string,
  graphPath: string
): Promise<ComprehensiveVideoAnalysis> {
  // TODO: Здесь будет реальная логика:
  // 1. Анализ кривой досмотра из графика
  // 2. Извлечение аудио из видео
  // 3. Транскрипция аудио
  // 4. Извлечение скриншотов
  // 5. Анализ текста на скриншотах
  // 6. Визуальный анализ скриншотов
  // 7. Сопоставление с отвалами
  
  console.log('Real analysis not implemented yet, using test data');
  // Получаем реальную продолжительность видео
  const { getVideoMetadata } = await import('./videoProcessor');
  try {
    const metadata = await getVideoMetadata(videoPath);
    return generateTestAnalysis(metadata.duration);
  } catch (error) {
    console.error('Failed to get video metadata, using default 30s:', error);
    return generateTestAnalysis(30);
  }
} 