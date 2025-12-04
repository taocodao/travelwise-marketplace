import { ethers } from 'ethers';

const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || '';
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

const ABI = [
  "function totalAgents() view returns (uint256)",
  "function getAgentInfo(uint256) view returns (address wallet, string uri, uint256 reputation, uint256 executions, bool active)",
  "function agentWallets(uint256) view returns (address)",
  "function agentReputation(uint256) view returns (uint256)",
  "function totalExecutions(uint256) view returns (uint256)",
  "function isAgentActive(uint256) view returns (bool)",
];

export class AgentRegistryService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
    this.contract = new ethers.Contract(AGENT_REGISTRY_ADDRESS, ABI, this.provider);
  }

  async getAgentInfo(agentId: number) {
    try {
      const [wallet, uri, reputation, executions, active] = await this.contract.getAgentInfo(agentId);
      
      return {
        agentId,
        wallet,
        metadataUri: uri,
        reputation: Number(reputation),
        totalExecutions: Number(executions),
        isActive: active,
      };
    } catch (error) {
      console.error(`Error fetching agent ${agentId}:`, error);
      return null;
    }
  }

  async getAllAgents() {
    try {
      const totalAgents = await this.contract.totalAgents();
      const agents = [];

      for (let i = 1; i <= Number(totalAgents); i++) {
        const agent = await this.getAgentInfo(i);
        if (agent) agents.push(agent);
      }

      return agents;
    } catch (error) {
      console.error('Error fetching all agents:', error);
      return [];
    }
  }

  async isContractDeployed(): Promise<boolean> {
    try {
      const code = await this.provider.getCode(AGENT_REGISTRY_ADDRESS);
      return code !== '0x';
    } catch {
      return false;
    }
  }
}
