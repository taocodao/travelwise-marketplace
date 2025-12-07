// frontend/src/hooks/usePayment.ts
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { 
  PAYMENT_CONTRACT_ADDRESS, 
  USDC_CONTRACT_ADDRESS, 
  USDC_ABI, 
  PAYMENT_CONTRACT_ABI 
} from '@/lib/web3';

interface PaymentParams {
  serverAddress: string;
  amount: number; // in USDC
  toolName: string;
  mcpServer: string;
}

export function usePayment() {
  const { address } = useAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync: approveUSDC } = useWriteContract();
  const { writeContractAsync: processPayment } = useWriteContract();

  const pay = async (params: PaymentParams) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Convert amount to USDC units (6 decimals)
      const amountInUnits = parseUnits(params.amount.toString(), 6);

      // Step 1: Approve USDC spending
      console.log('Approving USDC...');
      const approveTxHash = await approveUSDC({
        address: USDC_CONTRACT_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [PAYMENT_CONTRACT_ADDRESS, amountInUnits]
      });

      console.log('Approval tx:', approveTxHash);

      // Wait for approval confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Process payment
      console.log('Processing payment...');
      const paymentTxHash = await processPayment({
        address: PAYMENT_CONTRACT_ADDRESS as `0x${string}`,
        abi: PAYMENT_CONTRACT_ABI,
        functionName: 'processPayment',
        args: [
          params.serverAddress,
          amountInUnits,
          params.toolName,
          params.mcpServer
        ]
      });

      console.log('Payment tx:', paymentTxHash);

      // Step 3: Record in database
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: paymentTxHash,
          from: address,
          to: params.serverAddress,
          amount: params.amount,
          toolName: params.toolName,
          mcpServer: params.mcpServer,
          description: `Payment for ${params.toolName} on ${params.mcpServer}`,
          walletAddress: address
        })
      });

      setIsProcessing(false);
      return paymentTxHash;

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
      setIsProcessing(false);
      throw err;
    }
  };

  return { pay, isProcessing, error };
}
