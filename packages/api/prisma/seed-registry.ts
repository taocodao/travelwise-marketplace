import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ERC-8004 registry...');

  // Get or create an agent
  let agent = await prisma.agent.findFirst();
  
  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        onChainId: 1,
        name: 'TravelWise AI Agent',
        walletAddress: '0x1234567890123456789012345678901234567890',
        metadataUri: 'ipfs://QmTravelWiseAgent',
        isActive: true,
      },
    });
    console.log('✅ Created agent:', agent.name);
  }

  // Google Maps MCP Server
  const googleMaps = await prisma.mCPServer.upsert({
    where: { id: 'google-maps-mcp' },
    update: {},
    create: {
      id: 'google-maps-mcp',
      agentId: agent.id,
      name: 'Google Maps MCP',
      provider: 'Google LLC',
      description: 'Real-time maps, routing, and place discovery powered by Google Maps API',
      category: 'maps',
      endpoint: 'http://localhost:3003',
      walletAddress: '0x2234567890123456789012345678901234567890',
      status: 'ACTIVE',
      handlerType: 'EXTERNAL_API',
      handlerConfig: {
        apiKeyEnvVar: 'GOOGLE_MAPS_API_KEY',
        rateLimit: 100,
        timeout: 30000,
      },
      totalEarnings: 0,
      callCount: 0,
      isActive: true,
    },
  });

  await prisma.eRC8004Registry.upsert({
    where: { serverId: googleMaps.id },
    update: {},
    create: {
      serverId: googleMaps.id,
      agentAddress: agent.walletAddress,  // ✅ Fixed: use agent's wallet, not server's
      metadataUri: 'ipfs://QmGoogleMapsMCP',
      capabilities: ['routing', 'geocoding', 'places'],
      paymentProtocol: 'X402',
      chainId: 1,
    },
  });

  // Register tools
  const googleTools = [
    { name: 'get_route', description: 'Get optimized driving route between origin and destination', costUsd: 0.05 },
    { name: 'find_places', description: 'Find places of interest near a location', costUsd: 0.032 },
    { name: 'get_place_details', description: 'Get detailed information about a specific place', costUsd: 0.017 },
  ];

  for (const tool of googleTools) {
    await prisma.tool.upsert({
      where: { 
        mcpServerId_name: {
          mcpServerId: googleMaps.id,
          name: tool.name,
        }
      },
      update: {},
      create: {
        mcpServerId: googleMaps.id,
        name: tool.name,
        description: tool.description,
        baseCost: tool.costUsd,
        costUsd: tool.costUsd,
        callCount: 0,
        inputSchema: {},
        isActive: true,
      },
    });
  }

  console.log(`✅ Google Maps MCP: ${googleTools.length} tools`);

  // Weather MCP Server
  const weather = await prisma.mCPServer.upsert({
    where: { id: 'weather-mcp' },
    update: {},
    create: {
      id: 'weather-mcp',
      agentId: agent.id,
      name: 'Weather MCP',
      provider: 'OpenWeather',
      description: 'Current weather and forecasts via OpenWeather API',
      category: 'weather',
      endpoint: 'http://localhost:3004',
      walletAddress: '0x3345678901234567890123456789012345678901',
      status: 'ACTIVE',
      handlerType: 'EXTERNAL_API',
      handlerConfig: {
        apiKeyEnvVar: 'OPENWEATHER_API_KEY',
        rateLimit: 60,
        timeout: 10000,
      },
      totalEarnings: 0,
      callCount: 0,
      isActive: true,
    },
  });

  await prisma.eRC8004Registry.upsert({
    where: { serverId: weather.id },
    update: {},
    create: {
      serverId: weather.id,
      agentAddress: agent.walletAddress,  // ✅ Fixed: use agent's wallet
      metadataUri: 'ipfs://QmWeatherMCP',
      capabilities: ['current-weather', 'forecast', 'alerts'],
      paymentProtocol: 'X402',
      chainId: 1,
    },
  });

  const weatherTools = [
    { name: 'get_current_weather', description: 'Get current weather conditions for a location', costUsd: 0.01 },
    { name: 'get_forecast', description: '5-day weather forecast with detailed conditions', costUsd: 0.02 },
  ];

  for (const tool of weatherTools) {
    await prisma.tool.upsert({
      where: { 
        mcpServerId_name: {
          mcpServerId: weather.id,
          name: tool.name,
        }
      },
      update: {},
      create: {
        mcpServerId: weather.id,
        name: tool.name,
        description: tool.description,
        baseCost: tool.costUsd,
        costUsd: tool.costUsd,
        callCount: 0,
        inputSchema: {},
        isActive: true,
      },
    });
  }

  console.log(`✅ Weather MCP: ${weatherTools.length} tools`);

  // Travel Agent MCP Server
  const travel = await prisma.mCPServer.upsert({
    where: { id: 'travel-agent-mcp' },
    update: {},
    create: {
      id: 'travel-agent-mcp',
      agentId: agent.id,
      name: 'Travel Agent MCP',
      provider: 'TravelWise',
      description: 'AI-powered travel planning and itinerary generation',
      category: 'travel',
      endpoint: 'http://localhost:3005',
      walletAddress: '0x4456789012345678901234567890123456789012',
      status: 'ACTIVE',
      handlerType: 'ORCHESTRATOR',
      handlerConfig: {
        dependencies: ['google-maps-mcp', 'weather-mcp'],
        maxConcurrentCalls: 5,
        timeout: 60000,
      },
      totalEarnings: 0,
      callCount: 0,
      isActive: true,
    },
  });

  await prisma.eRC8004Registry.upsert({
    where: { serverId: travel.id },
    update: {},
    create: {
      serverId: travel.id,
      agentAddress: agent.walletAddress,  // ✅ Fixed: use agent's wallet
      metadataUri: 'ipfs://QmTravelAgentMCP',
      capabilities: ['itinerary-planning', 'hotel-search', 'route-optimization', 'weather-integration'],
      paymentProtocol: 'X402',
      chainId: 1,
    },
  });

  const travelTools = [
    { name: 'plan_scenic_route', description: 'Plan an optimized scenic road trip with weather-aware recommendations', costUsd: 0.05 },
    { name: 'weather_aware_itinerary', description: 'Generate day-by-day activity itinerary optimized for weather conditions', costUsd: 0.03 },
    { name: 'hotel_search', description: 'Search for hotels with availability, pricing and ratings', costUsd: 0.03 },
  ];

  for (const tool of travelTools) {
    await prisma.tool.upsert({
      where: { 
        mcpServerId_name: {
          mcpServerId: travel.id,
          name: tool.name,
        }
      },
      update: {},
      create: {
        mcpServerId: travel.id,
        name: tool.name,
        description: tool.description,
        baseCost: tool.costUsd,
        costUsd: tool.costUsd,
        callCount: 0,
        inputSchema: {},
        isActive: true,
      },
    });
  }

  console.log(`✅ Travel Agent MCP: ${travelTools.length} tools`);
  
  console.log('\n✅ Registry seeded successfully!');
  console.log(`   • Agent: ${agent.name} (${agent.walletAddress})`);
  console.log('   • 3 MCP servers registered');
  console.log('   • 8 tools configured');
  console.log('   • ERC-8004 metadata added');
  console.log('   • X402 payment protocol enabled');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
