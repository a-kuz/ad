class SystemMonitor {
  private activeFFmpegProcesses = 0;
  private readonly maxConcurrentProcesses = 2; // Максимум 2 процесса ffmpeg одновременно
  
  async acquireFFmpegSlot(): Promise<void> {
    while (this.activeFFmpegProcesses >= this.maxConcurrentProcesses) {
      console.log(`Waiting for ffmpeg slot... Current: ${this.activeFFmpegProcesses}/${this.maxConcurrentProcesses}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.activeFFmpegProcesses++;
    console.log(`Acquired ffmpeg slot. Active processes: ${this.activeFFmpegProcesses}/${this.maxConcurrentProcesses}`);
  }
  
  releaseFFmpegSlot(): void {
    if (this.activeFFmpegProcesses > 0) {
      this.activeFFmpegProcesses--;
      console.log(`Released ffmpeg slot. Active processes: ${this.activeFFmpegProcesses}/${this.maxConcurrentProcesses}`);
    }
  }
  
  getActiveProcessCount(): number {
    return this.activeFFmpegProcesses;
  }
  
  isSystemBusy(): boolean {
    return this.activeFFmpegProcesses >= this.maxConcurrentProcesses;
  }
}

export const systemMonitor = new SystemMonitor(); 