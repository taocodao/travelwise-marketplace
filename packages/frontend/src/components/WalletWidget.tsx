'use client';

import { useState, useRef, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

// Contract addresses (Base Sepolia)
// Official Circle USDC on Base Sepolia
const USDC_CONTRACT = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

// Format address to short form
const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Copy to clipboard helper
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Fetch ETH balance
async function fetchEthBalance(address: string): Promise<string> {
  try {
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
    });
    const data = await response.json();
    const balanceWei = BigInt(data.result || '0');
    const balanceEth = Number(balanceWei) / 1e18;
    return balanceEth.toFixed(4);
  } catch (error) {
    console.error('Error fetching ETH balance:', error);
    return '0.00';
  }
}

// Fetch USDC balance
async function fetchUsdcBalance(address: string): Promise<string> {
  try {
    // balanceOf(address) function selector: 0x70a08231
    const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
    
    console.log('🔍 Fetching USDC balance for:', address);
    console.log('🔍 Using contract:', USDC_CONTRACT);
    console.log('🔍 Call data:', data);
    
    const response = await fetch(BASE_SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: USDC_CONTRACT, data }, 'latest']
      })
    });
    const result = await response.json();
    console.log('🔍 RPC result:', result);
    
    const balanceRaw = BigInt(result.result || '0');
    const balance = Number(balanceRaw) / 1e6; // USDC has 6 decimals
    console.log('🔍 Balance:', balance, 'USDC');
    return balance.toFixed(2);
  } catch (error) {
    console.error('Error fetching USDC balance:', error);
    return '0.00';
  }
}

export function WalletWidget() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState('0.00');
  const [ethBalance, setEthBalance] = useState('0.00');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // PREFER EMBEDDED WALLET - same logic as page for consistency
  // This ensures widget and page show the same wallet/balance
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy');
  const activeWallet = embeddedWallet || externalWallet || wallets[0];
  const walletAddress = activeWallet?.address || user?.wallet?.address;
  
  // Show wallet type
  const walletType = activeWallet?.walletClientType === 'privy' ? 'Privy' : 'MetaMask';

  // Get user display info
  const displayName = user?.email?.address || user?.phone?.number || formatAddress(walletAddress || '');
  const avatarLetter = displayName?.[0]?.toUpperCase() || '?';

  // Fetch balances when dropdown opens (only once per open)
  const hasFetchedRef = useRef(false);
  
  useEffect(() => {
    // Reset fetch flag when dropdown closes
    if (!isOpen) {
      hasFetchedRef.current = false;
      return;
    }
    
    // Only fetch once per dropdown open
    if (walletAddress && isOpen && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      setLoading(true);
      
      Promise.all([
        fetchEthBalance(walletAddress),
        fetchUsdcBalance(walletAddress)
      ]).then(([eth, usdc]) => {
        setEthBalance(eth);
        setUsdcBalance(usdc);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [walletAddress, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle copy address
  const handleCopy = async () => {
    if (walletAddress) {
      const success = await copyToClipboard(walletAddress);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (!ready) {
    return (
      <div style={styles.loadingButton}>
        <div style={styles.spinner}></div>
      </div>
    );
  }

  if (!authenticated) {
    return null; // Auto-login handles this
  }

  return (
    <div style={styles.container} ref={dropdownRef}>
      {/* Wallet Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        style={styles.walletButton}
      >
        {/* Avatar */}
        <div style={styles.avatar}>
          {avatarLetter}
        </div>
        
        {/* Address/Email */}
        <div style={styles.addressContainer}>
          <span style={styles.address}>
            {formatAddress(walletAddress || '') || displayName.slice(0, 12)}
          </span>
          <span style={styles.network}>Base Sepolia</span>
        </div>

        {/* Dropdown Arrow */}
        <svg 
          style={{ 
            ...styles.arrow, 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' 
          }} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={styles.dropdown}>
          {/* Header */}
          <div style={styles.dropdownHeader}>
            <div style={styles.avatarLarge}>
              {avatarLetter}
            </div>
            <div style={styles.headerInfo}>
              <div style={styles.headerEmail}>{displayName}</div>
              <div style={styles.headerNetwork}>
                <span style={styles.networkDot}></span>
                Base Sepolia
              </div>
            </div>
          </div>

          {/* Wallet Address Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Wallet Address</div>
            <button onClick={handleCopy} style={styles.addressRow}>
              <code style={styles.fullAddress}>
                {walletAddress ? `${walletAddress.slice(0, 18)}...${walletAddress.slice(-8)}` : 'No wallet'}
              </code>
              <span style={styles.copyIcon}>
                {copied ? '✓' : '📋'}
              </span>
            </button>
          </div>

          {/* Balance Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Balance {loading && '(loading...)'}</div>
            <div style={styles.balanceRow}>
              <div style={styles.balanceItem}>
                <span style={styles.balanceIcon}>💵</span>
                <div>
                  <div style={styles.balanceValue}>${usdcBalance}</div>
                  <div style={styles.balanceLabel}>USDC</div>
                </div>
              </div>
              <div style={styles.balanceItem}>
                <span style={styles.balanceIcon}>⟠</span>
                <div>
                  <div style={styles.balanceValue}>{ethBalance}</div>
                  <div style={styles.balanceLabel}>ETH</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <a 
              href={`https://sepolia.basescan.org/address/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.actionButton}
            >
              🔍 View on Explorer
            </a>
            <a 
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.actionButton}
            >
              💰 Get Test USDC
            </a>
          </div>

          {/* Sign Out */}
          <button onClick={logout} style={styles.signOutButton}>
            🚪 Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
  },
  loadingButton: {
    padding: '10px 20px',
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #333',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  walletButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  addressContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  address: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
  },
  network: {
    color: '#10b981',
    fontSize: '11px',
    fontWeight: '500',
  },
  arrow: {
    width: '16px',
    height: '16px',
    color: '#888',
    transition: 'transform 0.2s',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: '0',
    width: '320px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    zIndex: 1000,
    overflow: 'hidden',
  },
  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #333',
  },
  avatarLarge: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '20px',
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  headerEmail: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
  },
  headerNetwork: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#10b981',
    fontSize: '12px',
    marginTop: '2px',
  },
  networkDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
  },
  section: {
    padding: '12px 16px',
    borderBottom: '1px solid #222',
  },
  sectionTitle: {
    color: '#888',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  addressRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  fullAddress: {
    color: '#6366f1',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  copyIcon: {
    fontSize: '14px',
  },
  balanceRow: {
    display: 'flex',
    gap: '12px',
  },
  balanceItem: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  balanceIcon: {
    fontSize: '24px',
  },
  balanceValue: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  balanceLabel: {
    color: '#888',
    fontSize: '11px',
  },
  actions: {
    padding: '12px 16px',
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid #222',
  },
  actionButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
    textAlign: 'center',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  signOutButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
};
