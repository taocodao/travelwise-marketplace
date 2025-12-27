
import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const BASE_URL = 'https://petstore.swagger.io/v2';

// Tool Definitions
const tools = [
  {
    toolName: 'find_pets_by_status',
    path: '/pet/findByStatus',
    method: 'GET',
    description: 'Retrieve pets filtered by their status (available, pending, sold)',
  },
  {
    toolName: 'get_pet_by_id',
    path: '/pet/{petId}',
    method: 'GET',
    description: 'Retrieve details of a pet by its ID',
  },
  {
    toolName: 'get_inventory_by_status',
    path: '/store/inventory',
    method: 'GET',
    description: 'Get the inventory of pets categorized by their status',
  },
  {
    toolName: 'get_order_by_id',
    path: '/store/order/{orderId}',
    method: 'GET',
    description: 'Retrieve details of a purchase order by its ID',
  },
  {
    toolName: 'get_user_by_username',
    path: '/user/{username}',
    method: 'GET',
    description: 'Retrieve details of a user by their username',
  },
  {
    toolName: 'user_login',
    path: '/user/login',
    method: 'GET',
    description: 'Log in a user into the system and return a session token',
  },
  {
    toolName: 'user_logout',
    path: '/user/logout',
    method: 'GET',
    description: 'Log out the current logged-in user session',
  },
];

// List Tools
router.get('/tools', (req: Request, res: Response) => {
  try {
    const toolSummaries = tools.map(({ toolName, description }) => ({
      toolName,
      description,
    }));
    res.json(toolSummaries);
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

// Dynamic Tool Endpoints
tools.forEach(({ toolName, path, method }) => {
  const endpoint = `/tools/${toolName}`;
  if (method === 'GET') {
    router.post(endpoint, async (req: Request, res: Response) => {
      try {
        const { params, query } = req;
        const url = `${BASE_URL}${path.replace(/{\w+}/, (match) => params[match.replace(/[{}]/g, '')] || '')}`;
        const response = await axios.get(url, {
          params: query,
          headers: {
            'api_key': process.env.SWAGGER_PETSTORE_TOOLS_API_KEY || '',
          },
        });
        res.json(response.data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          res.status(error.response?.status || 500).send(error.response?.data || 'Error fetching data');
        } else {
          res.status(500).send('Internal Server Error');
        }
      }
    });
  }
  // Add other method handlers if needed
});

export default router;
