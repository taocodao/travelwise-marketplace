import { Router } from 'express';
import { AITravelAgent } from '../services/ai-agent';

const router = Router();
const agent = new AITravelAgent();

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

export default router;
