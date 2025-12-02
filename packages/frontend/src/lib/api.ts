import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Admin API
export const adminAPI = {
  // Wallet configuration
  configureWallet: async (operatorWallet: string, escrowContract: string) => {
    const response = await api.post('/admin/wallet/configure', {
      operatorWallet,
      escrowContract,
    });
    return response.data;
  },

  getWalletConfig: async () => {
    const response = await api.get('/admin/wallet/config');
    return response.data;
  },

  // Pricing configuration
  configurePricing: async (marginPercent: number, platformFee: number, updatedBy: string) => {
    const response = await api.post('/admin/pricing/configure', {
      marginPercent,
      platformFee,
      updatedBy,
    });
    return response.data;
  },

  getPricingConfig: async () => {
    const response = await api.get('/admin/pricing/config');
    return response.data;
  },

  // Tool pricing
  updateToolPricing: async (toolId: string, baseCost: number) => {
    const response = await api.put('/admin/pricing/tool', {
      toolId,
      baseCost,
    });
    return response.data;
  },

  getAllTools: async () => {
    const response = await api.get('/admin/pricing/tools');
    return response.data;
  },

  // Dashboard stats
  getDashboardStats: async () => {
    const response = await api.get('/admin/dashboard/stats');
    return response.data;
  },
};

// Marketplace API
export const marketplaceAPI = {
  getAgents: async (filters?: { specialization?: string; minReputation?: number }) => {
    const response = await api.get('/marketplace/agents', { params: filters });
    return response.data;
  },

  getAgentDetails: async (agentId: string) => {
    const response = await api.get(`/marketplace/agents/${agentId}`);
    return response.data;
  },

  getToolPricing: async (toolId: string) => {
    const response = await api.get(`/marketplace/pricing/${toolId}`);
    return response.data;
  },
};

// Payment API
export const paymentAPI = {
  getPaymentRequirements: async (toolId: string, agentId: string) => {
    const response = await api.post('/payments/requirements', {
      toolId,
      agentId,
    });
    return response.data;
  },

  verifyPayment: async (paymentHeader: string, executionId: string) => {
    const response = await api.post('/payments/verify', {
      paymentHeader,
      executionId,
    });
    return response.data;
  },

  settlePayment: async (executionId: string) => {
    const response = await api.post(`/payments/settle/${executionId}`);
    return response.data;
  },
};
