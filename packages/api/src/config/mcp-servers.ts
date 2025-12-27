// packages/api/src/config/mcp-servers.ts - MCP Server Configuration

/**
 * MCP Server wallet addresses and metadata
 * Each MCP server has its own wallet address for X402 payments
 */

export const MCP_SERVERS = {
    APOLLO: {
        walletAddress: '0x8A5c2d9999b4b4E8C3F2a1B7D6E5C4A3B2D1E0F9',
        name: 'Apollo',
        description: 'B2B Lead Generation & Enrichment',
    },
    GOOGLE_MAPS: {
        walletAddress: '0x7B4c3e8888a3a3D7B2E1a6C5D4C3B2A1D0E9F8',
        name: 'Google Maps',
        description: 'Location Search & Data',
    },
    // Add more MCP servers here
} as const;

export type MCPServerKey = keyof typeof MCP_SERVERS;
