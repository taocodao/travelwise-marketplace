// packages/api/src/services/apollo/config.ts - Apollo MCP Configuration

import { ApolloTool } from './types';

export const APOLLO_API_BASE_URL = 'https://api.apollo.io/v1';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
export const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

export const APOLLO_TOOLS: ApolloTool[] = [
    {
        name: 'apollo_lead_search',
        description: 'AI-POWERED LEAD SEARCH: Uses Perplexity AI to analyze natural language queries and generate optimal Apollo.io search strategies. Returns qualified B2B leads with contact information.',
        cost: 0.05,
        paymentType: 'metered',
        endpoint: '/mixed_people/search',
        method: 'POST',
        inputSchema: {
            type: 'object',
            properties: {
                search_query: {
                    type: 'string',
                    description: "Natural language search query (e.g., 'Find VP of Sales at fintech startups in New York with Series A funding')",
                },
                result_limit: {
                    type: 'number',
                    minimum: 1,
                    maximum: 100,
                    default: 25,
                },
                include_emails: { type: 'boolean', default: true },
                include_phones: { type: 'boolean', default: false },
            },
            required: ['search_query'],
        },
    },
    {
        name: 'apollo_people_enrichment',
        description: 'PEOPLE ENRICHMENT: Enriches individual contact data using Apollo.io. Provides detailed information including employment history, education, and verified contact details.',
        cost: 0.03,
        paymentType: 'metered',
        endpoint: '/people/match',
        method: 'POST',
        inputSchema: {
            type: 'object',
            properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                email: { type: 'string' },
                organization_name: { type: 'string' },
                linkedin_url: { type: 'string' },
            },
            required: [],
        },
    },
    {
        name: 'apollo_icp_mapping',
        description: 'ICP MAPPING: Analyze and map your Ideal Customer Profile using Apollo.io. Get industry distribution, company size analysis, and strategic recommendations for B2B targeting.',
        cost: 0.08,
        paymentType: 'metered',
        endpoint: '/mixed_people/search',
        method: 'POST',
        inputSchema: {
            type: 'object',
            properties: {
                search_query: {
                    type: 'string',
                    description: 'Natural language description of your ideal customer profile'
                },
                industry: { type: 'string' },
                employee_range: { type: 'string' },
                funding_stages: { type: 'array', items: { type: 'string' } },
                locations: { type: 'array', items: { type: 'string' } },
                target_roles: { type: 'array', items: { type: 'string' } },
            },
            required: [],
        },
    },
];
