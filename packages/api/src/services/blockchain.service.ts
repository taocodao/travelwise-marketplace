import { ethers, Contract, Wallet } from 'ethers';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

export class BlockchainService {
  private provider?: ethers.JsonRpcProvider;
  private wallet?: Wallet;
  private identityRegistry?: Contract;
  private reputationRegistry?: Contract;
  private paymentEscrow?: Contract;
  private enabled: boolean = false;

  constructor() {
    try {
      // Check if required environment variables are set
      const privateKey = process.env.OPERATOR_PRIVATE_KEY || process.env.PRIVATE_KEY;
      const rpcUrl = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

      if (!privateKey || privateKey === 'your-private-key-here') {
        console.warn('⚠️  Blockchain service disabled: No valid private key configured');
        this.enabled = false;
        return;
      }

      // Initialize provider and wallet
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new Wallet(privateKey, this.provider);

      // Try to load contract ABIs (optional)
      const abiPath = path.join(__dirname, '../../abis');
      
      if (fs.existsSync(abiPath)) {
        this.initializeContracts(abiPath);
      } else {
        console.warn('⚠️  ABI files not found. Blockchain contracts unavailable.');
        console.warn('   Create abis/ directory with contract ABIs to enable full functionality');
      }

      this.enabled = true;
      console.log('✅ Blockchain service initialized');
      console.log(`   Wallet Address: ${this.wallet.address}`);
      console.log(`   Network: ${rpcUrl}`);
    } catch (error) {
      console.error('⚠️  Failed to initialize blockchain service:', error);
      this.enabled = false;
    }
  }

  private initializeContracts(abiPath: string): void {
    try {
      // Load ABIs if they exist
      const identityABIPath = path.join(abiPath, 'IdentityRegistry.json');
      const reputationABIPath = path.join(abiPath, 'ReputationRegistry.json');
      const escrowABIPath = path.join(abiPath, 'PaymentEscrow.json');

      if (fs.existsSync(identityABIPath)) {
        const identityABI = JSON.parse(fs.readFileSync(identityABIPath, 'utf-8'));
        this.identityRegistry = new Contract(
          process.env.IDENTITY_REGISTRY_ADDRESS || '',
          identityABI,
          this.wallet!
        );
        console.log('   ✓ Identity Registry loaded');
      }

      if (fs.existsSync(reputationABIPath)) {
        const reputationABI = JSON.parse(fs.readFileSync(reputationABIPath, 'utf-8'));
        this.reputationRegistry = new Contract(
          process.env.REPUTATION_REGISTRY_ADDRESS || '',
          reputationABI,
          this.wallet!
        );
        console.log('   ✓ Reputation Registry loaded');
      }

      if (fs.existsSync(escrowABIPath)) {
        const escrowABI = JSON.parse(fs.readFileSync(escrowABIPath, 'utf-8'));
        this.paymentEscrow = new Contract(
          process.env.PAYMENT_ESCROW_ADDRESS || '',
          escrowABI,
          this.wallet!
        );
        console.log('   ✓ Payment Escrow loaded');
      }
    } catch (error) {
      console.warn('   ⚠️  Error loading contract ABIs:', error);
    }
  }

  /**
   * Get agent reputation from blockchain
   */
  async getReputation(agentId: string | number) {
    if (!this.enabled || !this.reputationRegistry) {
      // Return mock data when blockchain is disabled
      return {
        totalFeedback: 0,
        averageScore: 0,
        lastUpdated: new Date(),
      };
    }

    try {
      const reputation = await this.reputationRegistry.getReputation(agentId);

      return {
        totalFeedback: Number(reputation.totalFeedback),
        averageScore: Number(reputation.averageScore),
        lastUpdated: new Date(Number(reputation.lastUpdated) * 1000),
      };
    } catch (error) {
      console.error('Failed to get reputation from blockchain:', error);
      return {
        totalFeedback: 0,
        averageScore: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Get feedback for an agent
   */
  async getFeedback(agentId: string | number) {
    if (!this.enabled || !this.reputationRegistry) {
      // Return empty array when blockchain is disabled
      return [];
    }

    try {
      const feedbacks = await this.reputationRegistry.getAgentFeedback(agentId);

      return feedbacks.map((f: any) => ({
        reviewer: f.reviewer,
        score: Number(f.score),
        feedbackURI: f.feedbackURI,
        proofOfPayment: f.proofOfPayment,
        timestamp: new Date(Number(f.timestamp) * 1000),
        revoked: f.revoked,
      }));
    } catch (error) {
      console.error('Failed to get feedback from blockchain:', error);
      return [];
    }
  }

  /**
   * Create escrow payment on blockchain
   */
  async createEscrowPayment(
    paymentId: string,
    payeeAddress: string,
    amount: string
  ) {
    if (!this.enabled || !this.paymentEscrow) {
      throw new Error('Blockchain service is not available. Cannot create escrow payment.');
    }

    try {
      const amountInUSDC = ethers.parseUnits(amount, 6); // USDC has 6 decimals

      const tx = await this.paymentEscrow.createPayment(
        ethers.id(paymentId), // Convert to bytes32
        payeeAddress,
        amountInUSDC
      );

      const receipt = await tx.wait();
      
      console.log(`✅ Escrow payment created: ${tx.hash}`);
      
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        success: true,
      };
    } catch (error) {
      console.error('Failed to create escrow payment:', error);
      throw error;
    }
  }

  /**
   * Release escrow payment
   */
  async releaseEscrowPayment(paymentId: string) {
    if (!this.enabled || !this.paymentEscrow) {
      throw new Error('Blockchain service is not available. Cannot release escrow payment.');
    }

    try {
      const tx = await this.paymentEscrow.releasePayment(
        ethers.id(paymentId)
      );

      const receipt = await tx.wait();
      
      console.log(`✅ Escrow payment released: ${tx.hash}`);
      
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        success: true,
      };
    } catch (error) {
      console.error('Failed to release escrow payment:', error);
      throw error;
    }
  }

  /**
   * Submit feedback to blockchain
   */
  async submitFeedback(
    agentId: number,
    score: number,
    feedbackURI: string,
    proofOfPayment: string
  ) {
    if (!this.enabled || !this.reputationRegistry) {
      throw new Error('Blockchain service is not available. Cannot submit feedback.');
    }

    try {
      const tx = await this.reputationRegistry.submitFeedback(
        agentId,
        score,
        feedbackURI,
        ethers.id(proofOfPayment)
      );

      const receipt = await tx.wait();
      
      console.log(`✅ Feedback submitted: ${tx.hash}`);
      
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        success: true,
      };
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      throw error;
    }
  }

  /**
   * Check if blockchain service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }

  /**
   * Get network info
   */
  async getNetworkInfo() {
    if (!this.enabled || !this.provider) {
      return null;
    }

    try {
      const network = await this.provider.getNetwork();
      const balance = this.wallet ? await this.provider.getBalance(this.wallet.address) : 0n;

      return {
        chainId: Number(network.chainId),
        name: network.name,
        walletAddress: this.wallet?.address,
        balance: ethers.formatEther(balance),
      };
    } catch (error) {
      console.error('Failed to get network info:', error);
      return null;
    }
  }
}

export default new BlockchainService();
