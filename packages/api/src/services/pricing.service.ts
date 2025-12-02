import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

interface PricingResult {
  baseCost: number;
  margin: number;
  marginPercent: number;
  totalCost: number;
  platformFee: number;
  agentEarnings: number;
  currency: string;
}

const prisma = new PrismaClient();

export class PricingService {
  /**
   * Calculate total pricing with margin
   */
  async calculatePricing(baseCost: string | Decimal): Promise<PricingResult> {
    const pricingConfig = await prisma.pricingConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    // Convert Decimal to number if needed
    const marginPercent = pricingConfig?.marginPercent 
      ? (pricingConfig.marginPercent instanceof Decimal 
          ? pricingConfig.marginPercent.toNumber() 
          : Number(pricingConfig.marginPercent))
      : 20;

    const platformFeePercent = pricingConfig?.platformFee
      ? (pricingConfig.platformFee instanceof Decimal
          ? pricingConfig.platformFee.toNumber()
          : Number(pricingConfig.platformFee))
      : 1;

    // Convert base cost to number
    const base = typeof baseCost === 'string' 
      ? parseFloat(baseCost) 
      : baseCost.toNumber();

    // Perform calculations with numbers
    const margin = base * (marginPercent / 100);
    const totalCost = base + margin;
    const platformFee = totalCost * (platformFeePercent / 100);
    const agentEarnings = totalCost - platformFee;

    return {
      baseCost: base,
      margin,
      marginPercent,
      totalCost,
      platformFee,
      agentEarnings,
      currency: 'USDC',
    };
  }

  /**
   * Get pricing for a specific tool
   */
  async getToolPricing(toolId: string): Promise<PricingResult> {
    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
    });

    if (!tool) {
      throw new Error('Tool not found');
    }

    return this.calculatePricing(tool.baseCost);
  }

  /**
   * Get current pricing configuration
   */
  async getPricingConfig() {
    const config = await prisma.pricingConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      return {
        marginPercent: 20,
        platformFee: 1,
      };
    }

    return {
      marginPercent: config.marginPercent instanceof Decimal 
        ? config.marginPercent.toNumber() 
        : Number(config.marginPercent),
      platformFee: config.platformFee instanceof Decimal
        ? config.platformFee.toNumber()
        : Number(config.platformFee),
    };
  }
}

export default new PricingService();
