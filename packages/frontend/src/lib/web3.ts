// frontend/src/lib/web3.ts
import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    walletConnect({ projectId })
  ],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org')
  }
});

// Contract addresses (Base Sepolia - Deployed)
export const USDC_CONTRACT_ADDRESS = '0xa8d37A56DA745c511515535388d10915C4F639b4'; // MockUSDC
export const PAYMENT_CONTRACT_ADDRESS = '0x473B2D40654F665E1cb0fa069922B64B69fFaE38'; // MCPPaymentProcessor

// MCP Server Wallet Addresses - Each server has its own unique wallet
export const MCP_SERVER_WALLETS = {
  SEMANTIC_LOCATION: '0x3333333333333333333333333333333333333333', // Semantic Search Server
  GOOGLE_MAPS: '0x1111111111111111111111111111111111111111', // Google Maps Server
  WEATHER_API: '0x2222222222222222222222222222222222222222', // Weather API Server
} as const;

// ABIs
export const USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)'
];

export const PAYMENT_CONTRACT_ABI = [
  'function processPayment(address serverAddress, uint256 amount, string memory toolName, string memory mcpServer) external',
  'function registerServer(address serverAddress, string memory serverName) external',
  'function serverEarnings(address) external view returns (uint256)',
  'function registeredServers(address) external view returns (bool)'
];
