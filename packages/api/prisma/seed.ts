import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with ERC-8004 compliant data...');

  // Create Pricing Config - explicitly set updatedAt
  const pricingConfig = await prisma.pricingConfig.upsert({
    where: { id: 'default-config' },
    update: {},
    create: {
      id: 'default-config',
      marginPercent: 20,
      platformFee: 1,
      updatedBy: '0x0852239709141804bE1BD4878Ee8A4A603752888',
      updatedAt: new Date(), // Add this
    },
  });
  console.log('✅ Pricing config created');

  // Create Wallet Config - explicitly set updatedAt
  const walletConfig = await prisma.walletConfig.upsert({
    where: { operatorWallet: '0x0852239709141804bE1BD4878Ee8A4A603752888' },
    update: {},
    create: {
      operatorWallet: '0x0852239709141804bE1BD4878Ee8A4A603752888',
      escrowContract: '0x45cBA98635EdB7A15b1204d843Ac606d1B048a56',
      isActive: true,
      createdAt: new Date(), // Add this
      updatedAt: new Date(), // Add this
    },
  });
  console.log('✅ Wallet config created');

  // Create Agents
  const agent1 = await prisma.agent.upsert({
    where: { walletAddress: '0x1111111111111111111111111111111111111111' },
    update: {},
    create: {
      name: 'Travel Planning Expert',
      walletAddress: '0x1111111111111111111111111111111111111111',
      metadataUri: 'ipfs://QmTravelPlanningExpert',
      onChainId: 1,
      isActive: true,
    },
  });

  const agent2 = await prisma.agent.upsert({
    where: { walletAddress: '0x2222222222222222222222222222222222222222' },
    update: {},
    create: {
      name: 'Weather & Route Optimizer',
      walletAddress: '0x2222222222222222222222222222222222222222',
      metadataUri: 'ipfs://QmWeatherOptimizer',
      onChainId: 2,
      isActive: true,
    },
  });

  const agent3 = await prisma.agent.upsert({
    where: { walletAddress: '0x3333333333333333333333333333333333333333' },
    update: {},
    create: {
      name: 'Local Guide Assistant',
      walletAddress: '0x3333333333333333333333333333333333333333',
      metadataUri: 'ipfs://QmLocalGuide',
      onChainId: 3,
      isActive: true,
    },
  });

  console.log('✅ 3 Agents created');

  // Create Google Maps MCP Server
  const googleMapsServer = await prisma.mCPServer.upsert({
    where: { id: 'google-maps-server' },
    update: {},
    create: {
      id: 'google-maps-server',
      name: 'Google Maps MCP',
      description: 'Google Maps integration for location services',
      endpoint: 'http://localhost:3003',
      agentId: agent1.id,
      provider: 'Google LLC',
      category: 'maps',
      walletAddress: '0x4444444444444444444444444444444444444444',
      status: 'ACTIVE',
      handlerType: 'EXTERNAL_API',
      handlerConfig: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || 'demo-key',
        rateLimitPerMin: 100,
      },
      isActive: true,
    },
  });

  // Create ERC-8004 Registry for Google Maps
  await prisma.eRC8004Registry.upsert({
    where: { serverId: googleMapsServer.id },
    update: {},
    create: {
      serverId: googleMapsServer.id,
      agentAddress: agent1.walletAddress,
      metadataUri: 'ipfs://QmGoogleMapsMetadata',
      capabilities: ['geocoding', 'routing', 'places', 'distance-matrix'],
      paymentProtocol: 'X402',
      chainId: 84532,
    },
  });

  // Create Tools for Google Maps
  await prisma.tool.upsert({
    where: { id: 'google-maps-place-search' },
    update: {},
    create: {
      id: 'google-maps-place-search',
      mcpServerId: googleMapsServer.id,
      name: 'Place Search',
      description: 'Search for places, hotels, restaurants, and attractions',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          location: { type: 'string' },
          radius: { type: 'number' },
        },
        required: ['query'],
      },
      baseCost: 0.25,
      costUsd: 0.25,
      callCount: 0,
      isActive: true,
    },
  });

  await prisma.tool.upsert({
    where: { id: 'google-maps-route-planning' },
    update: {},
    create: {
      id: 'google-maps-route-planning',
      mcpServerId: googleMapsServer.id,
      name: 'Route Planning',
      description: 'Calculate optimal routes between multiple destinations',
      inputSchema: {
        type: 'object',
        properties: {
          origin: { type: 'string' },
          destination: { type: 'string' },
          waypoints: { type: 'array', items: { type: 'string' } },
        },
        required: ['origin', 'destination'],
      },
      baseCost: 0.50,
      costUsd: 0.50,
      callCount: 0,
      isActive: true,
    },
  });

  await prisma.tool.upsert({
    where: { id: 'google-maps-place-details' },
    update: {},
    create: {
      id: 'google-maps-place-details',
      mcpServerId: googleMapsServer.id,
      name: 'Place Details',
      description: 'Get detailed information about a specific place',
      inputSchema: {
        type: 'object',
        properties: {
          placeId: { type: 'string' },
        },
        required: ['placeId'],
      },
      baseCost: 0.15,
      costUsd: 0.15,
      callCount: 0,
      isActive: true,
    },
  });

  // Create Weather MCP Server
  const weatherServer = await prisma.mCPServer.upsert({
    where: { id: 'weather-server' },
    update: {},
    create: {
      id: 'weather-server',
      name: 'Weather MCP',
      description: 'Weather forecasting and conditions',
      endpoint: 'http://localhost:3004',
      agentId: agent2.id,
      provider: 'OpenWeatherMap',
      category: 'weather',
      walletAddress: '0x5555555555555555555555555555555555555555',
      status: 'ACTIVE',
      handlerType: 'EXTERNAL_API',
      handlerConfig: {
        apiKey: process.env.OPENWEATHER_API_KEY || 'demo-key',
        rateLimitPerMin: 60,
      },
      isActive: true,
    },
  });

  // Create ERC-8004 Registry for Weather
  await prisma.eRC8004Registry.upsert({
    where: { serverId: weatherServer.id },
    update: {},
    create: {
      serverId: weatherServer.id,
      agentAddress: agent2.walletAddress,
      metadataUri: 'ipfs://QmWeatherMetadata',
      capabilities: ['current-weather', 'forecast', 'alerts', 'historical'],
      paymentProtocol: 'X402',
      chainId: 84532,
    },
  });

  await prisma.tool.upsert({
    where: { id: 'weather-current' },
    update: {},
    create: {
      id: 'weather-current',
      mcpServerId: weatherServer.id,
      name: 'Current Weather',
      description: 'Get current weather conditions for any location',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          units: { type: 'string', enum: ['metric', 'imperial'] },
        },
        required: ['location'],
      },
      baseCost: 0.10,
      costUsd: 0.10,
      callCount: 0,
      isActive: true,
    },
  });

  await prisma.tool.upsert({
    where: { id: 'weather-forecast' },
    update: {},
    create: {
      id: 'weather-forecast',
      mcpServerId: weatherServer.id,
      name: 'Weather Forecast',
      description: '7-day weather forecast with hourly breakdown',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          days: { type: 'number', minimum: 1, maximum: 7 },
        },
        required: ['location'],
      },
      baseCost: 0.20,
      costUsd: 0.20,
      callCount: 0,
      isActive: true,
    },
  });

  // Create Travel Agent MCP Server
  const travelServer = await prisma.mCPServer.upsert({
    where: { id: 'travel-agent-server' },
    update: {},
    create: {
      id: 'travel-agent-server',
      name: 'Travel Agent MCP',
      description: 'Travel booking and recommendations',
      endpoint: 'http://localhost:3005',
      agentId: agent3.id,
      provider: 'TravelWise AI',
      category: 'travel',
      walletAddress: '0x6666666666666666666666666666666666666666',
      status: 'ACTIVE',
      handlerType: 'INTERNAL',
      handlerConfig: {
        maxConcurrentRequests: 50,
        timeoutSeconds: 30,
      },
      isActive: true,
    },
  });

  // Create ERC-8004 Registry for Travel Agent
  await prisma.eRC8004Registry.upsert({
    where: { serverId: travelServer.id },
    update: {},
    create: {
      serverId: travelServer.id,
      agentAddress: agent3.walletAddress,
      metadataUri: 'ipfs://QmTravelAgentMetadata',
      capabilities: ['hotel-search', 'restaurant-recommendations', 'activity-planning'],
      paymentProtocol: 'X402',
      chainId: 84532,
    },
  });

  await prisma.tool.upsert({
    where: { id: 'travel-hotel-search' },
    update: {},
    create: {
      id: 'travel-hotel-search',
      mcpServerId: travelServer.id,
      name: 'Hotel Search',
      description: 'Find and compare hotels in your destination',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          checkIn: { type: 'string', format: 'date' },
          checkOut: { type: 'string', format: 'date' },
        },
        required: ['location', 'checkIn', 'checkOut'],
      },
      baseCost: 0.30,
      costUsd: 0.30,
      callCount: 0,
      isActive: true,
    },
  });

  await prisma.tool.upsert({
    where: { id: 'travel-restaurant' },
    update: {},
    create: {
      id: 'travel-restaurant',
      mcpServerId: travelServer.id,
      name: 'Restaurant Recommendations',
      description: 'Get personalized restaurant recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          cuisine: { type: 'string' },
        },
        required: ['location'],
      },
      baseCost: 0.15,
      costUsd: 0.15,
      callCount: 0,
      isActive: true,
    },
  });

  await prisma.tool.upsert({
    where: { id: 'travel-activity' },
    update: {},
    create: {
      id: 'travel-activity',
      mcpServerId: travelServer.id,
      name: 'Activity Planner',
      description: 'Create daily activity schedules',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          duration: { type: 'number' },
        },
        required: ['location', 'duration'],
      },
      baseCost: 0.40,
      costUsd: 0.40,
      callCount: 0,
      isActive: true,
    },
  });

  console.log('✅ 3 MCP Servers with 8 Tools created');
  console.log('✅ ERC-8004 Registry entries created');

  // Create sample MCP Transactions
  await prisma.mCPTransaction.create({
    data: {
      serverId: googleMapsServer.id,
      toolId: 'google-maps-place-search',
      toolName: 'Place Search',
      userAddress: '0x7777777777777777777777777777777777777777',
      costUsd: 0.25,
      status: 'completed',
      requestParams: {
        query: 'restaurants in Paris',
        location: 'Paris, France',
      },
      responseData: {
        results: 25,
        processingTime: 1.2,
      },
    },
  });

  await prisma.mCPTransaction.create({
    data: {
      serverId: weatherServer.id,
      toolId: 'weather-forecast',
      toolName: 'Weather Forecast',
      userAddress: '0x7777777777777777777777777777777777777777',
      costUsd: 0.20,
      status: 'completed',
      requestParams: {
        location: 'Tokyo, Japan',
        days: 7,
      },
      responseData: {
        forecast: '7 days',
        processingTime: 0.8,
      },
    },
  });

  console.log('✅ 2 sample MCP Transactions created');
  console.log('🎉 Database seeded successfully with ERC-8004 compliant data!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
