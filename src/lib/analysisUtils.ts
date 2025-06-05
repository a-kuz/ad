import { UploadedFilePair, DropoutCurveTable } from '@/types';

export function getDropoutDataFromAnalysis(pair: UploadedFilePair): DropoutCurveTable | null {
  if (!pair.analysis) return null;
  
  // Проверяем, есть ли данные о комплексном анализе в analysis
  const analysisData = pair.analysis as any;
  
  // Если есть dropoutCurve напрямую, возвращаем его
  if (analysisData.dropoutCurve) {
    return analysisData.dropoutCurve;
  }
  
  // Если есть comprehensiveAnalysis, извлекаем оттуда
  if (analysisData.comprehensiveAnalysis?.dropoutCurve) {
    return analysisData.comprehensiveAnalysis.dropoutCurve;
  }
  
  // Пытаемся парсить из report (для старых записей)
  if (analysisData.report) {
    try {
      const reportData = JSON.parse(analysisData.report);
      if (reportData.dropoutCurve) {
        return reportData.dropoutCurve;
      }
    } catch (error) {
      console.error('Failed to parse report data:', error);
    }
  }
  
  return null;
}

export async function fetchDropoutDataForPair(sessionId: string, filePairId: string): Promise<DropoutCurveTable | null> {
  try {
    const response = await fetch(`/api/session/${sessionId}`);
    if (!response.ok) return null;
    
    const session = await response.json();
    const pair = session.filePairs.find((p: UploadedFilePair) => p.id === filePairId);
    
    if (!pair) return null;
    
    return getDropoutDataFromAnalysis(pair);
  } catch (error) {
    console.error('Failed to fetch dropout data:', error);
    return null;
  }
} 