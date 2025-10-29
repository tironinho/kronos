import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

export class RedisService {
  private static instance: RedisService;
  private redis: Redis | null = null;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public async connect(config?: RedisConfig): Promise<boolean> {
    try {
      const redisConfig: RedisConfig = config || {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      };

      this.redis = new Redis(redisConfig);

      this.redis.on('connect', () => {
        console.log('✅ Redis conectado com sucesso');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        console.error('❌ Erro no Redis:', error);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        console.log('⚠️ Conexão Redis fechada');
        this.isConnected = false;
      });

      // Testar conexão
      await this.redis.ping();
      return true;

    } catch (error) {
      console.error('❌ Falha ao conectar Redis:', error);
      this.isConnected = false;
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
    }
  }

  public isRedisConnected(): boolean {
    return this.isConnected && this.redis !== null;
  }

  // Métodos de cache para dados de trading
  public async cacheTradingData(key: string, data: any, ttlSeconds = 300): Promise<boolean> {
    if (!this.isRedisConnected()) {
      return false;
    }

    try {
      await this.redis!.setex(key, ttlSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('❌ Erro ao cachear dados:', error);
      return false;
    }
  }

  public async getCachedTradingData<T>(key: string): Promise<T | null> {
    if (!this.isRedisConnected()) {
      return null;
    }

    try {
      const cached = await this.redis!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('❌ Erro ao buscar dados do cache:', error);
      return null;
    }
  }

  public async invalidateCache(pattern: string): Promise<boolean> {
    if (!this.isRedisConnected()) {
      return false;
    }

    try {
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        await this.redis!.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('❌ Erro ao invalidar cache:', error);
      return false;
    }
  }

  // Cache específico para dados de mercado
  public async cacheMarketData(symbol: string, data: any, ttlSeconds = 60): Promise<boolean> {
    return this.cacheTradingData(`market:${symbol}`, data, ttlSeconds);
  }

  public async getCachedMarketData(symbol: string): Promise<any> {
    return this.getCachedTradingData(`market:${symbol}`);
  }

  // Cache para análise técnica
  public async cacheTechnicalAnalysis(symbol: string, timeframe: string, data: any, ttlSeconds = 300): Promise<boolean> {
    return this.cacheTradingData(`ta:${symbol}:${timeframe}`, data, ttlSeconds);
  }

  public async getCachedTechnicalAnalysis(symbol: string, timeframe: string): Promise<any> {
    return this.getCachedTradingData(`ta:${symbol}:${timeframe}`);
  }

  // Cache para métricas de trading
  public async cacheTradingMetrics(data: any, ttlSeconds = 60): Promise<boolean> {
    return this.cacheTradingData('metrics:trading', data, ttlSeconds);
  }

  public async getCachedTradingMetrics(): Promise<any> {
    return this.getCachedTradingData('metrics:trading');
  }

  // Cache para dados enriquecidos
  public async cacheEnhancedData(type: string, data: any, ttlSeconds = 180): Promise<boolean> {
    return this.cacheTradingData(`enhanced:${type}`, data, ttlSeconds);
  }

  public async getCachedEnhancedData(type: string): Promise<any> {
    return this.getCachedTradingData(`enhanced:${type}`);
  }

  // Cache para configurações
  public async cacheConfiguration(key: string, data: any, ttlSeconds = 3600): Promise<boolean> {
    return this.cacheTradingData(`config:${key}`, data, ttlSeconds);
  }

  public async getCachedConfiguration(key: string): Promise<any> {
    return this.getCachedTradingData(`config:${key}`);
  }

  // Métodos de estatísticas
  public async getCacheStats(): Promise<any> {
    if (!this.isRedisConnected()) {
      return null;
    }

    try {
      const info = await this.redis!.info('memory');
      const keys = await this.redis!.keys('*');
      
      return {
        connected: this.isConnected,
        totalKeys: keys.length,
        memoryInfo: info,
        uptime: await this.redis!.time()
      };
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas do cache:', error);
      return null;
    }
  }

  // Método para limpar cache específico
  public async clearTradingCache(): Promise<boolean> {
    return this.invalidateCache('market:*') && 
           this.invalidateCache('ta:*') && 
           this.invalidateCache('metrics:*') &&
           this.invalidateCache('enhanced:*');
  }

  // Método para limpar todo o cache
  public async clearAllCache(): Promise<boolean> {
    if (!this.isRedisConnected()) {
      return false;
    }

    try {
      await this.redis!.flushdb();
      return true;
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
      return false;
    }
  }
}

export default RedisService;
