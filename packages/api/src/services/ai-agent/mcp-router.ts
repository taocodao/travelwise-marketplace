/**
 * MCP Router - Intelligent Self-Learning Query Router
 * 
 * Two-layer routing system:
 * 1. Perplexity analyzes query intent
 * 2. RouterRAG provides boosts from past successful routes
 * 3. ERC-8004 provides available MCP tools
 * 4. LLM makes final routing decision
 * 5. Feedback loop stores successful routings
 */

import OpenAI from 'openai';
import { RouterRAG, RoutingDecision, QueryIntent } from './router-rag';
import { PerplexityService } from './perplexityService';
import { erc8004RegistryService } from '../erc8004-registry.service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MCPTool {
  server: string;
  serverEndpoint: string;
  tool: string;
  description: string;
  capabilities: string[];
  cost: number;
}

export interface RoutingResult {
  routes: RoutingDecision[];
  intent: QueryIntent;
  processingTime: number;
}

export interface ExecutionResult {
  success: boolean;
  routes: RoutingDecision[];
  results: any[];
  combinedResponse: string;
  totalCost: number;
}

export class MCPRouter {
  private routerRAG = new RouterRAG();
  private perplexity = new PerplexityService();

  /**
   * Step 1: Analyze query intent with Perplexity
   */
  async analyzeQueryIntent(query: string): Promise<QueryIntent> {
    try {
      // Use Perplexity to understand the query context
      const analysis = await this.perplexity.search(
        `Analyze this user query and extract the intent. Query: "${query}". 
         What is the user trying to do? What information do they need?
         Respond with: category, sub-intents, key entities.`,
        'You are a query intent analyzer. Be concise and structured.'
      );

      // Parse intent from Perplexity response
      const intent = await this.parseIntent(query, analysis.answer);
      
      console.log(`🎯 Query intent: ${intent.category} [${intent.subIntents.join(', ')}]`);
      return intent;
    } catch (error) {
      console.error('Intent analysis failed:', error);
      return {
        category: 'general',
        subIntents: [],
        entities: {},
        complexity: 'simple',
      };
    }
  }

