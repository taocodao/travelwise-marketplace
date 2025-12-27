
import { callLLM } from './llm';

export interface GeneratedCode {
  filename: string;
  content: string;
}

export interface GenerationContext {
  serverName: string;
  apiEndpoint: string;
  selectedTools: any[];
  specContent: string;
  // New intelligent context
  chatHistory?: string;
  apiResearch?: {
    overview?: string;
    authenticationDetails?: string;
    rateLimitInfo?: string;
    errorPatterns?: string;
    sdkRecommendations?: string;
    implementationTips?: string[];
  };
  bestPractices?: {
    rateLimiting?: string;
    authentication?: string;
    errorHandling?: string;
    pagination?: string;
  };
}

export const generateRouterCode = async (context: GenerationContext): Promise<GeneratedCode> => {
  const { 
    serverName, 
    apiEndpoint, 
    selectedTools, 
    specContent,
    chatHistory,
    apiResearch,
    bestPractices 
  } = context;

  // Build intelligent context section
  let researchContext = '';
  if (apiResearch) {
    researchContext = `
  API Research (from Perplexity Pro Deep Search):
  - Overview: ${apiResearch.overview || 'N/A'}
  - Authentication: ${apiResearch.authenticationDetails || 'Check API docs'}
  - Rate Limits: ${apiResearch.rateLimitInfo || 'Standard limits apply'}
  - Error Handling: ${apiResearch.errorPatterns || 'Handle HTTP errors'}
  - Implementation Tips: ${apiResearch.implementationTips?.join('; ') || 'Follow best practices'}
`;
  }

  let practicesContext = '';
  if (bestPractices) {
    practicesContext = `
  Best Practices to Follow:
  - Rate Limiting: ${bestPractices.rateLimiting || 'Use exponential backoff'}
  - Authentication: ${bestPractices.authentication || 'Standard API key'}
  - Error Handling: ${bestPractices.errorHandling || 'Proper try/catch'}
  - Pagination: ${bestPractices.pagination || 'Handle page tokens'}
`;
  }

  let userRequirements = '';
  if (chatHistory) {
    userRequirements = `
  User's Specific Requirements (from chat):
  ${chatHistory}
`;
  }

  const systemPrompt = `You are a Senior Typescript Developer creating a production-quality Express Router that implements an MCP (Model Context Protocol) Server.

  Context: 
  - Target API Base URL: ${apiEndpoint}
  - The router will be mounted at /mcp/${serverName} of a larger Express application.
  - Use 'axios' for HTTP requests
  - Use 'dotenv' for API keys (process.env.${serverName.toUpperCase().replace(/-/g, '_')}_API_KEY)
  ${researchContext}
  ${practicesContext}
  ${userRequirements}
  
  Code Quality Requirements:
  1. Return ONLY valid Typescript code. No markdown, no explanations.
  2. Export a default 'express.Router()' instance.
  3. Implement proper error handling with specific error messages.
  4. Add rate limiting if the API research indicates limits.
  5. Include retry logic for transient failures.
  6. Add request/response logging for debugging.
  7. Implement the authentication pattern specified in research.
  
  Required Endpoints:
  - GET /tools - List all available tools (MCP spec)
  - POST /tools/:toolName - Execute a specific tool
  
  Code Structure:
  import { Router, Request, Response } from 'express';
  import axios from 'axios';
  
  const router = Router();
  const API_KEY = process.env.${serverName.toUpperCase().replace(/-/g, '_')}_API_KEY;
  const BASE_URL = '${apiEndpoint.replace(/\/swagger\.json|\/openapi\.json/g, '')}';
  
  // Helper for API calls with error handling
  async function apiCall(...) { ... }
  
  router.get('/tools', (req, res) => { ... });
  router.post('/tools/:toolName', async (req, res) => { ... });
  
  export default router;
  `;

  const userPrompt = `Generate the complete MCP Server code for '${serverName}'.
  
  Tools to Implement:
  ${JSON.stringify(selectedTools, null, 2)}
  
  API Specification (truncated):
  ${specContent.substring(0, 6000)}
  
  Generate the full 'index.ts' file with production-quality code.`;

  console.log('🤖 Coder: Generating intelligent code with full context...');
  const code = await callLLM(systemPrompt, userPrompt, false);
  
  // Clean up potential markdown code blocks
  const cleanCode = code.replace(/```typescript/g, '').replace(/```/g, '').trim();

  return {
    filename: 'index.ts',
    content: cleanCode
  };
};
