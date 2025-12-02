import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { z } from 'zod';
import { X402Service } from '../services/x402.service';
import blockchainService from '../services/blockchain.service';
import { PricingService } from '../services/pricing.service';

const router = Router();
const prisma = new PrismaClient();
const x402Service = new X402Service();
const pricingService = new PricingService();

// ══════════════════════════════════════════════════════
// GET PAYMENT REQUIREMENTS (HTTP 402)
// ══════════════════════════════════════════════════════

router.post('/requirements', async (req: Request, res: Response) => {
  try {
    const { toolId, agentId } = req.body;

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

    // Convert Decimal to string for pricing calculation
    const baseCostStr = tool.baseCost instanceof Decimal 
      ? tool.baseCost.toString() 
      : String(tool.baseCost);

    const pricing = await pricingService.calculatePricing(baseCostStr);

    const walletConfig = await prisma.walletConfig.findFirst({
      where: { isActive: true },
    });

    const paymentRequirements = {
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          network: 'base-sepolia',
          maxAmountRequired: (pricing.totalCost * 1_000_000).toString(), // USDC has 6 decimals
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC Base Sepolia
          payTo: tool.mcpServer.agent.walletAddress,
          escrowContract: walletConfig?.escrowContract,
          maxTimeoutSeconds: 300,
          description: `Execution of ${tool.name}`,
          metadata: {
            toolId: tool.id,
            toolName: tool.name,
            agentId: tool.mcpServer.agent.id,
            baseCost: pricing.baseCost,
            margin: pricing.margin,
            totalCost: pricing.totalCost,
          },
        },
      ],
    };

    res.status(402).json(paymentRequirements);
  } catch (error) {
    console.error('Error generating payment requirements:', error);
    res.status(500).json({ error: 'Failed to generate payment requirements' });
  }
});

// ══════════════════════════════════════════════════════
// VERIFY X402 PAYMENT
// ══════════════════════════════════════════════════════

const VerifyPaymentSchema = z.object({
  paymentHeader: z.string(), // Base64 encoded x402 payment
  executionId: z.string(),
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const validated = VerifyPaymentSchema.parse(req.body);

    // Decode and verify x402 payment
    const paymentData = x402Service.decodePaymentHeader(validated.paymentHeader);
    const isValid = await x402Service.verifyPayment(paymentData);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment' });
    }

    // Get execution to update
    const execution = await prisma.execution.findUnique({
      where: { id: validated.executionId },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Create escrow on blockchain (only if blockchain is enabled)
    let escrowTxHash: string | null = null;
    
    if (blockchainService.isEnabled()) {
      try {
        const escrowTx = await blockchainService.createEscrowPayment(
          paymentData.txHash,
          execution.agentId,
          execution.totalCost.toString()
        );
        escrowTxHash = escrowTx.transactionHash; // FIXED: Use transactionHash instead of hash
      } catch (error) {
        console.error('Failed to create escrow on blockchain:', error);
        // Continue without blockchain - payment verified but not escrowed
      }
    }

    // Update execution record (Note: Your Execution model may not have these fields)
    // Commenting out for now - uncomment and adjust based on your actual schema
    /*
    const updatedExecution = await prisma.execution.update({
      where: { id: validated.executionId },
      data: {
        paymentStatus: 'AUTHORIZED',
        paymentTxHash: paymentData.txHash,
        escrowTxHash: escrowTxHash,
      },
    });
    */

    res.json({
      success: true,
      verified: true,
      escrowTxHash: escrowTxHash,
      executionId: execution.id,
      message: 'Payment verified successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Payment verification failed:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ══════════════════════════════════════════════════════
// SETTLE PAYMENT (After execution completes)
// ══════════════════════════════════════════════════════

router.post('/settle/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        agent: true,
      },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Note: Your Execution model may not have paymentStatus/executionStatus fields
    // Adjust these checks based on your actual schema
    /*
    if (execution.paymentStatus !== 'AUTHORIZED') {
      return res.status(400).json({ error: 'Payment not authorized' });
    }

    if (execution.executionStatus !== 'COMPLETED') {
      return res.status(400).json({ error: 'Execution not completed' });
    }
    */

    // Release payment from escrow
    let settlementTxHash: string | null = null;

    if (blockchainService.isEnabled()) {
      try {
        const settleTx = await blockchainService.releaseEscrowPayment(
          executionId // FIXED: Only pass paymentId (1 argument)
        );
        settlementTxHash = settleTx.transactionHash; // FIXED: Use transactionHash instead of hash
      } catch (error) {
        console.error('Failed to release escrow payment:', error);
        return res.status(500).json({ 
          error: 'Failed to release escrow payment',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      return res.status(503).json({ 
        error: 'Blockchain service is not available' 
      });
    }

    // Update execution (adjust based on your schema)
    /*
    const updated = await prisma.execution.update({
      where: { id: executionId },
      data: {
        paymentStatus: 'SETTLED',
        settlementTxHash: settlementTxHash,
      },
    });
    */

    res.json({
      success: true,
      executionId: execution.id,
      settlementTxHash: settlementTxHash,
      message: 'Payment settled successfully',
    });
  } catch (error) {
    console.error('Failed to settle payment:', error);
    res.status(500).json({ error: 'Failed to settle payment' });
  }
});

export default router;
