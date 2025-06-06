"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import AdUploadForm from '@/components/AdUploadForm';
import { UserSession, UploadedFilePair } from '@/types';
import { FiArrowLeft, FiAlertCircle, FiBarChart, FiCalendar, FiDatabase, FiCheckCircle, FiClock, FiEye } from 'react-icons/fi';
import Link from 'next/link';
import MiniDropoutChart from '@/components/MiniDropoutChart';
import { getDropoutDataFromAnalysis } from '@/lib/analysisUtils';
import AnalysisLogs from '@/components/AnalysisLogs';

export default function UploadPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}`);
        
        if (response.ok) {
          const sessionData = await response.json();
          setSession(sessionData);
          setError(null);
        } else {
          setError('Сессия не найдена');
        }
      } catch {
        setError('Ошибка загрузки сессии');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchSession();
    }
  }, [sessionId]);

  // Автообновление сессии для отслеживания статуса анализа
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}`);
        if (response.ok) {
          const sessionData = await response.json();
          setSession(sessionData);
        }
      } catch (err) {
        console.error('Failed to refresh session:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session, sessionId]);

  const refreshSession = async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
  };

  const getAnalysisStatus = (pair: UploadedFilePair) => {
    if (pair.analysis) {
      return {
        status: 'completed',
        text: 'Завершен',
        icon: <FiCheckCircle className="w-4 h-4 text-emerald-600" />,
        score: pair.analysis.overallScore
      };
    } else {
      return {
        status: 'processing',
        text: 'Обработка...',
        icon: <FiClock className="w-4 h-4 text-amber-600 animate-pulse" />,
        score: null
      };
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-3 text-gray-600 text-sm">Загрузка...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 shadow-sm text-center max-w-md mx-auto border">
          <FiAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Ошибка</h1>
          <p className="text-gray-600 mb-4 text-sm">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            Вернуться на главную
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Анализ видео
          </h1>
          <p className="text-gray-600 text-sm mb-4">
            Загрузите видео и график досмотров для автоматического анализа
          </p>
          
          {session && (
            <div className="bg-white rounded-lg p-3 shadow-sm border">
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <FiDatabase className="w-3.5 h-3.5 text-blue-600" />
                  <span>ID:</span>
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{session.sessionId}</code>
                </div>
                <div className="flex items-center gap-1.5">
                  <FiCalendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>{new Date(session.createdAt).toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border">
          <AdUploadForm sessionId={sessionId} onUploadComplete={refreshSession} />
        </div>

        {/* Uploaded Files */}
        {session && session.filePairs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <FiBarChart className="w-4 h-4 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Загруженные файлы</h2>
            </div>
            
            <div className="space-y-3">
              {session.filePairs.slice().reverse().map((pair, index) => {
                const analysisStatus = getAnalysisStatus(pair);
                
                return (
                  <div key={`${pair.id}-${index}`} className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-base leading-tight">
                            {pair.generatedTitle || `Пара файлов #${index + 1}`}
                          </h3>
                          <p className="text-sm text-gray-600 truncate mt-0.5">
                            {pair.videoName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-4">
                          {analysisStatus.icon}
                          <span className={`text-xs font-medium ${
                            analysisStatus.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'
                          }`}>
                            {analysisStatus.text}
                          </span>
                        </div>
                      </div>

                      {/* Previews */}
                      <div className="flex gap-3 mb-3">
                        <div className="flex-shrink-0">
                          <Image 
                            src={pair.graphPath} 
                            alt="График"
                            width={120}
                            height={80}
                            className="w-[120px] h-[80px] rounded border object-contain bg-gray-50"
                          />
                        </div>
                        {analysisStatus.status === 'completed' && (() => {
                          const dropoutData = getDropoutDataFromAnalysis(pair);
                          return dropoutData ? (
                            <div className="flex-shrink-0">
                              <MiniDropoutChart dropoutData={dropoutData} width={120} height={80} />
                            </div>
                          ) : null;
                        })()}
                      </div>

                      {/* Analysis Logs */}
                      {analysisStatus.status === 'processing' && (
                        <div className="mt-3">
                          <AnalysisLogs 
                            filePairId={pair.id} 
                            isAnalyzing={analysisStatus.status === 'processing'} 
                          />
                        </div>
                      )}

                      {/* Analysis Results */}
                      {analysisStatus.status === 'completed' && pair.analysis && (
                        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-md p-3 border border-emerald-100">
                          <Link
                            href={`/analysis/${sessionId}/${pair.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors text-xs"
                          >
                            <FiEye className="w-3.5 h-3.5" />
                            Подробный анализ
                          </Link>
                        </div>
                      )}
                    </div>
                    
                    {/* Date in bottom right */}
                    <div className="px-4 pb-3">
                      <div className="text-right">
                        <span className="text-xs text-gray-400">
                          {new Date(pair.uploadedAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 