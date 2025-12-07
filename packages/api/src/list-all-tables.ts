import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listTables() {
  try {
    const tables = await prisma.$queryRaw<any[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('📊 All tables in database:\n');
    tables.forEach((t, i) => console.log(`  ${i + 1}. ${t.table_name}`));
    console.log(`\n✅ Total: ${tables.length} tables\n`);
    
    const expectedNewTables = [
      'chat_logs',
      'conversation_examples',
      'user_preferences',
      'feedback_logs',
      'agent_transactions',
      'agent_executions'
    ];
    
    console.log('🔍 Checking for new AI Agent tables:\n');
    expectedNewTables.forEach(tableName => {
      const exists = tables.find(t => t.table_name === tableName);
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listTables();
