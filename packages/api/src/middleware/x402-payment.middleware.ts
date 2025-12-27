/**
 * X402 Payment Middleware
 * 
 * HTTP 402 Payment Required middleware for MCP tool calls.
 * Implements the X402 protocol for USDC payments on Base Sepolia.
 * 
 * Flow:
 * 1. Check for X-402-Payment header
 * 2. If missing, return 402 with payment requirements
 * 3. If present, verify signature and record payment
 * 4. Allow request to proceed
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { X402Service } from '../services/x402.service';
import { ethers } from 'ethers';

const prisma = new PrismaClient();
const x402Service = new X402Service();

// Base Sepolia USDC contract
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const CHAIN_ID = 84532;

export interface X402Config {
  payToAddress: string;
  toolName: string;
  toolCost: number; // In USD (will be converted to USDC units)
  mcpServerId: string;
  bypassPayment?: boolean; // For free tools
}

/**
 * Create X402 payment middleware for a specific tool
 */
export function createX402Middleware(config: X402Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip payment for free tools
    if (config.bypassPayment || config.toolCost === 0) {
      return next();
    }

    // Check for payment header
    const paymentHeader = req.header('X-402-Payment');

    if (!paymentHeader) {
      // Return 402 Payment Required
      return send402Response(res, config);
    }

    try {
      // Decode and verify payment
      const paymentData = x402Service.decodePaymentHeader(paymentHeader);
      
      // Verify the payment signature
      const isValid = await x402Service.verifyPayment(paymentData);
      
      if (!isValid) {
        return res.status(400).json({
          error: 'Invalid payment signature',
          code: 'INVALID_SIGNATURE',
        });
      }

      // Check payment amount
      const requiredAmount = Math.ceil(config.toolCost * 1_000_000).toString();
      if (BigInt(paymentData.amount) < BigInt(requiredAmount)) {
        return res.status(402).json({
          error: 'Insufficient payment amount',
          required: requiredAmount,
          provided: paymentData.amount,
        });
      }

      // Record payment in database
      await recordPayment(paymentData, config);

      // Attach payment info to request for downstream use
      (req as any).x402Payment = {
        payerAddress: paymentData.from,
        amount: paymentData.amount,
        txHash: paymentData.txHash,
        verified: true,
      };

      next();
    } catch (error: any) {
      console.error('X402 payment verification failed:', error);
      return res.status(400).json({
        error: 'Payment verification failed',
        details: error.message,
      });
    }
  };
}

/**
 * Send 402 Payment Required response
 */
function send402Response(res: Response, config: X402Config) {
  const amountInUSDC = Math.ceil(config.toolCost * 1_000_000); // Convert to USDC smallest unit

  const paymentRequirements = {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: 'base-sepolia',
        chainId: CHAIN_ID,
        maxAmountRequired: amountInUSDC.toString(),
        asset: USDC_ADDRESS,
        payTo: config.payToAddress,
        maxTimeoutSeconds: 300,
        description: `Payment for ${config.toolName}`,
        extra: {
          name: 'USD Coin',
          version: '2',
        },
        metadata: {
          toolName: config.toolName,
          toolCostUSD: config.toolCost,
          mcpServerId: config.mcpServerId,
        },
      },
    ],
  };

  res.status(402).json(paymentRequirements);
}

/**
 * Record payment in database
 */
async function recordPayment(paymentData: any, config: X402Config) {
  try {
    await prisma.x402Payment.create({
      data: {
        nonce: paymentData.nonce,
        payerAddress: paymentData.from.toLowerCase(),
        payeeAddress: paymentData.to.toLowerCase(),
        amount: paymentData.amount / 1_000_000, // Convert to decimal USD
        amountRaw: paymentData.amount,
        toolName: config.toolName,
        mcpServerId: config.mcpServerId,
        signature: paymentData.signature,
        chainId: CHAIN_ID,
        assetAddress: USDC_ADDRESS,
        status: 'PENDING',
        validAfter: new Date(paymentData.validAfter * 1000),
        validBefore: new Date(paymentData.validBefore * 1000),
        txHash: paymentData.txHash || null,
        verifiedAt: new Date(),
      },
    });

    console.log(`💰 X402 Payment recorded: ${config.toolName} - ${paymentData.amount / 1_000_000} USDC`);
  } catch (error) {
    // If nonce already exists, payment was already recorded (idempotent)
    console.warn('Payment already recorded or error:', error);
  }
}

