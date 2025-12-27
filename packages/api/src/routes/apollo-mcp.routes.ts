// packages/api/src/routes/apollo-mcp.routes.ts - Apollo MCP Server Routes

import { Router, Request, Response } from 'express';
import { APOLLO_TOOLS, ApolloApiClient, PerplexitySearchEngine } from '../services/apollo';
import {
    formatLeadSearchResponse,
    formatICPAnalysisResponse,
    formatEnrichmentResponse
} from '../services/apollo/formatters';
import { 
    MCPRequest, 
    MCPResponse,
    ICPAnalysis,
    ICPCriteria,
    ApolloPersonResult
} from '../services/apollo/types';

const router = Router();
const apolloClient = ApolloApiClient.getInstance();
const perplexityEngine = new PerplexitySearchEngine();

/**
 * Helper: Categorize company size
 */
function categorizeCompanySize(employees: number): string {
    if (employees <= 10) return 'Startup (1-10)';
    if (employees <= 50) return 'Small (11-50)';
    if (employees <= 200) return 'Medium (51-200)';
    if (employees <= 1000) return 'Large (201-1000)';
    return 'Enterprise (1000+)';
}

/**
 * Analyze ICP from search results
 */
function analyzeICP(results: any, criteria: ICPCriteria): ICPAnalysis {
    const people = results.people || [];
    
    const analysis: ICPAnalysis = {
        total_companies: people.length,
        icp_match_score: 0,
        industry_distribution: {},
        size_distribution: {},
        funding_distribution: {},
        role_distribution: {},
        recommendations: [],
        confidence_score: 0.85,
    };

    let totalScore = 0;

    people.forEach((person: ApolloPersonResult) => {
        let score = 0;
        const company = person.organization;

        // Industry distribution
        if (company?.industry) {
            analysis.industry_distribution[company.industry] = 
                (analysis.industry_distribution[company.industry] || 0) + 1;
            if (criteria.industry && company.industry.toLowerCase().includes(criteria.industry.toLowerCase())) {
                score += 25;
            }
        }

        // Size distribution
        if (company?.employees) {
            const size = categorizeCompanySize(company.employees);
            analysis.size_distribution[size] = (analysis.size_distribution[size] || 0) + 1;
            if (criteria.employee_range) {
                const [min, max] = criteria.employee_range.split(',').map(Number);
                if (company.employees >= min && company.employees <= max) {
                    score += 25;
                }
            }
        }

        // Role distribution
        if (person.title) {
            analysis.role_distribution[person.title] = 
                (analysis.role_distribution[person.title] || 0) + 1;
        }

        totalScore += Math.min(score, 100);
    });

    analysis.icp_match_score = people.length > 0 ? totalScore / people.length : 0;

    // Generate recommendations
    const topIndustry = Object.entries(analysis.industry_distribution)
        .sort((a, b) => b[1] - a[1])[0];
    const topSize = Object.entries(analysis.size_distribution)
        .sort((a, b) => b[1] - a[1])[0];

    analysis.recommendations = [
        `Top industry: ${topIndustry?.[0] || 'Technology'} (${topIndustry?.[1] || 0} companies)`,
        `Dominant company size: ${topSize?.[0] || 'Medium'}`,
        `ICP match score: ${Math.round(analysis.icp_match_score)}/100`,
        analysis.icp_match_score > 60 
            ? 'Strong ICP alignment - proceed with outreach'
            : 'Consider expanding search criteria for better results',
    ];

    return analysis;
}

