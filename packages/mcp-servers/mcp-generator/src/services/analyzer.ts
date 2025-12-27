
import { callLLM } from './llm';

export interface ApiAnalysis {
  name: string;
  description: string;
  endpoints: Array<{
    path: string;
    method: string;
    summary: string;
    needsTool: boolean;
    toolName?: string;
    toolDescription?: string;
  }>;
}

export const analyzeApi = async (specContent: string, url: string): Promise<ApiAnalysis> => {
  const systemPrompt = `You are an expert API Analyst. Your job is to analyze an OpenAPI/Swagger specification (or raw API documentation) and determine which endpoints should be exposed as MCP (Model Context Protocol) Tools.
  
  Rules:
  1. Identify the main purpose of the API.
  2. Select the most useful endpoints that would make good tools for an AI agent.
  3. Suggest concise, snake_case names for these tools.
  4. Write clear descriptions for what the tool does.
  5. Return JSON only.
  
  Output Schema:
  {
    "name": "Suggested Name for the MCP Server (kebab-case)",
    "description": "Brief description of what this server provides",
    "endpoints": [
      {
        "path": "/users",
        "method": "GET",
        "summary": "List all users",
        "needsTool": true,
        "toolName": "list_users",
        "toolDescription": "Retrieve a list of users"
      }
    ]
  }
  `;

  const userPrompt = `Here is the API Specification content (fetched from ${url}):
  
  ${specContent.substring(0, 15000)} // Truncated to avoid context limits if huge
  
  Please analyze and select the best tools.`;

  console.log('🤖 Analyzer: Asking LLM to analyze spec...');
  return await callLLM(systemPrompt, userPrompt, true);
};
