import OpenAI from 'openai';
import fs from 'fs';
import { DropoutCurveTable } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeDropoutCurveImage(imagePath: string, videoDuration?: number): Promise<DropoutCurveTable> {
  console.log('Analyzing dropout curve from image:', imagePath);
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  // Определяем тип файла
  const imageType = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';

  const maxRetries = 5;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} to analyze dropout curve`);

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Проанализируй этот график "Time watched" (кривая досмотра видео) и извлеки данные с интервалом 0.5 секунды.

ВАЖНО: Это график показывает процент зрителей, которые продолжают смотреть видео на каждой временной отметке.

Описание графика:
- Ось X: время в секундах (от 0:00 до продолжительности видео)
- Ось Y: процент удержания зрителей (от 0% до 100%)
- Кривая обычно начинается со 100% и падает со временем
- Значения на оси X могут быть в формате 0:00, 0:02, 0:04, etc. или 0.00, 0.02, 0.04, etc.

Инструкции:
1. Определи точную продолжительность видео из оси X
2. Считай значения процента удержания для каждых 0.5 секунд
3. Если на графике нет точки для конкретного времени, используй интерполяцию между ближайшими точками
4. Начинай с 0 секунд и продолжай до конца видео
5. Процент отвала = 100% - процент удержания

Пример для 30-секундного видео:
- 0:00 → 100% удержание
- 0:02 → ~98% удержание  
- 0:30 → ~5% удержание

Верни ТОЛЬКО JSON в формате:
{
  "points": [
    {"timestamp": 0, "retentionPercentage": 100.00, "dropoutPercentage": 0.00},
    {"timestamp": 0.5, "retentionPercentage": 98.50, "dropoutPercentage": 1.50},
    {"timestamp": 1.0, "retentionPercentage": 97.20, "dropoutPercentage": 2.80}
  ],
  "step": 0.5,
  "totalDuration": 30.0
}

Округли до 2 знаков после запятой.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/${imageType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 6000,
        temperature: 0.1
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Очищаем ответ от возможной markdown разметки
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const dropoutData: DropoutCurveTable = JSON.parse(cleanContent);
      
      // Валидация данных
      if (!dropoutData.points || !Array.isArray(dropoutData.points)) {
        throw new Error('Invalid data structure: points array is missing');
      }
      
      if (dropoutData.points.length === 0) {
        throw new Error('No data points extracted from the graph');
      }

      // Проверяем разумность данных
      const firstPoint = dropoutData.points[0];
      const lastPoint = dropoutData.points[dropoutData.points.length - 1];
      
      // Первая точка должна быть близка к 100%
      if (firstPoint.retentionPercentage < 90) {
        throw new Error(`First retention point too low: ${firstPoint.retentionPercentage}%`);
      }
      
      // Последняя точка должна быть меньше первой (кривая падает)
      if (lastPoint.retentionPercentage >= firstPoint.retentionPercentage) {
        throw new Error('Retention curve does not decrease as expected');
      }

      // Проверяем, что у нас есть все необходимые поля
      for (const point of dropoutData.points) {
        if (typeof point.timestamp !== 'number' || typeof point.retentionPercentage !== 'number') {
          throw new Error('Invalid point data structure');
        }
        // Вычисляем dropoutPercentage если его нет
        if (typeof point.dropoutPercentage !== 'number') {
          point.dropoutPercentage = Math.round((100 - point.retentionPercentage) * 100) / 100;
        }
        // Округляем до 2 знаков после запятой
        point.retentionPercentage = Math.round(point.retentionPercentage * 100) / 100;
        point.dropoutPercentage = Math.round(point.dropoutPercentage * 100) / 100;
      }

      // Устанавливаем значения по умолчанию
      dropoutData.step = dropoutData.step || 0.5;
      dropoutData.totalDuration = dropoutData.totalDuration || 
        Math.max(...dropoutData.points.map(p => p.timestamp));

      console.log(`Successfully extracted ${dropoutData.points.length} data points from graph on attempt ${attempt}`);
      console.log(`Video duration: ${dropoutData.totalDuration} seconds`);
      console.log(`Retention range: ${lastPoint.retentionPercentage}% - ${firstPoint.retentionPercentage}%`);
      
      return dropoutData;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Ждем перед следующей попыткой (экспоненциальная задержка)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Если все попытки неудачны, выбрасываем последнюю ошибку
  throw new Error(`Failed to analyze dropout curve after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

 