import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const ADMIN_TOKENS_FILE = path.join(process.cwd(), 'data', 'admin-tokens.json');

function getAdminTokens(): string[] {
  try {
    if (!fs.existsSync(ADMIN_TOKENS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(ADMIN_TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveAdminTokens(tokens: string[]): void {
  const dataDir = path.dirname(ADMIN_TOKENS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(ADMIN_TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

export async function POST() {
  try {
    const adminToken = uuidv4();
    const tokens = getAdminTokens();
    tokens.push(adminToken);
    saveAdminTokens(tokens);
    
    return NextResponse.json({ adminToken });
  } catch (error) {
    console.error('Error generating admin token:', error);
    return NextResponse.json(
      { error: 'Failed to generate admin token' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const tokens = getAdminTokens();
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Error fetching admin tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin tokens' },
      { status: 500 }
    );
  }
} 