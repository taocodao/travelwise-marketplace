import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying X402 Payment System to Base Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy MockUSDC
  console.log("📝 Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ MockUSDC deployed to:", usdcAddress);

  // Mint initial USDC to deployer
  console.log("\n💰 Minting 1000 USDC to deployer...");
  const mintTx = await usdc.mint(deployer.address, ethers.parseUnits("1000", 6));
  await mintTx.wait();
  console.log("✅ Minted 1000 USDC");

  // Deploy X402PaymentProcessor
  console.log("\n📝 Deploying X402PaymentProcessor...");
  const platformWallet = deployer.address;
  const X402PaymentProcessor = await ethers.getContractFactory("X402PaymentProcessor");
  const paymentProcessor = await X402PaymentProcessor.deploy(usdcAddress, platformWallet);
  await paymentProcessor.waitForDeployment();
  const processorAddress = await paymentProcessor.getAddress();
  console.log("✅ X402PaymentProcessor deployed to:", processorAddress);

  console.log("\n📋 Deployment Summary:");
  console.log("====================");
  console.log("Network: Base Sepolia");
  console.log("MockUSDC:", usdcAddress);
  console.log("X402PaymentProcessor:", processorAddress);
  console.log("Platform Wallet:", platformWallet);
  
  console.log("\n🔗 Add these to packages/api/.env:");
  console.log("====================");
  console.log(`USDC_CONTRACT_ADDRESS=${usdcAddress}`);
  console.log(`X402_PAYMENT_PROCESSOR=${processorAddress}`);
  console.log(`BASE_SEPOLIA_RPC_URL=https://sepolia.base.org`);

  console.log("\n✅ Deployment complete!");
  console.log("\n🎯 Next steps:");
  console.log("1. Copy contract addresses to .env");
  console.log("2. Get testnet USDC: usdc.faucet() from any wallet");
  console.log("3. Restart API server");
  console.log("4. Test payment flow in frontend");
  
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
