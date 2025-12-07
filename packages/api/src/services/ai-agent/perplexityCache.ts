import NodeCache from 'node-cache';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export class PerplexityCache {
  private cache: Map<string, CacheEntry>;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(ttlSeconds: number = 3600) {
    this.cache = new Map();
    this.defaultTTL = ttlSeconds * 1000; // Convert to milliseconds
    
    // Clean up expired entries every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 600000);
  }

  get(query: string): any | undefined {
    const entry = this.cache.get(query);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(query);
      return undefined;
    }

    return entry.data;
  }

  set(query: string, data: any, ttl?: number): void {
    this.cache.set(query, {
      data,
      timestamp: Date.now(),
      ttl: ttl ? ttl * 1000 : this.defaultTTL,
    });
  }

  has(query: string): boolean {
    const entry = this.cache.get(query);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(query);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Cache cleanup: removed ${removed} expired entries, ${this.cache.size} remaining`);
    }
  }
}
