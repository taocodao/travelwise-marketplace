import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

interface TripRequest {
  origin: string;
  destination: string;
  days: number;
  preferences?: {
    avoid_rain?: boolean;
    prefer_scenic?: boolean;
    max_driving_hours_per_day?: number;
  };
}

interface RouteData {
  status: string;
  summary: {
    total_distance_km: number;
    total_duration_minutes: number;
  };
}

interface PlaceData {
  places: Array<{
    name: string;
    rating: number;
    types?: string[];
    vicinity: string;
  }>;
}

interface WeatherData {
  forecast_by_day: Array<{
    date: string;
    summary?: {
      temp_min: number;
      temp_max: number;
      max_precipitation_prob: number;
    };
  }>;
}

class TravelAgentMCPServer {
  private app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3005');
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    
    // CORS middleware
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
        service: 'Travel Agent MCP',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // List available tools
    this.app.get('/tools', (req: Request, res: Response) => {
      res.json({
        tools: [
          {
            name: 'plan_scenic_route',
            description:
              'Plan an optimized scenic road trip with weather-aware recommendations. Combines route optimization, place discovery, and weather forecasting.',
            baseCost: 0.05,
            inputSchema: {
              type: 'object',
              properties: {
                origin: { type: 'string', description: 'Starting city or address' },
                destination: { type: 'string', description: 'Destination city or address' },
                days: { type: 'number', description: 'Number of days for the trip', minimum: 1, maximum: 7 },
                preferences: {
                  type: 'object',
                  properties: {
                    avoid_rain: { type: 'boolean', default: true },
                    prefer_scenic: { type: 'boolean', default: true },
                    max_driving_hours_per_day: { type: 'number', default: 6 },
                  },
                },
              },
              required: ['origin', 'destination', 'days'],
            },
          },
          {
            name: 'weather_aware_itinerary',
            description: 'Generate a day-by-day activity itinerary optimized for weather conditions',
            baseCost: 0.03,
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'Location for itinerary' },
                days: { type: 'number', description: 'Number of days', minimum: 1, maximum: 5 },
              },
              required: ['location', 'days'],
            },
          },
          {
            name: 'hotel_search',
            description: 'Search for hotels in a specific location',
            baseCost: 0.03,
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'Search location' },
                checkIn: { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
                checkOut: { type: 'string', description: 'Check-out date (YYYY-MM-DD)' },
              },
              required: ['location', 'checkIn', 'checkOut'],
            },
          },
        ],
      });
    });

    // Tool: Plan Scenic Route
    this.app.post('/tools/plan_scenic_route', async (req: Request, res: Response) => {
      try {
        const params = req.body as TripRequest;
        const result = await this.planScenicRoute(params);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Tool: Weather Aware Itinerary
    this.app.post('/tools/weather_aware_itinerary', async (req: Request, res: Response) => {
      try {
        const result = await this.createWeatherAwareItinerary(req.body);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Tool: Hotel Search
    this.app.post('/tools/hotel_search', async (req: Request, res: Response) => {
      try {
        const { location, checkIn, checkOut } = req.body;
        const result = await this.searchHotels(location, checkIn, checkOut);
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

  private async planScenicRoute(params: TripRequest): Promise<any> {
    console.log(`Planning scenic route: ${params.origin} → ${params.destination}`);

    // Simulate API calls
    const routeData = await this.getMockRouteData(params.origin, params.destination);
    const placesData = await this.getMockPlacesData(params.destination);
    const weatherData = await this.getMockWeatherData(params.destination, params.days);

    // Build optimized itinerary
    const itinerary = this.buildOptimizedItinerary({
      route: routeData,
      places: placesData.places,
      weather: weatherData.forecast_by_day,
      preferences: params.preferences || {},
      days: params.days,
    });

    return {
      success: true,
      tool: 'plan_scenic_route',
      itinerary,
      summary: {
        total_distance_km: routeData.summary.total_distance_km,
        total_driving_hours: (routeData.summary.total_duration_minutes / 60).toFixed(1),
        recommended_stops: itinerary.stops.length,
        weather_outlook: this.summarizeWeather(weatherData.forecast_by_day),
        best_travel_days: this.identifyBestTravelDays(weatherData.forecast_by_day),
      },
      cost_breakdown: {
        maps_api: 0.037,
        weather_api: 0,
        value_added_analysis: 0.013,
        total: 0.05,
      },
      pricing: {
        base_cost: 0.037,
        margin: 0.013,
        total_charge: 0.05,
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async createWeatherAwareItinerary(params: any): Promise<any> {
    const { location, days } = params;
    const weatherData = await this.getMockWeatherData(location, days);

    const itinerary = [];
    for (let day = 1; day <= days; day++) {
      const dayWeather = weatherData.forecast_by_day[day - 1];
      const isDryDay = (dayWeather.summary?.max_precipitation_prob || 0) < 0.3;

      itinerary.push({
        day,
        date: dayWeather.date,
        weather: {
          temp_range: dayWeather.summary
            ? `${Math.round(dayWeather.summary.temp_min)}°F - ${Math.round(dayWeather.summary.temp_max)}°F`
            : 'N/A',
          conditions: isDryDay ? 'Clear/Partly Cloudy' : 'Possible Rain',
        },
        recommended_activities: isDryDay
          ? ['Outdoor hiking', 'Beach visit', 'Scenic drives']
          : ['Museum tours', 'Indoor attractions', 'Shopping'],
      });
    }

    return {
      success: true,
      tool: 'weather_aware_itinerary',
      location,
      itinerary,
      pricing: {
        base_cost: 0.03,
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async searchHotels(location: string, checkIn: string, checkOut: string): Promise<any> {
    // Mock hotel search
    const hotels = [
      {
        name: 'Grand Hotel',
        location,
        price: 150,
        rating: 4.5,
        amenities: ['WiFi', 'Pool', 'Parking'],
        available: true,
      },
      {
        name: 'City Inn',
        location,
        price: 89,
        rating: 4.0,
        amenities: ['WiFi', 'Breakfast'],
        available: true,
      },
      {
        name: 'Luxury Resort',
        location,
        price: 250,
        rating: 4.8,
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant'],
        available: true,
      },
    ];

    return {
      success: true,
      tool: 'hotel_search',
      location,
      checkIn,
      checkOut,
      hotels,
      pricing: {
        base_cost: 0.03,
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async getMockRouteData(origin: string, destination: string): Promise<RouteData> {
    return {
      status: 'success',
      summary: {
        total_distance_km: 615,
        total_duration_minutes: 360,
      },
    };
  }

  private async getMockPlacesData(location: string): Promise<PlaceData> {
    return {
      places: [
        {
          name: 'Scenic Overlook',
          rating: 4.5,
          types: ['scenic_viewpoint'],
          vicinity: 'Highway 1',
        },
        {
          name: 'Coastal Trail',
          rating: 4.7,
          types: ['tourist_attraction'],
          vicinity: 'Big Sur',
        },
        {
          name: 'Historic Lighthouse',
          rating: 4.6,
          types: ['point_of_interest'],
          vicinity: 'Pigeon Point',
        },
        {
          name: 'Mountain Vista Point',
          rating: 4.8,
          types: ['scenic_viewpoint'],
          vicinity: 'PCH Mile 45',
        },
      ],
    };
  }

  private async getMockWeatherData(location: string, days: number): Promise<WeatherData> {
    const forecast = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      forecast.push({
        date: date.toISOString().split('T')[0],
        summary: {
          temp_min: 55 + Math.random() * 10,
          temp_max: 70 + Math.random() * 15,
          max_precipitation_prob: Math.random() * 0.3,
        },
      });
    }

    return { forecast_by_day: forecast };
  }

  private buildOptimizedItinerary(data: {
    route: RouteData;
    places: PlaceData['places'];
    weather: WeatherData['forecast_by_day'];
    preferences: TripRequest['preferences'];
    days: number;
  }): { stops: any[] } {
    const { route, places, weather, preferences, days } = data;

    const totalDistance = route.summary.total_distance_km;
    const distancePerDay = totalDistance / days;

    const topPlaces = places
      .filter((p) => p.rating >= 4.0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, Math.min(days * 2, 8));

    const stops = [];

    for (let day = 1; day <= days; day++) {
      const dayWeather: WeatherData['forecast_by_day'][0] = weather[day - 1] || {
        date: new Date().toISOString().split('T')[0],
        summary: {
          temp_min: 60,
          temp_max: 75,
          max_precipitation_prob: 0,
        },
      };

      const isDryDay = (dayWeather.summary?.max_precipitation_prob || 0) < 0.3;
      const dayPlaces = topPlaces.slice((day - 1) * 2, day * 2);

      stops.push({
        day,
        date: dayWeather.date,
        weather: {
          temp_range: dayWeather.summary
            ? `${Math.round(dayWeather.summary.temp_min)}°F - ${Math.round(dayWeather.summary.temp_max)}°F`
            : 'N/A',
          conditions: isDryDay ? 'Clear/Partly Cloudy' : 'Possible Rain',
          precipitation_chance: Math.round((dayWeather.summary?.max_precipitation_prob || 0) * 100) + '%',
        },
        recommended_places: dayPlaces.map((place) => ({
          name: place.name,
          rating: place.rating,
          type: place.types?.[0] || 'attraction',
          location: place.vicinity,
          why_recommended: this.generateRecommendation(place, dayWeather, preferences),
        })),
        driving_estimate: `${Math.round(distancePerDay * 0.621371)} miles, ${Math.round(
          route.summary.total_duration_minutes / days / 60
        )} hours`,
      });
    }

    return { stops };
  }

  private generateRecommendation(
    place: PlaceData['places'][0],
    weather: WeatherData['forecast_by_day'][0],
    preferences: TripRequest['preferences']
  ): string {
    const reasons = [];

    if (place.rating >= 4.5) reasons.push('Highly rated by travelers');
    if ((weather.summary?.max_precipitation_prob || 1) < 0.2) reasons.push('Perfect weather expected');
    if (place.types?.includes('scenic_viewpoint')) reasons.push('Scenic views');
    if (preferences?.prefer_scenic) reasons.push('Matches scenic preference');

    return reasons.length > 0 ? reasons.join('. ') + '.' : 'Recommended stop';
  }

  private summarizeWeather(forecast: WeatherData['forecast_by_day']): string {
    if (!forecast || forecast.length === 0) return 'No data';

    const avgPrecip =
      forecast.reduce((sum, day) => sum + (day.summary?.max_precipitation_prob || 0), 0) / forecast.length;

    if (avgPrecip < 0.2) return 'Excellent - mostly clear skies';
    if (avgPrecip < 0.5) return 'Good - some clouds, low rain chance';
    return 'Fair - expect some rain';
  }

  private identifyBestTravelDays(forecast: WeatherData['forecast_by_day']): string[] {
    return forecast
      .filter((day) => (day.summary?.max_precipitation_prob || 1) < 0.3)
      .map((day) => day.date)
      .slice(0, 2);
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(`✅ Travel Agent MCP Server running on port ${this.port}`);
      console.log(`   Health check: http://localhost:${this.port}/health`);
      console.log(`   Tools list: http://localhost:${this.port}/tools`);
    });
  }
}

const server = new TravelAgentMCPServer();
server.start();
