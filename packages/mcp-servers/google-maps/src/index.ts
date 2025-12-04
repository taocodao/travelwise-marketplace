import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

class GoogleMapsMCPServer {
  private app: express.Application;
  private port: number;
  private axiosInstance = axios.create({
    baseURL: 'https://maps.googleapis.com/maps/api',
    timeout: 30000,
  });

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3003');
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'Google Maps MCP',
        version: '1.0.0',
        apiKeyConfigured: !!API_KEY,
        timestamp: new Date().toISOString(),
      });
    });

    // List available tools
    this.app.get('/tools', (req: Request, res: Response) => {
      res.json({
        tools: [
          {
            name: 'get_route',
            description: 'Get optimized driving route between origin and destination',
            baseCost: 0.050,
            inputSchema: {
              type: 'object',
              properties: {
                origin: { type: 'string', description: 'Starting location' },
                destination: { type: 'string', description: 'Ending location' },
                waypoints: { type: 'array', description: 'Optional stops' },
                optimize: { type: 'boolean', default: true },
              },
              required: ['origin', 'destination'],
            },
          },
          {
            name: 'find_places',
            description: 'Find places of interest near a location',
            baseCost: 0.032,
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
                type: { type: 'string', enum: ['restaurant', 'tourist_attraction', 'park'] },
                radius: { type: 'number', default: 5000 },
              },
              required: ['location', 'type'],
            },
          },
          {
            name: 'get_place_details',
            description: 'Get detailed information about a place',
            baseCost: 0.017,
            inputSchema: {
              type: 'object',
              properties: {
                place_id: { type: 'string' },
              },
              required: ['place_id'],
            },
          },
        ],
      });
    });

    // Tool: Get Route
    this.app.post('/tools/get_route', async (req: Request, res: Response) => {
      try {
        const result = await this.getRoute(req.body);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Tool: Find Places
    this.app.post('/tools/find_places', async (req: Request, res: Response) => {
      try {
        const result = await this.findPlaces(req.body);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Tool: Get Place Details
    this.app.post('/tools/get_place_details', async (req: Request, res: Response) => {
      try {
        const result = await this.getPlaceDetails(req.body);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  private async getRoute(args: any) {
    const { origin, destination, waypoints = [], optimize = true } = args;

    // If API key is configured, use real Google Maps API
    if (API_KEY) {
      const params: any = {
        origin,
        destination,
        key: API_KEY,
        mode: 'driving',
      };

      if (waypoints.length > 0) {
        params.waypoints = waypoints.join('|');
        if (optimize) {
          params.waypoints = 'optimize:true|' + params.waypoints;
        }
      }

      const response = await this.axiosInstance.get('/directions/json', { params });

      if (response.data.status !== 'OK') {
        throw new Error(`Maps API error: ${response.data.status}`);
      }

      const route = response.data.routes[0];
      const legs = route.legs;

      return {
        success: true,
        tool: 'get_route',
        status: 'success',
        summary: {
          total_distance_km: legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000,
          total_duration_minutes: legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0) / 60,
          start_address: legs[0].start_address,
          end_address: legs[legs.length - 1].end_address,
        },
        waypoints: legs.map((leg: any) => ({
          start_location: leg.start_location,
          end_location: leg.end_location,
          distance: leg.distance.text,
          duration: leg.duration.text,
        })),
        polyline: route.overview_polyline.points,
        pricing: {
          base_cost: 0.050,
          currency: 'USDC',
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Mock response if no API key
    return {
      success: true,
      tool: 'get_route',
      status: 'success',
      summary: {
        total_distance_km: 615,
        total_duration_minutes: 360,
        start_address: origin,
        end_address: destination,
      },
      waypoints: [
        {
          start_location: { lat: 37.7749, lng: -122.4194 },
          end_location: { lat: 34.0522, lng: -118.2437 },
          distance: '382 mi',
          duration: '6 hours',
        },
      ],
      pricing: {
        base_cost: 0.050,
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async findPlaces(args: any) {
    const { location, type, radius = 5000 } = args;

    // Mock response (real API implementation would go here if API_KEY exists)
    return {
      success: true,
      tool: 'find_places',
      status: 'success',
      search_center: {
        lat: 37.7749,
        lng: -122.4194,
        address: location,
      },
      places: [
        {
          name: `Popular ${type} #1`,
          place_id: 'ChIJ123456',
          rating: 4.7,
          user_ratings_total: 1250,
          types: [type],
          vicinity: location,
          location: { lat: 37.7749, lng: -122.4194 },
        },
        {
          name: `Top-rated ${type} #2`,
          place_id: 'ChIJ654321',
          rating: 4.5,
          user_ratings_total: 890,
          types: [type],
          vicinity: location,
          location: { lat: 37.7849, lng: -122.4094 },
        },
      ],
      pricing: {
        base_cost: 0.032,
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async getPlaceDetails(args: any) {
    const { place_id } = args;

    return {
      success: true,
      tool: 'get_place_details',
      status: 'success',
      details: {
        place_id,
        name: 'The Grand Restaurant',
        address: '123 Main Street, San Francisco, CA',
        phone: '(415) 555-0123',
        website: 'https://example.com',
        rating: 4.6,
        opening_hours: {
          open_now: true,
          weekday_text: [
            'Monday: 11:00 AM – 10:00 PM',
            'Tuesday: 11:00 AM – 10:00 PM',
          ],
        },
        reviews: [
          {
            author: 'John D.',
            rating: 5,
            text: 'Amazing food!',
          },
        ],
      },
      pricing: {
        base_cost: 0.017,
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    };
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(`✅ Google Maps MCP Server running on port ${this.port}`);
      console.log(`   Health check: http://localhost:${this.port}/health`);
      console.log(`   API Key: ${API_KEY ? 'Configured ✓' : 'Not configured (using mocks)'}`);
    });
  }
}

const server = new GoogleMapsMCPServer();
server.start();
