import React, { useState } from 'react';
import { 
  ComprehensiveVideoAnalysis, 
  BlockDropoutAnalysis, 
  ContentBlock,
  DropoutCurvePoint 
} from '@/types';
import VerticalRetentionTimeline from './VerticalRetentionTimeline';
import CustomPromptForm from './CustomPromptForm';

interface ComprehensiveAnalysisViewProps {
  analysis: ComprehensiveVideoAnalysis;
  sessionId: string;
  filePairId: string;
}

const ComprehensiveAnalysisView: React.FC<ComprehensiveAnalysisViewProps> = ({ 
  analysis: initialAnalysis,
  sessionId,
  filePairId
}) => {
  const [analysis, setAnalysis] = useState<ComprehensiveVideoAnalysis>(initialAnalysis);
  const [isVisualFormExpanded, setIsVisualFormExpanded] = useState<boolean>(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to check if it's DropoutCurveTable
  const isDropoutCurveTable = (curve: any): curve is { points: DropoutCurvePoint[], step: number, totalDuration: number } => {
    return curve && Array.isArray(curve.points) && curve.points.length > 0 && curve.points[0].retentionPercentage !== undefined;
  };

  // Helper function to get points for display
  const getDisplayPoints = () => {
    if (!analysis?.dropoutCurve) return [];
    
    if (isDropoutCurveTable(analysis.dropoutCurve)) {
      return analysis.dropoutCurve.points;
    } else {
      // Convert DropoutCurve to display points
      const dropoutCurve = analysis.dropoutCurve as any;
      if (!dropoutCurve.dropouts) return [];
      
      return dropoutCurve.dropouts.map((dropout: any) => ({
        timestamp: dropout.time,
        retentionPercentage: (dropout.viewersAfter / dropoutCurve.initialViewers) * 100,
        dropoutPercentage: 100 - ((dropout.viewersAfter / dropoutCurve.initialViewers) * 100)
      }));
    }
  };

  // Helper function to get total duration
  const getTotalDuration = () => {
    if (!analysis?.dropoutCurve) return 0;
    
    if (isDropoutCurveTable(analysis.dropoutCurve)) {
      return analysis.dropoutCurve.totalDuration || 0;
    } else {
      return (analysis.dropoutCurve as any).totalDuration || 0;
    }
  };

  // Update the analysis data when regenerated
  const handleAnalysisUpdate = (newAnalysis: ComprehensiveVideoAnalysis) => {
    setAnalysis(newAnalysis);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Комплексный анализ</h2>
      </div>

      {/* Visual Analysis Settings */}
      <div className="border-2 border-indigo-100 rounded-lg p-4">
        <button 
          onClick={() => setIsVisualFormExpanded(!isVisualFormExpanded)}
          className="w-full flex justify-between items-center text-left"
        >
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
            Настройки анализа визуального ряда
          </h3>
          <span className="text-indigo-600">
            {isVisualFormExpanded ? '▲ Свернуть' : '▼ Развернуть'}
          </span>
        </button>
        
        {isVisualFormExpanded && (
          <div className="mt-4">
            <CustomPromptForm
              filePairId={filePairId}
              sessionId={sessionId}
              type="visual"
              onAnalysisUpdate={handleAnalysisUpdate}
              defaultPrompt={analysis.visualAnalysis?.prompt || ''}
            />
          </div>
        )}
      </div>

      {/* 1. График отвалов */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
          График отвалов аудитории
        </h3>
        {getDisplayPoints().length > 0 ? (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="h-64 relative">
              <svg viewBox="0 0 100 50" className="w-full h-full">
                {/* Горизонтальные линии сетки */}
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((percent) => (
                  <line 
                    key={`grid-h-${percent}`}
                    x1="0" 
                    y1={50 - percent / 2} 
                    x2="100" 
                    y2={50 - percent / 2} 
                    stroke="#e5e7eb" 
                    strokeWidth="0.2"
                  />
                ))}
                
                {/* Вертикальные линии сетки каждые 10% */}
                {Array.from({length: 11}).map((_, i) => (
                  <line 
                    key={`grid-v-${i}`}
                    x1={i * 10} 
                    y1="0" 
                    x2={i * 10} 
                    y2="50" 
                    stroke="#e5e7eb" 
                    strokeWidth="0.2"
                  />
                ))}
                
                {/* График */}
                <polyline
                  points={getDisplayPoints().map((p: any) => {
                    const x = (p.timestamp / (getTotalDuration() || 1)) * 100;
                    const y = 50 - (p.retentionPercentage / 2);
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="0.5"
                />
                
                {/* Заполнение под графиком */}
                <path
                  d={`
                    M0,50 
                    ${getDisplayPoints().map((p: any) => {
                      const x = (p.timestamp / (getTotalDuration() || 1)) * 100;
                      const y = 50 - (p.retentionPercentage / 2);
                      return `L${x},${y}`;
                    }).join(' ')} 
                    L100,50 Z
                  `}
                  fill="url(#blue-gradient)"
                  opacity="0.2"
                />
                
                {/* Определение градиента */}
                <defs>
                  <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Точки данных */}
                {getDisplayPoints().filter((_, i) => i % 5 === 0).map((point: any, i) => {
                  const x = (point.timestamp / (getTotalDuration() || 1)) * 100;
                  const y = 50 - (point.retentionPercentage / 2);
                  return (
                    <circle 
                      key={i}
                      cx={x} 
                      cy={y} 
                      r="0.5" 
                      fill="#3b82f6"
                    />
                  )
                })}
              </svg>
              
              {/* Метки оси Y (справа) */}
              <div className="absolute top-0 right-0 h-full flex flex-col justify-between text-xs text-gray-500 py-1">
                <div>100%</div>
                <div>75%</div>
                <div>50%</div>
                <div>25%</div>
                <div>0%</div>
              </div>
              
              {/* Метки оси X (внизу) */}
              <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-gray-500 px-4">
                <div>0s</div>
                <div>{Math.round(getTotalDuration() / 4)}s</div>
                <div>{Math.round(getTotalDuration() / 2)}s</div>
                <div>{Math.round(getTotalDuration() * 3 / 4)}s</div>
                <div>{Math.round(getTotalDuration())}s</div>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="text-xs text-gray-500">Начальное удержание</div>
                <div className="text-xl font-bold text-blue-600">
                  {Math.round((getDisplayPoints()[0]?.retentionPercentage || 0))}%
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="text-xs text-gray-500">Конечное удержание</div>
                <div className="text-xl font-bold text-blue-600">
                  {Math.round((getDisplayPoints()[(getDisplayPoints().length || 0) - 1]?.retentionPercentage || 0))}%
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="text-xs text-gray-500">Наибольший спад</div>
                <div className="text-xl font-bold text-red-600">
                  {Math.round(Math.max(...getDisplayPoints().map((p, i, arr) => 
                    i > 0 ? arr[i-1].retentionPercentage - p.retentionPercentage : 0
                  )))}%
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="text-xs text-gray-500">Время половинного удержания</div>
                <div className="text-xl font-bold text-gray-800">
                  {formatTime(getDisplayPoints().find(p => p.retentionPercentage <= 50)?.timestamp || getTotalDuration())}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-gray-500">Нет данных для отображения кривой досмотра</p>
          </div>
        )}
      </div>

      {/* 2. Аудио анализ */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          Аудио анализ
          <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">
            {analysis.audioAnalysis?.groups?.length || 0} блоков
          </span>
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название блока</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Время</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Содержание</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Назначение</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analysis.audioAnalysis?.groups?.map((block) => (
                <tr key={block.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{block.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{formatTime(block.startTime)} - {formatTime(block.endTime)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 line-clamp-2">{block.content}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">{block.purpose}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Визуальный анализ */}
      <div className="p-4 border rounded-md shadow-sm bg-white mb-6">
        <h3 className="text-lg font-semibold mb-2">Визуальный анализ</h3>
        <p className="text-sm text-gray-500 mb-3">
          {analysis.visualAnalysis?.groups?.length || 0} блоков
        </p>
        <div className="space-y-4">
          {analysis.visualAnalysis?.groups?.map((block) => (
            <div key={block.id} className="border-2 border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-lg text-gray-900">{block.name}</h4>
                <span className="text-sm text-gray-700 bg-gray-200 px-3 py-1 rounded font-medium">
                  {formatTime(block.startTime)} - {formatTime(block.endTime)}
                </span>
              </div>
              <p className="text-gray-800 mb-3 break-words font-medium">{block.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Аудио блоки с анализом отвалов */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          Аудио блоки с анализом отвалов
        </h3>
        <div className="space-y-4">
          {analysis.audioAnalysis?.groups?.map((block: ContentBlock) => {
            const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
              (ba: BlockDropoutAnalysis) => ba.blockId === block.id && ba.blockName === block.name
            );
            return (
              <div key={block.id} className="border-2 border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-lg text-gray-900">{block.name}</h4>
                  <span className="text-sm text-gray-700 bg-gray-200 px-3 py-1 rounded font-medium">
                    {formatTime(block.startTime)} - {formatTime(block.endTime)}
                  </span>
                </div>
                <p className="text-gray-800 mb-3 break-words font-medium">{block.content}</p>
                {blockAnalysis && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 bg-gray-50 p-3 rounded-lg">
                    <div>
                      <div className="text-xs text-gray-500">Начальное удержание</div>
                      <div className="text-lg font-bold text-gray-900">{blockAnalysis.startRetention}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Конечное удержание</div>
                      <div className="text-lg font-bold text-gray-900">{blockAnalysis.endRetention}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Абсолютный отвал</div>
                      <div className={`text-lg font-bold ${blockAnalysis.absoluteDropout > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                        {blockAnalysis.absoluteDropout > 0 ? `-${blockAnalysis.absoluteDropout}%` : `+${Math.abs(blockAnalysis.absoluteDropout)}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Относительный отвал</div>
                      <div className={`text-lg font-bold ${blockAnalysis.relativeDropout > 20 ? 'text-red-600' : 'text-gray-900'}`}>
                        {blockAnalysis.relativeDropout.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Визуальные блоки с анализом отвалов */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
          Визуальные блоки с анализом отвалов
        </h3>
        <div className="space-y-4">
          {analysis.visualAnalysis?.groups?.map((block: ContentBlock) => {
            const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
              (ba: BlockDropoutAnalysis) => ba.blockId === block.id && ba.blockName === block.name
            );
            return (
              <div key={block.id} className="border-2 border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-lg text-gray-900">{block.name}</h4>
                  <span className="text-sm text-gray-700 bg-gray-200 px-3 py-1 rounded font-medium">
                    {formatTime(block.startTime)} - {formatTime(block.endTime)}
                  </span>
                </div>
                <p className="text-gray-800 mb-3 break-words font-medium">{block.content}</p>
                {blockAnalysis && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 bg-gray-50 p-3 rounded-lg">
                    <div>
                      <div className="text-xs text-gray-500">Начальное удержание</div>
                      <div className="text-lg font-bold text-gray-900">{blockAnalysis.startRetention}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Конечное удержание</div>
                      <div className="text-lg font-bold text-gray-900">{blockAnalysis.endRetention}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Абсолютный отвал</div>
                      <div className={`text-lg font-bold ${blockAnalysis.absoluteDropout > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                        {blockAnalysis.absoluteDropout > 0 ? `-${blockAnalysis.absoluteDropout}%` : `+${Math.abs(blockAnalysis.absoluteDropout)}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Относительный отвал</div>
                      <div className={`text-lg font-bold ${blockAnalysis.relativeDropout > 20 ? 'text-red-600' : 'text-gray-900'}`}>
                        {blockAnalysis.relativeDropout.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Текстовые блоки с анализом отвалов */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
          Текстовые блоки с анализом отвалов
        </h3>
        <div className="space-y-4">
          {analysis.textualVisualAnalysis?.groups?.map((block: ContentBlock) => {
            const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
              (ba: BlockDropoutAnalysis) => ba.blockId === block.id && ba.blockName === block.name
            );
            return (
              <div key={block.id} className="border-2 border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-lg text-gray-900">{block.name}</h4>
                  <span className="text-sm text-gray-700 bg-gray-200 px-3 py-1 rounded font-medium">
                    {formatTime(block.startTime)} - {formatTime(block.endTime)}
                  </span>
                </div>
                <p className="text-gray-800 mb-3 break-words font-medium">{block.content}</p>
                {blockAnalysis && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 bg-gray-50 p-3 rounded-lg">
                    <div>
                      <div className="text-xs text-gray-500">Начальное удержание</div>
                      <div className="text-lg font-bold text-gray-900">{blockAnalysis.startRetention}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Конечное удержание</div>
                      <div className="text-lg font-bold text-gray-900">{blockAnalysis.endRetention}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Абсолютный отвал</div>
                      <div className={`text-lg font-bold ${blockAnalysis.absoluteDropout > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                        {blockAnalysis.absoluteDropout > 0 ? `-${blockAnalysis.absoluteDropout}%` : `+${Math.abs(blockAnalysis.absoluteDropout)}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Относительный отвал</div>
                      <div className={`text-lg font-bold ${blockAnalysis.relativeDropout > 20 ? 'text-red-600' : 'text-gray-900'}`}>
                        {blockAnalysis.relativeDropout.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></span>
          Интерактивный таймлайн удержания аудитории
          <span className="ml-2 px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-full">
            {(analysis.audioAnalysis?.groups?.length || 0) + 
             (analysis.textualVisualAnalysis?.groups?.length || 0) + 
             (analysis.visualAnalysis?.groups?.length || 0)} блоков
          </span>
        </h3>
        
        <div className="bg-gray-50 p-6 rounded-lg overflow-x-auto">
          <VerticalRetentionTimeline 
            analysis={analysis}
            maxDuration={Math.max(
              ...(analysis.audioAnalysis?.groups || []).map(b => b.endTime || 0),
              ...(analysis.textualVisualAnalysis?.groups || []).map(b => b.endTime || 0),
              ...(analysis.visualAnalysis?.groups || []).map(b => b.endTime || 0),
              analysis.dropoutCurve?.totalDuration || 0
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveAnalysisView; 