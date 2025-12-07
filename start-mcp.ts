import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';

// Read .env file
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = { ...process.env };

// Parse .env
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const servers = [
  {
    name: 'Google Maps',
    dir: 'packages/mcp-servers/google-maps',
    port: 3003,
    env: { ...env, PORT: '3003', GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY }
  },
  {
    name: 'Weather',
    dir: 'packages/mcp-servers/weather',
    port: 3004,
    env: { ...env, PORT: '3004', OPENWEATHER_API_KEY: env.OPENWEATHER_API_KEY }
  },
  {
    name: 'Travel Agent',
    dir: 'packages/mcp-servers/travel-agent',
    port: 3005,
    env: { ...env, PORT: '3005' }
  }
];

// Create Express app for health checks
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', servers: 'running' });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Travelwise MCP Servers',
    status: 'running',
    servers: servers.map(s => ({ name: s.name, port: s.port }))
  });
});

// Start health check server
app.listen(PORT, () => {
  console.log(`✅ Health check server listening on port ${PORT}`);
});

// Start MCP servers
console.log('🚀 Starting MCP Servers with Real APIs...\n');

servers.forEach(server => {
  console.log(`Starting ${server.name} on port ${server.port}...`);
  
  const proc = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: server.dir,
    env: server.env,
    stdio: 'inherit'
  });

  proc.on('error', (err) => {
    console.error(`❌ Error starting ${server.name}:`, err);
  });

  proc.on('exit', (code) => {
    console.log(`⚠️  ${server.name} exited with code ${code}`);
  });
});

console.log('✅ All MCP servers started!');
console.log(`Servers running on ports: 3003, 3004, 3005`);
console.log(`Health check available at http://localhost:${PORT}/health\n`);
