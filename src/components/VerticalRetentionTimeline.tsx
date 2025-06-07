import React from 'react';
import { ComprehensiveVideoAnalysis, ContentBlock, BlockDropoutAnalysis, DropoutCurveTable, DropoutCurvePoint } from '@/types';

interface VerticalRetentionTimelineProps {
  analysis: ComprehensiveVideoAnalysis;
  maxDuration: number;
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
  maxDuration 
}) => {
  const [showAudio, setShowAudio] = React.useState(true);
  const [showText, setShowText] = React.useState(true);
  const [showVisual, setShowVisual] = React.useState(true);
  const [selectedBlock, setSelectedBlock] = React.useState<string | null>(null);
  const [highlightedBlocks, setHighlightedBlocks] = React.useState<Set<string>>(new Set());

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
    if (showVisual && analysis.visualAnalysis?.groups) {
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
    if (showAudio && analysis.audioAnalysis?.groups) {
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
    if (showText && analysis.textualVisualAnalysis?.groups) {
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
  // Всегда показываем 3 трека: Визуальные, Аудио, Текстовые
  const totalTracks = 3;

  

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
      let maxDropoutBlock: BlockWithTrack | undefined = undefined;
      
      blocks.forEach(block => {
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
          maxDropoutBlock = block;
        }
      });
      
      if (maxDropoutBlock) {
        highlightedIds.add(maxDropoutBlock.id);
      }
    });
    
    setHighlightedBlocks(highlightedIds);
  }, [blocksWithTracks.length, maxDuration]);

  // Размеры - увеличиваем ширину треков и убираем отступы по бокам
  const pixelsPerSecond = 100;
  const timelineHeight = maxDuration * pixelsPerSecond + 60;
  const trackWidth = 280; // Увеличиваем ширину треков
  const timeAxisWidth = 120; // Уменьшаем ширину временной шкалы
  const timelineWidth = (totalTracks + 1) * trackWidth + timeAxisWidth; // +1 для места под информационный блок

  // Создаем временные метки каждые 0.5 секунды
  const timeMarks: number[] = [];
  for (let t = 0; t <= maxDuration; t += 0.5) {
    timeMarks.push(t);
  }

  // Проверка наличия данных
  const hasAudioBlocks = (analysis.audioAnalysis?.groups?.length || 0) > 0;
  const hasTextBlocks = (analysis.textualVisualAnalysis?.groups?.length || 0) > 0;
  const hasVisualBlocks = (analysis.visualAnalysis?.groups?.length || 0) > 0;

  if (!hasAudioBlocks && !hasTextBlocks && !hasVisualBlocks) {
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
      {/* Абсолютно позиционированная информация о выделенном блоке */}
      {selectedBlock && (() => {
        const block = blocksWithTracks.find(b => b.id === selectedBlock);
        const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
          (ba: BlockDropoutAnalysis) => ba.blockId === selectedBlock
        );
        
        if (!block) return null;
        
        const blockY = 20 + block.startTime * pixelsPerSecond + 400;
        
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
              left: `${timeAxisWidth + 3 * trackWidth}px`, 
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
        {/* Таймлайн */}
        <div>
          {/* Информационная панель */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-blue-600 mt-0.5">⏱️</div>
              <div className="text-sm text-blue-800">
                <span className="font-medium">Вертикальный таймлайн:</span> Время идет сверху вниз. 
                Блоки размещены по трекам, высота блока = их длительность. 
                Кликните на блок для детальной информации в четвертом треке.
                <br />
                <span className="font-medium">Автовыделение:</span> Блоки с красной пунктирной рамкой имеют наивысшую скорость падения в своем треке (исключая первые 6 и последние 5 секунд).
                <br />
                <span className="font-medium">Фон таймлайна:</span> Интенсивность цвета показывает относительное падение удержания - 
                какой процент от текущей аудитории теряется на каждом участке.
              </div>
            </div>
          </div>

      {/* Легенда интенсивности падения */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
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

      {/* Интерактивная легенда с фильтрами */}
      <div className="mb-6 p-4 bg-white rounded-lg border shadow-sm">
        <div className="flex flex-wrap gap-6">
          {hasAudioBlocks && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={showAudio}
                onChange={(e) => setShowAudio(e.target.checked)}
                className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <div className="w-5 h-5 bg-green-500 rounded border border-green-600"></div>
              <span className="text-sm font-medium text-gray-700">
                Аудио блоки ({analysis.audioAnalysis?.groups?.length || 0})
              </span>
            </label>
          )}
          
          {hasTextBlocks && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={showText}
                onChange={(e) => setShowText(e.target.checked)}
                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <div className="w-5 h-5 bg-blue-500 rounded border border-blue-600"></div>
              <span className="text-sm font-medium text-gray-700">
                Текстовые блоки ({analysis.textualVisualAnalysis?.groups?.length || 0})
              </span>
            </label>
          )}
          
          {hasVisualBlocks && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={showVisual}
                onChange={(e) => setShowVisual(e.target.checked)}
                className="w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <div className="w-5 h-5 bg-purple-500 rounded border border-purple-600"></div>
              <span className="text-sm font-medium text-gray-700">
                Визуальные блоки ({analysis.visualAnalysis?.groups?.length || 0})
              </span>
            </label>
          )}
        </div>
        
        {/* Кнопки быстрого управления */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => {
              setShowAudio(true);
              setShowText(true);
              setShowVisual(true);
            }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
          >
            Показать все
          </button>
          <button
            onClick={() => {
              setShowAudio(false);
              setShowText(false);
              setShowVisual(false);
            }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
          >
            Скрыть все
          </button>
        </div>
      </div>

          {/* Основной таймлайн */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
            <div className="overflow-x-auto w-full">
              <div className="relative" style={{ width: Math.max(timelineWidth, 1200), height: timelineHeight }}>
                <svg 
                  width={Math.max(timelineWidth, 1200)} 
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
                      width={Math.max(timelineWidth, 1200) - timeAxisWidth}
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
                      x2={Math.max(timelineWidth, 1200)} 
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
              {Array.from({length: totalTracks + 2}).map((_, trackIndex) => {
                const x = timeAxisWidth + trackIndex * trackWidth;
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

                const blockDropoutRate = calculateBlockDropoutRate();

                // Функция для модификации цвета блока на основе скорости падения
                const getModifiedBlockColor = (originalColor: string, dropoutRate: number) => {
                  // Конвертируем hex в RGB
                  const hex = originalColor.replace('#', '');
                  const r = parseInt(hex.substr(0, 2), 16);
                  const g = parseInt(hex.substr(2, 2), 16);
                  const b = parseInt(hex.substr(4, 2), 16);
                  
                  // Добавляем красный оттенок в зависимости от скорости падения
                  const redBoost = Math.min(dropoutRate * 200, 100); // Максимум 100 единиц красного
                  const newR = Math.min(255, r + redBoost);
                  const newG = Math.max(0, g - redBoost * 0.3);
                  const newB = Math.max(0, b - redBoost * 0.3);
                  
                  return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
                };

                // Функция для модификации цвета рамки
                const getModifiedBorderColor = (originalColor: string, dropoutRate: number) => {
                  if (dropoutRate < 0.05) return originalColor; // Минимальное падение - оригинальный цвет
                  if (dropoutRate < 0.15) return '#F59E0B'; // Желтая рамка
                  if (dropoutRate < 0.3) return '#F97316'; // Оранжевая рамка
                  return '#EF4444'; // Красная рамка для высокого падения
                };

                const modifiedColor = getModifiedBlockColor(block.color, blockDropoutRate);
                const modifiedBorderColor = getModifiedBorderColor(block.borderColor, blockDropoutRate);

                const isSelected = selectedBlock === block.id;
                const isHighlighted = highlightedBlocks.has(block.id);
                
                return (
                  <g 
                    key={`${block.blockType}-${block.id}`}
                    className="cursor-pointer"
                    onClick={() => handleBlockClick(block)}
                  >
                    {/* Рамка для блока с наивысшей скоростью падения */}
                    {isHighlighted && (
                      <rect
                        x={x - 4}
                        y={y - 4}
                        width={width + 8}
                        height={height + 8}
                        fill="none"
                        stroke="#DC2626"
                        strokeWidth="4"
                        rx="8"
                        opacity="0.9"
                        strokeDasharray="8,4"
                      />
                    )}
                    
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
                      fill={modifiedColor}
                      fillOpacity={isSelected ? "0.9" : "0.8"}
                      stroke={modifiedBorderColor}
                      strokeWidth="2"
                      rx="6"
                      className="hover:opacity-100 transition-opacity"
                    />
                    
                    {(() => {
                      // Разбиваем текст на две строки
                      const maxCharsPerLine = Math.floor((width - 16) / 7); // Примерно 7px на символ
                      const words = block.name.split(' ');
                      let line1 = '';
                      let line2 = '';
                      
                      // Собираем первую строку
                      for (const word of words) {
                        if ((line1 + ' ' + word).length <= maxCharsPerLine) {
                          line1 += (line1 ? ' ' : '') + word;
                        } else {
                          // Остальные слова идут во вторую строку
                          const remainingWords = words.slice(words.indexOf(word));
                          line2 = remainingWords.join(' ');
                          if (line2.length > maxCharsPerLine) {
                            line2 = line2.substring(0, maxCharsPerLine - 3) + '...';
                          }
                          break;
                        }
                      }
                      
                      const hasSecondLine = line2.length > 0;
                      const textHeight = hasSecondLine ? 32 : 20;
                      const maxLineWidth = Math.max(line1.length, line2.length) * 7;
                      
                      return (
                        <>
                          {/* Подложка под текст */}
                          <rect
                            x={x + 4}
                            y={y + 4}
                            width={Math.min(maxLineWidth + 8, width - 8)}
                            height={textHeight}
                            fill="rgba(0, 0, 0, 0.6)"
                            rx="3"
                          />
                          
                          {/* Название блока - первая строка */}
                          <text
                            x={x + 8}
                            y={y + 16}
                            fill="white"
                            fontSize="12"
                            fontWeight="bold"
                            textAnchor="start"
                          >
                            {line1}
                          </text>
                          
                          {/* Название блока - вторая строка */}
                          {hasSecondLine && (
                            <text
                              x={x + 8}
                              y={y + 30}
                              fill="white"
                              fontSize="12"
                              fontWeight="bold"
                              textAnchor="start"
                            >
                              {line2}
                            </text>
                          )}
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

              {/* Подписи треков */}
              {Array.from({length: totalTracks + 1}).map((_, trackIndex) => {
                const x = timeAxisWidth + trackIndex * trackWidth + trackWidth / 2;
                const trackNames = ['Визуальные', 'Аудио', 'Текстовые', 'Информация'];
                const trackColors = ['#8B5CF6', '#10B981', '#3B82F6', '#6B7280'];
                
                return (
                  <g key={`track-header-${trackIndex}`}>
                    <text 
                      x={x} 
                      y={15} 
                      textAnchor="middle" 
                      className="text-sm font-bold"
                      fill={trackColors[trackIndex]}
                    >
                      {trackNames[trackIndex]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

          {/* Статистика под диаграммой */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {showAudio && hasAudioBlocks && (
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
        
        {showText && hasTextBlocks && (
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
        
        {showVisual && hasVisualBlocks && (
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
      </div>
      
      {/* Сводка */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
        <div className="text-sm text-gray-700">
          <span className="font-medium">Треков используется:</span> {totalTracks} • 
          <span className="font-medium ml-2">Блоков отображено:</span> {blocksWithTracks.length} из {
            (analysis.audioAnalysis?.groups?.length || 0) + 
            (analysis.textualVisualAnalysis?.groups?.length || 0) + 
            (analysis.visualAnalysis?.groups?.length || 0)
          } общих • 
          <span className="font-medium ml-2">Проблемных блоков:</span> <span className="text-red-600 font-bold">{highlightedBlocks.size}</span> • 
          <span className="font-medium ml-2">Общая длительность:</span> {formatTime(maxDuration)}
        </div>
        {highlightedBlocks.size > 0 && (
          <div className="mt-2 text-xs text-red-600">
            🔴 Красной пунктирной рамкой выделены блоки с наивысшей скоростью падения в каждом треке
          </div>
        )}
      </div>
      
      {blocksWithTracks.length === 0 && (showAudio || showText || showVisual) && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            ⚠️ Нет блоков для отображения с выбранными фильтрами.
          </div>
        </div>
      )}
      
          {!showAudio && !showText && !showVisual && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                ⚠️ Все типы блоков скрыты. Включите хотя бы один тип для отображения на таймлайне.
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

export default VerticalRetentionTimeline; 