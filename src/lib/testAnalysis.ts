import { ComprehensiveVideoAnalysis, DropoutCurveTable, AudioAnalysis, TextualVisualAnalysis, VisualAnalysis, BlockDropoutAnalysis } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { generateVisualBlocksAnalysisTable } from './comprehensiveAnalysis';

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

  // Создаем аудио анализ
  const audioAnalysis: AudioAnalysis = {
    transcription: [
      { timestamp: 0, text: "Привет! Сегодня мы изучим основы программирования", confidence: 0.95 },
      { timestamp: 5, text: "Начнем с простых примеров", confidence: 0.92 },
      { timestamp: 15, text: "Теперь перейдем к более сложным темам", confidence: 0.88 },
      { timestamp: 25, text: "Спасибо за внимание! До встречи!", confidence: 0.94 }
    ],
    groups: [
      {
        id: uuidv4(),
        name: "Приветствие и введение",
        startTime: 0,
        endTime: Math.min(8, duration * 0.27),
        type: "audio",
        content: "Ведущий приветствует зрителей и объясняет цель урока",
        purpose: "Установить контакт с аудиторией"
      },
      {
        id: uuidv4(),
        name: "Основная часть",
        startTime: Math.min(8, duration * 0.27),
        endTime: Math.min(duration * 0.87, duration - 2),
        type: "audio",
        content: "Подробное объяснение материала с примерами",
        purpose: "Передать основные знания"
      },
      {
        id: uuidv4(),
        name: "Заключение",
        startTime: Math.min(duration * 0.87, duration - 2),
        endTime: duration,
        type: "audio",
        content: "Подведение итогов и прощание",
        purpose: "Закрепить материал и мотивировать"
      }
    ]
  };

  // Создаем текстовый анализ
  const textualVisualAnalysis: TextualVisualAnalysis = {
    screenshots: [
      { timestamp: 2, text: "Основы программирования", confidence: 0.98 },
      { timestamp: 10, text: "Пример кода: console.log('Hello')", confidence: 0.95 },
      { timestamp: 20, text: "Сложные алгоритмы", confidence: 0.92 }
    ],
    groups: [
      {
        id: uuidv4(),
        name: "Заголовок урока",
        startTime: 0,
        endTime: Math.min(5, duration * 0.17),
        type: "text",
        content: "Отображение названия урока и основных тем",
        purpose: "Информировать о содержании"
      },
      {
        id: uuidv4(),
        name: "Примеры кода",
        startTime: Math.min(5, duration * 0.17),
        endTime: Math.min(duration * 0.77, duration - 3),
        type: "text",
        content: "Демонстрация практических примеров программирования",
        purpose: "Показать применение теории"
      },
      {
        id: uuidv4(),
        name: "Итоговые слайды",
        startTime: Math.min(duration * 0.77, duration - 3),
        endTime: duration,
        type: "text",
        content: "Резюме урока и дополнительные ресурсы",
        purpose: "Закрепить знания"
      }
    ]
  };

  // Создаем визуальный анализ
  const visualAnalysis: VisualAnalysis = {
    screenshots: [
      { 
        timestamp: 1, 
        description: "Ведущий в кадре, дружелюбная улыбка", 
        actions: ["говорит", "жестикулирует"], 
        elements: ["лицо ведущего", "фон студии"] 
      },
      { 
        timestamp: 12, 
        description: "Экран с кодом, ведущий объясняет", 
        actions: ["указывает на экран", "объясняет"], 
        elements: ["код на экране", "указка"] 
      },
      { 
        timestamp: 28, 
        description: "Ведущий прощается, призыв к действию", 
        actions: ["машет рукой", "улыбается"], 
        elements: ["контактная информация", "логотип"] 
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
    
    // Относительный отвал - это процент зрителей, которые отвалились, 
    // от общего числа зрителей, которые смотрели в начале блока
    // Например: если начальное удержание 60%, а конечное 40%, 
    // то относительный отвал = (60-40)/60 * 100 = 33.33%
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

  // Генерируем итоговую таблицу анализа блоков (синхронно для тестовых данных)
  const visualBlocksAnalysisTable = generateTestVisualBlocksAnalysisTable(
    [...audioAnalysis.groups, ...textualVisualAnalysis.groups, ...visualAnalysis.groups],
    blockDropoutAnalysis
  );

  return {
    dropoutCurve,
    audioAnalysis,
    textualVisualAnalysis,
    visualAnalysis,
    blockDropoutAnalysis,
    timelineAlignment,
    visualBlocksAnalysisTable
  };
}

// Функция для генерации тестовой таблицы анализа блоков
function generateTestVisualBlocksAnalysisTable(
  allBlocks: any[],
  blockDropoutAnalysis: any[]
): string {
  // Подготавливаем данные для таблицы
  const blocksWithDropouts = allBlocks.map(block => {
    const dropoutData = blockDropoutAnalysis.find(ba => ba.blockId === block.id);
    return {
      name: block.name,
      startTime: Math.floor(block.startTime),
      endTime: Math.floor(block.endTime),
      purpose: block.purpose,
      content: block.content,
      relativeDropout: dropoutData?.relativeDropout || 0
    };
  });

  // Сортируем по времени
  blocksWithDropouts.sort((a, b) => a.startTime - b.startTime);

  // Создаем Markdown таблицу
  let table = `| Визуальный блок | Время (сек) | Цель | Смысл для пользователя | Относительный отвал 🔻 |\n`;
  table += `|---|---|---|---|---|\n`;

  blocksWithDropouts.forEach(block => {
    const timeRange = `${block.startTime}-${block.endTime}`;
    const goal = block.purpose.split(' ').slice(0, 2).join(' '); // Первые 2 слова
    const meaning = block.content.split(' ').slice(0, 8).join(' '); // Первые 8 слов
    const dropout = block.relativeDropout > 30 ? 
      `🔻 ${block.relativeDropout.toFixed(1)}%` : 
      `${block.relativeDropout.toFixed(1)}%`;
    
    table += `| ${block.name} | ${timeRange} | ${goal} | ${meaning} | ${dropout} |\n`;
  });

  return table;
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