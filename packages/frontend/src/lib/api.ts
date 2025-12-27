// Determine the base URL based on environment
const getBaseURL = () => {
  // If running on server-side (Next.js SSR)
  if (typeof window === 'undefined') {
    return process.env.API_BASE_URL || 'http://localhost:3000';
  }
  
  // Client-side: use same origin (empty string) or full URL
  return process.env.NEXT_PUBLIC_API_URL || '';
};

const API_BASE_URL = getBaseURL();

// MCP Server ports (on same server)
const MCP_PORTS = {
  googleMaps: 3003,
  weather: 3004,
  travelAgent: 3005,
};

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async get<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async post<T = any>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async put<T = any>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Admin-specific helper methods
  async getDashboardStats() {
    return this.get('/api/admin/stats');
  }

  async getAgents() {
    return this.get('/api/admin/agents');
  }

  async createAgent(data: any) {
    return this.post('/api/admin/agents', data);
  }

  async updateAgent(id: string, data: any) {
    return this.put(`/api/admin/agents/${id}`, data);
  }

  async deleteAgent(id: string) {
    return this.delete(`/api/admin/agents/${id}`);
  }

  // ===== NEW: MCP Server Methods =====
  
  /**
   * Get MCP server status and configuration
   */
  async getMCPStatus() {
    return this.get('/api/mcp/status');
  }

  /**
   * Call Google Maps MCP server
   */
  async callGoogleMaps(endpoint: string, data?: any) {
    const url = `/api/mcp/maps${endpoint}`;
    return data ? this.post(url, data) : this.get(url);
  }

  /**
   * Call Weather MCP server
   */
  async callWeather(endpoint: string, data?: any) {
    const url = `/api/mcp/weather${endpoint}`;
    return data ? this.post(url, data) : this.get(url);
  }

  /**
   * Call Travel Agent MCP server
   */
  async callTravelAgent(endpoint: string, data?: any) {
    const url = `/api/mcp/travel${endpoint}`;
    return data ? this.post(url, data) : this.get(url);
  }

  // Specific MCP methods
  async searchPlaces(query: string, location?: { lat: number; lng: number }) {
    return this.callGoogleMaps('/search', { query, location });
  }

  async getWeather(city: string) {
    return this.callWeather('/current', { city });
  }

  async planTrip(destination: string, preferences: any) {
    return this.callTravelAgent('/plan', { destination, preferences });
  }
}

// Export singleton instances
export const api = new ApiClient(API_BASE_URL);
export const adminAPI = api; // Same instance for admin

// Export MCP server URLs for direct access (if needed)
export const MCP_SERVERS = {
  googleMaps: `${API_BASE_URL}:${MCP_PORTS.googleMaps}`,
  weather: `${API_BASE_URL}:${MCP_PORTS.weather}`,
  travelAgent: `${API_BASE_URL}:${MCP_PORTS.travelAgent}`,
};
