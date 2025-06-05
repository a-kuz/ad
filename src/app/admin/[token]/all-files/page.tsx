"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { UploadedFilePair } from '@/types';
import { isValidAdminToken } from '@/lib/admin';
import { FiFileText, FiVideo, FiImage, FiDownload, FiCalendar, FiDatabase, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';

interface AllFile extends UploadedFilePair {
  sessionId: string;
}

export default function AllFilesPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [files, setFiles] = useState<AllFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/all-files');
      
      if (response.ok) {
        const filesData = await response.json();
        setFiles(filesData);
        setError(null);
      } else {
        setError('Ошибка загрузки данных файлов');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading || isValidToken === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Проверка токена и загрузка файлов...</p>
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
           <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">Все загруженные файлы</h1>
              <a
                href={`/admin/${token}`}
                className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <FiArrowLeft className="mr-2"/> К статистике
              </a>
            </div>
          <p className="text-gray-600 mt-2">Список всех загруженных видео и графиков</p>
        </div>

        {files.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            Нет загруженных файлов.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                 <h2 className="text-lg font-medium text-gray-900">Список файлов</h2>
                 <button
                    onClick={fetchData}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <FiRefreshCw className="mr-2" />
                    Обновить список
                  </button>
              </div>
            </div>
            
            <ul role="list" className="divide-y divide-gray-200">
              {files.map((file) => (
                <li key={file.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center text-sm font-medium text-gray-900">
                         {file.videoName ? (
                            <FiVideo className="mr-2 h-5 w-5 text-blue-500" />
                         ) : file.graphName ? (
                            <FiImage className="mr-2 h-5 w-5 text-green-500" />
                         ) : (
                            <FiFileText className="mr-2 h-5 w-5 text-gray-500" />
                         )}
                        <span className="truncate">{file.videoName || file.graphName}</span>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                         <FiDatabase className="mr-1 h-4 w-4"/>
                         <span className="truncate mr-4">Сессия: {file.sessionId}</span>
                         <FiCalendar className="mr-1 h-4 w-4"/>
                         <span>{new Date(file.uploadedAt).toLocaleString('ru-RU')}</span>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                       {file.videoName && (
                           <a
                                href={`/uploads/videos/${file.videoPath.split('/').pop()}`}
                                download
                                className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 mr-2"
                            >
                                <FiDownload className="mr-1" /> Видео
                            </a>
                       )}
                        {file.graphName && (
                           <a
                                href={`/uploads/graphs/${file.graphPath.split('/').pop()}`}
                                download
                                className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                            >
                                <FiDownload className="mr-1" /> График
                            </a>
                       )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
} 