'use client';

import React, { useState } from 'react';
import { generateTestAnalysis } from '@/lib/testAnalysis';
import { validateAndFixAnalysis } from '@/lib/mathValidation';
import { ComprehensiveVideoAnalysis } from '@/types';

export default function TestMathPage() {
  const [analysis, setAnalysis] = useState<ComprehensiveVideoAnalysis | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runTest = () => {
    setIsLoading(true);
    
    // Генерируем тестовые данные
    const testAnalysis = generateTestAnalysis(30);
    setAnalysis(testAnalysis);
    
    // Валидируем математику
    const validation = validateAndFixAnalysis(
      testAnalysis.dropoutCurve as any,
      testAnalysis.blockDropoutAnalysis || []
    );
    setValidationResult(validation);
    
    setIsLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            🔬 Тестирование математических расчетов
          </h1>
          <p className="text-gray-700 mb-4">
            Эта страница проверяет корректность математических формул в анализе данных досмотра.
          </p>
          
          <button
            onClick={runTest}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {isLoading ? 'Выполняется тест...' : 'Запустить тест математики'}
          </button>
        </div>

        {validationResult && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">
              📊 Результаты валидации
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className={`p-4 rounded-lg ${validationResult.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${validationResult.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {validationResult.isValid ? '✅' : '❌'}
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-2">
                    {validationResult.isValid ? 'Математика корректна' : 'Найдены ошибки'}
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border-blue-200 border p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {validationResult.errors.length}
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-2">
                    Ошибок найдено
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 border-purple-200 border p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {validationResult.fixedDropoutCurve?.points?.length || 0}
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-2">
                    Точек данных
                  </div>
                </div>
              </div>
            </div>

            {validationResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">Обнаруженные проблемы:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.errors.map((error: string, index: number) => (
                    <li key={index} className="text-red-700 text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {analysis && (
          <>
            {/* Кривая досмотра */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                📈 Кривая досмотра (первые 10 точек)
              </h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="border-b bg-gray-100">
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Время</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Удержание (%)</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Отвал (%)</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Проверка математики</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.dropoutCurve && 'points' in analysis.dropoutCurve ? 
                      analysis.dropoutCurve.points.slice(0, 10).map((point: any, index: number) => {
                      const expectedDropout = 100 - point.retentionPercentage;
                      const mathCheck = Math.abs(point.dropoutPercentage - expectedDropout) < 0.1;
                      
                      return (
                        <tr key={index} className={`border-b ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                          <td className="px-4 py-3 text-gray-800 font-medium">{formatTime(point.timestamp)}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{point.retentionPercentage.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{point.dropoutPercentage.toFixed(2)}%</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              mathCheck ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {mathCheck ? '✅ Корректно' : '❌ Ошибка'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Анализ отвалов блоков */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                🎯 Анализ отвалов блоков
              </h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="border-b bg-gray-100">
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Блок</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Время</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Начальное удержание</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Конечное удержание</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Абсолютный отвал</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Относительный отвал</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-800">Проверка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.blockDropoutAnalysis?.slice(0, 6).map((block, index) => {
                      const expectedAbsolute = block.startRetention - block.endRetention;
                      const expectedRelative = block.startRetention > 0 ? (expectedAbsolute / block.startRetention) * 100 : 0;
                      
                      const absoluteCheck = Math.abs(block.absoluteDropout - expectedAbsolute) < 0.1;
                      const relativeCheck = Math.abs(block.relativeDropout - expectedRelative) < 0.1;
                      const allCorrect = absoluteCheck && relativeCheck;
                      
                      return (
                        <tr key={block.blockId} className={`border-b ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                          <td className="px-4 py-3 text-gray-800 font-medium">{block.blockName}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatTime(block.startTime)} - {formatTime(block.endTime)}
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{block.startRetention}%</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{block.endRetention}%</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{block.absoluteDropout}%</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{block.relativeDropout}%</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              allCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {allCorrect ? '✅ Корректно' : '❌ Ошибки'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">💡 Объяснение расчетов:</h3>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li><strong>Абсолютный отвал</strong> = Начальное удержание - Конечное удержание</li>
                  <li><strong>Относительный отвал</strong> = (Абсолютный отвал / Начальное удержание) × 100%</li>
                  <li><strong>Процент отвала</strong> = 100% - Процент удержания</li>
                </ul>
              </div>
            </div>

            {/* Итоговая таблица анализа блоков */}
            {analysis.visualBlocksAnalysisTable && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">
                  📊 Итоговая таблица анализа блоков
                </h2>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {analysis.visualBlocksAnalysisTable}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 