import { Router } from 'express';
import { AITravelAgent } from '../services/ai-agent/aiAgentService';

const router = Router();
const agent = new AITravelAgent();

router.post('/chat', async (req, res) => {
  try {
    const { userId, sessionId, query } = req.body;
    const result = await agent.processQuery({ userId, sessionId, query });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
