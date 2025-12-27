/**
 * Location Feedback Handler
 * 
 * Handles user feedback for location search results:
 * - Thumbs up/down on results
 * - Selection tracking
 * - Implicit feedback (view time, actions)
 */

import { PrismaClient } from '@prisma/client';
import { SemanticLearningSystem } from './semantic-learning-system';

const prisma = new PrismaClient();
const learningSystem = new SemanticLearningSystem();

export interface FeedbackData {
  searchId: string;
  userId?: string;
  placeId: string;
  action: 'view' | 'select' | 'like' | 'dislike' | 'visit' | 'save';
  metadata?: Record<string, any>;
}

export interface FeedbackResult {
  success: boolean;
  message: string;
  learningApplied: boolean;
}

export class LocationFeedbackHandler {
  /**
   * Process feedback from user
   */
  async processFeedback(feedback: FeedbackData): Promise<FeedbackResult> {
    const { searchId, userId, placeId, action, metadata } = feedback;

    try {
      switch (action) {
        case 'select':
          // User clicked on a result
          await learningSystem.recordSelection(
            searchId,
            userId,
            placeId,
            metadata?.index || 0
          );
          return {
            success: true,
            message: 'Selection recorded',
            learningApplied: true,
          };

        case 'like':
          // User gave thumbs up
          await learningSystem.recordFeedback(searchId, placeId, 'positive');
          await this.boostPlace(userId, placeId);
          return {
            success: true,
            message: 'Positive feedback recorded',
            learningApplied: true,
          };

        case 'dislike':
          // User gave thumbs down
          await learningSystem.recordFeedback(searchId, placeId, 'negative');
          await this.penalizePlace(userId, placeId);
          return {
            success: true,
            message: 'Negative feedback recorded',
            learningApplied: true,
          };

        case 'view':
          // User viewed details (implicit positive signal)
          await this.logView(searchId, userId, placeId);
          return {
            success: true,
            message: 'View logged',
            learningApplied: false,
          };

        case 'save':
          // User saved the location
          await this.saveLocation(userId, placeId, metadata);
          return {
            success: true,
            message: 'Location saved',
            learningApplied: true,
          };

        case 'visit':
          // User marked as visited
          await this.markVisited(userId, placeId);
          return {
            success: true,
            message: 'Marked as visited',
            learningApplied: true,
          };

        default:
          return {
            success: false,
            message: 'Unknown action',
            learningApplied: false,
          };
      }
    } catch (error: any) {
      console.error('Feedback processing failed:', error);
      return {
        success: false,
        message: error.message,
        learningApplied: false,
      };
    }
  }

  /**
   * Boost a place in user's preferences
   */
  private async boostPlace(userId: string | undefined, placeId: string): Promise<void> {
    if (!userId) return;

    try {
      // Store liked place for future reference
      await prisma.$executeRaw`
        INSERT INTO user_liked_places (id, user_id, place_id, liked_at)
        VALUES (gen_random_uuid(), ${userId}, ${placeId}, NOW())
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      // Table might not exist yet, silently fail
      console.log('Note: user_liked_places table not set up');
    }
  }

  /**
   * Penalize a place in user's preferences
   */
  private async penalizePlace(userId: string | undefined, placeId: string): Promise<void> {
    if (!userId) return;

    try {
      // Store disliked place to avoid in future
      await prisma.$executeRaw`
        INSERT INTO user_disliked_places (id, user_id, place_id, disliked_at)
        VALUES (gen_random_uuid(), ${userId}, ${placeId}, NOW())
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      // Table might not exist yet, silently fail
      console.log('Note: user_disliked_places table not set up');
    }
  }

  /**
   * Log a view (implicit positive signal)
   */
  private async logView(searchId: string, userId: string | undefined, placeId: string): Promise<void> {
    try {
      // Update viewed places in search log
      await prisma.$executeRaw`
        UPDATE location_search_logs 
        SET results = results || jsonb_build_object('viewed', true)
        WHERE id = ${searchId}
      `;
    } catch (error) {
      // Silently fail view logging
    }
  }

  /**
   * Save a location for later
   */
  private async saveLocation(
    userId: string | undefined,
    placeId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!userId) return;

    try {
      await prisma.$executeRaw`
        INSERT INTO user_saved_places (id, user_id, place_id, name, saved_at)
        VALUES (gen_random_uuid(), ${userId}, ${placeId}, ${metadata?.name || 'Unknown'}, NOW())
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      console.log('Note: user_saved_places table not set up');
    }
  }

  /**
   * Mark a location as visited
   */
  private async markVisited(userId: string | undefined, placeId: string): Promise<void> {
    if (!userId) return;

    try {
      await prisma.$executeRaw`
        INSERT INTO user_visited_places (id, user_id, place_id, visited_at)
        VALUES (gen_random_uuid(), ${userId}, ${placeId}, NOW())
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      console.log('Note: user_visited_places table not set up');
    }
  }

  /**
   * Get feedback statistics for a search
   */
  async getFeedbackStats(searchId: string): Promise<{
    views: number;
    selections: number;
    likes: number;
    dislikes: number;
  }> {
    // Placeholder - would query aggregates
    return {
      views: 0,
      selections: 0,
      likes: 0,
      dislikes: 0,
    };
  }
}

export const locationFeedbackHandler = new LocationFeedbackHandler();
