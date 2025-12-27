/**
 * Workflow DSL Types
 * 
 * Define the structure of workflow definitions that can be:
 * 1. Created by users (YAML/JSON)
 * 2. Imported from n8n (future)
 * 3. Packaged as MCP servers
 */

export interface WorkflowDefinition {
  name: string;
  description: string;
  version: string;
  
  // Creator and monetization
  creator: {
    address: string;       // Wallet address
    name?: string;
    revenueShare: number;  // Percentage (0-100)
  };
  
  // Pricing
  pricing: {
    basePrice: number;     // USD per call
    currency: 'USDC';
    dynamicPricing?: boolean;  // Adjust based on step costs
  };
  
  // Input schema
  inputs: WorkflowInput[];
  
  // Workflow steps
  steps: WorkflowStep[];
  
  // Output configuration
  output: WorkflowOutput;
  
  // Metadata
  tags?: string[];
  category?: string;
  isPublic?: boolean;
}

export interface WorkflowInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

export interface WorkflowStep {
  id: string;
  name: string;
  
  // Step type
  type: 'mcp_tool' | 'ai_decision' | 'transform' | 'condition' | 'loop';
  
  // For mcp_tool type
  tool?: {
    server: string;   // MCP server name
    function: string; // Tool function name
    params: Record<string, any>; // Supports {{input.x}} and {{steps.y.z}} templates
  };
  
  // For ai_decision type
  ai?: {
    prompt: string;   // Template with {{input}} and {{steps}} access
    model?: string;   // Optional model override
    outputFormat?: 'text' | 'json';
  };
  
  // For transform type
  transform?: {
    input: string;    // Template reference
    expression: string; // JavaScript expression
  };
  
  // For condition type
  condition?: {
    if: string;       // Expression that evaluates to boolean
    then: string[];   // Step IDs to execute if true
    else?: string[];  // Step IDs to execute if false
  };
  
  // For loop type
  loop?: {
    over: string;     // Template reference to array
    as: string;       // Variable name for each item
    steps: string[];  // Step IDs to execute for each
  };
  
  // Dependencies
  dependsOn?: string[];   // Step IDs that must complete first
  
  // Error handling
  onError?: 'fail' | 'skip' | 'retry';
  retries?: number;
  
  // Cost tracking
  estimatedCost?: number;
}

export interface WorkflowOutput {
  // Template for final output
  template: string;
  
  // Or structured output
  schema?: {
    type: string;
    properties: Record<string, any>;
  };
}

export interface WorkflowExecutionContext {
  workflowId: string;
  executionId: string;
  userId?: string;
  
  // Input values
  input: Record<string, any>;
  
  // Step results
  steps: Record<string, any>;
  
  // Cost tracking
  costs: {
    stepId: string;
    cost: number;
    tool?: string;
  }[];
  
  // Execution state
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep?: string;
  error?: string;
  
  // Timestamps
  startedAt: Date;
  completedAt?: Date;
}

export interface WorkflowExecutionResult {
  success: boolean;
  output: any;
  executionId: string;
  
  // Cost breakdown
  totalCost: number;
  stepCosts: { stepId: string; cost: number }[];
  
  // Timing
  executionTime: number;
  
  // Revenue split
  creatorRevenue: number;
  platformRevenue: number;
}
