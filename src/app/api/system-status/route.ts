import { NextRequest, NextResponse } from 'next/server';
import { systemMonitor } from '@/lib/systemMonitor';

export async function GET(request: NextRequest) {
  try {
    const status = {
      activeFFmpegProcesses: systemMonitor.getActiveProcessCount(),
      isSystemBusy: systemMonitor.isSystemBusy(),
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting system status:', error);
    return NextResponse.json({ 
      error: 'Failed to get system status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 