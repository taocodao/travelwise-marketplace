import axios from 'axios';

interface MCPCall {
  server: string;
  tool: string;
  params: any;
}

interface MCPResult {
  server: string;
  tool: string;
  success: boolean;
  data: any;
  cost: number;
  timestamp: string;
}

export class MCPOrchestrator {
  private serverUrls = {
    'google-maps': process.env.GOOGLE_MAPS_MCP_URL || 'http://localhost:3003',
    'weather': process.env.WEATHER_MCP_URL || 'http://localhost:3004',
    'travel-agent': process.env.TRAVEL_AGENT_MCP_URL || 'http://localhost:3005',
  };

  async executeCalls(mcpCalls: MCPCall[], userId: string): Promise<MCPResult[]> {
    const results: MCPResult[] = [];

    for (const call of mcpCalls) {
      try {
        const result = await this.executeCall(call, userId);
        results.push(result);
      } catch (error: any) {
        console.error(`❌ MCP call failed: ${call.server}/${call.tool}`, error.message);
        results.push({
          server: call.server,
          tool: call.tool,
          success: false,
          data: { error: error.message },
          cost: 0,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  private async executeCall(call: MCPCall, userId: string): Promise<MCPResult> {
    const serverUrl = this.serverUrls[call.server as keyof typeof this.serverUrls];
    
    if (!serverUrl) {
      throw new Error(`Unknown MCP server: ${call.server}`);
    }

    // Check server health first
    try {
      await axios.get(`${serverUrl}/health`, { timeout: 2000 });
    } catch (error) {
      throw new Error(`MCP server ${call.server} is not running on ${serverUrl}`);
    }

    // Construct the correct endpoint: /tools/{tool_name}
    const endpoint = `${serverUrl}/tools/${call.tool}`;
    
    console.log(`🔧 Calling MCP: ${call.server}.${call.tool} -> ${endpoint}`);
    console.log(`📦 Params:`, JSON.stringify(call.params, null, 2));

    const response = await axios.post(endpoint, call.params, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
    });

    const data = response.data;
    
    console.log(`✅ MCP response from ${call.server}.${call.tool}:`, data.success !== false ? 'SUCCESS' : 'FAILED');

    return {
      server: call.server,
      tool: call.tool,
      success: data.success !== false,
      data: data,
      cost: data.pricing?.base_cost || data.pricing?.total_charge || 0,
      timestamp: data.timestamp || new Date().toISOString(),
    };
  }

  async getAvailableTools(): Promise<any[]> {
    const allTools: any[] = [];

    for (const [serverName, serverUrl] of Object.entries(this.serverUrls)) {
      try {
        const response = await axios.get(`${serverUrl}/tools`, { timeout: 5000 });
        const tools = response.data.tools || [];
        
        tools.forEach((tool: any) => {
          allTools.push({
            server: serverName,
            ...tool,
          });
        });
      } catch (error) {
        console.warn(`⚠️ Could not fetch tools from ${serverName}:`, error);
      }
    }

    return allTools;
  }

  async checkServersHealth(): Promise<{ [key: string]: boolean }> {
    const health: { [key: string]: boolean } = {};

    for (const [serverName, serverUrl] of Object.entries(this.serverUrls)) {
      try {
        await axios.get(`${serverUrl}/health`, { timeout: 2000 });
        health[serverName] = true;
        console.log(`✅ ${serverName}: healthy`);
      } catch (error) {
        health[serverName] = false;
        console.log(`❌ ${serverName}: not running`);
      }
    }

    return health;
  }
}
