import { NextRequest, NextResponse } from 'next/server';
import { analyzeDropoutCurveImage } from '@/lib/dropoutAnalysis';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    // Сохраняем файл временно
    const buffer = await imageFile.arrayBuffer();
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `test-${Date.now()}-${imageFile.name}`);
    await fs.promises.writeFile(tempFilePath, Buffer.from(buffer));

    console.log('Testing image analysis for:', imageFile.name);
    
    // Анализируем изображение
    const result = await analyzeDropoutCurveImage(tempFilePath);
    
    // Удаляем временный файл
    try {
      await fs.promises.unlink(tempFilePath);
    } catch (e) {
      console.warn('Failed to delete temp file:', e);
    }

    return NextResponse.json({
      success: true,
      fileName: imageFile.name,
      analysis: result,
      summary: {
        totalPoints: result.points.length,
        duration: result.totalDuration,
        startRetention: result.points[0]?.retentionPercentage,
        endRetention: result.points[result.points.length - 1]?.retentionPercentage,
        totalDropout: (result.points[0]?.retentionPercentage || 100) - (result.points[result.points.length - 1]?.retentionPercentage || 0)
      }
    });

  } catch (error) {
    console.error('Error in test image analysis:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 