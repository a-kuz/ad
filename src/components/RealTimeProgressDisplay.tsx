"use client";

import React, { useState, useEffect } from 'react';
import { FiMusic, FiImage, FiType, FiBarChart, FiClock, FiCheckCircle, FiRefreshCw, FiPlay, FiZap } from 'react-icons/fi';

interface AudioBlock {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  content: string;
  purpose: string;
}

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

interface RealTimeProgressDisplayProps {
  filePairId: string;
  isAnalyzing: boolean;
}

const stepInfo: Record<string, { name: string; icon: React.ComponentType<{ className?: string }>; color: string; description: string }> = {
  'START': { name: 'Запуск', icon: FiPlay, color: 'blue', description: 'Инициализация анализа' },
  'VALIDATION': { name: 'Валидация', icon: FiCheckCircle, color: 'green', description: 'Проверка файлов' },
  'METADATA': { name: 'Метаданные', icon: FiBarChart, color: 'purple', description: 'Получение информации о видео' },
  'DROPOUT_CURVE': { name: 'Кривая досмотра', icon: FiBarChart, color: 'red', description: 'Анализ графика досмотров' },
  'AUDIO_EXTRACTION': { name: 'Извлечение аудио', icon: FiMusic, color: 'green', description: 'Извлечение аудиодорожки' },
  'AUDIO_TRANSCRIPTION': { name: 'Анализ аудио', icon: FiMusic, color: 'green', description: 'Транскрипция и группировка' },
  'SCREENSHOTS': { name: 'Скриншоты', icon: FiImage, color: 'purple', description: 'Извлечение кадров' },
  'TEXT_ANALYSIS': { name: 'Анализ текста', icon: FiType, color: 'blue', description: 'Поиск текста в кадрах' },
  'VISUAL_ANALYSIS': { name: 'Визуальный анализ', icon: FiImage, color: 'indigo', description: 'Анализ визуального контента' },
  'BLOCK_DROPOUT': { name: 'Анализ отвалов', icon: FiBarChart, color: 'red', description: 'Сопоставление с отвалами' },
  'TIMELINE': { name: 'Временная шкала', icon: FiClock, color: 'gray', description: 'Создание таймлайна' },
  'IMPROVE_DESCRIPTIONS': { name: 'Улучшение описаний', icon: FiZap, color: 'yellow', description: 'Обработка ИИ' },
  'COMPLETED': { name: 'Завершено', icon: FiCheckCircle, color: 'green', description: 'Анализ завершен' }
};

const getColorClass = (color: string) => {
  switch (color) {
    case 'blue': return 'text-blue-600';
    case 'green': return 'text-green-600';
    case 'purple': return 'text-purple-600';
    case 'red': return 'text-red-600';
    case 'indigo': return 'text-indigo-600';
    case 'yellow': return 'text-yellow-600';
    case 'gray': return 'text-gray-600';
    default: return 'text-gray-600';
  }
};

const getStatColorClass = (color: string) => {
  switch (color) {
    case 'green': return 'text-green-600';
    case 'purple': return 'text-purple-600';
    case 'blue': return 'text-blue-600';
    case 'indigo': return 'text-indigo-600';
    default: return 'text-gray-600';
  }
};

