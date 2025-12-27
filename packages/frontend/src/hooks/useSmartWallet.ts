'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { http, createPublicClient, encodeFunctionData, parseAbi, type Address } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { baseSepolia } from 'viem/chains';

// Configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';
const BUNDLER_RPC = `https://rpc.zerodev.app/api/v2/bundler/${ZERODEV_PROJECT_ID}`;
const PAYMASTER_RPC = `https://rpc.zerodev.app/api/v2/paymaster/${ZERODEV_PROJECT_ID}`;
const USDC_CONTRACT = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// USDC ERC20 ABI for transfer
const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

interface SmartWalletState {
  isReady: boolean;
  isLoading: boolean;
  smartWalletAddress: Address | null;
  error: string | null;
}

/**
 * Custom hook for ZeroDev smart wallet integration with Privy
 * Enables gasless, approval-free USDC transfers via ERC-4337
 */
export function useSmartWallet() {
  const { wallets } = useWallets();
  const [state, setState] = useState<SmartWalletState>({
    isReady: false,
    isLoading: false,
    smartWalletAddress: null,
    error: null,
  });
  const [kernelClient, setKernelClient] = useState<any>(null);

  // Get the active Privy embedded wallet
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const activeWallet = embeddedWallet || wallets[0];

  // Initialize smart wallet when Privy wallet is available
  const initializeSmartWallet = useCallback(async () => {
    if (!activeWallet || !ZERODEV_PROJECT_ID) {
      if (!ZERODEV_PROJECT_ID) {
        console.warn('⚠️ ZeroDev Project ID not configured - smart wallet disabled');
      }
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('🔐 Initializing ZeroDev smart wallet...');
      
      // Get the wallet provider from Privy
      const provider = await activeWallet.getEthereumProvider();
      
      // Create a viem public client
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
      });

      // Create ECDSA validator from Privy signer
      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: {
          type: 'custom',
          // @ts-expect-error - Privy provider is compatible with viem signer
          ...provider,
          signMessage: async ({ message }: { message: string }) => {
            return provider.request({
              method: 'personal_sign',
              params: [message, activeWallet.address],
            });
          },
          signTypedData: async (typedData: any) => {
            return provider.request({
              method: 'eth_signTypedData_v4',
              params: [activeWallet.address, JSON.stringify(typedData)],
            });
          },
          address: activeWallet.address as Address,
        },
        entryPoint: entryPoint07Address,
      });

      // Create kernel (smart) account
      const account = await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
        },
        entryPoint: entryPoint07Address,
      });

      console.log('✅ Smart wallet address:', account.address);

      // Create paymaster client for gas sponsorship
      const paymasterClient = createZeroDevPaymasterClient({
        chain: baseSepolia,
        transport: http(PAYMASTER_RPC),
        entryPoint: entryPoint07Address,
      });

      // Create the kernel account client
      const client = createKernelAccountClient({
        account,
        chain: baseSepolia,
        entryPoint: entryPoint07Address,
        bundlerTransport: http(BUNDLER_RPC),
        middleware: {
          sponsorUserOperation: paymasterClient.sponsorUserOperation,
        },
      });

      setKernelClient(client);
      setState({
        isReady: true,
        isLoading: false,
        smartWalletAddress: account.address,
        error: null,
      });

      console.log('🚀 Smart wallet ready for gasless transactions!');
    } catch (error: any) {
      console.error('❌ Smart wallet initialization failed:', error);
      setState({
        isReady: false,
        isLoading: false,
        smartWalletAddress: null,
        error: error.message || 'Failed to initialize smart wallet',
      });
    }
  }, [activeWallet]);

  // Initialize when wallet becomes available
  useEffect(() => {
    if (activeWallet && !state.isReady && !state.isLoading && ZERODEV_PROJECT_ID) {
      initializeSmartWallet();
    }
  }, [activeWallet, state.isReady, state.isLoading, initializeSmartWallet]);

  /**
   * Send a gasless USDC transfer using the smart wallet
   * This is the main function for payments - no popup, no gas needed!
   */
  const sendGaslessUSDCTransfer = useCallback(async (
    to: Address,
    amountUSDC: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!kernelClient || !state.isReady) {
      return { success: false, error: 'Smart wallet not ready' };
    }

    try {
      console.log(`💸 Sending gasless USDC transfer: ${amountUSDC} USDC to ${to}`);
      
      // Convert to USDC units (6 decimals)
      const amount = BigInt(Math.round(amountUSDC * 1e6));
      
      // Encode the transfer call
      const callData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [to, amount],
      });

      // Send the user operation (gasless!)
      const txHash = await kernelClient.sendTransaction({
        to: USDC_CONTRACT as Address,
        data: callData,
        value: BigInt(0),
      });

      console.log('✅ Gasless transfer sent:', txHash);

      return { success: true, txHash };
    } catch (error: any) {
      console.error('❌ Gasless transfer failed:', error);
      return { success: false, error: error.message || 'Transfer failed' };
    }
  }, [kernelClient, state.isReady]);

  return {
    ...state,
    sendGaslessUSDCTransfer,
    initializeSmartWallet,
    // Fallback info
    isZeroDevConfigured: !!ZERODEV_PROJECT_ID,
  };
}
