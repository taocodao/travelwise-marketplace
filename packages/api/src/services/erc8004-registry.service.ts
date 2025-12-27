/**
 * ERC-8004 Registry Service
 * 
 * Database-backed implementation of ERC-8004 on-chain registry protocol.
 * Provides MCP server registration, discovery, and ownership verification.
 * 
 * This mimics the on-chain ERC-8004 spec but stores data in PostgreSQL
 * for faster queries and easier development.
 */

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

export interface RegisterServerInput {
  name: string;
  displayName?: string;
  description: string;
  endpoint: string;
  walletAddress: string;
  agentId: string;
  category?: string;
  capabilities?: string[];
  pricing?: Record<string, number>;
  metadataUri?: string;
}

export interface ServerRegistration {
  id: string;
  serverId: string;
  name: string;
  displayName?: string;
  description: string;
  endpoint: string;
  walletAddress: string;
  category?: string;
  capabilities?: string[];
  pricing?: Record<string, number>;
  chainId: number;
  registeredAt: Date;
}

export interface DiscoveryQuery {
  category?: string;
  capabilities?: string[];
  minTools?: number;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export class ERC8004RegistryService {
  private chainId: number;

  constructor() {
    // Base Sepolia testnet
    this.chainId = 84532;
    console.log('✅ ERC-8004 Registry Service initialized (database-backed)');
  }

  /**
   * Register a new MCP server in the registry
   * Mimics on-chain registration
   */
  async registerServer(input: RegisterServerInput): Promise<ServerRegistration> {
    // Validate wallet address
    if (!ethers.isAddress(input.walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    // Create or update MCP server
    const mcpServer = await prisma.mCPServer.upsert({
      where: { name: input.name },
      update: {
        displayName: input.displayName,
        description: input.description,
        endpoint: input.endpoint,
        walletAddress: input.walletAddress,
        category: input.category,
        status: 'ACTIVE',
        visibility: 'PUBLIC',
        updatedAt: new Date(),
      },
      create: {
        name: input.name,
        displayName: input.displayName,
        description: input.description,
        endpoint: input.endpoint,
        walletAddress: input.walletAddress,
        category: input.category,
        agentId: input.agentId,
        status: 'ACTIVE',
        visibility: 'PUBLIC',
      },
    });

    // Create ERC-8004 registry entry
    const registry = await prisma.eRC8004Registry.upsert({
      where: { serverId: mcpServer.id },
      update: {
        agentAddress: input.walletAddress,
        metadataUri: input.metadataUri,
        capabilities: input.capabilities || [],
        paymentProtocol: 'X402',
        chainId: this.chainId,
        updatedAt: new Date(),
      },
      create: {
        serverId: mcpServer.id,
        agentAddress: input.walletAddress,
        metadataUri: input.metadataUri,
        capabilities: input.capabilities || [],
        paymentProtocol: 'X402',
        chainId: this.chainId,
      },
    });

    console.log(`📝 Registered MCP server: ${input.name} (wallet: ${input.walletAddress})`);

    return {
      id: registry.id,
      serverId: mcpServer.id,
      name: mcpServer.name,
      displayName: mcpServer.displayName || undefined,
      description: mcpServer.description,
      endpoint: mcpServer.endpoint,
      walletAddress: mcpServer.walletAddress || '',
      category: mcpServer.category || undefined,
      capabilities: (registry.capabilities as string[]) || [],
      chainId: registry.chainId,
      registeredAt: registry.registeredAt,
    };
  }

  /**
   * Discover MCP servers by criteria
   */
  async discoverServers(query: DiscoveryQuery = {}): Promise<ServerRegistration[]> {
    const { category, capabilities, minTools, isActive = true, limit = 50, offset = 0 } = query;

    const where: any = {
      status: isActive ? 'ACTIVE' : undefined,
      visibility: 'PUBLIC',
    };

    if (category) {
      where.category = category;
    }

    const servers = await prisma.mCPServer.findMany({
      where,
      include: {
        erc8004Registry: true,
        tools: true,
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    // Filter by capabilities if specified
    let filtered = servers;
    if (capabilities && capabilities.length > 0) {
      filtered = servers.filter(server => {
        const serverCapabilities = (server.erc8004Registry?.capabilities as string[]) || [];
        return capabilities.some(cap => serverCapabilities.includes(cap));
      });
    }

    // Filter by minimum tools
    if (minTools) {
      filtered = filtered.filter(server => server.tools.length >= minTools);
    }

    return filtered.map(server => ({
      id: server.erc8004Registry?.id || server.id,
      serverId: server.id,
      name: server.name,
      displayName: server.displayName || undefined,
      description: server.description,
      endpoint: server.endpoint,
      walletAddress: server.walletAddress || '',
      category: server.category || undefined,
      capabilities: (server.erc8004Registry?.capabilities as string[]) || [],
      chainId: server.erc8004Registry?.chainId || this.chainId,
      registeredAt: server.erc8004Registry?.registeredAt || server.createdAt,
    }));
  }

  /**
   * Get server by wallet address
   */
  async getServerByWallet(walletAddress: string): Promise<ServerRegistration | null> {
    const server = await prisma.mCPServer.findFirst({
      where: {
        walletAddress: walletAddress.toLowerCase(),
        status: 'ACTIVE',
      },
      include: {
        erc8004Registry: true,
      },
    });

    if (!server) return null;

    return {
      id: server.erc8004Registry?.id || server.id,
      serverId: server.id,
      name: server.name,
      displayName: server.displayName || undefined,
      description: server.description,
      endpoint: server.endpoint,
      walletAddress: server.walletAddress || '',
      category: server.category || undefined,
      capabilities: (server.erc8004Registry?.capabilities as string[]) || [],
      chainId: server.erc8004Registry?.chainId || this.chainId,
      registeredAt: server.erc8004Registry?.registeredAt || server.createdAt,
    };
  }

  /**
   * Get server by ID
   */
  async getServerById(serverId: string): Promise<ServerRegistration | null> {
    const server = await prisma.mCPServer.findUnique({
      where: { id: serverId },
      include: {
        erc8004Registry: true,
        tools: true,
      },
    });

    if (!server) return null;

    return {
      id: server.erc8004Registry?.id || server.id,
      serverId: server.id,
      name: server.name,
      displayName: server.displayName || undefined,
      description: server.description,
      endpoint: server.endpoint,
      walletAddress: server.walletAddress || '',
      category: server.category || undefined,
      capabilities: (server.erc8004Registry?.capabilities as string[]) || [],
      pricing: server.tools.reduce((acc, tool) => {
        acc[tool.name] = parseFloat(tool.baseCost.toString());
        return acc;
      }, {} as Record<string, number>),
      chainId: server.erc8004Registry?.chainId || this.chainId,
      registeredAt: server.erc8004Registry?.registeredAt || server.createdAt,
    };
  }

  /**
   * Verify server ownership using EIP-712 signature
   */
  async verifyOwnership(
    serverId: string,
    ownerAddress: string,
    signature: string
  ): Promise<boolean> {
    try {
      const server = await prisma.mCPServer.findUnique({
        where: { id: serverId },
      });

      if (!server) {
        throw new Error('Server not found');
      }

      // Create EIP-712 message for ownership verification
      const domain = {
        name: 'ERC8004Registry',
        version: '1',
        chainId: this.chainId,
      };

      const types = {
        OwnershipVerification: [
          { name: 'serverId', type: 'string' },
          { name: 'owner', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
        ],
      };

      // For demo purposes, we'll do a simple signature recovery
      // In production, you'd use full EIP-712 verification
      const message = `I own MCP server: ${serverId}`;
      const recoveredAddress = ethers.verifyMessage(message, signature);

      const isOwner = 
        recoveredAddress.toLowerCase() === ownerAddress.toLowerCase() &&
        server.walletAddress?.toLowerCase() === ownerAddress.toLowerCase();

      return isOwner;
    } catch (error) {
      console.error('Ownership verification failed:', error);
      return false;
    }
  }

  /**
   * Update server registration
   */
  async updateServer(
    serverId: string,
    updates: Partial<RegisterServerInput>
  ): Promise<ServerRegistration | null> {
    const server = await prisma.mCPServer.findUnique({
      where: { id: serverId },
    });

    if (!server) return null;

    const updated = await prisma.mCPServer.update({
      where: { id: serverId },
      data: {
        displayName: updates.displayName,
        description: updates.description,
        endpoint: updates.endpoint,
        category: updates.category,
        updatedAt: new Date(),
      },
      include: {
        erc8004Registry: true,
      },
    });

    // Update registry if capabilities changed
    if (updates.capabilities && updated.erc8004Registry) {
      await prisma.eRC8004Registry.update({
        where: { id: updated.erc8004Registry.id },
        data: {
          capabilities: updates.capabilities,
          metadataUri: updates.metadataUri,
          updatedAt: new Date(),
        },
      });
    }

    return this.getServerById(serverId);
  }

  /**
   * Deactivate server (remove from registry)
   */
  async deactivateServer(serverId: string): Promise<boolean> {
    try {
      await prisma.mCPServer.update({
        where: { id: serverId },
        data: {
          status: 'INACTIVE',
          visibility: 'PRIVATE',
        },
      });

      console.log(`🔴 Deactivated MCP server: ${serverId}`);
      return true;
    } catch (error) {
      console.error('Failed to deactivate server:', error);
      return false;
    }
  }

  /**
   * Get registry statistics
   */
  async getStats() {
    const [totalServers, activeServers, categories] = await Promise.all([
      prisma.mCPServer.count(),
      prisma.mCPServer.count({ where: { status: 'ACTIVE', visibility: 'PUBLIC' } }),
      prisma.mCPServer.groupBy({
        by: ['category'],
        _count: true,
        where: { status: 'ACTIVE' },
      }),
    ]);

    return {
      totalServers,
      activeServers,
      categories: categories.map(c => ({
        category: c.category || 'uncategorized',
        count: c._count,
      })),
      chainId: this.chainId,
      network: 'base-sepolia',
    };
  }
}

export const erc8004RegistryService = new ERC8004RegistryService();
