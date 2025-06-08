"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { UserSession, UploadedFilePair, ComprehensiveVideoAnalysis } from '@/types';
import { FiArrowLeft, FiAlertTriangle, FiCheckCircle, FiClock } from 'react-icons/fi';
import Link from 'next/link';
import Image from 'next/image';
import ComprehensiveAnalysisView from '@/components/ComprehensiveAnalysisView';
import MiniDropoutChart from '@/components/MiniDropoutChart';

// Форматирование времени (секунды -> MM:SS)
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Расчет среднего процента досмотра
const calculateAverageRetention = (dropoutCurve: any): number => {
  if (!dropoutCurve) {
    return 0;
  }
  
  // Handle both structures: points (DropoutCurvePoint[]) and dropouts (DropoutPoint[])
  if (dropoutCurve.points && dropoutCurve.points.length > 0) {
    // DropoutCurveTable structure with points
    let sum = 0;
    for (const point of dropoutCurve.points) {
      sum += point.retentionPercentage || 0;
    }
    return sum / dropoutCurve.points.length;
  } else if (dropoutCurve.dropouts && dropoutCurve.dropouts.length > 0 && dropoutCurve.initialViewers > 0) {
    // DropoutCurve structure with dropouts
    let sum = 0;
    for (const dropout of dropoutCurve.dropouts) {
      sum += (dropout.viewersAfter / dropoutCurve.initialViewers) * 100;
    }
    return sum / dropoutCurve.dropouts.length;
  }
  
  return 0;
};

// Получение точек для графика из кривой досмотра
const getPointsFromDropoutCurve = (dropoutCurve: any): { x: number, y: number }[] => {
  if (!dropoutCurve || !dropoutCurve.points || dropoutCurve.points.length === 0) {
    return [];
  }
  
  const initialViewers = dropoutCurve.initialViewers || 0;
  
  return dropoutCurve.points.map((point: any) => ({
    x: point.timestamp,
    y: (point.viewers / initialViewers) * 100
  }));
};

// Преобразование данных для MiniDropoutChart
const getDropoutCurveTable = (dropoutCurve: any) => {
  if (!dropoutCurve) return null;

  // Если это уже DropoutCurveTable формат
  if (dropoutCurve.points && dropoutCurve.points.length > 0 && dropoutCurve.points[0].retentionPercentage !== undefined) {
    return dropoutCurve;
  }

  // Если это DropoutCurve формат, преобразуем
  if (dropoutCurve.dropouts && dropoutCurve.initialViewers) {
    const points = dropoutCurve.dropouts.map((dropout: any) => ({
      timestamp: dropout.time,
      retentionPercentage: (dropout.viewersAfter / dropoutCurve.initialViewers) * 100,
      dropoutPercentage: 100 - ((dropout.viewersAfter / dropoutCurve.initialViewers) * 100)
    }));

    return {
      points,
      step: 0.5,
      totalDuration: dropoutCurve.totalDuration || 0
    };
  }

  return null;
};

