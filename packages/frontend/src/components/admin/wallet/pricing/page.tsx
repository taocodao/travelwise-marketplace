'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { adminAPI } from '@/lib/api';
import { Navigation } from '@/components/admin/Navigation';
import { Save, Edit, CheckCircle, AlertCircle } from 'lucide-react';

export default function PricingConfig() {
  const { address } = useAccount();
  const [marginPercent, setMarginPercent] = useState(20);
  const [platformFee, setPlatformFee] = useState(1);
  const [tools, setTools] = useState<any[]>([]);
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadConfig();
    loadTools();
  }, []);

  const loadConfig = async () => {
    try {
      const { config } = await adminAPI.getPricingConfig();
      setMarginPercent(parseFloat(config.marginPercent) || 20);
      setPlatformFee(parseFloat(config.platformFee) || 1);
    } catch (error) {
      console.error('Failed to load pricing config:', error);
    }
  };

  const loadTools = async () => {
    try {
      const { tools } = await adminAPI.getAllTools();
      setTools(tools);
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await adminAPI.configurePricing(marginPercent, platformFee, address || '');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateToolPrice = async (toolId: string) => {
    try {
      await adminAPI.updateToolPricing(toolId, parseFloat(editPrice));
      setEditingTool(null);
      setEditPrice('');
      loadTools();
    } catch (error) {
      console.error('Failed to update tool price:', error);
    }
  };

  const calculateFinalPrice = (baseCost: number) => {
    const margin = baseCost * (marginPercent / 100);
    const total = baseCost + margin;
    return total.toFixed(6);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 px-8 py-4">
        <h1 className="text-xl font-bold text-white">Pricing Configuration</h1>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <Navigation />

        {/* Global Pricing Config */}
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">
            Global Pricing Rules
          </h2>

          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center space-x-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span>Configuration saved!</span>
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent Margin (%)
                </label>
                <input
                  type="number"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(parseFloat(e.target.value))}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Profit margin added to base API costs
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Platform Fee (%)
                </label>
                <input
                  type="number"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(parseFloat(e.target.value))}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Marketplace commission on total cost
                </p>
              </div>
            </div>

            {/* Example Calculation */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-400 mb-3">
                Example Calculation
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Base API Cost:</span>
                  <span className="font-mono">$0.037</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Agent Margin ({marginPercent}%):</span>
                  <span className="font-mono">
                    ${(0.037 * (marginPercent / 100)).toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-white border-t border-blue-500/20 pt-2">
                  <span>Total User Pays:</span>
                  <span className="font-mono">
                    ${(0.037 * (1 + marginPercent / 100)).toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Platform Fee ({platformFee}%):</span>
                  <span className="font-mono">
                    ${(0.037 * (1 + marginPercent / 100) * (platformFee / 100)).toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </form>
        </div>

        {/* MCP Tool Pricing */}
        <div className="bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6">
            MCP Tool Pricing
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Tool Name
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Agent
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Base Cost
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Final Price
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.id} className="border-b border-gray-700">
                    <td className="py-3 px-4 text-white">{tool.name}</td>
                    <td className="py-3 px-4 text-gray-300">
                      {tool.mcpServer.agent.name}
                    </td>
                    <td className="py-3 px-4">
                      {editingTool === tool.id ? (
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          step="0.000001"
                          className="w-32 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                        />
                      ) : (
                        <span className="text-gray-300 font-mono">
                          ${parseFloat(tool.baseCost).toFixed(6)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-green-400 font-mono">
                      ${calculateFinalPrice(parseFloat(tool.baseCost))}
                    </td>
                    <td className="py-3 px-4">
                      {editingTool === tool.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUpdateToolPrice(tool.id)}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingTool(null);
                              setEditPrice('');
                            }}
                            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingTool(tool.id);
                            setEditPrice(tool.baseCost);
                          }}
                          className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
