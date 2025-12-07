import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  try {
    console.log('🔍 Checking for duplicate wallet addresses...');
    
    // Find all MCP servers
    const servers = await prisma.mCPServer.findMany({
      select: {
        id: true,
        name: true,
        walletAddress: true,
      },
    });
    
    console.log(`Found ${servers.length} MCP servers`);
    
    // Group by wallet address
    const walletGroups = servers.reduce((acc: any, server) => {
      const wallet = server.walletAddress || 'null';
      if (!acc[wallet]) acc[wallet] = [];
      acc[wallet].push(server);
      return acc;
    }, {});
    
    // Find duplicates
    const duplicates = Object.entries(walletGroups).filter(([wallet, servers]: any) => 
      servers.length > 1 && wallet !== 'null'
    );
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    console.log(`⚠️  Found ${duplicates.length} duplicate wallet addresses:`);
    
    for (const [wallet, servers] of duplicates as any) {
      console.log(`\n  Wallet: ${wallet}`);
      console.log(`  Servers:`, servers.map((s: any) => s.name).join(', '));
      
      // Keep first server, nullify others
      const [keep, ...remove] = servers;
      console.log(`  Keeping: ${keep.name}`);
      console.log(`  Updating: ${remove.map((s: any) => s.name).join(', ')}`);
      
      for (const server of remove) {
        await prisma.mCPServer.update({
          where: { id: server.id },
          data: { 
            walletAddress: null  // or generate unique address
          },
        });
        console.log(`    ✓ Updated ${server.name}`);
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicates();
