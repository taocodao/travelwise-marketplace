import axios from 'axios';
import { PerplexityCache } from './perplexityCache';

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  answer: string;
  citations: string[];
  searchQueries: string[];
}

export class PerplexityService {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.perplexity.ai';
  private cache: PerplexityCache;

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    this.model = process.env.PERPLEXITY_MODEL || 'sonar-pro';
    this.cache = new PerplexityCache(3600); // 1 hour cache
    
    if (!this.apiKey) {
      console.warn('⚠️ PERPLEXITY_API_KEY not configured - Perplexity search will be unavailable');
    } else {
      console.log('✅ Perplexity service initialized');
    }
  }

  async search(query: string, context?: string): Promise<PerplexityResponse> {
    if (!this.apiKey) {
      return {
        answer: 'Perplexity search not available (API key not configured)',
        citations: [],
        searchQueries: [],
      };
    }

    // Generate cache key that includes context
    const cacheKey = this.generateCacheKey(query, context);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log('💾 Using cached Perplexity result');
      return this.cache.get(cacheKey);
    }

    try {
      console.log('🔍 Calling Perplexity API...');
      
      const messages: PerplexityMessage[] = [
        {
          role: 'system',
          content: context || 'You are a helpful travel research assistant. Provide accurate, up-to-date information about travel destinations, hotels, weather, and tourism.',
        },
        {
          role: 'user',
          content: query,
        },
      ];

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          max_tokens: 1000,
          temperature: 0.2,
          return_citations: true,
          return_images: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      const choice = data.choices[0];
      
      const result: PerplexityResponse = {
        answer: choice.message.content,
        citations: data.citations || [],
        searchQueries: data.search_queries || [],
      };

      // Cache the successful result
      this.cache.set(cacheKey, result);
      console.log('✅ Perplexity result cached');

      return result;
    } catch (error: any) {
      console.error('❌ Perplexity API error:', error.response?.data || error.message);
      
      // Return a graceful error response instead of throwing
      return {
        answer: `Unable to fetch current information: ${error.message}`,
        citations: [],
        searchQueries: [],
      };
    }
  }

  async enhanceQuery(userQuery: string): Promise<{
    enhancedQuery: string;
    context: string;
    insights: string[];
  }> {
    const searchQuery = `Research context for travel query: "${userQuery}". Provide current information about destinations, hotels, weather, events, and travel advisories if relevant.`;
    
    const result = await this.search(searchQuery);

    return {
      enhancedQuery: userQuery,
      context: result.answer,
      insights: result.citations,
    };
  }

  async verifyInformation(claim: string): Promise<{
    verified: boolean;
    explanation: string;
    sources: string[];
  }> {
    const searchQuery = `Verify this travel information: "${claim}". Is this accurate and up-to-date?`;
    
    const result = await this.search(searchQuery);

    // Fix: Explicitly determine boolean value
    const answerLower = result.answer.toLowerCase();
    let isVerified: boolean = true;
    
    if (answerLower.includes('incorrect') || 
        answerLower.includes('outdated') ||
        answerLower.includes('inaccurate') ||
        answerLower.includes('false') ||
        answerLower.includes('no longer valid')) {
      isVerified = false;
    }

    return {
      verified: isVerified,
      explanation: result.answer,
      sources: result.citations,
    };
  }

  async getRealtimeInfo(topic: string, location?: string): Promise<{
    information: string;
    sources: string[];
    lastUpdated: Date;
  }> {
    const searchQuery = location
      ? `Current information about ${topic} in ${location}`
      : `Current information about ${topic}`;
    
    const result = await this.search(searchQuery, 'Provide the most current, factual information available.');

    return {
      information: result.answer,
      sources: result.citations,
      lastUpdated: new Date(),
    };
  }

  private generateCacheKey(query: string, context?: string): string {
    // Create a unique cache key combining query and context
    const contextHash = context ? this.simpleHash(context) : 'default';
    return `${query}::${contextHash}`;
  }

  private simpleHash(str: string): string {
    // Simple hash function for context
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size(),
      ttl: 3600,
      enabled: !!this.apiKey,
    };
  }

  // Clear cache manually if needed
  clearCache() {
    this.cache.clear();
    console.log('🧹 Perplexity cache cleared');
  }

  // Check if service is available
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  // Cleanup resources
  destroy(): void {
    this.cache.destroy();
  }
}
