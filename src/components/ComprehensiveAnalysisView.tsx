import React, { useState } from 'react';
import { 
  ComprehensiveVideoAnalysis, 
  BlockDropoutAnalysis, 
  ContentBlock,
  DropoutCurvePoint 
} from '@/types';

interface ComprehensiveAnalysisViewProps {
  analysis: ComprehensiveVideoAnalysis;
}

const ComprehensiveAnalysisView: React.FC<ComprehensiveAnalysisViewProps> = ({ analysis }) => {
  const [showAllPoints, setShowAllPoints] = useState(false);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

  const getDropoutColor = (dropout: number) => {
    if (dropout > 80) return 'text-red-600';
    if (dropout > 50) return 'text-orange-600';
    return 'text-green-600';
  };

  const getDropoutIcon = (dropout: number) => {
    if (dropout > 80) return '🔴';
    if (dropout > 50) return '🟡';
    return '🟢';
  };

  const getDropoutPercentage = (block: BlockDropoutAnalysis) => {
    return block.dropoutPercentage ?? (block.endRetention !== undefined ? 100 - block.endRetention : 0);
  };

  return (
    <div className="space-y-6 bg-gray-100 min-h-screen">
      {/* 1. Кривая досмотра */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold flex items-center text-gray-900">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            1. Кривая досмотра ({showAllPoints ? 'все' : 'первые 20'} точек)
          </h3>
          {analysis.dropoutCurve.points.length > 20 && (
            <button
              onClick={() => setShowAllPoints(!showAllPoints)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              {showAllPoints ? 'Скрыть' : `Показать все ${analysis.dropoutCurve.points.length} точек`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="text-left py-3 px-4 font-semibold text-gray-800">Время</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-800">Удержание (%)</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-800">Отвал (%)</th>
              </tr>
            </thead>
            <tbody>
              {(showAllPoints ? analysis.dropoutCurve.points : analysis.dropoutCurve.points.slice(0, 20)).map((point: DropoutCurvePoint, index: number) => (
                <tr key={index} className={`border-b ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="px-4 py-3 text-gray-800 font-medium">{formatTime(point.timestamp)}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{formatPercentage(point.retentionPercentage)}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{formatPercentage(point.dropoutPercentage)}</td>
                </tr>
              ))}
              {!showAllPoints && analysis.dropoutCurve.points.length > 20 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-center text-gray-700 font-medium">
                    ... и еще {analysis.dropoutCurve.points.length - 20} точек
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Удержание по текстам в креативе */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
          Удержание по текстам в креативе (все блоки)
        </h3>
        {analysis.textualVisualAnalysis.groups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-800 text-white rounded-lg shadow border">
              <thead>
                <tr className="bg-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">№</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Группа текста</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Время (сек)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Текст</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Начало (%)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Конец (%)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Отвал %</th>
                </tr>
              </thead>
              <tbody>
                {analysis.textualVisualAnalysis.groups.map((block: ContentBlock, index: number) => {
                  const dropout = analysis.blockDropoutAnalysis.find(d => 
                    d.blockId === block.id && d.blockName === block.name
                  );
                  const dropoutPercentage = dropout?.dropoutPercentage ?? (dropout?.endRetention !== undefined ? 100 - dropout.endRetention : 0);
                  return (
                    <tr key={block.id} className="border-b border-gray-600 hover:bg-gray-700">
                      <td className="py-3 px-4 text-gray-100 font-medium">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-gray-100">{block.name}</td>
                      <td className="py-3 px-4 text-gray-100 font-medium">{block.startTime.toFixed(1)}–{block.endTime.toFixed(1)}</td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="break-words italic text-gray-200">
                          {block.content || block.purpose}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-100">{dropout?.startRetention.toFixed(2) || 'N/A'}</td>
                      <td className="py-3 px-4 font-semibold text-gray-100">{dropout?.endRetention.toFixed(2) || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${dropoutPercentage > 80 ? 'text-red-300' : dropoutPercentage > 50 ? 'text-yellow-300' : 'text-green-300'}`}>
                          {dropoutPercentage > 0 ? `${getDropoutIcon(dropoutPercentage)} ${dropoutPercentage.toFixed(1)}%` : 
                           dropoutPercentage === 0 ? `${getDropoutIcon(dropoutPercentage)} 0.0%` : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-700 font-medium">Нет данных о текстовых блоках</p>
        )}
      </div>

      {/* 3. Анализ визуальных блоков: цель, смысл, удержание */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
          Анализ визуальных блоков: цель, смысл, удержание
        </h3>
        {analysis.visualAnalysis.groups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-800 text-white rounded-lg shadow border">
              <thead>
                <tr className="bg-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Визуальный блок</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Время (сек)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Цель</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Смысл для пользователя</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-100">Отвал %</th>
                </tr>
              </thead>
              <tbody>
                {analysis.visualAnalysis.groups.map((block: ContentBlock, index: number) => {
                  const dropout = analysis.blockDropoutAnalysis.find(d => 
                    d.blockId === block.id && d.blockName === block.name
                  );
                  const dropoutPercentage = dropout?.dropoutPercentage ?? (dropout?.endRetention !== undefined ? 100 - dropout.endRetention : 0);
                  return (
                    <tr key={block.id} className="border-b border-gray-600 hover:bg-gray-700">
                      <td className="py-4 px-4 font-semibold text-gray-100">{block.name}</td>
                      <td className="py-4 px-4 text-gray-100 font-medium">{block.startTime.toFixed(0)}–{block.endTime.toFixed(0)}</td>
                      <td className="py-4 px-4 text-gray-100 font-medium">{block.purpose || 'Визуальный элемент'}</td>
                      <td className="py-4 px-4 max-w-md">
                        <div className="text-sm leading-relaxed break-words text-gray-200">
                          {block.content || 'Создает визуальный интерес и поддерживает вовлеченность'}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`font-semibold ${dropoutPercentage > 80 ? 'text-red-300' : dropoutPercentage > 50 ? 'text-yellow-300' : 'text-green-300'}`}>
                          {dropoutPercentage > 0 ? `${getDropoutIcon(dropoutPercentage)} ${dropoutPercentage.toFixed(1)}%` : 
                           dropoutPercentage === 0 ? `${getDropoutIcon(dropoutPercentage)} 0.0%` : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-700 font-medium">Нет данных о визуальных блоках</p>
        )}
      </div>

      {/* 4. Аудио блоки с анализом отвалов */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          Аудио блоки с анализом отвалов
        </h3>
        <div className="space-y-4">
          {analysis.audioAnalysis.groups.map((block: ContentBlock) => {
            const blockAnalysis = analysis.blockDropoutAnalysis.find(
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
                  <div className="grid grid-cols-3 gap-4 text-sm bg-gray-100 border p-4 rounded">
                    <div>
                      <span className="font-semibold text-gray-800">Начальное удержание:</span><br/>
                      <span className="text-lg font-bold text-blue-700">{blockAnalysis.startRetention.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">Конечное удержание:</span><br/>
                      <span className="text-lg font-bold text-blue-700">{blockAnalysis.endRetention.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">Отвал %:</span><br/>
                      <span className={`text-lg font-bold ${(blockAnalysis.dropoutPercentage ?? (blockAnalysis.endRetention !== undefined ? 100 - blockAnalysis.endRetention : 0)) > 80 ? 'text-red-700' : (blockAnalysis.dropoutPercentage ?? (blockAnalysis.endRetention !== undefined ? 100 - blockAnalysis.endRetention : 0)) > 50 ? 'text-orange-700' : 'text-green-700'}`}>
                        {getDropoutIcon(blockAnalysis.dropoutPercentage ?? (blockAnalysis.endRetention !== undefined ? 100 - blockAnalysis.endRetention : 0))} {(blockAnalysis.dropoutPercentage ?? (blockAnalysis.endRetention !== undefined ? 100 - blockAnalysis.endRetention : 0)).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Сопоставление блоков по времени */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
          Сопоставление блоков по времени
        </h3>
        <div className="space-y-4">
          {[
            ...analysis.audioAnalysis.groups.map(block => ({ ...block, type: 'Аудио', icon: '🎵', bgColor: 'bg-green-50', borderColor: 'border-green-200', tagColor: 'bg-green-100 text-green-800' })),
            ...analysis.textualVisualAnalysis.groups.map(block => ({ ...block, type: 'Текст', icon: '📝', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', tagColor: 'bg-blue-100 text-blue-800' })),
            ...analysis.visualAnalysis.groups.map(block => ({ ...block, type: 'Визуал', icon: '🎬', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', tagColor: 'bg-purple-100 text-purple-800' }))
          ]
            .sort((a, b) => a.startTime - b.startTime)
            .map((block, index) => {
              const dropout = analysis.blockDropoutAnalysis.find(d => 
                d.blockId === block.id && d.blockName === block.name
              );
              const dropoutPercentage = dropout?.dropoutPercentage ?? (dropout?.endRetention !== undefined ? 100 - dropout.endRetention : 0);
              const duration = block.endTime - block.startTime;
              
              return (
                <div key={`${block.type}-${block.id}`} className={`${block.bgColor} ${block.borderColor} border-2 rounded-lg p-5 hover:shadow-md transition-shadow`}>
                  {/* Заголовок блока */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{block.icon}</span>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">{block.name}</h4>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${block.tagColor}`}>
                          {block.type}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-600">Время</div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatTime(block.startTime)} - {formatTime(block.endTime)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Длительность: {duration.toFixed(1)}с
                      </div>
                    </div>
                  </div>

                  {/* Содержание */}
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Содержание:</div>
                    <div className="text-gray-800 leading-relaxed bg-white p-3 rounded border">
                      {block.content || block.purpose || 'Содержание не определено'}
                    </div>
                  </div>

                  {/* Метрики удержания */}
                  {dropout && (
                    <div className="grid grid-cols-3 gap-4 bg-white p-4 rounded-lg border">
                      <div className="text-center">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                          Начальное удержание
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                          {dropout.startRetention.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                          Конечное удержание
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                          {dropout.endRetention.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                          Отвал аудитории
                        </div>
                        <div className={`text-2xl font-bold ${dropoutPercentage > 80 ? 'text-red-600' : dropoutPercentage > 50 ? 'text-orange-600' : 'text-green-600'}`}>
                          {getDropoutIcon(dropoutPercentage)} {dropoutPercentage.toFixed(1)}%
                        </div>
                        {dropoutPercentage > 80 && (
                          <div className="text-xs text-red-600 font-semibold mt-1">
                            ⚠️ Критический отвал
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Сводка по критическим блокам */}
      <div className="bg-red-50 border-l-4 border-red-600 rounded-lg shadow border p-6">
        <h3 className="text-xl font-semibold mb-4 text-red-900 flex items-center">
          <span className="mr-2">⚠️</span>
          Критические блоки (отвал > 80%)
        </h3>
        <div className="space-y-3">
          {analysis.blockDropoutAnalysis
            .filter((block: BlockDropoutAnalysis) => getDropoutPercentage(block) > 80)
            .sort((a: BlockDropoutAnalysis, b: BlockDropoutAnalysis) => getDropoutPercentage(b) - getDropoutPercentage(a))
            .map((block: BlockDropoutAnalysis) => (
              <div key={block.blockId} className="flex justify-between items-center p-3 bg-white rounded-lg shadow border">
                <div>
                  <span className="font-semibold text-gray-900">{block.blockName}</span>
                  <div className="text-sm text-gray-700 font-medium">
                    {formatTime(block.startTime)} - {formatTime(block.endTime)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-red-700 font-bold text-lg">
                    ▼ {getDropoutPercentage(block).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-700 font-medium">отвал в %</div>
                </div>
              </div>
            ))}
          {analysis.blockDropoutAnalysis.filter((block: BlockDropoutAnalysis) => getDropoutPercentage(block) > 80).length === 0 && (
            <div className="text-center py-4">
              <span className="text-green-700 font-semibold">✅ Нет критических блоков с высоким отвалом</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveAnalysisView; 