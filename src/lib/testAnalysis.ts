import { ComprehensiveVideoAnalysis, DropoutCurveTable, AudioAnalysis, TextualVisualAnalysis, VisualAnalysis, BlockDropoutAnalysis } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function generateTestAnalysis(duration: number = 30): ComprehensiveVideoAnalysis {
  // Генерируем кривую отвалов с более реалистичной математикой
  const dropoutCurve: DropoutCurveTable = {
    points: [],
    step: 0.5,
    totalDuration: duration
  };

  for (let t = 0; t <= duration; t += 0.5) {
    // Более реалистичная модель отвалов: экспоненциальное снижение с небольшими флуктуациями
    let retention: number;
    
    if (t === 0) {
      retention = 100; // Всегда начинаем со 100%
    } else {
      // Экспоненциальное снижение: более быстрое в начале, затем стабилизация
      const baseRetention = 100 * Math.exp(-t * 0.08); // Экспоненциальная функция
      const randomVariation = (Math.random() - 0.5) * 8; // Случайные колебания ±4%
      retention = Math.max(5, baseRetention + randomVariation); // Минимум 5%
    }
    
    const dropoutPercentage = 100 - retention;
    
    dropoutCurve.points.push({
      timestamp: Math.round(t * 100) / 100, // Округляем timestamp
      retentionPercentage: Math.round(retention * 100) / 100,
      dropoutPercentage: Math.round(dropoutPercentage * 100) / 100
    });
  }

  // Генерируем аудио анализ
  const audioAnalysis: AudioAnalysis = {
    transcription: [
      { timestamp: 0, text: "Привет! Сегодня мы поговорим о важной теме", confidence: 0.95 },
      { timestamp: duration * 0.2, text: "Основная часть урока", confidence: 0.92 },
      { timestamp: duration * 0.8, text: "Спасибо за внимание, увидимся!", confidence: 0.94 }
    ],
    groups: [
      {
        id: uuidv4(),
        name: "Введение",
        startTime: 0,
        endTime: Math.min(10, duration * 0.33),
        type: "audio",
        content: "Приветствие и введение в тему",
        purpose: "Захватить внимание аудитории"
      },
      {
        id: uuidv4(),
        name: "Основная часть",
        startTime: Math.min(10, duration * 0.33),
        endTime: Math.min(25, duration * 0.83),
        type: "audio",
        content: "Объяснение и демонстрация основного контента",
        purpose: "Обучить основному навыку"
      },
      {
        id: uuidv4(),
        name: "Заключение",
        startTime: Math.min(25, duration * 0.83),
        endTime: duration,
        type: "audio",
        content: "Подведение итогов и прощание",
        purpose: "Закрепить изученное"
      }
    ]
  };

  // Генерируем текстовый анализ
  const textualVisualAnalysis: TextualVisualAnalysis = {
    screenshots: [
      { timestamp: 0, text: "УРОК #1: ОСНОВЫ", confidence: 0.95 },
      { timestamp: duration * 0.3, text: "Основной контент", confidence: 0.92 },
      { timestamp: duration * 0.9, text: "СПАСИБО!", confidence: 0.94 }
    ],
    groups: [
      {
        id: uuidv4(),
        name: "Заголовок урока",
        startTime: 0,
        endTime: Math.min(8, duration * 0.27),
        type: "text",
        content: "Основной заголовок и название урока",
        purpose: "Информировать о содержании"
      },
      {
        id: uuidv4(),
        name: "Основные надписи",
        startTime: Math.min(8, duration * 0.27),
        endTime: Math.min(duration * 0.9, duration - 2),
        type: "text",
        content: "Подписи и инструкции для основного контента",
        purpose: "Визуальная поддержка обучения"
      },
      {
        id: uuidv4(),
        name: "Финальная надпись",
        startTime: Math.min(duration * 0.9, duration - 2),
        endTime: duration,
        type: "text",
        content: "Благодарность зрителям",
        purpose: "Позитивное завершение"
      }
    ]
  };

  // Генерируем визуальный анализ
  const visualAnalysis: VisualAnalysis = {
    screenshots: [
      { 
        timestamp: 0, 
        description: "Человек в кадре приветствует зрителей", 
        actions: ["приветствие", "улыбка"], 
        elements: ["человек", "фон", "текст"] 
      },
      { 
        timestamp: 10, 
        description: "Демонстрация простого движения", 
        actions: ["демонстрация", "объяснение"], 
        elements: ["человек", "руки", "предмет"] 
      },
      { 
        timestamp: 25, 
        description: "Показ сложного упражнения", 
        actions: ["сложная демонстрация"], 
        elements: ["человек", "оборудование", "инструкции"] 
      }
    ],
    groups: [
      {
        id: uuidv4(),
        name: "Приветственная сцена",
        startTime: 0,
        endTime: Math.min(10, duration * 0.33),
        type: "visual",
        content: "Ведущий приветствует зрителей и настраивает на урок",
        purpose: "Создать позитивное первое впечатление"
      },
      {
        id: uuidv4(),
        name: "Основная демонстрация",
        startTime: Math.min(10, duration * 0.33),
        endTime: Math.min(duration * 0.83, duration - 3),
        type: "visual",
        content: "Демонстрация основного контента",
        purpose: "Обучить основным навыкам"
      },
      {
        id: uuidv4(),
        name: "Завершающая сцена",
        startTime: Math.min(duration * 0.83, duration - 3),
        endTime: duration,
        type: "visual",
        content: "Прощание и призыв к действию",
        purpose: "Мотивировать на дальнейшее обучение"
      }
    ]
  };

  // Создаем анализ отвалов для каждого блока
  const blockDropoutAnalysis: BlockDropoutAnalysis[] = [];
  
  [...audioAnalysis.groups, ...textualVisualAnalysis.groups, ...visualAnalysis.groups].forEach(block => {
    // Находим ближайшие точки для начала и конца блока
    const startPoint = dropoutCurve.points.find(p => Math.abs(p.timestamp - block.startTime) < 0.3);
    const endPoint = dropoutCurve.points.find(p => Math.abs(p.timestamp - block.endTime) < 0.3);
    
    const startRetention = startPoint ? startPoint.retentionPercentage : 
      getRetentionAtTime(dropoutCurve, block.startTime);
    const endRetention = endPoint ? endPoint.retentionPercentage : 
      getRetentionAtTime(dropoutCurve, block.endTime);
    
    const absoluteDropout = startRetention - endRetention;
    
    // Относительный отвал - это процентное изменение относительно начального удержания
    // Если начальное удержание 100%, а конечное 84%, то относительный отвал = (100-84)/100 * 100 = 16%
    const relativeDropout = startRetention > 0 ? Math.max(0, (absoluteDropout / startRetention) * 100) : 0;

    blockDropoutAnalysis.push({
      blockId: block.id,
      blockName: block.name,
      startTime: block.startTime,
      endTime: block.endTime,
      startRetention: Math.round(startRetention * 100) / 100,
      endRetention: Math.round(endRetention * 100) / 100,
      absoluteDropout: Math.round(absoluteDropout * 100) / 100,
      relativeDropout: Math.round(relativeDropout * 100) / 100,
      dropoutPercentage: Math.round((100 - endRetention) * 100) / 100
    });
  });

  // Создаем временную шкалу
  const timelineAlignment = [];
  for (let t = 0; t <= duration; t += 0.5) {
    const audioBlock = audioAnalysis.groups.find(b => t >= b.startTime && t <= b.endTime);
    const textBlock = textualVisualAnalysis.groups.find(b => t >= b.startTime && t <= b.endTime);
    const visualBlock = visualAnalysis.groups.find(b => t >= b.startTime && t <= b.endTime);

    timelineAlignment.push({
      timestamp: t,
      audioBlock: audioBlock?.name,
      textBlock: textBlock?.name,
      visualBlock: visualBlock?.name
    });
  }

  return {
    dropoutCurve,
    audioAnalysis,
    textualVisualAnalysis,
    visualAnalysis,
    blockDropoutAnalysis,
    timelineAlignment
  };
}

// Вспомогательная функция для интерполяции удержания
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
  if (!beforePoint && !afterPoint) return 100;

  // Линейная интерполяция между двумя точками
  const timeDiff = afterPoint.timestamp - beforePoint.timestamp;
  if (timeDiff === 0) return beforePoint.retentionPercentage;
  
  const ratio = (timestamp - beforePoint.timestamp) / timeDiff;
  const interpolatedValue = beforePoint.retentionPercentage + 
         ratio * (afterPoint.retentionPercentage - beforePoint.retentionPercentage);
  
  return Math.max(0, Math.min(100, interpolatedValue));
} 