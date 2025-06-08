import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TextualVisualAnalysis, VisualAnalysis, ContentBlock } from '@/types';
import { systemMonitor } from './systemMonitor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractScreenshots(videoPath: string, sessionId: string, duration: number, filePairId?: string): Promise<string[]> {
  return new Promise(async (resolve, reject) => {
    console.log('=== SCREENSHOT EXTRACTION START ===');
    console.log('Input video path:', videoPath);
    console.log('Session ID:', sessionId);
    console.log('Video duration:', duration, 'seconds');
    
    // Проверяем существование входного файла
    if (!fs.existsSync(videoPath)) {
      console.error('ERROR: Input video file does not exist:', videoPath);
      reject(new Error(`Input video file not found: ${videoPath}`));
      return;
    }
    
    const screenshotsId = filePairId || uuidv4();
    const outputDir = path.join(process.cwd(), 'public', 'uploads', sessionId, 'screenshots', screenshotsId);
    
    if (!fs.existsSync(outputDir)) {
      console.log('Creating screenshots directory:', outputDir);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const screenshots: string[] = [];
    const step = 0.5;
    // Ограничиваем количество скриншотов для стабильности (максимум 60 = 30 секунд)
    const maxFrames = Math.min(60, Math.ceil(duration / step));
    const totalFrames = maxFrames;

    let processedFrames = 0;
    let hasError = false;

    console.log(`Extracting ${totalFrames} screenshots with ${step}s interval`);

    // Извлекаем скриншоты последовательно, а не параллельно
    const extractScreenshot = async (index: number): Promise<void> => {
      if (hasError || index >= totalFrames) {
        return;
      }

      const timestamp = index * step;
      const filename = `screenshot_${timestamp.toFixed(1)}s.jpg`;
      const outputPath = path.join(outputDir, filename);
      
      console.log(`Extracting screenshot ${index + 1}/${totalFrames} at ${timestamp}s -> ${outputPath}`);
      
      // Ожидаем свободный слот для ffmpeg перед созданием Promise
      await systemMonitor.acquireFFmpegSlot();
      
      return new Promise<void>((resolveScreenshot, rejectScreenshot) => {
        const command = ffmpeg(videoPath)
          .seekInput(timestamp)
          .frames(1)
          .outputOptions([
            '-vf', 'scale=-1:480', // Уменьшаем разрешение для стабильности
            '-q:v', '2', // Качество JPEG
            '-pix_fmt', 'yuvj420p' // Правильный формат пикселей для JPEG
          ])
          .output(outputPath);

        // Логируем команду FFmpeg для каждого скриншота
        command.on('start', (commandLine) => {
          console.log(`FFmpeg command for screenshot ${index + 1}:`, commandLine);
        });

        command.on('stderr', (stderrLine) => {
          // Логируем только важные ошибки, не весь stderr
          if (stderrLine.includes('Error') || stderrLine.includes('failed') || stderrLine.includes('Invalid')) {
            console.log(`FFmpeg stderr (screenshot ${index + 1}):`, stderrLine);
          }
        });

        command.on('end', () => {
          systemMonitor.releaseFFmpegSlot(); // Освобождаем слот
          console.log(`Screenshot ${index + 1}/${totalFrames} completed:`, outputPath);
          screenshots.push(outputPath);
          processedFrames++;
          resolveScreenshot();
        });

        command.on('error', (err, stdout, stderr) => {
          systemMonitor.releaseFFmpegSlot(); // Освобождаем слот при ошибке
          console.error('=== FFmpeg SCREENSHOT ERROR ===');
          console.error(`Error on screenshot ${index + 1}:`, err.message);
          console.error('Input file:', videoPath);
          console.error('Output file:', outputPath);
          console.error('Timestamp:', timestamp);
          console.error('=== END FFmpeg SCREENSHOT ERROR ===');
          rejectScreenshot(new Error(`Failed to extract screenshot ${index + 1}: ${err.message}`));
        });

        command.run();
      });
    };

    // Извлекаем скриншоты последовательно с контролем нагрузки
    try {
      for (let i = 0; i < totalFrames; i++) {
        await extractScreenshot(i);
        
        // Увеличиваем паузу между скриншотами для снижения нагрузки на систему
        if (i < totalFrames - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Каждые 10 скриншотов делаем более длинную паузу
        if ((i + 1) % 10 === 0) {
          console.log(`Processed ${i + 1}/${totalFrames} screenshots, taking a break...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Сортируем скриншоты по времени
      screenshots.sort((a, b) => {
        const aTime = parseFloat(a.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
        const bTime = parseFloat(b.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
        return aTime - bTime;
      });
      
      console.log(`Successfully extracted ${screenshots.length} screenshots`);
      console.log('=== SCREENSHOT EXTRACTION END ===');
      resolve(screenshots);
      
    } catch (error) {
      hasError = true;
      reject(error);
    }
  });
}

export async function analyzeTextInScreenshots(screenshots: string[], step: number): Promise<TextualVisualAnalysis> {
  console.log(`Analyzing text in ${screenshots.length} screenshots`);
  
  const textAnalysis: Array<{
    timestamp: number;
    text: string;
    confidence: number;
  }> = [];

  // Анализируем по батчам, чтобы не перегружать API
  const batchSize = 5;
  const batches = [];
  for (let i = 0; i < screenshots.length; i += batchSize) {
    const batch = screenshots.slice(i, i + batchSize);
    batches.push({ batch, startIndex: i });
  }

  console.log(`Processing ${batches.length} batches for text analysis`);

  // Process multiple batches in parallel
  const parallelBatchCount = 3; // Adjust based on API rate limits and system capabilities
  const parallelBatches = [];
  for (let i = 0; i < batches.length; i += parallelBatchCount) {
    const parallelBatch = batches.slice(i, i + parallelBatchCount);
    parallelBatches.push(parallelBatch);
  }

  for (let pbIndex = 0; pbIndex < parallelBatches.length; pbIndex++) {
    const currentParallelBatch = parallelBatches[pbIndex];
    console.log(`Processing parallel batch group ${pbIndex + 1}/${parallelBatches.length}`);
    
    const batchPromises = currentParallelBatch.map(async ({ batch, startIndex }) => {
      console.log(`Processing text analysis batch ${Math.floor(startIndex/batchSize) + 1}/${Math.ceil(screenshots.length/batchSize)}`);
      const batchResults = await Promise.all(batch.map(async (screenshotPath, batchIndex) => {
        const globalIndex = startIndex + batchIndex;
        const timestamp = globalIndex * step;
        
        try {
          if (!fs.existsSync(screenshotPath)) {
            console.warn(`Screenshot not found: ${screenshotPath}`);
            return { timestamp, text: '', confidence: 0 };
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
                    text: `Извлеки ВЕСЬ видимый текст с этого скриншота. Верни ТОЛЬКО текст, который ты видишь. Если текста нет, верни "НЕТ_ТЕКСТА".`
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
          
          return {
            timestamp,
            text: extractedText === 'НЕТ_ТЕКСТА' ? '' : extractedText,
            confidence: 0.9
          };

        } catch (error) {
          console.error(`Error analyzing text in screenshot at ${timestamp}s:`, error);
          return { timestamp, text: '', confidence: 0 };
        }
      }));
      return batchResults;
    });

    const parallelResults = await Promise.all(batchPromises);
    parallelResults.forEach(batchResults => {
      textAnalysis.push(...batchResults);
    });
    
    // Небольшая пауза между группами параллельных батчей
    if (pbIndex + 1 < parallelBatches.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Группируем текстовый контент
  const groups = await groupTextualContent(textAnalysis);

  const textualAnalysis: TextualVisualAnalysis = {
    screenshots: textAnalysis,
    groups
  };

  console.log(`Text analysis completed with ${groups.length} content blocks`);
  return textualAnalysis;
}

export async function analyzeVisualContent(screenshots: string[], step: number): Promise<VisualAnalysis> {
  console.log(`Analyzing visual content in ${screenshots.length} screenshots`);
  
  const visualAnalysis: Array<{
    timestamp: number;
    description: string;
    actions: string[];
    elements: string[];
  }> = [];

  // Анализируем каждый 10-й скриншот для экономии ресурсов
  const samplingRate = 10;
  const samplesToAnalyze = [];
  for (let i = 0; i < screenshots.length; i += samplingRate) {
    samplesToAnalyze.push({ index: i, path: screenshots[i] });
  }

  console.log(`Analyzing ${samplesToAnalyze.length} visual samples (every ${samplingRate}th screenshot)`);

  for (const sample of samplesToAnalyze) {
    const timestamp = sample.index * step;
    
    try {
      if (!fs.existsSync(sample.path)) {
        console.warn(`Screenshot not found: ${sample.path}`);
        continue;
      }

      const imageBuffer = fs.readFileSync(sample.path);
      const base64Image = imageBuffer.toString('base64');

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Проанализируй этот скриншот видео и опиши что происходит. Верни JSON объект:
                {
                  "description": "Краткое описание того, что происходит",
                  "actions": ["действие1", "действие2"],
                  "elements": ["элемент1", "элемент2"]
                }
                
                Сосредоточься на:
                - Действия: что происходит (например, "человек говорит", "демонстрация", "переход")
                - Элементы: визуальные элементы (например, "человек", "продукт", "текстовое наложение", "фон")
                
                Будь кратким и фактичным.`
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
          const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
          const parsed = JSON.parse(cleanContent);
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
      }

    } catch (error) {
      console.error(`Error analyzing visual content at ${timestamp}s:`, error);
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Заполняем пропуски между образцами
  const completeAnalysis = fillVisualGaps(visualAnalysis, screenshots.length, step);

  // Группируем визуальный контент
  const groups = await groupVisualContent(completeAnalysis);

  const analysis: VisualAnalysis = {
    screenshots: completeAnalysis,
    groups
  };

  console.log(`Visual analysis completed with ${groups.length} content blocks`);
  return analysis;
}

async function groupTextualContent(textAnalysis: Array<{timestamp: number, text: string, confidence: number}>): Promise<ContentBlock[]> {
  try {
    if (textAnalysis.length === 0) {
      return [];
    }

    const textWithTimestamps = textAnalysis
      .filter(t => t.text.trim())
      .map(t => `[${t.timestamp.toFixed(1)}s] ${t.text}`)
      .join('\n');

    if (!textWithTimestamps.trim()) {
      return [];
    }

    const groupingPrompt = `Ты анализируешь рекламный ролик для изучения удержания аудитории по таймлайну. Сгруппируй текстовые элементы в смысловые блоки.

КОНТЕКСТ: Это анализ рекламного видео для понимания того, как текстовые элементы влияют на удержание зрителей в конкретные моменты времени.

Данные:
${textWithTimestamps}

Правила группировки:
- ПЕРВЫЕ ТРИ БЛОКА должны быть длительностью 1-3 секунды каждый (для детального анализа начала)
- Остальные блоки могут быть длиннее (3-10 секунд), объединяя логически связанные тексты
- Блоки НЕ ДОЛЖНЫ ПЕРЕСЕКАТЬСЯ - каждый следующий блок начинается после окончания предыдущего
- Названия должны отражать суть текста: "Заголовок", "Цена", "Призыв", "Логотип", "Описание" и т.д.
- Создавай отдельные блоки для разных типов текстовых элементов
- Если текст повторяется через время, создавай новые блоки
- Учитывай рекламную специфику: заголовки, призывы к действию, продуктовые названия

Верни JSON:
{
  "blocks": [
    {
      "id": "text_block_1",
      "name": "Осмысленное название",
      "startTime": время_начала,
      "endTime": время_окончания,
      "type": "text",
      "content": "Содержание",
      "purpose": "Назначение"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: groupingPrompt }],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) return [];

    let groupsData;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      
      // Check if the JSON is truncated (common signs)
      if (!cleanContent.endsWith('}') && !cleanContent.endsWith(']}') && !cleanContent.endsWith(']')) {
        console.warn('Detected truncated JSON response, attempting to fix...');
        // Try to complete the JSON structure
        let fixedContent = cleanContent;
        if (!fixedContent.includes('"purpose"')) {
          // If purpose field is missing, try to close the current block
          const lastBlockMatch = fixedContent.lastIndexOf('"content":');
          if (lastBlockMatch !== -1) {
            const afterContent = fixedContent.substring(lastBlockMatch);
            const contentEnd = afterContent.indexOf('"', 11); // Skip past "content": "
            if (contentEnd !== -1) {
              const nextQuote = afterContent.indexOf('"', contentEnd + 1);
              if (nextQuote !== -1) {
                fixedContent = fixedContent.substring(0, lastBlockMatch + contentEnd + 1) + '","purpose":"Текстовый элемент"}]}';
              } else {
                fixedContent = fixedContent + '","purpose":"Текстовый элемент"}]}';
              }
            }
          }
        } else if (!fixedContent.endsWith(']}')) {
          fixedContent = fixedContent + '"}]}';
        }
        
        try {
          const parsed = JSON.parse(fixedContent);
          groupsData = parsed.blocks || parsed;
          console.log('Successfully fixed truncated JSON');
        } catch (fixError) {
          console.error('Failed to fix truncated JSON, using fallback approach');
          throw fixError;
        }
      } else {
        const parsed = JSON.parse(cleanContent);
        groupsData = parsed.blocks || parsed;
      }
    } catch (parseError) {
      console.error('JSON parse error in groupTextualContent:', parseError);
      console.error('Content that failed to parse:', content);
      
      // Fallback: create simple groups from the text data
      const fallbackGroups = [];
      const uniqueTexts = Array.from(new Set(textAnalysis.map(t => t.text.trim()).filter(t => t.length > 0)));
      
      for (let i = 0; i < Math.min(uniqueTexts.length, 10); i++) {
        const relatedTimestamps = textAnalysis.filter(t => t.text.trim() === uniqueTexts[i]).map(t => t.timestamp);
        fallbackGroups.push({
          id: `text_block_${i + 1}`,
          name: `Текстовый блок ${i + 1}`,
          startTime: Math.min(...relatedTimestamps),
          endTime: Math.max(...relatedTimestamps) + 1,
          type: 'text',
          content: uniqueTexts[i].substring(0, 200),
          purpose: 'Автоматически созданный блок'
        });
      }
      
      return fallbackGroups;
    }
    
    let textBlocks = groupsData.map((group: any) => ({
      id: group.id || uuidv4(),
      name: group.name || 'Текстовый блок',
      startTime: group.startTime || 0,
      endTime: group.endTime || 10,
      type: 'text' as const,
      content: group.content || '',
      purpose: group.purpose || ''
    }));

    // Исправляем пересечения блоков
    return fixBlockOverlaps(textBlocks);

  } catch (error) {
    console.error('Error grouping textual content:', error);
    return [];
  }
}

async function groupVisualContent(visualAnalysis: Array<{timestamp: number, description: string, actions: string[], elements: string[]}>): Promise<ContentBlock[]> {
  try {
    if (visualAnalysis.length === 0) {
      return [];
    }

    const visualData = visualAnalysis
      .map(v => `[${v.timestamp.toFixed(1)}s] ${v.description} | Действия: ${v.actions.join(', ')} | Элементы: ${v.elements.join(', ')}`)
      .join('\n');

    const groupingPrompt = `Ты анализируешь рекламный ролик для изучения удержания аудитории по таймлайну. Сгруппируй визуальный контент в смысловые блоки по сценам.

КОНТЕКСТ: Это анализ рекламного видео для понимания того, как визуальные элементы и сцены влияют на удержание зрителей в конкретные моменты времени.

Данные:
${visualData}

Правила группировки:
- ПЕРВЫЕ ТРИ БЛОКА должны быть длительностью 1-3 секунды каждый (для детального анализа начала)
- Остальные блоки могут быть длиннее (3-10 секунд), объединяя логически связанные сцены
- Блоки НЕ ДОЛЖНЫ ПЕРЕСЕКАТЬСЯ - каждый следующий блок начинается после окончания предыдущего
- Названия должны отражать суть сцены: "Демонстрация продукта", "Лицо актера", "Переход", "Финальный кадр" и т.д.
- Создавай отдельные блоки для разных сцен, действий или визуальных фокусов
- Учитывай рекламную специфику: демонстрация продукта, лица людей, переходы между сценами

Верни JSON:
{
  "blocks": [
    {
      "id": "visual_block_1",
      "name": "Осмысленное название сцены",
      "startTime": время_начала,
      "endTime": время_окончания,
      "type": "visual",
      "content": "Описание",
      "purpose": "Назначение"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: groupingPrompt }],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) return [];

    let groupsData;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      
      // Check if the JSON is truncated
      if (!cleanContent.endsWith('}') && !cleanContent.endsWith(']}') && !cleanContent.endsWith(']')) {
        console.warn('Detected truncated JSON response in groupVisualContent, attempting to fix...');
        let fixedContent = cleanContent;
        if (!fixedContent.includes('"purpose"')) {
          const lastBlockMatch = fixedContent.lastIndexOf('"content":');
          if (lastBlockMatch !== -1) {
            const afterContent = fixedContent.substring(lastBlockMatch);
            const contentEnd = afterContent.indexOf('"', 11);
            if (contentEnd !== -1) {
              const nextQuote = afterContent.indexOf('"', contentEnd + 1);
              if (nextQuote !== -1) {
                fixedContent = fixedContent.substring(0, lastBlockMatch + contentEnd + 1) + '","purpose":"Визуальный элемент"}]}';
              } else {
                fixedContent = fixedContent + '","purpose":"Визуальный элемент"}]}';
              }
            }
          }
        } else if (!fixedContent.endsWith(']}')) {
          fixedContent = fixedContent + '"}]}';
        }
        
        try {
          const parsed = JSON.parse(fixedContent);
          groupsData = parsed.blocks || parsed;
          console.log('Successfully fixed truncated JSON in groupVisualContent');
        } catch (fixError) {
          console.error('Failed to fix truncated JSON, using fallback approach');
          throw fixError;
        }
      } else {
        const parsed = JSON.parse(cleanContent);
        groupsData = parsed.blocks || parsed;
      }
    } catch (parseError) {
      console.error('JSON parse error in groupVisualContent:', parseError);
      console.error('Content that failed to parse:', content);
      
      // Fallback: create simple groups from the visual data
      const fallbackGroups = [];
      const timeGroups = [];
      const timeStep = 30; // Group by 30 second intervals
      
      for (let i = 0; i < visualAnalysis.length; i += Math.ceil(timeStep / (visualAnalysis[1]?.timestamp - visualAnalysis[0]?.timestamp || 1))) {
        const groupEnd = Math.min(i + Math.ceil(timeStep / (visualAnalysis[1]?.timestamp - visualAnalysis[0]?.timestamp || 1)), visualAnalysis.length);
        const group = visualAnalysis.slice(i, groupEnd);
        
        if (group.length > 0) {
          timeGroups.push({
            id: `visual_block_${timeGroups.length + 1}`,
            name: `Визуальный блок ${timeGroups.length + 1}`,
            startTime: group[0].timestamp,
            endTime: group[group.length - 1].timestamp + 1,
            type: 'visual',
            content: group[0].description || 'Визуальный контент',
            purpose: 'Автоматически созданный блок'
          });
        }
      }
      
      return timeGroups;
    }
    
    let visualBlocks = groupsData.map((group: any) => ({
      id: group.id || uuidv4(),
      name: group.name || 'Визуальный блок',
      startTime: group.startTime || 0,
      endTime: group.endTime || 10,
      type: 'visual' as const,
      content: group.content || '',
      purpose: group.purpose || ''
    }));

    // Исправляем пересечения блоков
    return fixBlockOverlaps(visualBlocks);

  } catch (error) {
    console.error('Error grouping visual content:', error);
    return [];
  }
}

function fillVisualGaps(sampledAnalysis: Array<{timestamp: number, description: string, actions: string[], elements: string[]}>, totalScreenshots: number, step: number): Array<{timestamp: number, description: string, actions: string[], elements: string[]}> {
  const result = [];
  
  for (let i = 0; i < totalScreenshots; i++) {
    const timestamp = i * step;
    
    // Находим ближайший образец
    let closest = sampledAnalysis[0];
    let minDistance = Math.abs(closest.timestamp - timestamp);
    
    for (const sample of sampledAnalysis) {
      const distance = Math.abs(sample.timestamp - timestamp);
      if (distance < minDistance) {
        minDistance = distance;
        closest = sample;
      }
    }
    
    result.push({
      timestamp,
      description: closest ? closest.description : '',
      actions: closest ? closest.actions : [],
      elements: closest ? closest.elements : []
    });
  }
  
  return result;
}

function fixBlockOverlaps(blocks: ContentBlock[]): ContentBlock[] {
  if (blocks.length === 0) return blocks;

  // Сортируем блоки по времени начала
  const sortedBlocks = [...blocks].sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 1; i < sortedBlocks.length; i++) {
    const prevBlock = sortedBlocks[i - 1];
    const currentBlock = sortedBlocks[i];
    
    // Если блоки пересекаются
    if (currentBlock.startTime < prevBlock.endTime) {
      // Завершаем предыдущий блок в момент начала текущего
      prevBlock.endTime = currentBlock.startTime;
      
      // Если предыдущий блок стал слишком коротким (меньше 0.5 сек), корректируем
      if (prevBlock.endTime - prevBlock.startTime < 0.5) {
        prevBlock.endTime = prevBlock.startTime + 0.5;
        // И сдвигаем текущий блок
        currentBlock.startTime = prevBlock.endTime;
      }
    }
  }
  
  return sortedBlocks;
}