/**
 * Middleware to extract payment info from request
 * (Use after createX402Middleware)
 */
export function extractPaymentInfo(req: Request): any {
  return (req as any).x402Payment || null;
}

/**
 * Helper to settle a payment after successful tool execution
 */
export async function settlePayment(nonce: string, txHash?: string) {
  try {
    await prisma.x402Payment.update({
      where: { nonce },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
        txHash: txHash || undefined,
      },
    });

    console.log(`✅ Payment settled: ${nonce}`);
    return true;
  } catch (error) {
    console.error('Failed to settle payment:', error);
    return false;
  }
}

/**
 * Demo/simulation payment verification
 * For testing without real signatures
 */
export function createDemoX402Middleware(config: X402Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip payment for free tools
    if (config.bypassPayment || config.toolCost === 0) {
      return next();
    }

    // Check for demo payment header
    const paymentHeader = req.header('X-402-Payment');
    const demoMode = req.header('X-402-Demo') === 'true';

    if (!paymentHeader && !demoMode) {
      // Return 402 Payment Required
      return send402Response(res, config);
    }

    // In demo mode, simulate payment
    if (demoMode) {
      const simulatedPayment = {
        payerAddress: req.header('X-Wallet-Address') || '0x0000000000000000000000000000000000000000',
        amount: Math.ceil(config.toolCost * 1_000_000).toString(),
        txHash: `demo-${Date.now()}`,
        verified: true,
        demo: true,
      };

      (req as any).x402Payment = simulatedPayment;

      // Record simulated payment
      try {
        await prisma.x402Payment.create({
          data: {
            nonce: `demo-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            payerAddress: simulatedPayment.payerAddress,
            payeeAddress: config.payToAddress,
            amount: config.toolCost,
            amountRaw: simulatedPayment.amount,
            toolName: config.toolName,
            mcpServerId: config.mcpServerId,
            signature: 'demo-signature',
            chainId: CHAIN_ID,
            assetAddress: USDC_ADDRESS,
            status: 'SETTLED',
            validAfter: new Date(),
            validBefore: new Date(Date.now() + 300000),
            verifiedAt: new Date(),
            settledAt: new Date(),
          },
        });
      } catch (e) {
        // Ignore errors for demo payments
      }

      return next();
    }

    // Real payment verification
    try {
      const paymentData = x402Service.decodePaymentHeader(paymentHeader);
      const isValid = await x402Service.verifyPayment(paymentData);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      (req as any).x402Payment = {
        payerAddress: paymentData.from,
        amount: paymentData.amount,
        txHash: paymentData.txHash,
        verified: true,
      };

      await recordPayment(paymentData, config);
      next();
    } catch (error: any) {
      return res.status(400).json({
        error: 'Payment verification failed',
        details: error.message,
      });
    }
  };
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(walletAddress: string, limit = 50) {
  return prisma.x402Payment.findMany({
    where: {
      OR: [
        { payerAddress: walletAddress.toLowerCase() },
        { payeeAddress: walletAddress.toLowerCase() },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      mcpServer: {
        select: {
          name: true,
          displayName: true,
        },
      },
    },
  });
}

/**
 * Get payment stats for an MCP server
 */
export async function getServerPaymentStats(mcpServerId: string) {
  const [totalPayments, totalAmount, recentPayments] = await Promise.all([
    prisma.x402Payment.count({
      where: { mcpServerId, status: 'SETTLED' },
    }),
    prisma.x402Payment.aggregate({
      where: { mcpServerId, status: 'SETTLED' },
      _sum: { amount: true },
    }),
    prisma.x402Payment.findMany({
      where: { mcpServerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    totalPayments,
    totalEarnings: totalAmount._sum.amount?.toNumber() || 0,
    recentPayments,
  };
}
