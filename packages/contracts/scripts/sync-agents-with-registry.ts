import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

const AGENT_REGISTRY_ADDRESS = '0x8A8C21EaA055e1B26D79F33DCA065e7b5DcefE6B';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

const ABI = [
  "function totalAgents() view returns (uint256)",
  "function getAgentInfo(uint256) view returns (address wallet, string uri, uint256 reputation, uint256 executions, bool active)",
];

async function main() {
  console.log('🔄 Syncing agents with on-chain registry...\n');

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const registry = new ethers.Contract(AGENT_REGISTRY_ADDRESS, ABI, provider);

  const totalAgents = await registry.totalAgents();
  console.log(`Found ${totalAgents} agents on-chain\n`);

  const agentNames = [
    'Travel Planning Expert',
    'Weather & Route Optimizer',
    'Local Guide Assistant',
  ];

  for (let i = 1; i <= Number(totalAgents); i++) {
    const [wallet, uri, reputation, executions, active] = await registry.getAgentInfo(i);

    console.log(`Agent #${i}: ${agentNames[i - 1]}`);
    console.log(`  Wallet: ${wallet}`);
    console.log(`  URI: ${uri}`);
    console.log(`  Reputation: ${reputation}`);
    console.log(`  Active: ${active}\n`);

    // Update or create agent in database
    await prisma.agent.upsert({
      where: { onChainId: i },
      update: {
        walletAddress: wallet,
        metadataUri: uri,
        isActive: active,
      },
      create: {
        onChainId: i,
        name: agentNames[i - 1] || `Agent #${i}`,
        walletAddress: wallet,
        metadataUri: uri,
        isActive: active,
      },
    });
  }

  console.log('✅ Database synced with on-chain registry!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
