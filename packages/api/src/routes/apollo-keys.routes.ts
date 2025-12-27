// packages/api/src/routes/apollo-keys.routes.ts - Apollo API Key Management Routes

import { Router, Request, Response } from 'express';
import { ApolloKeyService } from '../services/apollo-key.service';
import { MCP_SERVERS } from '../config/mcp-servers';

const router = Router();

/**
 * Save API key for user + MCP server
 * POST /api/apollo-keys
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { userWalletAddress, mcpServerKey, apiKey, keyName } = req.body;
        
        if (!userWalletAddress || !mcpServerKey || !apiKey) {
            res.status(400).json({
                success: false,
                message: 'userWalletAddress, mcpServerKey, and apiKey are required',
            });
            return;
        }
        
        // Look up MCP server info
        const mcpServer = MCP_SERVERS[mcpServerKey as keyof typeof MCP_SERVERS];
        if (!mcpServer) {
            res.status(400).json({
                success: false,
                message: `Invalid MCP server: ${mcpServerKey}`,
            });
            return;
        }
        
        const result = await ApolloKeyService.saveApiKey({
            userWalletAddress,
            mcpServerWalletAddress: mcpServer.walletAddress,
            mcpServerName: mcpServer.name,
            apiKey,
            keyName,
        });
        
        res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
        console.error('[Apollo Keys] Error saving key:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save API key',
        });
    }
});

/**
 * Get API key info (masked)
 * GET /api/apollo-keys/:userWalletAddress/:mcpServerKey
 */
router.get('/:userWalletAddress/:mcpServerKey', async (req: Request, res: Response) => {
    try {
        const { userWalletAddress, mcpServerKey } = req.params;
        
        const mcpServer = MCP_SERVERS[mcpServerKey as keyof typeof MCP_SERVERS];
        if (!mcpServer) {
            res.status(400).json({
                hasKey: false,
                error: `Invalid MCP server: ${mcpServerKey}`,
            });
            return;
        }
        
        const keyInfo = await ApolloKeyService.getKeyInfo(
            userWalletAddress,
            mcpServer.walletAddress
        );
        
        res.json(keyInfo);
    } catch (error: any) {
        console.error('[Apollo Keys] Error getting key info:', error);
        res.status(500).json({
            hasKey: false,
            error: 'Failed to get key info',
        });
    }
});

/**
 * Delete API key
 * DELETE /api/apollo-keys/:userWalletAddress/:mcpServerKey
 */
router.delete('/:userWalletAddress/:mcpServerKey', async (req: Request, res: Response) => {
    try {
        const { userWalletAddress, mcpServerKey } = req.params;
        
        const mcpServer = MCP_SERVERS[mcpServerKey as keyof typeof MCP_SERVERS];
        if (!mcpServer) {
            res.status(400).json({
                success: false,
                message: `Invalid MCP server: ${mcpServerKey}`,
            });
            return;
        }
        
        const result = await ApolloKeyService.deleteApiKey(
            userWalletAddress,
            mcpServer.walletAddress
        );
        
        res.json(result);
    } catch (error: any) {
        console.error('[Apollo Keys] Error deleting key:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete API key',
        });
    }
});

export default router;
