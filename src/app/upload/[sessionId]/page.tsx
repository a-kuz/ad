"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AdUploadForm from '@/components/AdUploadForm';
import { UserSession } from '@/types';
import { FiDatabase, FiCalendar } from 'react-icons/fi';

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
        } else if (response.status === 404) {
          setError('Сессия не найдена. Проверьте правильность ссылки.');
        } else {
          setError('Ошибка загрузки сессии.');
        }
      } catch (err) {
        setError('Ошибка подключения к серверу.');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchSession();
    }
  }, [sessionId]);

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

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Загрузка сессии...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Ошибка</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Вернуться на главную
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8">
      <div className="z-10 max-w-5xl w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">
            Загрузка рекламных данных
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-4">
            Загрузите видео рекламы вместе с графиками отвала зрителей от Valve. 
            Вы можете загрузить несколько пар файлов одновременно.
          </p>
          
          {session && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-4 text-sm text-blue-700">
                <div className="flex items-center">
                  <FiDatabase className="mr-2" />
                  <span>ID сессии: {session.sessionId}</span>
                </div>
                <div className="flex items-center">
                  <FiCalendar className="mr-2" />
                  <span>Создана: {new Date(session.createdAt).toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <AdUploadForm sessionId={sessionId} onUploadComplete={refreshSession} />

        {session && session.filePairs.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Загруженные файлы</h2>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="grid gap-4">
                {session.filePairs.map((pair, index) => (
                  <div key={pair.id} className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="font-medium mb-2">Пара #{index + 1}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Видео:</span> {pair.videoName}
                      </div>
                      <div>
                        <span className="font-medium">График:</span> {pair.graphName}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Загружено: {new Date(pair.uploadedAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Ad Performance Data Collection. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
} 