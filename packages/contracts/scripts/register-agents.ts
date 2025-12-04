import { ethers } from "hardhat";

async function main() {
  const REGISTRY_ADDRESS = "0x8A8C21EaA055e1B26D79F33DCA065e7b5DcefE6B";
  
  console.log("\n🤖 Registering Remaining Agents\n");
  
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = AgentRegistry.attach(REGISTRY_ADDRESS);
  
  const agents = [
    {
      wallet: "0x2222222222222222222222222222222222222222",
      uri: "https://raw.githubusercontent.com/travelwise/agent-cards/main/weather-optimizer.json",
      name: "Weather & Route Optimizer",
    },
    {
      wallet: "0x3333333333333333333333333333333333333333",
      uri: "https://raw.githubusercontent.com/travelwise/agent-cards/main/local-guide.json",
      name: "Local Guide Assistant",
    },
  ];

  for (let i = 0; i < agents.length; i++) {
    console.log(`\n${i + 1}. Registering: ${agents[i].name}`);
    console.log(`   Wallet:   ${agents[i].wallet}`);
    
    try {
      const tx = await registry.registerAgent(agents[i].wallet, agents[i].uri, {
        gasLimit: 500000,
      });
      console.log(`   TX:       ${tx.hash}`);
      
      const receipt = await tx.wait(2);
      console.log(`   ✅ Registered (Block: ${receipt?.blockNumber})`);
      
      // Wait 5 seconds between registrations
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  const totalAgents = await registry.totalAgents();
  console.log(`\n✅ Total Agents: ${totalAgents}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
