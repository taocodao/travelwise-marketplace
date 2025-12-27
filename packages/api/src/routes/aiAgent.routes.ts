import { Router } from 'express';
import { AITravelAgent } from '../services/ai-agent/aiAgentService';
import { PerplexityService } from '../services/ai-agent/perplexityService';
import { mcpRouter } from '../services/ai-agent/mcp-router';

const router = Router();
const agent = new AITravelAgent();
const perplexityService = new PerplexityService();

router.post('/chat', async (req, res) => {
  try {
    const { userId, sessionId, query } = req.body;
    const result = await agent.processQuery({ userId, sessionId, query });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Perplexity web search endpoint
router.post('/tools/perplexity_search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required',
        tool: 'perplexity_search'
      });
    }

    console.log(`🔍 Perplexity search: "${query.substring(0, 50)}..."`);
    
    const result = await perplexityService.search(query);
    
    res.json({
      success: true,
      tool: 'perplexity_search',
      answer: result.answer,
      citations: result.citations,
      searchQueries: result.searchQueries,
      meta: {
        cost: 0.02,
        cached: false,
      }
    });
  } catch (error: any) {
    console.error('Perplexity search error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      tool: 'perplexity_search'
    });
  }
});

// ============================================
// Self-Learning MCP Router Endpoints
// ============================================

// Route a query using intelligent self-learning router
router.post('/route', async (req, res) => {
  try {
    const { query, userId } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required' 
      });
    }

    console.log(`🧠 Routing query: "${query.substring(0, 50)}..."`);
    
    const result = await mcpRouter.routeQuery(query);
    
    res.json({
      success: true,
      routes: result.routes,
      intent: result.intent,
      processingTime: result.processingTime,
    });
  } catch (error: any) {
    console.error('Routing error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Execute query with self-learning routing
router.post('/execute', async (req, res) => {
  try {
    const { query, userId } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required' 
      });
    }

    console.log(`🚀 Executing with router: "${query.substring(0, 50)}..."`);
    
    const result = await mcpRouter.executeAndLearn(query, userId);
    
    res.json({
      success: result.success,
      routes: result.routes,
      response: result.combinedResponse,
      results: result.results,
      totalCost: result.totalCost,
    });
  } catch (error: any) {
    console.error('Execution error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Record feedback for routing learning
router.post('/feedback', async (req, res) => {
  try {
    const { query, feedback } = req.body;
    
    if (!query || !feedback) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query and feedback are required' 
      });
    }

    await mcpRouter.recordFeedback(query, feedback);
    
    res.json({
      success: true,
      message: `Recorded ${feedback} feedback`,
    });
  } catch (error: any) {
    console.error('Feedback error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
