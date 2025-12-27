import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying MCP Payment System to Base Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy MockUSDC first
  console.log("📝 Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ MockUSDC deployed to:", usdcAddress);

  // Mint some USDC to deployer
  console.log("\n💰 Minting 1000 USDC to deployer...");
  const mintTx = await usdc.mint(deployer.address, ethers.parseUnits("1000", 6));
  await mintTx.wait();
  console.log("✅ Minted 1000 USDC");

  // Deploy MCPPaymentProcessor
  console.log("\n📝 Deploying MCPPaymentProcessor...");
  const MCPPaymentProcessor = await ethers.getContractFactory("MCPPaymentProcessor");
  const paymentProcessor = await MCPPaymentProcessor.deploy(usdcAddress);
  await paymentProcessor.waitForDeployment();
  const processorAddress = await paymentProcessor.getAddress();
  console.log("✅ MCPPaymentProcessor deployed to:", processorAddress);

  // Register semantic location server
  const serverWallet = "0x8A5c2d9999b4b4E8C3F2a1B7D6E5C4A3B2D1E0F9"; // MCP server wallet
  console.log("\n📝 Registering semantic location server...");
  const registerTx = await paymentProcessor.registerServer(serverWallet, "Semantic Location Search");
  await registerTx.wait();
  console.log("✅ Server registered:", serverWallet);

  console.log("\n📋 Deployment Summary:");
  console.log("====================");
  console.log("Network: Base Sepolia");
  console.log("MockUSDC:", usdcAddress);
  console.log("MCPPaymentProcessor:", processorAddress);
  console.log("Registered Server:", serverWallet);
  
  console.log("\n🔗 Add these to packages/api/.env:");
  console.log("====================");
  console.log(`USDC_CONTRACT_ADDRESS=${usdcAddress}`);
  console.log(`MCP_PAYMENT_PROCESSOR=${processorAddress}`);
  console.log(`MCP_SERVER_WALLET=${serverWallet}`);
  console.log(`BASE_SEPOLIA_RPC_URL=https://sepolia.base.org`);

  console.log("\n✅ Deployment complete!");
  console.log("\n🎯 Next steps:");
  console.log("1. Copy contract addresses to .env");
  console.log("2. Get testnet USDC: usdc.faucet()");
  console.log("3. Restart API server");
  console.log("4. Test payment flow");
  
  console.log("\n🔍 Verify on BaseScan:");
  console.log(`https://sepolia.basescan.org/address/${usdcAddress}`);
  console.log(`https://sepolia.basescan.org/address/${processorAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
