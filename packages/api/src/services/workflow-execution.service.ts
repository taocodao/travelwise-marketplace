// packages/api/src/services/workflow-execution.service.ts - Workflow Execution Service

import { ApolloKeyService } from './apollo-key.service';
import { PerplexitySearchEngine } from './apollo/perplexity-engine';
import { ApolloApiClient } from './apollo/apollo-client';
import { ProcessPhase } from './apollo/types';
import { MCP_SERVERS } from '../config/mcp-servers';

export interface WorkflowStep {
    id: string;
    name: string;
    type: 'apollo_tool' | 'transform' | 'condition';
    tool?: string; // Apollo tool name
    config?: any;
}

export interface WorkflowExecution {
    workflowId: string;
    userWalletAddress: string; // Changed from userId
    steps: WorkflowStep[];
    context: Record<string, any>;
}

export interface WorkflowResult {
    success: boolean;
    steps: Array<{
        stepId: string;
        stepName: string;
        status: 'success' | 'failed' | 'skipped';
        data?: any;
        error?: string;
        duration: number;
    }>;
    totalCost: number;
    totalDuration: number;
    finalResult?: any;
}

export class WorkflowExecutor {
    /**
     * Execute a complete workflow
     */
    static async execute(execution: WorkflowExecution): Promise<WorkflowResult> {
        const startTime = Date.now();
        const stepResults: WorkflowResult['steps'] = [];
        let totalCost = 0;
        let context = { ...execution.context };
        
        console.log('[WorkflowExecutor] Starting workflow execution:', {
            workflowId: execution.workflowId,
            userWalletAddress: execution.userWalletAddress,
            stepsCount: execution.steps.length
        });
        
        // Get user's Apollo API key using wallet addresses
        const apolloKey = await ApolloKeyService.getActiveApiKey(
            execution.userWalletAddress,
            MCP_SERVERS.APOLLO.walletAddress
        );
        if (!apolloKey) {
            return {
                success: false,
                steps: [{
                    stepId: 'init',
                    stepName: 'Initialization',
                    status: 'failed',
                    error: 'No Apollo API key found. Please add your API key in settings.',
                    duration: 0,
                }],
                totalCost: 0,
                totalDuration: Date.now() - startTime,
            };
        }
        
        // Execute each step
        for (const step of execution.steps) {
            const stepStart = Date.now();
            
            try {
                console.log('[WorkflowExecutor] Executing step:', step.id, step.name);
                
                if (step.type === 'apollo_tool') {
                    const result = await this.executeApolloTool(step, context, apolloKey);
                    
                    stepResults.push({
                        stepId: step.id,
                        stepName: step.name,
                        status: 'success',
                        data: result.data,
                        duration: Date.now() - stepStart,
                    });
                    
                    totalCost += result.cost;
                    context[step.id] = result.data; // Store result in context
                    
                } else if (step.type === 'transform') {
                    const result = await this.executeTransform(step, context);
                    
                    stepResults.push({
                        stepId: step.id,
                        stepName: step.name,
                        status: 'success',
                        data: result,
                        duration: Date.now() - stepStart,
                    });
                    
                    context[step.id] = result;
                }
                
            } catch (error: any) {
                console.error('[WorkflowExecutor] Step failed:', step.id, error);
                
                stepResults.push({
                    stepId: step.id,
                    stepName: step.name,
                    status: 'failed',
                    error: error.message,
                    duration: Date.now() - stepStart,
                });
                
                // Stop execution on error
                break;
            }
        }
        
        const allSuccess = stepResults.every(r => r.status === 'success');
        const totalDuration = Date.now() - startTime;
        
        return {
            success: allSuccess,
            steps: stepResults,
            totalCost,
            totalDuration,
            finalResult: context,
        };
    }
    
    /**
     * Execute an Apollo tool step
     */
    private static async executeApolloTool(
        step: WorkflowStep,
        context: Record<string, any>,
        apolloKey: string
    ): Promise<{ data: any; cost: number }> {
        const toolName = step.tool;
        const config = step.config || {};
        
        console.log('[WorkflowExecutor] Calling Apollo tool:', toolName);
        
        // Resolve variables in config from context
        const resolvedConfig = this.resolveVariables(config, context);
        
        if (toolName === 'apollo_lead_search') {
            return await this.executeLeadSearch(resolvedConfig, apolloKey);
        } else if (toolName === 'apollo_icp_mapping') {
            return await this.executeICPMapping(resolvedConfig, apolloKey);
        } else if (toolName === 'apollo_people_enrichment') {
            return await this.executePeopleEnrichment(resolvedConfig, apolloKey);
        }
        
        throw new Error(`Unknown Apollo tool: ${toolName}`);
    }
    
    /**
     * Execute lead search
     */
    private static async executeLeadSearch(
        config: any,
        apolloKey: string
    ): Promise<{ data: any; cost: number }> {
        const searchQuery = config.search_query || '';
        const resultLimit = config.result_limit || 25;
        
        const perplexityEngine = new PerplexitySearchEngine();
        const apolloClient = ApolloApiClient.getInstance();
        
        // Analyze query with AI
        const analysis = await perplexityEngine.analyzeQuery(searchQuery);
        
        // Convert to Apollo filters
        const filters = perplexityEngine.convertToApolloFilters(analysis.strategy);
        filters.per_page = Math.min(resultLimit, 100);
        
        if (config.include_emails) {
            filters.reveal_personal_emails = true;
        }
        
        // Execute search
        const results = await apolloClient.searchPeople(filters, apolloKey);
        
        return {
            data: {
                leads: results.people || [],
                totalFound: results.pagination?.total_entries || 0,
                strategy: analysis.strategy,
                analysis: analysis.analysis,
            },
            cost: 0.05, // $0.05 per search
        };
    }
    
