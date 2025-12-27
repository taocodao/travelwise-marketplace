import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';  // ✅ Use shared client

// GET /api/registry/servers
export async function GET() {
  try {
    const servers = await prisma.mCPServer.findMany({
      where: { isActive: true },
      include: {
        tools: true,
        erc8004Registry: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, servers });
  } catch (error: any) {
    console.error('GET /api/registry/servers error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/registry/servers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      provider,
      description,
      category,
      endpoint,
      walletAddress,
      agentId,
      capabilities,
      handlerType = 'EXTERNAL_API',
    } = body;

    if (!name || !endpoint || !agentId) {
      return NextResponse.json(
        { error: 'name, endpoint and agentId required' },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const server = await prisma.mCPServer.create({
      data: {
        name,
        provider,
        description,
        category,
        endpoint,
        walletAddress,
        agentId,
        status: 'ACTIVE',
        handlerType: handlerType as any,
        handlerConfig: {},
      },
    });

    await prisma.eRC8004Registry.create({
      data: {
        serverId: server.id,
        agentAddress: agent.walletAddress,
        capabilities: capabilities || ['general'],
        paymentProtocol: 'X402',
        chainId: 1,
      },
    });

    return NextResponse.json({ success: true, server });
  } catch (error: any) {
    console.error('POST /api/registry/servers error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
