import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AudioAnalysis, ContentBlock } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractAudioFromVideo(videoPath: string, sessionId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('=== AUDIO EXTRACTION START ===');
    console.log('Input video path:', videoPath);
    console.log('Session ID:', sessionId);
    
    // Проверяем существование входного файла
    if (!fs.existsSync(videoPath)) {
      console.error('ERROR: Input video file does not exist:', videoPath);
      reject(new Error(`Input video file not found: ${videoPath}`));
      return;
    }
    
    const audioId = uuidv4();
    const outputDir = path.join(process.cwd(), 'public', 'uploads', sessionId, 'audio');
    
    if (!fs.existsSync(outputDir)) {
      console.log('Creating output directory:', outputDir);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const audioPath = path.join(outputDir, `${audioId}.mp3`);
    console.log('Output audio path:', audioPath);

    const command = ffmpeg(videoPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(128);

    // Логируем команду FFmpeg
    command.on('start', (commandLine) => {
      console.log('FFmpeg command for audio extraction:', commandLine);
    });

    command.on('progress', (progress) => {
      console.log('Audio extraction progress:', progress.percent + '% done');
    });

    command.on('stderr', (stderrLine) => {
      console.log('FFmpeg stderr:', stderrLine);
    });

    command.on('end', () => {
      console.log('Audio extraction completed successfully:', audioPath);
      console.log('=== AUDIO EXTRACTION END ===');
      resolve(audioPath);
    });

    command.on('error', (err, stdout, stderr) => {
      console.error('=== FFmpeg ERROR ===');
      console.error('Error:', err.message);
      console.error('stdout:', stdout);
      console.error('stderr:', stderr);
      console.error('Input file:', videoPath);
      console.error('Output file:', audioPath);
      console.error('=== END FFmpeg ERROR ===');
      reject(new Error(`Failed to extract audio: ${err.message}`));
    });

    command.save(audioPath);
  });
}

export async function transcribeAudioFile(audioPath: string): Promise<AudioAnalysis> {
  try {
    console.log('Transcribing audio file:', audioPath);
    
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const audioFile = fs.createReadStream(audioPath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"]
    });

    console.log('Transcription completed, processing segments...');

    // Преобразуем сегменты в формат с временными метками каждые 0.5 секунд
    const transcriptionWithTimestamps = [];
    
    if (transcription.segments) {
      for (const segment of transcription.segments) {
        const startTime = segment.start || 0;
        const endTime = segment.end || startTime + 1;
        const text = segment.text || '';
        
        // Разбиваем длинные сегменты на части по 0.5 секунды
        const duration = endTime - startTime;
        const numParts = Math.ceil(duration / 0.5);
        
        for (let i = 0; i < numParts; i++) {
          const timestamp = startTime + (i * 0.5);
          transcriptionWithTimestamps.push({
            timestamp,
            text: i === 0 ? text : '', // Текст только для первой части сегмента
            confidence: 0.9
          });
        }
      }
    }

    // Группируем транскрипцию в смысловые блоки
    const groups = await groupAudioContent(transcriptionWithTimestamps);

    const audioAnalysis: AudioAnalysis = {
      transcription: transcriptionWithTimestamps,
      groups
    };

    console.log(`Audio analysis completed with ${groups.length} content blocks`);
    return audioAnalysis;

  } catch (error) {
    console.error('Error transcribing audio:', error);
    
    // Возвращаем пустой анализ в случае ошибки
    return {
      transcription: [],
      groups: []
    };
  }
}

async function groupAudioContent(transcription: Array<{timestamp: number, text: string, confidence: number}>): Promise<ContentBlock[]> {
  try {
    if (transcription.length === 0) {
      return [];
    }

    // Создаем текст для анализа
    const fullText = transcription
      .filter(t => t.text.trim())
      .map(t => `[${t.timestamp.toFixed(1)}s] ${t.text}`)
      .join('\n');

    if (!fullText.trim()) {
      return [];
    }

    const groupingPrompt = `
    Проанализируй эту аудио транскрипцию и сгруппируй её в смысловые блоки контента. 
    Каждый блок должен представлять отдельную тему, раздел или креативный элемент.
    
    Транскрипция:
    ${fullText}
    
    Верни JSON массив блоков контента в следующем формате:
    [
      {
        "id": "уникальный_id",
        "name": "Название блока",
        "startTime": время_начала_в_секундах,
        "endTime": время_окончания_в_секундах,
        "type": "audio",
        "content": "краткое содержание",
        "purpose": "цель или назначение этого блока"
      }
    ]
    
    Убедись, что блоки не пересекаются и покрывают всю длительность.
    `;

    const groupingResponse = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: groupingPrompt }],
      temperature: 0.2,
      max_tokens: 2000
    });

    const content = groupingResponse.choices[0].message.content;
    if (!content) {
      return [];
    }

    try {
      // Очищаем ответ от markdown разметки
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const groupsData = JSON.parse(cleanContent);
      
      if (!Array.isArray(groupsData)) {
        throw new Error('Response is not an array');
      }

      return groupsData.map((group: any) => ({
        id: group.id || uuidv4(),
        name: group.name || 'Unnamed Block',
        startTime: group.startTime || 0,
        endTime: group.endTime || 10,
        type: 'audio' as const,
        content: group.content || '',
        purpose: group.purpose || ''
      }));

    } catch (parseError) {
      console.error('Failed to parse audio grouping response:', parseError);
      
      // Создаем простую группировку как fallback
      return createSimpleAudioGroups(transcription);
    }

  } catch (error) {
    console.error('Error grouping audio content:', error);
    return createSimpleAudioGroups(transcription);
  }
}

function createSimpleAudioGroups(transcription: Array<{timestamp: number, text: string, confidence: number}>): ContentBlock[] {
  if (transcription.length === 0) {
    return [];
  }

  const maxTime = Math.max(...transcription.map(t => t.timestamp));
  const blockDuration = Math.max(10, maxTime / 4); // Делим на 4 блока минимум по 10 секунд
  
  const groups: ContentBlock[] = [];
  for (let i = 0; i < 4; i++) {
    const startTime = i * blockDuration;
    const endTime = Math.min((i + 1) * blockDuration, maxTime);
    
    if (startTime < maxTime) {
      groups.push({
        id: uuidv4(),
        name: `Аудио блок ${i + 1}`,
        startTime,
        endTime,
        type: 'audio',
        content: `Аудио контент с ${startTime.toFixed(1)}s до ${endTime.toFixed(1)}s`,
        purpose: 'Аудио сегмент'
      });
    }
  }
  
  return groups;
} 