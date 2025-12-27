/**
 * Workflow MCP Generator
 * 
 * Generates an MCP server from a workflow definition:
 * - Creates HTTP endpoints for the workflow tools
 * - Registers in ERC-8004 registry
 * - Handles pay-per-use billing
 */

import { Router, Request, Response } from 'express';
import { WorkflowDefinition } from './types';
import { workflowExecutor } from './executor';
import { workflowParser } from './parser';
import { erc8004RegistryService } from '../erc8004/registry.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class WorkflowMCPGenerator {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  /**
   * Register a workflow and generate its MCP server
   */
  async registerWorkflow(workflow: WorkflowDefinition): Promise<{
    serverId: string;
    endpoint: string;
    router: Router;
  }> {
    // Validate
    const validated = workflowParser.validate(workflow);
    
    // Store in memory
    this.workflows.set(validated.name, validated);

    // Create MCP router
    const router = this.createMCPRouter(validated);

    // Register in ERC-8004
    const serverId = await this.registerInERC8004(validated);

    console.log(`✅ Registered workflow MCP: ${validated.name} (${serverId})`);

    return {
      serverId,
      endpoint: `/mcp-workflow/${validated.name}`,
      router,
    };
  }

  /**
   * Create MCP router for a workflow
   */
  private createMCPRouter(workflow: WorkflowDefinition): Router {
    const router = Router();

    // List tools
    router.get('/tools', (req: Request, res: Response) => {
      res.json([{
        name: `execute_${workflow.name}`,
        toolName: `execute_${workflow.name}`,
        description: workflow.description,
        method: 'POST',
        cost: workflow.pricing.basePrice,
        inputSchema: {
          type: 'object',
          properties: Object.fromEntries(
            workflow.inputs.map(input => [
              input.name,
              {
                type: input.type,
                description: input.description,
                default: input.default,
              },
            ])
          ),
          required: workflow.inputs.filter(i => i.required).map(i => i.name),
        },
      }]);
    });

    // Execute workflow
    router.post(`/tools/execute_${workflow.name}`, async (req: Request, res: Response) => {
      const startTime = Date.now();
      
      try {
        const userId = req.headers['x-user-id'] as string || req.body.userId;
        const inputs = req.body;
        delete inputs.userId;

        console.log(`🚀 Executing workflow: ${workflow.name}`);
        
        const result = await workflowExecutor.execute(workflow, inputs, userId);
        
        res.json({
          success: result.success,
          output: result.output,
          meta: {
            executionId: result.executionId,
            cost: result.totalCost,
            executionTime: result.executionTime,
            stepCosts: result.stepCosts,
            revenue: {
              creator: result.creatorRevenue,
              platform: result.platformRevenue,
            },
          },
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          meta: {
            cost: workflow.pricing.basePrice,
            executionTime: Date.now() - startTime,
          },
        });
      }
    });

    // Health check
    router.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        workflow: workflow.name,
        version: workflow.version,
      });
    });

    return router;
  }

  /**
   * Register workflow in ERC-8004 registry
   */
  private async registerInERC8004(workflow: WorkflowDefinition): Promise<string> {
    try {
      // Check if agent exists, create if not
      let agent = await prisma.agent.findFirst({
        where: { name: 'workflow-agent' },
      });

      if (!agent) {
        agent = await prisma.agent.create({
          data: {
            name: 'workflow-agent',
            walletAddress: workflow.creator.address,
            metadataUri: '',
            onChainId: Date.now(),
          },
        });
      }

      // Create or update MCP server
      const existingServer = await prisma.mCPServer.findUnique({
        where: { name: workflow.name },
      });

      if (existingServer) {
        await prisma.mCPServer.update({
          where: { id: existingServer.id },
          data: {
            description: workflow.description,
            walletAddress: workflow.creator.address,
            updatedAt: new Date(),
          },
        });
        return existingServer.id;
      }

      const server = await prisma.mCPServer.create({
        data: {
          name: workflow.name,
          displayName: workflow.name,
          description: workflow.description,
          endpoint: `/mcp-workflow/${workflow.name}`,
          provider: workflow.creator.name || 'Community',
          category: workflow.category || 'workflow',
          walletAddress: workflow.creator.address,
          agentId: agent.id,
          status: 'ACTIVE',
          visibility: workflow.isPublic ? 'PUBLIC' : 'PRIVATE',
          handlerType: 'INTERNAL',
        },
      });

      // Create tool entry
      await prisma.tool.create({
        data: {
          mcpServerId: server.id,
          name: `execute_${workflow.name}`,
          description: workflow.description,
          baseCost: workflow.pricing.basePrice,
          costUsd: workflow.pricing.basePrice,
        },
      });

      return server.id;
    } catch (error: any) {
      console.error('Failed to register in ERC-8004:', error.message);
      return `local-${workflow.name}`;
    }
  }

  /**
   * Load workflow from YAML/JSON string
   */
  loadFromYAML(yamlContent: string): WorkflowDefinition {
    return workflowParser.parseYAML(yamlContent);
  }

  loadFromJSON(jsonContent: string): WorkflowDefinition {
    return workflowParser.parseJSON(jsonContent);
  }

  /**
   * Get registered workflow
   */
  getWorkflow(name: string): WorkflowDefinition | undefined {
    return this.workflows.get(name);
  }

  /**
   * List all registered workflows
   */
  listWorkflows(): { name: string; description: string; price: number }[] {
    return Array.from(this.workflows.values()).map(w => ({
      name: w.name,
      description: w.description,
      price: w.pricing.basePrice,
    }));
  }
}

export const workflowMCPGenerator = new WorkflowMCPGenerator();
