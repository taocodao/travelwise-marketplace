/**
 * Google Weather Service
 * 
 * Uses Google Weather API for weather data:
 * - Current conditions
 * - Daily forecast (up to 10 days)
 * - Hourly forecast
 * 
 * API Docs: https://developers.google.com/maps/documentation/weather
 */

import axios from 'axios';

export interface WeatherCondition {
  description: string;
  iconUrl: string;
  type: string;
}

export interface CurrentWeather {
  location: string;
  coordinates: { lat: number; lng: number };
  temperature: number;
  feelsLike: number;
  humidity: number;
  uvIndex: number;
  windSpeed: number;
  windDirection: string;
  visibility: number;
  cloudCover: number;
  condition: WeatherCondition;
  isDaytime: boolean;
  precipitationProbability: number;
  timestamp: string;
}

export interface DailyForecast {
  date: string;
  displayDate: { year: number; month: number; day: number };
  maxTemperature: number;
  minTemperature: number;
  condition: WeatherCondition;
  humidity: number;
  uvIndex: number;
  precipitationProbability: number;
  thunderstormProbability: number;
  cloudCover: number;
  sunrise?: string;
  sunset?: string;
}

export interface WeatherResponse {
  success: boolean;
  current?: CurrentWeather;
  forecast?: DailyForecast[];
  error?: string;
}

export class GoogleWeatherService {
  private apiKey: string;
  private baseUrl = 'https://weather.googleapis.com/v1';

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY not set - Weather API unavailable');
    } else {
      console.log('✅ Google Weather service initialized');
    }
  }

  /**
   * Get current weather conditions for a location
   */
  async getCurrentConditions(lat: number, lng: number): Promise<WeatherResponse> {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      console.log('🌤️ Google Weather API - Current Conditions:', { lat, lng });

      const response = await axios.get(`${this.baseUrl}/currentConditions:lookup`, {
        params: {
          key: this.apiKey,
          'location.latitude': lat,
          'location.longitude': lng,
        },
      });

      const data = response.data;
      console.log('🌤️ Weather Response:', { 
        condition: data.weatherCondition?.description?.text,
        temp: data.temperature?.degrees 
      });

      return {
        success: true,
        current: {
          location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          coordinates: { lat, lng },
          temperature: this.celsiusToFahrenheit(data.temperature?.degrees || 0),
          feelsLike: this.celsiusToFahrenheit(data.feelsLikeTemperature?.degrees || 0),
          humidity: data.relativeHumidity || 0,
          uvIndex: data.uvIndex || 0,
          windSpeed: this.kmhToMph(data.wind?.speed?.value || 0),
          windDirection: data.wind?.direction?.cardinal || 'N',
          visibility: this.kmToMiles(data.visibility?.distance || 0),
          cloudCover: data.cloudCover || 0,
          condition: {
            description: data.weatherCondition?.description?.text || 'Unknown',
            iconUrl: data.weatherCondition?.iconBaseUri + '.png' || '',
            type: data.weatherCondition?.type || 'UNKNOWN',
          },
          isDaytime: data.isDaytime ?? true,
          precipitationProbability: data.precipitation?.probability?.percent || 0,
          timestamp: data.currentTime || new Date().toISOString(),
        },
      };
    } catch (error: any) {
      console.error('❌ Google Weather API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Get daily forecast for a location
   */
  async getDailyForecast(lat: number, lng: number, days: number = 7): Promise<WeatherResponse> {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    try {
      console.log('📅 Google Weather API - Daily Forecast:', { lat, lng, days });

      const response = await axios.get(`${this.baseUrl}/forecast/days:lookup`, {
        params: {
          key: this.apiKey,
          'location.latitude': lat,
          'location.longitude': lng,
          days: Math.min(days, 10), // Max 10 days
        },
      });

      const data = response.data;
      console.log('📅 Forecast Response:', { days: data.forecastDays?.length });

      const forecast: DailyForecast[] = (data.forecastDays || []).map((day: any) => ({
        date: day.interval?.startTime || '',
        displayDate: day.displayDate,
        maxTemperature: this.celsiusToFahrenheit(day.maxTemperature?.degrees || 0),
        minTemperature: this.celsiusToFahrenheit(day.minTemperature?.degrees || 0),
        condition: {
          description: day.daytimeForecast?.weatherCondition?.description?.text || 'Unknown',
          iconUrl: day.daytimeForecast?.weatherCondition?.iconBaseUri + '.png' || '',
          type: day.daytimeForecast?.weatherCondition?.type || 'UNKNOWN',
        },
        humidity: day.daytimeForecast?.relativeHumidity || 0,
        uvIndex: day.daytimeForecast?.uvIndex || 0,
        precipitationProbability: day.daytimeForecast?.precipitation?.probability?.percent || 0,
        thunderstormProbability: day.daytimeForecast?.thunderstormProbability || 0,
        cloudCover: day.daytimeForecast?.cloudCover || 0,
        sunrise: day.sunEvents?.sunriseTime,
        sunset: day.sunEvents?.sunsetTime,
      }));

      return {
        success: true,
        forecast,
      };
    } catch (error: any) {
      console.error('❌ Google Weather API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Get weather for a location name (geocodes first)
   */
  async getWeatherByLocation(location: string): Promise<WeatherResponse> {
    try {
      // Geocode the location first
      const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: location,
          key: this.apiKey,
        },
      });

      if (!geocodeResponse.data.results?.[0]) {
        return { success: false, error: `Location not found: ${location}` };
      }

      const { lat, lng } = geocodeResponse.data.results[0].geometry.location;
      const formattedAddress = geocodeResponse.data.results[0].formatted_address;

      // Get current conditions
      const currentResult = await this.getCurrentConditions(lat, lng);
      
      if (currentResult.success && currentResult.current) {
        currentResult.current.location = formattedAddress;
      }

      return currentResult;
    } catch (error: any) {
      console.error('❌ Weather by location error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get forecast for a location name (geocodes first)
   */
  async getForecastByLocation(location: string, days: number = 7): Promise<WeatherResponse> {
    try {
      // Geocode the location first
      const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: location,
          key: this.apiKey,
        },
      });

      if (!geocodeResponse.data.results?.[0]) {
        return { success: false, error: `Location not found: ${location}` };
      }

      const { lat, lng } = geocodeResponse.data.results[0].geometry.location;

      return await this.getDailyForecast(lat, lng, days);
    } catch (error: any) {
      console.error('❌ Forecast by location error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Unit conversion helpers
  private celsiusToFahrenheit(celsius: number): number {
    return Math.round((celsius * 9/5) + 32);
  }

  private kmhToMph(kmh: number): number {
    return Math.round(kmh * 0.621371);
  }

  private kmToMiles(km: number): number {
    return Math.round(km * 0.621371 * 10) / 10;
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export const googleWeatherService = new GoogleWeatherService();
