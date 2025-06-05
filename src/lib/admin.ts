import fs from 'fs';
import path from 'path';

const ADMIN_TOKENS_FILE = path.join(process.cwd(), 'data', 'admin-tokens.json');

export function getAdminTokens(): string[] {
  try {
    if (!fs.existsSync(ADMIN_TOKENS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(ADMIN_TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export function isValidAdminToken(token: string): boolean {
  const tokens = getAdminTokens();
  return tokens.includes(token);
} 