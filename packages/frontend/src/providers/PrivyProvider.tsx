'use client';

import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { baseSepolia } from 'viem/chains';

// Configure wagmi for Base Sepolia
const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
});

const queryClient = new QueryClient();

// USDC on Base Sepolia
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

interface PrivyProviderProps {
  children: React.ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.warn('⚠️ NEXT_PUBLIC_PRIVY_APP_ID not set - Auth disabled');
    return <>{children}</>;
  }

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        // Login methods
        loginMethods: ['email', 'sms', 'google', 'apple', 'twitter', 'wallet'],
        
        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#6366f1', // Indigo
          logo: '/logo.png',
          showWalletLoginFirst: false,
        },

        // Embedded wallets - auto-sign without prompts (for embedded wallets only)
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
          // Skip approval dialogs for embedded wallet transactions
          // This only affects Privy embedded wallets, not external wallets like MetaMask
          noPromptOnSignature: true,
        },

        // Default chain
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],

        // Funding options
        fundingMethodConfig: {
          moonpay: {
            useSandbox: true, // Use sandbox for testing
          },
        },

        // Legal
        legal: {
          termsAndConditionsUrl: 'https://example.com/terms',
          privacyPolicyUrl: 'https://example.com/privacy',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProviderBase>
  );
}

export { USDC_ADDRESS };
