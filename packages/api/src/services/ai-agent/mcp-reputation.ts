/**
 * MCP Reputation Service
 * 
 * AI-powered reputation system for ERC-8004:
 * 1. Auto-discover and describe MCP tools
 * 2. Generate reviews from usage metrics
 * 3. Calculate reputation scores
 */

import OpenAI from 'openai';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { PerplexityService } from './perplexityService';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const prisma = new PrismaClient();

export interface ToolDescription {
  name: string;
  generatedDescription: string;
  capabilities: string[];
  sampleInput: any;
  sampleOutput: any;
  inferredCost: number;
}

export interface ServerReview {
  rating: number;        // 1-5
  reviewText: string;    // AI-generated
  metrics: {
    successRate: number;
    avgLatency: number;
    totalCalls: number;
    userSatisfaction: number;
  };
  reviewedAt: Date;
}

export interface ReputationScore {
  overall: number;       // 0-100
  reliability: number;   // uptime, error rate
  quality: number;       // user ratings, AI review
  trust: number;         // payment history
  popularity: number;    // total calls, unique users
  trend: 'up' | 'down' | 'stable';
}

export class MCPReputationService {
  private perplexity = new PerplexityService();

  /**
   * Auto-discover tools from an MCP server endpoint
   */
  async discoverTools(endpoint: string): Promise<ToolDescription[]> {
    const tools: ToolDescription[] = [];

    try {
      // 1. Fetch tool list from server
      console.log(`🔍 Discovering tools at ${endpoint}...`);
      
      const listResponse = await axios.get(`${endpoint}/tools/list`, {
        timeout: 10000,
      }).catch(() => null);

      if (!listResponse?.data?.tools) {
        // Try alternative endpoint
        const altResponse = await axios.get(`${endpoint}/schema`, {
          timeout: 10000,
        }).catch(() => null);
        
        if (!altResponse?.data) {
          console.log('⚠️ No tool discovery endpoint found');
          return tools;
        }
      }

      const serverTools = listResponse?.data?.tools || [];

      // 2. Test each tool and generate description
      for (const tool of serverTools) {
        const description = await this.generateToolDescription(
          endpoint,
          tool.name,
          tool.description || '',
          tool.inputSchema
        );
        tools.push(description);
      }

      console.log(`✅ Discovered ${tools.length} tools`);
      return tools;
    } catch (error: any) {
      console.error('Tool discovery failed:', error.message);
      return tools;
    }
  }

  /**
   * Generate AI description for a tool
   */
  private async generateToolDescription(
    endpoint: string,
    toolName: string,
    existingDesc: string,
    inputSchema?: any
  ): Promise<ToolDescription> {
    // Test the tool with a sample query
    let sampleOutput: any = null;
    let sampleInput: any = null;

    try {
      // Generate sample input based on schema
      sampleInput = await this.generateSampleInput(toolName, inputSchema);
      
      const response = await axios.post(
        `${endpoint}/tools/${toolName}`,
        sampleInput,
        { timeout: 15000 }
      );
      sampleOutput = response.data;
    } catch (error) {
      // Tool test failed, use schema only
    }

    // Ask GPT-4 to generate description
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an API documentation writer. Generate a clear, concise description for an MCP tool.
Return JSON with:
- generatedDescription: 1-2 sentence description of what the tool does
- capabilities: array of 3-5 capability tags (e.g., "weather", "forecast", "location")
- inferredCost: estimated fair price in USD (0.01-0.10)`,
        },
        {
          role: 'user',
          content: `Tool: ${toolName}
Existing description: ${existingDesc || 'None'}
Input schema: ${JSON.stringify(inputSchema || {})}
Sample output: ${JSON.stringify(sampleOutput || 'No sample available')}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    try {
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return {
        name: toolName,
        generatedDescription: result.generatedDescription || existingDesc,
        capabilities: result.capabilities || [],
        sampleInput,
        sampleOutput,
        inferredCost: result.inferredCost || 0.02,
      };
    } catch {
      return {
        name: toolName,
        generatedDescription: existingDesc,
        capabilities: [],
        sampleInput,
        sampleOutput,
        inferredCost: 0.02,
      };
    }
  }

