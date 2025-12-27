'use client';

import { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { baseSepolia, mainnet, sepolia, base } from 'viem/chains';

export function ClientProviders({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // If no Privy app ID, render children without auth
  if (!appId) {
    console.warn('⚠️ NEXT_PUBLIC_PRIVY_APP_ID not set - Auth disabled');
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Login methods - only using what's enabled in Privy dashboard
        loginMethods: ['email', 'google', 'wallet'],
        
        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#6366f1',
          showWalletLoginFirst: false,
        },

        // Embedded wallets - auto-sign for seamless payments
        // @ts-expect-error - noPromptOnSignature is a valid Privy option but types may be outdated
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          // Skip approval dialogs for embedded wallet transactions
          noPromptOnSignature: true,
        },

        // External wallets config - allow connection even on different networks
        externalWallets: {
          coinbaseWallet: {
            connectionOptions: 'smartWalletOnly',
          },
        },

        // Default chain - Base Sepolia
        defaultChain: baseSepolia,
        // Support multiple chains to allow MetaMask connection from any network
        supportedChains: [baseSepolia, base, mainnet, sepolia],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
