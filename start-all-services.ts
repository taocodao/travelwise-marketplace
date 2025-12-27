import { spawn } from 'child_process';
import express from 'express';
import { createServer } from 'http';
import next from 'next';
import path from 'path';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Environment variables
const env = { ...process.env };

// MCP Server configurations
const mcpServers = [
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

async function startServer() {
  console.log('🚀 Starting Travelwise Marketplace...\n');

  // Start MCP servers
  console.log('📡 Starting MCP Servers...');
  mcpServers.forEach(server => {
    console.log(`  - Starting ${server.name} on port ${server.port}...`);
    
    const proc = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: server.dir,
      env: server.env,
      stdio: 'inherit'
    });

    proc.on('error', (err) => {
      console.error(`❌ Error starting ${server.name}:`, err);
    });
  });

  // Wait a bit for MCP servers to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start Next.js frontend
  console.log('\n🌐 Starting Next.js Frontend...');
  
  const app = next({
    dev,
    hostname,
    port,
    dir: path.join(process.cwd(), 'packages/frontend')
  });

  const handle = app.getRequestHandler();
  await app.prepare();

  const server = express();

  // Health check endpoint
  server.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      frontend: 'running',
      mcpServers: mcpServers.map(s => ({ name: s.name, port: s.port }))
    });
  });

  // API routes for MCP servers (optional proxy)
  server.get('/api/mcp/status', (req, res) => {
    res.json({
      servers: mcpServers.map(s => ({
        name: s.name,
        port: s.port,
        url: `http://localhost:${s.port}`
      }))
    });
  });

  // Let Next.js handle all other routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  // Start the server
  const httpServer = createServer(server);
  
  httpServer.listen(port, hostname, () => {
    console.log(`\n✅ Server running on http://${hostname}:${port}`);
    console.log(`📡 MCP Servers: ports ${mcpServers.map(s => s.port).join(', ')}`);
    console.log(`🌐 Frontend: http://${hostname}:${port}`);
    console.log(`💚 Health check: http://${hostname}:${port}/health\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
