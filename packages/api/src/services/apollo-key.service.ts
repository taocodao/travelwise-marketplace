// packages/api/src/services/apollo-key.service.ts - Apollo API Key Management Service

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive data
 */
function encrypt(text: string): string {
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return: iv + authTag + encrypted
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
function decrypt(encryptedData: string): string {
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

export class ApolloKeyService {
    /**
     * Save or update API key for a user wallet + MCP server wallet combination
     */
    static async saveApiKey(params: {
        userWalletAddress: string;
        mcpServerWalletAddress: string;
        mcpServerName: string;
        apiKey: string;
        keyName?: string;
    }): Promise<{ success: boolean; message: string }> {
        try {
            const encryptedKey = encrypt(params.apiKey);
            
            // First, deactivate any existing keys for this combination
            await prisma.apolloApiKey.updateMany({
                where: {
                    userWalletAddress: params.userWalletAddress,
                    mcpServerWalletAddress: params.mcpServerWalletAddress,
                    isActive: true,
                },
                data: {
                    isActive: false,
                },
            });
            
            // Create new key
            await prisma.apolloApiKey.create({
                data: {
                    userWalletAddress: params.userWalletAddress,
                    mcpServerWalletAddress: params.mcpServerWalletAddress,
                    mcpServerName: params.mcpServerName,
                    encryptedKey,
                    keyName: params.keyName || `${params.mcpServerName} API Key`,
                    isActive: true,
                },
            });
            
            return {
                success: true,
                message: `${params.mcpServerName} API key saved successfully`,
            };
        } catch (error: any) {
            console.error('[ApolloKeyService] Error saving API key:', error);
            return {
                success: false,
                message: `Failed to save API key: ${error.message}`,
            };
        }
    }
    
    /**
     * Get active API key by user wallet + MCP server wallet
     */
    static async getActiveApiKey(
        userWalletAddress: string,
        mcpServerWalletAddress: string
    ): Promise<string | null> {
        try {
            const keyRecord = await prisma.apolloApiKey.findFirst({
                where: {
                    userWalletAddress,
                    mcpServerWalletAddress,
                    isActive: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            
            if (!keyRecord) {
                return null;
            }
            
            // Update last used timestamp
            await prisma.apolloApiKey.update({
                where: { id: keyRecord.id },
                data: { lastUsedAt: new Date() },
            });
            
            return decrypt(keyRecord.encryptedKey);
        } catch (error: any) {
            console.error('[ApolloKeyService] Error getting API key:', error);
            return null;
        }
    }
    
    /**
     * Get active key by wallet address + MCP server
     */
    static async getActiveApiKeyByWallet(walletAddress: string, mcpServerId: string): Promise<string | null> {
        try {
            const keyRecord = await prisma.apolloApiKey.findFirst({
                where: {
                    walletAddress,
                    mcpServerId,
                    isActive: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            
            if (!keyRecord) {
                return null;
            }
            
            // Update last used timestamp
            await prisma.apolloApiKey.update({
                where: { id: keyRecord.id },
                data: { lastUsedAt: new Date() },
            });
            
            return decrypt(keyRecord.encryptedKey);
        } catch (error: any) {
            console.error('[ApolloKeyService] Error getting API key by wallet:', error);
            return null;
        }
    }
    
    /**
     * Get masked key info (for display purposes)
     */
    static async getKeyInfo(
        userWalletAddress: string,
        mcpServerWalletAddress: string
    ): Promise<{
        hasKey: boolean;
        keyName?: string;
        maskedKey?: string;
        lastUsedAt?: Date;
    }> {
        try {
            const keyRecord = await prisma.apolloApiKey.findFirst({
                where: {
                    userWalletAddress,
                    mcpServerWalletAddress,
                    isActive: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            
            if (!keyRecord) {
                return { hasKey: false };
            }
            
            const decryptedKey = decrypt(keyRecord.encryptedKey);
            const maskedKey = decryptedKey.substring(0, 8) + '...' + decryptedKey.substring(decryptedKey.length - 4);
            
            return {
                hasKey: true,
                keyName: keyRecord.keyName || undefined,
                maskedKey,
                lastUsedAt: keyRecord.lastUsedAt || undefined,
            };
        } catch (error: any) {
            console.error('[ApolloKeyService] Error getting key info:', error);
            return { hasKey: false };
        }
    }
    
    /**
     * Delete API key for user + MCP server
     */
    static async deleteApiKey(
        userWalletAddress: string,
        mcpServerWalletAddress: string
    ): Promise<{ success: boolean; message: string }> {
        try {
            await prisma.apolloApiKey.updateMany({
                where: {
                    userWalletAddress,
                    mcpServerWalletAddress,
                    isActive: true,
                },
                data: {
                    isActive: false,
                },
            });
            
            return {
                success: true,
                message: 'API key deleted successfully',
            };
        } catch (error: any) {
            console.error('[ApolloKeyService] Error deleting API key:', error);
            return {
                success: false,
                message: `Failed to delete API key: ${error.message}`,
            };
        }
    }
}
