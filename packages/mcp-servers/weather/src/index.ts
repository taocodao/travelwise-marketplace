import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENWEATHER_API_KEY;

class WeatherMCPServer {
  private app: express.Application;
  private port: number;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3004');
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
        service: 'Weather MCP',
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
            name: 'get_current_weather',
            description: 'Get current weather conditions for a location',
            baseCost: 0.010,
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'City name' },
                units: { type: 'string', enum: ['metric', 'imperial'], default: 'imperial' },
              },
              required: ['location'],
            },
          },
          {
            name: 'get_forecast',
            description: '5-day weather forecast',
            baseCost: 0.020,
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
                units: { type: 'string', enum: ['metric', 'imperial'], default: 'imperial' },
                days: { type: 'number', default: 3, minimum: 1, maximum: 5 },
              },
              required: ['location'],
            },
          },
        ],
      });
    });

    // Tool: Current Weather
    this.app.post('/tools/get_current_weather', async (req: Request, res: Response) => {
      try {
        const result = await this.getCurrentWeather(req.body);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Tool: Forecast
    this.app.post('/tools/get_forecast', async (req: Request, res: Response) => {
      try {
        const result = await this.getForecast(req.body);
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

  private async getCurrentWeather(args: any) {
    const { location, units = 'imperial' } = args;

    // If API key is configured, use real OpenWeather API
    if (API_KEY) {
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: location,
          appid: API_KEY,
          units,
        },
      });

      const data = response.data;

      return {
        success: true,
        tool: 'get_current_weather',
        status: 'success',
        location: {
          name: data.name,
          country: data.sys.country,
          coordinates: { lat: data.coord.lat, lon: data.coord.lon },
        },
        current: {
          temperature: data.main.temp,
          feels_like: data.main.feels_like,
          temp_min: data.main.temp_min,
          temp_max: data.main.temp_max,
          humidity: data.main.humidity,
          wind_speed: data.wind.speed,
          weather: {
            main: data.weather[0].main,
            description: data.weather[0].description,
          },
          sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
          sunset: new Date(data.sys.sunset * 1000).toISOString(),
        },
        units,
        pricing: {
          base_cost: 0.010,
          currency: 'USDC',
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Mock response
    return {
      success: true,
      tool: 'get_current_weather',
      location,
      units,
      current: {
        temperature: units === 'metric' ? 18 : 65,
        feels_like: units === 'metric' ? 16 : 61,
        humidity: 72,
        wind_speed: units === 'metric' ? 15 : 9,
        weather: {
          main: 'Clear',
          description: 'clear sky',
        },
      },
      pricing: {
        base_cost: 0.010,
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async getForecast(args: any) {
    const { location, units = 'imperial', days = 3 } = args;

    // Mock forecast
    const forecast = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        temp_min: 55 + i * 2,
        temp_max: 75 + i * 2,
        weather: {
          main: 'Clear',
          description: 'clear sky',
        },
        precipitation_prob: 0.1 + i * 0.1,
      });
    }

    return {
      success: true,
      tool: 'get_forecast',
      location,
      days,
      units,
      forecast_by_day: forecast,
      pricing: {
        base_cost: 0.020,
        currency: 'USDC',
      },
      timestamp: new Date().toISOString(),
    };
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(`✅ Weather MCP Server running on port ${this.port}`);
      console.log(`   Health check: http://localhost:${this.port}/health`);
      console.log(`   API Key: ${API_KEY ? 'Configured ✓' : 'Not configured (using mocks)'}`);
    });
  }
}

const server = new WeatherMCPServer();
server.start();
