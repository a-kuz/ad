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
     
      {/* Интерактивный таймлайн удержания аудитории - перемещен в начало */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-thin mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></span>
          Таймлайн
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
            sessionId={sessionId}
            filePairId={filePairId}
          />
        </div>
      </div>

      {/* Visual Analysis Settings */}
      <div className="border-2 border-indigo-100 rounded-lg p-4">
        <button
          onClick={() => setIsVisualFormExpanded(!isVisualFormExpanded)}
          className="w-full flex justify-between items-center text-left"
        >
          <h3 className="text-xl font-thin text-gray-900 flex items-center">
            <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
            Промпты
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

      {/* 1. Аудио блоки */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-thin mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
          Аудио блоки
          <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">
            {analysis.audioAnalysis?.groups?.length || 0} блоков
          </span>
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Название блока</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">Время</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Содержание</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Назначение</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Анализ отвалов</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analysis.audioAnalysis?.groups?.map((block: ContentBlock) => {
                const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
                  (ba: BlockDropoutAnalysis) => ba.blockId === block.id && ba.blockName === block.name
                );
                return (
                  <tr key={block.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{block.name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatTime(block.startTime)} - {formatTime(block.endTime)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 line-clamp-3">{block.content}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-500">{block.purpose}</div>
                    </td>
                    <td className="px-4 py-4">
                      {blockAnalysis ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Начальное удержание</div>
                            <div className="font-medium text-gray-900">{blockAnalysis.startRetention}%</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Конечное удержание</div>
                            <div className="font-medium text-gray-900">{blockAnalysis.endRetention}%</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Абсолютный отвал</div>
                            <div className={`font-medium ${blockAnalysis.absoluteDropout > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                              {blockAnalysis.absoluteDropout > 0 ? `-${blockAnalysis.absoluteDropout}%` : `+${Math.abs(blockAnalysis.absoluteDropout)}%`}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Относительный отвал</div>
                            <div className={`font-medium ${blockAnalysis.relativeDropout > 20 ? 'text-red-600' : 'text-gray-900'}`}>
                              {blockAnalysis.relativeDropout.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Нет данных</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Визуальные блоки */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-thin mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
          Визуальные блоки
          <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
            {analysis.visualAnalysis?.groups?.length || 0} блоков
          </span>
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Название блока</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">Время</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Содержание</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Назначение</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Анализ отвалов</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analysis.visualAnalysis?.groups?.map((block: ContentBlock) => {
                const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
                  (ba: BlockDropoutAnalysis) => ba.blockId === block.id && ba.blockName === block.name
                );
                return (
                  <tr key={block.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{block.name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatTime(block.startTime)} - {formatTime(block.endTime)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 line-clamp-3">{block.content}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-500">{block.purpose}</div>
                    </td>
                    <td className="px-4 py-4">
                      {blockAnalysis ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Начальное удержание</div>
                            <div className="font-medium text-gray-900">{blockAnalysis.startRetention}%</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Конечное удержание</div>
                            <div className="font-medium text-gray-900">{blockAnalysis.endRetention}%</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Абсолютный отвал</div>
                            <div className={`font-medium ${blockAnalysis.absoluteDropout > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                              {blockAnalysis.absoluteDropout > 0 ? `-${blockAnalysis.absoluteDropout}%` : `+${Math.abs(blockAnalysis.absoluteDropout)}%`}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Относительный отвал</div>
                            <div className={`font-medium ${blockAnalysis.relativeDropout > 20 ? 'text-red-600' : 'text-gray-900'}`}>
                              {blockAnalysis.relativeDropout.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Нет данных</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Текстовые блоки */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-xl font-thin mb-4 flex items-center text-gray-900">
          <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
          Текстовые блоки
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
            {analysis.textualVisualAnalysis?.groups?.length || 0} блоков
          </span>
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Название блока</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">Время</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Содержание</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">Назначение</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Анализ отвалов</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analysis.textualVisualAnalysis?.groups?.map((block: ContentBlock) => {
                const blockAnalysis = analysis.blockDropoutAnalysis?.find?.(
                  (ba: BlockDropoutAnalysis) => ba.blockId === block.id && ba.blockName === block.name
                );
                return (
                  <tr key={block.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{block.name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatTime(block.startTime)} - {formatTime(block.endTime)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 line-clamp-3">{block.content}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-500">{block.purpose}</div>
                    </td>
                    <td className="px-4 py-4">
                      {blockAnalysis ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Начальное удержание</div>
                            <div className="font-medium text-gray-900">{blockAnalysis.startRetention}%</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Конечное удержание</div>
                            <div className="font-medium text-gray-900">{blockAnalysis.endRetention}%</div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Абсолютный отвал</div>
                            <div className={`font-medium ${blockAnalysis.absoluteDropout > 5 ? 'text-red-600' : 'text-gray-900'}`}>
                              {blockAnalysis.absoluteDropout > 0 ? `-${blockAnalysis.absoluteDropout}%` : `+${Math.abs(blockAnalysis.absoluteDropout)}%`}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-500 mb-1">Относительный отвал</div>
                            <div className={`font-medium ${blockAnalysis.relativeDropout > 20 ? 'text-red-600' : 'text-gray-900'}`}>
                              {blockAnalysis.relativeDropout.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Нет данных</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>



    </div>
  );
};

export default ComprehensiveAnalysisView; 