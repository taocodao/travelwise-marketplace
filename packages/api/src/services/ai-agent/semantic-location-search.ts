/**
 * Semantic Location Search Engine
 * 
 * Core search engine that:
 * - Parses natural language location queries
 * - Extracts location preferences (vibe, type, features)
 * - Searches using Google Maps API
 * - Ranks results using semantic similarity
 * - Generates AI explanations for each result
 */

import OpenAI from 'openai';
import axios from 'axios';
import { ConversationRAG } from './conversationRag';
import { PerplexityService } from './perplexityService';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Types
export interface LocationQuery {
  query: string;
  userId?: string;
  location?: { lat: number; lng: number };
  radius?: number;  // in meters
  limit?: number;
}

export interface ParsedQuery {
  placeType: string;       // cafe, restaurant, hotel, etc.
  vibes: string[];         // quiet, cozy, lively, romantic
  features: string[];      // wifi, outdoor seating, parking
  priceLevel: number | null;  // 1-4 ($ to $$$$)
  keywords: string[];
  nearLocation?: string;   // "Times Square", "Central Park"
}

export interface LocationResult {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating: number;
  priceLevel?: number;
  types: string[];
  photos?: string[];
  openNow?: boolean;
  
  // Semantic enhancements
  semanticScore: number;      // 0-1 relevance to query
  explanation: string;        // Why this result matches
  matchedFeatures: string[];  // Features that matched query
}

export interface SearchResponse {
  results: LocationResult[];
  query: ParsedQuery;
  searchId: string;
  processingTime: number;
}

export class SemanticLocationSearch {
  private rag = new ConversationRAG();
  private perplexity = new PerplexityService();
  private googleMapsKey = process.env.GOOGLE_MAPS_API_KEY!;

  /**
   * Main search method - semantic location discovery
   */
  async search(input: LocationQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 1. Parse the natural language query
    const parsedQuery = await this.parseQuery(input.query);

    // 2. Get location coordinates if needed
    let searchLocation = input.location;
    if (!searchLocation && parsedQuery.nearLocation) {
      searchLocation = await this.geocodeLocation(parsedQuery.nearLocation);
    }
    if (!searchLocation) {
      // Default to NYC
      searchLocation = { lat: 40.7128, lng: -74.0060 };
    }

    // 3. Search Google Maps
    const googleResults = await this.searchGoogleMaps(
      parsedQuery,
      searchLocation,
      input.radius || 2000
    );

    // 4. Find similar past successful searches
    const similarSearches = await this.rag.findSimilar(input.query, 3);
    const learningBoosts = this.extractLearningBoosts(similarSearches);

    // 5. Score and rank results semantically
    const scoredResults = await this.scoreResults(
      googleResults,
      parsedQuery,
      learningBoosts
    );

    // 6. Generate explanations for top results
    const enhancedResults = await this.addExplanations(
      scoredResults.slice(0, input.limit || 10),
      parsedQuery
    );

    return {
      results: enhancedResults,
      query: parsedQuery,
      searchId,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Parse natural language query into structured components
   */
  private async parseQuery(query: string): Promise<ParsedQuery> {
    const systemPrompt = `You are a location query parser. Extract structured information from natural language location searches.

Return JSON with:
- placeType: main type (cafe, restaurant, hotel, bar, park, gym, etc.)
- vibes: array of atmosphere descriptors (quiet, cozy, lively, romantic, hipster, professional)
- features: array of amenities (wifi, outdoor seating, parking, pet-friendly, vegetarian)
- priceLevel: 1-4 scale (null if not specified)
- keywords: important words from query
- nearLocation: specific location mentioned (Times Square, downtown, etc.)`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        placeType: 'place',
        vibes: [],
        features: [],
        priceLevel: null,
        keywords: query.split(' '),
      };
    }
  }

