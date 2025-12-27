// packages/api/src/services/apollo/types.ts - Apollo MCP Type Definitions

export interface MCPRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: any;
}

export interface MCPResponse {
    jsonrpc: '2.0';
    id: number | string | null;
    result?: {
        tools?: ApolloToolDefinition[];
        content?: Array<{ type: 'text'; text: string }>;
    };
    error?: { code: number; message: string; data?: string };
}

export interface ApolloToolDefinition {
    name: string;
    description: string;
    inputSchema: any;
}

export interface ApolloTool {
    name: string;
    description: string;
    inputSchema: any;
    cost: number;
    endpoint: string;
    paymentType: 'free' | 'metered';
    method: 'GET' | 'POST';
}

export interface ApolloPersonResult {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    title?: string | null;
    email?: string | null;
    email_status?: string | null;
    phone?: string | null;
    linkedin_url?: string | null;
    organization?: {
        id: string;
        name: string | null;
        website_url: string | null;
        industry: string | null;
        employees: number | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
    } | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
}

export interface ApolloPeopleSearchResponse {
    people: ApolloPersonResult[];
    pagination?: {
        page: number;
        per_page: number;
        total_entries: number;
        total_pages: number;
    };
}

export interface ApolloSearchFilters {
    person_titles?: string[];
    person_locations?: string[];
    organization_locations?: string[];
    organization_industries?: string[];
    organization_num_employees_ranges?: string[];
    organization_latest_funding_stage_cd?: string[];
    q_organization_keyword_tags?: string[];
    contact_email_status?: string;
    per_page?: number;
    page?: number;
    reveal_personal_emails?: boolean;
    reveal_phone_number?: boolean;
}

export interface ICPCriteria {
    industry?: string;
    employee_range?: string;
    funding_stages?: string[];
    technologies?: string[];
    growth_signals?: string[];
    locations?: string[];
    target_roles?: string[];
}

export interface ICPAnalysis {
    total_companies: number;
    icp_match_score: number;
    industry_distribution: Record<string, number>;
    size_distribution: Record<string, number>;
    funding_distribution: Record<string, number>;
    role_distribution: Record<string, number>;
    recommendations: string[];
    confidence_score: number;
}

export interface PerplexitySearchStrategy {
    person_titles: string[];
    organization_locations: string[];
    person_locations: string[];
    organization_industries: string[];
    organization_num_employees_ranges: string[];
    organization_latest_funding_stage_cd: string[];
    organization_keywords: string[];
    contact_email_status: string;
    search_reasoning: string;
    confidence_score: number;
}
