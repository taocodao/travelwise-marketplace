import { AITravelAgent } from './services/ai-agent';

const agent = new AITravelAgent();

async function test() {
  console.log('🧪 Testing AI Travel Agent with MCP servers...\n');

  // Test 1: Hotel search with specific dates
  console.log('📍 TEST 1: Hotel Search with Dates\n');
  const result1 = await agent.processQuery({
    userId: 'test-user-123',
    sessionId: 'session-' + Date.now(),
    query: 'Search for hotels in Tokyo, Japan for December 20-25, 2025',
  });

  console.log('\n📝 Response:', result1.response.substring(0, 300) + '...');
  console.log('\n🔧 MCP Calls Made:');
  result1.mcpCalls.forEach(call => {
    console.log(`  - ${call.server}.${call.tool}: ${call.success ? '✅' : '❌'}`);
    console.log(`    Cost: $${call.cost}`);
  });
  console.log('\n💰 Total Cost:', result1.cost);

  // Wait a bit between requests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Weather forecast
  console.log('\n\n' + '='.repeat(60));
  console.log('📍 TEST 2: Weather Forecast\n');
  const result2 = await agent.processQuery({
    userId: 'test-user-123',
    sessionId: 'session-' + Date.now(),
    query: 'What will the weather be like in Tokyo for the next 5 days?',
  });

  console.log('\n📝 Response:', result2.response.substring(0, 300) + '...');
  console.log('\n🔧 MCP Calls Made:');
  result2.mcpCalls.forEach(call => {
    console.log(`  - ${call.server}.${call.tool}: ${call.success ? '✅' : '❌'}`);
    console.log(`    Cost: $${call.cost}`);
  });
  console.log('\n💰 Total Cost:', result2.cost);

  // Test 3: Combined query
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n\n' + '='.repeat(60));
  console.log('📍 TEST 3: Combined Hotel + Weather\n');
  const result3 = await agent.processQuery({
    userId: 'test-user-123',
    sessionId: 'session-' + Date.now(),
    query: 'Find hotels in Shibuya, Tokyo for December 20-23, 2025 and tell me the weather forecast',
  });

  console.log('\n📝 Response:', result3.response.substring(0, 300) + '...');
  console.log('\n🔧 MCP Calls Made:');
  result3.mcpCalls.forEach(call => {
    console.log(`  - ${call.server}.${call.tool}: ${call.success ? '✅' : '❌'}`);
    console.log(`    Cost: $${call.cost}`);
  });
  console.log('\n💰 Total Cost:', result3.cost);

  console.log('\n\n✅ All tests complete!');
  process.exit(0);
}

test().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