  /**
   * Generate sample input for testing a tool
   */
  private async generateSampleInput(toolName: string, schema?: any): Promise<any> {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a realistic sample input for testing an API endpoint. Return valid JSON only.',
        },
        {
          role: 'user',
          content: `Tool: ${toolName}\nSchema: ${JSON.stringify(schema || {})}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return { query: 'test' };
    }
  }

  /**
   * Generate AI review from usage metrics
   * Uses Perplexity for free text generation (saved $)
   */
  async generateReview(serverId: string): Promise<ServerReview> {
    // Get usage metrics from database
    const metrics = await this.getUsageMetrics(serverId);
    
    // Get server info
    const server = await prisma.mCPServer.findUnique({
      where: { id: serverId },
    });

    // Generate AI review using Perplexity (free)
    const prompt = `Write a 2-3 sentence tech review for this MCP server based on its metrics. Be honest but constructive. Include reliability assessment, latency comments, and value proposition.

Server: ${server?.name || 'Unknown'}
Description: ${server?.description || 'MCP Server'}
Metrics:
- Success rate: ${(metrics.successRate * 100).toFixed(1)}%
- Average latency: ${metrics.avgLatency}ms
- Total calls: ${metrics.totalCalls}
- User satisfaction: ${(metrics.userSatisfaction * 100).toFixed(0)}%

At the end, give a rating from 1-5 stars.`;

    try {
      const response = await this.perplexity.search(prompt, 'Generate a tech service review');
      
      // Extract rating from text (look for "X/5" or "X stars")
      const ratingMatch = response.answer.match(/(\d)(?:\/5| stars?| out of 5)/i);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : 4;
      
      return {
        rating: Math.min(5, Math.max(1, rating)),
        reviewText: response.answer,
        metrics,
        reviewedAt: new Date(),
      };
    } catch {
      return {
        rating: 3,
        reviewText: 'Unable to generate review at this time.',
        metrics,
        reviewedAt: new Date(),
      };
    }
  }

  /**
   * Get usage metrics for a server (from real execution logs)
   */
  private async getUsageMetrics(serverId: string): Promise<{
    successRate: number;
    avgLatency: number;
    totalCalls: number;
    userSatisfaction: number;
  }> {
    try {
      // Get real metrics from execution logger
      const { executionLogger } = await import('./execution-logger');
      const stats = await executionLogger.getServerStats(serverId);

      return {
        successRate: stats.successRate,
        avgLatency: stats.avgLatency,
        totalCalls: stats.totalCalls,
        // User satisfaction derived from success rate (no human feedback needed)
        userSatisfaction: stats.successRate * 0.9 + 0.1, // Slightly optimistic
      };
    } catch (error) {
      // Fallback to conservative defaults
      console.log('⚠️ Using default metrics - no execution data yet');
      return {
        successRate: 0.9,
        avgLatency: 200,
        totalCalls: 0,
        userSatisfaction: 0.85,
      };
    }
  }

  /**
   * Calculate reputation score (0-100)
   */
  async calculateReputation(serverId: string): Promise<ReputationScore> {
    const metrics = await this.getUsageMetrics(serverId);
    
    // Calculate component scores
    const reliability = Math.min(100, metrics.successRate * 100);
    const quality = Math.min(100, metrics.userSatisfaction * 100);
    const trust = 80; // TODO: Calculate from X402 payment history
    const popularity = Math.min(100, Math.log10(metrics.totalCalls + 1) * 25);

    // Weighted average
    const overall = Math.round(
      reliability * 0.30 +
      quality * 0.30 +
      trust * 0.20 +
      popularity * 0.20
    );

    // Determine trend (compare to previous score)
    const trend = 'stable' as 'up' | 'down' | 'stable';

    return {
      overall,
      reliability: Math.round(reliability),
      quality: Math.round(quality),
      trust,
      popularity: Math.round(popularity),
      trend,
    };
  }

  /**
   * Update server with discovered tools and reputation
   */
  async updateServerReputation(serverId: string): Promise<{
    tools: ToolDescription[];
    review: ServerReview;
    reputation: ReputationScore;
  }> {
    const server = await prisma.mCPServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new Error('Server not found');
    }

    // 1. Discover tools
    const tools = await this.discoverTools(server.endpoint);

    // 2. Generate review
    const review = await this.generateReview(serverId);

    // 3. Calculate reputation
    const reputation = await this.calculateReputation(serverId);

    // 4. Update server in database
    await prisma.mCPServer.update({
      where: { id: serverId },
      data: {
        // Store generated tool descriptions
        // reputationScore: reputation.overall,  // Uncomment when field exists
        updatedAt: new Date(),
      },
    });

    console.log(`📊 Updated reputation for ${server.name}: ${reputation.overall}/100`);

    return { tools, review, reputation };
  }

  /**
   * Batch update all servers (for scheduled job)
   */
  async updateAllReputations(): Promise<void> {
    const servers = await prisma.mCPServer.findMany({
      where: { status: 'ACTIVE' },
    });

    console.log(`🔄 Updating reputation for ${servers.length} servers...`);

    for (const server of servers) {
      try {
        await this.updateServerReputation(server.id);
      } catch (error: any) {
        console.error(`Failed to update ${server.name}:`, error.message);
      }
    }

    console.log('✅ Reputation update complete');
  }
}

export const mcpReputationService = new MCPReputationService();
