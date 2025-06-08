import { ComprehensiveVideoAnalysis, DropoutCurveTable, AudioAnalysis, TextualVisualAnalysis, VisualAnalysis, BlockDropoutAnalysis } from '@/types';
import { analyzeDropoutCurveImage } from './dropoutAnalysis';
import { extractAudioFromVideo, transcribeAudioFile } from './audioProcessing';
import { extractScreenshots, analyzeTextInScreenshots, analyzeVisualContent } from './videoProcessing';
import { getVideoMetadata } from './videoProcessor';
import OpenAI from 'openai';
import { generateTestAnalysis } from './testAnalysis';
import { validateAndFixAnalysis } from './mathValidation';
import { AnalysisLogger } from './analysisLogger';
import { clearAnalysisLogs } from './database';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function performComprehensiveAnalysis(
  sessionId: string,
  filePairId: string,
  videoPath: string,
  graphPath: string
): Promise<ComprehensiveVideoAnalysis> {
  const logger = new AnalysisLogger(filePairId);
  
  try {
    await clearAnalysisLogs(filePairId);
    await logger.logStandalone('START', 'Начинаем комплексный анализ видео');
    
    console.log('=== COMPREHENSIVE ANALYSIS START ===');
    console.log('Session ID:', sessionId);
    console.log('File Pair ID:', filePairId);
    console.log('Video path (original):', videoPath);
    console.log('Graph path (original):', graphPath);
    
    await logger.startStep('VALIDATION', 'Проверка файлов и подготовка');
    
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
      await logger.errorStep(`Видео файл не найден: ${videoPath}`);
      throw new Error(`Video file not found: ${absoluteVideoPath}`);
    }
    
    if (!fs.existsSync(absoluteGraphPath)) {
      await logger.errorStep(`График не найден: ${graphPath}`);
      throw new Error(`Graph file not found: ${absoluteGraphPath}`);
    }
    
    await logger.completeStep('Файлы найдены и проверены');
    
    // 0. Получаем метаданные видео для определения реальной продолжительности
    await logger.startStep('METADATA', 'Получение метаданных видео');
    console.log('Step 0: Getting video metadata...');
    const videoMetadata = await getVideoMetadata(videoPath);
    console.log('Video duration:', videoMetadata.duration, 'seconds');
    await logger.completeStep(`Длительность видео: ${videoMetadata.duration} секунд`);
    
    // 1. Анализ кривой досмотра из изображения
    await logger.startStep('DROPOUT_CURVE', 'Анализ кривой досмотра из графика');
    console.log('Step 1: Analyzing dropout curve...');
    const dropoutCurve = await analyzeDropoutCurveImage(absoluteGraphPath, videoMetadata.duration);
    await logger.completeStep(`Найдено ${dropoutCurve.points.length} точек на кривой досмотра`);
    
    // 2. Извлечение и анализ аудио
    await logger.startStep('AUDIO_EXTRACTION', 'Извлечение аудио из видео');
    console.log('Step 2: Processing audio...');
    const audioPath = await extractAudioFromVideo(absoluteVideoPath, sessionId, logger);
    await logger.completeStep('Аудио извлечено успешно');
    
    // 2a. Транскрипция аудио
    await logger.startStep('AUDIO_TRANSCRIPTION', 'Транскрипция и анализ аудио');
    const audioAnalysis = await transcribeAudioFile(audioPath, logger);
    // Завершение шага происходит внутри transcribeAudioFile
    
    // 3. Извлечение скриншотов
    await logger.startStep('SCREENSHOTS', 'Извлечение скриншотов из видео');
    console.log('Step 3: Extracting screenshots...');
    const screenshots = await extractScreenshots(absoluteVideoPath, sessionId, videoMetadata.duration, filePairId);
    await logger.completeStep(`Извлечено ${screenshots.length} скриншотов`, { 
      screenshots: screenshots.length 
    });
    
    // 4. и 5. Анализ текста и визуального контента параллельно
    await logger.startStep('TEXT_AND_VISUAL_ANALYSIS', 'Анализ текста и визуального контента');
    console.log('Step 4 & 5: Analyzing text and visual content in parallel...');
    await logger.updateStep('Обработка скриншотов для анализа текста и визуального контента...', { progress: 20 });

    const [textualVisualAnalysis, visualAnalysis] = await Promise.all([
      (async () => {
        await logger.startStep('TEXT_ANALYSIS', 'Анализ текста на скриншотах');
        const textResult = await analyzeTextInScreenshots(screenshots, 0.5);
        await logger.completeStep(`Найдено ${textResult.groups.length} текстовых блоков`, {
          textBlocks: textResult.groups.length
        });
        return textResult;
      })(),
      (async () => {
        await logger.startStep('VISUAL_ANALYSIS', 'Анализ визуального контента');
        const visualResult = await analyzeVisualContent(screenshots, 0.5);
        await logger.completeStep(`Найдено ${visualResult.groups.length} визуальных блоков`, {
          visualBlocks: visualResult.groups.length
        });
        return visualResult;
      })()
    ]);

    await logger.completeStep(`Анализ завершен: ${textualVisualAnalysis.groups.length} текстовых и ${visualAnalysis.groups.length} визуальных блоков`, { progress: 50 });
    
    // 6. Сопоставление блоков с отвалами
    await logger.startStep('BLOCK_DROPOUT', 'Анализ отвалов по блокам');
    console.log('Step 6: Analyzing block dropouts...');
    await logger.updateStep('Сопоставление блоков с кривой досмотра...', { progress: 40 });
    const blockDropoutAnalysis = analyzeBlockDropouts(
      [...audioAnalysis.groups, ...textualVisualAnalysis.groups, ...visualAnalysis.groups],
      dropoutCurve
    );
    await logger.completeStep(`Проанализировано ${blockDropoutAnalysis.length} блоков на отвалы`);
    
    // 7. Создание временной шкалы
    await logger.startStep('TIMELINE', 'Создание временной шкалы');
    console.log('Step 7: Creating timeline alignment...');
    await logger.updateStep('Выравнивание блоков по временной шкале...', { progress: 60 });
    const timelineAlignment = createTimelineAlignment(
      audioAnalysis.groups,
      textualVisualAnalysis.groups,
      visualAnalysis.groups,
      videoMetadata.duration
    );
    await logger.completeStep('Временная шкала создана');
    
    // 8. Улучшение описаний блоков через GPT
    await logger.startStep('IMPROVE_DESCRIPTIONS', 'Улучшение описаний блоков');
    console.log('Step 8: Improving block descriptions...');
    await logger.updateStep('Улучшение описаний аудио блоков...', { progress: 20 });
    const improvedAudioAnalysis = await improveBlockDescriptions(audioAnalysis);
    await logger.updateStep('Улучшение описаний текстовых блоков...', { progress: 60 });
    const improvedTextualVisualAnalysis = await improveBlockDescriptions(textualVisualAnalysis);
    await logger.updateStep('Улучшение описаний визуальных блоков...', { progress: 80 });
    const improvedVisualAnalysis = await improveBlockDescriptions(visualAnalysis);
    await logger.completeStep('Описания блоков улучшены');
    
    // Валидируем и исправляем математические ошибки
    await logger.startStep('VALIDATION', 'Валидация и финализация результатов');
    const validationResult = validateAndFixAnalysis(dropoutCurve, blockDropoutAnalysis);
    
    if (!validationResult.isValid) {
      console.warn('=== MATHEMATICAL VALIDATION WARNINGS ===');
      validationResult.errors.forEach(error => console.warn(error));
      console.warn('=== END VALIDATION WARNINGS ===');
      await logger.updateStep('Найдены предупреждения при валидации, результаты исправлены');
    }

    // 9. Генерация итоговой таблицы анализа блоков
    await logger.startStep('SUMMARY_TABLE', 'Создание итоговой таблицы анализа');
    console.log('Step 9: Generating visual blocks analysis table...');
    const visualBlocksAnalysisTable = await generateVisualBlocksAnalysisTable(
      [...improvedAudioAnalysis.groups, ...improvedTextualVisualAnalysis.groups, ...improvedVisualAnalysis.groups],
      blockDropoutAnalysis,
      filePairId
    );
    await logger.completeStep('Итоговая таблица анализа создана');

    const result: ComprehensiveVideoAnalysis = {
      dropoutCurve: validationResult.fixedDropoutCurve,
      audioAnalysis: improvedAudioAnalysis,
      textualVisualAnalysis: improvedTextualVisualAnalysis,
      visualAnalysis: improvedVisualAnalysis,
      blockDropoutAnalysis: blockDropoutAnalysis,
      visualBlocksAnalysisTable
    };
    
    console.log('Comprehensive analysis completed successfully');
    console.log(`Validation status: ${validationResult.isValid ? 'PASSED' : 'WARNINGS'}`);
    console.log('=== COMPREHENSIVE ANALYSIS END ===');
    
    await logger.completeStep('Анализ успешно завершен', {
      audioBlocks: improvedAudioAnalysis.groups.map(g => ({
        id: g.id,
        name: g.name,
        startTime: g.startTime,
        endTime: g.endTime,
        content: g.content,
        purpose: g.purpose
      })),
      textBlocks: improvedTextualVisualAnalysis.groups.length,
      visualBlocks: improvedVisualAnalysis.groups.length,
      screenshots: screenshots.length
    });
    await logger.logStandalone('COMPLETED', `Комплексный анализ завершен. Найдено блоков: ${blockDropoutAnalysis.length}`, 'completed', {
      audioBlocks: improvedAudioAnalysis.groups.map(g => ({
        id: g.id,
        name: g.name,
        startTime: g.startTime,
        endTime: g.endTime,
        content: g.content,
        purpose: g.purpose
      })),
      textBlocks: improvedTextualVisualAnalysis.groups.length,
      visualBlocks: improvedVisualAnalysis.groups.length
    });
    
    return result;
    
  } catch (error) {
    console.error('=== COMPREHENSIVE ANALYSIS ERROR ===');
    console.error('Error in comprehensive analysis:', error);
    console.error('Session ID:', sessionId);
    console.error('File Pair ID:', filePairId);
    console.error('Video path:', videoPath);
    console.error('Graph path:', graphPath);
    console.error('=== END COMPREHENSIVE ANALYSIS ERROR ===');
    
    await logger.errorStep(`Ошибка анализа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    
    throw error;
  }
}

async function improveBlockDescriptions<T extends AudioAnalysis | TextualVisualAnalysis | VisualAnalysis>(
  analysis: T
): Promise<T> {
  try {
    if (!analysis.groups || analysis.groups.length === 0) {
      return analysis;
    }

    console.log(`Improving descriptions for ${analysis.groups.length} blocks...`);

    const improvedGroups = await Promise.all(
      analysis.groups.map(async (block: any) => {
        try {
          const blockType = block.type === 'audio' ? 'Аудио' : 
                           block.type === 'text' ? 'Текст' : 'Визуал';

          let prompt;
          
          if (blockType === 'Текст') {
            prompt = `
Обработай этот текстовый блок из видео:

Название: ${block.name}
Время: ${block.startTime}s - ${block.endTime}s
Исходный текст: ${block.content || block.purpose || 'Не указано'}

Задача:
1. Если есть прямая речь или цитаты - оставь их как есть в кавычках
2. Убери технические описания и оставь только суть
3. Сделай максимально кратко (1-2 предложения)
4. Сохрани ключевые фразы и термины из оригинала

Верни только обработанный текст без комментариев.
`;
          } else {
            prompt = `
Улучши описание этого блока контента для лучшей читаемости и понимания:

Тип блока: ${blockType}
Название: ${block.name}
Время: ${block.startTime}s - ${block.endTime}s
Текущее содержание: ${block.content || block.purpose || 'Не указано'}

Задача:
1. Создай краткое, но информативное описание (1-2 предложения)
2. Объясни цель и значение этого блока для зрителя
3. Используй понятный язык без технических терминов
4. Сделай акцент на том, что происходит в этом временном отрезке

Верни только улучшенное описание без дополнительных комментариев.
`;
          }

          const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 200,
          });

          const improvedContent = response.choices[0].message.content?.trim() || block.content;

          return {
            ...block,
            content: improvedContent,
            originalContent: block.content
          };
        } catch (error) {
          console.error(`Error improving block ${block.id}:`, error);
          return block;
        }
      })
    );

    return {
      ...analysis,
      groups: improvedGroups
    };
  } catch (error) {
    console.error('Error improving block descriptions:', error);
    return analysis;
  }
}

function analyzeBlockDropouts(blocks: any[], dropoutCurve: DropoutCurveTable): BlockDropoutAnalysis[] {
  return blocks.map(block => {
    const startRetention = getRetentionAtTime(dropoutCurve, block.startTime);
    const endRetention = getRetentionAtTime(dropoutCurve, block.endTime);
    const absoluteDropout = startRetention - endRetention;
    
    // Относительный отвал - это процент зрителей, которые отвалились, 
    // от общего числа зрителей, которые смотрели в начале блока
    // Например: если начальное удержание 60%, а конечное 40%, 
    // то относительный отвал = (60-40)/60 * 100 = 33.33%
    const relativeDropout = startRetention > 0 ? Math.max(0, (absoluteDropout / startRetention) * 100) : 0;
    
    // Добавляем абсолютный процент отвала из кривой досмотра
    const dropoutPercentage = 100 - endRetention;

    return {
      blockId: block.id,
      blockName: block.name,
      startTime: block.startTime,
      endTime: block.endTime,
      startRetention: Math.round(startRetention * 100) / 100,
      endRetention: Math.round(endRetention * 100) / 100,
      absoluteDropout: Math.round(absoluteDropout * 100) / 100,
      relativeDropout: Math.round(relativeDropout * 100) / 100,
      dropoutPercentage: Math.round(dropoutPercentage * 100) / 100
    };
  });
}

function getRetentionAtTime(dropoutCurve: DropoutCurveTable, timestamp: number): number {
  // Ищем точную точку с допуском 0.25 секунды
  const exactPoint = dropoutCurve.points.find(p => Math.abs(p.timestamp - timestamp) < 0.25);
  if (exactPoint) {
    return exactPoint.retentionPercentage;
  }
  
  // Находим точки до и после искомого времени
  const beforePoint = dropoutCurve.points
    .filter(p => p.timestamp <= timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  
  const afterPoint = dropoutCurve.points
    .filter(p => p.timestamp >= timestamp)
    .sort((a, b) => a.timestamp - b.timestamp)[0];

  // Обрабатываем граничные случаи
  if (!beforePoint && afterPoint) return afterPoint.retentionPercentage;
  if (beforePoint && !afterPoint) return beforePoint.retentionPercentage;
  if (!beforePoint && !afterPoint) return 100; // Начало видео

  // Линейная интерполяция между двумя точками
  const timeDiff = afterPoint.timestamp - beforePoint.timestamp;
  if (timeDiff === 0) return beforePoint.retentionPercentage;
  
  const ratio = (timestamp - beforePoint.timestamp) / timeDiff;
  const interpolatedValue = beforePoint.retentionPercentage + 
         ratio * (afterPoint.retentionPercentage - beforePoint.retentionPercentage);
  
  return Math.max(0, Math.min(100, interpolatedValue)); // Ограничиваем в пределах 0-100%
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

export async function generateVisualBlocksAnalysisTable(
  allBlocks: any[],
  blockDropoutAnalysis: any[],
  filePairId?: string
): Promise<string> {
  try {
    console.log('Generating visual blocks analysis table...');

    // Подготавливаем данные для анализа
    const blocksWithDropouts = allBlocks.map(block => {
      const dropoutData = blockDropoutAnalysis.find(ba => ba.blockId === block.id);
      return {
        id: block.id,
        name: block.name,
        startTime: block.startTime,
        endTime: block.endTime,
        type: block.type,
        content: block.content,
        purpose: block.purpose,
        startRetention: dropoutData?.startRetention || 0,
        endRetention: dropoutData?.endRetention || 0,
        absoluteDropout: dropoutData?.absoluteDropout || 0,
        relativeDropout: dropoutData?.relativeDropout || 0
      };
    });

    // Сортируем блоки по относительному отвалу (убывание)
    blocksWithDropouts.sort((a, b) => b.relativeDropout - a.relativeDropout);

    // Выделяем блоки с высоким отвалом (>30%)
    const highDropoutBlocks = blocksWithDropouts.filter(block => block.relativeDropout > 30);

    const prompt = `
Проанализируй данные о блоках видео и создай итоговую таблицу анализа в формате Markdown.

Данные блоков (отсортированы по убыванию относительного отвала):
${JSON.stringify(blocksWithDropouts, null, 2)}


Создай таблицу в формате Markdown со следующими колонками:
- блок (название)
- Время (сек) (в формате "начало-конец")
- Цель (назначение блока)
- Смысл для пользователя (краткое описание содержания)
- Относительный отвал 🔻 (с эмодзи для блоков >30%)

Требования:
0. Аналитически сопаставь блоки текста, аудио и визуальные блоки. И выдели новые "смысловые блоки"
1. В таблице должны быть только "смысловые блоки"
2. Блоки не могут пересекаться по времени. Если блок 0-2, то следующий блок не может быть 1-3. может быть минимум 2.5-X
1. выдели красным треугольником 🔻 блоки с относительным отвалом >30%
2. Отсортируй блоки по времени (по возрастанию startTime)
3. Время указывай в секундах в формате "0-1.5", "2-3.5" и т.д.
4. В колонке "Цель" используй краткие формулировки (1-2 слова)
5. В колонке "Смысл для пользователя" - краткое описание того, что происходит (до 10 слов)
6. В колонке "Относительный отвал" добавляй 🔻 для значений >30%
7. Используй правильный синтаксис Markdown таблиц
8. НЕ добавляй заголовки или дополнительный текст - только таблицу

Пример формата:
|  блок | Время (сек) | Цель | Смысл для пользователя | Относительный отвал 🔻 |
|---|---|---|---|---|
| Взгляд в зеркало | 0-1 | Эмоциональный «крючок» | Зритель видит «себя»: момент саморефлексии, «точка боли» | 🔻 39.7% |

Верни только таблицу в формате Markdown без дополнительных комментариев.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const tableMarkdown = response.choices[0].message.content?.trim() || '';
    
    console.log('Visual blocks analysis table generated successfully');
    return tableMarkdown.replaceAll(/```\w*/g, '');

  } catch (error) {
    console.error('Error generating visual blocks analysis table:', error);
    return `
| Визуальный блок | Время (сек) | Цель | Смысл для пользователя | Относительный отвал 🔻 |
|---|---|---|---|---|
| Ошибка генерации | - | - | Не удалось создать таблицу анализа | - |
`;
  }
}