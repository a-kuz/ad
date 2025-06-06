import sqlite3 from 'sqlite3';
import { Database } from 'sqlite';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  UserSession, 
  UploadedFilePair, 
  VideoAnalysis, 
  VideoMetadata,
  ComprehensiveVideoAnalysis,
  VisualAnalysis
} from '@/types';
import fs from 'fs';
import { connectToDatabase } from './connectToDatabase';

// Database functions are moved to connectToDatabase.ts

export function generateSessionId(): string {
  return uuidv4();
}

export async function createSession(sessionId: string): Promise<UserSession> {
  const { db } = await connectToDatabase();
  const createdAt = new Date().toISOString();
  
  await db.run(
    'INSERT INTO sessions (id, created_at) VALUES (?, ?)',
    [sessionId, createdAt]
  );
  
  return {
    sessionId,
    createdAt,
    filePairs: []
  };
}

export async function getSession(sessionId: string): Promise<UserSession | null> {
  const { db } = await connectToDatabase();
  
  const session = await db.get(
    'SELECT * FROM sessions WHERE id = ?',
    [sessionId]
  );
  
  if (!session) return null;
  
  const filePairs = await db.all(`
    SELECT fp.*, 
           vm.duration, vm.width, vm.height, vm.fps, vm.bitrate, vm.format, vm.size, vm.title, vm.thumbnail_path, vm.streams,
           va.id as analysis_id, va.insights, va.recommendations, va.critical_moments, va.overall_score, va.improvement_areas, va.generated_at, va.report
    FROM file_pairs fp
    LEFT JOIN video_metadata vm ON fp.id = vm.file_pair_id
    LEFT JOIN video_analyses va ON fp.id = va.file_pair_id
    WHERE fp.session_id = ?
    ORDER BY fp.uploaded_at
  `, [sessionId]);
  
  const processedFilePairs: UploadedFilePair[] = filePairs.map((row: Record<string, any>) => {
    const filePair: UploadedFilePair = {
      id: row.id,
      videoPath: row.video_path,
      graphPath: row.graph_path,
      videoName: row.video_name,
      graphName: row.graph_name,
      uploadedAt: row.uploaded_at,
      generatedTitle: row.generated_title
    };
    
    if (row.duration) {
      filePair.videoMetadata = {
        duration: row.duration,
        width: row.width,
        height: row.height,
        fps: row.fps,
        bitrate: row.bitrate,
        format: row.format,
        size: row.size,
        title: row.title,
        thumbnailPath: row.thumbnail_path,
        streams: row.streams ? JSON.parse(row.streams) : undefined
      };
    }
    
    if (row.analysis_id) {
      filePair.analysis = {
        id: row.analysis_id,
        insights: row.insights,
        recommendations: JSON.parse(row.recommendations),
        criticalMoments: JSON.parse(row.critical_moments),
        overallScore: row.overall_score,
        improvementAreas: JSON.parse(row.improvement_areas),
        generatedAt: row.generated_at,
        report: row.report
      };
    }
    
    return filePair;
  });
  
  return {
    sessionId: session.id,
    createdAt: session.created_at,
    filePairs: processedFilePairs
  };
}

export async function addFilePairToSession(sessionId: string, filePair: UploadedFilePair): Promise<void> {
  const { db } = await connectToDatabase();
  
  await db.run(`
    INSERT INTO file_pairs (
      id, session_id, video_path, graph_path, video_name, graph_name, uploaded_at, generated_title
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    filePair.id,
    sessionId,
    filePair.videoPath,
    filePair.graphPath,
    filePair.videoName,
    filePair.graphName,
    filePair.uploadedAt,
    filePair.generatedTitle
  ]);
  
  if (filePair.videoMetadata) {
    await updateVideoMetadata(filePair.id, filePair.videoMetadata);
  }
  
  if (filePair.analysis) {
    await saveVideoAnalysis(filePair.id, filePair.analysis);
  }
}

export async function saveVideoAnalysis(filePairId: string, analysis: VideoAnalysis): Promise<void> {
  const { db } = await connectToDatabase();
  
  // Convert arrays to JSON strings
  const recommendations = JSON.stringify(analysis.recommendations);
  const criticalMoments = JSON.stringify(analysis.criticalMoments);
  const improvementAreas = JSON.stringify(analysis.improvementAreas);
  
  // Проверяем, существует ли уже анализ для этого ID
  const existing = await db.get(
    'SELECT id FROM video_analyses WHERE id = ?',
    [analysis.id]
  );
  
  if (existing) {
    // Если анализ существует, обновляем его
    await db.run(`
      UPDATE video_analyses SET
        insights = ?,
        recommendations = ?,
        critical_moments = ?,
        overall_score = ?,
        improvement_areas = ?,
        report = ?
      WHERE id = ?
    `, [
      analysis.insights,
      recommendations,
      criticalMoments,
      analysis.overallScore,
      improvementAreas,
      analysis.report,
      analysis.id
    ]);
  } else {
    // Если анализа нет, создаем новый
    await db.run(`
      INSERT INTO video_analyses (
        id, file_pair_id, insights, recommendations, critical_moments, 
        overall_score, improvement_areas, generated_at, report
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      analysis.id,
      filePairId,
      analysis.insights,
      recommendations,
      criticalMoments,
      analysis.overallScore,
      improvementAreas,
      analysis.generatedAt,
      analysis.report
    ]);
  }
}

