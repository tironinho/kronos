interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private static instance: CacheService;
  private memoryCache = new Map<string, CacheEntry<any>>();
  private redisService: any = null;

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  public setRedisService(redisService: any): void {
    this.redisService = redisService;
  }

  // Método genérico de cache
  public async set<T>(key: string, data: T, ttlSeconds = 300): Promise<boolean> {
    const timestamp = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp,
      ttl: ttlSeconds * 1000
    };

    // Tentar Redis primeiro
    if (this.redisService?.isRedisConnected()) {
      try {
        return await this.redisService.cacheTradingData(key, data, ttlSeconds);
      } catch (error) {
        console.warn('⚠️ Redis falhou, usando cache em memória:', error);
      }
    }

    // Fallback para memória
    this.memoryCache.set(key, entry);
    return true;
  }

  public async get<T>(key: string): Promise<T | null> {
    // Tentar Redis primeiro
    if (this.redisService?.isRedisConnected()) {
      try {
        const cached = await this.redisService.getCachedTradingData<T>(key);
        if (cached !== null) {
          return cached;
        }
      } catch (error) {
        console.warn('⚠️ Redis falhou, usando cache em memória:', error);
      }
    }

    // Fallback para memória
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // Verificar TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  public async delete(key: string): Promise<boolean> {
    // Tentar Redis primeiro
    if (this.redisService?.isRedisConnected()) {
      try {
        await this.redisService.invalidateCache(key);
      } catch (error) {
        console.warn('⚠️ Redis falhou, removendo da memória:', error);
      }
    }

    // Fallback para memória
    return this.memoryCache.delete(key);
  }

  public async clear(): Promise<boolean> {
    // Tentar Redis primeiro
    if (this.redisService?.isRedisConnected()) {
      try {
        await this.redisService.clearAllCache();
      } catch (error) {
        console.warn('⚠️ Redis falhou, limpando memória:', error);
      }
    }

    // Fallback para memória
    this.memoryCache.clear();
    return true;
  }

  // Métodos específicos para trading
  public async cacheMarketData(symbol: string, data: any, ttlSeconds = 60): Promise<boolean> {
    return this.set(`market:${symbol}`, data, ttlSeconds);
  }

  public async getMarketData(symbol: string): Promise<any> {
    return this.get(`market:${symbol}`);
  }

  public async cacheTechnicalAnalysis(symbol: string, timeframe: string, data: any, ttlSeconds = 300): Promise<boolean> {
    return this.set(`ta:${symbol}:${timeframe}`, data, ttlSeconds);
  }

  public async getTechnicalAnalysis(symbol: string, timeframe: string): Promise<any> {
    return this.get(`ta:${symbol}:${timeframe}`);
  }

  public async cacheTradingMetrics(data: any, ttlSeconds = 60): Promise<boolean> {
    return this.set('metrics:trading', data, ttlSeconds);
  }

  public async getTradingMetrics(): Promise<any> {
    return this.get('metrics:trading');
  }

  public async cacheEnhancedData(type: string, data: any, ttlSeconds = 180): Promise<boolean> {
    return this.set(`enhanced:${type}`, data, ttlSeconds);
  }

  public async getEnhancedData(type: string): Promise<any> {
    return this.get(`enhanced:${type}`);
  }

  // Estatísticas do cache
  public getStats(): any {
    const memoryStats = {
      totalKeys: this.memoryCache.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    return {
      memory: memoryStats,
      redis: this.redisService?.isRedisConnected() ? 'Connected' : 'Disconnected'
    };
  }

  // Limpeza de cache expirado
  public cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }
}

export default CacheService;