/**
 * MCP Server endpoint - handles all MCP requests
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const mcpRequest = req.body as MCPRequest;

    console.log('[Apollo MCP] Request received:', {
        method: mcpRequest.method,
        id: mcpRequest.id
    });

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (mcpRequest.jsonrpc !== '2.0') {
        res.status(400).json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            error: { code: -32600, message: 'Invalid JSON-RPC version' }
        });
        return;
    }

    // ===== TOOLS LIST =====
    if (mcpRequest.method === 'tools/list') {
        const tools = APOLLO_TOOLS.map(t => ({
            name: t.name,
            description: `${t.description} (Cost: $${t.cost} USD)`,
            inputSchema: t.inputSchema
        }));

        console.log('[Apollo MCP] Returning tools list:', { count: tools.length });

        res.status(200).json({
            jsonrpc: '2.0',
            id: mcpRequest.id,
            result: { tools }
        });
        return;
    }

    // ===== TOOL EXECUTION =====
    if (mcpRequest.method === 'tools/call') {
        const { name: toolName, arguments: args } = mcpRequest.params || {};
        const tool = APOLLO_TOOLS.find(t => t.name === toolName);

        if (!tool) {
            res.status(404).json({
                jsonrpc: '2.0',
                id: mcpRequest.id,
                error: { code: -32601, message: `Tool not found: ${toolName}` }
            });
            return;
        }

        try {
            let responseText = '';

            // ===== LEAD SEARCH =====
            if (toolName === 'apollo_lead_search') {
                const searchQuery = args.search_query || '';
                const resultLimit = args.result_limit || 25;

                console.log('[Apollo MCP] Lead search:', { query: searchQuery });

                // Use Perplexity to analyze and generate strategy
                const analysis = await perplexityEngine.analyzeQuery(searchQuery);
                const filters = perplexityEngine.convertToApolloFilters(analysis.strategy);
                filters.per_page = Math.min(resultLimit, 100);
                
                if (args.include_emails) {
                    filters.reveal_personal_emails = true;
                }
                if (args.include_phones) {
                    filters.reveal_phone_number = true;
                }

                // Execute Apollo search
                const results = await apolloClient.searchPeople(filters);
                
                responseText = formatLeadSearchResponse(results, searchQuery, analysis.strategy);
                responseText += `\n\n💰 **Cost:** $${tool.cost} USD | ⚡ ${Date.now() - startTime}ms`;
            }

            // ===== PEOPLE ENRICHMENT =====
            else if (toolName === 'apollo_people_enrichment') {
                console.log('[Apollo MCP] People enrichment:', {
                    hasEmail: !!args.email,
                    hasLinkedIn: !!args.linkedin_url
                });

                const enrichmentResult = await apolloClient.enrichPerson({
                    first_name: args.first_name,
                    last_name: args.last_name,
                    email: args.email,
                    organization_name: args.organization_name,
                    linkedin_url: args.linkedin_url,
                });

                responseText = formatEnrichmentResponse(enrichmentResult.person);
                responseText += `\n\n💰 **Cost:** $${tool.cost} USD | ⚡ ${Date.now() - startTime}ms`;
            }

            // ===== ICP MAPPING =====
            else if (toolName === 'apollo_icp_mapping') {
                const searchQuery = args.search_query || 
                    `Find ${(args.target_roles || ['decision makers']).join(', ')} in ${args.industry || 'technology'}`;

                console.log('[Apollo MCP] ICP mapping:', { 
                    query: searchQuery,
                    industry: args.industry
                });

                // Use Perplexity for ICP strategy
                const analysis = await perplexityEngine.analyzeQuery(searchQuery);
                const filters = perplexityEngine.convertToApolloFilters(analysis.strategy);
                filters.per_page = 50; // More data for ICP analysis

                // Execute search
                const results = await apolloClient.searchPeople(filters);

                // Build ICP criteria
                const criteria: ICPCriteria = {
                    industry: args.industry || analysis.strategy.organization_industries[0],
                    employee_range: args.employee_range || analysis.strategy.organization_num_employees_ranges[0],
                    funding_stages: args.funding_stages || analysis.strategy.organization_latest_funding_stage_cd,
                    locations: args.locations || analysis.strategy.organization_locations,
                    target_roles: args.target_roles || analysis.strategy.person_titles,
                };

                // Analyze ICP
                const icpAnalysis = analyzeICP(results, criteria);

                responseText = formatICPAnalysisResponse(
                    icpAnalysis, 
                    criteria, 
                    results.people?.slice(0, 5) || []
                );
                responseText += `\n\n💰 **Cost:** $${tool.cost} USD | ⚡ ${Date.now() - startTime}ms`;
            }

            console.log('[Apollo MCP] Success:', {
                tool: toolName,
                duration: Date.now() - startTime
            });

            res.status(200).json({
                jsonrpc: '2.0',
                id: mcpRequest.id,
                result: {
                    content: [{ type: 'text', text: responseText }]
                }
            });
            return;

        } catch (error: any) {
            console.error('[Apollo MCP] Error:', error.message);

            res.status(200).json({
                jsonrpc: '2.0',
                id: mcpRequest.id,
                result: {
                    content: [{
                        type: 'text',
                        text: `❌ **Apollo MCP Error**\n\n**Details:** ${error.message}\n\n💡 Please check your API key configuration and try again.`
                    }]
                }
            });
            return;
        }
    }

    // Unknown method
    res.status(400).json({
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: { code: -32601, message: `Method not found: ${mcpRequest.method}` }
    });
});

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        service: 'Apollo MCP Server',
        tools: APOLLO_TOOLS.map(t => t.name),
        timestamp: new Date().toISOString()
    });
});

export default router;
