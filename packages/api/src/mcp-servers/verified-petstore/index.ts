
import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const API_BASE_URL = 'https://petstore.swagger.io/v2';

// Utility function to handle API requests
const handleApiRequest = async (path: string, method: 'GET' | 'POST', params = {}, data = {}) => {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'api_key': process.env.VERIFIED_PETSTORE_API_KEY || '',
  };

  try {
    const response = await axios({
      method,
      url,
      params,
      data,
      headers,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`API request failed: ${error.response?.status} ${error.response?.statusText}`);
    } else {
      throw new Error('An unexpected error occurred');
    }
  }
};

// MCP Tools endpoint
router.get('/tools', (req: Request, res: Response) => {
  res.json([
    { toolName: 'find_pets_by_status', toolDescription: 'Retrieve a list of pets filtered by their status (available, pending, sold)' },
    { toolName: 'get_pet_by_id', toolDescription: 'Retrieve details of a pet by its ID' },
    { toolName: 'get_inventory_status', toolDescription: 'Get the inventory status showing quantities of pets by their status' },
    { toolName: 'get_order_by_id', toolDescription: 'Retrieve details of a purchase order by its ID' },
    { toolName: 'user_login', toolDescription: 'Log a user into the system and return a session token' },
    { toolName: 'get_user_by_username', toolDescription: 'Retrieve details of a user by their username' },
  ]);
});

// Tool Endpoints
router.post('/tools/find_pets_by_status', async (req: Request, res: Response) => {
  try {
    const data = await handleApiRequest('/pet/findByStatus', 'GET', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.post('/tools/get_pet_by_id', async (req: Request, res: Response) => {
  try {
    const { petId } = req.body;
    const data = await handleApiRequest(`/pet/${petId}`, 'GET');
    res.json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.post('/tools/get_inventory_status', async (req: Request, res: Response) => {
  try {
    const data = await handleApiRequest('/store/inventory', 'GET');
    res.json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.post('/tools/get_order_by_id', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const data = await handleApiRequest(`/store/order/${orderId}`, 'GET');
    res.json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.post('/tools/user_login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const data = await handleApiRequest('/user/login', 'GET', { username, password });
    res.json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.post('/tools/get_user_by_username', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    const data = await handleApiRequest(`/user/${username}`, 'GET');
    res.json(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;
