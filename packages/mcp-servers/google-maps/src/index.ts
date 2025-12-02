import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
}

class GoogleMapsMCPServer {
  private server: Server;
  private axiosInstance = axios.create({
    baseURL: 'https://maps.googleapis.com/maps/api',
    timeout: 30000,
  });

  constructor() {
    this.server = new Server(
      {
        name: 'google-maps-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_route',
          description: 'Get optimized driving route between origin and destination with optional waypoints',
          inputSchema: {
            type: 'object',
            properties: {
              origin: {
                type: 'string',
                description: 'Starting location (address or coordinates)',
              },
              destination: {
                type: 'string',
                description: 'Ending location',
              },
              waypoints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional stops along the way',
              },
              optimize: {
                type: 'boolean',
                description: 'Optimize waypoint order',
                default: true,
              },
            },
            required: ['origin', 'destination'],
          },
        },
        {
          name: 'find_places',
          description: 'Find places of interest near a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'Location to search near',
              },
              type: {
                type: 'string',
                enum: ['restaurant', 'tourist_attraction', 'park', 'museum', 'scenic_viewpoint'],
                description: 'Type of place to find',
              },
              radius: {
                type: 'number',
                description: 'Search radius in meters',
                default: 5000,
              },
            },
            required: ['location', 'type'],
          },
        },
        {
          name: 'get_place_details',
          description: 'Get detailed information about a specific place',
          inputSchema: {
            type: 'object',
            properties: {
              place_id: {
                type: 'string',
                description: 'Google Place ID',
              },
            },
            required: ['place_id'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_route':
            return await this.getRoute(args);
          case 'find_places':
            return await this.findPlaces(args);
          case 'get_place_details':
            return await this.getPlaceDetails(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async getRoute(args: any) {
    const { origin, destination, waypoints = [], optimize = true } = args;

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

    const result = {
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
      cost_info: {
        api_cost_usd: 0.005,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async findPlaces(args: any) {
    const { location, type, radius = 5000 } = args;

    // First geocode the location
    const geocodeResponse = await this.axiosInstance.get('/geocode/json', {
      params: {
        address: location,
        key: API_KEY,
      },
    });

    if (geocodeResponse.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${geocodeResponse.data.status}`);
    }

    const coords = geocodeResponse.data.results[0].geometry.location;

    // Search for places
    const placesResponse = await this.axiosInstance.get('/place/nearbysearch/json', {
      params: {
        location: `${coords.lat},${coords.lng}`,
        radius,
        type,
        key: API_KEY,
      },
    });

    const result = {
      status: 'success',
      search_center: {
        lat: coords.lat,
        lng: coords.lng,
        address: location,
      },
      places: placesResponse.data.results.slice(0, 10).map((place: any) => ({
        name: place.name,
        place_id: place.place_id,
        rating: place.rating || 0,
        user_ratings_total: place.user_ratings_total || 0,
        types: place.types,
        vicinity: place.vicinity,
        location: place.geometry.location,
      })),
      cost_info: {
        api_cost_usd: 0.032,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async getPlaceDetails(args: any) {
    const { place_id } = args;

    const response = await this.axiosInstance.get('/place/details/json', {
      params: {
        place_id,
        fields: 'name,rating,formatted_address,formatted_phone_number,website,opening_hours,reviews',
        key: API_KEY,
      },
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Place Details API error: ${response.data.status}`);
    }

    const place = response.data.result;

    const result = {
      status: 'success',
      details: {
        name: place.name,
        address: place.formatted_address,
        phone: place.formatted_phone_number,
        website: place.website,
        rating: place.rating,
        opening_hours: place.opening_hours,
        reviews: place.reviews?.slice(0, 5),
      },
      cost_info: {
        api_cost_usd: 0.017,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Maps MCP Server running on stdio');
  }
}

const server = new GoogleMapsMCPServer();
server.run().catch(console.error);
