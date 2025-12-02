'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { adminAPI } from '@/lib/api';
import { Navigation } from '@/components/admin/Navigation';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';

export default function WalletSetup() {
  const { address } = useAccount();
  const [operatorWallet, setOperatorWallet] = useState('');
  const [escrowContract, setEscrowContract] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { config } = await adminAPI.getWalletConfig();
      if (config) {
        setOperatorWallet(config.operatorWallet);
        setEscrowContract(config.escrowContract);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await adminAPI.configureWallet(operatorWallet, escrowContract);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 px-8 py-4">
        <h1 className="text-xl font-bold text-white">Wallet Setup</h1>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <Navigation />

        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">
            Configure Payment Wallets
          </h2>

          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center space-x-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span>Configuration saved successfully!</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Operator Wallet Address
              </label>
              <input
                type="text"
                value={operatorWallet}
                onChange={(e) => setOperatorWallet(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="mt-2 text-sm text-gray-400">
                This wallet will receive platform fees from all transactions
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Escrow Contract Address
              </label>
              <input
                type="text"
                value={escrowContract}
                onChange={(e) => setEscrowContract(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="mt-2 text-sm text-gray-400">
                PaymentEscrow smart contract deployed on Base Sepolia
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-400 mb-2">
                Connected Wallet
              </h3>
              <p className="text-sm text-gray-300 font-mono">{address}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
