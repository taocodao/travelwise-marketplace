import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkWalletConfig() {
  try {
    console.log('🔍 Checking wallet_config table...\n');
    
    const configs = await prisma.$queryRaw<any[]>`
      SELECT * FROM wallet_config;
    `;
    
    console.log(`Found ${configs.length} wallet config(s):`);
    configs.forEach((config, i) => {
      console.log(`\n${i + 1}.`);
      console.log(`   ID: ${config.id}`);
      console.log(`   Operator Wallet: ${config.operator_wallet || config.operatorWallet || 'N/A'}`);
      console.log(`   Escrow Contract: ${config.escrow_contract || config.escrowContract || 'N/A'}`);
    });
    
    // Check for duplicates
    const wallets = configs.map(c => c.operator_wallet || c.operatorWallet).filter(Boolean);
    const duplicates = wallets.filter((item, index) => wallets.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  Found duplicate operator_wallet values:');
      duplicates.forEach(d => console.log(`   - ${d}`));
      console.log('\n⚠️  You need to fix these before adding unique constraint.');
    } else {
      console.log('\n✅ No duplicates found! Safe to proceed.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWalletConfig();
