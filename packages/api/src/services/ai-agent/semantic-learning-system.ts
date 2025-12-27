/**
 * Semantic Learning System
 * 
 * Self-learning wrapper that:
 * - Stores successful queries + user selections
 * - Uses ConversationRAG for query similarity
 * - Boosts similar results in future searches
 * - Tracks user location preferences
 */

import { PrismaClient } from '@prisma/client';
import { ConversationRAG } from './conversationRag';
import { LocationResult, ParsedQuery } from './semantic-location-search';

const prisma = new PrismaClient();

export interface SearchFeedback {
  searchId: string;
  userId?: string;
  query: string;
  selectedPlaceId?: string;
  selectedIndex?: number;
  feedback?: 'positive' | 'negative';
  viewedPlaceIds?: string[];
}

export interface UserLocationProfile {
  userId: string;
  preferredTypes: string[];
  preferredVibes: string[];
  avoidTypes: string[];
  pricePreference?: number;
  frequentLocations: { lat: number; lng: number; name: string }[];
}

export class SemanticLearningSystem {
  private rag = new ConversationRAG();

  /**
   * Log a search and its results for learning
   */
  async logSearch(
    searchId: string,
    userId: string | undefined,
    query: string,
    parsedQuery: ParsedQuery,
    results: LocationResult[]
  ): Promise<void> {
    try {
      // Generate embedding for the query
      const embedding = await this.rag.generateEmbedding(query);

      // Store in database for analysis
      await prisma.$executeRaw`
        INSERT INTO location_search_logs (id, user_id, query, query_embedding, results, created_at)
        VALUES (${searchId}, ${userId || null}, ${query}, ${JSON.stringify(embedding)}::jsonb, ${JSON.stringify(results.slice(0, 10))}::jsonb, NOW())
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      console.error('Failed to log search:', error);
    }
  }

  /**
   * Record user selection from search results
   */
  async recordSelection(
    searchId: string,
    userId: string | undefined,
    selectedPlaceId: string,
    selectedIndex: number
  ): Promise<void> {
    try {
      // Update search log with selection
      await prisma.$executeRaw`
        UPDATE location_search_logs 
        SET selected_index = ${selectedIndex}
        WHERE id = ${searchId}
      `;

      // Get the original search query
      const searchLog = await prisma.$queryRaw<any[]>`
        SELECT query, results FROM location_search_logs WHERE id = ${searchId}
      `;

      if (searchLog.length > 0) {
        const { query, results } = searchLog[0];
        const selectedPlace = results[selectedIndex];

        // Store successful search in RAG for future learning
        await this.rag.storeConversation(
          query,
          JSON.stringify({
            selectedPlaceId,
            selectedName: selectedPlace?.name,
            selectedIndex,
            preferredType: selectedPlace?.types?.[0],
          }),
          'location_search_success'
        );

        // Update user preferences if userId provided
        if (userId) {
          await this.updateUserPreferences(userId, selectedPlace);
        }
      }
    } catch (error) {
      console.error('Failed to record selection:', error);
    }
  }

  /**
   * Record explicit feedback (thumbs up/down)
   */
  async recordFeedback(
    searchId: string,
    placeId: string,
    feedback: 'positive' | 'negative'
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE location_search_logs 
        SET feedback = ${feedback}
        WHERE id = ${searchId}
      `;

      // For negative feedback, we could add to avoid list
      // For positive, boost similar searches
    } catch (error) {
      console.error('Failed to record feedback:', error);
    }
  }

  /**
   * Update user preferences based on their selection
   */
  private async updateUserPreferences(userId: string, selectedPlace: any): Promise<void> {
    if (!selectedPlace) return;

    try {
      const existingPrefs = await prisma.$queryRaw<any[]>`
        SELECT * FROM location_preferences WHERE user_id = ${userId}
      `;

      if (existingPrefs.length === 0) {
        // Create new preferences
        await prisma.$executeRaw`
          INSERT INTO location_preferences (id, user_id, preferred_types, updated_at)
          VALUES (gen_random_uuid(), ${userId}, ${JSON.stringify([selectedPlace.types?.[0]])}::jsonb, NOW())
        `;
      } else {
        // Update existing preferences
        const current = existingPrefs[0];
        const types = new Set(current.preferred_types || []);
        if (selectedPlace.types?.[0]) {
          types.add(selectedPlace.types[0]);
        }

        await prisma.$executeRaw`
          UPDATE location_preferences 
          SET preferred_types = ${JSON.stringify(Array.from(types))}::jsonb,
              updated_at = NOW()
          WHERE user_id = ${userId}
        `;
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  }

  /**
   * Get learning boosts for a user
   */
  async getLearningBoosts(userId: string | undefined): Promise<Map<string, number>> {
    const boosts = new Map<string, number>();

    if (!userId) return boosts;

    try {
      // Get user preferences
      const prefs = await prisma.$queryRaw<any[]>`
        SELECT preferred_types, preferred_vibes, price_range 
        FROM location_preferences 
        WHERE user_id = ${userId}
      `;

      if (prefs.length > 0) {
        const pref = prefs[0];
        
        // Boost preferred types
        for (const type of (pref.preferred_types || [])) {
          boosts.set(`type:${type}`, 0.15);
        }

        // Boost preferred vibes
        for (const vibe of (pref.preferred_vibes || [])) {
          boosts.set(`vibe:${vibe}`, 0.1);
        }
      }

      // Get recent successful selections
      const recentSelections = await prisma.$queryRaw<any[]>`
        SELECT results, selected_index 
        FROM location_search_logs 
        WHERE user_id = ${userId} 
          AND selected_index IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10
      `;

      for (const selection of recentSelections) {
        if (selection.results && selection.selected_index !== null) {
          const place = selection.results[selection.selected_index];
          if (place?.placeId) {
            boosts.set(place.placeId, 0.25); // Significant boost for repeat places
          }
        }
      }
    } catch (error) {
      console.error('Failed to get learning boosts:', error);
    }

    return boosts;
  }

  /**
   * Get personalized suggestions for a user
   */
  async getSuggestions(
    userId: string,
    location?: { lat: number; lng: number }
  ): Promise<{ type: string; reason: string }[]> {
    const suggestions: { type: string; reason: string }[] = [];

    try {
      const prefs = await prisma.$queryRaw<any[]>`
        SELECT preferred_types, preferred_vibes 
        FROM location_preferences 
        WHERE user_id = ${userId}
      `;

      if (prefs.length > 0) {
        const pref = prefs[0];

        for (const type of (pref.preferred_types || []).slice(0, 3)) {
          suggestions.push({
            type,
            reason: `Based on your previous selections`,
          });
        }
      }

      // Add time-based suggestions
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 11) {
        suggestions.push({ type: 'cafe', reason: 'Good morning! Perfect time for coffee' });
      } else if (hour >= 11 && hour < 14) {
        suggestions.push({ type: 'restaurant', reason: 'Lunch time recommendation' });
      } else if (hour >= 17 && hour < 21) {
        suggestions.push({ type: 'restaurant', reason: 'Dinner time recommendation' });
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }

    return suggestions;
  }
}

export const semanticLearningSystem = new SemanticLearningSystem();
