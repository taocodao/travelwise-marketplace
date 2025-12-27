import { Router, Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

const router = Router();
const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_API_KEY;
const GEOLOCATION_URL = `https://www.googleapis.com/geolocation/v1/geolocate?key=${API_KEY}`;
const DIRECTIONS_URL = `https://maps.googleapis.com/maps/api/directions/json?key=${API_KEY}`;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

// Rate Limiter
class RateLimiter {
  private tokens = 0;
  private lastRefill = Date.now();
  constructor(private ratePerSec: number, private capacity: number) {}

  async removeToken() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.ratePerSec);
    this.lastRefill = now;
    if (this.tokens < 1) {
      const waitMs = (1 - this.tokens) / this.ratePerSec * 1000;
      await new Promise(r => setTimeout(r, waitMs));
      return this.removeToken();
    }
    this.tokens -= 1;
  }
}

const geolocationLimiter = new RateLimiter(5, 10);
const directionsLimiter = new RateLimiter(10, 20);

// Helper for API calls with error handling
async function apiCall(url: string, method: 'GET' | 'POST', data?: any) {
  try {
    const response = await axios({ url, method, data });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`API call error: ${message} (Status: ${status})`);
      throw new Error(`API call failed: ${message}`);
    }
    logger.error(`Unexpected error: ${error}`);
    throw new Error('Unexpected error occurred');
  }
}

// List available tools
router.get('/tools', (req: Request, res: Response) => {
  res.json([
    {
      toolName: "geolocate_device",
      toolDescription: "Retrieve the geographical location of a device based on WiFi access points and cell tower data."
    },
    {
      toolName: "get_directions",
      toolDescription: "Obtain detailed directions between two locations for various modes of transportation."
    }
  ]);
});

// Execute specific tool
router.post('/tools/:toolName', async (req: Request, res: Response) => {
  const toolName = req.params.toolName;

  try {
    if (toolName === 'geolocate_device') {
      await geolocationLimiter.removeToken();
      const result = await apiCall(GEOLOCATION_URL, 'POST', req.body);
      res.json(result);
    } else if (toolName === 'get_directions') {
      await directionsLimiter.removeToken();
      const { origin, destination, mode, waypoints } = req.query;
      const url = new URL(DIRECTIONS_URL);
      url.searchParams.set('origin', origin as string);
      url.searchParams.set('destination', destination as string);
      if (mode) url.searchParams.set('mode', mode as string);
      if (waypoints) url.searchParams.set('waypoints', waypoints as string);
      const result = await apiCall(url.toString(), 'GET');
      res.json(result);
    } else {
      res.status(404).json({ error: 'Tool not found' });
    }
  } catch (error) {
    logger.error(`Error executing tool ${toolName}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;