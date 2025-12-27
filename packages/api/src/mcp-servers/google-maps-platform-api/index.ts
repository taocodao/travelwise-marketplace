
import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const BASE_URL = 'https://maps.googleapis.com/maps/api';
const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_API_API_KEY;

const tools = [
  {
    toolName: 'geocode_address',
    path: '/geocode/json',
    description: 'Converts addresses into geographic coordinates.',
  },
  {
    toolName: 'get_directions',
    path: '/directions/json',
    description: 'Provides directions between two or more locations.',
  },
  {
    toolName: 'search_nearby_places',
    path: '/place/nearbysearch/json',
    description: 'Finds places within a specified area.',
  },
  {
    toolName: 'get_place_details',
    path: '/place/details/json',
    description: 'Retrieves detailed information about a specific place.',
  },
  {
    toolName: 'autocomplete_place_names',
    path: '/place/autocomplete/json',
    description: 'Provides place predictions based on a user\'s text input.',
  },
  {
    toolName: 'generate_static_map',
    path: '/staticmap',
    description: 'Creates a map based on URL parameters sent through a standard HTTP request and returns the map as an image you can display on your web page.',
  },
];

router.get('/tools', (req: Request, res: Response) => {
  const toolSummaries = tools.map(tool => ({
    toolName: tool.toolName,
    description: tool.description,
  }));
  res.json(toolSummaries);
});

tools.forEach(tool => {
  router.post(`/tools/${tool.toolName}`, async (req: Request, res: Response) => {
    try {
      const { data } = await axios.get(`${BASE_URL}${tool.path}`, {
        params: { ...req.body, key: API_KEY },
      });
      res.json(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        res.status(error.response?.status || 500).json({
          message: error.response?.data || 'An error occurred while processing your request.',
        });
      } else {
        res.status(500).json({
          message: 'An unexpected error occurred.',
        });
      }
    }
  });
});

export default router;
