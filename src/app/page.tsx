"use client";

import { useState } from 'react';
import { FiUpload, FiBarChart, FiPlay, FiArrowRight, FiCheck } from 'react-icons/fi';
import Link from 'next/link';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const createSession = async () => {
    setIsCreatingSession(true);
    try {
      const response = await fetch('/api/generate-session', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('Ошибка при создании сессии:', error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  const features = [
    {
      icon: <FiUpload className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "Загрузка файлов",
      description: "Загрузите видео и график досмотров для анализа"
    },
    {
      icon: <FiBarChart className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "ИИ Анализ",
      description: "Автоматический анализ с помощью OpenAI GPT-4"
    },
    {
      icon: <FiPlay className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "Инсайты",
      description: "Получите рекомендации и критические моменты"
    }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-800 mb-4 sm:mb-6 leading-tight">
            Анализ досмотров видео
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto px-4">
            Платформа для глубокого анализа поведения зрителей с использованием искусственного интеллекта
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12 lg:mb-16">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-xl p-6 sm:p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-blue-600 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-3">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 lg:p-12 shadow-xl text-center">
          {!sessionId ? (
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6">
                Начните анализ прямо сейчас
              </h2>
              <p className="text-slate-600 mb-6 sm:mb-8 max-w-md mx-auto px-4">
                Создайте новую сессию для загрузки и анализа ваших видео
              </p>
              <button
                onClick={createSession}
                disabled={isCreatingSession}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg transition-colors inline-flex items-center gap-3 disabled:opacity-50 min-h-[48px] touch-manipulation"
              >
                {isCreatingSession ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Создание сессии...
                  </>
                ) : (
                  <>
                    Создать сессию
                    <FiArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-3 text-green-600 mb-4 sm:mb-6">
                <FiCheck className="w-6 h-6 sm:w-8 sm:h-8" />
                <span className="text-xl sm:text-2xl font-semibold">Сессия создана!</span>
              </div>
              <p className="text-slate-600 mb-4 sm:mb-6 px-4">
                ID сессии: <code className="bg-slate-100 px-2 py-1 rounded text-xs sm:text-sm break-all">{sessionId}</code>
              </p>
              <Link
                href={`/upload/${sessionId}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg transition-colors inline-flex items-center gap-3 min-h-[48px] touch-manipulation"
              >
                Перейти к загрузке
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="mt-12 sm:mt-16 lg:mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-800 mb-8 sm:mb-12">
            Как это работает
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { step: 1, title: "Создайте сессию", desc: "Получите уникальный ID для вашего анализа" },
              { step: 2, title: "Загрузите файлы", desc: "Видео и график досмотров" },
              { step: 3, title: "Автоматический анализ", desc: "ИИ обрабатывает данные" },
              { step: 4, title: "Получите результат", desc: "Инсайты и рекомендации" }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg sm:text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">{item.title}</h3>
                <p className="text-slate-600 text-xs sm:text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
