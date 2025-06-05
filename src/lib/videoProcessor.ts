import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  format: string;
  size: number;
  title?: string;
}

export interface VideoStreamInfo {
  index: number;
  codec_name: string;
  codec_type: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
  bit_rate?: string;
}

export async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(process.cwd(), 'public', videoPath);
    
    if (!fs.existsSync(fullPath)) {
      reject(new Error(`Видео файл не найден: ${fullPath}`));
      return;
    }

    ffmpeg.ffprobe(fullPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Ошибка при анализе видео: ${err.message}`));
        return;
      }

      try {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('Видео поток не найден'));
          return;
        }

        const duration = parseFloat(String(metadata.format.duration || '0'));
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const fps = eval(videoStream.r_frame_rate || '0') || 0;
        const bitrate = parseInt(String(metadata.format.bit_rate || '0'));
        const format = metadata.format.format_name || 'unknown';
        const size = parseInt(String(metadata.format.size || '0'));

        const result: VideoMetadata = {
          duration,
          width,
          height,
          fps,
          bitrate,
          format,
          size,
          title: String(metadata.format.tags?.title || path.basename(videoPath, path.extname(videoPath)))
        };

        resolve(result);
      } catch (error) {
        reject(new Error(`Ошибка при парсинге метаданных: ${error}`));
      }
    });
  });
}

export async function extractVideoThumbnail(
  videoPath: string, 
  timestamp: number = 5
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullVideoPath = path.join(process.cwd(), 'public', videoPath);
    const thumbnailDir = path.join(process.cwd(), 'public', 'uploads', 'thumbnails');
    
    // Создаем директорию для превью если её нет
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    const thumbnailName = `${Date.now()}-thumb.jpg`;
    const thumbnailPath = path.join(thumbnailDir, thumbnailName);

    ffmpeg(fullVideoPath)
      .seekInput(timestamp)
      .frames(1)
      .output(thumbnailPath)
      .on('end', () => {
        resolve(`/uploads/thumbnails/${thumbnailName}`);
      })
      .on('error', (err) => {
        reject(new Error(`Ошибка при создании превью: ${err.message}`));
      })
      .run();
  });
}

export async function getVideoStreams(videoPath: string): Promise<VideoStreamInfo[]> {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(process.cwd(), 'public', videoPath);
    
    ffmpeg.ffprobe(fullPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Ошибка при анализе потоков: ${err.message}`));
        return;
      }

      const streams: VideoStreamInfo[] = metadata.streams.map(stream => ({
        index: stream.index,
        codec_name: stream.codec_name || 'unknown',
        codec_type: stream.codec_type || 'unknown',
        width: stream.width,
        height: stream.height,
        r_frame_rate: stream.r_frame_rate,
        duration: stream.duration,
        bit_rate: stream.bit_rate
      }));

      resolve(streams);
    });
  });
}

export async function convertVideoFormat(
  inputPath: string,
  outputFormat: string = 'mp4'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullInputPath = path.join(process.cwd(), 'public', inputPath);
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'converted');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputName = `${Date.now()}-converted.${outputFormat}`;
    const outputPath = path.join(outputDir, outputName);

    ffmpeg(fullInputPath)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format(outputFormat)
      .on('progress', (progress) => {
        console.log(`Конвертация: ${progress.percent}% завершено`);
      })
      .on('end', () => {
        resolve(`/uploads/converted/${outputName}`);
      })
      .on('error', (err) => {
        reject(new Error(`Ошибка при конвертации: ${err.message}`));
      })
      .run();
  });
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
} 