import path from 'path';
import fs from 'fs';
import { mkdirp } from 'mkdirp';

let processManagerInitialized = false;
let logsDirectoryInitialized = false;

export async function initializeProcessManager(): Promise<void> {
  if (processManagerInitialized) {
    return;
  }

  try {
    const { processManager } = await import('./processManager');
    processManagerInitialized = true;
    console.log('🚀 Process Manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Process Manager:', error);
  }
}

export async function initializeLogsDirectory(): Promise<void> {
  if (logsDirectoryInitialized) {
    return;
  }

  try {
    // Ensure LLM logs directory exists
    const logsDir = path.join(process.cwd(), 'public', 'logs', 'llm');
    await mkdirp(logsDir);
    logsDirectoryInitialized = true;
    console.log('📁 LLM logs directory initialized at', logsDir);
  } catch (error) {
    console.error('❌ Failed to initialize logs directory:', error);
  }
}

export function ensureProcessManagerInit(): void {
  if (!processManagerInitialized) {
    initializeProcessManager().catch(error => {
      console.error('Failed to initialize Process Manager:', error);
    });
  }
}

export function ensureServerInit(): void {
  // Initialize process manager
  if (!processManagerInitialized) {
    initializeProcessManager().catch(error => {
      console.error('Failed to initialize Process Manager:', error);
    });
  }
  
  // Initialize logs directory
  if (!logsDirectoryInitialized) {
    initializeLogsDirectory().catch(error => {
      console.error('Failed to initialize logs directory:', error);
    });
  }
} 