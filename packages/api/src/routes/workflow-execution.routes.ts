// packages/api/src/routes/workflow-execution.routes.ts - Workflow Execution API

import { Router, Request, Response } from 'express';
import { WorkflowExecutor } from '../services/workflow-execution.service';

const router = Router();

interface WorkflowExecution {
    workflowId: string;
    userWalletAddress: string;
    steps: any[];
    context: any;
}

/**
 * Execute a workflow
 * POST /api/workflows/execute
 */
router.post('/execute', async (req: Request, res: Response) => {
    try {
        const { userWalletAddress, template, query, resultLimit } = req.body;
        
        if (!userWalletAddress || !template || !query) {
            res.status(400).json({
                success: false,
                error: 'userWalletAddress, template, and query are required',
            });
            return;
        }
        
        console.log('[Workflow Execution] Request:', { userWalletAddress, template, query, resultLimit });
        
        // Build workflow from template
        const workflow = buildWorkflowFromTemplate(template, query, resultLimit);
        
        // Execute workflow
        const execution: WorkflowExecution = {
            workflowId: `${template}-${Date.now()}`,
            userWalletAddress,
            steps: workflow.steps as any,
            context: workflow.context,
        };
        
        const result = await WorkflowExecutor.execute(execution);
        
        console.log('[Workflow Execution] Result:', {
            success: result.success,
            stepsCompleted: result.steps.length,
            totalCost: result.totalCost,
        });
        
        res.json(result);
    } catch (error: any) {
        console.error('[WorkflowExecution] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * Build workflow from template
 */
function buildWorkflowFromTemplate(template: string, query: string, resultLimit: number = 25) {
    if (template === 'lead_generation') {
        return {
            steps: [
                {
                    id: 'lead_search',
                    name: 'AI-Powered Lead Search',
                    type: 'apollo_tool' as const,
                    tool: 'apollo_lead_search',
                    config: {
                        search_query: query,
                        result_limit: Math.min(resultLimit, 25), // Test with 25 first
                        include_emails: true,
                    },
                },
                {
                    id: 'icp_analysis',
                    name: 'ICP Analysis',
                    type: 'apollo_tool' as const,
                    tool: 'apollo_icp_mapping',
                    config: {
                        search_query: query,
                    },
                },
            ],
            context: {
                query,
                resultLimit,
            },
        };
    }
    
    // Default workflow
    return {
        steps: [
            {
                id: 'lead_search',
                name: 'Lead Search',
                type: 'apollo_tool' as const,
                tool: 'apollo_lead_search',
                config: {
                    search_query: query,
                    result_limit: resultLimit,
                },
            },
        ],
        context: { query },
    };
}

export default router;
