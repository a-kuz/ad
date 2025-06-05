import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';
import { AdSubmission } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Path to the folder where uploads will be stored
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const DATA_FILE = path.join(process.cwd(), 'data', 'submissions.json');

// Make sure the directories exist
export const ensureDirectoriesExist = () => {
  const videosDir = path.join(UPLOADS_DIR, 'videos');
  const graphsDir = path.join(UPLOADS_DIR, 'graphs');
  const dataDir = path.dirname(DATA_FILE);
  
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }
  
  if (!fs.existsSync(graphsDir)) {
    fs.mkdirSync(graphsDir, { recursive: true });
  }
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
  }
};

// Save file to disk
export const saveFileToDisk = async (
  file: Buffer,
  fileName: string,
  fileType: 'videos' | 'graphs'
): Promise<string> => {
  // Generate a unique filename to avoid collisions
  const uniqueFileName = `${Date.now()}-${fileName}`;
  const filePath = path.join(UPLOADS_DIR, fileType, uniqueFileName);
  
  // Write the file to disk
  await writeFile(filePath, file);
  
  // Return the public path to the file
  return `/uploads/${fileType}/${uniqueFileName}`;
};

// Save submission data to JSON file
export const saveSubmission = async (submission: Omit<AdSubmission, 'id'>): Promise<string> => {
  ensureDirectoriesExist();
  
  // Read existing submissions
  let submissions: AdSubmission[] = [];
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    submissions = JSON.parse(data);
  } catch (error) {
    console.error('Error reading submissions file:', error);
  }
  
  // Generate a unique ID for the new submission
  const id = uuidv4();
  const newSubmission: AdSubmission = {
    ...submission,
    id
  };
  
  // Add the new submission and write back to the file
  submissions.push(newSubmission);
  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
  
  return id;
};

// Get all submissions
export const getSubmissions = (): AdSubmission[] => {
  ensureDirectoriesExist();
  
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading submissions file:', error);
    return [];
  }
}; 