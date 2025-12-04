import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Pricing Config
  const pricingConfig = await prisma.pricingConfig.create({
    data: {
      marginPercent: 20,
      platformFee: 1,
      updatedBy: '0x0852239709141804bE1BD4878Ee8A4A603752888',
    },
  });
  console.log('✅ Pricing config created');

  // Create Wallet Config
  const walletConfig = await prisma.walletConfig.create({
    data: {
      operatorWallet: '0x0852239709141804bE1BD4878Ee8A4A603752888',
      escrowContract: '0x45cBA98635EdB7A15b1204d843Ac606d1B048a56',
      isActive: true,
    },
  });
  console.log('✅ Wallet config created');

  // Create Agents
  const agent1 = await prisma.agent.create({
    data: {
      name: 'Travel Planning Expert',
      walletAddress: '0x1111111111111111111111111111111111111111',
      metadataUri: 'ipfs://QmTravelPlanningExpert',
      onChainId: 1,
      isActive: true,
    },
  });

  const agent2 = await prisma.agent.create({
    data: {
      name: 'Weather & Route Optimizer',
      walletAddress: '0x2222222222222222222222222222222222222222',
      metadataUri: 'ipfs://QmWeatherOptimizer',
      onChainId: 2,
      isActive: true,
    },
  });

  const agent3 = await prisma.agent.create({
    data: {
      name: 'Local Guide Assistant',
      walletAddress: '0x3333333333333333333333333333333333333333',
      metadataUri: 'ipfs://QmLocalGuide',
      onChainId: 3,
      isActive: true,
    },
  });

  console.log('✅ 3 Agents created');

  // Create MCP Servers and Tools
  await prisma.mCPServer.create({
    data: {
      name: 'Google Maps MCP',
      description: 'Google Maps integration for location services',
      endpoint: 'http://localhost:3003',
      agentId: agent1.id,
      isActive: true,
      tools: {
        create: [
          {
            name: 'Place Search',
            description: 'Search for places, hotels, restaurants, and attractions',
            inputSchema: { 
              type: 'object',
              properties: {
                query: { type: 'string' },
                location: { type: 'string' },
                radius: { type: 'number' }
              }
            },
            baseCost: 0.25,
            isActive: true,
          },
          {
            name: 'Route Planning',
            description: 'Calculate optimal routes between multiple destinations',
            inputSchema: { 
              type: 'object',
              properties: {
                origin: { type: 'string' },
                destination: { type: 'string' },
                waypoints: { type: 'array' }
              }
            },
            baseCost: 0.50,
            isActive: true,
          },
          {
            name: 'Place Details',
            description: 'Get detailed information about a specific place',
            inputSchema: { 
              type: 'object',
              properties: {
                placeId: { type: 'string' }
              }
            },
            baseCost: 0.15,
            isActive: true,
          },
        ],
      },
    },
  });

  await prisma.mCPServer.create({
    data: {
      name: 'Weather MCP',
      description: 'Weather forecasting and conditions',
      endpoint: 'http://localhost:3004',
      agentId: agent2.id,
      isActive: true,
      tools: {
        create: [
          {
            name: 'Current Weather',
            description: 'Get current weather conditions for any location',
            inputSchema: { 
              type: 'object',
              properties: {
                location: { type: 'string' },
                units: { type: 'string' }
              }
            },
            baseCost: 0.10,
            isActive: true,
          },
          {
            name: 'Weather Forecast',
            description: '7-day weather forecast with hourly breakdown',
            inputSchema: { 
              type: 'object',
              properties: {
                location: { type: 'string' },
                days: { type: 'number' }
              }
            },
            baseCost: 0.20,
            isActive: true,
          },
        ],
      },
    },
  });

  await prisma.mCPServer.create({
    data: {
      name: 'Travel Agent MCP',
      description: 'Travel booking and recommendations',
      endpoint: 'http://localhost:3005',
      agentId: agent3.id,
      isActive: true,
      tools: {
        create: [
          {
            name: 'Hotel Search',
            description: 'Find and compare hotels in your destination',
            inputSchema: { 
              type: 'object',
              properties: {
                location: { type: 'string' },
                checkIn: { type: 'string', format: 'date' },
                checkOut: { type: 'string', format: 'date' }
              }
            },
            baseCost: 0.30,
            isActive: true,
          },
          {
            name: 'Restaurant Recommendations',
            description: 'Get personalized restaurant recommendations',
            inputSchema: { 
              type: 'object',
              properties: {
                location: { type: 'string' },
                cuisine: { type: 'string' },
                priceRange: { type: 'string' }
              }
            },
            baseCost: 0.15,
            isActive: true,
          },
          {
            name: 'Activity Planner',
            description: 'Create daily activity schedules',
            inputSchema: { 
              type: 'object',
              properties: {
                location: { type: 'string' },
                interests: { type: 'array' },
                duration: { type: 'number' }
              }
            },
            baseCost: 0.40,
            isActive: true,
          },
        ],
      },
    },
  });

  console.log('✅ 3 MCP Servers with 8 Tools created');
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
