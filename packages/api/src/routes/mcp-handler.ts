/**
 * Generic MCP Handler - Production-Ready
 * 
 * This handler reads MCP server configuration from the database
 * and proxies requests to external APIs. No code generation needed.
 * 
 * Visibility Control:
 * - DRAFT: Only visible to owner (development)
 * - PRIVATE: Only visible to owner (permanent)
 * - PUBLIC: Visible to all users
 */

import { Router, Request, Response } from 'express';
import axios, { AxiosRequestConfig, Method } from 'axios';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Cache for server configs (refresh every 5 minutes)
let serverCache: Map<string, any> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Extract user ID from request (supports JWT, header, or query param)
function getUserId(req: Request): string | null {
  // Priority: JWT claim > X-User-Id header > userId query param
  const user = (req as any).user;
  if (user?.id) return user.id;
  if (req.headers['x-user-id']) return req.headers['x-user-id'] as string;
  if (req.query.userId) return req.query.userId as string;
  return null;
}

async function getServerConfig(serverName: string, userId?: string | null) {
  // Check cache (but we need to validate access)
  const cached = serverCache.get(serverName);
  if (cached && Date.now() - cacheTimestamp < CACHE_TTL) {
    // Validate access
    if (canAccessServer(cached, userId)) {
      return cached;
    }
  }

  const server = await prisma.mCPServer.findFirst({
    where: { name: serverName },
    include: { tools: true }
  });

  if (server) {
    serverCache.set(serverName, server);
    cacheTimestamp = Date.now();
    
    if (canAccessServer(server, userId)) {
      return server;
    }
  }

  return null;
}

// Check if user can access a server based on visibility
function canAccessServer(server: any, userId?: string | null): boolean {
  // PUBLIC servers are accessible to everyone
  if (server.visibility === 'PUBLIC') return true;
  
  // DRAFT and PRIVATE require ownership
  if (!userId) return false;
  return server.ownerId === userId;
}

