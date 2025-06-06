"use client";

import { useState, useEffect } from 'react';
import { FiClock, FiCheckCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi';

interface AnalysisLog {
  id: string;
  filePairId: string;
  step: string;
  message: string;
  status: 'running' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
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
  'SCREENSHOTS': 'Скриншоты',
  'TEXT_ANALYSIS': 'Анализ текста',
  'VISUAL_ANALYSIS': 'Визуальный анализ',
  'BLOCK_DROPOUT': 'Анализ отвалов',
  'TIMELINE': 'Временная шкала',
  'IMPROVE_DESCRIPTIONS': 'Улучшение описаний',
  'COMPLETED': 'Завершено'
};

export default function AnalysisLogs({ filePairId, isAnalyzing }: AnalysisLogsProps) {
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    if (!filePairId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/analysis-logs/${filePairId}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
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

    const interval = setInterval(fetchLogs, 2000);
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

  if (logs.length === 0 && !isAnalyzing) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <FiClock className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Процесс анализа</h3>
        {loading && <FiRefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
      </div>
      
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            {isAnalyzing ? 'Ожидание логов анализа...' : 'Логи анализа отсутствуют'}
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`border-l-4 pl-4 py-2 ${getStatusColor(log.status)}`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(log.status)}
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
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
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