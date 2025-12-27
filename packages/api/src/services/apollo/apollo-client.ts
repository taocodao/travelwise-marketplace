// packages/api/src/services/apollo/apollo-client.ts - Apollo API Client

import { 
    ApolloPeopleSearchResponse, 
    ApolloSearchFilters 
} from './types';
import { APOLLO_API_BASE_URL, APOLLO_API_KEY } from './config';

export class ApolloApiClient {
    private static instance: ApolloApiClient;
    private apiKey: string;

    private constructor() {
        this.apiKey = APOLLO_API_KEY || '';
    }

    public static getInstance(): ApolloApiClient {
        if (!ApolloApiClient.instance) {
            ApolloApiClient.instance = new ApolloApiClient();
        }
        return ApolloApiClient.instance;
    }

    /**
     * Call Apollo.io API with the provided filters
     */
    async searchPeople(
        filters: ApolloSearchFilters,
        customApiKey?: string
    ): Promise<ApolloPeopleSearchResponse> {
        const apiKey = customApiKey || this.apiKey;
        
        if (!apiKey) {
            throw new Error('Apollo API key not configured');
        }

        const url = `${APOLLO_API_BASE_URL}/mixed_people/search`;
        
        console.log('[Apollo] Calling API:', {
            url,
            filtersCount: Object.keys(filters).length,
            perPage: filters.per_page
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
            },
            body: JSON.stringify({
                ...filters,
                api_key: apiKey,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Apollo] API error:', response.status, errorText);
            
            if (response.status === 401) {
                throw new Error('Invalid Apollo API key');
            }
            if (response.status === 402) {
                throw new Error('Apollo API credit limit reached');
            }
            throw new Error(`Apollo API error: ${response.status}`);
        }

        const data = await response.json() as ApolloPeopleSearchResponse;
        
        console.log('[Apollo] API success:', {
            peopleCount: data.people?.length || 0,
            totalEntries: data.pagination?.total_entries
        });

        return data;
    }

    /**
     * Enrich a person's contact information
     */
    async enrichPerson(params: {
        first_name?: string;
        last_name?: string;
        email?: string;
        organization_name?: string;
        linkedin_url?: string;
    }, customApiKey?: string): Promise<any> {
        const apiKey = customApiKey || this.apiKey;
        
        if (!apiKey) {
            throw new Error('Apollo API key not configured');
        }

        const url = `${APOLLO_API_BASE_URL}/people/match`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
            },
            body: JSON.stringify({
                ...params,
                api_key: apiKey,
                reveal_personal_emails: true,
                reveal_phone_number: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Apollo enrichment error: ${response.status} - ${errorText}`);
        }

        return response.json();
    }
}
