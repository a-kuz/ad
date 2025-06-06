import { createAnalysisLog, updateAnalysisLog } from './database';

interface LogDetails {
  progress?: number;
  audioBlocks?: Array<{
    id: string;
    name: string;
    startTime: number;
    endTime: number;
    content: string;
    purpose: string;
  }>;
  screenshots?: number;
  textBlocks?: number;
  visualBlocks?: number;
  currentBlock?: string;
}

export class AnalysisLogger {
  private filePairId: string;
  private currentLogId: string | null = null;

  constructor(filePairId: string) {
    this.filePairId = filePairId;
  }

  async startStep(step: string, message: string, details?: LogDetails): Promise<void> {
    console.log(`[${step}] ${message}`);
    this.currentLogId = await createAnalysisLog(this.filePairId, step, message, details);
  }

  async updateStep(message: string, details?: LogDetails): Promise<void> {
    if (this.currentLogId) {
      console.log(`[UPDATE] ${message}`);
      await updateAnalysisLog(this.currentLogId, message, 'running', details);
    }
  }

  async updateProgress(progress: number, message?: string): Promise<void> {
    if (this.currentLogId) {
      const updateMessage = message || `Прогресс: ${Math.round(progress)}%`;
      console.log(`[PROGRESS] ${updateMessage}`);
      await updateAnalysisLog(this.currentLogId, updateMessage, 'running', { progress });
    }
  }

  async addAudioBlocks(audioBlocks: LogDetails['audioBlocks'], message?: string): Promise<void> {
    if (this.currentLogId && audioBlocks) {
      const updateMessage = message || `Создано аудио блоков: ${audioBlocks.length}`;
      console.log(`[AUDIO_BLOCKS] ${updateMessage}`);
      await updateAnalysisLog(this.currentLogId, updateMessage, 'running', { audioBlocks });
    }
  }

  async updateCurrentBlock(blockName: string): Promise<void> {
    if (this.currentLogId) {
      console.log(`[CURRENT_BLOCK] Обрабатывается: ${blockName}`);
      await updateAnalysisLog(this.currentLogId, `Обрабатывается блок: ${blockName}`, 'running', { 
        currentBlock: blockName 
      });
    }
  }

  async completeStep(message: string, details?: LogDetails): Promise<void> {
    if (this.currentLogId) {
      console.log(`[COMPLETED] ${message}`);
      await updateAnalysisLog(this.currentLogId, message, 'completed', details);
      this.currentLogId = null;
    }
  }

  async errorStep(message: string): Promise<void> {
    if (this.currentLogId) {
      console.error(`[ERROR] ${message}`);
      await updateAnalysisLog(this.currentLogId, message, 'error');
      this.currentLogId = null;
    }
  }

  async logStandalone(step: string, message: string, status: 'running' | 'completed' | 'error' = 'completed', details?: LogDetails): Promise<void> {
    console.log(`[${step}] ${message}`);
    const logId = await createAnalysisLog(this.filePairId, step, message, details);
    if (status !== 'running') {
      await updateAnalysisLog(logId, message, status, details);
    }
  }

  // Удобные методы для часто используемых случаев
  async logAudioExtraction(progress: number): Promise<void> {
    await this.updateProgress(progress, `Извлечение аудио: ${Math.round(progress)}%`);
  }

  async logTranscriptionProgress(progress: number): Promise<void> {
    await this.updateProgress(progress, `Транскрипция: ${Math.round(progress)}%`);
  }

  async logScreenshotExtraction(count: number, total: number): Promise<void> {
    const progress = (count / total) * 100;
    await this.updateStep(`Извлечено скриншотов: ${count}/${total}`, { 
      screenshots: count, 
      progress 
    });
  }

  async logBlockAnalysis(blockType: 'text' | 'visual', count: number): Promise<void> {
    const details: LogDetails = {};
    if (blockType === 'text') {
      details.textBlocks = count;
    } else {
      details.visualBlocks = count;
    }
    await this.updateStep(`Найдено ${blockType === 'text' ? 'текстовых' : 'визуальных'} блоков: ${count}`, details);
  }
} 