export default function AnalysisPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const filePairId = params.filePairId as string;
  
  const [, setSession] = useState<UserSession | null>(null);
  const [filePair, setFilePair] = useState<UploadedFilePair | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comprehensiveAnalysis, setComprehensiveAnalysis] = useState<ComprehensiveVideoAnalysis | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}`);
        
        if (response.ok) {
          const sessionData: UserSession = await response.json();
          setSession(sessionData);
          
          const pair = sessionData.filePairs.find(fp => fp.id === filePairId);
          if (pair) {
            setFilePair(pair);
            
            // Попытаемся загрузить комплексный анализ из API
            try {
              const comprehensiveResponse = await fetch(`/api/comprehensive-analysis/${filePairId}`);
              if (comprehensiveResponse.ok) {
                const comprehensiveData = await comprehensiveResponse.json();
                setComprehensiveAnalysis(comprehensiveData.analysis);
              } else {
                // Fallback: попытаемся загрузить из поля report
                if (pair.analysis?.report) {
                  try {
                    const parsedReport = JSON.parse(pair.analysis.report);
                    if (parsedReport.dropoutCurve && parsedReport.audioAnalysis) {
                      setComprehensiveAnalysis(parsedReport);
                    }
                  } catch (parseError) {
                    console.log('Не удалось загрузить комплексный анализ из report:', parseError);
                  }
                }
              }
            } catch (comprehensiveError) {
              console.log('Ошибка загрузки комплексного анализа:', comprehensiveError);
              // Fallback: попытаемся загрузить из поля report
              if (pair.analysis?.report) {
                try {
                  const parsedReport = JSON.parse(pair.analysis.report);
                  if (parsedReport.dropoutCurve && parsedReport.audioAnalysis) {
                    setComprehensiveAnalysis(parsedReport);
                  }
                } catch (parseError) {
                  console.log('Не удалось загрузить комплексный анализ из report:', parseError);
                }
              }
            }
          } else {
            setError('Пара файлов не найдена');
          }
        } else {
          setError('Сессия не найдена');
        }
      } catch {
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId && filePairId) {
      fetchData();
    }
  }, [sessionId, filePairId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4 sm:p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 text-sm sm:text-base">Загрузка анализа...</p>
        </div>
      </main>
    );
  }

  if (error || !filePair) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4 sm:p-8">
        <div className="bg-white rounded-xl p-6 sm:p-8 shadow-lg text-center max-w-md mx-auto">
          <FiAlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4">Ошибка</h1>
          <p className="text-slate-600 mb-6 text-sm sm:text-base">{error}</p>
          <Link
            href={`/upload/${sessionId}`}
            className="inline-flex items-center gap-2 px-4 sm:px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base min-h-[44px] touch-manipulation"
          >
            <FiArrowLeft className="w-4 h-4" />
            Назад к загрузке
          </Link>
        </div>
      </main>
    );
  }

  const analysis = filePair.analysis;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/upload/${sessionId}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium text-sm"
          >
            <FiArrowLeft className="w-4 h-4" />
            Назад к сессии
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Анализ видео
              </h1>
              <p className="text-gray-600 text-sm">
                {filePair.generatedTitle || filePair.videoName}
              </p>
            </div>
            
            {/* График отвалов аудитории */}
            {comprehensiveAnalysis && (
              <div className="ml-4">
                <MiniDropoutChart 
                  dropoutData={getDropoutCurveTable(comprehensiveAnalysis.dropoutCurve)} 
                  width={120} 
                  height={80} 
                />
              </div>
            )}
          </div>
        </div>

        {comprehensiveAnalysis && (
          <div className="w-full">
            {/* Компонент с полным анализом */}
            <ComprehensiveAnalysisView 
              analysis={comprehensiveAnalysis} 
              sessionId={sessionId} 
              filePairId={filePairId} 
            />
          </div>
        )}

        {/* Если анализ еще не загружен, показываем исходную версию интерфейса */}
        {!comprehensiveAnalysis && (
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="text-center">
                <h2 className="text-lg sm:text-xl font-thin text-slate-800 mb-4">Генерация комплексного анализа</h2>
                <p className="text-slate-600 mb-6 text-sm sm:text-base">
                  Создайте детальный анализ видео с разбором по блокам
                </p>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/test-comprehensive-analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId, filePairId })
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        setComprehensiveAnalysis(result.analysis);
                      }
                    } catch (error) {
                      console.error('Failed to generate test analysis:', error);
                    }
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Сгенерировать комплексный анализ
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-8 sm:p-12 shadow-lg text-center">
              <FiClock className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl sm:text-2xl font-thin text-slate-800 mb-4">Ожидание комплексного анализа</h2>
              <p className="text-slate-600 mb-6 text-sm sm:text-base">
                Ваши файлы загружены. Нажмите кнопку выше для генерации комплексного анализа.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 