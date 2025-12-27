import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

class GoogleMapsMCPServer {
  private app: express.Application;
  private port: number;
  private baseUrl: string = 'https://maps.googleapis.com/maps/api/geocode';

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'google-maps MCP', version: '1.0.0' });
    });

    // List tools
    this.app.get('/tools', (req, res) => {
      res.json({
        tools: [
          {
                    "name": "geocode",
                    "description": "Geocode",
                    "baseCost": 0.01,
                    "inputSchema": {
                              "type": "object",
                              "properties": {
                                        "address": {
                                                  "type": "string",
                                                  "description": "The street address that you want to geocode, in the format used by the national postal service of the country concerned."
                                        },
                                        "key": {
                                                  "type": "string",
                                                  "description": "Your application's API key. This key identifies your application for purposes of quota management."
                                        }
                              },
                              "required": [
                                        "key"
                              ]
                    }
          }
]
      });
    });

    // Tool: geocode
    this.app.post('/tools/geocode', async (req: Request, res: Response) => {
      try {
        const args = req.body;
        
        // Construct URL with path params
        let url = `${this.baseUrl}/json`;
        

        const response = await axios({
          method: 'get',
          url,
          params: args,
        });

        res.json({
          success: true,
          tool: 'geocode',
          data: response.data
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          error: error.message,
          details: error.response?.data
        });
      }
    });
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(`✅ google-maps MCP Server running on port ${this.port}`);
    });
  }
}

const server = new GoogleMapsMCPServer();
server.start();