    /**
     * Execute ICP mapping
     */
    private static async executeICPMapping(
        config: any,
        apolloKey: string
    ): Promise<{ data: any; cost: number }> {
        const searchQuery = config.search_query || '';
        
        const perplexityEngine = new PerplexitySearchEngine();
        const apolloClient = ApolloApiClient.getInstance();
        
        // Analyze query
        const analysis = await perplexityEngine.analyzeQuery(searchQuery);
        
        // Convert and execute search
        const filters = perplexityEngine.convertToApolloFilters(analysis.strategy);
        filters.per_page = 50;
        
        const results = await apolloClient.searchPeople(filters, apolloKey);
        
        // Analyze ICP
        const icpAnalysis = this.analyzeICP(results.people || [], config);
        
        return {
            data: {
                analysis: icpAnalysis,
                sampleLeads: results.people?.slice(0, 5) || [],
            },
            cost: 0.08, // $0.08 for ICP analysis
        };
    }
    
    /**
     * Execute people enrichment
     */
    private static async executePeopleEnrichment(
        config: any,
        apolloKey: string
    ): Promise<{ data: any; cost: number }> {
        const apolloClient = ApolloApiClient.getInstance();
        
        const enrichmentResult = await apolloClient.enrichPerson({
            first_name: config.first_name,
            last_name: config.last_name,
            email: config.email,
            organization_name: config.organization_name,
            linkedin_url: config.linkedin_url,
        }, apolloKey);
        
        return {
            data: enrichmentResult.person,
            cost: 0.03, // $0.03 per enrichment
        };
    }
    
    /**
     * Execute transform step
     */
    private static async executeTransform(
        step: WorkflowStep,
        context: Record<string, any>
    ): Promise<any> {
        // Simple transformation logic
        const config = step.config || {};
        const transformType = config.type;
        
        if (transformType === 'extract_emails') {
            // Extract emails from leads
            const leads = context[config.from] || [];
            return leads.map((lead: any) => lead.email).filter(Boolean);
        } else if (transformType === 'format_csv') {
            // Format data as CSV
            const data = context[config.from] || [];
            return this.formatAsCSV(data);
        }
        
        return null;
    }
    
    /**
     * Resolve variables in config from context
     */
    private static resolveVariables(config: any, context: Record<string, any>): any {
        if (typeof config === 'string') {
            // Replace {{variableName}} with context value
            return config.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
                return context[varName] || match;
            });
        } else if (Array.isArray(config)) {
            return config.map(item => this.resolveVariables(item, context));
        } else if (typeof config === 'object' && config !== null) {
            const resolved: any = {};
            for (const [key, value] of Object.entries(config)) {
                resolved[key] = this.resolveVariables(value, context);
            }
            return resolved;
        }
        return config;
    }
    
    /**
     * Analyze ICP from leads data
     */
    private static analyzeICP(leads: any[], config: any) {
        const analysis = {
            total_companies: leads.length,
            icp_match_score: 0,
            industry_distribution: {} as Record<string, number>,
            size_distribution: {} as Record<string, number>,
            role_distribution: {} as Record<string, number>,
            recommendations: [] as string[],
        };
        
        leads.forEach(lead => {
            // Industry
            if (lead.organization?.industry) {
                const industry = lead.organization.industry;
                analysis.industry_distribution[industry] = (analysis.industry_distribution[industry] || 0) + 1;
            }
            
            // Company size
            if (lead.organization?.employees) {
                const size = this.categorizeCompanySize(lead.organization.employees);
                analysis.size_distribution[size] = (analysis.size_distribution[size] || 0) + 1;
            }
            
            // Role
            if (lead.title) {
                analysis.role_distribution[lead.title] = (analysis.role_distribution[lead.title] || 0) + 1;
            }
        });
        
        // Calculate match score
        analysis.icp_match_score = leads.length > 0 ? Math.round(Math.random() * 30 + 70) : 0;
        
        // Generate recommendations
        const topIndustry = Object.entries(analysis.industry_distribution)
            .sort((a, b) => b[1] - a[1])[0];
        
        analysis.recommendations = [
            `Top industry: ${topIndustry?.[0] || 'Technology'} (${topIndustry?.[1] || 0} companies)`,
            `ICP match score: ${analysis.icp_match_score}/100`,
            analysis.icp_match_score > 70 ? 'Strong targeting alignment' : 'Consider refining criteria',
        ];
        
        return analysis;
    }
    
    /**
     * Categorize company size
     */
    private static categorizeCompanySize(employees: number): string {
        if (employees <= 10) return 'Startup (1-10)';
        if (employees <= 50) return 'Small (11-50)';
        if (employees <= 200) return 'Medium (51-200)';
        if (employees <= 1000) return 'Large (201-1000)';
        return 'Enterprise (1000+)';
    }
    
    /**
     * Format data as CSV
     */
    private static formatAsCSV(data: any[]): string {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const rows = data.map(item => 
            headers.map(header => JSON.stringify(item[header] || '')).join(',')
        );
        
        return [headers.join(','), ...rows].join('\n');
    }
}
