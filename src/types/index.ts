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

export interface UploadedFilePair {
  id: string;
  videoPath: string;
  graphPath: string;
  videoName: string;
  graphName: string;
  uploadedAt: string;
}

export interface UserSession {
  sessionId: string;
  createdAt: string;
  filePairs: UploadedFilePair[];
} 