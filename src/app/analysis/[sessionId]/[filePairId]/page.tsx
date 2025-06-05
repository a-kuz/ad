"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { UserSession, UploadedFilePair, ComprehensiveVideoAnalysis } from '@/types';
import { FiArrowLeft, FiAlertTriangle, FiCheckCircle, FiClock } from 'react-icons/fi';
import Link from 'next/link';
import Image from 'next/image';
import ComprehensiveAnalysisView from '@/components/ComprehensiveAnalysisView';

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
            
            // Попытаемся загрузить комплексный анализ из поля report
            if (pair.analysis?.report) {
              try {
                const parsedReport = JSON.parse(pair.analysis.report);
                if (parsedReport.dropoutCurve && parsedReport.audioAnalysis) {
                  setComprehensiveAnalysis(parsedReport);
                }
              } catch (parseError) {
                console.log('Не удалось загрузить комплексный анализ:', parseError);
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <Link
              href={`/upload/${sessionId}`}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium text-sm sm:text-base touch-manipulation"
            >
              <FiArrowLeft className="w-4 h-4" />
              Назад к сессии
            </Link>
            
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 mb-4">
                Комплексный анализ видео
              </h1>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h3 className="font-semibold text-slate-600 mb-2 text-sm sm:text-base">Информация о файлах</h3>
                  <div className="space-y-1 text-slate-700 text-xs sm:text-sm">
                    <div><span className="font-medium">Видео:</span> <span className="break-words">{filePair.videoName}</span></div>
                    <div><span className="font-medium">Загружено:</span> {new Date(filePair.uploadedAt).toLocaleString('ru-RU')}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-600 mb-2 text-sm sm:text-base">Статус анализа</h3>
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
          </div>

          {comprehensiveAnalysis ? (
            <div className="space-y-6 sm:space-y-8">
              <ComprehensiveAnalysisView analysis={comprehensiveAnalysis} />

              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">Исходные файлы</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <h3 className="font-medium text-slate-600 mb-3 text-sm sm:text-base">Видео</h3>
                    <video 
                      controls 
                      className="w-full rounded-lg"
                      src={filePair.videoPath}
                      playsInline
                    >
                      Ваш браузер не поддерживает воспроизведение видео.
                    </video>
                  </div>
                  <div>
                    <div className="relative">
                      <Image 
                        src={filePair.graphPath} 
                        alt="График досмотров"
                        width={500}
                        height={300}
                        className="w-full rounded-lg border border-slate-200"
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">Генерация комплексного анализа</h2>
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
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4">Ожидание комплексного анализа</h2>
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