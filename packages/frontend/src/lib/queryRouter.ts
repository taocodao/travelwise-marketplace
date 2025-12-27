/**
 * LLM-based intelligent query router
 * 
 * Uses OpenAI/GPT to determine which MCP server and function to call,
 * including Perplexity for web searches.
 */

export interface RouteDecision {
  tool: 'semantic_search' | 'get_weather_forecast' | 'get_current_weather' | 'find_places' | 'get_route' | 'perplexity_search' | 'get_suggestions' | 'unknown';
  server: 'semantic' | 'weather' | 'maps' | 'perplexity' | 'none';
  params: Record<string, any>;
  reasoning: string;
  requiresMultiple?: boolean;
  additionalTools?: RouteDecision[];
}

// Available tools for the LLM to choose from
const AVAILABLE_TOOLS = `
Available MCP Servers and Tools:

1. **Semantic Location Search** (server: semantic)
   - semantic_search: Find places by description ("quiet cafe with WiFi", "romantic dinner spot")
   - get_suggestions: Get personalized recommendations based on user history
   - Params: { query: string, limit?: number }

2. **Weather MCP** (server: weather)
   - get_current_weather: Current weather conditions for a location
   - get_weather_forecast: Multi-day weather forecast (up to 7 days)
   - Params: { location: string, days?: number }

3. **Google Maps MCP** (server: maps)
   - find_places: Find places of a specific type near a location
   - get_route: Get directions between two points
   - Params: { query/type: string, location?: string }

4. **Perplexity Web Search** (server: perplexity)
   - perplexity_search: Real-time web search for current information, advice, recommendations
   - Use for: travel tips, clothing advice, current events, "what should I...", general questions
   - Params: { query: string }
`;

/**
 * Route a query using LLM to determine the best tool
 */
export async function routeQuery(query: string, apiEndpoint: string = 'http://localhost:3001'): Promise<RouteDecision> {
  try {
    const response = await fetch(`${apiEndpoint}/api/ai-agent/route-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      // Fallback to rule-based routing
      return fallbackRoute(query);
    }

    const result = await response.json();
    return result.route as RouteDecision;
  } catch (error) {
    console.error('LLM routing failed, using fallback:', error);
    return fallbackRoute(query);
  }
}

/**
 * Fallback rule-based routing when LLM is unavailable
 */
function fallbackRoute(query: string): RouteDecision {
  const lowerQuery = query.toLowerCase();

  // Trip planning / travel advice / what to bring - use Perplexity
  if (
    lowerQuery.includes('planning a trip') ||
    lowerQuery.includes('what to bring') ||
    lowerQuery.includes('what cloth') ||
    lowerQuery.includes('what to pack') ||
    lowerQuery.includes('travel tip') ||
    lowerQuery.includes('what should i') ||
    lowerQuery.includes('advice for') ||
    lowerQuery.includes('how to prepare')
  ) {
    return {
      tool: 'perplexity_search',
      server: 'perplexity',
      params: { query },
      reasoning: 'Query requires real-time web search for travel advice/tips',
    };
  }

  // Weather forecast
  if (lowerQuery.includes('weather forecast') || lowerQuery.includes('forecast')) {
    const match = query.match(/for\s+([^,\.]+)/i) || query.match(/in\s+([^,\.]+)/i);
    const location = match ? match[1].trim() : 'New York';
    return {
      tool: 'get_weather_forecast',
      server: 'weather',
      params: { location, days: 7 },
      reasoning: 'User asking for weather forecast',
    };
  }

  // Current weather
  if (lowerQuery.includes('weather')) {
    const match = query.match(/in\s+([^,\.]+)/i) || query.match(/for\s+([^,\.]+)/i);
    const location = match ? match[1].trim() : 'New York';
    return {
      tool: 'get_current_weather',
      server: 'weather',
      params: { location },
      reasoning: 'User asking for current weather',
    };
  }

  // Suggestions/recommendations
  if (lowerQuery.includes('suggest') || lowerQuery.includes('recommend me')) {
    return {
      tool: 'get_suggestions',
      server: 'semantic',
      params: {},
      reasoning: 'User wants personalized suggestions',
    };
  }

  // Location searches - semantic search
  if (
    lowerQuery.includes('find') ||
    lowerQuery.includes('search') ||
    lowerQuery.includes('cafe') ||
    lowerQuery.includes('restaurant') ||
    lowerQuery.includes('hotel') ||
    lowerQuery.includes('bar') ||
    lowerQuery.includes('gym') ||
    lowerQuery.includes('park')
  ) {
    return {
      tool: 'semantic_search',
      server: 'semantic',
      params: { query, limit: 5 },
      reasoning: 'User looking for a specific type of place',
    };
  }

  // Default to Perplexity for general questions
  return {
    tool: 'perplexity_search',
    server: 'perplexity',
    params: { query },
    reasoning: 'General question - using web search',
  };
}

/**
 * Get the system prompt for LLM query routing
 */
export function getRoutingPrompt(): string {
  return `You are a query router for an AI agent platform. Your job is to analyze user queries and determine which tool(s) should be used to answer them.

${AVAILABLE_TOOLS}

ROUTING RULES:
1. For weather questions → Use weather server
2. For finding specific places (restaurants, cafes, hotels) → Use semantic_search
3. For trip planning, travel advice, packing lists, current events → Use perplexity_search
4. For directions/routes → Use maps server
5. For personalized recommendations → Use get_suggestions
6. Complex queries may need MULTIPLE tools (e.g., "trip to Tokyo" needs weather + perplexity)

Respond with JSON:
{
  "tool": "tool_name",
  "server": "server_name",
  "params": { ... },
  "reasoning": "brief explanation",
  "requiresMultiple": true/false,
  "additionalTools": [ ... if multiple needed ... ]
}`;
}