export async function getVideoAnalysis(filePairId: string): Promise<VideoAnalysis | null> {
  const { db } = await connectToDatabase();
  
  const analysis = await db.get(
    'SELECT * FROM video_analyses WHERE file_pair_id = ?',
    [filePairId]
  );
  
  if (!analysis) return null;
  
  return {
    id: analysis.id,
    insights: analysis.insights,
    recommendations: JSON.parse(analysis.recommendations),
    criticalMoments: JSON.parse(analysis.critical_moments),
    overallScore: analysis.overall_score,
    improvementAreas: JSON.parse(analysis.improvement_areas),
    generatedAt: analysis.generated_at,
    report: analysis.report
  };
}

export async function saveComprehensiveAnalysis(filePairId: string, analysis: ComprehensiveVideoAnalysis): Promise<string> {
  const { db } = await connectToDatabase();
  
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  // Convert objects to JSON strings
  const dropoutCurve = JSON.stringify(analysis.dropoutCurve);
  const audioAnalysis = JSON.stringify(analysis.audioAnalysis);
  const textualVisualAnalysis = analysis.textualVisualAnalysis ? JSON.stringify(analysis.textualVisualAnalysis) : 'null';
  const visualAnalysis = JSON.stringify(analysis.visualAnalysis);
  const blockDropoutAnalysis = JSON.stringify(analysis.contentBlocks?.filter(block => block.dropoutPercentage !== undefined) || []);
  const timelineAlignment = JSON.stringify([]);  // Legacy field, now empty
  
  // Проверяем, существует ли уже анализ для этого file_pair_id
  const existing = await db.get(
    'SELECT id FROM comprehensive_analyses WHERE file_pair_id = ?',
    [filePairId]
  );
  
  if (existing) {
    // Если анализ существует, обновляем его
    await db.run(`
      UPDATE comprehensive_analyses SET
        dropout_curve = ?,
        audio_analysis = ?,
        textual_visual_analysis = ?,
        visual_analysis = ?,
        block_dropout_analysis = ?,
        timeline_alignment = ?,
        created_at = ?
      WHERE file_pair_id = ?
    `, [
      dropoutCurve,
      audioAnalysis,
      textualVisualAnalysis,
      visualAnalysis,
      blockDropoutAnalysis,
      timelineAlignment,
      createdAt,
      filePairId
    ]);
    return existing.id;
  } else {
    // Если анализа нет, создаем новый
    await db.run(`
      INSERT INTO comprehensive_analyses (
        id, file_pair_id, dropout_curve, audio_analysis, textual_visual_analysis, 
        visual_analysis, block_dropout_analysis, timeline_alignment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      filePairId,
      dropoutCurve,
      audioAnalysis,
      textualVisualAnalysis,
      visualAnalysis,
      blockDropoutAnalysis,
      timelineAlignment,
      createdAt
    ]);
    return id;
  }
}

export async function getComprehensiveAnalysis(filePairId: string): Promise<ComprehensiveVideoAnalysis | null> {
  const { db } = await connectToDatabase();
  
  const analysis = await db.get(
    'SELECT * FROM comprehensive_analyses WHERE file_pair_id = ?',
    [filePairId]
  );
  
  if (!analysis) return null;
  
  return {
    dropoutCurve: JSON.parse(analysis.dropout_curve),
    audioAnalysis: JSON.parse(analysis.audio_analysis),
    textualVisualAnalysis: analysis.textual_visual_analysis !== 'null' ? JSON.parse(analysis.textual_visual_analysis) : undefined,
    visualAnalysis: JSON.parse(analysis.visual_analysis),
    contentBlocks: JSON.parse(analysis.block_dropout_analysis)
  };
}

export async function getAllSessions(): Promise<UserSession[]> {
  const { db } = await connectToDatabase();
  
  const sessions = await db.all(`
    SELECT * FROM sessions
    ORDER BY created_at DESC
  `);
  
  const sessionsWithDetails = await Promise.all(
    sessions.map(async (session: any) => getSession(session.id))
  );
  
  return sessionsWithDetails.filter((s): s is UserSession => s !== null);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { db } = await connectToDatabase();
  await db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

export async function updateVideoMetadata(filePairId: string, metadata: VideoMetadata): Promise<void> {
  const { db } = await connectToDatabase();
  
  // Convert streams to JSON if present
  const streams = metadata.streams ? JSON.stringify(metadata.streams) : null;
  
  // Проверяем, существует ли уже метаданные для этого file_pair_id
  const existing = await db.get(
    'SELECT file_pair_id FROM video_metadata WHERE file_pair_id = ?',
    [filePairId]
  );
  
  if (existing) {
    // Если метаданные существуют, обновляем их
    await db.run(`
      UPDATE video_metadata SET
        duration = ?,
        width = ?,
        height = ?,
        fps = ?,
        bitrate = ?,
        format = ?,
        size = ?,
        title = ?,
        thumbnail_path = ?,
        streams = ?
      WHERE file_pair_id = ?
    `, [
      metadata.duration,
      metadata.width,
      metadata.height,
      metadata.fps,
      metadata.bitrate,
      metadata.format,
      metadata.size,
      metadata.title,
      metadata.thumbnailPath,
      streams,
      filePairId
    ]);
  } else {
    // Если метаданных нет, создаем новые
    await db.run(`
      INSERT INTO video_metadata (
        file_pair_id, duration, width, height, fps, bitrate, format, size, title, thumbnail_path, streams
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      filePairId,
      metadata.duration,
      metadata.width,
      metadata.height,
      metadata.fps,
      metadata.bitrate,
      metadata.format,
      metadata.size,
      metadata.title,
      metadata.thumbnailPath,
      streams
    ]);
  }
}

