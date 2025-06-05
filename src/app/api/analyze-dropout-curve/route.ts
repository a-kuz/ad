import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { DropoutCurveTable } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

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
                url: `data:image/${imageFile.type.split('/')[1]};base64,${base64Image}`
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
      return NextResponse.json({ error: 'No response from OpenAI' }, { status: 500 });
    }

    let dropoutData: DropoutCurveTable;
    try {
      // Очищаем ответ от возможной markdown разметки
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      dropoutData = JSON.parse(cleanContent);
      
      // Валидация и обработка данных
      if (!dropoutData.points || !Array.isArray(dropoutData.points)) {
        throw new Error('Invalid data structure: points array is missing');
      }
      
      if (dropoutData.points.length === 0) {
        throw new Error('No data points extracted from the graph');
      }

      // Проверяем и обрабатываем каждую точку
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

    } catch (parseError) {
      return NextResponse.json({ 
        error: 'Failed to parse OpenAI response',
        rawResponse: content,
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }, { status: 500 });
    }

    return NextResponse.json(dropoutData);

  } catch (error) {
    console.error('Error analyzing dropout curve:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze dropout curve',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 