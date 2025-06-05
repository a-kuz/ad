export interface DropoutData {
  timestamp: number; // timestamp in seconds
  dropoutPercentage: number; // percentage of users who dropped out at this timestamp
}

export interface AdSubmission {
  id: string;
  videoPath: string; // path to the video file on disk
  graphPath: string; // path to the graph image on disk
  videoName: string;
  graphName: string;
  createdAt: number;
  dropoutData?: DropoutData[]; // Optional array of dropout data points
}

export interface FilePair {
  id: string;
  video: File | null;
  graph: File | null;
  uploading: boolean;
  progress: number;
  uploaded: boolean;
  error: string | null;
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

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  format: string;
  size: number;
  title?: string;
  thumbnailPath?: string;
  streams?: VideoStreamInfo[];
}

export interface UploadedFilePair {
  id: string;
  videoPath: string;
  graphPath: string;
  videoName: string;
  graphName: string;
  uploadedAt: string;
  generatedTitle?: string;
  analysis?: VideoAnalysis;
  videoMetadata?: VideoMetadata;
}

export interface UserSession {
  sessionId: string;
  createdAt: string;
  filePairs: UploadedFilePair[];
}

export interface VideoAnalysis {
  id: string;
  insights: string;
  recommendations: string[];
  criticalMoments: Array<{
    timestamp: number;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  overallScore: number;
  improvementAreas: string[];
  generatedAt: string;
  report?: string;
}

export interface AnalysisRequest {
  sessionId: string;
  filePairId: string;
  videoMetadata: {
    duration: number;
    title: string;
    description?: string;
  };
}

export interface DropoutCurvePoint {
  timestamp: number;
  retentionPercentage: number;
  dropoutPercentage: number;
}

export interface DropoutCurveTable {
  points: DropoutCurvePoint[];
  step: number;
  totalDuration: number;
}

export interface ContentBlock {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  type: 'audio' | 'text' | 'visual';
  content?: string;
  purpose?: string;
}

export interface AudioAnalysis {
  transcription: Array<{
    timestamp: number;
    text: string;
    confidence: number;
  }>;
  groups: ContentBlock[];
}

export interface TextualVisualAnalysis {
  screenshots: Array<{
    timestamp: number;
    text: string;
    confidence: number;
  }>;
  groups: ContentBlock[];
}

export interface VisualAnalysis {
  screenshots: Array<{
    timestamp: number;
    description: string;
    actions: string[];
    elements: string[];
  }>;
  groups: ContentBlock[];
}

export interface BlockDropoutAnalysis {
  blockId: string;
  blockName: string;
  startTime: number;
  endTime: number;
  startRetention: number;
  endRetention: number;
  absoluteDropout: number;
  relativeDropout: number;
}

export interface ComprehensiveVideoAnalysis {
  dropoutCurve: DropoutCurveTable;
  audioAnalysis: AudioAnalysis;
  textualVisualAnalysis: TextualVisualAnalysis;
  visualAnalysis: VisualAnalysis;
  blockDropoutAnalysis: BlockDropoutAnalysis[];
  timelineAlignment: {
    timestamp: number;
    audioBlock?: string;
    textBlock?: string;
    visualBlock?: string;
  }[];
} 