export default function RealTimeProgressDisplay({ filePairId, isAnalyzing }: RealTimeProgressDisplayProps) {
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [currentAudioBlocks, setCurrentAudioBlocks] = useState<AudioBlock[]>([]);
  const [stats, setStats] = useState({
    totalAudioBlocks: 0,
    screenshots: 0,
    textBlocks: 0,
    visualBlocks: 0
  });

  const fetchLogs = async () => {
    if (!filePairId) return;
    
    try {
      const response = await fetch(`/api/analysis-logs/${filePairId}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        
        // Обновляем статистику и аудио блоки
        let allAudioBlocks: AudioBlock[] = [];
        let latestStats = { totalAudioBlocks: 0, screenshots: 0, textBlocks: 0, visualBlocks: 0 };
        
        data.logs.forEach((log: AnalysisLog) => {
          if (log.details?.audioBlocks) {
            allAudioBlocks = [...allAudioBlocks, ...log.details.audioBlocks];
          }
          if (log.details?.screenshots) {
            latestStats.screenshots = Math.max(latestStats.screenshots, log.details.screenshots);
          }
          if (log.details?.textBlocks) {
            latestStats.textBlocks = Math.max(latestStats.textBlocks, log.details.textBlocks);
          }
          if (log.details?.visualBlocks) {
            latestStats.visualBlocks = Math.max(latestStats.visualBlocks, log.details.visualBlocks);
          }
        });
        
        // Убираем дубликаты аудио блоков
        const uniqueAudioBlocks = allAudioBlocks.filter((block, index, arr) => 
          arr.findIndex(b => b.id === block.id) === index
        );
        
        setCurrentAudioBlocks(uniqueAudioBlocks);
        setStats({
          ...latestStats,
          totalAudioBlocks: uniqueAudioBlocks.length
        });
      }
    } catch (error) {
      console.error('Failed to fetch analysis logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filePairId]);

  useEffect(() => {
    if (!isAnalyzing) return;

    const interval = setInterval(fetchLogs, 1200);
    return () => clearInterval(interval);
  }, [isAnalyzing, filePairId]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCurrentStep = () => {
    const runningStep = logs.find(log => log.status === 'running');
    return runningStep || logs[logs.length - 1];
  };

  const getProgressPercentage = () => {
    const completedSteps = logs.filter(log => log.status === 'completed').length;
    const totalSteps = Object.keys(stepInfo).length;
    return Math.min((completedSteps / totalSteps) * 100, 100);
  };

  const currentStep = getCurrentStep();
  const progressPercentage = getProgressPercentage();

  if (!isAnalyzing && logs.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            {isAnalyzing ? (
              <FiRefreshCw className="w-6 h-6 text-white animate-spin" />
            ) : (
              <FiCheckCircle className="w-6 h-6 text-white" />
            )}
          </div>
          {isAnalyzing && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            {isAnalyzing ? 'Анализ в процессе' : 'Анализ завершен'}
          </h3>
          <p className="text-gray-600 text-sm">
            {currentStep ? stepInfo[currentStep.step]?.description || currentStep.message : 'Ожидание...'}
          </p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Общий прогресс</span>
          <span className="text-sm font-bold text-blue-600">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Current Step Details */}
      {currentStep && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            {React.createElement(stepInfo[currentStep.step]?.icon || FiClock, {
              className: `w-5 h-5 ${getColorClass(stepInfo[currentStep.step]?.color || 'gray')}`
            })}
            <div>
              <div className="font-semibold text-gray-900">
                {stepInfo[currentStep.step]?.name || currentStep.step}
              </div>
              <div className="text-sm text-gray-600">
                {currentStep.message}
              </div>
            </div>
          </div>
          
          {currentStep.details?.progress !== undefined && (
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">Прогресс этапа</span>
                <span className="text-xs font-medium text-gray-800">{Math.round(currentStep.details.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${currentStep.details.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {currentStep.details?.currentBlock && (
            <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded mt-2">
              🔄 {currentStep.details.currentBlock}
            </div>
          )}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Аудио блоки', value: stats.totalAudioBlocks, icon: FiMusic, color: 'green' },
          { label: 'Скриншоты', value: stats.screenshots, icon: FiImage, color: 'purple' },
          { label: 'Текст блоки', value: stats.textBlocks, icon: FiType, color: 'blue' },
          { label: 'Визуал блоки', value: stats.visualBlocks, icon: FiImage, color: 'indigo' }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            {React.createElement(stat.icon, {
              className: `w-6 h-6 mx-auto mb-2 ${getStatColorClass(stat.color)}`
            })}
            <div className="text-lg font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Audio Blocks Display */}
      {currentAudioBlocks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FiMusic className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-gray-900">
              Найденные аудио блоки ({currentAudioBlocks.length})
            </h4>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {currentAudioBlocks.slice(0, 6).map((block, index) => (
              <div 
                key={block.id} 
                className="bg-green-50 border border-green-200 rounded-lg p-3 hover:bg-green-100 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-green-800 text-sm truncate">
                      {block.name}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      {formatTime(block.startTime)} - {formatTime(block.endTime)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 truncate">
                      {block.content}
                    </div>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
            {currentAudioBlocks.length > 6 && (
              <div className="text-center py-2">
                <span className="text-sm text-gray-500">
                  ... и ещё {currentAudioBlocks.length - 6} блоков
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Footer */}
      {isAnalyzing && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
            <FiRefreshCw className="w-4 h-4 animate-spin" />
            <span>Анализ выполняется в реальном времени...</span>
          </div>
        </div>
      )}
    </div>
  );
} 