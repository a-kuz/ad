import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UserSession, UploadedFilePair } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(SESSIONS_FILE)) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}));
}

export function generateSessionId(): string {
  return uuidv4();
}

export function createSession(sessionId: string): UserSession {
  const session: UserSession = {
    sessionId,
    createdAt: new Date().toISOString(),
    filePairs: []
  };
  
  const sessions = getSessions();
  sessions[sessionId] = session;
  saveSessions(sessions);
  
  return session;
}

export function getSession(sessionId: string): UserSession | null {
  const sessions = getSessions();
  return sessions[sessionId] || null;
}

export function getAllSessions(): UserSession[] {
  const sessions = getSessions();
  return Object.values(sessions).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function deleteSession(sessionId: string): boolean {
  const sessions = getSessions();
  if (sessions[sessionId]) {
    delete sessions[sessionId];
    saveSessions(sessions);
    return true;
  }
  return false;
}

export function addFilePairToSession(sessionId: string, filePair: UploadedFilePair): void {
  const sessions = getSessions();
  if (sessions[sessionId]) {
    sessions[sessionId].filePairs.push(filePair);
    saveSessions(sessions);
  }
}

function getSessions(): Record<string, UserSession> {
  try {
    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function saveSessions(sessions: Record<string, UserSession>): void {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
} 