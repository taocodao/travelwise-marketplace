import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { ConversationRAG } from './conversationRag';
import { UserPreferencesService } from './userPreferences';
import { MCPOrchestrator } from './mcpOrchestrator';
import { PerplexityService } from './perplexityService';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini';

interface AgentQuery {
  userId: string;
  sessionId: string;
  query: string;
  usePerplexity?: boolean; // Optional flag
}

interface AgentResponse {
  response: string;
  mcpCalls: any[];
  perplexityUsed: boolean;
  perplexityInsights?: string[];
  cost: { totalOut: number; totalIn: number; profit: number };
  executionId: string;
}

export class AITravelAgent {
  private rag = new ConversationRAG();
  private preferences = new UserPreferencesService();
  private mcp = new MCPOrchestrator();
  private perplexity = new PerplexityService();

  async processQuery(input: AgentQuery): Promise<AgentResponse> {
    const { userId, sessionId, query, usePerplexity = true } = input;

    // 1. Log user message
    await this.logChat(sessionId, userId, 'user', query);

    // 2. Enhance query with Perplexity (if enabled)
    let perplexityContext = '';
    let perplexityInsights: string[] = [];
    let perplexityUsed = false;

    if (usePerplexity && this.shouldUsePerplexity(query)) {
      try {
        console.log('🔍 Enhancing query with Perplexity search...');
        const enhancement = await this.perplexity.enhanceQuery(query);
        perplexityContext = enhancement.context;
        perplexityInsights = enhancement.insights;
        perplexityUsed = true;
        console.log('✅ Perplexity context added');
      } catch (error) {
        console.warn('⚠️ Perplexity search failed, continuing without it');
      }
    }

    // 3. Get user preferences
    const userPrefs = await this.preferences.getPreferences(userId);

    // 4. Search similar conversations (RAG)
    const similar = await this.rag.findSimilar(query, 3);

    // 5. Plan execution with OpenAI (now with Perplexity context)
    const plan = await this.planExecution(query, userPrefs, similar, perplexityContext);

    // 6. Execute MCP calls
    const mcpResults = await this.mcp.executeCalls(plan.mcpCalls || [], userId);

    // 7. Generate response (with Perplexity insights)
    const response = await this.generateResponse(query, mcpResults, perplexityContext);

    // 8. Calculate costs (include Perplexity cost)
    const costs = this.calculateCosts(mcpResults, perplexityUsed);

    // 9. Log execution
    const execution = await this.logExecution({
      userId,
      sessionId,
      query,
      plan,
      mcpCalls: mcpResults,
      costs,
      response,
      perplexityUsed,
    });

    // 10. Log assistant response
    await this.logChat(sessionId, userId, 'assistant', response);

    // 11. Store for learning
    await this.rag.storeConversation(query, response, this.extractCategory(query));

    return {
      response,
      mcpCalls: mcpResults,
      perplexityUsed,
      perplexityInsights: perplexityUsed ? perplexityInsights : undefined,
      cost: costs,
      executionId: execution.id,
    };
  }

  private shouldUsePerplexity(query: string): boolean {
    // Use Perplexity for queries that need current information
    const needsCurrentInfo = [
      /current/i,
      /latest/i,
      /recent/i,
      /today/i,
      /now/i,
      /2025|2026/i, // Specific years
      /events/i,
      /festivals/i,
      /advisories/i,
      /covid|pandemic/i,
      /restrictions/i,
      /open|closed/i,
      /hours|schedule/i,
    ];

    return needsCurrentInfo.some(pattern => pattern.test(query));
  }

  private async planExecution(
    query: string,
    preferences: any,
    examples: any[],
    perplexityContext: string
  ) {
    const availableTools = await this.mcp.getAvailableTools();
    
    const toolDescriptions = availableTools
      .map(tool => `Server: "${tool.server}", Tool: "${tool.name}" - ${tool.description}`)
      .join('\n');

    const systemPrompt = `You are a travel planning AI agent with access to real-time web search.

${perplexityContext ? `\n🌐 CURRENT WEB CONTEXT:\n${perplexityContext}\n` : ''}

Available MCP tools:
${toolDescriptions}

User preferences: ${JSON.stringify(preferences)}
Similar conversations: ${JSON.stringify(examples.slice(0, 2).map(e => ({ q: e.question, a: e.answer })))}

CRITICAL: Tool names must be exact (no server prefix in tool field).

Return JSON:
{
  "mcpCalls": [{"server": "...", "tool": "...", "params": {}}],
  "reasoning": "..."
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content || '{}';
      let plan = JSON.parse(content);
      
      // Fix tool names
      if (plan.mcpCalls && Array.isArray(plan.mcpCalls)) {
        plan.mcpCalls = plan.mcpCalls.map((call: any) => {
          if (call.tool && call.tool.includes('.')) {
            call.tool = call.tool.split('.').pop();
          }
          return call;
        });
      }
      
      console.log('\n🤖 AI Plan:', JSON.stringify(plan, null, 2));
      
      return plan;
    } catch (error) {
      console.error('❌ Error in planExecution:', error);
      return { mcpCalls: [], reasoning: 'Error planning execution' };
    }
  }

  private async generateResponse(
    query: string,
    mcpResults: any[],
    perplexityContext: string
  ) {
    const systemPrompt = `You are a friendly travel assistant.

${perplexityContext ? `\n🌐 CURRENT WEB CONTEXT:\n${perplexityContext}\n\nUse this context to enhance your response with up-to-date information.\n` : ''}

Use the MCP results and web context to provide accurate, helpful responses.`;

    const userPrompt = `User question: ${query}

MCP Results:
${JSON.stringify(mcpResults, null, 2)}

Provide a helpful, detailed response.`;

    try {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      return completion.choices[0].message.content || 'I apologize, but I could not generate a response.';
    } catch (error) {
      console.error('❌ Error in generateResponse:', error);
      return 'I apologize, but I encountered an error generating a response.';
    }
  }

  private calculateCosts(mcpResults: any[], perplexityUsed: boolean) {
    const mcpCost = mcpResults.reduce((sum, r) => sum + (r.cost || 0), 0);
    const perplexityCost = perplexityUsed ? 0.01 : 0; // ~$0.01 per search
    
    const totalOut = mcpCost + perplexityCost;
    const totalIn = totalOut * 1.5;
    const profit = totalIn - totalOut;
    
    return { totalOut, totalIn, profit };
  }

  // ... rest of the methods remain the same
  private async logChat(sessionId: string, userId: string, role: string, message: string) {
    return prisma.chatLog.create({
      data: { sessionId, userId, role, message },
    });
  }

  private async logExecution(data: any) {
    return prisma.agentExecution.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        query: data.query,
        plan: data.plan,
        mcpCalls: data.mcpCalls,
        totalCostOut: data.costs.totalOut,
        totalCostIn: data.costs.totalIn,
        profit: data.costs.profit,
        response: data.response,
      },
    });
  }

  private extractCategory(query: string): string {
    if (/hotel|accommodation/i.test(query)) return 'hotel';
    if (/weather|forecast/i.test(query)) return 'weather';
    if (/route|direction/i.test(query)) return 'navigation';
    return 'general';
  }
}
