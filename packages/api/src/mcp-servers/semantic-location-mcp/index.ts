/**
 * Semantic Location MCP Server
 * 
 * MCP server for intelligent location discovery with self-learning capabilities.
 * 
 * Tools:
 * - semantic_search: Natural language location search
 * - get_location_details: Detailed place info with AI insights
 * - submit_feedback: Learn from user interactions
 * - get_suggestions: Personalized recommendations
 */

import { Router, Request, Response } from 'express';
import { SemanticLocationSearch, semanticLocationSearch } from '../../services/ai-agent/semantic-location-search';
import { SemanticLearningSystem, semanticLearningSystem } from '../../services/ai-agent/semantic-learning-system';
import { LocationFeedbackHandler, locationFeedbackHandler, FeedbackData } from '../../services/ai-agent/location-feedback-handler';
import { LocationResult } from '../../services/ai-agent/semantic-location-search';
import { GoogleWeatherService, googleWeatherService } from '../../services/ai-agent/google-weather-service';

const router = Router();

// Tool costs (in USD)
const TOOL_COSTS = {
  semantic_search: 0.03,
  get_location_details: 0.02,
  submit_feedback: 0.00,
  get_suggestions: 0.02,
  get_current_weather: 0.01,
  get_weather_forecast: 0.02,
};

// List all available tools
router.get('/tools', (req: Request, res: Response) => {
  res.json([
    {
      name: 'semantic_search',
      toolName: 'semantic_search',
      description: 'SEMANTIC LOCATION SEARCH: Find places using natural language with AI ranking and personalized results. Examples: "quiet cafe with WiFi near Times Square", "romantic dinner spot in Manhattan"',
      toolDescription: 'Find places using natural language with AI-powered ranking and explanations',
      method: 'POST',
      cost: TOOL_COSTS.semantic_search,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          location: { 
            type: 'object', 
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' }
            },
            description: 'Search center coordinates (optional)'
          },
          radius: { type: 'number', description: 'Search radius in meters (default: 2000)' },
          limit: { type: 'number', description: 'Max results to return (default: 10)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_location_details',
      toolName: 'get_location_details',
      description: 'LOCATION DETAILS: Get comprehensive information about a place including hours, reviews, AI insights, and current conditions',
      toolDescription: 'Get detailed information about a specific place with AI-enhanced insights',
      method: 'POST',
      cost: TOOL_COSTS.get_location_details,
      inputSchema: {
        type: 'object',
        properties: {
          placeId: { type: 'string', description: 'Google Place ID' },
        },
        required: ['placeId'],
      },
    },
    {
      name: 'submit_feedback',
      toolName: 'submit_feedback',
      description: 'FEEDBACK: Submit feedback on search results to improve future recommendations. Free to use.',
      toolDescription: 'Submit feedback on search results for system learning',
      method: 'POST',
      cost: TOOL_COSTS.submit_feedback,
      inputSchema: {
        type: 'object',
        properties: {
          searchId: { type: 'string', description: 'ID of the search' },
          placeId: { type: 'string', description: 'Place being rated' },
          action: { 
            type: 'string', 
            enum: ['view', 'select', 'like', 'dislike', 'save', 'visit'],
            description: 'Type of feedback'
          },
        },
        required: ['searchId', 'placeId', 'action'],
      },
    },
    {
      name: 'get_suggestions',
      toolName: 'get_suggestions',  
      description: 'SUGGESTIONS: Get personalized location suggestions based on your preferences and history',
      toolDescription: 'Get personalized location recommendations',
      method: 'POST',
      cost: TOOL_COSTS.get_suggestions,
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID for personalization' },
          location: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' }
            },
            description: 'Current location (optional)'
          },
        },
        required: [],
      },
    },
    {
      name: 'get_current_weather',
      toolName: 'get_current_weather',
      description: 'CURRENT WEATHER: Get real-time weather conditions using Google Weather API',
      toolDescription: 'Get current weather conditions for a location',
      method: 'POST',
      cost: TOOL_COSTS.get_current_weather,
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Location name (e.g., "Times Square, NYC")' },
          lat: { type: 'number', description: 'Latitude (optional if location provided)' },
          lng: { type: 'number', description: 'Longitude (optional if location provided)' },
        },
        required: [],
      },
    },
    {
      name: 'get_weather_forecast',
      toolName: 'get_weather_forecast',
      description: 'WEATHER FORECAST: Get up to 10-day weather forecast using Google Weather API',
      toolDescription: 'Get daily weather forecast for a location',
      method: 'POST',
      cost: TOOL_COSTS.get_weather_forecast,
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Location name (e.g., "Miami Beach, FL")' },
          lat: { type: 'number', description: 'Latitude (optional if location provided)' },
          lng: { type: 'number', description: 'Longitude (optional if location provided)' },
          days: { type: 'number', description: 'Number of days (1-10, default: 7)' },
        },
        required: [],
      },
    },
  ]);
});

// ============================================
// Tool: semantic_search
// ============================================
router.post('/tools/semantic_search', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { query, location, radius, limit } = req.body;
    const userId = req.headers['x-user-id'] as string || req.body.userId;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Perform semantic search
    const results = await semanticLocationSearch.search({
      query,
      userId,
      location,
      radius,
      limit,
    });

    // Log for learning
    if (results.results.length > 0) {
      await semanticLearningSystem.logSearch(
        results.searchId,
        userId,
        query,
        results.query,
        results.results
      );
    }

    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      searchId: results.searchId,
      parsedQuery: results.query,
      results: results.results.map((r: LocationResult) => ({
        placeId: r.placeId,
        name: r.name,
        address: r.address,
        location: r.location,
        rating: r.rating,
        priceLevel: r.priceLevel,
        openNow: r.openNow,
        semanticScore: Math.round(r.semanticScore * 100),
        explanation: r.explanation,
        matchedFeatures: r.matchedFeatures,
        photo: r.photos?.[0],
      })),
      meta: {
        count: results.results.length,
        cost: TOOL_COSTS.semantic_search,
        executionTime,
      },
    });
  } catch (error: any) {
    console.error('Semantic search failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      cost: TOOL_COSTS.semantic_search,
    });
  }
});

