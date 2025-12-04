import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n🚀 TravelWise Agent Registry Deployment\n");
  console.log("=" + "=".repeat(50) + "\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("📋 Deployment Configuration:");
  console.log("-".repeat(50));
  console.log(`Network:        Base Sepolia (Chain ID: 84532)`);
  console.log(`Deployer:       ${deployer.address}`);
  console.log(`Balance:        ${ethers.formatEther(balance)} ETH`);
  console.log(`Gas Price:      ${ethers.formatUnits(await ethers.provider.getFeeData().then(f => f.gasPrice || 0n), "gwei")} gwei\n`);

  // Check balance
  if (balance < ethers.parseEther("0.001")) {
    console.log("⚠️  WARNING: Low balance! Get testnet ETH from:");
    console.log("   https://www.coinbase.com/faucets/base-ethereum-goerli-faucet\n");
  }

  // Load existing contracts
  const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY_ADDRESS;
  const REPUTATION_REGISTRY = process.env.REPUTATION_REGISTRY_ADDRESS;
  const PAYMENT_ESCROW = process.env.PAYMENT_ESCROW_ADDRESS;

  console.log("🔗 Existing Contracts:");
  console.log("-".repeat(50));
  console.log(`Identity Registry:   ${IDENTITY_REGISTRY}`);
  console.log(`Reputation Registry: ${REPUTATION_REGISTRY}`);
  console.log(`Payment Escrow:      ${PAYMENT_ESCROW}\n`);

  // Deploy AgentRegistry
  console.log("📝 Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();

  console.log("⏳ Waiting for deployment transaction...");
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  const deployTx = registry.deploymentTransaction();

  console.log("✅ AgentRegistry deployed!\n");
  console.log("📍 Contract Details:");
  console.log("-".repeat(50));
  console.log(`Address:        ${registryAddress}`);
  console.log(`TX Hash:        ${deployTx?.hash}`);
  console.log(`Block Number:   ${deployTx?.blockNumber}`);
  console.log(`Gas Used:       ${deployTx?.gasLimit.toString()}`);
  console.log(`BaseScan:       https://sepolia.basescan.org/address/${registryAddress}\n`);

  // Wait for confirmations
  console.log("⏳ Waiting for 5 block confirmations...");
  await deployTx?.wait(5);
  console.log("✅ Confirmed!\n");

  // Register agents
  console.log("🤖 Registering AI Agents:");
  console.log("-".repeat(50));

  const agents = [
    {
      wallet: "0x1111111111111111111111111111111111111111",
      uri: "https://raw.githubusercontent.com/taocodao/travelwise-marketplace/main/agent-cards/travel-planning-expert.json",
      name: "Travel Planning Expert",
      description: "Specialized in personalized travel itineraries",
    },
    {
      wallet: "0x2222222222222222222222222222222222222222",
      uri: "https://raw.githubusercontent.com/taocodao/travelwise-marketplace/main/agent-cards/weather-optimizer.json",
      name: "Weather & Route Optimizer",
      description: "Real-time weather forecasts and route optimization",
    },
    {
      wallet: "0x3333333333333333333333333333333333333333",
      uri: "https://raw.githubusercontent.com/taocodao/travelwise-marketplace/main/agent-cards/local-guide.json",
      name: "Local Guide Assistant",
      description: "Local attractions and hidden gems recommendations",
    },
  ];

  const registeredAgents = [];

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    console.log(`\n${i + 1}. Registering: ${agent.name}`);
    console.log(`   Wallet:   ${agent.wallet}`);
    console.log(`   Metadata: ${agent.uri}`);

    try {
      const tx = await registry.registerAgent(agent.wallet, agent.uri);
      console.log(`   TX:       ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`   ✅ Registered (Block: ${receipt?.blockNumber})`);

      registeredAgents.push({
        id: i + 1,
        name: agent.name,
        description: agent.description,
        wallet: agent.wallet,
        tokenURI: agent.uri,
        txHash: tx.hash,
      });
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  const totalAgents = await registry.totalAgents();
  console.log(`\n✅ Total Agents Registered: ${totalAgents}\n`);

  // Save deployment info
  const deploymentInfo = {
    network: "baseSepolia",
    chainId: 84532,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    gasUsed: deployTx?.gasLimit.toString(),
    contracts: {
      existingContracts: {
        identityRegistry: IDENTITY_REGISTRY,
        reputationRegistry: REPUTATION_REGISTRY,
        paymentEscrow: PAYMENT_ESCROW,
      },
      newContracts: {
        agentRegistry: {
          address: registryAddress,
          txHash: deployTx?.hash,
          blockNumber: deployTx?.blockNumber,
          basescan: `https://sepolia.basescan.org/address/${registryAddress}`,
        },
      },
    },
    agents: registeredAgents,
  };

  // Create deployments directory
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `agent-registry-${timestamp}.json`;
  const filepath = path.join(deploymentsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("💾 Deployment Info Saved:");
  console.log("-".repeat(50));
  console.log(`File: deployments/${filename}\n`);

  // Update .env file suggestion
  console.log("📝 Update Your .env File:");
  console.log("-".repeat(50));
  console.log(`AGENT_REGISTRY_ADDRESS=${registryAddress}\n`);

  // Verification instructions
  console.log("🔍 Verify Contract on BaseScan:");
  console.log("-".repeat(50));
  console.log(`npx hardhat verify --network baseSepolia ${registryAddress}\n`);

  // Integration instructions
  console.log("🔗 Integration Steps:");
  console.log("-".repeat(50));
  console.log("1. Copy the AGENT_REGISTRY_ADDRESS to your .env file");
  console.log("2. Update packages/api/.env with the registry address");
  console.log("3. Restart your API server to load the new address");
  console.log("4. Test agent discovery with: npm run test:agents\n");

  console.log("🎉 Deployment Complete!\n");
  console.log("=" + "=".repeat(50) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment Failed:");
    console.error("-".repeat(50));
    console.error(error);
    process.exit(1);
  });
