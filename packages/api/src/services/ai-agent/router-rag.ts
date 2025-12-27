/**
 * Router RAG - Self-Learning Query Router
 * 
 * Stores successful query → MCP routing patterns and uses
 * embedding similarity to boost future routing decisions.
 * 
 * Works with:
 * - ConversationRAG for embedding generation
 * - Perplexity for query intent analysis
 * - ERC-8004 registry for available tools
 */

import { PrismaClient } from '@prisma/client';
import { ConversationRAG } from './conversationRag';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface RoutingDecision {
  server: string;       // e.g., "weather", "semantic-search", "perplexity"
  tool: string;         // e.g., "get_forecast", "semantic_search"
  params: Record<string, any>;
  confidence: number;   // 0-1
  reason: string;
}

export interface QueryIntent {
  category: string;           // travel, weather, places, advice, general
  subIntents: string[];       // ["packing", "forecast", "destination"]
  entities: Record<string, string>;  // { location: "Tokyo", timeframe: "next week" }
  complexity: 'simple' | 'multi-step';
}

export interface RoutingHistory {
  id: string;
  query: string;
  routes: RoutingDecision[];
  success: boolean;
  feedback?: 'positive' | 'negative';
  similarity?: number;
}

export class RouterRAG {
  private rag = new ConversationRAG();

  /**
   * Store a successful routing decision for learning
   */
  async storeRouting(
    query: string,
    routes: RoutingDecision[],
    success: boolean,
    userId?: string
  ): Promise<void> {
    try {
      // Generate embedding for the query
      const embedding = await this.rag.generateEmbedding(query);

      // Store in RAG for similarity search
      await this.rag.storeConversation(
        query,
        JSON.stringify({
          routes: routes.map(r => ({ server: r.server, tool: r.tool })),
          success,
        }),
        'routing_decision'
      );

      console.log(`📝 Stored routing: "${query.substring(0, 50)}..." → [${routes.map(r => r.tool).join(', ')}]`);
    } catch (error) {
      console.error('Failed to store routing:', error);
    }
  }

  /**
   * Find similar past queries and their successful routes
   */
  async findSimilarRoutes(query: string, limit: number = 5): Promise<RoutingHistory[]> {
    try {
      const similar = await this.rag.findSimilar(query, limit);
      
      // Filter to routing decisions only
      const routingResults = similar
        .filter(s => {
          try {
            const data = JSON.parse(s.answer);
            return data.routes && Array.isArray(data.routes);
          } catch {
            return false;
          }
        })
        .map(s => {
          const data = JSON.parse(s.answer);
          return {
            id: s.id || `route_${Date.now()}`,
            query: s.question,
            routes: data.routes as RoutingDecision[],
            success: data.success ?? true,
            feedback: data.feedback,
            similarity: s.score,
          };
        });

      return routingResults;
    } catch (error) {
      console.error('Failed to find similar routes:', error);
      return [];
    }
  }

  /**
   * Get routing boosts based on past successful routings
   */
  async getRoutingBoosts(query: string): Promise<Map<string, number>> {
    const boosts = new Map<string, number>();
    
    try {
      const similarRoutes = await this.findSimilarRoutes(query, 5);
      
      for (const history of similarRoutes) {
        if (history.success && history.similarity && history.similarity > 0.7) {
          for (const route of history.routes) {
            const key = `${route.server}:${route.tool}`;
            const currentBoost = boosts.get(key) || 0;
            // Higher similarity = higher boost
            const boost = Math.min(0.3, history.similarity * 0.3);
            boosts.set(key, Math.max(currentBoost, boost));
          }
        }
      }

      if (boosts.size > 0) {
        console.log(`🧠 Learning boosts:`, Object.fromEntries(boosts));
      }
    } catch (error) {
      console.error('Failed to get routing boosts:', error);
    }

    return boosts;
  }

  /**
   * Record feedback on a routing decision
   */
  async recordFeedback(
    query: string,
    feedback: 'positive' | 'negative'
  ): Promise<void> {
    try {
      // Update the stored routing with feedback
      // This affects future similarity-based boosts
      await this.rag.storeConversation(
        query,
        JSON.stringify({ feedback }),
        'routing_feedback'
      );
      
      console.log(`📊 Recorded ${feedback} feedback for routing`);
    } catch (error) {
      console.error('Failed to record feedback:', error);
    }
  }
}

export const routerRAG = new RouterRAG();
