'use client';

import { useState } from 'react';

export default function TestImagePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAnalysis(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/test-image-analysis', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setAnalysis(result);
      } else {
        setError(result.error || 'Ошибка анализа');
      }
    } catch (err) {
      setError('Ошибка при отправке запроса');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Тестирование анализа графиков</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6 border">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Загрузить график</h2>
          
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="mb-4 block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {selectedFile && (
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2 font-medium">Выбранный файл: {selectedFile.name}</p>
              <img 
                src={URL.createObjectURL(selectedFile)} 
                alt="Preview" 
                className="max-w-full h-auto max-h-96 border rounded shadow-sm"
              />
            </div>
          )}
          
          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700 font-medium"
          >
            {loading ? 'Анализируем...' : 'Анализировать график'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold text-lg">Ошибка</h3>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {analysis && (
          <div className="bg-white rounded-lg shadow p-6 border">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Результаты анализа</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border">
                <div className="text-2xl font-bold text-blue-700">{analysis.summary.totalPoints}</div>
                <div className="text-sm text-gray-700 font-medium">Точек данных</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border">
                <div className="text-2xl font-bold text-green-700">{analysis.summary.duration}с</div>
                <div className="text-sm text-gray-700 font-medium">Продолжительность</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border">
                <div className="text-2xl font-bold text-purple-700">{analysis.summary.startRetention?.toFixed(1)}%</div>
                <div className="text-sm text-gray-700 font-medium">Начальное удержание</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border">
                <div className="text-2xl font-bold text-red-700">{analysis.summary.endRetention?.toFixed(1)}%</div>
                <div className="text-sm text-gray-700 font-medium">Конечное удержание</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">График кривой досмотра</h3>
              <div className="overflow-x-auto">
                <div className="min-w-full bg-gray-50 p-4 rounded border">
                  <div className="grid grid-cols-12 gap-1 text-xs">
                    {analysis.analysis.points.slice(0, 24).map((point: any, index: number) => (
                      <div key={index} className="text-center">
                        <div className="bg-blue-600 rounded-t" style={{height: `${point.retentionPercentage}px`}}></div>
                        <div className="text-gray-700 mt-1 font-medium">{point.timestamp}s</div>
                        <div className="font-bold text-gray-800">{point.retentionPercentage.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <details className="bg-gray-50 p-4 rounded-lg border">
              <summary className="cursor-pointer font-semibold text-gray-800 hover:text-gray-900">Все данные (JSON)</summary>
              <pre className="mt-4 text-xs overflow-x-auto bg-white p-4 rounded border text-gray-800 font-mono">
                {JSON.stringify(analysis.analysis, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
} 