import { ComprehensiveVideoAnalysis, DropoutCurveTable, AudioAnalysis, TextualVisualAnalysis, VisualAnalysis, BlockDropoutAnalysis } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function generateTestAnalysis(duration: number = 30): ComprehensiveVideoAnalysis {
  // Генерируем кривую отвалов
  const dropoutCurve: DropoutCurveTable = {
    points: [],
    step: 0.5,
    totalDuration: duration
  };

  for (let t = 0; t <= duration; t += 0.5) {
    const retention = Math.max(10, 100 - (t * 1.5) - Math.random() * 10);
    dropoutCurve.points.push({
      timestamp: t,
      retentionPercentage: retention,
      dropoutPercentage: 100 - retention
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
    const startRetention = dropoutCurve.points.find(p => Math.abs(p.timestamp - block.startTime) < 0.3)?.retentionPercentage || 100;
    const endRetention = dropoutCurve.points.find(p => Math.abs(p.timestamp - block.endTime) < 0.3)?.retentionPercentage || 90;
    const absoluteDropout = startRetention - endRetention;
    // Относительный отвал = абсолютное падение в процентных пунктах
    const relativeDropout = Math.max(0, absoluteDropout);

    blockDropoutAnalysis.push({
      blockId: block.id,
      blockName: block.name,
      startTime: block.startTime,
      endTime: block.endTime,
      startRetention,
      endRetention,
      absoluteDropout,
      relativeDropout
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