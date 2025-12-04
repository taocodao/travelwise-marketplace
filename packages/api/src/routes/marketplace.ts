import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BlockchainService } from '../services/blockchain.service';

const router = Router();
const prisma = new PrismaClient();
const blockchainService = new BlockchainService();

// Define agent type with relations using Prisma utility type
type AgentWithServers = Prisma.AgentGetPayload<{
  include: {
    mcpServers: {
      include: {
        tools: true
      }
    }
  }
}>;

// ══════════════════════════════════════════════════════
// DISCOVER AGENTS
// ══════════════════════════════════════════════════════
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const { specialization, minReputation } = req.query;

    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
      },
      include: {
        mcpServers: {
          where: { isActive: true },
          include: {
            tools: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    // Enrich with on-chain reputation - TypeScript infers the type from agents array
    const enrichedAgents = await Promise.all(
      agents.map(async (agent) => {
        const reputation = await blockchainService.getReputation(agent.onChainId);
        return {
          ...agent,
          reputation: {
            score: reputation.averageScore,
            totalFeedback: reputation.totalFeedback,
          },
        };
      })
    );

    // Filter by criteria
    let filtered = enrichedAgents;
    if (minReputation) {
      filtered = filtered.filter(
        (a) => a.reputation.score >= parseInt(minReputation as string)
      );
    }

    res.json({
      success: true,
      agents: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// ══════════════════════════════════════════════════════
// GET AGENT DETAILS
// ══════════════════════════════════════════════════════
router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        mcpServers: {
          include: {
            tools: true,
          },
        },
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get on-chain reputation
    const reputation = await blockchainService.getReputation(agent.onChainId);
    const feedback = await blockchainService.getFeedback(agent.onChainId);

    res.json({
      success: true,
      agent: {
        ...agent,
        reputation,
        feedback: feedback.slice(0, 10), // Latest 10
      },
    });
  } catch (error) {
    console.error('Error fetching agent details:', error);
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

// ══════════════════════════════════════════════════════
// GET PRICING FOR TOOL
// ══════════════════════════════════════════════════════
router.get('/pricing/:toolId', async (req: Request, res: Response) => {
  try {
    const { toolId } = req.params;

    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
      include: {
        mcpServer: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Get current pricing config
    const pricingConfig = await prisma.pricingConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    // Convert Decimal values to numbers for calculations
    const marginPercent = pricingConfig?.marginPercent
      ? (pricingConfig.marginPercent instanceof Decimal
        ? pricingConfig.marginPercent.toNumber()
        : Number(pricingConfig.marginPercent))
      : 20;

    const platformFeePercent = pricingConfig?.platformFee
      ? (pricingConfig.platformFee instanceof Decimal
        ? pricingConfig.platformFee.toNumber()
        : Number(pricingConfig.platformFee))
      : 1;

    // Convert baseCost Decimal to number
    const baseCost = tool.baseCost instanceof Decimal
      ? tool.baseCost.toNumber()
      : Number(tool.baseCost);

    // Perform calculations with numbers
    const margin = baseCost * (marginPercent / 100);
    const totalCost = baseCost + margin;
    const platformCut = totalCost * (platformFeePercent / 100);

    res.json({
      success: true,
      tool: {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        agent: tool.mcpServer.agent,
      },
      pricing: {
        baseCost,
        margin,
        marginPercent,
        totalCost,
        platformFee: platformCut,
        agentEarnings: totalCost - platformCut,
        currency: 'USDC',
      },
    });
  } catch (error) {
    console.error('Error calculating pricing:', error);
    res.status(500).json({ error: 'Failed to calculate pricing' });
  }
});

// ══════════════════════════════════════════════════════
// CREATE EXECUTION (Tool Usage)
// ══════════════════════════════════════════════════════
router.post('/executions', async (req: Request, res: Response) => {
  try {
    const { toolId, input } = req.body;

    // Validate required fields
    if (!toolId || !input) {
      return res.status(400).json({
        error: 'Missing required fields: toolId, input'
      });
    }

    // Get tool and agent info
    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
      include: {
        mcpServer: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    // Get pricing config for calculations
    const pricingConfig = await prisma.pricingConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const marginPercent = pricingConfig?.marginPercent
      ? (pricingConfig.marginPercent instanceof Decimal
        ? pricingConfig.marginPercent.toNumber()
        : Number(pricingConfig.marginPercent))
      : 20;

    // Calculate pricing
    const baseCost = tool.baseCost instanceof Decimal
      ? tool.baseCost.toNumber()
      : Number(tool.baseCost);

    const marginAmount = baseCost * (marginPercent / 100);
    const totalCost = baseCost + marginAmount;

    // Create execution record with all required fields
    const execution = await prisma.execution.create({
      data: {
        agentId: tool.mcpServer.agentId,
        toolId,
        mcpServerId: tool.mcpServerId,
        input: input,
        baseCost: new Decimal(baseCost),
        margin: new Decimal(marginAmount),
        totalCost: new Decimal(totalCost),
      },
      include: {
        agent: true,
        tool: true,
        mcpServer: true,
      },
    });

    res.json({
      success: true,
      execution,
    });
  } catch (error) {
    console.error('Error creating execution:', error);
    res.status(500).json({ error: 'Failed to create execution' });
  }
});

// ══════════════════════════════════════════════════════
// GET EXECUTION STATUS
// ══════════════════════════════════════════════════════
router.get('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        agent: true,
        tool: true,
      },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json({
      success: true,
      execution,
    });
  } catch (error) {
    console.error('Error fetching execution:', error);
    res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

// ══════════════════════════════════════════════════════
// GET PRICING CONFIG
// ══════════════════════════════════════════════════════
router.get('/config/pricing', async (req: Request, res: Response) => {
  try {
    const config = await prisma.pricingConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      return res.json({
        success: true,
        config: {
          marginPercent: 20,
          platformFee: 1,
        },
      });
    }

    res.json({
      success: true,
      config: {
        marginPercent: config.marginPercent instanceof Decimal
          ? config.marginPercent.toNumber()
          : Number(config.marginPercent),
        platformFee: config.platformFee instanceof Decimal
          ? config.platformFee.toNumber()
          : Number(config.platformFee),
      },
    });
  } catch (error) {
    console.error('Error fetching pricing config:', error);
    res.status(500).json({ error: 'Failed to fetch pricing config' });
  }
});

export default router;
