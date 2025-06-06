import React from 'react';
import { ComprehensiveVideoAnalysis, ContentBlock, BlockDropoutAnalysis } from '@/types';

interface VerticalRetentionTimelineProps {
  analysis: ComprehensiveVideoAnalysis;
  maxDuration: number;
}

const VerticalRetentionTimeline: React.FC<VerticalRetentionTimelineProps> = ({ 
  analysis, 
  maxDuration 
}) => {
  const [showAudio, setShowAudio] = React.useState(true);
  const [showText, setShowText] = React.useState(true);
  const [showVisual, setShowVisual] = React.useState(true);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  // Получаем все блоки с их типами и цветами
  const allBlocks = [
    ...(showAudio ? (analysis.audioAnalysis?.groups || []).map(block => ({ 
      ...block, 
      blockType: 'audio' as const,
      color: 'bg-green-500',
      borderColor: 'border-green-600',
      textColor: 'text-green-800'
    })) : []),
    ...(showText ? (analysis.textualVisualAnalysis?.groups || []).map(block => ({ 
      ...block, 
      blockType: 'text' as const,
      color: 'bg-blue-500',
      borderColor: 'border-blue-600',
      textColor: 'text-blue-800'
    })) : []),
    ...(showVisual ? (analysis.visualAnalysis?.groups || []).map(block => ({ 
      ...block, 
      blockType: 'visual' as const,
      color: 'bg-purple-500',
      borderColor: 'border-purple-600',
      textColor: 'text-purple-800'
    })) : [])
  ];

  // Функция для получения удержания в конкретное время
  const getRetentionAtTime = (timestamp: number): number => {
    if (!analysis.dropoutCurve?.points || analysis.dropoutCurve.points.length === 0) {
      return 100;
    }
    
    const point = analysis.dropoutCurve.points.find(p => Math.abs(p.timestamp - timestamp) < 0.25);
    if (point) return point.retentionPercentage;
    
    const beforePoint = analysis.dropoutCurve.points
      .filter(p => p.timestamp <= timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    const afterPoint = analysis.dropoutCurve.points
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

  // Создаем шкалу времени (горизонтальная ось)
  const timeStep = Math.max(1, Math.ceil(maxDuration / 20)); // Максимум 20 делений
  const timeMarks = [];
  for (let t = 0; t <= maxDuration; t += timeStep) {
    timeMarks.push(t);
  }

  // Создаем шкалу удержания (вертикальная ось)
  const retentionMarks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  // Размеры диаграммы
  const timelineWidth = Math.max(600, maxDuration * 60); // 60px на секунду, минимум 600px
  const timelineHeight = 400;
  const leftMargin = 80;
  const bottomMargin = 60;

  // Проверка наличия данных
  const hasAudioBlocks = analysis.audioAnalysis?.groups?.length > 0;
  const hasTextBlocks = analysis.textualVisualAnalysis?.groups?.length > 0;
  const hasVisualBlocks = analysis.visualAnalysis?.groups?.length > 0;
  const hasDropoutCurve = analysis.dropoutCurve?.points?.length > 0;

  if (!hasAudioBlocks && !hasTextBlocks && !hasVisualBlocks && !hasDropoutCurve) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <div className="text-gray-500">
          Недостаточно данных для построения интерактивного таймлайна
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Информационная панель */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 mt-0.5">ℹ️</div>
          <div className="text-sm text-blue-800">
            <span className="font-medium">Интерактивный график:</span> Используйте чекбоксы ниже для включения/отключения типов блоков. 
            Наведите курсор на блоки для просмотра подробной информации.
          </div>
        </div>
      </div>

      {/* Интерактивная легенда с фильтрами */}
      <div className="mb-6 p-4 bg-white rounded-lg border">
        <div className="flex flex-wrap gap-6">
          {hasAudioBlocks && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={showAudio}
                onChange={(e) => setShowAudio(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
              />
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm font-medium text-gray-700">
                Аудио блоки ({analysis.audioAnalysis?.groups?.length || 0})
              </span>
            </label>
          )}
          
          {hasTextBlocks && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={showText}
                onChange={(e) => setShowText(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm font-medium text-gray-700">
                Текстовые блоки ({analysis.textualVisualAnalysis?.groups?.length || 0})
              </span>
            </label>
          )}
          
          {hasVisualBlocks && (
            <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={showVisual}
                onChange={(e) => setShowVisual(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
              />
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span className="text-sm font-medium text-gray-700">
                Визуальные блоки ({analysis.visualAnalysis?.groups?.length || 0})
              </span>
            </label>
          )}
        </div>
        
        {/* Кнопки быстрого управления */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => {
              setShowAudio(true);
              setShowText(true);
              setShowVisual(true);
            }}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            Показать все
          </button>
          <button
            onClick={() => {
              setShowAudio(false);
              setShowText(false);
              setShowVisual(false);
            }}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
          >
            Скрыть все
          </button>
        </div>
      </div>

      {/* Основная диаграмма */}
      <div className="relative transition-all duration-300" style={{ width: timelineWidth + leftMargin, height: timelineHeight + bottomMargin }}>
        <svg 
          width={timelineWidth + leftMargin} 
          height={timelineHeight + bottomMargin}
          className="absolute top-0 left-0"
        >
          {/* Вертикальная ось (удержание) */}
          <line 
            x1={leftMargin} 
            y1={0} 
            x2={leftMargin} 
            y2={timelineHeight} 
            stroke="#374151" 
            strokeWidth="2"
          />
          
          {/* Горизонтальная ось (время) */}
          <line 
            x1={leftMargin} 
            y1={timelineHeight} 
            x2={timelineWidth + leftMargin} 
            y2={timelineHeight} 
            stroke="#374151" 
            strokeWidth="2"
          />

          {/* Горизонтальные линии сетки (уровни удержания) */}
          {retentionMarks.map(retention => {
            const y = timelineHeight - (retention / 100) * timelineHeight;
            return (
              <g key={retention}>
                <line 
                  x1={leftMargin} 
                  y1={y} 
                  x2={timelineWidth + leftMargin} 
                  y2={y} 
                  stroke="#E5E7EB" 
                  strokeWidth="1"
                  strokeDasharray={retention % 20 === 0 ? "none" : "3,3"}
                />
                <text 
                  x={leftMargin - 10} 
                  y={y + 4} 
                  textAnchor="end" 
                  className="text-xs fill-gray-600"
                >
                  {retention}%
                </text>
              </g>
            );
          })}

          {/* Вертикальные линии сетки (время) */}
          {timeMarks.map(time => {
            const x = leftMargin + (time / maxDuration) * timelineWidth;
            return (
              <g key={time}>
                <line 
                  x1={x} 
                  y1={0} 
                  x2={x} 
                  y2={timelineHeight} 
                  stroke="#E5E7EB" 
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
                <text 
                  x={x} 
                  y={timelineHeight + 20} 
                  textAnchor="middle" 
                  className="text-xs fill-gray-600"
                >
                  {formatTime(time)}
                </text>
              </g>
            );
          })}

          {/* Кривая удержания */}
          {hasDropoutCurve && (
            <polyline
              points={(analysis.dropoutCurve?.points || [])
                .map(point => {
                  const x = leftMargin + (point.timestamp / maxDuration) * timelineWidth;
                  const y = timelineHeight - (point.retentionPercentage / 100) * timelineHeight;
                  return `${x},${y}`;
                })
                .join(' ')}
              fill="none"
              stroke="#EF4444"
              strokeWidth="3"
              opacity="0.8"
            />
          )}

          {/* Блоки */}
          {allBlocks.map((block, index) => {
            const startX = leftMargin + (block.startTime / maxDuration) * timelineWidth;
            const endX = leftMargin + (block.endTime / maxDuration) * timelineWidth;
            const width = Math.max(2, endX - startX);
            
            const startRetention = getRetentionAtTime(block.startTime);
            const endRetention = getRetentionAtTime(block.endTime);
            
            const startY = timelineHeight - (startRetention / 100) * timelineHeight;
            const endY = timelineHeight - (endRetention / 100) * timelineHeight;
            const height = Math.abs(startY - endY) || 20; // Минимальная высота
            const topY = Math.min(startY, endY);

            const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
              (ba: BlockDropoutAnalysis) => ba.blockId === block.id
            );
            
            return (
              <g key={`${block.blockType}-${block.id}`}>
                {/* Фон блока */}
                <rect
                  x={startX}
                  y={topY}
                  width={width}
                  height={Math.max(height, 20)}
                  fill={block.blockType === 'audio' ? '#10B981' : 
                        block.blockType === 'text' ? '#3B82F6' : '#8B5CF6'}
                  fillOpacity="0.7"
                  stroke={block.blockType === 'audio' ? '#059669' : 
                          block.blockType === 'text' ? '#2563EB' : '#7C3AED'}
                  strokeWidth="2"
                  rx="4"
                />
                
                {/* Название блока (если ширина позволяет) */}
                {width > 60 && (
                  <text
                    x={startX + width / 2}
                    y={topY + Math.max(height, 20) / 2 + 4}
                    textAnchor="middle"
                    className="text-xs font-medium fill-white"
                    style={{ fontSize: '10px' }}
                  >
                    {block.name.length > 10 ? block.name.substring(0, 10) + '...' : block.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip область (невидимая) для интерактивности */}
        <div className="absolute top-0 left-0 w-full h-full">
          {allBlocks.map((block, index) => {
            const startX = leftMargin + (block.startTime / maxDuration) * timelineWidth;
            const endX = leftMargin + (block.endTime / maxDuration) * timelineWidth;
            const width = Math.max(2, endX - startX);
            
            const startRetention = getRetentionAtTime(block.startTime);
            const endRetention = getRetentionAtTime(block.endTime);
            
            const startY = timelineHeight - (startRetention / 100) * timelineHeight;
            const endY = timelineHeight - (endRetention / 100) * timelineHeight;
            const height = Math.abs(startY - endY) || 20;
            const topY = Math.min(startY, endY);

            const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
              (ba: BlockDropoutAnalysis) => ba.blockId === block.id
            );

            return (
              <div
                key={`tooltip-${block.blockType}-${block.id}`}
                className="absolute pointer-events-auto group cursor-pointer"
                style={{
                  left: startX,
                  top: topY,
                  width: width,
                  height: Math.max(height, 20)
                }}
              >
                {/* Tooltip - positioning fixed to appear on top with higher z-index */}
                <div className="fixed transform translate-y-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none"
                     style={{ 
                       left: `${startX + width/2}px`, 
                       top: `${topY - 10}px`
                     }}>
                  <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-max">
                    <div className="font-semibold">{block.name}</div>
                    <div className="text-gray-300">
                      {formatTime(block.startTime)} - {formatTime(block.endTime)}
                    </div>
                    {blockAnalysis && (
                      <div className="mt-1 space-y-1">
                        <div>Начало: {blockAnalysis.startRetention.toFixed(1)}%</div>
                        <div>Конец: {blockAnalysis.endRetention.toFixed(1)}%</div>
                        <div>Отвал: {blockAnalysis.relativeDropout.toFixed(1)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Статистика под диаграммой */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {showAudio && hasAudioBlocks && (
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <h4 className="font-semibold text-gray-900">Аудио блоки</h4>
            </div>
            <div className="text-sm text-gray-600">
              {analysis.audioAnalysis?.groups?.length || 0} блоков на графике
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Время: {(analysis.audioAnalysis?.groups || []).reduce((total, block) => total + (block.endTime - block.startTime), 0).toFixed(1)}с
            </div>
          </div>
        )}
        
        {showText && hasTextBlocks && (
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <h4 className="font-semibold text-gray-900">Текстовые блоки</h4>
            </div>
            <div className="text-sm text-gray-600">
              {analysis.textualVisualAnalysis?.groups?.length || 0} блоков на графике
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Время: {(analysis.textualVisualAnalysis?.groups || []).reduce((total, block) => total + (block.endTime - block.startTime), 0).toFixed(1)}с
            </div>
          </div>
        )}
        
        {showVisual && hasVisualBlocks && (
          <div className="bg-white p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <h4 className="font-semibold text-gray-900">Визуальные блоки</h4>
            </div>
            <div className="text-sm text-gray-600">
              {analysis.visualAnalysis?.groups?.length || 0} блоков на графике
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Время: {(analysis.visualAnalysis?.groups || []).reduce((total, block) => total + (block.endTime - block.startTime), 0).toFixed(1)}с
            </div>
          </div>
        )}
      </div>
      
      {/* Сводка по видимым блокам */}
      {(showAudio || showText || showVisual) && allBlocks.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <div className="text-sm text-gray-700">
            <span className="font-medium">На графике отображено:</span> {allBlocks.length} блоков из {
              (analysis.audioAnalysis?.groups?.length || 0) + 
              (analysis.textualVisualAnalysis?.groups?.length || 0) + 
              (analysis.visualAnalysis?.groups?.length || 0)
            } общих
          </div>
        </div>
      )}
      
      {!showAudio && !showText && !showVisual && allBlocks.length > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            ⚠️ Все типы блоков скрыты. Включите хотя бы один тип для отображения на графике.
          </div>
        </div>
      )}
    </div>
  );
};

export default VerticalRetentionTimeline; 