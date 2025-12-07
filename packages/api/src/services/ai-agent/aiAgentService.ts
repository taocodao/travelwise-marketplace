import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { ConversationRAG } from './conversationRag';
import { UserPreferencesService } from './userPreferences';
import { MCPOrchestrator } from './mcpOrchestrator';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AgentQuery {
  userId: string;
  sessionId: string;
  query: string;
}

interface AgentResponse {
  response: string;
  mcpCalls: any[];
  cost: { totalOut: number; totalIn: number; profit: number };
  executionId: string;
}

export class AITravelAgent {
  private rag = new ConversationRAG();
  private preferences = new UserPreferencesService();
  private mcp = new MCPOrchestrator();

  async processQuery(input: AgentQuery): Promise<AgentResponse> {
    const { userId, sessionId, query } = input;

    // 1. Log user message
    await this.logChat(sessionId, userId, 'user', query);

    // 2. Get user preferences
    const userPrefs = await this.preferences.getPreferences(userId);

    // 3. Search similar conversations (RAG)
    const similar = await this.rag.findSimilar(query, 3);

    // 4. Plan execution with OpenAI
    const plan = await this.planExecution(query, userPrefs, similar);

    // 5. Execute MCP calls
    const mcpResults = await this.mcp.executeCalls(plan.mcpCalls || [], userId);

    // 6. Generate response
    const response = await this.generateResponse(query, mcpResults);

    // 7. Calculate costs
    const costs = this.calculateCosts(mcpResults);

    // 8. Log execution
    const execution = await this.logExecution({
      userId,
      sessionId,
      query,
      plan,
      mcpCalls: mcpResults,
      costs,
      response,
    });

    // 9. Log assistant response
    await this.logChat(sessionId, userId, 'assistant', response);

    // 10. Store for learning
    await this.rag.storeConversation(query, response, this.extractCategory(query));

    return {
      response,
      mcpCalls: mcpResults,
      cost: costs,
      executionId: execution.id,
    };
  }

  private async logChat(sessionId: string, userId: string, role: string, message: string) {
    return prisma.chatLog.create({
      data: { sessionId, userId, role, message },
    });
  }

  private async planExecution(query: string, preferences: any, examples: any[]) {
    const systemPrompt = `You are a travel AI agent with access to:
- google-maps: search_places, get_route, get_place_details
- weather: get_forecast, get_current_weather
- travel-agent: create_itinerary, suggest_activities

User preferences: ${JSON.stringify(preferences)}
Similar conversations: ${JSON.stringify(examples.slice(0, 2).map(e => ({ q: e.question, a: e.answer })))}

Return JSON: { mcpCalls: [{ server, tool, params }], reasoning: string }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(completion.choices[0].message.content || '{ "mcpCalls": [] }');
  }

  private async generateResponse(query: string, mcpResults: any[]) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful travel assistant. Use MCP results to provide detailed answers.',
        },
        {
          role: 'user',
          content: `Question: ${query}\n\nMCP Results:\n${JSON.stringify(mcpResults, null, 2)}`,
        },
      ],
    });

    return completion.choices[0].message.content || '';
  }

  private calculateCosts(mcpResults: any[]) {
    const totalOut = mcpResults.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalIn = totalOut * 1.5;
    const profit = totalIn - totalOut;
    return { totalOut, totalIn, profit };
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
