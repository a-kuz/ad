"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { UserSession } from '@/types';
import { 
  FiDatabase, 
  FiCalendar, 
  FiUsers, 
  FiFileText, 
  FiEye, 
  FiRefreshCw,
  FiActivity,
  FiLink,
  FiTrash2,
  FiPlus,
  FiFolder
} from 'react-icons/fi';
import { isValidAdminToken } from '@/lib/admin';

interface AdminStats {
  totalSessions: number;
  totalFilePairs: number;
  sessionsWithUploads: number;
}

interface AdminData {
  sessions: UserSession[];
  stats: AdminStats;
}

export default function AdminTokenPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<string[]>([]);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!token) {
        setIsValidToken(false);
        setLoading(false);
        return;
    }
    const valid = isValidAdminToken(token);
    setIsValidToken(valid);

    if (valid) {
        fetchData();
    } else {
        setLoading(false);
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/sessions');
      
      if (response.ok) {
        const adminData = await response.json();
        setData(adminData);
        setError(null);
      } else {
        setError('Ошибка загрузки данных');
      }
    } catch {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const toggleSessionExpansion = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const copySessionLink = (sessionId: string) => {
    const link = `${window.location.origin}/upload/${sessionId}`;
    navigator.clipboard.writeText(link);
  };

  const deleteSessionHandler = async (sessionId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту сессию? Это также удалит все связанные файлы (видео, графики, скриншоты).')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData(); // Refresh data
      } else {
        alert('Ошибка при удалении сессии');
      }
    } catch {
      alert('Ошибка при удалении сессии');
    }
  };

  const deleteFilePairHandler = async (sessionId: string, filePairId: string, fileName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить файловую пару "${fileName}"? Это также удалит все связанные файлы (видео, графики, скриншоты).`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/${filePairId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData(); // Refresh data
      } else {
        alert('Ошибка при удалении файловой пары');
      }
    } catch {
      alert('Ошибка при удалении файловой пары');
    }
  };

  const cleanupFilesHandler = async () => {
    if (!confirm('Вы уверены, что хотите очистить все неиспользуемые файлы? Это действие необратимо.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/cleanup-files', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        
        let message = 'Очистка завершена:\n';
        message += `Удалено файлов: ${result.deletedFiles?.length || 0}\n`;
        message += `Удалено папок: ${result.deletedDirectories?.length || 0}\n`;
        if (result.errors?.length > 0) {
          message += `Ошибок: ${result.errors.length}`;
        }
        
        alert(message);
        fetchData(); // Refresh data
      } else {
        alert('Ошибка при очистке файлов');
      }
    } catch {
      alert('Ошибка при очистке файлов');
    }
  };

  const generateNewLink = async () => {
    setGeneratingLink(true);
    try {
      const response = await fetch('/api/generate-session', {
        method: 'POST',
      });
      
      if (response.ok) {
        const { sessionId } = await response.json();
        const newLink = `${window.location.origin}/upload/${sessionId}`;
        setGeneratedLinks(prev => [...prev, newLink]);
      } else {
        alert('Ошибка при создании ссылки');
      }
    } catch (error) {
      console.error('Failed to generate link:', error);
      alert('Ошибка при создании ссылки');
    } finally {
      setGeneratingLink(false);
    }
  };

  if (loading || isValidToken === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Проверка токена и загрузка данных...</p>
      </main>
    );
  }

  if (!isValidToken) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Неверный токен администратора</h1>
          <p className="text-gray-600">Пожалуйста, проверьте ссылку.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Ошибка</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Попробовать снова
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">Админская панель</h1>
              <Link
                href="/"
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                ← На главную
              </Link>
            </div>
            <div className="flex items-center space-x-2">
               <a
                href={`/admin/${token}/all-files`}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiFolder className="mr-2"/> Все файлы
              </a>
              <button
                onClick={cleanupFilesHandler}
                className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
              >
                <FiTrash2 className="mr-2" />
                Очистить файлы
              </button>
              <button
                onClick={fetchData}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiRefreshCw className="mr-2" />
                Обновить
              </button>
            </div>
          </div>
          <p className="text-gray-600 mt-2">Управление сессиями и просмотр статистики</p>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FiUsers className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Всего сессий</p>
                    <p className="text-2xl font-bold text-gray-900">{data.stats.totalSessions}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FiFileText className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Загружено пар файлов</p>
                    <p className="text-2xl font-bold text-gray-900">{data.stats.totalFilePairs}</p>
                  </div>
                </div>
              </div>

                             <div className="bg-white rounded-lg shadow p-6">
                 <div className="flex items-center">
                   <div className="flex-shrink-0">
                     <FiActivity className="h-8 w-8 text-purple-600" />
                   </div>
                   <div className="ml-4">
                     <p className="text-sm font-medium text-gray-500">Активных сессий</p>
                     <p className="text-2xl font-bold text-gray-900">{data.stats.sessionsWithUploads}</p>
                   </div>
                 </div>
               </div>
            </div>

            <div className="mb-8">
              <button
                onClick={generateNewLink}
                disabled={generatingLink}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <FiPlus className="mr-2" />
                {generatingLink ? 'Генерация...' : 'Создать новую ссылку для загрузки'}
              </button>
              
              {generatedLinks.length > 0 && (
                <div className="mt-4 bg-gray-100 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">Созданные ссылки:</h3>
                  <div className="space-y-2">
                    {generatedLinks.map((link, index) => (
                      <div key={index} className="flex items-center justify-between bg-white rounded-md p-3 shadow-sm">
                         <div className="flex items-center flex-1">
                            <FiLink className="mr-3 text-gray-500" />
                            <span className="text-sm font-mono text-gray-700 truncate">{link}</span>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => navigator.clipboard.writeText(link)}
                              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Копировать
                            </button>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Открыть
                            </a>
                          </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Все сессии</h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {data.sessions.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    Сессии не найдены
                  </div>
                ) : (
                  data.sessions.map((session) => (
                    <div key={session.sessionId} className="px-6 py-4">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="flex items-center space-x-2">
                              <FiDatabase className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-mono text-gray-900">
                                {session.sessionId}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                              <div className="flex items-center">
                                <FiCalendar className="h-4 w-4 mr-1" />
                                {new Date(session.createdAt).toLocaleString('ru-RU')}
                              </div>
                              <div className="flex items-center">
                                <FiFileText className="h-4 w-4 mr-1" />
                                {session.filePairs.length} файлов
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => deleteSessionHandler(session.sessionId)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            <FiTrash2 className="h-3 w-3 mr-1" />
                            Удалить
                          </button>
                          
                          <button
                            onClick={() => copySessionLink(session.sessionId)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <FiLink className="h-3 w-3 mr-1" />
                            Ссылка
                          </button>
                          
                          <a
                            href={`/upload/${session.sessionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                          >
                            <FiEye className="h-3 w-3 mr-1" />
                            Открыть
                          </a>
                          
                          {session.filePairs.length > 0 && (
                            <button
                              onClick={() => toggleSessionExpansion(session.sessionId)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                            >
                              {expandedSessions.has(session.sessionId) ? 'Скрыть' : 'Показать'} файлы
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {expandedSessions.has(session.sessionId) && session.filePairs.length > 0 && (
                        <div className="mt-4 pl-8">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Загруженные файлы:</h4>
                            <div className="space-y-3">
                              {session.filePairs.map((pair, index) => (
                                <div key={pair.id} className="bg-white rounded border p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-900">
                                      Пара #{index + 1}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">
                                        {new Date(pair.uploadedAt).toLocaleString('ru-RU')}
                                      </span>
                                      <button
                                        onClick={() => deleteFilePairHandler(session.sessionId, pair.id, pair.videoName || pair.graphName || `Пара #${index + 1}`)}
                                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                        title="Удалить файловую пару"
                                      >
                                        <FiTrash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                    <div>
                                      <span className="font-medium">Видео:</span> {pair.videoName}
                                    </div>
                                    <div>
                                      <span className="font-medium">График:</span> {pair.graphName}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
} 