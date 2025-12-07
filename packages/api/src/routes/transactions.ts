// packages/api/src/routes/transactions.ts
import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { ethers } from 'ethers';

const router = Router();
const prisma = new PrismaClient();

const BASE_TESTNET_RPC = 'https://sepolia.base.org';
const PAYMENT_CONTRACT_ADDRESS = process.env.PAYMENT_CONTRACT_ADDRESS!;
const USDC_CONTRACT_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const provider = new ethers.JsonRpcProvider(BASE_TESTNET_RPC);

const PAYMENT_CONTRACT_ABI = [
  'event PaymentProcessed(address indexed from, address indexed to, uint256 amount, string toolName, string mcpServer, uint256 timestamp)',
  'function processPayment(address serverAddress, uint256 amount, string memory toolName, string memory mcpServer) external',
  'function batchPayment(address[] memory servers, uint256[] memory amounts, string[] memory toolNames, string[] memory mcpServers) external',
  'function getServerEarnings(address serverAddress) external view returns (uint256)'
];

// Create or get user
router.post('/users', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const user = await prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: { updatedAt: new Date() },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        balance: new Prisma.Decimal(0)
      }
    });

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record transaction
router.post('/transactions', async (req: Request, res: Response) => {
  try {
    const { txHash, from, to, amount, toolName, mcpServerId, description, walletAddress } = req.body;

    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found on blockchain' });
    }

    let user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
          balance: new Prisma.Decimal(0)
        }
      });
    }

    const txRecord = await prisma.transaction.create({
      data: {
        txHash,
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        amount: new Prisma.Decimal(amount),
        tokenAddress: USDC_CONTRACT_ADDRESS,
        toolName,
        mcpServerId,
        description,
        status: 'PENDING',
        userId: user.id
      }
    });

    monitorTransaction(txHash, txRecord.id);

    res.json({ success: true, transaction: txRecord });
  } catch (error: any) {
    console.error('Transaction creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user transactions
router.get('/transactions/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      include: {
        transactions: {
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    });

    if (!user) {
      return res.json({ success: true, transactions: [] });
    }

    res.json({ success: true, transactions: user.transactions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get MCP server earnings
router.get('/servers/:address/earnings', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const contract = new ethers.Contract(
      PAYMENT_CONTRACT_ADDRESS,
      PAYMENT_CONTRACT_ABI,
      provider
    );

    const earnings = await contract.getServerEarnings(address);
    const earningsInUSDC = parseFloat(ethers.formatUnits(earnings, 6));

    const server = await prisma.mCPServer.findFirst({
      where: { walletAddress: address.toLowerCase() }
    });

    if (server) {
      await prisma.mCPServer.update({
        where: { id: server.id },
        data: { totalEarnings: new Prisma.Decimal(earningsInUSDC) }
      });
    }

    res.json({ success: true, earnings: earningsInUSDC });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record MCP tool call
router.post('/tool-calls', async (req: Request, res: Response) => {
  try {
    const {
      toolId,
      toolName,
      mcpServerId,
      cost,
      walletAddress,
      transactionId,
      requestData,
      responseData,
      executionTime,
      success,
      errorMessage
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const toolCall = await prisma.mCPToolCall.create({
      data: {
        toolId,
        toolName,
        mcpServerId,
        cost: new Prisma.Decimal(cost),
        userId: user.id,
        transactionId,
        requestData,
        responseData,
        executionTime,
        success,
        errorMessage
      }
    });

    res.json({ success: true, toolCall });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Monitor transaction confirmation
async function monitorTransaction(txHash: string, transactionId: string) {
  try {
    const receipt = await provider.waitForTransaction(txHash, 2);

    if (receipt) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: receipt.status === 1 ? 'CONFIRMED' : 'FAILED',
          blockNumber: receipt.blockNumber,
          blockTimestamp: new Date(Date.now()),
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: receipt.gasPrice?.toString(),
          confirmedAt: new Date()
        }
      });

      const txRecord = await prisma.transaction.findUnique({
        where: { id: transactionId }
      });

      if (txRecord && txRecord.mcpServerId && receipt.status === 1) {
        await prisma.mCPServer.update({
          where: { id: txRecord.mcpServerId },
          data: {
            totalEarnings: { increment: txRecord.amount },
            callCount: { increment: 1 }
          }
        });
      }
    }
  } catch (error) {
    console.error('Transaction monitoring error:', error);
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'FAILED' }
    });
  }
}

export default router;
