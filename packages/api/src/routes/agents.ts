import { Router } from 'express';
const router = Router();
router.get('/', async (req, res) => {
  res.json({ success: true, agents: [] });
});
export default router;
