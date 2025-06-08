import fs from 'fs';
import path from 'path';
import { mkdirp } from 'mkdirp';

const logsBaseDir = path.join(process.cwd(), 'public', 'logs', 'llm');

// Create base directory if it doesn't exist
if (!fs.existsSync(logsBaseDir)) {
  console.log(`Creating base logs directory: ${logsBaseDir}`);
  mkdirp.sync(logsBaseDir);
  fs.chmodSync(logsBaseDir, 0o777);
}

// Check if directory exists and is writable
try {
  fs.accessSync(logsBaseDir, fs.constants.W_OK);
  console.log(`Logs directory ${logsBaseDir} exists and is writable`);
} catch (err) {
  console.error(`Error accessing logs directory: ${err}`);
  // Try to fix permissions
  try {
    fs.chmodSync(logsBaseDir, 0o777);
    console.log('Fixed permissions on logs directory');
  } catch (err) {
    console.error(`Failed to fix permissions: ${err}`);
  }
}

// List all subdirectories
const subdirs = fs.readdirSync(logsBaseDir);
console.log('\nExisting log directories:');
subdirs.forEach(dir => {
  const fullPath = path.join(logsBaseDir, dir);
  const stats = fs.statSync(fullPath);
  console.log(`- ${dir} (${stats.isDirectory() ? 'directory' : 'file'})`);
}); 