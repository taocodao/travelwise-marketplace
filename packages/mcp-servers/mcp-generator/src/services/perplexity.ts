import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Load env
const rootEnv = path.resolve(process.cwd(), '../../../.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });

const perplexityKey = process.env.PERPLEXITY_API_KEY;

if (!perplexityKey) {
  console.warn('⚠️ PERPLEXITY_API_KEY not found. Search features will fail.');
}

// Perplexity uses OpenAI-compatible API
const perplexity = new OpenAI({
  apiKey: perplexityKey || 'dummy',
  baseURL: 'https://api.perplexity.ai',
});

export interface SearchResult {
  apiName: string;
  description: string;
  docsUrl: string;
  specUrl?: string;
}

export async function searchForApi(query: string): Promise<{
  summary: string;
  results: SearchResult[];
}> {
  console.log(`🔍 Perplexity: Searching for "${query}"...`);

  const response = await perplexity.chat.completions.create({
    model: 'sonar-pro', // Perplexity Pro for deeper research
    messages: [
      {
        role: 'system',
        content: `You are an expert API researcher. Your task is to find OpenAPI/Swagger specification files for any API the user requests.

CRITICAL: You must provide EXACT, VERIFIED URLs to spec files. Do NOT guess filenames.

Search Strategy:
1. Search GitHub for "<api-name> openapi" repositories
2. Navigate to the repo's /dist or /spec folder in the response
3. Get the EXACT filename from the repository (e.g., "openapi3.json" not "v1-openapi3.yaml")
4. Construct raw.githubusercontent.com URL using the EXACT path from the repo
5. For official API providers, check their developer docs for /openapi.json or /swagger.json endpoints

VERIFIED Working Patterns:
- Google Maps: https://raw.githubusercontent.com/googlemaps/openapi-specification/main/dist/google-maps-platform-openapi3.json
- Stripe: https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
- Petstore: https://petstore.swagger.io/v2/swagger.json

Return ONLY a valid JSON object (no markdown):
{
  "summary": "What you found about this API",
  "results": [
    {
      "apiName": "Official name of the API",
      "description": "What this API does and its main use cases",
      "docsUrl": "URL to official documentation",
      "specUrl": "EXACT, VERIFIED URL to downloadable OpenAPI/Swagger spec file"
    }
  ]
}

Rules:
- specUrl MUST be a direct link to a raw spec file (not a webpage)
- specUrl MUST use the EXACT filename from the repository - DO NOT GUESS
- Prefer .json over .yaml when both exist
- If unsure of exact filename, set specUrl to null and explain in summary
- Include up to 3 results if multiple versions/options exist`
      },
      {
        role: 'user',
        content: `Find OpenAPI/Swagger specification files for: ${query}

IMPORTANT: Only return URLs you are CERTAIN exist. Do not guess filenames.`
      }
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from Perplexity');

  try {
    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Validate URLs - check if they're accessible
      if (result.results && result.results.length > 0) {
        console.log('🔗 Validating spec URLs...');
        for (const r of result.results) {
          if (r.specUrl) {
            try {
              const axios = await import('axios');
              const checkRes = await axios.default.head(r.specUrl, { timeout: 5000 });
              if (checkRes.status === 200) {
                console.log(`  ✅ Valid: ${r.specUrl}`);
              } else {
                console.log(`  ⚠️ Status ${checkRes.status}: ${r.specUrl}`);
                r.specUrl = null; // Invalidate bad URL
                r.urlError = `HTTP ${checkRes.status}`;
              }
            } catch (e: any) {
              console.log(`  ❌ Invalid: ${r.specUrl} - ${e.message}`);
              r.specUrl = null; // Invalidate bad URL
              r.urlError = e.message;
            }
          }
        }
      }
      
      return result;
    }
  } catch (e) {
    console.error('Failed to parse Perplexity response:', content);
  }

  // Fallback
  return {
    summary: content,
    results: []
  };
}

export async function chatAboutApi(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
  apiContext: string
): Promise<string> {
  console.log(`💬 Chat: Processing user message...`);

  const messages: any[] = [
    {
      role: 'system',
      content: `You are an API assistant helping a user create an MCP server from a REST API.
Context about the API:
${apiContext}

Help the user:
1. Understand what endpoints are available
2. Decide which functions to convert to MCP tools
3. Answer questions about the API

Be concise and helpful. When the user is ready to generate, tell them to click the Generate button.`
    },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const response = await perplexity.chat.completions.create({
    model: 'sonar-pro', // Pro model for better context
    messages,
  });

  return response.choices[0].message.content || 'I could not generate a response.';
}

export interface BestPractices {
  rateLimiting: string;
  authentication: string;
  errorHandling: string;
  pagination: string;
  caching: string;
  securityTips: string[];
  codeExamples: string[];
}

export async function findBestPractices(apiName: string): Promise<{
  summary: string;
  practices: BestPractices;
}> {
  console.log(`📚 Finding best practices for: ${apiName}...`);

  const response = await perplexity.chat.completions.create({
    model: 'sonar-pro', // Pro model for deeper research
    messages: [
      {
        role: 'system',
        content: `You are an API integration expert. Search the web for best practices when integrating with the specified API.
Return ONLY a valid JSON object (no markdown) with:
{
  "summary": "Brief overview of key considerations",
  "practices": {
    "rateLimiting": "How to handle rate limits for this API",
    "authentication": "Recommended auth pattern (API key, OAuth, etc)",
    "errorHandling": "Common errors and how to handle them",
    "pagination": "How to handle paginated responses",
    "caching": "What to cache and for how long",
    "securityTips": ["tip1", "tip2"],
    "codeExamples": ["Brief code pattern 1", "Brief code pattern 2"]
  }
}
Be specific to this API, not generic advice.`
      },
      {
        role: 'user',
        content: `Find best practices for integrating with: ${apiName}`
      }
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from Perplexity');

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse best practices:', content);
  }

  return {
    summary: content,
    practices: {
      rateLimiting: 'Use exponential backoff',
      authentication: 'Check API documentation',
      errorHandling: 'Handle HTTP errors appropriately',
      pagination: 'Check for next page tokens',
      caching: 'Cache responses where appropriate',
      securityTips: ['Store API keys securely'],
      codeExamples: []
    }
  };
}

// Deep research for comprehensive API understanding before generation
export interface ApiResearch {
  overview: string;
  authenticationDetails: string;
  rateLimitInfo: string;
  errorPatterns: string;
  sdkRecommendations: string;
  commonUseCases: string[];
  implementationTips: string[];
}

export async function deepResearchApi(
  apiName: string, 
  chatHistory: string,
  selectedEndpoints: string[]
): Promise<ApiResearch> {
  console.log(`🔬 Deep research for ${apiName}...`);

  const response = await perplexity.chat.completions.create({
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: `You are a senior software architect researching an API to create a high-quality MCP (Model Context Protocol) server implementation.

Research the specified API thoroughly and provide insights that will help generate production-quality code.

Return ONLY a valid JSON object:
{
  "overview": "Comprehensive description of the API and its ecosystem",
  "authenticationDetails": "Detailed auth implementation (API key location, OAuth flow, token refresh, etc)",
  "rateLimitInfo": "Specific rate limits (requests/min, burst limits, headers to check)",
  "errorPatterns": "Common error codes and how to handle them properly",
  "sdkRecommendations": "Official SDK or recommended HTTP client patterns",
  "commonUseCases": ["Use case 1", "Use case 2"],
  "implementationTips": ["Tip 1 for better implementation", "Tip 2"]
}

Be extremely specific. Include actual numbers, code snippets, and real examples from the API documentation.`
      },
      {
        role: 'user',
        content: `Research this API for MCP server implementation:
API: ${apiName}
Endpoints to implement: ${selectedEndpoints.join(', ')}
User's requirements from chat: ${chatHistory}`
      }
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response from Perplexity');

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse deep research:', content);
  }

  return {
    overview: content,
    authenticationDetails: 'Standard API key authentication',
    rateLimitInfo: 'Check API documentation for rate limits',
    errorPatterns: 'Handle standard HTTP error codes',
    sdkRecommendations: 'Use axios or fetch with proper error handling',
    commonUseCases: [],
    implementationTips: []
  };
}

// Research API use cases and existing MCP implementations
export interface ApiUseCaseResearch {
  typicalUseCases: string[];
  majorFunctions: string[];
  existingMcpServers: { name: string; url: string; description: string }[];
  suggestedFunctions: string[];
  realWorldUseCases?: { name: string; scenario: string; workflow: string[]; businessValue: string }[];
  implementationPatterns?: { name: string; description: string; bestFor: string }[];
  securityBestPractices?: string[];
  costOptimization?: string[];
}

export async function researchApiUseCases(apiName: string): Promise<ApiUseCaseResearch> {
  console.log(`📊 Deep research for ${apiName}...`);

  const response = await perplexity.chat.completions.create({
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: `You are a senior API solutions architect conducting comprehensive research on an API for building an MCP (Model Context Protocol) server.

Provide an in-depth analysis. Return ONLY a valid JSON object:
{
  "typicalUseCases": ["Use case 1", "Use case 2", "..."],
  "majorFunctions": ["Key function 1 with description", "..."],
  "existingMcpServers": [
    {"name": "Server name", "url": "GitHub/npm URL", "description": "What it provides"}
  ],
  "suggestedFunctions": ["Function to implement 1", "..."],
  "realWorldUseCases": [
    {
      "name": "Use Case Title (e.g., 'Hyper-Local Discovery Agent')",
      "scenario": "Detailed scenario description",
      "workflow": ["Step 1: Agent calls X", "Step 2: Process Y", "..."],
      "businessValue": "Who benefits and how"
    }
  ],
  "implementationPatterns": [
    {
      "name": "Pattern name (e.g., 'Local Development')",
      "description": "How to implement this pattern",
      "bestFor": "When to use this pattern"
    }
  ],
  "securityBestPractices": [
    "Store API keys in environment variables",
    "Restrict keys by IP/referrer",
    "..."
  ],
  "costOptimization": [
    "Cache geocoding results",
    "Batch requests where possible",
    "..."
  ]
}

Research thoroughly:
- Real-world applications by companies
- Agent workflows that combine this API with others
- Security considerations specific to this API
- Cost-saving strategies
- Existing MCP servers on GitHub/npm
- Best implementation patterns`
      },
      {
        role: 'user',
        content: `Conduct comprehensive research on: ${apiName}

Include:
1. 3-5 detailed real-world use cases with step-by-step agent workflows
2. Implementation patterns (local dev, remote HTTP, multi-tenant)
3. Security best practices specific to this API
4. Cost optimization strategies
5. Any existing MCP servers for this API`
      }
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response');

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse use case research:', content);
  }

  return {
    typicalUseCases: [],
    majorFunctions: [],
    existingMcpServers: [],
    suggestedFunctions: [],
    realWorldUseCases: [],
    implementationPatterns: [],
    securityBestPractices: [],
    costOptimization: []
  };
}

// Get API key setup instructions
export interface ApiKeyInstructions {
  instructions: string;
  signupUrl: string;
  pricing: string;
  freeTier: string;
  requiredScopes: string[];
}

export async function getApiKeyInstructions(apiName: string): Promise<ApiKeyInstructions> {
  console.log(`🔑 Getting API key instructions for ${apiName}...`);

  const response = await perplexity.chat.completions.create({
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: `You are helping a developer set up API credentials.

Return ONLY a valid JSON object:
{
  "instructions": "Step-by-step instructions to get an API key",
  "signupUrl": "Direct URL to the developer console/signup page",
  "pricing": "Brief pricing info (free tier, paid plans)",
  "freeTier": "What's included in free tier (requests/month, limits)",
  "requiredScopes": ["Required permission/scope 1", "..."]
}

Be specific and accurate. Include actual URLs.`
      },
      {
        role: 'user',
        content: `How do I get an API key for: ${apiName}`
      }
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response');

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse API key instructions:', content);
  }

  return {
    instructions: 'Check the API documentation for setup instructions.',
    signupUrl: '',
    pricing: 'See API documentation',
    freeTier: 'Unknown',
    requiredScopes: []
  };
}

// Generate test cases for an MCP server
export interface TestCase {
  name: string;
  description: string;
  toolName: string;
  exampleInput: Record<string, any>;
  expectedBehavior: string;
}

export async function generateTestCases(apiName: string, implementedTools: string[]): Promise<TestCase[]> {
  console.log(`🧪 Generating test cases for ${apiName}...`);

  const response = await perplexity.chat.completions.create({
    model: 'sonar-pro',
    messages: [
      {
        role: 'system',
        content: `You are a QA engineer creating test cases for an MCP server.

Return ONLY a valid JSON array:
[
  {
    "name": "Test case name",
    "description": "What this test verifies",
    "toolName": "Name of the MCP tool to test",
    "exampleInput": {"param1": "value1", "param2": "value2"},
    "expectedBehavior": "What should happen"
  }
]

Create 3-5 practical test cases that verify the MCP server works correctly.`
      },
      {
        role: 'user',
        content: `Create test cases for ${apiName} MCP server with these tools: ${implementedTools.join(', ')}`
      }
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('No response');

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse test cases:', content);
  }

  return [];
}

