'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useBalance } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { formatUnits } from 'viem';

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export function LoginButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  
  // Get embedded wallet
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const walletAddress = embeddedWallet?.address || user?.wallet?.address;

  // Get USDC balance
  const { data: usdcBalance } = useBalance({
    address: walletAddress as `0x${string}` | undefined,
    token: USDC_ADDRESS,
    chainId: baseSepolia.id,
  });

  if (!ready) {
    return (
      <button 
        disabled
        className="px-4 py-2 bg-gray-700 text-gray-400 rounded-lg"
      >
        Loading...
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        Sign In
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Wallet Balance */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-gray-700">
        <span className="text-green-400 font-medium">
          ${usdcBalance ? formatUnits(usdcBalance.value, 6) : '0.00'}
        </span>
        <span className="text-gray-500 text-sm">USDC</span>
      </div>

      {/* User Info */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">
            {(user?.email?.address?.[0] || user?.phone?.number?.[0] || '?').toUpperCase()}
          </span>
        </div>
        <div className="hidden md:block">
          <div className="text-sm text-white font-medium">
            {user?.email?.address || user?.phone?.number || 'Connected'}
          </div>
          <div className="text-xs text-gray-400">
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'No wallet'}
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        title="Sign Out"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}

export function UserProfile() {
  const { user, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const walletAddress = embeddedWallet?.address || user?.wallet?.address;

  const { data: usdcBalance, isLoading } = useBalance({
    address: walletAddress as `0x${string}` | undefined,
    token: USDC_ADDRESS,
    chainId: baseSepolia.id,
  });

  const { data: ethBalance } = useBalance({
    address: walletAddress as `0x${string}` | undefined,
    chainId: baseSepolia.id,
  });

  if (!ready || !authenticated) {
    return null;
  }

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-3">Wallet</h3>
      
      {/* Wallet Address */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 uppercase tracking-wide">Address</label>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-sm text-indigo-400 bg-gray-900 px-2 py-1 rounded font-mono">
            {walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}` : 'No wallet'}
          </code>
          {walletAddress && (
            <button
              onClick={() => navigator.clipboard.writeText(walletAddress)}
              className="text-gray-500 hover:text-white transition-colors"
              title="Copy address"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500">USDC Balance</div>
          <div className="text-lg font-bold text-green-400">
            {isLoading ? '...' : `$${usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)).toFixed(2) : '0.00'}`}
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500">ETH (Gas)</div>
          <div className="text-lg font-bold text-blue-400">
            {ethBalance ? parseFloat(formatUnits(ethBalance.value, 18)).toFixed(4) : '0'} ETH
          </div>
        </div>
      </div>

      {/* Fund Wallet Link */}
      <div className="mt-4 text-center">
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Get Test USDC →
        </a>
      </div>
    </div>
  );
}

export function WalletAddress() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const walletAddress = embeddedWallet?.address || user?.wallet?.address;

  if (!walletAddress) return null;

  return (
    <span className="font-mono text-sm text-indigo-400">
      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
    </span>
  );
}