  /**
   * Parse Perplexity response into structured intent
   */
  private async parseIntent(query: string, perplexityAnalysis: string): Promise<QueryIntent> {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an intent parser. Extract structured intent from query analysis.
Return JSON with:
- category: one of [travel, weather, places, directions, advice, general]
- subIntents: array of specific needs [packing, forecast, hotels, restaurants, etc.]
- entities: { location?, timeframe?, placeType?, etc. }
- complexity: "simple" (one tool) or "multi-step" (multiple tools needed)`,
        },
        {
          role: 'user',
          content: `Query: "${query}"\nAnalysis: ${perplexityAnalysis}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        category: 'general',
        subIntents: [],
        entities: {},
        complexity: 'simple',
      };
    }
  }

  /**
   * Step 2: Get available MCP tools from ERC-8004 registry
   */
  async getAvailableTools(): Promise<MCPTool[]> {
    try {
      const servers = await erc8004RegistryService.discoverServers({ isActive: true });
      
      const tools: MCPTool[] = [];
      
      for (const server of servers) {
        // Add known tools for each server type
        const serverTools = this.getServerTools(server);
        tools.push(...serverTools);
      }

      // Add Perplexity as a meta-tool
      tools.push({
        server: 'perplexity',
        serverEndpoint: 'internal',
        tool: 'web_search',
        description: 'Real-time web search for current information, travel advice, packing tips, current events',
        capabilities: ['advice', 'current_info', 'travel_tips', 'general_knowledge'],
        cost: 0.02,
      });

      return tools;
    } catch (error) {
      console.error('Failed to get available tools:', error);
      return this.getDefaultTools();
    }
  }

  /**
   * Get known tools for a server
   */
  private getServerTools(server: any): MCPTool[] {
    const toolMap: Record<string, MCPTool[]> = {
      'weather': [
        {
          server: 'weather',
          serverEndpoint: server.endpoint,
          tool: 'get_current_weather',
          description: 'Get current weather conditions for a location',
          capabilities: ['weather', 'current'],
          cost: 0.01,
        },
        {
          server: 'weather',
          serverEndpoint: server.endpoint,
          tool: 'get_weather_forecast',
          description: 'Get multi-day weather forecast for trip planning',
          capabilities: ['weather', 'forecast', 'travel'],
          cost: 0.02,
        },
      ],
      'semantic-location': [
        {
          server: 'semantic-location',
          serverEndpoint: server.endpoint,
          tool: 'semantic_search',
          description: 'AI-powered location search with natural language',
          capabilities: ['places', 'restaurants', 'hotels', 'cafes'],
          cost: 0.03,
        },
      ],
      'google-maps': [
        {
          server: 'google-maps',
          serverEndpoint: server.endpoint,
          tool: 'find_places',
          description: 'Find places of a specific type near a location',
          capabilities: ['places', 'nearby'],
          cost: 0.032,
        },
        {
          server: 'google-maps',
          serverEndpoint: server.endpoint,
          tool: 'get_route',
          description: 'Get directions between two locations',
          capabilities: ['directions', 'route', 'navigation'],
          cost: 0.05,
        },
      ],
    };

    return toolMap[server.name] || [];
  }

  /**
   * Default tools when registry fails
   */
  private getDefaultTools(): MCPTool[] {
    return [
      {
        server: 'weather',
        serverEndpoint: 'http://localhost:3004',
        tool: 'get_weather_forecast',
        description: 'Weather forecast for trip planning',
        capabilities: ['weather', 'forecast'],
        cost: 0.02,
      },
      {
        server: 'semantic-location',
        serverEndpoint: 'http://localhost:3005',
        tool: 'semantic_search',
        description: 'Find places with natural language',
        capabilities: ['places'],
        cost: 0.03,
      },
      {
        server: 'perplexity',
        serverEndpoint: 'internal',
        tool: 'web_search',
        description: 'Web search for advice and current info',
        capabilities: ['advice', 'general'],
        cost: 0.02,
      },
    ];
  }

  /**
   * Step 3: Make routing decision with LLM
   */
  async routeQuery(query: string): Promise<RoutingResult> {
    const startTime = Date.now();

    // 1. Analyze intent with Perplexity
    const intent = await this.analyzeQueryIntent(query);

    // 2. Get available tools
    const tools = await this.getAvailableTools();

    // 3. Get routing boosts from history
    const boosts = await this.routerRAG.getRoutingBoosts(query);

    // 4. Make LLM routing decision
    const routes = await this.makeRoutingDecision(query, intent, tools, boosts);

    return {
      routes,
      intent,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * LLM makes final routing decision
   */
  private async makeRoutingDecision(
    query: string,
    intent: QueryIntent,
    tools: MCPTool[],
    boosts: Map<string, number>
  ): Promise<RoutingDecision[]> {
    // Build tool descriptions for LLM
    const toolDescriptions = tools.map(t => {
      const boostKey = `${t.server}:${t.tool}`;
      const boost = boosts.get(boostKey) || 0;
      return `- ${t.server}.${t.tool}: ${t.description} (capabilities: ${t.capabilities.join(', ')})${boost > 0 ? ` [BOOSTED +${(boost * 100).toFixed(0)}%]` : ''}`;
    }).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an MCP router. Select the best tool(s) to handle user queries.

Available Tools:
${toolDescriptions}

Rules:
1. For travel planning queries → use weather + perplexity.web_search
2. For finding places, cafes, restaurants → use semantic_search
3. For directions → use get_route
4. Tools marked [BOOSTED] performed well for similar queries
5. Complex queries may need multiple tools executed in parallel

IMPORTANT: Always include the original user query in params.query for semantic_search.

Return JSON with a "routes" array of routing decisions:
{"routes": [{ "server": "...", "tool": "...", "params": {"query": "original user query", ...}, "confidence": 0.0-1.0, "reason": "..." }]}`,
        },
        {
          role: 'user',
          content: `Query: "${query}"
Intent: ${JSON.stringify(intent)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    try {
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      const routes = result.routes || result.decisions || [result];
      return Array.isArray(routes) ? routes : [routes];
    } catch {
      // Fallback routing
      return [{
        server: 'perplexity',
        tool: 'web_search',
        params: { query },
        confidence: 0.5,
        reason: 'Fallback to web search',
      }];
    }
  }

  /**
   * Execute routed tools and learn from results
   */
  async executeAndLearn(
    query: string,
    userId?: string
  ): Promise<ExecutionResult> {
    // 1. Route the query
    const routing = await this.routeQuery(query);
    
    // 2. Execute tools in parallel with automatic logging
    const results: any[] = [];
    let totalCost = 0;

    for (const route of routing.routes) {
      const startTime = Date.now();
      try {
        const result = await this.executeTool(route);
        const latencyMs = Date.now() - startTime;
        
        results.push({ route, result, latencyMs });
        totalCost += this.getToolCost(route);

        // Automatic execution logging for AI reputation (no human intervention)
        await this.logExecutionForReputation({
          serverId: route.server,
          serverName: route.server,
          toolName: route.tool,
          success: true,
          latencyMs,
          userId,
          query,
        });
      } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        results.push({ route, error: error.message, latencyMs });

        // Log failure for AI analysis
        await this.logExecutionForReputation({
          serverId: route.server,
          serverName: route.server,
          toolName: route.tool,
          success: false,
          latencyMs,
          errorMessage: error.message,
          userId,
          query,
        });
      }
    }

    // 3. Combine results
    const combinedResponse = await this.combineResults(query, results);

    // 4. Store routing for learning (assumed successful if we got results)
    const success = results.some(r => !r.error);
    await this.routerRAG.storeRouting(query, routing.routes, success, userId);

    return {
      success,
      routes: routing.routes,
      results,
      combinedResponse,
      totalCost,
    };
  }

  /**
   * Log execution for AI reputation building (no human intervention)
   */
  private async logExecutionForReputation(log: {
    serverId: string;
    serverName: string;
    toolName: string;
    success: boolean;
    latencyMs: number;
    errorMessage?: string;
    userId?: string;
    query?: string;
  }): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { executionLogger } = await import('./execution-logger');
      await executionLogger.logExecution(log);
    } catch (error) {
      // Silently fail - don't break execution for logging
      console.log(`📊 Execution: ${log.serverName}.${log.toolName} - ${log.success ? '✅' : '❌'}`);
    }
  }

  /**
   * Execute a single tool via HTTP call to MCP server
   */
  private async executeTool(route: RoutingDecision): Promise<any> {
    // Handle Perplexity (internal service)
    if (route.server === 'perplexity') {
      return this.perplexity.search(route.params.query || JSON.stringify(route.params));
    }

    // MCP servers are mounted inside the main API at /mcp/{server-name}
    // Base URL for the API
    const baseUrl = process.env.API_URL || 'http://localhost:3001';
    
    // Map server names to their mounted MCP paths
    const serverPaths: Record<string, string> = {
      'weather': '/mcp/semantic-location-mcp',  // Weather is part of semantic-location
      'semantic-location': '/mcp/semantic-location-mcp',
      'semantic_search': '/mcp/semantic-location-mcp',
      'google-maps': '/mcp/google-maps-platform',
      'google-maps-platform': '/mcp/google-maps-platform',
    };

    // Handle perplexity internally (not an external MCP server)
    if (route.server === 'perplexity' || route.server.includes('perplexity')) {
      console.log(`🔍 Routing to internal Perplexity service`);
      const query = route.params?.query || JSON.stringify(route.params);
      return this.perplexity.search(query);
    }

    // Map generic tool names to actual endpoint names
    const toolNameMap: Record<string, Record<string, string>> = {
      'weather': {
        'weather': 'get_weather_forecast',
        'forecast': 'get_weather_forecast',
        'current': 'get_current_weather',
        'get_forecast': 'get_weather_forecast',
      }
    };

    // Get actual tool name (may need remapping)
    let actualToolName = route.tool;
    if (toolNameMap[route.server]?.[route.tool]) {
      actualToolName = toolNameMap[route.server][route.tool];
      console.log(`  📝 Remapped ${route.tool} → ${actualToolName}`);
    }

    const serverPath = serverPaths[route.server];
    
    if (!serverPath) {
      console.error(`❌ Unknown server: ${route.server}`);
      return { success: false, error: `Unknown MCP server: ${route.server}` };
    }

    const endpoint = `${baseUrl}${serverPath}`;
    
    if (!endpoint) {
      console.error(`❌ Unknown server: ${route.server}`);
      return { success: false, error: `Unknown MCP server: ${route.server}` };
    }

    try {
      const axios = (await import('axios')).default;
      
      console.log(`🔧 Calling ${route.server}.${actualToolName} at ${endpoint}/tools/${actualToolName}`);
      
      const response = await axios.post(
        `${endpoint}/tools/${actualToolName}`,
        route.params,
        { 
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      console.log(`✅ ${route.server}.${actualToolName} returned successfully`);
      return { ...response.data, tool: route.tool, success: true };
    } catch (error: any) {
      console.error(`❌ ${route.server}.${actualToolName} failed:`, error.message);
      return { 
        success: false, 
        error: error.message,
        tool: route.tool 
      };
    }
  }

  /**
   * Get cost for a tool
   */
  private getToolCost(route: RoutingDecision): number {
    const costs: Record<string, number> = {
      'get_weather_forecast': 0.02,
      'get_current_weather': 0.01,
      'semantic_search': 0.03,
      'find_places': 0.032,
      'get_route': 0.05,
      'web_search': 0.02,
    };
    return costs[route.tool] || 0.02;
  }

  /**
   * Combine results from multiple tools
   * Uses Perplexity for free text generation (saved $)
   */
  private async combineResults(query: string, results: any[]): Promise<string> {
    const prompt = `Combine these results from multiple MCP tools into a helpful response for the query: "${query}"

Results:
${JSON.stringify(results, null, 2)}

Be concise but comprehensive. Format as a clear, readable response.`;

    const response = await this.perplexity.search(prompt, 'Combine and summarize search results');
    return response.answer || 'No response generated';
  }

  /**
   * Record user feedback on routing
   */
  async recordFeedback(query: string, feedback: 'positive' | 'negative'): Promise<void> {
    await this.routerRAG.recordFeedback(query, feedback);
  }
}

export const mcpRouter = new MCPRouter();
