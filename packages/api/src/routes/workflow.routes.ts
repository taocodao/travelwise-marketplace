/**
 * Workflow API Routes
 * 
 * REST API for managing and executing workflows:
 * - POST /workflows - Create workflow from YAML/JSON
 * - GET /workflows - List all workflows
 * - POST /workflows/:name/execute - Execute a workflow
 */

import { Router, Request, Response } from 'express';
import { workflowMCPGenerator, workflowParser, workflowExecutor } from '../services/workflow';
import express from 'express';

const router = Router();

// Mount workflow MCP servers dynamically
const workflowApp = express.Router();

/**
 * Create a new workflow from YAML or JSON
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { content, format = 'json' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing workflow content' });
    }

    // Parse workflow
    const workflow = format === 'yaml' 
      ? workflowParser.parseYAML(content)
      : workflowParser.parseJSON(typeof content === 'string' ? content : JSON.stringify(content));

    // Register and generate MCP server
    const { serverId, endpoint } = await workflowMCPGenerator.registerWorkflow(workflow);

    res.json({
      success: true,
      workflow: {
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        price: workflow.pricing.basePrice,
        serverId,
        endpoint,
        tools: [`execute_${workflow.name}`],
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * List all registered workflows
 */
router.get('/', (req: Request, res: Response) => {
  const workflows = workflowMCPGenerator.listWorkflows();
  res.json({
    success: true,
    count: workflows.length,
    workflows,
  });
});

/**
 * Get workflow definition
 */
router.get('/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  const workflow = workflowMCPGenerator.getWorkflow(name);

  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  res.json({
    success: true,
    workflow: {
      name: workflow.name,
      description: workflow.description,
      version: workflow.version,
      inputs: workflow.inputs,
      steps: workflow.steps.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
      })),
      pricing: workflow.pricing,
      creator: workflow.creator,
    },
  });
});

/**
 * Execute a workflow directly
 */
router.post('/:name/execute', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const workflow = workflowMCPGenerator.getWorkflow(name);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const userId = req.headers['x-user-id'] as string || req.body.userId;
    const inputs = req.body;
    delete inputs.userId;

    const result = await workflowExecutor.execute(workflow, inputs, userId);

    res.json({
      success: result.success,
      output: result.output,
      meta: {
        executionId: result.executionId,
        cost: result.totalCost,
        executionTime: result.executionTime,
        stepCosts: result.stepCosts,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Export workflow as YAML
 */
router.get('/:name/export', (req: Request, res: Response) => {
  const { name } = req.params;
  const { format = 'yaml' } = req.query;
  
  const workflow = workflowMCPGenerator.getWorkflow(name);

  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  if (format === 'yaml') {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(workflowParser.toYAML(workflow));
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.send(workflowParser.toJSON(workflow));
  }
});

export default router;
