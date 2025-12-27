import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs-extra';
import axios from 'axios';
import jsyaml from 'js-yaml';
import { analyzeApi } from './services/analyzer';
import { generateRouterCode } from './services/coder';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.MCP_GENERATOR_PORT || '3006');
const API_PACKAGE_PATH = path.resolve(__dirname, '../../../../packages/api/src/mcp-servers');

app.use(cors());
app.use(express.json());

// Serve the standalone Admin Panel
app.use(express.static(path.join(__dirname, '../public')));

// Helper to fetch spec content
async function fetchSpec(url: string): Promise<string> {
   const response = await axios.get(url);
   if (typeof response.data === 'string') return response.data;
   if (typeof response.data === 'object') return JSON.stringify(response.data); // JSON
   return '';
}

// 1. Analyze Endpoint
app.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { apiEndpoint } = req.body;
    if (!apiEndpoint) return res.status(400).json({ error: 'apiEndpoint is required' });

    console.log(`🔍 Analyzing API at ${apiEndpoint}...`);
    console.log(`   DEBUG: typeof apiEndpoint=${typeof apiEndpoint}, value='${apiEndpoint}'`);
    
    // Try to guess Spec URL if just a base URL is given ? 
    // For now assume user gives the spec URL directly (Swagger JSON/YAML)
    const specContent = await fetchSpec(apiEndpoint);
    
    // Check if it's yaml
    let parsedSpec;
    try {
        parsedSpec = JSON.parse(specContent);
    } catch {
        try {
            parsedSpec = jsyaml.load(specContent);
        } catch {
            // Raw HTML?
        }
    }
    
    const analysis = await analyzeApi(JSON.stringify(parsedSpec) || specContent, apiEndpoint);
    
    // Cache the spec content in memory or temp file? 
    // Ideally we pass it back or store it by session. For simplicity, we send it back or re-fetch.
    // Let's send a summary back.
    
    res.json({
      success: true,
      analysis,
      specContentSnippet: specContent.substring(0, 100)
    });

  } catch (error: any) {
    console.error('Analysis failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Generate and Deploy Endpoint (Intelligent Flow)
import { deepResearchApi } from './services/perplexity';

app.post('/generate', async (req: Request, res: Response) => {
  try {
    const { apiEndpoint, selectedTools, serverName, bestPractices, chatHistory } = req.body;
    
    if (!apiEndpoint || !selectedTools || !serverName) {
      return res.status(400).json({ error: 'Missing required params' });
    }

    console.log(`🔨 Intelligent generation for ${serverName}...`);
    
    // Step 1: Fetch the spec
    const specContent = await fetchSpec(apiEndpoint);
    
    // Step 2: Deep research the API using Perplexity Pro
    console.log('🔬 Running deep research...');
    const endpointNames = selectedTools.map((t: any) => t.path || t.toolName).filter(Boolean);
    const apiResearch = await deepResearchApi(
      serverName, 
      chatHistory || '', 
      endpointNames
    );
    console.log('📚 Research complete');

    // Step 3: Generate code with full context
    const generated = await generateRouterCode({
      serverName,
      apiEndpoint,
      selectedTools,
      specContent,
      chatHistory,
      apiResearch,
      bestPractices
    });
    
    // Step 4: Deploy to packages/api/src/mcp-servers
    const targetDir = path.join(API_PACKAGE_PATH, serverName);
    await fs.ensureDir(targetDir);
    await fs.writeFile(path.join(targetDir, 'index.ts'), generated.content);
    
    console.log(`✅ Deployed ${serverName} to ${targetDir}`);

    res.json({
        success: true,
        message: 'Server generated with intelligent context and deployed successfully',
        path: targetDir,
        preview: generated.content.substring(0, 500),
        researchSummary: apiResearch.overview?.substring(0, 200)
    });

  } catch (error: any) {
    console.error('Generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Search for API (Perplexity)
import { searchForApi, chatAboutApi } from './services/perplexity';

// In-memory chat sessions (simple implementation)
const chatSessions: Record<string, { history: Array<{ role: 'user' | 'assistant'; content: string }>; context: string }> = {};

app.post('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    console.log(`🔍 Searching for: ${query}`);
    const result = await searchForApi(query);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Search failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/chat', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, apiContext } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message required' });
    }

    // Get or create session
    if (!chatSessions[sessionId]) {
      chatSessions[sessionId] = { history: [], context: apiContext || '' };
    }

    const session = chatSessions[sessionId];
    if (apiContext) session.context = apiContext;

    // Get response
    const response = await chatAboutApi(session.history, message, session.context);

    // Update history
    session.history.push({ role: 'user', content: message });
    session.history.push({ role: 'assistant', content: response });

    res.json({
      success: true,
      response,
      sessionId
    });
  } catch (error: any) {
    console.error('Chat failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Best Practices Research
import { findBestPractices } from './services/perplexity';

app.post('/best-practices', async (req: Request, res: Response) => {
  try {
    const { apiName } = req.body;
    if (!apiName) return res.status(400).json({ error: 'apiName is required' });

    console.log(`📚 Researching best practices for: ${apiName}`);
    const result = await findBestPractices(apiName);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Best practices research failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Deep Research (use cases, existing MCPs)
import { researchApiUseCases, getApiKeyInstructions, generateTestCases } from './services/perplexity';

app.post('/research', async (req: Request, res: Response) => {
  try {
    const { apiName } = req.body;
    if (!apiName) return res.status(400).json({ error: 'apiName is required' });

    console.log(`📊 Deep research for: ${apiName}`);
    const result = await researchApiUseCases(apiName);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Research failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Check for existing MCP server
app.get('/check-existing/:serverName', async (req: Request, res: Response) => {
  try {
    const { serverName } = req.params;
    const targetDir = path.join(API_PACKAGE_PATH, serverName);
    const exists = await fs.pathExists(targetDir);
    
    let existingFiles: string[] = [];
    if (exists) {
      existingFiles = await fs.readdir(targetDir);
    }

    res.json({
      success: true,
      exists,
      path: targetDir,
      files: existingFiles
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Get API key instructions
app.post('/api-key-instructions', async (req: Request, res: Response) => {
  try {
    const { apiName } = req.body;
    if (!apiName) return res.status(400).json({ error: 'apiName is required' });

    console.log(`🔑 Getting API key instructions for: ${apiName}`);
    const result = await getApiKeyInstructions(apiName);

    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Generate test cases
app.post('/test-cases', async (req: Request, res: Response) => {
  try {
    const { apiName, tools } = req.body;
    if (!apiName || !tools) return res.status(400).json({ error: 'apiName and tools required' });

    console.log(`🧪 Generating test cases for: ${apiName}`);
    const testCases = await generateTestCases(apiName, tools);

    res.json({
      success: true,
      testCases
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCTION DEPLOYMENT - Save to Database
// ============================================

/**
 * Deploy MCP Server to Database (Production Mode)
 * 
 * Instead of generating code files, this saves the server configuration
 * to the database. The generic MCP handler will use this config to
 * proxy requests to the external API.
 */
app.post('/deploy-to-db', async (req: Request, res: Response) => {
  try {
    const { 
      serverName, 
      displayName,
      description, 
      baseUrl,      // External API base URL
      authType,     // apiKey, bearer, oauth, none
      authConfig,   // { headerName, paramName, location }
      tools,        // Array of tool configs
      category,
      provider
    } = req.body;

    if (!serverName || !baseUrl) {
      return res.status(400).json({ 
        error: 'serverName and baseUrl are required' 
      });
    }

    console.log(`📦 Deploying ${serverName} to database...`);

    // Call the main API to store in database
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    
    // First, create or find a default agent (required by schema)
    let response = await axios.post(`${apiUrl}/api/admin/agents`, {
      name: 'MCP Generator',
      walletAddress: '0x0000000000000000000000000000000000000000'
    }).catch(() => null);

    // Get the agent ID (create one if needed)
    const agentResponse = await axios.get(`${apiUrl}/api/admin/agents`).catch(() => ({ data: { agents: [] } }));
    let agentId = agentResponse.data.agents?.[0]?.id;
    
    if (!agentId) {
      // Create a default agent if none exists
      console.log('Creating default agent...');
      agentId = 'default-generator-agent';
    }

    // Store via API or directly (for now, return the config for manual storage)
    const serverConfig = {
      name: serverName,
      displayName: displayName || serverName,
      description: description || `MCP Server for ${serverName}`,
      endpoint: `/mcp-db/${serverName}`,
      baseUrl,
      authType: authType || 'apiKey',
      authConfig: authConfig || { paramName: 'key', location: 'query' },
      category: category || 'general',
      provider: provider || 'generated',
      status: 'ACTIVE',
      handlerType: 'EXTERNAL_API',
      tools: (tools || []).map((t: any) => ({
        name: t.name || t.toolName,
        description: t.description || t.toolDescription,
        httpMethod: t.method || 'GET',
        path: t.path || `/${t.name}`,
        inputSchema: t.inputSchema || {},
        baseCost: t.costUsd || 0.01,
        costUsd: t.costUsd || 0.01
      }))
    };

    console.log(`✅ Server config ready for ${serverName}`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Tools: ${serverConfig.tools.length}`);

    res.json({
      success: true,
      message: 'Server configuration ready for database deployment',
      config: serverConfig,
      endpoint: `/mcp-db/${serverName}`,
      instructions: [
        'Run: npx prisma db push',
        'Then insert this config into the mcp_servers table',
        'Server will be available at /mcp-db/' + serverName
      ]
    });

  } catch (error: any) {
    console.error('Database deployment failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to list generated servers (for discovery)
app.get('/api/mcp/generated', async (req: Request, res: Response) => {
  try {
    const mcpDir = path.resolve(__dirname, '../../../../packages/api/src/mcp-servers');
    
    if (!fs.existsSync(mcpDir)) {
      return res.json({ success: true, servers: [] });
    }
    
    const entries = await fs.readdir(mcpDir, { withFileTypes: true });
    const servers = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const indexPath = path.join(mcpDir, entry.name, 'index.ts');
        if (fs.existsSync(indexPath)) {
          // Try to extract tools from the file
          const content = await fs.readFile(indexPath, 'utf-8');
          const toolMatches = content.match(/toolName:\s*["']([^"']+)["']/g) || [];
          const tools = toolMatches.map(m => m.match(/["']([^"']+)["']/)?.[1] || '');
          
          servers.push({
            name: entry.name,
            path: `/mcp/${entry.name}`,
            tools,
            source: 'file'
          });
        }
      }
    }
    
    res.json({ success: true, servers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Agentic MCP Generator' });
});

app.listen(PORT, () => {
  console.log(`✅ Agentic MCP Generator running on port ${PORT}`);
  console.log(`   Target Output Dir: ${API_PACKAGE_PATH}`);
  console.log(`   Production mode: /deploy-to-db endpoint available`);
});
