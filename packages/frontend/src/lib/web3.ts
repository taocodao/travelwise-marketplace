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

// Contract addresses
export const PAYMENT_CONTRACT_ADDRESS = '0x...'; // Deploy and add your contract address
export const USDC_CONTRACT_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC

// ABIs
export const USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

export const PAYMENT_CONTRACT_ABI = [
  'function processPayment(address serverAddress, uint256 amount, string memory toolName, string memory mcpServer) external',
  'function batchPayment(address[] memory servers, uint256[] memory amounts, string[] memory toolNames, string[] memory mcpServers) external'
];
