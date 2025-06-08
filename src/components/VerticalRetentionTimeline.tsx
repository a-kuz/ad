import React from 'react';
import { ComprehensiveVideoAnalysis, ContentBlock, BlockDropoutAnalysis, DropoutCurveTable, DropoutCurvePoint } from '@/types';

interface VerticalRetentionTimelineProps {
  analysis: ComprehensiveVideoAnalysis;
  maxDuration: number;
  sessionId?: string;
  filePairId?: string;
}

interface BlockWithTrack extends ContentBlock {
  blockType: 'audio' | 'text' | 'visual';
  trackIndex: number;
  color: string;
  borderColor: string;
  textColor: string;
}

const VerticalRetentionTimeline: React.FC<VerticalRetentionTimelineProps> = ({ 
  analysis, 
  maxDuration, 
  sessionId,
  filePairId
}) => {
  const [selectedBlock, setSelectedBlock] = React.useState<string | null>(null);
  const [highlightedBlocks, setHighlightedBlocks] = React.useState<Set<string>>(new Set());
  const [screenshotPaths, setScreenshotPaths] = React.useState<{[key: string]: string}>({});
  const [screenshotsLoading, setScreenshotsLoading] = React.useState(false);
  const [hoveredScreenshot, setHoveredScreenshot] = React.useState<{
    timestamp: number;
    imagePath: string;
    x: number;
    y: number;
  } | null>(null);
  const [showInfoTooltip, setShowInfoTooltip] = React.useState(false);

  // Загружаем пути к скриншотам при монтировании компонента
  React.useEffect(() => {
    if (filePairId && analysis.visualAnalysis?.screenshots && analysis.visualAnalysis.screenshots.length > 0) {
      const loadScreenshotPaths = async () => {
        setScreenshotsLoading(true);
        try {
          const response = await fetch(`/api/get-screenshot-files/${filePairId}`);
          if (response.ok) {
            const data = await response.json();
            
            if (data.screenshots && data.screenshots.length > 0) {
              const pathsMap: {[key: string]: string} = {};
              
              // Создаем карту timestamp -> путь к файлу
              data.screenshots.forEach((path: string) => {
                const match = path.match(/screenshot_(\d+\.?\d*)s\.jpg$/);
                if (match) {
                  const timestamp = parseFloat(match[1]);
                  pathsMap[timestamp.toString()] = `/${path}`;
                  pathsMap[timestamp.toFixed(1)] = `/${path}`;
                }
              });
              
              console.log(`Loaded ${Object.keys(pathsMap).length} screenshot paths for filePairId: ${filePairId}`);
              setScreenshotPaths(pathsMap);
            } else {
              console.warn(`No screenshots returned for filePairId: ${filePairId}`);
              setScreenshotPaths({});
            }
          } else {
            console.warn('Failed to load screenshot paths:', response.status, response.statusText);
            // Provide more detailed error info
            try {
              const errorData = await response.json();
              console.warn('Error details:', errorData);
            } catch (e) {
              // Response is not JSON
            }
            setScreenshotPaths({});
          }
        } catch (error) {
          console.error('Failed to load screenshot paths:', error);
          setScreenshotPaths({});
        } finally {
          setScreenshotsLoading(false);
        }
      };
      
      loadScreenshotPaths();
    } else {
      // Clear paths if there are no screenshots in the analysis
      console.log('No screenshots in analysis, clearing paths');
      setScreenshotPaths({});
      setScreenshotsLoading(false);
    }
  }, [filePairId, analysis.visualAnalysis?.screenshots]);

  // Функция для получения пути к скриншоту
  const getScreenshotPath = (timestamp: number): string => {
    const key = timestamp.toFixed(1);
    return screenshotPaths[key] || screenshotPaths[timestamp.toString()] || '';
  };

  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(1)}s`;
  };

  // Helper function to check if it's DropoutCurveTable
  const isDropoutCurveTable = (curve: any): curve is DropoutCurveTable => {
    return curve && Array.isArray(curve.points) && curve.points.length > 0;
  };

  const getRetentionAtTime = (timestamp: number): number => {
    if (!analysis.dropoutCurve) {
      return 100;
    }

    let points: DropoutCurvePoint[] = [];
    
    if (isDropoutCurveTable(analysis.dropoutCurve)) {
      points = analysis.dropoutCurve.points;
    } else {
      // Convert DropoutCurve to points if needed
      const dropoutCurve = analysis.dropoutCurve as any;
      if (dropoutCurve.dropouts && dropoutCurve.initialViewers) {
        points = dropoutCurve.dropouts.map((dropout: any) => ({
          timestamp: dropout.time,
          retentionPercentage: (dropout.viewersAfter / dropoutCurve.initialViewers) * 100,
          dropoutPercentage: 100 - ((dropout.viewersAfter / dropoutCurve.initialViewers) * 100)
        }));
      }
    }

    if (points.length === 0) {
      return 100;
    }
    
    const point = points.find(p => Math.abs(p.timestamp - timestamp) < 0.25);
    if (point) return point.retentionPercentage;
    
    const beforePoint = points
      .filter(p => p.timestamp <= timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    const afterPoint = points
      .filter(p => p.timestamp >= timestamp)
      .sort((a, b) => a.timestamp - b.timestamp)[0];

    if (!beforePoint && afterPoint) return afterPoint.retentionPercentage;
    if (beforePoint && !afterPoint) return beforePoint.retentionPercentage;
    if (!beforePoint && !afterPoint) return 100;

    const timeDiff = afterPoint.timestamp - beforePoint.timestamp;
    if (timeDiff === 0) return beforePoint.retentionPercentage;
    
    const ratio = (timestamp - beforePoint.timestamp) / timeDiff;
    const interpolatedValue = beforePoint.retentionPercentage + 
           ratio * (afterPoint.retentionPercentage - beforePoint.retentionPercentage);
    
    return Math.max(0, Math.min(100, interpolatedValue));
  };

  const getDropoutRateAtTime = (timestamp: number): number => {
    if (!analysis.dropoutCurve) {
      return 0;
    }

    let points: DropoutCurvePoint[] = [];
    
    if (isDropoutCurveTable(analysis.dropoutCurve)) {
      points = analysis.dropoutCurve.points;
    } else {
      const dropoutCurve = analysis.dropoutCurve as any;
      if (dropoutCurve.dropouts && dropoutCurve.initialViewers) {
        points = dropoutCurve.dropouts.map((dropout: any) => ({
          timestamp: dropout.time,
          retentionPercentage: (dropout.viewersAfter / dropoutCurve.initialViewers) * 100,
          dropoutPercentage: 100 - ((dropout.viewersAfter / dropoutCurve.initialViewers) * 100)
        }));
      }
    }

    if (points.length < 2) {
      return 0;
    }

    // Сортируем точки по времени
    points.sort((a, b) => a.timestamp - b.timestamp);

    // Находим ближайшие точки для вычисления скорости
    const beforePoint = points
      .filter(p => p.timestamp <= timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    const afterPoint = points
      .filter(p => p.timestamp >= timestamp)
      .sort((a, b) => a.timestamp - b.timestamp)[0];

    if (!beforePoint || !afterPoint || beforePoint.timestamp === afterPoint.timestamp) {
      // Если нет подходящих точек, ищем ближайший интервал
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        
        if (timestamp >= current.timestamp && timestamp <= next.timestamp) {
          const timeDiff = next.timestamp - current.timestamp;
          const retentionDiff = next.retentionPercentage - current.retentionPercentage;
          return timeDiff > 0 ? Math.abs(retentionDiff / timeDiff) : 0;
        }
      }
      return 0;
    }

    const timeDiff = afterPoint.timestamp - beforePoint.timestamp;
    const retentionDiff = afterPoint.retentionPercentage - beforePoint.retentionPercentage;
    
    return timeDiff > 0 ? Math.abs(retentionDiff / timeDiff) : 0;
  };

  // Функция для расчета относительного падения между соседними точками
  const getRelativeDropoutBetweenPoints = (startTime: number, endTime: number): number => {
    const startRetention = getRetentionAtTime(startTime);
    const endRetention = getRetentionAtTime(endTime);
    
    // Если в начале интервала удержание 0, то падение тоже 0
    if (startRetention <= 0) {
      return 0;
    }
    
    // Относительное падение = сколько процентов от текущей аудитории потеряли
    const absoluteDrop = startRetention - endRetention;
    const relativeDrop = (absoluteDrop / startRetention) * 100;
    
    return Math.max(0, relativeDrop);
  };

  // Функция для получения относительного падения в конкретный момент времени
  const getRelativeDropoutRate = (timestamp: number): number => {
    // Используем интервал 0.5 секунды для расчета относительного падения
    const intervalSize = 0.5;
    const startTime = Math.max(0, timestamp - intervalSize / 2);
    const endTime = Math.min(maxDuration, timestamp + intervalSize / 2);
    
    const relativeDrop = getRelativeDropoutBetweenPoints(startTime, endTime);
    
    // Нормализуем к диапазону 0-1 для цветовой схемы
    // 50% относительного падения = максимальная интенсивность
    return Math.min(relativeDrop / 50, 1);
  };

  const getDropoutIntensityColor = (relativeIntensity: number): string => {
    if (relativeIntensity < 0.02) {
      return 'rgba(255, 255, 255, 0)'; // Прозрачный для минимального падения (менее 1% относительного падения)
    }
    
    // Цветовая схема основана на проценте относительного падения
    let red, green, blue;
    
    if (relativeIntensity < 0.1) {
      // 0-5% относительного падения - светло-зеленый (стабильно)
      red = Math.floor(220 + 35 * (relativeIntensity / 0.1));
      green = 255;
      blue = Math.floor(220 + 35 * (relativeIntensity / 0.1));
    } else if (relativeIntensity < 0.3) {
      // 5-15% относительного падения - желтый (небольшое падение)
      red = 255;
      green = 255;
      blue = Math.floor(150 - 150 * ((relativeIntensity - 0.1) / 0.2));
    } else if (relativeIntensity < 0.5) {
      // 15-25% относительного падения - оранжевый (заметное падение)
      red = 255;
      green = Math.floor(200 - 120 * ((relativeIntensity - 0.3) / 0.2));
      blue = 0;
    } else if (relativeIntensity < 0.8) {
      // 25-40% относительного падения - красный (сильное падение)
      red = 255;
      green = Math.floor(80 - 80 * ((relativeIntensity - 0.5) / 0.3));
      blue = 0;
    } else {
      // 40%+ относительного падения - темно-красный (критическое падение)
      red = Math.floor(255 - 80 * ((relativeIntensity - 0.8) / 0.2));
      green = 0;
      blue = 0;
    }
    
    const alpha = 0.25 + relativeIntensity * 0.55; // От 0.25 до 0.8 прозрачности
    
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  };

  // Подготавливаем блоки с фиксированными треками по типам
  const prepareBlocks = (): BlockWithTrack[] => {
    const blocks: BlockWithTrack[] = [];
    
    // Визуальные блоки - трек 0
    if (analysis.visualAnalysis?.groups) {
      analysis.visualAnalysis.groups.forEach(block => {
        blocks.push({
          ...block,
          blockType: 'visual',
          trackIndex: 0,
          color: '#8B5CF6',
          borderColor: '#7C3AED',
          textColor: '#6D28D9'
        });
      });
    }
    
    // Аудио блоки - трек 1
    if (analysis.audioAnalysis?.groups) {
      analysis.audioAnalysis.groups.forEach(block => {
        blocks.push({
          ...block,
          blockType: 'audio',
          trackIndex: 1,
          color: '#10B981',
          borderColor: '#059669',
          textColor: '#065F46'
        });
      });
    }
    
    // Текстовые блоки - трек 2
    if (analysis.textualVisualAnalysis?.groups) {
      analysis.textualVisualAnalysis.groups.forEach(block => {
        blocks.push({
          ...block,
          blockType: 'text',
          trackIndex: 2,
          color: '#3B82F6',
          borderColor: '#2563EB',
          textColor: '#1E40AF'
        });
      });
    }

    return blocks;
  };

  const blocksWithTracks = prepareBlocks();
  // Всегда показываем 4 трека: Визуальные, Аудио, Текстовые, Скриншоты
  const totalTracks = 4;

  

  // Добавляем обработчик клика для закрытия превью
  React.useEffect(() => {
    const handleClickOutside = () => {
      setHoveredScreenshot(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Вызываем поиск при изменении блоков
  React.useEffect(() => {
    const excludeStartTime = 6;
    const excludeEndTime = maxDuration - 5;
    
    const trackBlocks: { [key: number]: BlockWithTrack[] } = {};
    
    blocksWithTracks.forEach(block => {
      if (block.startTime >= excludeStartTime && block.endTime <= excludeEndTime) {
        if (!trackBlocks[block.trackIndex]) {
          trackBlocks[block.trackIndex] = [];
        }
        trackBlocks[block.trackIndex].push(block);
      }
    });
    
    const highlightedIds = new Set<string>();
    
    Object.keys(trackBlocks).forEach(trackIndexStr => {
      const trackIndex = parseInt(trackIndexStr);
      const blocks = trackBlocks[trackIndex];
      
      if (blocks.length === 0) return;
      
      let maxDropoutRate = -1;
      let maxDropoutBlock: BlockWithTrack | null = null;
      
      blocks.forEach((block: BlockWithTrack) => {
        const samplePoints = 5;
        const stepSize = (block.endTime - block.startTime) / samplePoints;
        let totalRelativeDropout = 0;
        
        for (let i = 0; i < samplePoints; i++) {
          const sampleTime = block.startTime + i * stepSize;
          const relativeDropout = getRelativeDropoutRate(sampleTime);
          totalRelativeDropout += relativeDropout;
        }
        
        const avgDropoutRate = totalRelativeDropout / samplePoints;
        
        if (avgDropoutRate > maxDropoutRate) {
          maxDropoutRate = avgDropoutRate;
          maxDropoutBlock = block as BlockWithTrack;
        }
      });
      
      if (maxDropoutBlock) {
        highlightedIds.add((maxDropoutBlock as BlockWithTrack).id);
      }
    });
    
    setHighlightedBlocks(highlightedIds);
  }, [blocksWithTracks.length, maxDuration]);

  // Размеры - делаем график более узким
  const pixelsPerSecond = 150;
  const timelineHeight = maxDuration * pixelsPerSecond + 60;
  const trackWidth = 200; // Уменьшаем ширину треков
  const screenshotsTrackWidth = 120; // Уменьшаем ширину трека со скриншотами
  const timeAxisWidth = 80; // Еще больше уменьшаем ширину временной шкалы
  const timelineWidth = 3 * trackWidth + screenshotsTrackWidth + trackWidth + timeAxisWidth; // 3 обычных трека + скриншоты + информация

  // Создаем временные метки каждые 0.5 секунды
  const timeMarks: number[] = [];
  for (let t = 0; t <= maxDuration; t += 0.5) {
    timeMarks.push(t);
  }

  // Проверка наличия данных
  const hasAudioBlocks = (analysis.audioAnalysis?.groups?.length || 0) > 0;
  const hasTextBlocks = (analysis.textualVisualAnalysis?.groups?.length || 0) > 0;
  const hasVisualBlocks = (analysis.visualAnalysis?.groups?.length || 0) > 0;
  const hasScreenshots = (analysis.visualAnalysis?.screenshots?.length || 0) > 0;

  if (!hasAudioBlocks && !hasTextBlocks && !hasVisualBlocks && !hasScreenshots) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <div className="text-gray-500">
          Недостаточно данных для построения таймлайна
        </div>
      </div>
    );
  }

  const handleBlockClick = (block: BlockWithTrack) => {
    setSelectedBlock(selectedBlock === block.id ? null : block.id);
  };

  return (
    <div className="w-full max-w-none relative">
      {/* Tooltip с информацией */}
      {showInfoTooltip && (
        <div 
          className="fixed z-[110] bg-white border-2 border-blue-400 rounded-lg shadow-2xl max-w-2xl"
          style={{ 
            right: '20px', 
            top: '100px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}
        >
          {/* Заголовок tooltip */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span>ℹ️</span>
                <span>Справка по таймлайну</span>
              </div>
              <button
                onClick={() => setShowInfoTooltip(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
          
          {/* Содержимое tooltip */}
          <div className="p-6 space-y-6">
            {/* Информационная панель о таймлайне */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-blue-600 mt-0.5">⏱️</div>
                <div className="text-sm text-blue-800">
                  <span className="font-medium">Вертикальный таймлайн:</span> Время идет сверху вниз. 
                  Блоки размещены по трекам, высота блока = их длительность. 
                  Кликните на блок для детальной информации в четвертом треке.
                  <br />
                  <span className="font-medium">Автовыделение:</span> Блоки с цветным фоном имеют наивысшую скорость падения в своем треке (исключая первые 6 и последние 5 секунд). Цвет фона показывает интенсивность падения.
                  <br />
                  <span className="font-medium">Фон таймлайна:</span> Интенсивность цвета показывает относительное падение удержания - 
                  какой процент от текущей аудитории теряется на каждом участке.
                </div>
              </div>
            </div>

            {/* Легенда интенсивности падения */}
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Относительное падение удержания</h4>
              <div className="text-xs text-gray-600 mb-3">
                Цвет показывает, какой процент от текущей аудитории потерян на каждом участке времени
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 bg-transparent border border-gray-300 rounded"></div>
                  <span className="text-xs text-gray-600">0-1%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: getDropoutIntensityColor(0.05) }}></div>
                  <span className="text-xs text-gray-600">1-5%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: getDropoutIntensityColor(0.2) }}></div>
                  <span className="text-xs text-gray-600">5-15%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: getDropoutIntensityColor(0.4) }}></div>
                  <span className="text-xs text-gray-600">15-25%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: getDropoutIntensityColor(0.65) }}></div>
                  <span className="text-xs text-gray-600">25-40%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded" style={{ backgroundColor: getDropoutIntensityColor(0.9) }}></div>
                  <span className="text-xs text-gray-600">40%+</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2 italic">
                Пример: если удержание упало с 20% до 10%, то относительное падение = 50% (потеряли половину оставшейся аудитории)
              </div>
            </div>

            {/* Легенда выделения проблемных блоков */}
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Выделение проблемных блоков</h4>
              <div className="text-xs text-gray-600 mb-3">
                Блоки с наивысшей скоростью падения в каждом треке выделяются цветным фоном
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded border-2 border-gray-400" style={{ backgroundColor: 'rgba(34, 197, 94, 0.3)' }}></div>
                  <span className="text-xs text-gray-600">1-2.5% падения</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded border-2 border-gray-400" style={{ backgroundColor: 'rgba(245, 158, 11, 0.4)' }}></div>
                  <span className="text-xs text-gray-600">2.5-7.5% падения</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded border-2 border-gray-400" style={{ backgroundColor: 'rgba(249, 115, 22, 0.5)' }}></div>
                  <span className="text-xs text-gray-600">7.5-15% падения</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 rounded border-2 border-gray-400" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }}></div>
                  <span className="text-xs text-gray-600">15%+ падения</span>
                </div>
              </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hasAudioBlocks && (
                <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-green-500 rounded border border-green-600"></div>
                    <h4 className="font-semibold text-gray-900">Аудио блоки</h4>
                  </div>
                  <div className="text-sm text-gray-600">
                    {analysis.audioAnalysis?.groups?.length || 0} блоков на таймлайне
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Общее время: {(analysis.audioAnalysis?.groups || []).reduce((total, block) => total + (block.endTime - block.startTime), 0).toFixed(1)}с
                  </div>
                </div>
              )}
              
              {hasTextBlocks && (
                <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-blue-500 rounded border border-blue-600"></div>
                    <h4 className="font-semibold text-gray-900">Текстовые блоки</h4>
                  </div>
                  <div className="text-sm text-gray-600">
                    {analysis.textualVisualAnalysis?.groups?.length || 0} блоков на таймлайне
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Общее время: {(analysis.textualVisualAnalysis?.groups || []).reduce((total, block) => total + (block.endTime - block.startTime), 0).toFixed(1)}с
                  </div>
                </div>
              )}
              
              {hasVisualBlocks && (
                <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-purple-500 rounded border border-purple-600"></div>
                    <h4 className="font-semibold text-gray-900">Визуальные блоки</h4>
                  </div>
                  <div className="text-sm text-gray-600">
                    {analysis.visualAnalysis?.groups?.length || 0} блоков на таймлайне
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Общее время: {(analysis.visualAnalysis?.groups || []).reduce((total, block) => total + (block.endTime - block.startTime), 0).toFixed(1)}с
                  </div>
                </div>
              )}
              
              {hasScreenshots && (
                <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-orange-500 rounded border border-orange-600"></div>
                    <h4 className="font-semibold text-gray-900">Скриншоты 🎬</h4>
                    {screenshotsLoading && (
                      <div className="w-3 h-3 border border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {analysis.visualAnalysis?.screenshots?.length || 0} кадров в стиле киноленты
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {screenshotsLoading ? 'Загрузка путей к файлам...' : 
                     Object.keys(screenshotPaths).length > 0 ? 'Наведите для превью • Кликните для переключения' : 
                     'Файлы скриншотов не найдены'}
                  </div>
                </div>
              )}
            </div>

            {/* Сводка */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Треков используется:</span> {3 + (hasScreenshots ? 1 : 0)} • 
                <span className="font-medium ml-2">Блоков отображено:</span> {blocksWithTracks.length} из {
                  (analysis.audioAnalysis?.groups?.length || 0) + 
                  (analysis.textualVisualAnalysis?.groups?.length || 0) + 
                  (analysis.visualAnalysis?.groups?.length || 0)
                } общих • 
                {hasScreenshots && (
                  <>
                    <span className="font-medium ml-2">Скриншотов:</span> {analysis.visualAnalysis?.screenshots?.length || 0} • 
                  </>
                )}
                <span className="font-medium ml-2">Проблемных блоков:</span> <span className="text-red-600 font-bold">{highlightedBlocks.size}</span> • 
                <span className="font-medium ml-2">Общая длительность:</span> {formatTime(maxDuration)}
              </div>
              {highlightedBlocks.size > 0 && (
                <div className="mt-2 text-xs text-orange-600">
                  🎯 Цветным фоном выделены блоки с наивысшей скоростью падения в каждом треке (зеленый = низкое падение, красный = критическое)
                </div>
              )}
              {hasScreenshots && (
                <div className="mt-2 text-xs text-orange-600">
                  🎬 {screenshotsLoading ? 'Загружаем кадры киноленты...' : 
                      Object.keys(screenshotPaths).length > 0 ? 'Кадры в стиле киноленты с перфорацией • Наведите для превью • Кликните для увеличения' :
                      'Кадры из визуального анализа (файлы не найдены на сервере)'}
                </div>
              )}
            </div>

            {/* Предупреждения */}
            {blocksWithTracks.length === 0 && (hasAudioBlocks || hasTextBlocks || hasVisualBlocks) && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm text-yellow-800">
                  ⚠️ Нет блоков для отображения с выбранными фильтрами.
                </div>
              </div>
            )}
            
            {!hasAudioBlocks && !hasTextBlocks && !hasVisualBlocks && !hasScreenshots && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm text-yellow-800">
                  ⚠️ Все треки скрыты. Включите хотя бы один трек для отображения на таймлайне.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Превью скриншота при наведении */}
      {hoveredScreenshot && (
        <div 
          className="fixed z-[100]"
          style={{ 
            left: `${hoveredScreenshot.x}px`, 
            top: `${hoveredScreenshot.y}px`,
            transform: 'translateY(-50%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white border-2 border-orange-400 rounded-lg shadow-2xl overflow-hidden max-w-sm">
            {/* Заголовок превью */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span>🎬</span>
                <span>Кадр {formatTime(hoveredScreenshot.timestamp)}</span>
              </div>
            </div>
            
            {/* Изображение */}
            <div className="relative">
              <a 
                href={hoveredScreenshot.imagePath}
                target="_blank"
                rel="noopener noreferrer"
                className="block cursor-zoom-in"
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  src={hoveredScreenshot.imagePath} 
                  alt="Screenshot preview"
                  className="w-full h-auto max-w-sm max-h-64 object-contain bg-black hover:brightness-110 transition-all"
                  style={{ minWidth: '200px', minHeight: '120px' }}
                />
              </a>
              
              {/* Описание поверх изображения */}
              {(() => {
                const screenshot = analysis.visualAnalysis?.screenshots?.find(
                  s => s.timestamp === hoveredScreenshot.timestamp
                );
                return screenshot?.description && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4">
                    <p className="text-white text-sm leading-relaxed font-medium">
                      {screenshot.description}
                    </p>
                  </div>
                );
              })()}
            </div>
            
            {/* Дополнительная информация */}
                          <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <div className="flex justify-between items-center">
                  
                  <span className="text-orange-600 font-medium">Кликните для переключения</span>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Абсолютно позиционированная информация о выделенном блоке */}
      {selectedBlock && (() => {
        const block: BlockWithTrack | undefined = blocksWithTracks.find(b => b.id === selectedBlock);
        const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
          (ba: BlockDropoutAnalysis) => ba.blockId === selectedBlock
        );
        
        if (!block) return null;
        
        const blockY = 20 + block.startTime * pixelsPerSecond;
        
        // Вычисляем среднюю скорость относительного падения под блоком
        const calculateAverageRelativeDropout = () => {
          const samplePoints = 10; // Количество точек для выборки
          const stepSize = (block.endTime - block.startTime) / samplePoints;
          let totalRelativeDropout = 0;
          
          for (let i = 0; i < samplePoints; i++) {
            const sampleTime = block.startTime + i * stepSize;
            const relativeDropout = getRelativeDropoutRate(sampleTime);
            totalRelativeDropout += relativeDropout;
          }
          
          return totalRelativeDropout / samplePoints;
        };
        
        const avgRelativeDropout = calculateAverageRelativeDropout();
        
        // Определяем цвет на основе средней скорости падения
        const getBlockColor = (intensity: number) => {
          if (intensity < 0.05) {
            return {
              bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
              border: 'border-green-200',
              indicator: 'bg-green-500'
            };
          } else if (intensity < 0.15) {
            return {
              bg: 'bg-gradient-to-r from-yellow-50 to-amber-50',
              border: 'border-yellow-200',
              indicator: 'bg-yellow-500'
            };
          } else if (intensity < 0.3) {
            return {
              bg: 'bg-gradient-to-r from-orange-50 to-red-50',
              border: 'border-orange-200',
              indicator: 'bg-orange-500'
            };
          } else {
            return {
              bg: 'bg-gradient-to-r from-red-50 to-red-100',
              border: 'border-red-200',
              indicator: 'bg-red-500'
            };
          }
        };
        
        const blockColors = getBlockColor(avgRelativeDropout);
        
        return (
          <div 
            className="absolute z-50 w-80" 
            style={{ 
              left: `${timeAxisWidth + 3 * trackWidth + screenshotsTrackWidth}px`, 
              top: `${blockY}px` 
            }}
          >
            <div className={`p-6 ${blockColors.bg} border ${blockColors.border} rounded-lg shadow-lg`}>
                              <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded border" 
                      style={{ backgroundColor: block.color, borderColor: block.borderColor }}
                    ></div>
                    <span className="text-sm">{
                      block.blockType === 'audio' ? 'Аудио' : 
                      block.blockType === 'text' ? 'Текстовый' : 'Визуальный'
                    }</span>
                    <div className={`w-3 h-3 rounded-full ${blockColors.indicator}`} title={`Средняя скорость падения: ${(avgRelativeDropout * 50).toFixed(1)}%`}></div>
                  </h4>
                <button
                  onClick={() => setSelectedBlock(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h5 className="font-semibold text-gray-800 mb-2 text-sm">Название блока</h5>
                  <p className="text-sm text-gray-900 font-medium">{block.name}</p>
                </div>

                                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2 text-sm">Основная информация</h5>
                    <div className="space-y-1 text-sm">
                      <div><span className="font-medium text-gray-600">Время:</span> {formatTime(block.startTime)} - {formatTime(block.endTime)}</div>
                      <div><span className="font-medium text-gray-600">Длительность:</span> {(block.endTime - block.startTime).toFixed(1)}с</div>
                      <div><span className="font-medium text-gray-600">Трек:</span> {
                        block.trackIndex === 0 ? 'Визуальные' :
                        block.trackIndex === 1 ? 'Аудио' : 'Текстовые'
                      }</div>
                      <div><span className="font-medium text-gray-600">Средняя скорость падения:</span> <span className={`font-bold ${
                        avgRelativeDropout < 0.05 ? 'text-green-600' :
                        avgRelativeDropout < 0.15 ? 'text-yellow-600' :
                        avgRelativeDropout < 0.3 ? 'text-orange-600' : 'text-red-600'
                      }`}>{(avgRelativeDropout * 50).toFixed(1)}%</span></div>
                    </div>
                  </div>

                {block.content && (
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2 text-sm">Содержание</h5>
                    <p className="text-sm text-gray-800 bg-white p-3 rounded border max-h-32 overflow-y-auto">{block.content}</p>
                  </div>
                )}
                
                {blockAnalysis && (
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-3 text-sm">Анализ удержания</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Начальное</div>
                        <div className="text-lg font-bold text-green-600">{blockAnalysis.startRetention}%</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Конечное</div>
                        <div className="text-lg font-bold text-blue-600">{blockAnalysis.endRetention}%</div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Абс. отвал</div>
                        <div className={`text-lg font-bold ${blockAnalysis.absoluteDropout > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                          {blockAnalysis.absoluteDropout > 0 ? `-${blockAnalysis.absoluteDropout}%` : `+${Math.abs(blockAnalysis.absoluteDropout)}%`}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border">
                        <div className="text-xs text-gray-500 mb-1">Отн. отвал</div>
                        <div className={`text-lg font-bold ${blockAnalysis.relativeDropout > 20 ? 'text-red-600' : 'text-gray-900'}`}>
                          {blockAnalysis.relativeDropout.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div>
        {/* Кнопка справки в верхнем правом углу */}
        <div className="absolute top-0 right-0 z-20">
          <button
            onClick={() => setShowInfoTooltip(!showInfoTooltip)}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors"
            title="Справка по таймлайну"
          >
            <span className="text-sm font-bold">?</span>
          </button>
        </div>

        {/* Таймлайн */}
        <div>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
            <div className="overflow-x-auto w-full">
              <div className="relative" style={{ width: timelineWidth, height: timelineHeight }}>
                <svg 
                  width={timelineWidth} 
                  height={timelineHeight}
                  className="block"
                >
                  {/* Вертикальная линия временной шкалы */}
                  <line 
                    x1={timeAxisWidth} 
                    y1={20} 
                    x2={timeAxisWidth} 
                    y2={timelineHeight - 20} 
                    stroke="#374151" 
                    strokeWidth="2"
                  />

                  {/* Фоновые полосы интенсивности падения */}
                  {timeMarks.slice(0, -1).map((time, index) => {
                    const nextTime = timeMarks[index + 1];
                    const y = 20 + time * pixelsPerSecond;
                    const height = (nextTime - time) * pixelsPerSecond;
                    const midTime = time + (nextTime - time) / 2;
                    const relativeIntensity = getRelativeDropoutRate(midTime);
                    const intensityColor = getDropoutIntensityColor(relativeIntensity);
                    
                    return (
                      <g key={`intensity-${time}`}>
                        {/* Фон для временной шкалы */}
                        <rect
                          x={0}
                          y={y}
                          width={timeAxisWidth}
                          height={height}
                          fill={intensityColor}
                          opacity="0.3"
                          className="pointer-events-none"
                        />
                        {/* Фон для треков */}
                        <rect
                          x={timeAxisWidth}
                          y={y}
                          width={timelineWidth - timeAxisWidth}
                          height={height}
                          fill={intensityColor}
                          className="pointer-events-none"
                        />
                      </g>
                    );
                  })}

                  {/* Горизонтальные линии для временных меток */}
                  {timeMarks.map(time => {
                    const y = 20 + time * pixelsPerSecond;
                    const retention = getRetentionAtTime(time);
                    const dropoutRate = getDropoutRateAtTime(time);
                    
                    return (
                      <g key={`time-${time}`}>
                        {/* Линия временной метки */}
                        <line 
                          x1={timeAxisWidth - 5} 
                          y1={y} 
                          x2={timelineWidth} 
                          y2={y} 
                          stroke="#E5E7EB" 
                          strokeWidth="1"
                          strokeDasharray="2,4"
                        />
                        
                        {/* Время */}
                        <text 
                          x={timeAxisWidth - 10} 
                          y={y - 15} 
                          textAnchor="end" 
                          className="text-sm fill-gray-800 font-bold"
                        >
                          {formatTime(time)}
                        </text>
                        
                        {/* Процент удержания */}
                        <text 
                          x={timeAxisWidth - 10} 
                          y={y} 
                          textAnchor="end" 
                          className="text-xs fill-gray-600"
                        >
                          {retention.toFixed(0)}%
                        </text>
                        
                        {/* Относительное падение */}
                        <text 
                          x={timeAxisWidth - 10} 
                          y={y + 12} 
                          textAnchor="end" 
                          className="text-xs fill-red-600 font-medium"
                        >
                          {(() => {
                            const intervalSize = 0.5;
                            const startTime = Math.max(0, time - intervalSize / 2);
                            const endTime = Math.min(maxDuration, time + intervalSize / 2);
                            const relativeDrop = getRelativeDropoutBetweenPoints(startTime, endTime);
                            
                            if (relativeDrop > 2) {
                              return `-${relativeDrop.toFixed(0)}%`;
                            }
                            return '';
                          })()}
                        </text>
                      </g>
                    );
                  })}

                  {/* Вертикальные линии разделения треков */}
                  {Array.from({length: 6}).map((_, trackIndex) => {
                    let x;
                    if (trackIndex <= 3) {
                      // Линии для первых 3 треков + начало трека скриншотов
                      x = timeAxisWidth + trackIndex * trackWidth;
                    } else if (trackIndex === 4) {
                      // Линия после трека скриншотов
                      x = timeAxisWidth + 3 * trackWidth + screenshotsTrackWidth;
                    } else {
                      // Линия после информационного блока
                      x = timeAxisWidth + 3 * trackWidth + screenshotsTrackWidth + trackWidth;
                    }
                    
                    return (
                      <line 
                        key={`track-divider-${trackIndex}`}
                        x1={x} 
                        y1={20} 
                        x2={x} 
                        y2={timelineHeight - 20} 
                        stroke="#E5E7EB" 
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Блоки */}
                  {blocksWithTracks.map((block) => {
                    const x = timeAxisWidth + block.trackIndex * trackWidth + 10;
                    const y = 20 + block.startTime * pixelsPerSecond;
                    const width = trackWidth - 20;
                    const height = Math.max((block.endTime - block.startTime) * pixelsPerSecond, 60); // Минимальная высота 60px

                    const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
                      (ba: BlockDropoutAnalysis) => ba.blockId === block.id
                    );

                    // Вычисляем среднюю скорость относительного падения для блока
                    const calculateBlockDropoutRate = () => {
                      const samplePoints = 5;
                      const stepSize = (block.endTime - block.startTime) / samplePoints;
                      let totalRelativeDropout = 0;
                      
                      for (let i = 0; i < samplePoints; i++) {
                        const sampleTime = block.startTime + i * stepSize;
                        const relativeDropout = getRelativeDropoutRate(sampleTime);
                        totalRelativeDropout += relativeDropout;
                      }
                      
                      return totalRelativeDropout / samplePoints;
                    };

                    const isSelected = selectedBlock === block.id;
                    const isHighlighted = highlightedBlocks.has(block.id);
                    const blockDropoutRate = calculateBlockDropoutRate();

                    // Функция для получения цвета фона блока на основе скорости падения
                    const getBlockBackgroundColor = (dropoutRate: number, isHighlighted: boolean) => {
                      if (!isHighlighted) {
                        return 'rgba(9, 9, 9, 0.5)'; // Серые блоки с прозрачностью для обычных блоков
                      }
                      
                      // Проблемные блоки получают цвет в зависимости от скорости падения
                      if (dropoutRate < 0.05) {
                        return 'rgba(34, 197, 94, 0.8)'; // Зеленый для минимального падения
                      } else if (dropoutRate < 0.15) {
                        return 'rgba(245, 81, 11, 0.8)'; // Желтый для небольшого падения
                      } else if (dropoutRate < 0.3) {
                        return 'rgba(188, 41, 41, 0.76)'; // Оранжевый для заметного падения
                      } else {
                        return 'rgba(239, 68, 68, 0.8)'; // Красный для критического падения
                      }
                    };

                    const blockBackgroundColor = getBlockBackgroundColor(blockDropoutRate, isHighlighted);
                    
                    return (
                      <g 
                        key={`${block.blockType}-${block.id}`}
                        className="cursor-pointer"
                        onClick={() => handleBlockClick(block)}
                      >
                        {/* Тень для выделенного блока */}
                        {isSelected && (
                          <rect
                            x={x - 3}
                            y={y - 3}
                            width={width + 6}
                            height={height + 6}
                            fill="none"
                            stroke="#FCD34D"
                            strokeWidth="3"
                            rx="8"
                            opacity="0.8"
                          />
                        )}
                        
                        {/* Основной блок */}
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={blockBackgroundColor}
                          stroke={block.borderColor}
                          strokeWidth="2"
                          rx="6"
                          className="hover:opacity-80 transition-opacity"
                        />
                        
                        {(() => {
                          // Разбиваем текст на 5 строк
                          const maxCharsPerLine = Math.floor((width - 16) / 7); // Примерно 7px на символ для более узких треков
                          const words = block.name.split(' ');
                          const lines = ['', '', '', '', ''];
                          let currentLineIndex = 0;
                          
                          // Распределяем слова по строкам
                          for (const word of words) {
                            if (currentLineIndex >= 5) break; // Максимум 5 строк
                            
                            if ((lines[currentLineIndex] + ' ' + word).length <= maxCharsPerLine) {
                              lines[currentLineIndex] += (lines[currentLineIndex] ? ' ' : '') + word;
                            } else {
                              currentLineIndex++;
                              if (currentLineIndex < 5) {
                                lines[currentLineIndex] = word;
                              } else {
                                // Если не помещается в 5 строк, добавляем многоточие
                                if (lines[4].length > maxCharsPerLine - 3) {
                                  lines[4] = lines[4].substring(0, maxCharsPerLine - 3) + '...';
                                } else {
                                  lines[4] += '...';
                                }
                                break;
                              }
                            }
                          }
                          
                          // Убираем пустые строки в конце
                          const actualLines = lines.filter(line => line.length > 0);
                          const textHeight = actualLines.length * 16 + 8; // 16px на строку + отступы
                          const maxLineWidth = Math.max(...actualLines.map(line => line.length)) * 7;
                          
                          return (
                            <>
                              {/* Подложка под текст */}
                              <rect
                                x={x + 4}
                                y={y + 4}
                                width={Math.min(maxLineWidth + 8, width - 8)}
                                height={textHeight}
                                fill="rgba(0, 0, 0, 0.7)"
                                rx="4"
                              />
                              
                              {/* Название блока - все строки */}
                              {actualLines.map((line, index) => (
                                <text
                                  key={index}
                                  x={x + 8}
                                  y={y + 16 + index * 16}
                                  fill="white"
                                  fontSize="12"
                                  fontWeight="bold"
                                  textAnchor="start"
                                >
                                  {line}
                                </text>
                              ))}
                            </>
                          );
                        })()}
                        
                        {/* Время блока */}
                        <text
                          x={x + width / 2}
                          y={y + height - 25}
                          textAnchor="middle"
                          className="text-xs fill-white pointer-events-none opacity-90"
                          style={{ fontSize: '10px' }}
                        >
                          {formatTime(block.startTime)} - {formatTime(block.endTime)}
                        </text>

                        {/* Длительность */}
                        <text
                          x={x + width / 2}
                          y={y + height - 10}
                          textAnchor="middle"
                          className="text-xs fill-white pointer-events-none font-bold"
                          style={{ fontSize: '10px' }}
                        >
                          {(block.endTime - block.startTime).toFixed(1)}с
                        </text>

                        {/* Индикатор удержания */}
                        {blockAnalysis && height > 80 && (
                          <text
                            x={x + width / 2}
                            y={y + height - 40}
                            textAnchor="middle"
                            className="text-xs fill-white pointer-events-none font-bold"
                            style={{ fontSize: '9px' }}
                          >
                            {blockAnalysis.startRetention.toFixed(0)}% → {blockAnalysis.endRetention.toFixed(0)}%
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Скриншоты из визуального анализа */}
                  {analysis.visualAnalysis?.screenshots?.map((screenshot, index) => {
                    const x = timeAxisWidth + 3 * trackWidth + 10; // Позиция в треке скриншотов
                    const y = 20 + screenshot.timestamp * pixelsPerSecond;
                    const screenshotWidth = screenshotsTrackWidth - 20;
                    const screenshotHeight = 80; // Увеличиваем высоту для лучшего отображения
                    
                    const imagePath = getScreenshotPath(screenshot.timestamp);
                    
                    return (
                      <g key={`screenshot-${index}`}>
                        {/* Стилизация под пленку камеры - перфорация слева */}
                        <g>
                          {/* Левая перфорированная полоса */}
                          <rect
                            x={x - 8}
                            y={y - 5}
                            width="12"
                            height={screenshotHeight + 10}
                            fill="#2D2D2D"
                            rx="2"
                          />
                          
                          {/* Отверстия перфорации */}
                          {Array.from({length: Math.floor((screenshotHeight + 10) / 8)}).map((_, holeIndex) => (
                            <rect
                              key={`hole-${holeIndex}`}
                              x={x - 6}
                              y={y - 3 + holeIndex * 8}
                              width="8"
                              height="4"
                              fill="#F3F4F6"
                              rx="2"
                            />
                          ))}
                        </g>
                        
                        {/* Основная рамка кадра */}
                        <rect
                          x={x}
                          y={y}
                          width={screenshotWidth}
                          height={screenshotHeight}
                          fill="#1F1F1F"
                          stroke="#2D2D2D"
                          strokeWidth="2"
                          rx="2"
                          className="cursor-pointer hover:stroke-orange-400"
                                                onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredScreenshot(current => 
                          current?.timestamp === screenshot.timestamp ? null : {
                            timestamp: screenshot.timestamp,
                            imagePath,
                            x: rect.right + 10,
                            y: rect.top
                          }
                        );
                      }}
                      onMouseEnter={(e) => {
                        if (imagePath) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredScreenshot({
                            timestamp: screenshot.timestamp,
                            imagePath,
                            x: rect.right + 10,
                            y: rect.top
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        // Не закрываем при уходе мыши, если превью было открыто кликом
                        if (!hoveredScreenshot) {
                          setHoveredScreenshot(null);
                        }
                      }}
                        />
                        
                        {/* Реальное изображение скриншота */}
                        {screenshotsLoading ? (
                          <>
                            {/* Индикатор загрузки */}
                            <rect
                              x={x + 4}
                              y={y + 4}
                              width={screenshotWidth - 8}
                              height={screenshotHeight - 8}
                              fill="#F9FAFB"
                              stroke="#E5E7EB"
                              strokeWidth="1"
                              rx="1"
                            />
                            
                            <text
                              x={x + screenshotWidth / 2}
                              y={y + screenshotHeight / 2}
                              textAnchor="middle"
                              className="text-xs fill-gray-500"
                              style={{ fontSize: '10px' }}
                            >
                              Загрузка...
                            </text>
                          </>
                        ) : imagePath ? (
                          <image
                            x={x + 4}
                            y={y + 4}
                            width={screenshotWidth - 8}
                            height={screenshotHeight - 8}
                            href={imagePath}
                            preserveAspectRatio="xMidYMid slice"
                                                    className="cursor-pointer hover:opacity-90"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredScreenshot(current => 
                            current?.timestamp === screenshot.timestamp ? null : {
                              timestamp: screenshot.timestamp,
                              imagePath,
                              x: rect.right + 10,
                              y: rect.top
                            }
                          );
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredScreenshot({
                            timestamp: screenshot.timestamp,
                            imagePath,
                            x: rect.right + 10,
                            y: rect.top
                          });
                        }}
                        onMouseLeave={() => {
                          // Не закрываем при уходе мыши, если превью было открыто кликом
                          if (!hoveredScreenshot) {
                            setHoveredScreenshot(null);
                          }
                        }}
                          />
                        ) : (
                          <>
                            {/* Fallback placeholder если путь к изображению не найден */}
                            <rect
                              x={x + 4}
                              y={y + 4}
                              width={screenshotWidth - 8}
                              height={screenshotHeight - 8}
                              fill="#F3F4F6"
                              stroke="#D1D5DB"
                              strokeWidth="1"
                              rx="1"
                            />
                            
                            <text
                              x={x + screenshotWidth / 2}
                              y={y + screenshotHeight / 2}
                              textAnchor="middle"
                              className="text-xs fill-gray-400"
                              style={{ fontSize: '12px' }}
                            >
                              🖼️
                            </text>
                          </>
                        )}
                        
                        {/* Номер кадра в углу */}
                        <text
                          x={x + screenshotWidth - 6}
                          y={y + 12}
                          textAnchor="end"
                          className="text-xs fill-orange-400"
                          style={{ fontSize: '8px', fontFamily: 'monospace' }}
                        >
                          #{index + 1}
                        </text>
                        
                      </g>
                    );
                  })}

                  {/* Подписи треков */}
                  {Array.from({length: 5}).map((_, trackIndex) => {
                    let x, trackName, trackColor;
                    
                    if (trackIndex < 3) {
                      // Первые 3 трека: Визуальные, Аудио, Текстовые
                      x = timeAxisWidth + trackIndex * trackWidth + trackWidth / 2;
                      const trackNames = ['Визуальные', 'Аудио', 'Текстовые'];
                      const trackColors = ['#8B5CF6', '#10B981', '#3B82F6'];
                      trackName = trackNames[trackIndex];
                      trackColor = trackColors[trackIndex];
                    } else if (trackIndex === 3) {
                      // Трек скриншотов (4-й трек)
                      x = timeAxisWidth + 3 * trackWidth + screenshotsTrackWidth / 2;
                      trackName = 'Скриншоты';
                      trackColor = '#F97316';
                    } else {
                      // Информационный блок (5-й трек)
                      x = timeAxisWidth + 3 * trackWidth + screenshotsTrackWidth + trackWidth / 2;
                      trackName = 'Информация';
                      trackColor = '#6B7280';
                    }
                    
                    return (
                      <g key={`track-header-${trackIndex}`}>
                        <text 
                          x={x} 
                          y={15} 
                          textAnchor="middle" 
                          className="text-sm font-bold"
                          fill={trackColor}
                        >
                          {trackName}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerticalRetentionTimeline; 