// ============================================
// Tool: get_location_details
// ============================================
router.post('/tools/get_location_details', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { placeId } = req.body;

    if (!placeId) {
      return res.status(400).json({ error: 'placeId is required' });
    }

    const details = await semanticLocationSearch.getPlaceDetails(placeId);

    if (!details) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      details: {
        name: details.name,
        address: details.formatted_address,
        phone: details.formatted_phone_number,
        website: details.website,
        rating: details.rating,
        priceLevel: details.price_level,
        openingHours: details.opening_hours?.weekday_text,
        reviews: details.reviews?.slice(0, 3).map((r: any) => ({
          author: r.author_name,
          rating: r.rating,
          text: r.text.substring(0, 200),
          time: r.relative_time_description,
        })),
        aiInsights: details.aiInsights,
        sources: details.sources,
      },
      meta: {
        cost: TOOL_COSTS.get_location_details,
        executionTime,
      },
    });
  } catch (error: any) {
    console.error('Get details failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      cost: TOOL_COSTS.get_location_details,
    });
  }
});

// ============================================
// Tool: submit_feedback
// ============================================
router.post('/tools/submit_feedback', async (req: Request, res: Response) => {
  try {
    const { searchId, placeId, action, metadata } = req.body;
    const userId = req.headers['x-user-id'] as string || req.body.userId;

    if (!searchId || !placeId || !action) {
      return res.status(400).json({ 
        error: 'searchId, placeId, and action are required' 
      });
    }

    const result = await locationFeedbackHandler.processFeedback({
      searchId,
      userId,
      placeId,
      action,
      metadata,
    });

    res.json({
      success: result.success,
      message: result.message,
      learningApplied: result.learningApplied,
      meta: {
        cost: TOOL_COSTS.submit_feedback,
      },
    });
  } catch (error: any) {
    console.error('Feedback submission failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      cost: TOOL_COSTS.submit_feedback,
    });
  }
});

// ============================================
// Tool: get_suggestions
// ============================================
router.post('/tools/get_suggestions', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { location } = req.body;
    const userId = req.headers['x-user-id'] as string || req.body.userId;

    if (!userId) {
      // Return generic suggestions for anonymous users
      const hour = new Date().getHours();
      const genericSuggestions = [];
      
      if (hour >= 6 && hour < 11) {
        genericSuggestions.push({ type: 'cafe', reason: 'Perfect time for morning coffee' });
      } else if (hour >= 11 && hour < 14) {
        genericSuggestions.push({ type: 'restaurant', reason: 'Lunch time!' });
      } else if (hour >= 17 && hour < 21) {
        genericSuggestions.push({ type: 'restaurant', reason: 'Time for dinner' });
      }
      genericSuggestions.push({ type: 'park', reason: 'Always a good choice for a walk' });

      return res.json({
        success: true,
        suggestions: genericSuggestions,
        personalized: false,
        meta: {
          cost: TOOL_COSTS.get_suggestions,
          executionTime: Date.now() - startTime,
        },
      });
    }

    const suggestions = await semanticLearningSystem.getSuggestions(userId, location);
    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      suggestions,
      personalized: true,
      meta: {
        cost: TOOL_COSTS.get_suggestions,
        executionTime,
      },
    });
  } catch (error: any) {
    console.error('Get suggestions failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      cost: TOOL_COSTS.get_suggestions,
    });
  }
});

// ============================================
// Tool: get_current_weather (Google Weather API)
// ============================================
router.post('/tools/get_current_weather', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { location, lat, lng } = req.body;

    let result;
    if (lat !== undefined && lng !== undefined) {
      result = await googleWeatherService.getCurrentConditions(lat, lng);
    } else if (location) {
      result = await googleWeatherService.getWeatherByLocation(location);
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Either location name or lat/lng coordinates required' 
      });
    }

    const executionTime = Date.now() - startTime;

    if (result.success) {
      res.json({
        success: true,
        current: result.current,
        meta: {
          cost: TOOL_COSTS.get_current_weather,
          executionTime,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        meta: { cost: TOOL_COSTS.get_current_weather },
      });
    }
  } catch (error: any) {
    console.error('Get current weather failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      meta: { cost: TOOL_COSTS.get_current_weather },
    });
  }
});

// ============================================
// Tool: get_weather_forecast (Google Weather API)
// ============================================
router.post('/tools/get_weather_forecast', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { location, lat, lng, days = 7 } = req.body;

    let result;
    if (lat !== undefined && lng !== undefined) {
      result = await googleWeatherService.getDailyForecast(lat, lng, days);
    } else if (location) {
      result = await googleWeatherService.getForecastByLocation(location, days);
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Either location name or lat/lng coordinates required' 
      });
    }

    const executionTime = Date.now() - startTime;

    if (result.success) {
      res.json({
        success: true,
        forecast: result.forecast,
        days: result.forecast?.length || 0,
        meta: {
          cost: TOOL_COSTS.get_weather_forecast,
          executionTime,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        meta: { cost: TOOL_COSTS.get_weather_forecast },
      });
    }
  } catch (error: any) {
    console.error('Get weather forecast failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      meta: { cost: TOOL_COSTS.get_weather_forecast },
    });
  }
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    server: 'semantic-location-mcp',
    tools: Object.keys(TOOL_COSTS).length,
  });
});

export default router;
