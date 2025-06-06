"use client";

import { useState, useEffect } from 'react';
import { FiClock, FiCheckCircle, FiXCircle, FiRefreshCw, FiMusic, FiImage, FiType, FiBarChart, FiPlay, FiPause } from 'react-icons/fi';

interface AnalysisLog {
  id: string;
  filePairId: string;
  step: string;
  message: string;
  status: 'running' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  details?: {
    progress?: number;
    audioBlocks?: AudioBlock[];
    screenshots?: number;
    textBlocks?: number;
    visualBlocks?: number;
    currentBlock?: string;
  };
}

interface AudioBlock {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  content: string;
  purpose: string;
}

interface AnalysisLogsProps {
  filePairId: string;
  isAnalyzing: boolean;
}

const stepNames: Record<string, string> = {
  'START': 'Запуск',
  'VALIDATION': 'Валидация',
  'METADATA': 'Метаданные',
  'DROPOUT_CURVE': 'Кривая досмотра',
  'AUDIO': 'Аудио анализ',
  'AUDIO_EXTRACTION': 'Извлечение аудио',
  'AUDIO_TRANSCRIPTION': 'Транскрипция',
  'AUDIO_GROUPING': 'Группировка аудио',
  'SCREENSHOTS': 'Скриншоты',
  'TEXT_ANALYSIS': 'Анализ текста',
  'VISUAL_ANALYSIS': 'Визуальный анализ',
  'BLOCK_DROPOUT': 'Анализ отвалов',
  'TIMELINE': 'Временная шкала',
  'IMPROVE_DESCRIPTIONS': 'Улучшение описаний',
  'COMPLETED': 'Завершено'
};

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'START': FiPlay,
  'VALIDATION': FiCheckCircle,
  'METADATA': FiBarChart,
  'DROPOUT_CURVE': FiBarChart,
  'AUDIO': FiMusic,
  'AUDIO_EXTRACTION': FiMusic,
  'AUDIO_TRANSCRIPTION': FiMusic,
  'AUDIO_GROUPING': FiMusic,
  'SCREENSHOTS': FiImage,
  'TEXT_ANALYSIS': FiType,
  'VISUAL_ANALYSIS': FiImage,
  'BLOCK_DROPOUT': FiBarChart,
  'TIMELINE': FiClock,
  'IMPROVE_DESCRIPTIONS': FiCheckCircle,
  'COMPLETED': FiCheckCircle
};

export default function AnalysisLogs({ filePairId, isAnalyzing }: AnalysisLogsProps) {
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [audioBlocks, setAudioBlocks] = useState<AudioBlock[]>([]);

  const fetchLogs = async () => {
    if (!filePairId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/analysis-logs/${filePairId}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        
        // Извлекаем аудио блоки из логов
        const allAudioBlocks: AudioBlock[] = [];
        data.logs.forEach((log: AnalysisLog) => {
          if (log.details?.audioBlocks) {
            allAudioBlocks.push(...log.details.audioBlocks);
          }
        });
        setAudioBlocks(allAudioBlocks);
      }
    } catch (error) {
      console.error('Failed to fetch analysis logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filePairId]);

  useEffect(() => {
    if (!isAnalyzing) return;

    const interval = setInterval(fetchLogs, 1500); // Немного чаще обновляем
    return () => clearInterval(interval);
  }, [isAnalyzing, filePairId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <FiRefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'completed':
        return <FiCheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <FiXCircle className="w-4 h-4 text-red-600" />;
      default:
        return <FiClock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStepIcon = (step: string) => {
    const IconComponent = stepIcons[step] || FiClock;
    return <IconComponent className="w-4 h-4 text-blue-600" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'border-l-blue-500 bg-blue-50';
      case 'completed':
        return 'border-l-green-500 bg-green-50';
      case 'error':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-gray-300 bg-gray-50';
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderLogDetails = (log: AnalysisLog) => {
    if (!log.details) return null;

    return (
      <div className="mt-2 space-y-2">
        {log.details.progress !== undefined && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${log.details.progress}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-600">{Math.round(log.details.progress)}%</span>
          </div>
        )}

        {log.details.currentBlock && (
          <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
            📍 {log.details.currentBlock}
          </div>
        )}

        {log.details.audioBlocks && log.details.audioBlocks.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded p-2">
            <div className="text-xs font-medium text-green-800 mb-1">
              🎵 Найдено аудио блоков: {log.details.audioBlocks.length}
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {log.details.audioBlocks.map((block, index) => (
                <div key={block.id} className="text-xs text-green-700 bg-white p-1.5 rounded border">
                  <div className="font-medium">{block.name}</div>
                  <div className="text-green-600">
                    {formatTime(block.startTime)} - {formatTime(block.endTime)}
                  </div>
                  <div className="text-gray-600 truncate">{block.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(log.details.screenshots || log.details.textBlocks || log.details.visualBlocks) && (
          <div className="flex gap-3 text-xs">
            {log.details.screenshots && (
              <div className="flex items-center gap-1 text-purple-700">
                <FiImage className="w-3 h-3" />
                <span>{log.details.screenshots} скриншотов</span>
              </div>
            )}
            {log.details.textBlocks && (
              <div className="flex items-center gap-1 text-blue-700">
                <FiType className="w-3 h-3" />
                <span>{log.details.textBlocks} текст. блоков</span>
              </div>
            )}
            {log.details.visualBlocks && (
              <div className="flex items-center gap-1 text-indigo-700">
                <FiImage className="w-3 h-3" />
                <span>{log.details.visualBlocks} виз. блоков</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (logs.length === 0 && !isAnalyzing) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <FiClock className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Детальный прогресс анализа</h3>
        {loading && <FiRefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
      </div>
      
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            {isAnalyzing ? 'Ожидание логов анализа...' : 'Логи анализа отсутствуют'}
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`border-l-4 pl-4 py-3 rounded-r ${getStatusColor(log.status)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(log.status)}
                  {getStepIcon(log.step)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">
                      {stepNames[log.step] || log.step}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.updatedAt).toLocaleTimeString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 break-words">
                    {log.message}
                  </p>
                  {renderLogDetails(log)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Сводка по найденным аудио блокам */}
      {audioBlocks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <FiMusic className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-900">
              Найдено аудио блоков: {audioBlocks.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
            {audioBlocks.slice(0, 5).map((block) => (
              <div key={block.id} className="bg-green-50 border border-green-200 rounded p-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-green-800 truncate">
                      {block.name}
                    </div>
                    <div className="text-xs text-green-600">
                      {formatTime(block.startTime)} - {formatTime(block.endTime)}
                    </div>
                    <div className="text-xs text-gray-600 truncate mt-1">
                      {block.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {audioBlocks.length > 5 && (
              <div className="text-xs text-gray-500 text-center py-1">
                ... и ещё {audioBlocks.length - 5} блоков
              </div>
            )}
          </div>
        </div>
      )}
      
      {isAnalyzing && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <FiRefreshCw className="w-4 h-4 animate-spin" />
            <span>Анализ выполняется...</span>
          </div>
        </div>
      )}
    </div>
  );
} 