/**
 * MCP Server Loader - Hybrid Approach
 * 
 * Loads MCP servers from two sources:
 * 1. File-based servers (development/legacy) from mcp-servers/ directory
 * 2. Database-configured servers (production) using generic handler
 */

import { Express, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import mcpHandler from './routes/mcp-handler';

// Store list of loaded servers for the /mcp endpoint
interface LoadedServer {
  name: string;
  path: string;
  source: 'file' | 'database';
  toolCount?: number;
}

const loadedServers: LoadedServer[] = [];

export const loadMcpServers = (app: Express) => {
  console.log('\n🚀 Loading MCP Servers...\n');

  // ============================================
  // 1. Load file-based servers (development mode)
  // ============================================
  const mcpDir = path.join(__dirname, 'mcp-servers');

  if (fs.existsSync(mcpDir)) {
    const entries = fs.readdirSync(mcpDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const serverName = entry.name;
        const serverPath = path.join(mcpDir, serverName, 'index.ts');
        
        try {
          console.log(`🔌 Loading file-based MCP: ${serverName}...`);
          
          const routeModule = require(serverPath);
          const router = routeModule.default || routeModule;

          if (router && typeof router === 'function') {
            app.use(`/mcp/${serverName}`, router);
            console.log(`✨ Mounted /mcp/${serverName} (file-based)`);
            loadedServers.push({ 
              name: serverName, 
              path: `/mcp/${serverName}`,
              source: 'file'
            });
          } else {
            console.error(`⚠️ ${serverName} did not export a valid router`);
          }
        } catch (error) {
          console.error(`❌ Failed to load file-based MCP ${serverName}:`, error);
        }
      }
    }
  }

  // ============================================
  // 2. Mount generic handler for database-configured servers
  // ============================================
  // The generic handler at /mcp-db will handle all database-configured servers
  // It reads config from the database and proxies to external APIs
  app.use('/mcp-db', mcpHandler);
  console.log('✨ Mounted /mcp-db (database-configured servers)');

  // ============================================
  // 3. Unified endpoint to list ALL servers
  // ============================================
  app.get('/mcp', async (req: Request, res: Response) => {
    try {
      // Get database servers from the handler
      let dbServers: any[] = [];
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        dbServers = await prisma.mCPServer.findMany({
          where: { isActive: true },
          select: {
            name: true,
            displayName: true,
            description: true,
            _count: { select: { tools: true } }
          }
        });
        await prisma.$disconnect();
      } catch (e) {
        // Database not available, skip
      }

      // Combine file-based and database servers
      const allServers = [
        ...loadedServers,
        ...dbServers.map(s => ({
          name: s.name,
          displayName: s.displayName,
          description: s.description,
          path: `/mcp-db/${s.name}`,
          source: 'database' as const,
          toolCount: s._count.tools
        }))
      ];

      // Deduplicate by name (file-based takes priority)
      const seen = new Set<string>();
      const uniqueServers = allServers.filter(s => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      });

      res.json({
        success: true,
        servers: uniqueServers,
        count: uniqueServers.length,
        sources: {
          fileBased: loadedServers.length,
          database: dbServers.length
        },
        message: `${uniqueServers.length} MCP servers available`
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log(`\n📊 Loaded ${loadedServers.length} file-based MCP servers`);
  console.log('📊 Database servers available at /mcp-db/*\n');
};