export async function savePairTitle(filePairId: string, title: string): Promise<void> {
  const { db } = await connectToDatabase();
  await db.run('UPDATE file_pairs SET generated_title = ? WHERE id = ?', [title, filePairId]);
}

export interface AnalysisLog {
  id: string;
  filePairId: string;
  step: string;
  message: string;
  status: 'running' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  details?: {
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
  };
}

export interface AnalysisPrompt {
  id: string;
  filePairId: string;
  type: string;
  prompt: string;
  model: string;
  createdAt: string;
}

export async function createAnalysisLog(filePairId: string, step: string, message: string, details?: AnalysisLog['details']): Promise<string> {
  const { db } = await connectToDatabase();
  
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  const detailsJson = details ? JSON.stringify(details) : null;
  
  await db.run(`
    INSERT INTO analysis_logs (id, file_pair_id, step, message, status, details, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, filePairId, step, message, 'running', detailsJson, timestamp, timestamp]);
  
  return id;
}

export async function saveAnalysisPrompt(filePairId: string, type: string, prompt: string, model: string): Promise<string> {
  const { db } = await connectToDatabase();
  
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  // Сначала проверим, существует ли уже запись для этого filePairId и type
  const existing = await db.get(
    'SELECT id FROM analysis_prompts WHERE file_pair_id = ? AND type = ?',
    [filePairId, type]
  );
  
  if (existing) {
    // Если запись существует, обновляем её
    await db.run(
      'UPDATE analysis_prompts SET prompt = ?, model = ?, created_at = ? WHERE id = ?',
      [prompt, model, createdAt, existing.id]
    );
    return existing.id;
  } else {
    // Если записи нет, создаём новую
    await db.run(
      'INSERT INTO analysis_prompts (id, file_pair_id, type, prompt, model, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, filePairId, type, prompt, model, createdAt]
    );
    return id;
  }
}

export async function getAnalysisPrompt(filePairId: string, type: string): Promise<AnalysisPrompt | null> {
  const { db } = await connectToDatabase();
  
  // First try to get by file pair ID and type
  let prompt = await db.get(
    'SELECT * FROM analysis_prompts WHERE file_pair_id = ? AND type = ?',
    [filePairId, type]
  );
  
  if (!prompt) {
    console.log(`No prompt found for filePairId=${filePairId}, type=${type}`);
    return null;
  }
  
  return {
    id: prompt.id,
    filePairId: prompt.file_pair_id,
    type: prompt.type,
    prompt: prompt.prompt,
    model: prompt.model,
    createdAt: prompt.created_at
  };
}

export async function updateAnalysisLog(logId: string, message: string, status: 'running' | 'completed' | 'error', details?: AnalysisLog['details']): Promise<void> {
  const { db } = await connectToDatabase();
  const updatedAt = new Date().toISOString();
  const detailsJson = details ? JSON.stringify(details) : null;
  
  await db.run(`
    UPDATE analysis_logs SET message = ?, status = ?, details = ?, updated_at = ? WHERE id = ?
  `, [message, status, detailsJson, updatedAt, logId]);
}

export async function getAnalysisLogs(filePairId: string): Promise<AnalysisLog[]> {
  const { db } = await connectToDatabase();
  
  const logs = await db.all(`
    SELECT * FROM analysis_logs 
    WHERE file_pair_id = ? 
    ORDER BY created_at
  `, [filePairId]);
  
  return logs.map((log: any) => ({
    id: log.id,
    filePairId: log.file_pair_id,
    step: log.step,
    message: log.message,
    status: log.status,
    createdAt: log.created_at,
    updatedAt: log.updated_at,
    details: log.details ? JSON.parse(log.details) : undefined
  }));
}

export async function clearAnalysisLogs(filePairId: string): Promise<void> {
  const { db } = await connectToDatabase();
  await db.run('DELETE FROM analysis_logs WHERE file_pair_id = ?', [filePairId]);
}

/**
 * Gets the file pair data for a given file pair ID
 */
export async function getFilePairData(filePairId: string) {
  const { db } = await connectToDatabase();
  return db.get('SELECT * FROM file_pairs WHERE id = ?', [filePairId]);
}

/**
 * Gets all screenshot files for a given file pair
 */
export async function getScreenshotFilesForFilePair(filePairId: string) {
  try {
    const { db } = await connectToDatabase();
    
    // First get the file pair to get the session ID
    const filePair = await db.get(
      'SELECT * FROM file_pairs WHERE id = ?', 
      [filePairId]
    );
    
    if (!filePair || !filePair.session_id) {
      console.error(`File pair not found or missing session_id: ${filePairId}`);
      return [];
    }
    
    const sessionId = filePair.session_id;
    
    // Get comprehensive analysis to find screenshot directory (if available)
    const analysis = await db.get(
      'SELECT * FROM comprehensive_analyses WHERE file_pair_id = ?',
      [filePairId]
    );
    
    // If we don't have the analysis, try to find screenshots in the default location
    const uploadsPath = path.join('uploads', sessionId);
    const screenshotsBasePath = path.join(uploadsPath, 'screenshots');
    
    // List all available screenshot directories
    const publicDir = path.join(process.cwd(), 'public');
    const screenshotsFullPath = path.join(publicDir, screenshotsBasePath);
    
    if (!fs.existsSync(screenshotsFullPath)) {
      console.error(`Screenshots base directory not found: ${screenshotsFullPath}`);
      return [];
    }
    
    // Find all screenshot directories
    const screenshotDirs = fs.readdirSync(screenshotsFullPath)
      .map(dir => path.join(screenshotsFullPath, dir))
      .filter(dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory())
      .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime()); // Sort by newest first
    
    if (screenshotDirs.length === 0) {
      console.error(`No screenshot directories found in ${screenshotsFullPath}`);
      return [];
    }
    
    // Use the most recent directory
    const latestDir = screenshotDirs[0];
    const dirName = path.basename(latestDir);
    
    // Get all screenshots from this directory
    const screenshotFiles = fs.readdirSync(latestDir)
      .filter(file => file.endsWith('.jpg'))
      .map(file => path.join(screenshotsBasePath, dirName, file))
      .sort((a, b) => {
        // Extract timestamp from filename (e.g., "screenshot_10.5s.jpg" -> 10.5)
        const timeA = parseFloat(a.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
        const timeB = parseFloat(b.match(/screenshot_(\d+\.?\d*)s\.jpg$/)?.[1] || '0');
        return timeA - timeB;
      });
    
    return screenshotFiles;
  } catch (error) {
    console.error('Error getting screenshot files:', error);
    return [];
  }
}

/**
 * Updates the visual analysis for a file pair
 */
export async function updateVisualAnalysisForFilePair(filePairId: string, visualAnalysis: VisualAnalysis) {
  try {
    const { db } = await connectToDatabase();
    
    // First check if we have a comprehensive analysis
    const existingAnalysis = await db.get(
      'SELECT * FROM comprehensive_analyses WHERE file_pair_id = ?',
      [filePairId]
    );
    
    if (!existingAnalysis) {
      console.warn(`No existing comprehensive analysis found for file pair ${filePairId}`);
      return false;
    }
    
    // Parse existing analysis
    const analysis = {
      dropoutCurve: JSON.parse(existingAnalysis.dropout_curve),
      audioAnalysis: JSON.parse(existingAnalysis.audio_analysis),
      textualVisualAnalysis: existingAnalysis.textual_visual_analysis !== 'null' 
        ? JSON.parse(existingAnalysis.textual_visual_analysis) 
        : undefined,
      visualAnalysis: visualAnalysis,
      contentBlocks: JSON.parse(existingAnalysis.block_dropout_analysis)
    };
    
    // Save the updated analysis
    await saveComprehensiveAnalysis(filePairId, analysis);
    
    return true;
  } catch (error) {
    console.error('Error updating visual analysis:', error);
    throw error;
  }
} 