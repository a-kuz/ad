import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { sessionId, filePairId } = await request.json();

    if (!sessionId || !filePairId) {
      return NextResponse.json(
        { error: 'Session ID and File Pair ID are required' },
        { status: 400 }
      );
    }

    // Получаем данные анализа
    const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/session/${sessionId}`);
    
    if (!sessionResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch session data' },
        { status: 500 }
      );
    }

    const sessionData = await sessionResponse.json();
    const filePair = sessionData.filePairs.find((fp: any) => fp.id === filePairId);

    if (!filePair || !filePair.analysis) {
      return NextResponse.json(
        { error: 'File pair or analysis not found' },
        { status: 404 }
      );
    }

    // Извлекаем данные для анализа
    let analysisData = null;
    if (filePair.analysis.report) {
      try {
        analysisData = JSON.parse(filePair.analysis.report);
      } catch (e) {
        console.error('Failed to parse analysis report:', e);
      }
    }

    // Собираем информацию о текстовых блоках
    const textBlocks = analysisData?.textualVisualAnalysis?.groups || [];
    const audioBlocks = analysisData?.audioAnalysis?.groups || [];
    
    const textContent = textBlocks.map((block: any) => block.content || block.purpose).filter(Boolean).join('. ');
    const audioContent = audioBlocks.map((block: any) => block.content).filter(Boolean).join('. ');

    // Генерируем название через GPT
    const prompt = `На основе анализа видео рекламы создай краткое описательное название (максимум 4-5 слов).

Текстовый контент в видео: ${textContent || 'Не определен'}
Аудио контент: ${audioContent || 'Не определен'}
Общая оценка: ${filePair.analysis.overallScore}/100

Создай название, которое отражает суть рекламы или продукта. Используй только русский язык.
Примеры хороших названий: "Реклама мобильного приложения", "Презентация нового продукта", "Обучающий ролик", "Геймплей мобильной игры".

Название (только текст, без кавычек):`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const generatedTitle = completion.choices[0]?.message?.content?.trim() || 'Анализ видео';

    return NextResponse.json({
      success: true,
      title: generatedTitle
    });

  } catch (error) {
    console.error('Error generating pair title:', error);
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    );
  }
} 