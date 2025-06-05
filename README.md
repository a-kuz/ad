# 🎥 Платформа анализа досмотров видео

Современная платформа для глубокого анализа поведения зрителей с использованием искусственного интеллекта. Автоматически анализирует видео и графики досмотров, предоставляя детальные инсайты и рекомендации.

## ✨ Возможности

- **🤖 ИИ Анализ**: Автоматический анализ с помощью OpenAI GPT-4
- **📊 Извлечение данных**: Умное извлечение данных из графиков досмотров
- **🎬 Обработка видео**: Анализ метаданных видео с помощью FFmpeg
- **📈 Детальные отчеты**: Подробные инсайты и рекомендации
- **🖥️ Современный UI**: Красивый и интуитивный интерфейс
- **⚡ Автоматический анализ**: Анализ запускается сразу после загрузки файлов

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+ 
- FFmpeg установленный в системе
- OpenAI API ключ

### Установка FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Скачайте с [официального сайта](https://ffmpeg.org/download.html)

### Настройка проекта

1. **Клонирование и установка зависимостей:**
```bash
git clone <repository-url>
cd ad
npm install
```

2. **Настройка переменных окружения:**

Переименуйте `env.local` в `.env.local` и заполните:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# File Upload Configuration
MAX_FILE_SIZE=100MB
ALLOWED_VIDEO_FORMATS=mp4,avi,mov,mkv,webm
ALLOWED_IMAGE_FORMATS=png,jpg,jpeg,gif,webp

# FFmpeg Configuration (опционально)
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

3. **Запуск приложения:**
```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 📋 Как использовать

### 1. Создание сессии
- Откройте главную страницу
- Нажмите "Создать сессию"
- Получите уникальный ID сессии

### 2. Загрузка файлов
- Перейдите на страницу загрузки
- Выберите видео файл (MP4, AVI, MOV, MKV, WebM)
- Выберите график досмотров (PNG, JPG, JPEG, GIF, WebP)
- Загрузите пару файлов

### 3. Автоматический анализ
- Анализ запускается автоматически после загрузки
- Система извлекает данные из графика
- ИИ анализирует поведение зрителей
- Генерируются инсайты и рекомендации

### 4. Просмотр результатов
- Отслеживайте статус анализа в реальном времени
- Просматривайте общую оценку и инсайты
- Изучайте критические моменты и рекомендации

## 🏗️ Архитектура

### Технологический стек
- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: React Icons (Feather)
- **AI**: OpenAI GPT-4.1-mini
- **Video Processing**: FFmpeg, fluent-ffmpeg
- **File Storage**: Локальная файловая система

### Структура проекта
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   ├── analyze/       # Анализ видео
│   │   ├── upload/        # Загрузка файлов
│   │   └── session/       # Управление сессиями
│   ├── upload/[sessionId] # Страница загрузки
│   └── analysis/          # Страница результатов
├── components/            # React компоненты
├── lib/                   # Утилиты и логика
│   ├── openai.ts         # OpenAI интеграция
│   ├── videoProcessor.ts # FFmpeg обработка
│   └── graphParser.ts    # Анализ графиков
└── types/                # TypeScript типы
```

### API Endpoints

- `POST /api/generate-session` - Создание новой сессии
- `GET /api/session/[sessionId]` - Получение данных сессии
- `POST /api/upload` - Загрузка файлов и автозапуск анализа
- `POST /api/analyze` - Ручной запуск анализа
- `GET /api/analysis-status/[sessionId]` - Статус анализа
- `GET /api/video-info/[sessionId]/[filePairId]` - Метаданные видео

## 🔧 Конфигурация

### Настройка OpenAI
```typescript
// src/lib/openai.ts
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Настройка FFmpeg
```typescript
// src/lib/videoProcessor.ts
import ffmpeg from 'fluent-ffmpeg';

// Автоматическое определение путей
// Или явное указание в .env.local
```

### Поддерживаемые форматы
- **Видео**: MP4, AVI, MOV, MKV, WebM
- **Изображения**: PNG, JPG, JPEG, GIF, WebP
- **Максимальный размер**: 100MB (настраивается)

## 📊 Функции анализа

### Извлечение данных из графиков
- Автоматическое распознавание графиков досмотров
- Конвертация retention в dropout проценты
- Извлечение временных меток и значений

### Анализ видео метаданных
- Продолжительность, разрешение, FPS
- Информация о кодеках и потоках
- Автоматическое создание превью

### ИИ инсайты
- Анализ поведения зрителей
- Выявление критических моментов
- Персонализированные рекомендации
- Общая оценка эффективности

## 🛠️ Разработка

### Запуск в режиме разработки
```bash
npm run dev
```

### Сборка для продакшена
```bash
npm run build
npm start
```

### Линтинг
```bash
npm run lint
```

## 📂 Хранение данных

### Структура данных
```
data/
└── sessions.json          # Данные сессий

public/uploads/
├── videos/                # Загруженные видео
├── graphs/                # Графики досмотров
├── thumbnails/            # Превью видео
└── converted/             # Конвертированные файлы
```

### Формат сессии
```typescript
interface UserSession {
  sessionId: string;
  createdAt: string;
  filePairs: UploadedFilePair[];
}

interface UploadedFilePair {
  id: string;
  videoPath: string;
  graphPath: string;
  videoName: string;
  graphName: string;
  uploadedAt: string;
  analysis?: VideoAnalysis;
  videoMetadata?: VideoMetadata;
}
```

## 🔒 Безопасность

- Валидация типов и размеров файлов
- Генерация уникальных имен файлов
- Изоляция пользовательских данных по сессиям
- Защита API endpoints

## 🐛 Отладка

### Логи анализа
Логи автоматического анализа выводятся в консоль сервера:
```bash
npm run dev
# Смотрите логи в терминале
```

### Проверка FFmpeg
```bash
ffmpeg -version
ffprobe -version
```

### Тестирование OpenAI API
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.openai.com/v1/models
```

## 🤝 Вклад в разработку

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. Подробности в файле `LICENSE`.

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в консоли разработчика
2. Убедитесь в корректности .env.local
3. Проверьте доступность FFmpeg
4. Создайте issue в репозитории

---

**Создано для анализа эффективности видео контента** 🎬✨
