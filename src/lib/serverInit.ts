let processManagerInitialized = false;

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

export function ensureProcessManagerInit(): void {
  if (!processManagerInitialized) {
    initializeProcessManager().catch(error => {
      console.error('Failed to initialize Process Manager:', error);
    });
  }
} 