import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    servers: [
      { name: 'Google Maps', port: 3003, path: '/api/mcp/maps' },
      { name: 'Weather', port: 3004, path: '/api/mcp/weather' },
      { name: 'Travel Agent', port: 3005, path: '/api/mcp/travel' },
    ],
  });
}
