import { AITravelAgent } from './services/ai-agent';

const agent = new AITravelAgent();

async function testPerplexity() {
  console.log('🔍 Testing Perplexity Integration\n');

  // Test 1: Query needing current information
  console.log('📍 TEST 1: Current Events Query\n');
  const result1 = await agent.processQuery({
    userId: 'test-user-perplexity',
    sessionId: 'session-perplexity-1',
    query: 'What are the current travel restrictions and COVID requirements for visiting Japan in December 2025?',
    usePerplexity: true,
  });

  console.log('\n📝 Response:', result1.response.substring(0, 400) + '...');
  console.log('\n🔍 Perplexity Used:', result1.perplexityUsed ? 'YES ✅' : 'NO ❌');
  if (result1.perplexityInsights) {
    console.log('📚 Sources:', result1.perplexityInsights.slice(0, 3));
  }
  console.log('\n💰 Cost:', result1.cost);

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: Latest hotel information
  console.log('\n\n' + '='.repeat(60));
  console.log('📍 TEST 2: Latest Hotel Openings\n');
  const result2 = await agent.processQuery({
    userId: 'test-user-perplexity',
    sessionId: 'session-perplexity-2',
    query: 'What are the newest luxury hotels that opened in Tokyo in 2025?',
    usePerplexity: true,
  });

  console.log('\n📝 Response:', result2.response.substring(0, 400) + '...');
  console.log('\n🔍 Perplexity Used:', result2.perplexityUsed ? 'YES ✅' : 'NO ❌');
  console.log('\n💰 Cost:', result2.cost);

  console.log('\n\n✅ Perplexity integration test complete!');
  process.exit(0);
}

testPerplexity();
