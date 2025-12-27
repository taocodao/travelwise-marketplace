/**
 * Workflow Executor
 * 
 * Executes workflow definitions step by step with:
 * - MCP tool calls
 * - AI decision nodes
 * - Cost tracking per step
 * - Template variable resolution
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
} from './types';
import { PerplexityService } from '../ai-agent/perplexityService';
import axios from 'axios';

export class WorkflowExecutor {
  private perplexity = new PerplexityService();
  private baseUrl = process.env.API_URL || 'http://localhost:3001';

  /**
   * Execute a workflow with given inputs
   */
  async execute(
    workflow: WorkflowDefinition,
    inputs: Record<string, any>,
    userId?: string
  ): Promise<WorkflowExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();

    // Initialize execution context
    const context: WorkflowExecutionContext = {
      workflowId: workflow.name,
      executionId,
      userId,
      input: inputs,
      steps: {},
      costs: [],
      status: 'running',
      startedAt: new Date(),
    };

    console.log(`🚀 Starting workflow: ${workflow.name} (${executionId})`);

    try {
      // Validate required inputs
      this.validateInputs(workflow, inputs);

      // Build execution order (topological sort)
      const executionOrder = this.buildExecutionOrder(workflow.steps);

      // Execute each step
      for (const stepId of executionOrder) {
        const step = workflow.steps.find(s => s.id === stepId)!;
        context.currentStep = stepId;

        console.log(`  📍 Step: ${step.name || step.id}`);
        
        const stepResult = await this.executeStep(step, context);
        context.steps[stepId] = stepResult.output;
        
        if (stepResult.cost > 0) {
          context.costs.push({
            stepId,
            cost: stepResult.cost,
            tool: step.tool ? `${step.tool.server}.${step.tool.function}` : undefined,
          });
        }
      }

      // Generate final output
      const output = this.resolveTemplate(workflow.output.template, context);

      // Calculate costs and revenue
      const totalCost = context.costs.reduce((sum, c) => sum + c.cost, 0);
      const baseCost = Math.max(workflow.pricing.basePrice, totalCost);
      const creatorRevenue = baseCost * (workflow.creator.revenueShare / 100);
      const platformRevenue = baseCost - creatorRevenue;

      context.status = 'completed';
      context.completedAt = new Date();

      console.log(`✅ Workflow completed: ${workflow.name} ($${baseCost.toFixed(4)})`);

      return {
        success: true,
        output,
        executionId,
        totalCost: baseCost,
        stepCosts: context.costs.map(c => ({ stepId: c.stepId, cost: c.cost })),
        executionTime: Date.now() - startTime,
        creatorRevenue,
        platformRevenue,
      };
    } catch (error: any) {
      context.status = 'failed';
      context.error = error.message;
      context.completedAt = new Date();

      console.error(`❌ Workflow failed: ${error.message}`);

      return {
        success: false,
        output: { error: error.message },
        executionId,
        totalCost: context.costs.reduce((sum, c) => sum + c.cost, 0),
        stepCosts: context.costs.map(c => ({ stepId: c.stepId, cost: c.cost })),
        executionTime: Date.now() - startTime,
        creatorRevenue: 0,
        platformRevenue: 0,
      };
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<{ output: any; cost: number }> {
    let retries = step.retries || 0;
    let lastError: Error | null = null;

    while (retries >= 0) {
      try {
        switch (step.type) {
          case 'mcp_tool':
            return await this.executeMCPTool(step, context);
          case 'ai_decision':
            return await this.executeAIDecision(step, context);
          case 'transform':
            return this.executeTransform(step, context);
          case 'condition':
            return await this.executeCondition(step, context);
          case 'loop':
            return await this.executeLoop(step, context);
          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }
      } catch (error: any) {
        lastError = error;
        retries--;
        
        if (retries >= 0) {
          console.log(`  ⚠️ Retrying step ${step.id}...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    // Handle error based on onError setting
    if (step.onError === 'skip') {
      console.log(`  ⏭️ Skipping failed step: ${step.id}`);
      return { output: null, cost: 0 };
    }

    throw lastError || new Error(`Step ${step.id} failed`);
  }

  /**
   * Execute MCP tool call
   */
  private async executeMCPTool(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<{ output: any; cost: number }> {
    const tool = step.tool!;
    
    // Resolve template parameters
    const params: Record<string, any> = {};
    for (const [key, value] of Object.entries(tool.params || {})) {
      params[key] = typeof value === 'string' 
        ? this.resolveTemplate(value, context)
        : value;
    }

    // Map server to endpoint
    const serverPaths: Record<string, string> = {
      'weather': '/mcp/semantic-location-mcp',
      'semantic_search': '/mcp/semantic-location-mcp',
      'google_maps': '/mcp/google-maps-platform',
      'perplexity': '/api/ai-agent',
    };

    const serverPath = serverPaths[tool.server] || `/mcp/${tool.server}`;
    const endpoint = `${this.baseUrl}${serverPath}/tools/${tool.function}`;

    console.log(`    🔧 Calling ${tool.server}.${tool.function}`);

    const response = await axios.post(endpoint, params, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    const cost = response.data.meta?.cost || step.estimatedCost || 0.02;
    
    return { 
      output: response.data, 
      cost 
    };
  }

  /**
   * Execute AI decision node
   */
  private async executeAIDecision(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<{ output: any; cost: number }> {
    const ai = step.ai!;
    
    // Resolve template in prompt
    const prompt = this.resolveTemplate(ai.prompt, context);

    console.log(`    🧠 AI decision: ${prompt.substring(0, 50)}...`);

    // Use Perplexity (free) for AI decisions
    const response = await this.perplexity.search(prompt, 'Make a decision or generate content');

    return {
      output: ai.outputFormat === 'json' 
        ? this.tryParseJSON(response.answer)
        : response.answer,
      cost: 0.02, // Perplexity cost
    };
  }

  /**
   * Execute transform step
   */
  private executeTransform(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): { output: any; cost: number } {
    const transform = step.transform!;
    
    // Get input value
    const inputValue = this.resolveTemplate(transform.input, context);
    
    // Execute expression (simple JavaScript evaluation)
    // WARNING: In production, use a sandboxed evaluator
    const fn = new Function('input', 'steps', `return ${transform.expression}`);
    const output = fn(inputValue, context.steps);

    return { output, cost: 0 };
  }

  /**
   * Execute condition step
   */
  private async executeCondition(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<{ output: any; cost: number }> {
    const condition = step.condition!;
    
    // Evaluate condition
    const fn = new Function('input', 'steps', `return ${condition.if}`);
    const result = fn(context.input, context.steps);

    const stepsToExecute = result ? condition.then : (condition.else || []);
    
    console.log(`    🔀 Condition: ${result ? 'then' : 'else'} branch`);

    // Note: In a full implementation, we'd recursively execute these steps
    return {
      output: { branch: result ? 'then' : 'else', stepsExecuted: stepsToExecute },
      cost: 0,
    };
  }

  /**
   * Execute loop step
   */
  private async executeLoop(
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<{ output: any; cost: number }> {
    const loop = step.loop!;
    
    // Get array to iterate
    const items = this.resolveTemplate(loop.over, context) as any[];
    
    if (!Array.isArray(items)) {
      throw new Error(`Loop over must be an array, got: ${typeof items}`);
    }

    console.log(`    🔁 Looping over ${items.length} items`);

    const results: any[] = [];
    let totalCost = 0;

    // Note: In a full implementation, we'd execute loop.steps for each item
    for (const item of items) {
      results.push({ item, processed: true });
    }

    return { output: results, cost: totalCost };
  }

  /**
   * Resolve template variables like {{input.x}} and {{steps.y.z}}
   */
  private resolveTemplate(template: string | any, context: WorkflowExecutionContext): any {
    if (typeof template !== 'string') return template;

    // Check for simple reference
    const simpleMatch = template.match(/^\{\{(\w+)(?:\.(.+))?\}\}$/);
    if (simpleMatch) {
      const [, root, path] = simpleMatch;
      let value: any;
      
      if (root === 'input') value = context.input;
      else if (root === 'steps') value = context.steps;
      else return template;

      if (path) {
        for (const key of path.split('.')) {
          value = value?.[key];
        }
      }
      return value;
    }

    // Replace inline templates
    return template.replace(/\{\{(\w+)(?:\.([^}]+))?\}\}/g, (_, root, path) => {
      let value: any;
      
      if (root === 'input') value = context.input;
      else if (root === 'steps') value = context.steps;
      else return _;

      if (path) {
        for (const key of path.split('.')) {
          value = value?.[key];
        }
      }

      return typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    });
  }

  /**
   * Validate required inputs
   */
  private validateInputs(workflow: WorkflowDefinition, inputs: Record<string, any>): void {
    for (const input of workflow.inputs) {
      if (input.required && !(input.name in inputs)) {
        if (input.default !== undefined) {
          inputs[input.name] = input.default;
        } else {
          throw new Error(`Missing required input: ${input.name}`);
        }
      }
    }
  }

  /**
   * Build topological execution order
   */
  private buildExecutionOrder(steps: WorkflowStep[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (!step) return;

      for (const dep of step.dependsOn || []) {
        visit(dep);
      }
      order.push(stepId);
    };

    for (const step of steps) {
      visit(step.id);
    }

    return order;
  }

  /**
   * Try to parse JSON from text
   */
  private tryParseJSON(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      // Try to find JSON in the text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }
      return text;
    }
  }
}

export const workflowExecutor = new WorkflowExecutor();
