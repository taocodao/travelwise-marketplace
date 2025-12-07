import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAITables() {
  try {
    console.log('🧪 Testing AI Agent tables...\n');

    // Test 1: ConversationExample
    const example = await prisma.conversationExample.create({
      data: {
        question: 'What are the best hotels in Tokyo?',
        answer: 'Tokyo has many excellent hotels including the Park Hyatt, Aman Tokyo, and Conrad Tokyo.',
        category: 'hotel',
        language: 'en',
        source: 'user',
      },
    });
    console.log('✅ ConversationExample created:', example.id);

    // Test 2: AgentTransaction
    const tx = await prisma.agentTransaction.create({
      data: {
        type: 'INCOMING',
        from: 'user-test-123',
        to: 'agent-wallet-0x123',
        amount: 0.05,
        service: 'AI Agent Query',
        description: 'Test AI agent transaction for Tokyo trip planning',
        status: 'COMPLETED',
      },
    });
    console.log('✅ AgentTransaction created:', tx.id);

    // Test 3: AgentExecution
    const execution = await prisma.agentExecution.create({
      data: {
        userId: 'user-test-123',
        sessionId: 'session-' + Date.now(),
        query: 'Plan a 3-day trip to Tokyo',
        plan: { 
          steps: [
            'Search for hotels in Tokyo',
            'Get weather forecast',
            'Plan itinerary'
          ] 
        },
        mcpCalls: [
          { server: 'google-maps', tool: 'search_places', cost: 0.02 },
          { server: 'weather', tool: 'get_forecast', cost: 0.01 }
        ],
        perplexitySearch: { 
          query: 'Best things to do in Tokyo',
          answer: 'Tokyo offers amazing experiences including visiting temples, trying local cuisine, and exploring modern districts.'
        },
        totalCostOut: 0.03,
        totalCostIn: 0.05,
        profit: 0.02,
        response: 'Here is your comprehensive 3-day Tokyo travel plan with hotel recommendations and weather forecasts.',
      },
    });
    console.log('✅ AgentExecution created:', execution.id);

    // Test 4: ChatLog
    const chat = await prisma.chatLog.create({
      data: {
        sessionId: 'session-' + Date.now(),
        userId: 'user-test-123',
        role: 'user',
        message: 'I want to visit Tokyo next month',
        metadata: { 
          timestamp: new Date().toISOString(),
          userAgent: 'Test Browser'
        },
      },
    });
    console.log('✅ ChatLog created:', chat.id);

    // Test 5: FeedbackLog
    const feedback = await prisma.feedbackLog.create({
      data: {
        sessionId: 'session-' + Date.now(),
        userQuery: 'What hotels in Tokyo?',
        botResponse: 'Here are top hotels: Park Hyatt, Aman Tokyo...',
        rating: 5,
        helpful: true,
      },
    });
    console.log('✅ FeedbackLog created:', feedback.id);

    console.log('\n🎉 All AI agent tables working perfectly!\n');
    console.log('📊 Summary:');
    console.log('  - ConversationExample: stores Q&A for RAG');
    console.log('  - AgentTransaction: tracks payments');
    console.log('  - AgentExecution: logs AI agent operations');
    console.log('  - ChatLog: conversation history');
    console.log('  - FeedbackLog: user feedback for learning');
    console.log('\n✨ Your AI Travel Agent database is ready!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAITables();
