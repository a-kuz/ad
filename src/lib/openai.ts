import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VideoAnalysisRequest {
  videoMetadata: {
    duration: number;
    title: string;
    description?: string;
  };
  dropoutData: Array<{
    timestamp: number;
    dropoutPercentage: number;
  }>;
}

export interface VideoAnalysisResponse {
  insights: string;
  recommendations: string[];
  criticalMoments: Array<{
    timestamp: number;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  overallScore: number;
  improvementAreas: string[];
}

export async function analyzeVideoDropout(data: VideoAnalysisRequest): Promise<VideoAnalysisResponse> {
  try {
    const prompt = `
Проанализируй данные досмотров видео и предоставь подробный анализ.

Метаданные видео:
- Продолжительность: ${data.videoMetadata.duration} секунд
- Название: ${data.videoMetadata.title}
${data.videoMetadata.description ? `- Описание: ${data.videoMetadata.description}` : ''}

Данные досмотров (время в секундах : процент оттока):
${data.dropoutData.map(d => `${d.timestamp}с: ${d.dropoutPercentage}%`).join('\n')}

Требуется проанализировать:
1. Основные инсайты о поведении зрителей
2. Критические моменты с высоким оттоком
3. Рекомендации по улучшению видео
4. Общую оценку эффективности (от 1 до 100)
5. Области для улучшения

Ответь в формате JSON:
{
  "insights": "подробный анализ поведения зрителей",
  "recommendations": ["рекомендация 1", "рекомендация 2", ...],
  "criticalMoments": [{"timestamp": число, "reason": "причина", "severity": "low|medium|high"}],
  "overallScore": число_от_1_до_100,
  "improvementAreas": ["область 1", "область 2", ...]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Ты эксперт по анализу видео контента и поведения зрителей. Анализируй данные объективно и предоставляй практические рекомендации."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Пустой ответ от OpenAI');
    }

    // Извлекаем JSON из ответа
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Не удалось извлечь JSON из ответа');
    }

    const analysisResult: VideoAnalysisResponse = JSON.parse(jsonMatch[0]);
    return analysisResult;

  } catch (error) {
    console.error('Ошибка при анализе видео:', error);
    throw new Error('Не удалось проанализировать видео');
  }
}

export async function generateVideoReport(analysis: VideoAnalysisResponse, videoMetadata: VideoAnalysisRequest['videoMetadata']): Promise<string> {
  try {
    const prompt = `
Создай подробный отчет по анализу видео на основе данных:

Видео: ${videoMetadata.title}
Продолжительность: ${videoMetadata.duration} секунд
Общая оценка: ${analysis.overallScore}/100

Инсайты: ${analysis.insights}

Критические моменты:
${analysis.criticalMoments.map(m => `- ${m.timestamp}с: ${m.reason} (${m.severity})`).join('\n')}

Рекомендации:
${analysis.recommendations.map(r => `- ${r}`).join('\n')}

Области улучшения:
${analysis.improvementAreas.map(a => `- ${a}`).join('\n')}

Создай профессиональный отчет в формате HTML с красивым оформлением, графиками и структурированной подачей информации.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Ты эксперт по созданию профессиональных отчетов. Создавай детализированные HTML отчеты с хорошим визуальным оформлением."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 3000,
    });

    return response.choices[0]?.message?.content || 'Не удалось сгенерировать отчет';

  } catch (error) {
    console.error('Ошибка при генерации отчета:', error);
    throw new Error('Не удалось сгенерировать отчет');
  }
} 