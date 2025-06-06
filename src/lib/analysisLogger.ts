import { createAnalysisLog, updateAnalysisLog } from './database';

export class AnalysisLogger {
  private filePairId: string;
  private currentLogId: string | null = null;

  constructor(filePairId: string) {
    this.filePairId = filePairId;
  }

  async startStep(step: string, message: string): Promise<void> {
    console.log(`[${step}] ${message}`);
    this.currentLogId = await createAnalysisLog(this.filePairId, step, message);
  }

  async updateStep(message: string): Promise<void> {
    if (this.currentLogId) {
      console.log(`[UPDATE] ${message}`);
      await updateAnalysisLog(this.currentLogId, message, 'running');
    }
  }

  async completeStep(message: string): Promise<void> {
    if (this.currentLogId) {
      console.log(`[COMPLETED] ${message}`);
      await updateAnalysisLog(this.currentLogId, message, 'completed');
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

  async logStandalone(step: string, message: string, status: 'running' | 'completed' | 'error' = 'completed'): Promise<void> {
    console.log(`[${step}] ${message}`);
    const logId = await createAnalysisLog(this.filePairId, step, message);
    if (status !== 'running') {
      await updateAnalysisLog(logId, message, status);
    }
  }
} 