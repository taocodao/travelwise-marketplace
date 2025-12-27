import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// API route to discover generated MCP servers
export async function GET(request: NextRequest) {
  try {
    // Path to generated MCP servers
    const mcpServersPath = path.resolve(process.cwd(), '../api/src/mcp-servers');
    
    const servers: { name: string; path: string; tools: string[] }[] = [];
    
    if (fs.existsSync(mcpServersPath)) {
      const dirs = fs.readdirSync(mcpServersPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const dir of dirs) {
        const indexPath = path.join(mcpServersPath, dir, 'index.ts');
        if (fs.existsSync(indexPath)) {
          // Read the file to extract tool names
          const content = fs.readFileSync(indexPath, 'utf-8');
          
          // Extract tool names from router.post patterns
          const toolMatches = content.matchAll(/router\.post\(['"]\/tools\/([^'"]+)['"]/g);
          const tools = Array.from(toolMatches).map(m => m[1]);
          
          servers.push({
            name: dir,
            path: `/mcp/${dir}`,
            tools: tools.length > 0 ? tools : ['(tools endpoint available)']
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      servers,
      count: servers.length
    });
  } catch (error: any) {
    console.error('Error discovering MCP servers:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      servers: []
    }, { status: 500 });
  }
}
