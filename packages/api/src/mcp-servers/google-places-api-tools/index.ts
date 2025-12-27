
import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';
const API_KEY = process.env.GOOGLE_PLACES_API_TOOLS_API_KEY;

interface Tool {
  path: string;
  method: string;
  summary: string;
  needsTool: boolean;
  toolName: string;
  toolDescription: string;
}

const tools: Tool[] = [
  {
    path: "/place/autocomplete",
    method: "GET",
    summary: "Autocomplete for text-based geographic searches",
    needsTool: true,
    toolName: "autocomplete_search",
    toolDescription: "Provides type-ahead search predictions for text-based geographic searches, returning suggestions for places such as businesses, addresses, and points of interest."
  },
  {
    path: "/place/details",
    method: "GET",
    summary: "Get details of a place",
    needsTool: true,
    toolName: "get_place_details",
    toolDescription: "Retrieves detailed information about a place, including its name, address, phone number, and user rating."
  },
  {
    path: "/place/nearbysearch",
    method: "GET",
    summary: "Search for places within a specified area",
    needsTool: true,
    toolName: "search_places_nearby",
    toolDescription: "Searches for places within a specified area, returning a list of places along with summary information about each place."
  },
  {
    path: "/place/photo",
    method: "GET",
    summary: "Retrieve photos of a place",
    needsTool: true,
    toolName: "retrieve_place_photos",
    toolDescription: "Retrieves photos related to a place, which can be used to visually represent the place in an application."
  },
  {
    path: "/place/queryautocomplete",
    method: "GET",
    summary: "Query Autocomplete for partial search queries",
    needsTool: true,
    toolName: "query_autocomplete",
    toolDescription: "Provides autocomplete suggestions for partial search queries, helping users complete their searches for places and points of interest."
  }
];

router.get('/tools', (req: Request, res: Response) => {
  res.json(tools);
});

tools.forEach(tool => {
  router.post(`/tools/${tool.toolName}`, async (req: Request, res: Response) => {
    try {
      const { data } = await axios.get(`${BASE_URL}${tool.path}`, {
        params: { ...req.body, key: API_KEY }
      });
      res.json(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        res.status(500).json({ message: error.message, details: error.response?.data });
      } else {
        res.status(500).json({ message: "An unexpected error occurred" });
      }
    }
  });
});

export default router;
