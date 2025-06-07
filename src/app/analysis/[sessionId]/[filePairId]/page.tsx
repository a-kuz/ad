"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { UserSession, UploadedFilePair, ComprehensiveVideoAnalysis } from '@/types';
import { FiArrowLeft, FiAlertTriangle, FiCheckCircle, FiClock } from 'react-icons/fi';
import Link from 'next/link';
import Image from 'next/image';
import ComprehensiveAnalysisView from '@/components/ComprehensiveAnalysisView';

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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="w-full">
          <div className="mb-6 sm:mb-8">
            <Link
              href={`/upload/${sessionId}`}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium text-sm sm:text-base touch-manipulation"
            >
              <FiArrowLeft className="w-4 h-4" />
              Назад к сессии
            </Link>
            
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-thin text-slate-800 mb-4">
                    {filePair.videoName}
                  </h1>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <h3 className="font-thin text-slate-600 mb-2 text-sm sm:text-base">Информация о файлах</h3>
                      <div className="space-y-1 text-slate-700 text-xs sm:text-sm">
                        <div><span className="font-medium">Видео:</span> <span className="break-words">{filePair.videoName}</span></div>
                        <div><span className="font-medium">Загружено:</span> {new Date(filePair.uploadedAt).toLocaleString('ru-RU')}</div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-thin text-slate-600 mb-2 text-sm sm:text-base">Статус анализа</h3>
                      {comprehensiveAnalysis ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                            <span className="text-green-700 font-medium text-xs sm:text-sm">Комплексный анализ завершен</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FiClock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                          <span className="text-yellow-700 font-medium text-xs sm:text-sm">Анализ в процессе...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* График отвалов в правом верхнем углу */}
                {comprehensiveAnalysis && (
                  <div className="lg:col-span-1">
                    <h3 className="font-thin text-slate-600 mb-2 text-sm sm:text-base">График отвалов аудитории</h3>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="h-32 relative">
                        <svg viewBox="0 0 100 50" className="w-full h-full">
                          {/* График без осей */}
                          <polyline
                            points={getPointsFromDropoutCurve(comprehensiveAnalysis?.dropoutCurve).map((p: any) => {
                              const x = (p.x / (filePair.videoMetadata?.duration || 1)) * 100;
                              const y = 50 - (p.y / 2);
                              return `${x},${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="1"
                          />
                          
                          {/* Заполнение под графиком */}
                          <path
                            d={`
                              M0,50 
                              ${getPointsFromDropoutCurve(comprehensiveAnalysis?.dropoutCurve).map((p: any) => {
                                const x = (p.x / (filePair.videoMetadata?.duration || 1)) * 100;
                                const y = 50 - (p.y / 2);
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
                        </svg>
                      </div>
                      <div className="mt-2 text-center">
                        <div className="text-xs text-gray-500">
                          Средний процент досмотра: {calculateAverageRetention(comprehensiveAnalysis?.dropoutCurve)?.toFixed(1) || '0.0'}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
      </div>
    </main>
  );
} 