import { Router } from 'express';
import { AITravelAgent } from '../services/ai-agent';
import { PerplexityService } from '../services/ai-agent/perplexityService';

const router = Router();
const agent = new AITravelAgent();
const perplexityService = new PerplexityService();

router.post('/query', async (req, res) => {
  try {
    const { userId, sessionId, query } = req.body;
    
    if (!userId || !sessionId || !query) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await agent.processQuery({ userId, sessionId, query });
    
    res.json(result);
  } catch (error: any) {
    console.error('AI Agent error:', error);
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

export default router;
