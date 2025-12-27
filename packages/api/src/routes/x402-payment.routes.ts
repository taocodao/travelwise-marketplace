// packages/api/src/routes/x402-payment.routes.ts - X402 Payment Routes

import { Router, Request, Response } from 'express';
import { getPaymentService } from '../services/x402-payment.service';

const router = Router();

/**
 * Get user's USDC balance
 * GET /api/x402/balance/:wallet
 */
router.get('/balance/:wallet', async (req: Request, res: Response) => {
    try {
        const { wallet } = req.params;
        const paymentService = getPaymentService();
        
        const balance = await paymentService.getBalance(wallet);
        
        res.json({
            success: true,
            wallet,
            balance,
            currency: 'USDC',
        });
    } catch (error: any) {
        console.error('[X402 Payment] Error getting balance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get balance',
        });
    }
});

/**
 * Get server earnings
 * GET /api/x402/earnings/:serverWallet
 */
router.get('/earnings/:serverWallet', async (req: Request, res: Response) => {
    try {
        const { serverWallet } = req.params;
        const paymentService = getPaymentService();
        
        const earnings = await paymentService.getServerEarnings(serverWallet);
        
        res.json({
            success: true,
            serverWallet,
            earnings,
            currency: 'USDC',
        });
    } catch (error: any) {
        console.error('[X402 Payment] Error getting earnings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get earnings',
        });
    }
});

/**
 * Get user spending
 * GET /api/x402/spending/:userWallet
 */
router.get('/spending/:userWallet', async (req: Request, res: Response) => {
    try {
        const { userWallet } = req.params;
        const paymentService = getPaymentService();
        
        const spending = await paymentService.getUserSpending(userWallet);
        
        res.json({
            success: true,
            userWallet,
            spending,
            currency: 'USDC',
        });
    } catch (error: any) {
        console.error('[X402 Payment] Error getting spending:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get spending',
        });
    }
});

/**
 * Get payment transaction data for frontend to execute
 * POST /api/x402/prepare-payment
 */
router.post('/prepare-payment', async (req: Request, res: Response) => {
    try {
        const { userWallet, serverWallet, toolName, amount, mcpServerId } = req.body;
        
        if (!userWallet || !serverWallet || !toolName || !amount) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields',
            });
            return;
        }
        
        const paymentService = getPaymentService();
        
        // Check balance
        const hasBalance = await paymentService.checkBalance(userWallet, amount);
        if (!hasBalance) {
            res.status(402).json({
                success: false,
                error: 'Insufficient USDC balance',
                required: amount,
            });
            return;
        }
        
        // Get transaction data
        const paymentData = paymentService.getPaymentData({
            userWallet,
            serverWallet,
            toolName,
            amount,
            mcpServerId: mcpServerId || 'unknown',
        });
        
        // Get approval data (in case not approved yet)
        const approvalData = paymentService.getApprovalData(amount);
        
        res.json({
            success: true,
            paymentData,
            approvalData,
            amount,
            toolName,
        });
    } catch (error: any) {
        console.error('[X402 Payment] Error preparing payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to prepare payment',
        });
    }
});

/**
 * Verify payment was successful
 * POST /api/x402/verify-payment
 */
router.post('/verify-payment', async (req: Request, res: Response) => {
    try {
        const { paymentId } = req.body;
        
        if (!paymentId) {
            res.status(400).json({
                success: false,
                error: 'Payment ID required',
            });
            return;
        }
        
        const paymentService = getPaymentService();
        const isValid = await paymentService.verifyPayment(paymentId);
        
        res.json({
            success: true,
            paymentId,
            verified: isValid,
        });
    } catch (error: any) {
        console.error('[X402 Payment] Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment',
        });
    }
});

export default router;
