import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import CacheService from './cache-service';

const cacheService = CacheService.getInstance();

export interface BinanceFuturesData {
  fundingRate: number;
  openInterest: number;
  longShortRatio: number;
  liquidations24h: number;
  tradeFlow: {
    longRatio: number;
    shortRatio: number;
    longVolume: number;
    shortVolume: number;
  };
  apiTradingStatus: {
    isLocked: boolean;
    plannedRecoverTime: number;
  };
}

export interface MarketSentimentData {
  fearGreedIndex: number;
  socialSentiment: number;
  newsSentiment: number;
  macroIndicators: {
    dxy: number;
    sp500: number;
    gold: number;
    oil: number;
  };
}

export class EnhancedDataCollector {
  private static instance: EnhancedDataCollector;
  private binanceClient: AxiosInstance;
  private apiKey: string;
  private secretKey: string;

  private constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.secretKey = process.env.BINANCE_SECRET_KEY || '';
    
    this.binanceClient = axios.create({
      baseURL: 'https://fapi.binance.com',
      timeout: 10000,
      headers: {
        'X-MBX-APIKEY': this.apiKey
      }
    });
  }

  public static getInstance(): EnhancedDataCollector {
    if (!EnhancedDataCollector.instance) {
      EnhancedDataCollector.instance = new EnhancedDataCollector();
    }
    return EnhancedDataCollector.instance;
  }

  /**
   * Coleta dados avançados de Futures da Binance
   */
  public async collectBinanceFuturesData(symbol: string): Promise<BinanceFuturesData> {
    try {
      // Verificar cache primeiro
      const cacheKey = `binance_futures:${symbol}`;
      const cached = await cacheService.get<BinanceFuturesData>(cacheKey);
      if (cached) {
        console.log(`📦 Dados Binance Futures para ${symbol} obtidos do cache`);
        return cached;
      }

      const [fundingRate, openInterest, longShortRatio, liquidations, tradeFlow, apiStatus] = await Promise.all([
        this.getFundingRate(symbol),
        this.getOpenInterest(symbol),
        this.getLongShortRatio(symbol),
        this.getLiquidations24h(symbol),
        this.getTradeFlow(symbol),
        this.getApiTradingStatus()
      ]);

      const data = {
        fundingRate,
        openInterest,
        longShortRatio,
        liquidations24h: liquidations,
        tradeFlow,
        apiTradingStatus: apiStatus
      };

      // Cachear por 2 minutos
      await cacheService.set(cacheKey, data, 120);
      console.log(`💾 Dados Binance Futures para ${symbol} cacheados`);

      return data;
    } catch (error) {
      console.error('Erro ao coletar dados Binance Futures:', error);
      throw error;
    }
  }

  /**
   * Coleta dados de sentiment e macro
   */
  public async collectMarketSentimentData(): Promise<MarketSentimentData> {
    try {
      // Verificar cache primeiro
      const cacheKey = 'market_sentiment';
      const cached = await cacheService.get<MarketSentimentData>(cacheKey);
      if (cached) {
        console.log('📦 Dados de sentiment obtidos do cache');
        return cached;
      }

      const [fearGreed, socialSentiment, newsSentiment, macroData] = await Promise.all([
        this.getFearGreedIndex(),
        this.getSocialSentiment(),
        this.getNewsSentiment(),
        this.getMacroIndicators()
      ]);

      const data = {
        fearGreedIndex: fearGreed,
        socialSentiment,
        newsSentiment,
        macroIndicators: macroData
      };

      // Cachear por 5 minutos
      await cacheService.set(cacheKey, data, 300);
      console.log('💾 Dados de sentiment cacheados');

      return data;
    } catch (error) {
      console.error('Erro ao coletar dados de sentiment:', error);
      throw error;
    }
  }

  /**
   * Funding Rate em tempo real
   */
  private async getFundingRate(symbol: string): Promise<number> {
    try {
      const response = await this.binanceClient.get('/fapi/v1/fundingRate', {
        params: { symbol, limit: 1 }
      });
      return parseFloat(response.data[0]?.fundingRate || '0');
    } catch (error) {
      console.warn('Erro ao buscar funding rate:', error);
      return 0;
    }
  }

  /**
   * Open Interest por símbolo
   */
  private async getOpenInterest(symbol: string): Promise<number> {
    try {
      const response = await this.binanceClient.get('/fapi/v1/openInterest', {
        params: { symbol }
      });
      return parseFloat(response.data?.openInterest || '0');
    } catch (error) {
      console.warn('Erro ao buscar open interest:', error);
      return 0;
    }
  }

  /**
   * Long/Short Ratio
   */
  private async getLongShortRatio(symbol: string): Promise<number> {
    try {
      const response = await this.binanceClient.get('/fapi/v1/longShortRatio', {
        params: { symbol, period: '5m', limit: 1 }
      });
      return parseFloat(response.data[0]?.longShortRatio || '1');
    } catch (error) {
      console.warn('Erro ao buscar long/short ratio:', error);
      return 1;
    }
  }

  /**
   * Liquidations nas últimas 24h
   */
  private async getLiquidations24h(symbol: string): Promise<number> {
    try {
      const response = await this.binanceClient.get('/fapi/v1/forceOrders', {
        params: { symbol, limit: 1000 }
      });
      
      const now = Date.now();
      const dayAgo = now - (24 * 60 * 60 * 1000);
      
      const liquidations24h = response.data
        .filter((order: any) => order.time >= dayAgo)
        .reduce((sum: number, order: any) => sum + parseFloat(order.origQty || '0'), 0);
      
      return liquidations24h;
    } catch (error) {
      console.warn('Erro ao buscar liquidations:', error);
      return 0;
    }
  }

  /**
   * Trade Flow Analysis
   */
  private async getTradeFlow(symbol: string): Promise<any> {
    try {
      const response = await this.binanceClient.get('/fapi/v1/takerlongshortRatio', {
        params: { symbol, period: '5m', limit: 1 }
      });
      
      const data = response.data[0];
      return {
        longRatio: parseFloat(data?.longRatio || '0.5'),
        shortRatio: parseFloat(data?.shortRatio || '0.5'),
        longVolume: parseFloat(data?.longVolume || '0'),
        shortVolume: parseFloat(data?.shortVolume || '0')
      };
    } catch (error) {
      console.warn('Erro ao buscar trade flow:', error);
      return {
        longRatio: 0.5,
        shortRatio: 0.5,
        longVolume: 0,
        shortVolume: 0
      };
    }
  }

  /**
   * Status da API de Trading
   */
  private async getApiTradingStatus(): Promise<any> {
    try {
      const response = await this.binanceClient.get('/fapi/v1/apiTradingStatus');
      return {
        isLocked: response.data?.isLocked || false,
        plannedRecoverTime: response.data?.plannedRecoverTime || 0
      };
    } catch (error) {
      console.warn('Erro ao buscar status da API:', error);
      return {
        isLocked: false,
        plannedRecoverTime: 0
      };
    }
  }

  /**
   * Fear & Greed Index (via CoinGecko)
   */
  private async getFearGreedIndex(): Promise<number> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/global');
      return response.data?.data?.fear_greed_index?.value || 50;
    } catch (error) {
      console.warn('Erro ao buscar Fear & Greed Index:', error);
      return 50;
    }
  }

  /**
   * Social Sentiment (simulado - implementar com APIs reais)
   */
  private async getSocialSentiment(): Promise<number> {
    try {
      // TODO: Implementar com Twitter API v2 ou Reddit API
      // Por enquanto, retorna valor simulado baseado em dados de mercado
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/bitcoin');
      const priceChange24h = response.data?.market_data?.price_change_percentage_24h || 0;
      
      // Sentiment baseado na variação de preço (simplificado)
      return Math.max(-1, Math.min(1, priceChange24h / 10));
    } catch (error) {
      console.warn('Erro ao buscar social sentiment:', error);
      return 0;
    }
  }

  /**
   * News Sentiment (simulado - implementar com APIs reais)
   */
  private async getNewsSentiment(): Promise<number> {
    try {
      // TODO: Implementar com News API ou similar
      // Por enquanto, retorna valor neutro
      return 0;
    } catch (error) {
      console.warn('Erro ao buscar news sentiment:', error);
      return 0;
    }
  }

  /**
   * Indicadores Macroeconômicos
   */
  private async getMacroIndicators(): Promise<any> {
    try {
      // TODO: Implementar com APIs macroeconômicas (FRED, etc.)
      // Por enquanto, retorna valores simulados
      return {
        dxy: 103.5, // Dollar Index
        sp500: 4500, // S&P 500
        gold: 2000, // Gold price
        oil: 80 // Oil price
      };
    } catch (error) {
      console.warn('Erro ao buscar indicadores macro:', error);
      return {
        dxy: 103.5,
        sp500: 4500,
        gold: 2000,
        oil: 80
      };
    }
  }

  /**
   * Coleta dados completos para um símbolo
   */
  public async collectCompleteData(symbol: string): Promise<{
    binanceFutures: BinanceFuturesData;
    marketSentiment: MarketSentimentData;
    timestamp: string;
  }> {
    try {
      const [binanceFutures, marketSentiment] = await Promise.all([
        this.collectBinanceFuturesData(symbol),
        this.collectMarketSentimentData()
      ]);

      return {
        binanceFutures,
        marketSentiment,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro ao coletar dados completos:', error);
      throw error;
    }
  }

  /**
   * Coleta dados para múltiplos símbolos em paralelo
   */
  public async collectMultipleSymbols(symbols: string[]): Promise<Map<string, any>> {
    try {
      const promises = symbols.map(async (symbol) => {
        try {
          const data = await this.collectCompleteData(symbol);
          return { symbol, data };
        } catch (error) {
          console.warn(`Erro ao coletar dados para ${symbol}:`, error);
          return { symbol, data: null };
        }
      });

      const results = await Promise.all(promises);
      const dataMap = new Map();

      results.forEach(({ symbol, data }) => {
        if (data) {
          dataMap.set(symbol, data);
        }
      });

      return dataMap;
    } catch (error) {
      console.error('Erro ao coletar dados para múltiplos símbolos:', error);
      throw error;
    }
  }
}

export default EnhancedDataCollector;
