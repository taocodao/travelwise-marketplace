import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENWEATHER_API_KEY;
if (!API_KEY) {
  throw new Error('OPENWEATHER_API_KEY environment variable is required');
}

class WeatherMCPServer {
  private server: Server;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';

  constructor() {
    this.server = new Server(
      {
        name: 'weather-mcp',
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
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_current_weather',
          description: 'Get current weather conditions for a location',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name or coordinates',
              },
              units: {
                type: 'string',
                enum: ['metric', 'imperial'],
                default: 'imperial',
              },
            },
            required: ['location'],
          },
        },
        {
          name: 'get_forecast',
          description: 'Get 5-day weather forecast with 3-hour intervals',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name or coordinates',
              },
              units: {
                type: 'string',
                enum: ['metric', 'imperial'],
                default: 'imperial',
              },
              days: {
                type: 'number',
                description: 'Number of days (1-5)',
                default: 3,
              },
            },
            required: ['location'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_current_weather':
            return await this.getCurrentWeather(args);
          case 'get_forecast':
            return await this.getForecast(args);
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

  private async getCurrentWeather(args: any) {
    const { location, units = 'imperial' } = args;

    const response = await axios.get(`${this.baseUrl}/weather`, {
      params: {
        q: location,
        appid: API_KEY,
        units,
      },
    });

    const data = response.data;

    const result = {
      status: 'success',
      location: {
        name: data.name,
        country: data.sys.country,
        coordinates: {
          lat: data.coord.lat,
          lon: data.coord.lon,
        },
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
      timestamp: new Date().toISOString(),
      cost_info: {
        api_cost_usd: 0,
        note: 'Free tier (1000 calls/day)',
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

  private async getForecast(args: any) {
    const { location, units = 'imperial', days = 3 } = args;

    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params: {
        q: location,
        appid: API_KEY,
        units,
        cnt: days * 8, // 8 intervals per day
      },
    });

    const data = response.data;

    // Group by day
    const dailyForecasts = new Map<string, any[]>();

    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      if (!dailyForecasts.has(date)) {
        dailyForecasts.set(date, []);
      }
      dailyForecasts.get(date)!.push({
        time: new Date(item.dt * 1000).toISOString(),
        temperature: item.main.temp,
        feels_like: item.main.feels_like,
        humidity: item.main.humidity,
        weather: {
          main: item.weather[0].main,
          description: item.weather[0].description,
        },
        wind_speed: item.wind.speed,
        precipitation_probability: item.pop,
      });
    });

    const result = {
      status: 'success',
      location: {
        name: data.city.name,
        country: data.city.country,
        coordinates: {
          lat: data.city.coord.lat,
          lon: data.city.coord.lon,
        },
      },
      forecast_by_day: Array.from(dailyForecasts.entries()).map(([date, intervals]) => ({
        date,
        intervals,
        summary: {
          temp_min: Math.min(...intervals.map((i) => i.temperature)),
          temp_max: Math.max(...intervals.map((i) => i.temperature)),
          avg_temp: intervals.reduce((sum, i) => sum + i.temperature, 0) / intervals.length,
          max_precipitation_prob: Math.max(...intervals.map((i) => i.precipitation_probability)),
        },
      })),
      units,
      cost_info: {
        api_cost_usd: 0,
        note: 'Free tier',
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
    console.error('Weather MCP Server running on stdio');
  }
}

const server = new WeatherMCPServer();
server.run().catch(console.error);
