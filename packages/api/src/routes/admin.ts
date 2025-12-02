import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { verifyWalletSignature } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════
// WALLET SETUP
// ══════════════════════════════════════════════════════

const WalletConfigSchema = z.object({
  operatorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  escrowContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

router.post('/wallet/configure', verifyWalletSignature, async (req: Request, res: Response) => {
  try {
    const validated = WalletConfigSchema.parse(req.body);

    const config = await prisma.walletConfig.upsert({
      where: { operatorWallet: validated.operatorWallet },
      update: {
        escrowContract: validated.escrowContract,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        operatorWallet: validated.operatorWallet,
        escrowContract: validated.escrowContract,
        isActive: true,
      },
    });

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to configure wallet' });
  }
});

router.get('/wallet/config', async (req: Request, res: Response) => {
  try {
    const config = await prisma.walletConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wallet config' });
  }
});

// ══════════════════════════════════════════════════════
// PRICING CONFIGURATION
// ══════════════════════════════════════════════════════

const PricingConfigSchema = z.object({
  marginPercent: z.number().min(0).max(100),
  platformFee: z.number().min(0).max(100),
  updatedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

router.post('/pricing/configure', verifyWalletSignature, async (req: Request, res: Response) => {
  try {
    const validated = PricingConfigSchema.parse(req.body);

    const config = await prisma.pricingConfig.create({
      data: validated,
    });

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to configure pricing' });
  }
});

router.get('/pricing/config', async (req: Request, res: Response) => {
  try {
    const config = await prisma.pricingConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      config: config || {
        marginPercent: 20,
        platformFee: 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing config' });
  }
});

// ══════════════════════════════════════════════════════
// MCP SERVER PRICING
// ══════════════════════════════════════════════════════

const ToolPricingSchema = z.object({
  toolId: z.string().uuid(),
  baseCost: z.number().min(0),
});

router.put('/pricing/tool', verifyWalletSignature, async (req: Request, res: Response) => {
  try {
    const validated = ToolPricingSchema.parse(req.body);

    const tool = await prisma.tool.update({
      where: { id: validated.toolId },
      data: { baseCost: validated.baseCost },
    });

    res.json({
      success: true,
      tool,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to update tool pricing' });
  }
});

router.get('/pricing/tools', async (req: Request, res: Response) => {
  try {
    const tools = await prisma.tool.findMany({
      where: { isActive: true },
      include: {
        mcpServer: {
          include: {
            agent: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// ══════════════════════════════════════════════════════
// AGENT DASHBOARD
// ══════════════════════════════════════════════════════

router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const [totalAgents, totalExecutions, totalRevenue, recentExecutions] = await Promise.all([
      prisma.agent.count({ where: { isActive: true } }),
      prisma.execution.count(),
      prisma.execution.aggregate({
        where: { paymentStatus: 'SETTLED' },
        _sum: { totalCost: true },
      }),
      prisma.execution.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: true,
          mcpServer: true,
          tool: true,
        },
      }),
    ]);

    res.json({
      totalAgents,
      totalExecutions,
      totalRevenue: totalRevenue._sum.totalCost || 0,
      recentExecutions,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