  /**
   * Geocode a location name to coordinates
   */
  private async geocodeLocation(location: string): Promise<{ lat: number; lng: number } | undefined> {
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: location,
          key: this.googleMapsKey,
        },
      });

      if (response.data.results?.[0]?.geometry?.location) {
        return response.data.results[0].geometry.location;
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
    }
    return undefined;
  }

  /**
   * Search Google Maps Places API
   */
  private async searchGoogleMaps(
    query: ParsedQuery,
    location: { lat: number; lng: number },
    radius: number
  ): Promise<any[]> {
    try {
      // Build search query from parsed components
      const searchKeyword = [query.placeType, ...query.vibes, ...query.keywords].join(' ');
      
      console.log('🗺️ Google Maps Search:', {
        location: `${location.lat},${location.lng}`,
        radius,
        keyword: searchKeyword,
        type: this.mapToGoogleType(query.placeType),
        hasKey: !!this.googleMapsKey
      });

      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: {
          location: `${location.lat},${location.lng}`,
          radius,
          keyword: searchKeyword,
          type: this.mapToGoogleType(query.placeType),
          key: this.googleMapsKey,
        },
      });

      console.log('🗺️ Google Maps Response:', {
        status: response.data.status,
        results: response.data.results?.length || 0,
        error: response.data.error_message
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        console.error('❌ Google Maps API Error:', response.data.status, response.data.error_message);
      }

      return response.data.results || [];
    } catch (error: any) {
      console.error('❌ Google Maps search failed:', error.message);
      return [];
    }
  }

  /**
   * Map our place types to Google Maps types
   */
  private mapToGoogleType(placeType: string): string {
    const mapping: Record<string, string> = {
      cafe: 'cafe',
      coffee: 'cafe',
      restaurant: 'restaurant',
      hotel: 'lodging',
      bar: 'bar',
      park: 'park',
      gym: 'gym',
      store: 'store',
      shop: 'store',
      museum: 'museum',
      theater: 'movie_theater',
    };
    return mapping[placeType.toLowerCase()] || 'point_of_interest';
  }

  /**
   * Extract learning boosts from past successful searches
   */
  private extractLearningBoosts(similarSearches: any[]): Map<string, number> {
    const boosts = new Map<string, number>();
    
    for (const search of similarSearches) {
      if (search.answer && search.score > 0.7) {
        try {
          const data = JSON.parse(search.answer);
          if (data.selectedPlaceId) {
            boosts.set(data.selectedPlaceId, 0.2); // 20% boost
          }
          if (data.preferredType) {
            boosts.set(`type:${data.preferredType}`, 0.15);
          }
        } catch {
          // Skip invalid entries
        }
      }
    }
    
    return boosts;
  }

  /**
   * Score results based on semantic similarity and learning
   */
  private async scoreResults(
    results: any[],
    query: ParsedQuery,
    learningBoosts: Map<string, number>
  ): Promise<LocationResult[]> {
    return results.map(place => {
      let score = 0.5; // Base score

      // Type match bonus
      if (place.types?.some((t: string) => t.includes(query.placeType))) {
        score += 0.2;
      }

      // Rating bonus
      if (place.rating) {
        score += (place.rating / 5) * 0.15;
      }

      // Price level match
      if (query.priceLevel && place.price_level === query.priceLevel) {
        score += 0.1;
      }

      // Open now bonus
      if (place.opening_hours?.open_now) {
        score += 0.05;
      }

      // Learning boosts
      if (learningBoosts.has(place.place_id)) {
        score += learningBoosts.get(place.place_id)!;
      }
      if (learningBoosts.has(`type:${query.placeType}`)) {
        score += learningBoosts.get(`type:${query.placeType}`)!;
      }

      // Match features to vibe keywords
      const matchedFeatures: string[] = [];
      for (const vibe of query.vibes) {
        // Check if place attributes suggest this vibe
        if (this.matchesVibe(place, vibe)) {
          matchedFeatures.push(vibe);
          score += 0.05;
        }
      }

      return {
        placeId: place.place_id,
        name: place.name,
        address: place.vicinity || place.formatted_address || '',
        location: place.geometry?.location || { lat: 0, lng: 0 },
        rating: place.rating || 0,
        priceLevel: place.price_level,
        types: place.types || [],
        photos: place.photos?.map((p: any) => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${p.photo_reference}&key=${this.googleMapsKey}`
        ),
        openNow: place.opening_hours?.open_now,
        semanticScore: Math.min(score, 1),
        explanation: '',
        matchedFeatures,
      };
    }).sort((a, b) => b.semanticScore - a.semanticScore);
  }

  /**
   * Check if a place matches a vibe descriptor
   */
  private matchesVibe(place: any, vibe: string): boolean {
    const vibeKeywords: Record<string, string[]> = {
      quiet: ['library', 'study', 'peaceful', 'serene'],
      cozy: ['intimate', 'warm', 'comfortable', 'small'],
      lively: ['popular', 'busy', 'vibrant', 'energetic'],
      romantic: ['intimate', 'candlelit', 'dinner', 'wine'],
      hipster: ['artisan', 'craft', 'indie', 'boutique'],
      professional: ['business', 'meeting', 'corporate'],
    };

    const keywords = vibeKeywords[vibe.toLowerCase()] || [];
    const placeText = JSON.stringify(place).toLowerCase();
    
    return keywords.some(kw => placeText.includes(kw));
  }

  /**
   * Generate AI explanations for why results match the query
   * Uses Perplexity for free text generation (saved $)
   */
  private async addExplanations(
    results: LocationResult[],
    query: ParsedQuery
  ): Promise<LocationResult[]> {
    if (results.length === 0) return results;

    const perplexity = new PerplexityService();
    
    const prompt = `For these ${results.length} locations matching "${query.placeType}" search with vibes: ${query.vibes.join(', ')}, generate brief explanations (1 sentence each) for why each matches.

Locations:
${results.map((r, i) => `${i + 1}. ${r.name} - Rating: ${r.rating}, Types: ${r.types.slice(0, 3).join(', ')}`).join('\n')}

Respond with ONLY numbered explanations, one per line, like:
1. This cafe is known for its quiet atmosphere...
2. Popular spot with great reviews...`;

    try {
      const response = await perplexity.search(prompt, 'Generate brief location descriptions');
      
      // Parse numbered lines from Perplexity response
      const lines = response.answer.split('\n').filter(line => /^\d+\./.test(line.trim()));
      
      return results.map((r, i) => ({
        ...r,
        explanation: lines[i] 
          ? lines[i].replace(/^\d+\.\s*/, '') 
          : `Great match for ${query.placeType} with ${r.rating} stars.`,
      }));
    } catch {
      return results.map(r => ({
        ...r,
        explanation: `Matches your search for ${query.placeType}.`,
      }));
    }
  }

  /**
   * Get detailed information about a specific place
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,formatted_phone_number,opening_hours,website,reviews,photos,price_level,rating,types',
          key: this.googleMapsKey,
        },
      });

      const place = response.data.result;
      
      // Enhance with Perplexity real-time info
      const insights = await this.perplexity.search(
        `What is ${place.name} at ${place.formatted_address} known for? Current reviews, atmosphere, popular items?`
      );

      return {
        ...place,
        aiInsights: insights.answer,
        sources: insights.citations,
      };
    } catch (error) {
      console.error('Place details failed:', error);
      return null;
    }
  }
}

export const semanticLocationSearch = new SemanticLocationSearch();
