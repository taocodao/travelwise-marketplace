// packages/api/src/services/apollo/perplexity-engine.ts - AI-Enhanced Search Strategy Generator

import OpenAI from 'openai';
import { PerplexitySearchStrategy, ApolloSearchFilters } from './types';
import { OPENAI_API_KEY, PERPLEXITY_API_KEY } from './config';

export class PerplexitySearchEngine {
    private perplexityClient: OpenAI;
    private openaiClient: OpenAI;
    private cache: Map<string, { result: any; timestamp: number }> = new Map();

    constructor() {
        if (!PERPLEXITY_API_KEY) {
            console.warn('[Perplexity] API key not configured, using fallback mode');
        }
        if (!OPENAI_API_KEY) {
            console.warn('[OpenAI] API key not configured');
        }

        this.perplexityClient = new OpenAI({
            apiKey: PERPLEXITY_API_KEY || 'dummy',
            baseURL: 'https://api.perplexity.ai',
        });

        this.openaiClient = new OpenAI({
            apiKey: OPENAI_API_KEY || 'dummy',
        });
    }

    /**
     * Analyze query and generate Apollo search strategy using Perplexity AI
     */
    async analyzeQuery(query: string): Promise<{
        strategy: PerplexitySearchStrategy;
        analysis: string;
        recommendations: string[];
    }> {
        // Check cache
        const cacheKey = `query_${query}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 600000) { // 10 min cache
            console.log('[Perplexity] Using cached analysis');
            return cached.result;
        }

        if (!PERPLEXITY_API_KEY) {
            return this.generateFallbackStrategy(query);
        }

        try {
            const prompt = this.buildAnalysisPrompt(query);
            
            const response = await this.perplexityClient.chat.completions.create({
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert B2B lead generation strategist. Analyze search queries and generate precise Apollo.io search strategies.'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
            });

            const content = response.choices[0]?.message?.content || '';
            const result = await this.parseResponse(content, query);
            
            // Cache result
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
            
            return result;
        } catch (error: any) {
            console.error('[Perplexity] Analysis failed:', error.message);
            return this.generateFallbackStrategy(query);
        }
    }

    /**
     * Build the analysis prompt
     */
    private buildAnalysisPrompt(query: string): string {
        return `Transform this B2B lead generation query into an Apollo.io search strategy:

QUERY: "${query}"

Analyze the query and extract:
1. Target job titles (6-10 variations)
2. Target locations (both person and company)
3. Industries to search
4. Company size ranges
5. Funding stages (if mentioned)
6. Keywords for company filtering

Return a JSON object with:
{
  "person_titles": ["array of job titles"],
  "person_locations": ["array of locations"],
  "organization_locations": ["array of company locations"],
  "organization_industries": ["array of industries"],
  "organization_num_employees_ranges": ["array of ranges like '11,50'"],
  "organization_latest_funding_stage_cd": ["array of stages"],
  "organization_keywords": ["array of keywords"],
  "contact_email_status": "verified",
  "search_reasoning": "explanation of the strategy",
  "confidence_score": 0.85
}`;
    }

    /**
     * Parse Perplexity response
     */
    private async parseResponse(content: string, query: string): Promise<{
        strategy: PerplexitySearchStrategy;
        analysis: string;
        recommendations: string[];
    }> {
        try {
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*?\}/);
            let strategyData: any;

            if (jsonMatch) {
                strategyData = JSON.parse(jsonMatch[0]);
            } else {
                // Use GPT to extract structured data
                strategyData = await this.extractWithGPT(content);
            }

            const strategy: PerplexitySearchStrategy = {
                person_titles: strategyData.person_titles || [],
                person_locations: strategyData.person_locations || [],
                organization_locations: strategyData.organization_locations || [],
                organization_industries: strategyData.organization_industries || [],
                organization_num_employees_ranges: strategyData.organization_num_employees_ranges || [],
                organization_latest_funding_stage_cd: strategyData.organization_latest_funding_stage_cd || [],
                organization_keywords: strategyData.organization_keywords || [],
                contact_email_status: 'verified',
                search_reasoning: strategyData.search_reasoning || 'AI-generated strategy',
                confidence_score: strategyData.confidence_score || 0.8,
            };

            return {
                strategy,
                analysis: content,
                recommendations: this.extractRecommendations(content),
            };
        } catch (error: any) {
            console.error('[Perplexity] Parse error:', error.message);
            return this.generateFallbackStrategy(query);
        }
    }

    /**
     * Extract structured strategy using GPT
     */
    private async extractWithGPT(content: string): Promise<any> {
        if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        const response = await this.openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Extract and return ONLY valid JSON from the text. Return Apollo.io search parameters.'
                },
                { role: 'user', content: `Extract search strategy from:\n\n${content}` }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
        });

        return JSON.parse(response.choices[0]?.message?.content || '{}');
    }

    /**
     * Generate fallback strategy when AI is unavailable
     */
    generateFallbackStrategy(query: string): {
        strategy: PerplexitySearchStrategy;
        analysis: string;
        recommendations: string[];
    } {
        const lowerQuery = query.toLowerCase();

        const strategy: PerplexitySearchStrategy = {
            person_titles: this.extractTitles(lowerQuery),
            person_locations: this.extractLocations(lowerQuery),
            organization_locations: this.extractLocations(lowerQuery),
            organization_industries: this.extractIndustries(lowerQuery),
            organization_num_employees_ranges: this.extractEmployeeRanges(lowerQuery),
            organization_latest_funding_stage_cd: this.extractFundingStages(lowerQuery),
            organization_keywords: this.extractKeywords(lowerQuery),
            contact_email_status: 'verified',
            search_reasoning: 'Fallback strategy based on keyword analysis',
            confidence_score: 0.6,
        };

        return {
            strategy,
            analysis: 'Fallback analysis: Using keyword extraction for search parameters',
            recommendations: [
                'Consider refining your search query for better results',
                'Add specific job titles for more targeted leads',
                'Include location information for geographic targeting',
            ],
        };
    }

    /**
     * Convert strategy to Apollo filters
     */
    convertToApolloFilters(strategy: PerplexitySearchStrategy): ApolloSearchFilters {
        const filters: ApolloSearchFilters = {
            per_page: 25,
            page: 1,
        };

        if (strategy.person_titles.length > 0) {
            filters.person_titles = strategy.person_titles;
        }
        if (strategy.person_locations.length > 0) {
            filters.person_locations = strategy.person_locations;
        }
        if (strategy.organization_locations.length > 0) {
            filters.organization_locations = strategy.organization_locations;
        }
        if (strategy.organization_industries.length > 0) {
            filters.organization_industries = strategy.organization_industries;
        }
        if (strategy.organization_num_employees_ranges.length > 0) {
            filters.organization_num_employees_ranges = strategy.organization_num_employees_ranges;
        }
        if (strategy.organization_latest_funding_stage_cd.length > 0) {
            filters.organization_latest_funding_stage_cd = strategy.organization_latest_funding_stage_cd;
        }
        if (strategy.organization_keywords.length > 0) {
            filters.q_organization_keyword_tags = strategy.organization_keywords;
        }
        if (strategy.contact_email_status) {
            filters.contact_email_status = strategy.contact_email_status;
        }

        return filters;
    }

    // Helper extraction methods
    private extractTitles(query: string): string[] {
        if (query.includes('cto') || query.includes('chief technology')) {
            return ['CTO', 'Chief Technology Officer', 'VP of Engineering', 'Head of Technology'];
        }
        if (query.includes('ceo') || query.includes('founder')) {
            return ['CEO', 'Founder', 'Co-Founder', 'President', 'Managing Director'];
        }
        if (query.includes('vp sales') || query.includes('vp of sales')) {
            return ['VP of Sales', 'Vice President of Sales', 'Head of Sales', 'Chief Revenue Officer'];
        }
        if (query.includes('marketing')) {
            return ['Marketing Director', 'Head of Marketing', 'VP of Marketing', 'CMO'];
        }
        return ['Director', 'VP', 'Head of', 'Manager'];
    }

    private extractLocations(query: string): string[] {
        if (query.includes('new york') || query.includes('nyc')) {
            return ['New York, NY, USA', 'New York City, NY, USA'];
        }
        if (query.includes('san francisco') || query.includes('sf')) {
            return ['San Francisco, CA, USA', 'Bay Area, CA, USA'];
        }
        if (query.includes('california')) {
            return ['San Francisco, CA, USA', 'Los Angeles, CA, USA'];
        }
        if (query.includes('texas')) {
            return ['Austin, TX, USA', 'Dallas, TX, USA', 'Houston, TX, USA'];
        }
        return [];
    }

    private extractIndustries(query: string): string[] {
        if (query.includes('fintech') || query.includes('financial')) {
            return ['Financial Services', 'Banking', 'Fintech'];
        }
        if (query.includes('saas') || query.includes('software')) {
            return ['Computer Software', 'Information Technology', 'SaaS'];
        }
        if (query.includes('ai') || query.includes('machine learning')) {
            return ['Artificial Intelligence', 'Computer Software', 'Technology'];
        }
        if (query.includes('healthcare') || query.includes('health')) {
            return ['Healthcare', 'Hospital & Health Care', 'Biotechnology'];
        }
        return ['Computer Software', 'Information Technology'];
    }

    private extractEmployeeRanges(query: string): string[] {
        if (query.includes('startup')) return ['1,50'];
        if (query.includes('mid-size') || query.includes('midsize')) return ['51,200'];
        if (query.includes('enterprise') || query.includes('large')) return ['501,5000'];
        return ['11,200'];
    }

    private extractFundingStages(query: string): string[] {
        if (query.includes('series a')) return ['series_a'];
        if (query.includes('series b')) return ['series_b'];
        if (query.includes('series c')) return ['series_c'];
        if (query.includes('seed')) return ['seed'];
        if (query.includes('funded')) return ['series_a', 'series_b', 'series_c'];
        return [];
    }

    private extractKeywords(query: string): string[] {
        const keywords: string[] = [];
        if (query.includes('ai')) keywords.push('artificial intelligence', 'AI', 'machine learning');
        if (query.includes('fintech')) keywords.push('fintech', 'payments', 'financial technology');
        if (query.includes('saas')) keywords.push('SaaS', 'cloud', 'software');
        if (query.includes('startup')) keywords.push('startup', 'early stage');
        return keywords.length > 0 ? keywords : ['technology', 'software'];
    }

    private extractRecommendations(content: string): string[] {
        const recommendations: string[] = [];
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.includes('recommend') || line.includes('suggest')) {
                recommendations.push(line.trim());
            }
        }
        if (recommendations.length === 0) {
            recommendations.push('Use verified email contacts for higher deliverability');
            recommendations.push('Combine industry and location filters for precision');
        }
        return recommendations.slice(0, 3);
    }
}
