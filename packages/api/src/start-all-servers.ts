import { spawn } from 'child_process';
import path from 'path';

const servers = [
  { name: 'Google Maps MCP', port: 3003, script: 'mcp-servers/google-maps/index.ts' },
  { name: 'Weather MCP', port: 3004, script: 'mcp-servers/weather/index.ts' },
  { name: 'Travel Agent MCP', port: 3005, script: 'mcp-servers/travel-agent/index.ts' },
];

console.log('🚀 Starting all MCP servers...\n');

servers.forEach(server => {
  const process = spawn('npx', ['tsx', path.join(__dirname, '..', server.script)], {
    stdio: 'inherit',
    shell: true,
  });

  process.on('error', (error) => {
    console.error(`❌ Error starting ${server.name}:`, error);
  });

  process.on('exit', (code) => {
    console.log(`🔴 ${server.name} exited with code ${code}`);
  });
});

console.log('✅ All servers starting...');
console.log('Press Ctrl+C to stop all servers\n');
