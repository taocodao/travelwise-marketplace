/**
 * ERC-8004 Registry Routes
 * 
 * REST API for MCP server registration and discovery.
 * Database-backed implementation of ERC-8004 on-chain registry.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { erc8004RegistryService, RegisterServerInput } from '../services/erc8004-registry.service';
import { getServerPaymentStats } from '../middleware/x402-payment.middleware';

const router = Router();

// ══════════════════════════════════════════════════════
// REGISTER NEW MCP SERVER
// ══════════════════════════════════════════════════════

const RegisterServerSchema = z.object({
  name: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  displayName: z.string().max(100).optional(),
  description: z.string().min(10).max(1000),
  endpoint: z.string().url(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  agentId: z.string().uuid(),
  category: z.string().max(50).optional(),
  capabilities: z.array(z.string()).optional(),
  pricing: z.record(z.number().min(0)).optional(),
  metadataUri: z.string().url().optional(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = RegisterServerSchema.parse(req.body);
    
    const registration = await erc8004RegistryService.registerServer(validated);

    res.status(201).json({
      success: true,
      message: 'MCP server registered successfully',
      registration,
      chainId: 84532,
      network: 'base-sepolia',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Registration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

// ══════════════════════════════════════════════════════
// DISCOVER MCP SERVERS
// ══════════════════════════════════════════════════════

const DiscoveryQuerySchema = z.object({
  category: z.string().optional(),
  capabilities: z.string().optional(), // Comma-separated
  minTools: z.string().transform(v => parseInt(v, 10)).optional(),
  limit: z.string().transform(v => parseInt(v, 10)).optional(),
  offset: z.string().transform(v => parseInt(v, 10)).optional(),
});

router.get('/discover', async (req: Request, res: Response) => {
  try {
    const query = DiscoveryQuerySchema.parse(req.query);

    const servers = await erc8004RegistryService.discoverServers({
      category: query.category,
      capabilities: query.capabilities?.split(',').map(c => c.trim()),
      minTools: query.minTools,
      limit: query.limit || 50,
      offset: query.offset || 0,
    });

    res.json({
      success: true,
      count: servers.length,
      servers,
      chainId: 84532,
      paymentProtocol: 'X402',
    });
  } catch (error: any) {
    console.error('Discovery failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Discovery failed',
    });
  }
});

// ══════════════════════════════════════════════════════
// GET SERVER BY ID
// ══════════════════════════════════════════════════════

router.get('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;

    const server = await erc8004RegistryService.getServerById(serverId);

    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found',
      });
    }

    // Get payment stats
    let paymentStats = null;
    try {
      paymentStats = await getServerPaymentStats(serverId);
    } catch (e) {
      // Ignore - x402_payments table may not exist yet
    }

    res.json({
      success: true,
      server,
      paymentStats,
    });
  } catch (error: any) {
    console.error('Get server failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get server',
    });
  }
});

// ══════════════════════════════════════════════════════
// GET SERVER BY WALLET ADDRESS
// ══════════════════════════════════════════════════════

router.get('/wallet/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    const server = await erc8004RegistryService.getServerByWallet(walletAddress);

    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'No server found for this wallet',
      });
    }

    res.json({
      success: true,
      server,
    });
  } catch (error: any) {
    console.error('Get server by wallet failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get server',
    });
  }
});

// ══════════════════════════════════════════════════════
// VERIFY OWNERSHIP
// ══════════════════════════════════════════════════════

const VerifyOwnershipSchema = z.object({
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string(),
});

router.post('/servers/:serverId/verify', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const { ownerAddress, signature } = VerifyOwnershipSchema.parse(req.body);

    const isOwner = await erc8004RegistryService.verifyOwnership(
      serverId,
      ownerAddress,
      signature
    );

    res.json({
      success: true,
      verified: isOwner,
      serverId,
      ownerAddress,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Verification failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Verification failed',
    });
  }
});

// ══════════════════════════════════════════════════════
// UPDATE SERVER
// ══════════════════════════════════════════════════════

const UpdateServerSchema = z.object({
  displayName: z.string().max(100).optional(),
  description: z.string().min(10).max(1000).optional(),
  endpoint: z.string().url().optional(),
  category: z.string().max(50).optional(),
  capabilities: z.array(z.string()).optional(),
  metadataUri: z.string().url().optional(),
});

router.put('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const updates = UpdateServerSchema.parse(req.body);

    const server = await erc8004RegistryService.updateServer(serverId, updates);

    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found',
      });
    }

    res.json({
      success: true,
      message: 'Server updated successfully',
      server,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Update failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Update failed',
    });
  }
});

// ══════════════════════════════════════════════════════
// DEACTIVATE SERVER
// ══════════════════════════════════════════════════════

router.delete('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;

    const success = await erc8004RegistryService.deactivateServer(serverId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Server not found or could not be deactivated',
      });
    }

    res.json({
      success: true,
      message: 'Server deactivated successfully',
    });
  } catch (error: any) {
    console.error('Deactivation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Deactivation failed',
    });
  }
});

// ══════════════════════════════════════════════════════
// REGISTRY STATS
// ══════════════════════════════════════════════════════

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await erc8004RegistryService.getStats();

    res.json({
      success: true,
      ...stats,
    });
  } catch (error: any) {
    console.error('Stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get stats',
    });
  }
});

// ══════════════════════════════════════════════════════
// AI REPUTATION ENDPOINTS
// ══════════════════════════════════════════════════════

import { mcpReputationService } from '../services/ai-agent/mcp-reputation';

// Discover tools from server and generate AI descriptions
router.post('/servers/:serverId/discover', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    
    const server = await erc8004RegistryService.getServerById(serverId);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    console.log(`🔍 AI discovering tools for ${server.name}...`);
    const tools = await mcpReputationService.discoverTools(server.endpoint);

    res.json({
      success: true,
      serverId,
      serverName: server.name,
      discoveredTools: tools,
      count: tools.length,
    });
  } catch (error: any) {
    console.error('Tool discovery failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get server reputation and latest review
router.get('/servers/:serverId/reputation', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    
    const server = await erc8004RegistryService.getServerById(serverId);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const reputation = await mcpReputationService.calculateReputation(serverId);

    res.json({
      success: true,
      serverId,
      serverName: server.name,
      reputation,
    });
  } catch (error: any) {
    console.error('Reputation fetch failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate AI review for server
router.post('/servers/:serverId/review', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    
    const server = await erc8004RegistryService.getServerById(serverId);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    console.log(`📝 Generating AI review for ${server.name}...`);
    const review = await mcpReputationService.generateReview(serverId);

    res.json({
      success: true,
      serverId,
      serverName: server.name,
      review,
    });
  } catch (error: any) {
    console.error('Review generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Full reputation update (discover + review + score)
router.post('/servers/:serverId/update-reputation', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    
    console.log(`🔄 Updating full reputation for server ${serverId}...`);
    const result = await mcpReputationService.updateServerReputation(serverId);

    res.json({
      success: true,
      serverId,
      ...result,
    });
  } catch (error: any) {
    console.error('Reputation update failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch update all server reputations (admin endpoint)
router.post('/update-all-reputations', async (req: Request, res: Response) => {
  try {
    console.log(`🔄 Starting batch reputation update...`);
    await mcpReputationService.updateAllReputations();

    res.json({
      success: true,
      message: 'All server reputations updated',
    });
  } catch (error: any) {
    console.error('Batch update failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