// List all accessible MCP servers from database
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    // Build visibility filter
    // Note: After running `npx prisma generate`, these can use proper Visibility enum
    const visibilityFilter: any = userId ? {
      OR: [
        { visibility: 'PUBLIC' },
        { ownerId: userId, visibility: 'DRAFT' },
        { ownerId: userId, visibility: 'PRIVATE' },
      ]
    } : {
      visibility: 'PUBLIC'
    };
    
    const servers = await prisma.mCPServer.findMany({
      where: { 
        isActive: true,
        ...visibilityFilter
      },
      include: { tools: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      servers: servers.map((s: any) => ({
        id: s.id,
        name: s.name,
        displayName: s.displayName || s.name,
        description: s.description,
        category: s.category,
        status: s.status,
        baseUrl: s.baseUrl || s.endpoint,
        toolCount: s.tools?.length || 0,
        path: `/mcp-db/${s.name}`
      })),
      count: servers.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List tools for a specific server
router.get('/:serverName/tools', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const server = await getServerConfig(req.params.serverName, userId);
    
    if (!server) {
      return res.status(404).json({ error: 'Server not found or access denied' });
    }

    res.json(server.tools.map((t: any) => ({
      name: t.name,
      toolName: t.name,
      description: t.description,
      toolDescription: t.description,
      method: t.httpMethod,
      path: t.path,
      costUsd: t.costUsd,
      inputSchema: t.inputSchema
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute a tool - Generic proxy handler
router.post('/:serverName/tools/:toolName', async (req: Request, res: Response) => {
  const { serverName, toolName } = req.params;
  const startTime = Date.now();
  const userId = getUserId(req);

  try {
    const server = await getServerConfig(serverName, userId);
    
    if (!server) {
      return res.status(404).json({ error: `Server "${serverName}" not found or access denied` });
    }

    if (!server.isActive) {
      return res.status(503).json({ error: 'Server is currently inactive' });
    }

    const tool = server.tools.find((t: any) => t.name === toolName);
    
    if (!tool) {
      return res.status(404).json({ 
        error: `Tool "${toolName}" not found`,
        availableTools: server.tools.map((t: any) => t.name)
      });
    }

    // Get API key from request or server config
    const apiKey = req.body.apiKey || req.headers['x-api-key'] || 
                   (server.authConfig as any)?.defaultKey;

    // Build the external API request
    const baseUrl = server.baseUrl || server.endpoint;
    const toolPath = tool.path || `/${toolName}`;
    const fullUrl = `${baseUrl}${toolPath}`;

    // Map parameters
    let params = { ...req.body };
    delete params.apiKey; // Don't forward the apiKey in params

    // Apply parameter mapping if defined
    if (tool.paramMapping) {
      const mapping = tool.paramMapping as Record<string, string>;
      const mappedParams: Record<string, any> = {};
      
      for (const [mcpParam, apiParam] of Object.entries(mapping)) {
        if (params[mcpParam] !== undefined) {
          mappedParams[apiParam] = params[mcpParam];
        }
      }
      params = { ...params, ...mappedParams };
    }

    // Add API key based on auth type
    const authConfig = server.authConfig as any || {};
    if (server.authType === 'apiKey' && apiKey) {
      if (authConfig.location === 'header') {
        // Will be added to headers below
      } else {
        // Default: add to query params
        params[authConfig.paramName || 'key'] = apiKey;
      }
    }

    // Build request config
    const axiosConfig: AxiosRequestConfig = {
      method: (tool.httpMethod || 'GET') as Method,
      url: fullUrl,
      timeout: 30000,
    };

    // Add params/data based on method
    if (['GET', 'DELETE'].includes(tool.httpMethod || 'GET')) {
      axiosConfig.params = params;
    } else {
      axiosConfig.data = params;
    }

    // Add headers
    axiosConfig.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'MCP-Server/1.0'
    };

    if (server.authType === 'apiKey' && apiKey && authConfig.location === 'header') {
      axiosConfig.headers[authConfig.headerName || 'X-API-Key'] = apiKey;
    } else if (server.authType === 'bearer' && apiKey) {
      axiosConfig.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Make the request
    const response = await axios(axiosConfig);
    const executionTime = Date.now() - startTime;

    // Update call count
    await prisma.mCPServer.update({
      where: { id: server.id },
      data: { callCount: { increment: 1 } }
    });

    await prisma.tool.update({
      where: { id: tool.id },
      data: { callCount: { increment: 1 } }
    });

    // Log the transaction
    await prisma.mCPTransaction.create({
      data: {
        serverId: server.id,
        toolId: tool.id,
        toolName: tool.name,
        costUsd: tool.costUsd,
        status: 'completed',
        requestParams: req.body,
        responseData: response.data
      }
    });

    res.json({
      success: true,
      data: response.data,
      meta: {
        server: serverName,
        tool: toolName,
        executionTime,
        cost: tool.costUsd
      }
    });

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    
    // Log failed transaction
    try {
      const server = await getServerConfig(serverName);
      if (server) {
        await prisma.mCPTransaction.create({
          data: {
            serverId: server.id,
            toolName: toolName,
            costUsd: 0,
            status: 'failed',
            requestParams: req.body,
            responseData: { error: error.message }
          }
        });
      }
    } catch (e) {
      // Ignore logging errors
    }

    if (error.response) {
      // External API returned an error
      res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data || error.message,
        meta: { executionTime }
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message,
        meta: { executionTime }
      });
    }
  }
});

// ============================================
// Visibility Management Endpoints
// ============================================

// Publish a server (change visibility from DRAFT to PUBLIC)
router.post('/:serverName/publish', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const server = await prisma.mCPServer.findFirst({
      where: { name: req.params.serverName }
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if ((server as any).ownerId !== userId) {
      return res.status(403).json({ error: 'Only the owner can publish this server' });
    }

    const updated = await prisma.mCPServer.update({
      where: { id: server.id },
      data: { 
        visibility: 'PUBLIC',
        publishedAt: new Date()
      } as any  // Type assertion until Prisma client is regenerated
    });

    // Clear cache
    serverCache.delete(server.name);

    res.json({
      success: true,
      message: `Server "${server.name}" is now PUBLIC`,
      visibility: 'PUBLIC',
      publishedAt: (updated as any).publishedAt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unpublish a server (change visibility from PUBLIC back to DRAFT)
router.post('/:serverName/unpublish', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const server = await prisma.mCPServer.findFirst({
      where: { name: req.params.serverName }
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if ((server as any).ownerId !== userId) {
      return res.status(403).json({ error: 'Only the owner can modify visibility' });
    }

    await prisma.mCPServer.update({
      where: { id: server.id },
      data: { visibility: 'DRAFT' } as any  // Type assertion until Prisma client is regenerated
    });

    // Clear cache
    serverCache.delete(server.name);

    res.json({
      success: true,
      message: `Server "${server.name}" is now DRAFT (private)`,
      visibility: 'DRAFT'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
