
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);

const rootEnv = path.resolve(__dirname, '../../../../.env'); // Relative to SRC (4 levels)
// src (1) mcp-generator (2) mcp-servers (3) packages (4) root (5).

// My previous logic was 5 levels from DIST/services.
// From SRC Root:
// src (1) mcp-generator (2) mcp-servers (3) packages (4).
// So ../../../../.env
// Wait. 
// __dirname is .../src
// .. -> mcp-generator
// ../.. -> mcp-servers
// ../../.. -> packages
// ../../../.. -> root

const p1 = path.resolve(__dirname, '../../../../.env');
console.log('Check P1 (4 up):', p1, fs.existsSync(p1));

const p2 = path.resolve(__dirname, '../../../../../.env');
console.log('Check P2 (5 up):', p2, fs.existsSync(p2));

dotenv.config({ path: p1 });
console.log('KEY (P1 attempt):', process.env.OPENAI_API_KEY ? 'FOUND' : 'MISSING');
