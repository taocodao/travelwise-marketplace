// packages/api/src/services/x402-payment.service.ts - X402 Payment Processing Service

import { ethers } from 'ethers';
import { prisma } from '../lib/prisma';

// Contract ABIs (minimal - just what we need)
const USDC_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
];

const PAYMENT_PROCESSOR_ABI = [
    'function processPayment(address serverWallet, uint256 amount, string toolName, string mcpServerId) returns (bytes32)',
    'function getServerEarnings(address serverWallet) view returns (uint256)',
    'function getUserSpending(address userWallet) view returns (uint256)',
    'function getPayment(bytes32 paymentId) view returns (tuple(address userWallet, address serverWallet, uint256 amount, string toolName, string mcpServerId, uint256 timestamp, bytes32 txHash))',
];

export interface PaymentConfig {
    rpcUrl: string;
    chainId: number;
    usdcAddress: string;
    paymentProcessorAddress: string;
}

export interface PaymentRequest {
    userWallet: string;
    serverWallet: string;
    toolName: string;
    mcpServerId: string;
    amount: string; // In USDC (e.g., "0.030")
}

export interface PaymentResult {
    success: boolean;
    paymentId?: string;
    txHash?: string;
    amount?: string;
    error?: string;
}

export class X402PaymentService {
    private provider: ethers.JsonRpcProvider;
    private usdcContract: ethers.Contract;
    private paymentProcessor: ethers.Contract;
    private config: PaymentConfig;

    constructor(config: PaymentConfig) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        
        this.usdcContract = new ethers.Contract(
            config.usdcAddress,
            USDC_ABI,
            this.provider
        );
        
        this.paymentProcessor = new ethers.Contract(
            config.paymentProcessorAddress,
            PAYMENT_PROCESSOR_ABI,
            this.provider
        );
    }

    /**
     * Check if user has sufficient USDC balance
     */
    async checkBalance(userWallet: string, requiredAmount: string): Promise<boolean> {
        try {
            const amountWei = ethers.parseUnits(requiredAmount, 6); // USDC has 6 decimals
            const balance = await this.usdcContract.balanceOf(userWallet);
            return balance >= amountWei;
        } catch (error) {
            console.error('[X402Payment] Error checking balance:', error);
            return false;
        }
    }

    /**
     * Check if user has approved payment processor to spend USDC
     */
    async checkAllowance(userWallet: string, requiredAmount: string): Promise<boolean> {
        try {
            const amountWei = ethers.parseUnits(requiredAmount, 6);
            const allowance = await this.usdcContract.allowance(
                userWallet,
                this.config.paymentProcessorAddress
            );
            return allowance >= amountWei;
        } catch (error) {
            console.error('[X402Payment] Error checking allowance:', error);
            return false;
        }
    }

    /**
     * Get user's USDC balance
     */
    async getBalance(wallet: string): Promise<string> {
        try {
            const balance = await this.usdcContract.balanceOf(wallet);
            return ethers.formatUnits(balance, 6);
        } catch (error) {
            console.error('[X402Payment] Error getting balance:', error);
            return '0';
        }
    }

    /**
     * Get server's total earnings
     */
    async getServerEarnings(serverWallet: string): Promise<string> {
        try {
            const earnings = await this.paymentProcessor.getServerEarnings(serverWallet);
            return ethers.formatUnits(earnings, 6);
        } catch (error) {
            console.error('[X402Payment] Error getting server earnings:', error);
            return '0';
        }
    }

    /**
     * Get user's total spending
     */
    async getUserSpending(userWallet: string): Promise<string> {
        try {
            const spending = await this.paymentProcessor.getUserSpending(userWallet);
            return ethers.formatUnits(spending, 6);
        } catch (error) {
            console.error('[X402Payment] Error getting user spending:', error);
            return '0';
        }
    }

    /**
     * Record payment in database
     */
    private async recordPayment(
        paymentId: string,
        txHash: string,
        request: PaymentRequest
    ): Promise<void> {
        try {
            await prisma.x402Transaction.create({
                data: {
                    id: paymentId,
                    userWallet: request.userWallet,
                    serverWallet: request.serverWallet,
                    toolName: request.toolName,
                    mcpServerId: request.mcpServerId,
                    amount: request.amount,
                    txHash,
                    chainId: this.config.chainId,
                    status: 'confirmed',
                    timestamp: new Date(),
                },
            });
        } catch (error) {
            console.error('[X402Payment] Error recording payment:', error);
        }
    }

    /**
     * Verify payment was successful on-chain
     */
    async verifyPayment(paymentId: string): Promise<boolean> {
        try {
            const payment = await this.paymentProcessor.getPayment(paymentId);
            return payment.userWallet !== ethers.ZeroAddress;
        } catch (error) {
            console.error('[X402Payment] Error verifying payment:', error);
            return false;
        }
    }

    /**
     * Get payment approval data for frontend
     * Returns the data needed for user to approve USDC spending
     */
    getApprovalData(amount: string) {
        const amountWei = ethers.parseUnits(amount, 6);
        return {
            to: this.config.usdcAddress,
            data: this.usdcContract.interface.encodeFunctionData('approve', [
                this.config.paymentProcessorAddress,
                amountWei,
            ]),
        };
    }

    /**
     * Get payment transaction data for frontend
     * Returns the data needed for user to execute payment
     */
    getPaymentData(request: PaymentRequest) {
        const amountWei = ethers.parseUnits(request.amount, 6);
        return {
            to: this.config.paymentProcessorAddress,
            data: this.paymentProcessor.interface.encodeFunctionData('processPayment', [
                request.serverWallet,
                amountWei,
                request.toolName,
                request.mcpServerId,
            ]),
        };
    }
}

// Singleton instance
let paymentService: X402PaymentService | null = null;

export function getPaymentService(): X402PaymentService {
    if (!paymentService) {
        const config: PaymentConfig = {
            rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
            chainId: 84532,
            usdcAddress: process.env.USDC_CONTRACT_ADDRESS || '',
            paymentProcessorAddress: process.env.X402_PAYMENT_PROCESSOR || '',
        };

        if (!config.usdcAddress || !config.paymentProcessorAddress) {
            throw new Error('Missing payment contract addresses in environment variables');
        }

        paymentService = new X402PaymentService(config);
    }

    return paymentService;
}
