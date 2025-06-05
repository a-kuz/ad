import { OpenAI } from 'openai';
import { ComprehensiveVideoAnalysis } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generatePairTitle(analysisResult: ComprehensiveVideoAnalysis): Promise<string> {
  try {
    // Собираем информацию о текстовых и аудио блоках
    const textBlocks = analysisResult.textualVisualAnalysis?.groups || [];
    const audioBlocks = analysisResult.audioAnalysis?.groups || [];
    
    const textContent = textBlocks.map(block => block.content || block.purpose).filter(Boolean).join('. ');
    const audioContent = audioBlocks.map(block => block.content).filter(Boolean).join('. ');

    // Вычисляем общую оценку
    const overallScore = Math.max(0, Math.round(100 - analysisResult.blockDropoutAnalysis.reduce((avg, block) => avg + block.relativeDropout, 0) / analysisResult.blockDropoutAnalysis.length));

    // Генерируем название через GPT
    const prompt = `На основе анализа видео рекламы создай краткое описательное название (максимум 4-5 слов).

Текстовый контент в видео: ${textContent || 'Не определен'}
Аудио контент: ${audioContent || 'Не определен'}
Общая оценка: ${overallScore}/100

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
    return generatedTitle;

  } catch (error) {
    console.error('Error generating title:', error);
    return 'Анализ видео';
  }
} 