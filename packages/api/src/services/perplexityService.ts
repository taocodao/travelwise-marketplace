import OpenAI from 'openai';

export interface PerplexitySearchResult {
  answer: string;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  searchQuery: string;
  confidence: number;
}

export class PerplexityService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY!,
      baseURL: 'https://api.perplexity.ai',
    });
  }

  // Search and analyze query with Perplexity
  async searchAndAnalyze(query: string, context?: string): Promise<PerplexitySearchResult> {
    const systemPrompt = `You are a travel planning expert with access to real-time information. 
Analyze the user's travel query and provide:
1. Accurate, up-to-date information
2. Specific recommendations
3. Practical insights
4. Citations from reliable sources

${context ? `Context: ${context}` : ''}`;

    const completion = await this.client.chat.completions.create({
      model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const message = completion.choices[0].message;
    
    return {
      answer: message.content || '',
      sources: this.extractSources(message),
      searchQuery: query,
      confidence: 0.9, // Perplexity responses are generally high confidence
    };
  }

  // Extract location and travel entities
  async extractTravelEntities(query: string): Promise<{
    locations: string[];
    dates: string[];
    activities: string[];
    preferences: Record<string, any>;
  }> {
    const prompt = `Extract travel information from: "${query}"
    
Return JSON with:
- locations: array of place names
- dates: array of date strings
- activities: what user wants to do
- preferences: budget, style, interests, etc.`;

    const completion = await this.client.chat.completions.create({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    try {
      // Parse JSON from response
      const content = completion.choices[0].message.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {
        locations: [],
        dates: [],
        activities: [],
        preferences: {},
      };
    } catch {
      return {
        locations: [],
        dates: [],
        activities: [],
        preferences: {},
      };
    }
  }

  // Generate training examples using Perplexity
  async generateExamples(category: string, count: number = 5) {
    const prompt = `Generate ${count} realistic travel planning Q&A examples for category: ${category}.

Examples should cover:
- Hotels and accommodations
- Weather and climate
- Routes and transportation
- Itinerary planning
- Sightseeing recommendations

Return JSON array: [{"question": "...", "answer": "..."}]`;

    const completion = await this.client.chat.completions.create({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    try {
      const content = completion.choices[0].message.content || '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      return [];
    }
  }

  // Get real-time travel insights
  async getTravelInsights(destination: string): Promise<string> {
    const query = `What are the current travel insights, weather conditions, popular attractions, and local tips for traveling to ${destination} right now?`;
    
    const result = await this.searchAndAnalyze(query);
    return result.answer;
  }

  private extractSources(message: any): Array<{ title: string; url: string; snippet: string }> {
    // Perplexity includes citations in the response
    // Parse them from the message content or metadata
    const sources: Array<{ title: string; url: string; snippet: string }> = [];
    
    if (message.content) {
      const urlRegex = /\[(\d+)\]\s*(https?:\/\/[^\s\)]+)/g;
      let match;
      
      while ((match = urlRegex.exec(message.content)) !== null) {
        sources.push({
          title: `Source ${match[1]}`,
          url: match[2],
          snippet: '',
        });
      }
    }
    
    return sources;
  }
}

export const perplexityService = new PerplexityService();
