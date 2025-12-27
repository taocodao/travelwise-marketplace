/**
 * Workflow Parser
 * 
 * Parses workflow definitions from YAML/JSON and validates them.
 */

import * as yaml from 'yaml';
import { WorkflowDefinition, WorkflowStep, WorkflowInput } from './types';

export class WorkflowParser {
  /**
   * Parse workflow from YAML string
   */
  parseYAML(yamlContent: string): WorkflowDefinition {
    try {
      const parsed = yaml.parse(yamlContent);
      return this.validate(parsed);
    } catch (error: any) {
      throw new Error(`YAML parse error: ${error.message}`);
    }
  }

  /**
   * Parse workflow from JSON string
   */
  parseJSON(jsonContent: string): WorkflowDefinition {
    try {
      const parsed = JSON.parse(jsonContent);
      return this.validate(parsed);
    } catch (error: any) {
      throw new Error(`JSON parse error: ${error.message}`);
    }
  }

  /**
   * Validate workflow definition
   */
  validate(workflow: any): WorkflowDefinition {
    const errors: string[] = [];

    // Required fields
    if (!workflow.name) errors.push('Missing required field: name');
    if (!workflow.steps || !Array.isArray(workflow.steps)) {
      errors.push('Missing required field: steps (must be array)');
    }

    // Validate creator
    if (!workflow.creator?.address) {
      errors.push('Missing required field: creator.address');
    }

    // Validate pricing
    if (!workflow.pricing?.basePrice && workflow.pricing?.basePrice !== 0) {
      errors.push('Missing required field: pricing.basePrice');
    }

    // Validate steps
    if (workflow.steps) {
      workflow.steps.forEach((step: any, index: number) => {
        const stepErrors = this.validateStep(step, index);
        errors.push(...stepErrors);
      });

      // Check for circular dependencies
      const circularError = this.checkCircularDependencies(workflow.steps);
      if (circularError) errors.push(circularError);
    }

    // Validate inputs
    if (workflow.inputs) {
      workflow.inputs.forEach((input: any, index: number) => {
        if (!input.name) errors.push(`Input ${index}: missing name`);
        if (!input.type) errors.push(`Input ${index}: missing type`);
      });
    }

    if (errors.length > 0) {
      throw new Error(`Workflow validation failed:\n${errors.join('\n')}`);
    }

    // Set defaults
    return this.applyDefaults(workflow);
  }

  /**
   * Validate a single step
   */
  private validateStep(step: any, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Step ${index} (${step.id || 'unnamed'})`;

    if (!step.id) errors.push(`${prefix}: missing id`);
    if (!step.type) errors.push(`${prefix}: missing type`);

    switch (step.type) {
      case 'mcp_tool':
        if (!step.tool?.server) errors.push(`${prefix}: missing tool.server`);
        if (!step.tool?.function) errors.push(`${prefix}: missing tool.function`);
        break;
      case 'ai_decision':
        if (!step.ai?.prompt) errors.push(`${prefix}: missing ai.prompt`);
        break;
      case 'transform':
        if (!step.transform?.expression) errors.push(`${prefix}: missing transform.expression`);
        break;
      case 'condition':
        if (!step.condition?.if) errors.push(`${prefix}: missing condition.if`);
        if (!step.condition?.then) errors.push(`${prefix}: missing condition.then`);
        break;
      case 'loop':
        if (!step.loop?.over) errors.push(`${prefix}: missing loop.over`);
        if (!step.loop?.steps) errors.push(`${prefix}: missing loop.steps`);
        break;
    }

    return errors;
  }

  /**
   * Check for circular dependencies
   */
  private checkCircularDependencies(steps: WorkflowStep[]): string | null {
    const stepIds = new Set(steps.map(s => s.id));
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (stepId: string, path: string[]): string | null => {
      if (visiting.has(stepId)) {
        return `Circular dependency detected: ${[...path, stepId].join(' -> ')}`;
      }
      if (visited.has(stepId)) return null;

      visiting.add(stepId);
      path.push(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step?.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep)) {
            return `Step ${stepId} depends on unknown step: ${dep}`;
          }
          const error = visit(dep, [...path]);
          if (error) return error;
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      return null;
    };

    for (const step of steps) {
      const error = visit(step.id, []);
      if (error) return error;
    }

    return null;
  }

  /**
   * Apply default values
   */
  private applyDefaults(workflow: any): WorkflowDefinition {
    return {
      name: workflow.name,
      description: workflow.description || '',
      version: workflow.version || '1.0.0',
      creator: {
        address: workflow.creator.address,
        name: workflow.creator.name,
        revenueShare: workflow.creator.revenueShare ?? 70,
      },
      pricing: {
        basePrice: workflow.pricing.basePrice,
        currency: 'USDC',
        dynamicPricing: workflow.pricing.dynamicPricing ?? false,
      },
      inputs: (workflow.inputs || []).map((input: any) => ({
        name: input.name,
        type: input.type,
        description: input.description || '',
        required: input.required ?? true,
        default: input.default,
      })),
      steps: workflow.steps.map((step: any) => ({
        id: step.id,
        name: step.name || step.id,
        type: step.type,
        tool: step.tool,
        ai: step.ai,
        transform: step.transform,
        condition: step.condition,
        loop: step.loop,
        dependsOn: step.dependsOn || [],
        onError: step.onError || 'fail',
        retries: step.retries || 0,
        estimatedCost: step.estimatedCost,
      })),
      output: workflow.output || { template: '{{steps}}' },
      tags: workflow.tags || [],
      category: workflow.category,
      isPublic: workflow.isPublic ?? false,
    };
  }

  /**
   * Convert workflow to YAML for export
   */
  toYAML(workflow: WorkflowDefinition): string {
    return yaml.stringify(workflow);
  }

  /**
   * Convert workflow to JSON for export
   */
  toJSON(workflow: WorkflowDefinition): string {
    return JSON.stringify(workflow, null, 2);
  }
}

export const workflowParser = new WorkflowParser();
