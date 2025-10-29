// ============================================================================
// INTEGRAÇÃO COM BINANCE APIs - KRONOS-X
// ============================================================================

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import crypto from 'crypto';
import {
  BinanceSymbolInfo,
  BinanceTicker24hr,
  BinanceKline,
  BinanceOrderBook,
  BinanceTrade,
  BinanceFundingRate,
  BinanceOpenInterest,
  BinanceLongShortRatio,
  BinanceFilter
} from '../types';
import { CryptoUtils, PromiseUtils } from '../utils';
import { getConfig } from '../config';
import { getComponentLogger, SystemComponent, SystemAction } from './logging';
import { rateLimitManager } from './rate-limit-manager';

// ============================================================================
// CLASSE PRINCIPAL DA BINANCE API
// ============================================================================

export class BinanceApiClient {
  private static instance: BinanceApiClient;
  private logger = getComponentLogger(SystemComponent.BinanceAPI);
  
  private httpClient: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private secretKey: string;
  private testnet: boolean;
  // Sincronização de tempo e janela padrão
  private timeOffsetMs: number = 0;
  private lastTimeSyncMs: number = 0;
  private readonly recvWindowDefault: number = 20000; // 20s

  private constructor(baseUrl?: string, apiKey?: string, secretKey?: string) {
    const config = getConfig();
    this.baseUrl = baseUrl || config.getBinanceBaseUrl();
    
    // ✅ SEGURANÇA: Verificar credenciais SEM logar em produção
    const { apiKey: envApiKey, secretKey: envSecretKey } = config.getApiKeys();
    // ✅ REMOVIDO: Logs de Secret Key (ChatGPT: risco de vazamento de credenciais)
    // console.log('  API Key prefix:', ...); ❌ PERIGOSO
    
    this.apiKey = apiKey || envApiKey;
    this.secretKey = secretKey || envSecretKey;
    
    // Apenas verificar se existe (sem logar prefix)
    if (!this.apiKey || !this.secretKey) {
      console.error('❌ API Key ou Secret Key não configuradas!');
    } else {
      console.log('✅ Credenciais Binance configuradas (keys sanitizadas no log)');
    }
    this.testnet = config.isTestnet();

    // Timeout de 10s (requisito da Binance)
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000, // 10 segundos - CRÍTICO segundo documentação
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kronos-X-Engine/1.0.0'
      }
    });

    // Interceptor para adicionar API key quando necessário
    this.httpClient.interceptors.request.use((config) => {
      if (this.apiKey) {
        // Adiciona API key para todas as requisições que precisam de autenticação
        if (config.url?.includes('/api/v3/account') || 
            config.url?.includes('/api/v3/order') ||
            config.url?.includes('/api/v3/userDataStream') ||
            config.url?.includes('/fapi/v1') && config.url?.includes('/account')) {
          config.headers['X-MBX-APIKEY'] = this.apiKey;
        }
      }
      return config;
    });

    // Interceptor para logging de respostas e rate limit
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(
          SystemAction.DataProcessing,
          `API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`,
          { status: response.status, data_size: JSON.stringify(response.data).length }
        );
        
        // Verifica rate limits
        rateLimitManager.checkRateLimit(response);
        
        return response;
      },
      (error) => {
        this.logger.error(
          SystemAction.ErrorHandling,
          `API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
          error,
          { status: error.response?.status, data: error.response?.data }
        );
        
        // Verifica rate limits mesmo em erro
        if (error.response) {
          rateLimitManager.checkRateLimit(error.response);
        }
        
        return Promise.reject(error);
      }
    );

    // Interceptor de request para verificar se deve bloquear
    this.httpClient.interceptors.request.use(
      async (config) => {
        // ✅ Passar URL, método e dados para verificar se é operação crítica
        const url = config.url || '';
        const method = config.method || '';
        const data = config.data;
        
        if (rateLimitManager.shouldBlock(url, method, data)) {
          const remaining = rateLimitManager.getBlockTimeRemaining();
          console.warn(`⚠️ Request bloqueado (Rate Limit). Aguardar ${(remaining / 1000).toFixed(0)}s`);
          
          // Aguardar até poder fazer request
          if (remaining > 0 && remaining < 60000) {
            await new Promise(resolve => setTimeout(resolve, remaining));
          } else {
            throw new Error('Rate limit - IP pode estar banido');
          }
        }
        
        return config;
      }
    );
  }

  public static getInstance(baseUrl?: string, apiKey?: string, secretKey?: string): BinanceApiClient {
    if (!BinanceApiClient.instance) {
      BinanceApiClient.instance = new BinanceApiClient(baseUrl, apiKey, secretKey);
    }
    return BinanceApiClient.instance;
  }

  /**
   * Gera assinatura para requisições autenticadas
   */
  private generateSignature(params: Record<string, any>): string {
    // CRÍTICO: Excluir 'signature' dos params antes de gerar a query string
    const paramsWithoutSignature = { ...params };
    delete paramsWithoutSignature.signature;
    
    const queryString = Object.keys(paramsWithoutSignature)
      .sort()
      .map(key => `${key}=${paramsWithoutSignature[key]}`)
      .join('&');
    
    // ✅ SEGURANÇA: NÃO logar assinatura (ChatGPT: informação sensível)
    // Console.log apenas quando EXTREMAMENTE necessário para debug crítico
    // const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
    
    const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
    // ✅ Log sanitizado: apenas indicar que gerou
    // console.log('  Signature gerada:', signature); // ❌ REMOVIDO
    
    return signature;
  }

  /**
   * Constrói query string assinada de forma determinística (ordem alfabética)
   * e devolve a string final "k=v&...&signature=..."
   */
  private buildSignedQuery(params: Record<string, any>): string {
    const paramsWithoutSignature = { ...params };
    delete paramsWithoutSignature.signature;

    const queryString = Object.entries(paramsWithoutSignature)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        // CRÍTICO: timestamp deve ser inteiro SEM decimais
        if (k === 'timestamp') {
          v = Math.floor(Number(v));
        }
        return `${k}=${encodeURIComponent(String(v))}`;
      })
      .join('&');

    const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
    return `${queryString}&signature=${signature}`;
  }

  /**
   * Adiciona timestamp e assinatura aos parâmetros
   */
  private addAuthParams(params: Record<string, any> = {}, recvWindow?: number): Record<string, any> {
    // Sincroniza tempo periodicamente (a cada 60s) para evitar -1021
    const now = Date.now();
    if (now - this.lastTimeSyncMs > 60_000) {
      this.syncServerTime().catch(() => {});
    }
    // Binance exige inteiro para timestamp (ms)
    const ts = Math.floor(now + this.timeOffsetMs);
    params.timestamp = ts;
    
    // Usa recvWindow padrão mais amplo se não especificado
    params.recvWindow = recvWindow || this.recvWindowDefault;
    
    params.signature = this.generateSignature(params);
    return params;
  }

  /**
   * Faz requisição GET
   */
  private async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.httpClient.get(endpoint, { params });
      return response.data;
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro na requisição GET ${endpoint}`,
        error as Error,
        { params }
      );
      throw error;
    }
  }

  /**
   * GET assinado (ordem de parâmetros preservada p/ assinatura)
   */
  private async getSigned<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const finalQuery = this.buildSignedQuery(params);
    const url = `${endpoint}?${finalQuery}`;
    const response: AxiosResponse<T> = await this.httpClient.request({
      method: 'GET',
      url,
      data: undefined,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });
    return response.data;
  }

  /**
   * DELETE assinado (ordem de parâmetros preservada p/ assinatura)
   */
  private async deleteSigned<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const finalQuery = this.buildSignedQuery(params);
    const url = `${endpoint}?${finalQuery}`;
    const response: AxiosResponse<T> = await this.httpClient.request({
      method: 'DELETE',
      url,
      data: undefined,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });
    return response.data;
  }

  /**
   * Faz requisição POST
   */
  private async post<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    try {
      // Para Binance Spot API, POST deve ter params na query string SEM body
      // IMPORTANTE: API key já é adicionada pelo interceptor do httpClient
      const response: AxiosResponse<T> = await this.httpClient.request({
        method: 'POST',
        url: endpoint,
        params: params,
        data: undefined  // SEM body!
      });
      return response.data;
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro na requisição POST ${endpoint}`,
        error as Error,
        { params }
      );
      throw error;
    }
  }

  /**
   * Faz requisição DELETE
   */
  private async delete<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.httpClient.delete(endpoint, { params });
      return response.data;
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro na requisição DELETE ${endpoint}`,
        error as Error,
        { params }
      );
      throw error;
    }
  }

  // ============================================================================
  // ENDPOINTS PÚBLICOS
  // ============================================================================

  /**
   * Obtém informações de todos os símbolos
   */
  public async getExchangeInfo(): Promise<{ symbols: BinanceSymbolInfo[] }> {
    return this.get<{ symbols: BinanceSymbolInfo[] }>('/api/v3/exchangeInfo');
  }

  /**
   * Obtém informações de um símbolo específico
   */
  public async getSymbolInfo(symbol: string): Promise<BinanceSymbolInfo | null> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      return exchangeInfo.symbols.find(s => s.symbol === symbol) || null;
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro ao obter informações do símbolo ${symbol}`,
        error as Error
      );
      return null;
    }
  }

  /**
   * Obtém ticker de 24h para um símbolo
   */
  public async get24hrTicker(symbol: string): Promise<BinanceTicker24hr> {
    return this.get<BinanceTicker24hr>(`/api/v3/ticker/24hr`, { symbol });
  }

  /**
   * Obtém tickers de 24h para todos os símbolos
   */
  public async getAll24hrTickers(): Promise<BinanceTicker24hr[]> {
    return this.get<BinanceTicker24hr[]>('/api/v3/ticker/24hr');
  }

  /**
   * Obtém preço atual de um símbolo
   */
  public async getPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    return this.get<{ symbol: string; price: string }>('/api/v3/ticker/price', { symbol });
  }

  /**
   * Obtém preços de todos os símbolos
   */
  public async getAllPrices(): Promise<{ symbol: string; price: string }[]> {
    return this.get<{ symbol: string; price: string }[]>('/api/v3/ticker/price');
  }

  /**
   * Obtém dados de klines (velas)
   */
  public async getKlines(
    symbol: string,
    interval: string,
    limit: number = 500,
    startTime?: number,
    endTime?: number
  ): Promise<BinanceKline[]> {
    const params: Record<string, any> = { symbol, interval, limit };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    return this.get<any[][]>('/api/v3/klines', params).then(data => 
      data.map(kline => ({
        open_time: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        close_time: kline[6],
        quote_asset_volume: kline[7],
        number_of_trades: kline[8],
        taker_buy_base_asset_volume: kline[9],
        taker_buy_quote_asset_volume: kline[10],
        ignore: kline[11]
      }))
    );
  }

  /**
   * Obtém order book
   */
  public async getOrderBook(symbol: string, limit: number = 100): Promise<BinanceOrderBook> {
    return this.get<BinanceOrderBook>('/api/v3/depth', { symbol, limit });
  }

  /**
   * Obtém trades recentes
   */
  public async getRecentTrades(symbol: string, limit: number = 500): Promise<BinanceTrade[]> {
    return this.get<BinanceTrade[]>('/api/v3/trades', { symbol, limit });
  }

  /**
   * Obtém trades agregados
   */
  public async getAggTrades(
    symbol: string,
    limit: number = 500,
    startTime?: number,
    endTime?: number
  ): Promise<any[]> {
    const params: Record<string, any> = { symbol, limit };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    return this.get<any[]>('/api/v3/aggTrades', params);
  }

  // ============================================================================
  // ENDPOINTS DE FUTUROS
  // ============================================================================

  /**
   * Obtém taxa de funding para futuros
   */
  public async getFundingRate(symbol: string): Promise<BinanceFundingRate> {
    // Usa base URL de Futuros
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    
    // Cria cliente temporário para chamar a API de Futuros
    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kronos-X-Engine/1.0.0'
      }
    });
    
    const response = await axiosInstance.get('/fapi/v1/premiumIndex', { 
      params: { symbol } 
    });
    return response.data;
  }

  /**
   * Obtém taxa de funding histórica
   */
  public async getFundingRateHistory(
    symbol: string,
    limit: number = 100,
    startTime?: number,
    endTime?: number
  ): Promise<BinanceFundingRate[]> {
    // Usa base URL de Futuros
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    
    const params: Record<string, any> = { symbol, limit };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kronos-X-Engine/1.0.0'
      }
    });
    
    const response = await axiosInstance.get('/fapi/v1/fundingRate', { params });
    return response.data;
  }

  /**
   * Obtém open interest
   */
  public async getOpenInterest(symbol: string): Promise<BinanceOpenInterest> {
    try {
      // Usa base URL de Futuros
      const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
      
      const axiosInstance = axios.create({
        baseURL: futuresBaseUrl,
        timeout: this.httpClient.defaults.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0'
        }
      });
      
      const response = await axiosInstance.get('/fapi/v1/openInterest', { 
        params: { symbol } 
      });
      return response.data;
    } catch (error: any) {
      // ✅ MELHORIA: Tratamento de erro robusto para Open Interest
      if (error.response?.status === 400) {
        console.warn(`⚠️ Open Interest: Bad Request (400) para ${symbol} - símbolo pode não ter dados de futures`);
      } else if (error.response?.status === 429) {
        console.warn(`⚠️ Open Interest: Rate Limit (429) para ${symbol} - muitas requisições`);
      } else if (error.response?.status >= 500) {
        console.warn(`⚠️ Open Interest: Server Error (${error.response.status}) para ${symbol} - problema no servidor`);
      } else {
        console.warn(`⚠️ Open Interest: Erro para ${symbol}: ${error.message}`);
      }
      
      // ✅ FALLBACK: Retornar dados padrão quando API falha
      return {
        symbol: symbol,
        openInterest: '0',
        time: Date.now()
      };
    }
  }

  /**
   * Obtém long/short ratio
   */
  public async getLongShortRatio(
    symbol: string,
    period: string = '5m',
    limit: number = 30
  ): Promise<BinanceLongShortRatio[]> {
    // Usa base URL de Futuros
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    
    const params = { symbol, period, limit };
    
    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kronos-X-Engine/1.0.0'
      }
    });
    
    // Endpoint correto: /futures/data/globalLongShortAccountRatio
    try {
      const response = await axiosInstance.get('/futures/data/globalLongShortAccountRatio', { params });
      const arr = Array.isArray(response.data) ? response.data : [];
      if (arr.length > 0) {
        const last = arr[arr.length - 1];
        return [{
          symbol: symbol,
          longShortRatio: (last.longShortRatio || '0.5'),
          longAccount: last.longAccount || '0',
          shortAccount: last.shortAccount || '0',
          timestamp: parseInt(last.timestamp || Date.now().toString())
        }];
      }
      return [{ symbol: symbol, longShortRatio: '0.5', longAccount: '0', shortAccount: '0', timestamp: Date.now() }];
    } catch (error) {
      console.warn('⚠️ Erro ao buscar Long/Short ratio, retornando neutro:', error);
      // Retorna neutro em caso de erro
      return [{
        symbol: symbol,
        longShortRatio: '0.5',
        longAccount: '0',
        shortAccount: '0',
        timestamp: Date.now()
      }];
    }
  }

  /**
   * Obtém posições abertas de Futuros
   */
  public async getFuturesPositions(): Promise<any[]> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para acessar posições de Futuros');
    }

    // Usa base URL de Futuros
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    const params = this.addAuthParams();

    // Monta URL manualmente para preservar ordem da assinatura
    const finalQuery = this.buildSignedQuery(params);
    const url = `/fapi/v2/positionRisk?${finalQuery}`;

    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });

    const response = await axiosInstance.request({ method: 'GET', url, data: undefined });
    return response.data;
  }

  /**
   * Obtém informações da conta de Futuros
   */
  public async getFuturesFundingRate(symbol: string): Promise<any> {
    try {
      const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
      
      const axiosInstance = axios.create({
        baseURL: futuresBaseUrl,
        timeout: this.httpClient.defaults.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0'
        }
      });
      
      const timestamp = Date.now();
      const params = `symbol=${symbol}&timestamp=${timestamp}`;
      const signature = CryptoUtils.generateSignature(params, this.secretKey);
      const url = `/fapi/v1/premiumIndex?${params}&signature=${signature}`;
      
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      console.error('Error getting funding rate:', error);
      return { lastFundingRate: '0' };
    }
  }
  
  public async getFuturesAccountInfo(): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para acessar informações da conta de Futuros');
    }

    // Usa base URL de Futuros
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    const params = this.addAuthParams();

    const finalQuery = this.buildSignedQuery(params);
    const url = `/fapi/v2/account?${finalQuery}`;

    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });

    const response = await axiosInstance.request({ method: 'GET', url, data: undefined });
    return response.data;
  }

  /**
   * Obtém exchangeInfo de Futuros
   */
  public async getFuturesExchangeInfo(): Promise<{ symbols: any[] }> {
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kronos-X-Engine/1.0.0'
      }
    });
    const response = await axiosInstance.get('/fapi/v1/exchangeInfo');
    return response.data;
  }

  /**
   * Obtém informações de símbolo específico em Futuros
   */
  public async getFuturesSymbolInfo(symbol: string): Promise<any | null> {
    try {
      const info = await this.getFuturesExchangeInfo();
      return info.symbols.find((s: any) => s.symbol === symbol) || null;
    } catch (e) {
      this.logger.error(SystemAction.DataProcessing, `Erro ao obter exchangeInfo Futures para ${symbol}`, e as Error);
      return null;
    }
  }

  /**
   * Define alavancagem para um símbolo em Futuros (USDT-M)
   */
  public async setFuturesLeverage(symbol: string, leverage: number): Promise<any> {
    if (!this.apiKey || !this.secretKey) throw new Error('API Key e Secret Key são obrigatórios');
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    const params = this.addAuthParams({ symbol, leverage });
    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });
    const response = await axiosInstance.post('/fapi/v1/leverage', undefined, { params });
    return response.data;
  }

  /**
   * Define tipo de margem (ISOLATED/CROSSED) para um símbolo em Futuros
   */
  public async setFuturesMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<any> {
    if (!this.apiKey || !this.secretKey) throw new Error('API Key e Secret Key são obrigatórios');
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    const params = this.addAuthParams({ symbol, marginType });
    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });
    try {
      const response = await axiosInstance.post('/fapi/v1/marginType', undefined, { params });
      return response.data;
    } catch (e: any) {
      // Se já estiver configurado, Binance pode retornar erro específico; ignorar
      this.logger.debug(SystemAction.ErrorHandling, 'setFuturesMarginType retorno', e as Error);
      return null;
    }
  }

  /**
   * ✅ NOVO: Fecha posição em Futures de forma ROBUSTA (ChatGPT recommended)
   * SEM depender de getCurrentPrice, SEM falhar por rate limit
   */
  public async closeFuturesPosition(symbol: string): Promise<any> {
    if (!this.apiKey || !this.secretKey) throw new Error('API Key e Secret Key são obrigatórios');
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });
    
    console.log(`\n🔐 FECHAMENTO ROBUSTO: Iniciando close para ${symbol}`);
    
    // 1. Verificar dual-side mode (Futures API)
    let dualSidePosition = false;
    try {
      const timestamp = Math.floor(Date.now() + this.timeOffsetMs);
      const paramsArray: [string, string][] = [
        ['recvWindow', this.recvWindowDefault.toString()],
        ['timestamp', timestamp.toString()]
      ];
      const queryString = paramsArray
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
      const finalQuery = `${queryString}&signature=${signature}`;
      
      const dualRes = await axiosInstance.get(`/fapi/v1/positionSide/dual?${finalQuery}`);
      dualSidePosition = dualRes.data.dualSidePosition === true;
      console.log(`   ✅ Dual-side mode: ${dualSidePosition}`);
    } catch (e) {
      console.warn('⚠️ Não foi possível verificar dual-side mode, assumindo false (One-Way Mode)');
      // Em One-Way Mode, não precisa positionSide
    }
    
    // 2. Ler posição atual (com assinatura correta)
    const posTimestamp = Math.floor(Date.now() + this.timeOffsetMs);
    const posParamsArray: [string, string][] = [
      ['recvWindow', this.recvWindowDefault.toString()],
      ['symbol', symbol],
      ['timestamp', posTimestamp.toString()]
    ];
    const posQueryString = posParamsArray
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const posSignature = CryptoUtils.generateSignature(posQueryString, this.secretKey);
    const posFinalQuery = `${posQueryString}&signature=${posSignature}`;
    
    const posRes = await axiosInstance.get(`/fapi/v2/positionRisk?${posFinalQuery}`);
    const positions = Array.isArray(posRes.data) ? posRes.data : [];
    const position = positions.find((p: any) => Number(p.positionAmt) !== 0);
    
    if (!position) {
      console.log(`⚠️ Nenhuma posição encontrada para ${symbol}`);
      return null;
    }
    
    const positionAmt = Number(position.positionAmt);
    const side = positionAmt > 0 ? 'SELL' : 'BUY';
    const qtyRaw = Math.abs(positionAmt);
    
    console.log(`   Posição atual: ${positionAmt} (${qtyRaw} unidades)`);
    console.log(`   Lado: ${side}`);
    
    // 3. Obter stepSize/LOT_SIZE
    const fInfo = await this.getFuturesSymbolInfo(symbol);
    if (!fInfo) throw new Error(`Símbolo ${symbol} não encontrado em Futures`);
    
    const lotFilter = fInfo.filters.find((f: any) => 
      f.filterType === 'MARKET_LOT_SIZE' || f.filterType === 'LOT_SIZE'
    );
    const stepSize = parseFloat(lotFilter?.stepSize || '0.01');
    
    // Função para calcular precisão
    const stepToPrecision = (step: number): number => {
      const s = step.toString();
      return s.includes('.') ? s.split('.')[1].length : 0;
    };
    
    // Arredondar quantidade
    const qty = Math.floor(qtyRaw / stepSize) * stepSize;
    const precision = stepToPrecision(stepSize);
    const qtyFixed = qty.toFixed(precision);
    
    console.log(`   Quantidade final: ${qtyFixed} (stepSize: ${stepSize}, precision: ${precision})`);
    
    // 4. Montar ordem de fechamento (alfabeticamente ordenado para assinatura)
    const timestamp = Math.floor(Date.now() + this.timeOffsetMs);
    
    // ✅ MONTAR TODOS OS PARÂMETROS QUE VÃO NA ORDEM
    const paramsArray: [string, string][] = [
      ['quantity', qtyFixed],
      ['recvWindow', this.recvWindowDefault.toString()],
      ['reduceOnly', 'true'],  // ✅ CRÍTICO: Nunca bloqueado por rate limit
      ['side', side],           // ✅ SELL para fechar long, BUY para fechar short
      ['symbol', symbol],
      ['timestamp', timestamp.toString()],
      ['type', 'MARKET']
    ];
    
    // Adicionar positionSide se dual-side mode
    if (dualSidePosition) {
      const posSide = positionAmt > 0 ? 'LONG' : 'SHORT';
      paramsArray.push(['positionSide', posSide]);
      console.log(`   positionSide: ${posSide} (dual-side mode)`);
    }
    
    // 5. Construir query string ORDENADA ALFABETICAMENTE
    // ✅ CRÍTICO: Todos os campos devem estar aqui ANTES de assinar
    const queryString = paramsArray
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    
    console.log(`\n   🔐 DEBUG CLOSE - Query string completa ANTES de assinar:`);
    console.log(`      ${queryString.substring(0, 100)}... (${queryString.length} chars)`);
    
    // 6. Gerar assinatura (do query completo!)
    const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
    const finalQuery = `${queryString}&signature=${signature}`;
    
    console.log(`   ✅ Assinatura HMAC gerada (64 chars)`);
    
    // 7. Enviar como application/x-www-form-urlencoded (NÃO JSON!)
    // ✅ ChatGPT recomendou: usar form-urlencoded, não JSON
    const url = `/fapi/v1/order`;
    const response = await axiosInstance.post(url, finalQuery, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log(`✅ Posição ${symbol} FECHADA com sucesso!`);
    console.log(`   Order ID: ${response.data.orderId}`);
    console.log(`   Status: ${response.data.status}`);
    
    return response.data;
  }

  /**
   * Cria ordem em Futuros (USDT-M)
   */
  public async createFuturesOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'MARKET' | 'LIMIT',
    quantity: number,
    price?: number,
    positionSide?: 'LONG' | 'SHORT',
    timeInForce?: 'GTC' | 'IOC' | 'FOK'
  ): Promise<any> {
    if (!this.apiKey || !this.secretKey) throw new Error('API Key e Secret Key são obrigatórios');
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');

    // Montar params na ordem alfabética para assinatura consistente
    // Ajustar quantidade para stepSize de FUTUROS
    try {
      const fInfo = await this.getFuturesSymbolInfo(symbol);
      // Preferir MARKET_LOT_SIZE para MARKET orders; fallback LOT_SIZE
      const marketLot = fInfo?.filters?.find((f: any) => f.filterType === 'MARKET_LOT_SIZE');
      const lot = marketLot || fInfo?.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
      const stepStr = lot?.stepSize || fInfo?.quantityPrecision != null ? (1 / Math.pow(10, fInfo.quantityPrecision)).toString() : undefined;
      if (stepStr) {
        const step = parseFloat(stepStr);
        const decimals = Math.max(0, Math.round(Math.abs(Math.log10(step))));
        // floor to step
        const floored = Math.floor(quantity / step) * step;
        let adjusted = parseFloat(floored.toFixed(decimals));
        // garantir minQty
        const minQty = lot?.minQty ? parseFloat(lot.minQty) : 0;
        if (minQty > 0 && adjusted < minQty) adjusted = minQty;
        // aplicar quantityPrecision se existir
        if (typeof fInfo?.quantityPrecision === 'number') {
          adjusted = parseFloat(adjusted.toFixed(fInfo.quantityPrecision));
        }
        if (adjusted <= 0) adjusted = step;
        quantity = adjusted;
        console.log(`🔧 FUTURES qty ajustada: ${quantity} (step=${step}, minQty=${minQty || 'n/a'}, precision=${fInfo?.quantityPrecision ?? 'n/a'})`);
      }
    } catch {}

    const timestamp = Math.floor(Date.now() + this.timeOffsetMs);
    const paramsArray: [string, string][] = [
      ['quantity', quantity.toString()],
      ['recvWindow', this.recvWindowDefault.toString()],
      ['side', side],
      ['symbol', symbol],
      ['timestamp', timestamp.toString()],
      ['type', type]
    ];
    if (price && type === 'LIMIT') {
      paramsArray.push(['price', price.toString()]);
      paramsArray.push(['timeInForce', timeInForce || 'GTC']);
    }
    if (positionSide) paramsArray.push(['positionSide', positionSide]);

    const queryString = paramsArray
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
    const finalQuery = `${queryString}&signature=${signature}`;

    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });

    const url = `/fapi/v1/order?${finalQuery}`;
    const response = await axiosInstance.request({ method: 'POST', url, data: undefined });
    return response.data;
  }

  /**
   * Cria ordem de Stop Loss na Binance Futures
   */
  public async createFuturesStopLoss(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    stopPrice: number
  ): Promise<any> {
    if (!this.apiKey || !this.secretKey) throw new Error('API Key e Secret Key são obrigatórios');
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');

    // ✅ CORREÇÃO: Ajustar precisão do stopPrice baseado no tickSize e pricePrecision
    let adjustedStopPrice = stopPrice;
    try {
      const symbolInfo = await this.getFuturesSymbolInfo(symbol);
      if (symbolInfo) {
        const priceFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');
        
        if (priceFilter?.tickSize) {
          const tickSize = parseFloat(priceFilter.tickSize);
          // Usar Math.round para melhor precisão
          const roundedToTick = Math.round(stopPrice / tickSize) * tickSize;
          
          // Calcular número de casas decimais baseado no tickSize
          const tickSizeStr = tickSize.toString();
          let decimalPlaces = 0;
          if (tickSizeStr.includes('.')) {
            decimalPlaces = tickSizeStr.split('.')[1].length;
          } else if (tickSizeStr.includes('e-')) {
            // Para notação científica como 1e-8
            decimalPlaces = Math.abs(parseInt(tickSizeStr.split('e-')[1]));
          }
          
          // Arredondar para o número correto de casas decimais
          adjustedStopPrice = parseFloat(roundedToTick.toFixed(decimalPlaces));
          
          // Usar pricePrecision se disponível (mais confiável)
          if (symbolInfo.pricePrecision !== undefined && symbolInfo.pricePrecision !== null) {
            adjustedStopPrice = parseFloat(adjustedStopPrice.toFixed(symbolInfo.pricePrecision));
          }
        } else if (symbolInfo.pricePrecision !== undefined && symbolInfo.pricePrecision !== null) {
          // Fallback: usar pricePrecision se tickSize não estiver disponível
          adjustedStopPrice = parseFloat(stopPrice.toFixed(symbolInfo.pricePrecision));
        }
      }
      const tickSizeInfo = symbolInfo?.filters?.find((f: any) => f.filterType === 'PRICE_FILTER')?.tickSize || 'n/a';
      console.log(`🔧 Stop Price ajustado: ${stopPrice} → ${adjustedStopPrice} (tick=${tickSizeInfo}, precision=${symbolInfo?.pricePrecision ?? 'n/a'})`);
    } catch (error) {
      console.warn(`⚠️ Não foi possível buscar precisão para ${symbol}, usando valor original:`, error);
      // Fallback: arredondar para 2 casas decimais (padrão para maioria dos pares)
      adjustedStopPrice = parseFloat(stopPrice.toFixed(2));
    }

    const timestamp = Math.floor(Date.now() + this.timeOffsetMs);
    const paramsArray: [string, string][] = [
      ['closePosition', 'true'],  // Fechar a posição inteira
      ['recvWindow', this.recvWindowDefault.toString()],
      ['side', side === 'BUY' ? 'SELL' : 'BUY'],  // Stop Loss é o oposto da posição
      ['stopPrice', adjustedStopPrice.toString()],
      ['symbol', symbol],
      ['timestamp', timestamp.toString()],
      ['type', 'STOP_MARKET']
    ];

    const queryString = paramsArray
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
    const finalQuery = `${queryString}&signature=${signature}`;

    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });

    const url = `/fapi/v1/order?${finalQuery}`;
    const response = await axiosInstance.request({ method: 'POST', url, data: undefined });
    console.log(`🛡️ Stop Loss criado na Binance para ${symbol} @ ${stopPrice}`);
    return response.data;
  }

  /**
   * Cria ordem de Take Profit na Binance Futures
   */
  public async createFuturesTakeProfit(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    takeProfitPrice: number
  ): Promise<any> {
    if (!this.apiKey || !this.secretKey) throw new Error('API Key e Secret Key são obrigatórios');
    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');

    // ✅ CORREÇÃO: Ajustar precisão do takeProfitPrice baseado no tickSize e pricePrecision
    let adjustedTakeProfitPrice = takeProfitPrice;
    try {
      const symbolInfo = await this.getFuturesSymbolInfo(symbol);
      if (symbolInfo) {
        const priceFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');
        
        if (priceFilter?.tickSize) {
          const tickSize = parseFloat(priceFilter.tickSize);
          // Usar Math.round para melhor precisão
          const roundedToTick = Math.round(takeProfitPrice / tickSize) * tickSize;
          
          // Calcular número de casas decimais baseado no tickSize
          const tickSizeStr = tickSize.toString();
          let decimalPlaces = 0;
          if (tickSizeStr.includes('.')) {
            decimalPlaces = tickSizeStr.split('.')[1].length;
          } else if (tickSizeStr.includes('e-')) {
            // Para notação científica como 1e-8
            decimalPlaces = Math.abs(parseInt(tickSizeStr.split('e-')[1]));
          }
          
          // Arredondar para o número correto de casas decimais
          adjustedTakeProfitPrice = parseFloat(roundedToTick.toFixed(decimalPlaces));
          
          // Usar pricePrecision se disponível (mais confiável)
          if (symbolInfo.pricePrecision !== undefined && symbolInfo.pricePrecision !== null) {
            adjustedTakeProfitPrice = parseFloat(adjustedTakeProfitPrice.toFixed(symbolInfo.pricePrecision));
          }
        } else if (symbolInfo.pricePrecision !== undefined && symbolInfo.pricePrecision !== null) {
          // Fallback: usar pricePrecision se tickSize não estiver disponível
          adjustedTakeProfitPrice = parseFloat(takeProfitPrice.toFixed(symbolInfo.pricePrecision));
        }
      }
      const tickSizeInfo = symbolInfo?.filters?.find((f: any) => f.filterType === 'PRICE_FILTER')?.tickSize || 'n/a';
      console.log(`🔧 Take Profit Price ajustado: ${takeProfitPrice} → ${adjustedTakeProfitPrice} (tick=${tickSizeInfo}, precision=${symbolInfo?.pricePrecision ?? 'n/a'})`);
    } catch (error) {
      console.warn(`⚠️ Não foi possível buscar precisão para ${symbol}, usando valor original:`, error);
      // Fallback: arredondar para 2 casas decimais (padrão para maioria dos pares)
      adjustedTakeProfitPrice = parseFloat(takeProfitPrice.toFixed(2));
    }

    const timestamp = Math.floor(Date.now() + this.timeOffsetMs);
    const paramsArray: [string, string][] = [
      ['closePosition', 'true'],  // Fechar a posição inteira
      ['recvWindow', this.recvWindowDefault.toString()],
      ['side', side === 'BUY' ? 'SELL' : 'BUY'],  // Take Profit é o oposto da posição
      ['stopPrice', adjustedTakeProfitPrice.toString()],
      ['symbol', symbol],
      ['timestamp', timestamp.toString()],
      ['type', 'TAKE_PROFIT_MARKET']
    ];

    const queryString = paramsArray
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
    const finalQuery = `${queryString}&signature=${signature}`;

    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });

    const url = `/fapi/v1/order?${finalQuery}`;
    const response = await axiosInstance.request({ method: 'POST', url, data: undefined });
    console.log(`🎯 Take Profit criado na Binance para ${symbol} @ ${takeProfitPrice}`);
    return response.data;
  }

  /**
   * Transfere fundos Spot -> USDT-M Futures (direction type=1)
   */
  public async transferSpotToFutures(asset: string, amount: number): Promise<any> {
    if (!this.apiKey || !this.secretKey) throw new Error('API Key e Secret Key são obrigatórios');
    // SAPI usa api.binance.com
    const params = this.addAuthParams({ asset, amount: amount.toString(), type: 1 });
    const response = await this.httpClient.post('/sapi/v1/asset/transfer', undefined, { params, headers: { 'X-MBX-APIKEY': this.apiKey } });
    return response.data;
  }

  // ============================================================================
  // ENDPOINTS AUTENTICADOS (REQUER API KEY)
  // ============================================================================

  /**
   * Obtém informações da conta
   */
  public async getAccountInfo(): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para acessar informações da conta');
    }

    const params = this.addAuthParams();
    // Usa GET assinado com URL manual para evitar -1022
    return this.getSigned<any>('/api/v3/account', params);
  }

  /**
   * Obtém saldo da conta
   */
  public async getAccountBalance(): Promise<any[]> {
    const accountInfo = await this.getAccountInfo();
    return accountInfo.balances;
  }

  /**
   * Obtém ordens abertas
   */
  public async getOpenOrders(symbol?: string): Promise<any[]> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para acessar ordens');
    }

    const params: Record<string, any> = {};
    if (symbol) params.symbol = symbol;
    
    const authParams = this.addAuthParams(params);
    return this.getSigned<any[]>('/api/v3/openOrders', authParams);
  }

  /**
   * ✅ Busca ordens abertas em Futures
   */
  public async getFuturesOpenOrders(symbol?: string): Promise<any[]> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para acessar ordens');
    }

    const futuresBaseUrl = this.baseUrl.replace('api.binance.com', 'fapi.binance.com');
    const params: Record<string, any> = {};
    if (symbol) params.symbol = symbol;
    
    const timestamp = Math.floor(Date.now() + this.timeOffsetMs);
    const paramsArray: [string, string][] = [
      ['recvWindow', this.recvWindowDefault.toString()],
      ['timestamp', timestamp.toString()]
    ];
    
    if (symbol) {
      paramsArray.push(['symbol', symbol]);
    }
    
    const queryString = paramsArray
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    
    const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
    const finalQuery = `${queryString}&signature=${signature}`;

    const axiosInstance = axios.create({
      baseURL: futuresBaseUrl,
      timeout: this.httpClient.defaults.timeout,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });

    const response = await axiosInstance.get(`/fapi/v1/openOrders?${finalQuery}`);
    return response.data;
  }

  /**
   * Obtém histórico de ordens
   */
  public async getOrderHistory(
    symbol: string,
    limit: number = 500,
    startTime?: number,
    endTime?: number
  ): Promise<any[]> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para acessar histórico de ordens');
    }

    const params: Record<string, any> = { symbol, limit };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    const authParams = this.addAuthParams(params);
    return this.getSigned<any[]>('/api/v3/allOrders', authParams);
  }

  /**
   * Ajusta quantidade conforme filtros LOT_SIZE
   */
  private adjustQuantityForLotSize(quantity: number, stepSize: string): string {
    const step = parseFloat(stepSize);
    // Arredonda para o step size correto (floor para baixo)
    let adjusted = Math.floor(quantity / step) * step;
    
    // Se resultar em 0, usa o step size como mínimo
    if (adjusted <= 0) {
      adjusted = step;
    }
    
    // Ajusta precisão baseada no step size
    const decimals = Math.abs(Math.log10(step));
    const result = adjusted.toFixed(decimals);
    
    return parseFloat(result).toString(); // Remove zeros desnecessários
  }

  /**
   * Cria nova ordem com tratamento de erro 5XX
   * CORRIGIDO: Monta query string manualmente para garantir ordem correta
   */
  public async createOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'MARKET' | 'LIMIT',
    quantity: number,
    price?: number,
    timeInForce?: 'GTC' | 'IOC' | 'FOK'
  ): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para criar ordens');
    }

    // Buscar informações do símbolo para ajustar quantidade conforme filtros
    console.log(`\n🔍 DEBUG: Ajustando quantidade para ${symbol}: quantity=${quantity}`);
    try {
      const symbolInfo = await this.getSymbolInfo(symbol);
      console.log(`🔍 DEBUG: SymbolInfo encontrado: ${symbolInfo ? 'SIM' : 'NÃO'}`);
      let lotSizeFilter: any | undefined;
      let minNotionalFilter: any | undefined;
      let notionalFilter: any | undefined;
      if (symbolInfo) {
        lotSizeFilter = symbolInfo.filters.find(f => (f as any).filterType === 'LOT_SIZE' || f.filter_type === 'LOT_SIZE');
        // Suporta filtros antigos e novos: MIN_NOTIONAL e NOTIONAL
        minNotionalFilter = symbolInfo.filters.find(f => (f as any).filterType === 'MIN_NOTIONAL' || (f as any).filter_type === 'MIN_NOTIONAL');
        notionalFilter = symbolInfo.filters.find(f => (f as any).filterType === 'NOTIONAL' || (f as any).filter_type === 'NOTIONAL');
        console.log(`🔍 DEBUG: LOT_SIZE filter: ${lotSizeFilter ? 'SIM' : 'NÃO'}`);
        console.log(`🔍 DEBUG: MIN_NOTIONAL filter: ${minNotionalFilter ? `SIM (min: ${minNotionalFilter.minNotional})` : 'NÃO'}`);
        console.log(`🔍 DEBUG: NOTIONAL filter: ${notionalFilter ? 'SIM' : 'NÃO'}`);
        
        if (lotSizeFilter && lotSizeFilter.stepSize) {
          const minQty = lotSizeFilter.minQty ? parseFloat(lotSizeFilter.minQty) : 0;
          
          // Se quantidade é menor que mínimo, usa mínimo
          if (quantity < minQty) {
            console.log(`⚠️ Quantidade ${quantity} menor que mínimo ${minQty}, usando mínimo`);
            quantity = minQty;
          }
          
          const adjustedQtyStr = this.adjustQuantityForLotSize(quantity, lotSizeFilter.stepSize);
          const adjustedQty = parseFloat(adjustedQtyStr);
          
          // Garantir que não ficou menor que mínimo
          if (minQty > 0 && adjustedQty < minQty) {
            console.log(`⚠️ Quantidade ajustada ${adjustedQty} menor que mínimo ${minQty}, usando mínimo`);
            quantity = minQty;
          } else {
            quantity = adjustedQty;
            console.log(`🔧 Ajustando quantidade para ${adjustedQty} (stepSize: ${lotSizeFilter.stepSize}, minQty: ${minQty})`);
          }
        }
      }
      
      // Buscar preço atual (antes para permitir fallback de notional baseado em preço)
      const priceData = await this.getPrice(symbol);
      const currentPrice = parseFloat(priceData.price);

      // ✅ Determinar notional mínimo (suporta MIN_NOTIONAL e NOTIONAL). Fallback: minQty*price
      let effectiveMinNotional: number | null = null;
      const rawMinNotional = minNotionalFilter?.minNotional ?? (notionalFilter?.minNotional ?? (notionalFilter as any)?.notional);
      if (rawMinNotional) {
        effectiveMinNotional = parseFloat(rawMinNotional);
      } else if (lotSizeFilter?.minQty) {
        const fallback = parseFloat(lotSizeFilter.minQty) * currentPrice;
        effectiveMinNotional = fallback;
        console.log(`⚠️ DEBUG: MIN_NOTIONAL ausente. Usando fallback minQty(${lotSizeFilter.minQty})*price($${currentPrice}) = $${fallback.toFixed(2)}`);
      }
      const minNotional = Math.max(0, effectiveMinNotional || 0);
      console.log(`🔍 DEBUG: MIN_NOTIONAL efetivo: $${minNotional}`);
      
      // Calcular valor da ordem (quantity * price)
      const orderValue = quantity * currentPrice;
      
      console.log(`🔍 Verificando NOTIONAL: quantidade=${quantity}, price=$${currentPrice}, valor=$${orderValue.toFixed(2)}, mínimo=$${minNotional}`);
      
      // Se valor está abaixo do mínimo, ajustar quantity
      if (orderValue < minNotional) {
        const requiredQty = minNotional / currentPrice;
        
        console.log(`⚠️ Valor da ordem ($${orderValue.toFixed(2)}) abaixo do mínimo ($${minNotional})`);
        
        // Ajustar para stepSize e garantir que seja SEMPRE >= minNotional
        if (lotSizeFilter && lotSizeFilter.stepSize) {
          let newQty = this.adjustQuantityForLotSize(requiredQty, lotSizeFilter.stepSize);
          let newValue = parseFloat(newQty) * currentPrice;
          
          // Se ainda estiver abaixo, adicionar stepSize até atingir
          const stepSize = parseFloat(lotSizeFilter.stepSize);
          while (newValue < minNotional) {
            newQty = (parseFloat(newQty) + stepSize).toFixed(8);
            newValue = parseFloat(newQty) * currentPrice;
          }
          
          console.log(`🔧 Ajustando quantidade de ${quantity} para ${newQty} (novo valor: $${newValue.toFixed(2)})`);
          quantity = parseFloat(newQty);
        } else {
          let newQty = Math.ceil(requiredQty * 100) / 100;
          let newValue = newQty * currentPrice;
          
          // Se ainda estiver abaixo, incrementar
          while (newValue < minNotional) {
            newQty += 0.01;
            newValue = newQty * currentPrice;
          }
          
          console.log(`🔧 Ajustando quantidade de ${quantity} para ${newQty.toFixed(2)} (novo valor: $${newValue.toFixed(2)})`);
          quantity = newQty;
        }
      } else {
        console.log(`✅ Valor da ordem ($${orderValue.toFixed(2)}) atende ao mínimo ($${minNotional})`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar exchange info:', error);
      throw new Error(`Não foi possível ajustar quantidade para ${symbol}. Erro: ${(error as Error).message}`);
    }

    try {
      // ✅ SOLUÇÃO: Montar query string MANUALMENTE na ordem correta
      const timestamp = Date.now();
      const recvWindow = 5000; // 5 segundos de margem
      
      // Parâmetros na ORDEM CORRETA (alfabética)
      const paramsArray = [
        ['quantity', quantity.toString()],
        ['recvWindow', recvWindow.toString()],
        ['side', side],
        ['symbol', symbol],
        ['timestamp', timestamp.toString()],
        ['type', type]
      ];
      
      // Adicionar price e timeInForce se for LIMIT
      if (type === 'LIMIT' && price) {
        paramsArray.push(['price', price.toString()]);
        paramsArray.push(['timeInForce', timeInForce || 'GTC']);
      }
      
      // Montar query string (na ordem correta)
      const queryString = paramsArray
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      
      // Gerar assinatura
      const signature = CryptoUtils.generateSignature(queryString, this.secretKey);
      
      // Query final com signature (sempre por último)
      const finalQuery = `${queryString}&signature=${signature}`;
      
      // Fazer requisição diretamente com a query string completa
      const url = `/api/v3/order?${finalQuery}`;
      
      const response = await this.httpClient.request({
        method: 'POST',
        url: url,
        data: undefined, // SEM body
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      });
      
      return response.data;
      
    } catch (error: any) {
      // Tratamento de erro 5XX (ordem em estado DESCONHECIDO)
      if (error.response?.status >= 500 && error.response?.status < 600) {
        this.logger.error(
          SystemAction.TradeExecution,
          `⚠️ Erro 5XX ao criar ordem - Estado DESCONHECIDO`,
          error,
          { symbol, side, quantity }
        );
        
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('⚠️ ERRO 5XX: Ordem em estado DESCONHECIDO');
        console.error(`📊 Símbolo: ${symbol}`);
        console.error(`📊 Tipo: ${side} ${type}`);
        console.error(`📊 Quantidade: ${quantity}`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('AÇÃO: Verificando status da ordem...');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Tenta consultar se a ordem foi criada
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const origClientOrderId = this.generateClientOrderId(symbol);
          console.log(`🔍 Consultando status da ordem...`);
          const orderStatus = await this.verifyOrderAfterError(symbol, origClientOrderId);
          
          if (orderStatus) {
            console.log(`✅ Ordem encontrada! Status: ${orderStatus.status}`);
            return {
              ...orderStatus,
              _verified: true,
              _note: 'Orden verificada após erro 5XX'
            };
          }
        } catch (verifyError: any) {
          console.error('❌ Não foi possível verificar status da ordem');
          console.error('   ⚠️ CONSELHO: Consultar manualmente em binance.com');
        }
        
        throw new Error('ORDEM_DESCONHECIDA - Erro 5XX. A ordem pode ter sido executada. Verificar manualmente.');
      }
      
      throw error;
    }
  }

  /**
   * Gera client order ID único
   */
  private generateClientOrderId(symbol: string): string {
    return `${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verifica status de ordem após erro 5XX
   */
  private async verifyOrderAfterError(symbol: string, origClientOrderId: string): Promise<any | null> {
    try {
      const order = await this.getOrderStatus(symbol, undefined, origClientOrderId);
      return order;
    } catch (error) {
      // Ordem não encontrada ou outro erro
      return null;
    }
  }

  /**
   * Testa ordem (valida sem executar)
   */
  public async testOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'MARKET' | 'LIMIT',
    quantity: number,
    price?: number,
    timeInForce?: 'GTC' | 'IOC' | 'FOK'
  ): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para testar ordens');
    }

    const params: Record<string, any> = {
      symbol,
      side,
      type,
      quantity: quantity.toString()
    };

    if (type === 'LIMIT' && price) {
      params.price = price.toString();
      params.timeInForce = timeInForce || 'GTC';
    }

    const authParams = this.addAuthParams(params);
    return this.post<any>('/api/v3/order/test', authParams);
  }

  /**
   * Cancela ordem
   */
  public async cancelOrder(symbol: string, orderId: number): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para cancelar ordens');
    }

    const params = this.addAuthParams({ symbol, orderId });
    return this.delete<any>('/api/v3/order', params);
  }
  
  /**
   * Cancela ordem por origClientOrderId
   */
  public async cancelOrderByClientOrderId(symbol: string, origClientOrderId: string): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para cancelar ordens');
    }

    const params = this.addAuthParams({ symbol, origClientOrderId });
    return this.delete<any>('/api/v3/order', params);
  }

  /**
   * Cancela e substitui ordem
   */
  public async cancelReplaceOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'MARKET' | 'LIMIT',
    quantity: number,
    cancelReplaceMode: 'STOP_ON_FAILURE' | 'ALLOW_FAILURE',
    price?: number
  ): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para cancelar/substituir ordens');
    }

    const params: Record<string, any> = {
      symbol,
      side,
      type,
      quantity: quantity.toString(),
      cancelReplaceMode
    };

    if (type === 'LIMIT' && price) {
      params.price = price.toString();
    }

    const authParams = this.addAuthParams(params);
    return this.post<any>('/api/v3/order/cancelReplace', authParams);
  }

  /**
   * Consulta status de uma ordem específica
   */
  public async getOrderStatus(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para consultar status de ordem');
    }

    const params: Record<string, any> = { symbol };
    if (orderId) params.orderId = orderId;
    if (origClientOrderId) params.origClientOrderId = origClientOrderId;

    const authParams = this.addAuthParams(params);
    return this.get<any>('/api/v3/order', authParams);
  }

  /**
   * Obtém trades executados da conta
   */
  public async getMyTrades(
    symbol: string,
    fromOrderId?: number,
    startTime?: number,
    endTime?: number,
    limit: number = 500
  ): Promise<any[]> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para consultar trades da conta');
    }

    const params: Record<string, any> = { symbol, limit };
    if (fromOrderId) params.fromOrderId = fromOrderId;
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    const authParams = this.addAuthParams(params);
    return this.get<any[]>('/api/v3/myTrades', authParams);
  }

  /**
   * Obtém informações de rate limit de ordens
   */
  public async getOrderRateLimit(): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para consultar rate limit');
    }

    const authParams = this.addAuthParams();
    return this.get<any>('/api/v3/rateLimit/order', authParams);
  }

  /**
   * Cancela todas as ordens de um símbolo
   */
  public async cancelAllOrders(symbol: string): Promise<any> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('API Key e Secret Key são obrigatórios para cancelar ordens');
    }

    const params = this.addAuthParams({ symbol });
    return this.delete<any>('/api/v3/openOrders', params);
  }

  // ============================================================================
  // USER DATA STREAM
  // ============================================================================

  /**
   * Cria user data stream
   */
  public async createUserDataStream(): Promise<{ listenKey: string }> {
    if (!this.apiKey) {
      throw new Error('API Key é obrigatória para criar user data stream');
    }

    return this.post<{ listenKey: string }>('/api/v3/userDataStream');
  }

  /**
   * Mantém user data stream ativo
   */
  public async keepAliveUserDataStream(listenKey: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('API Key é obrigatória para manter user data stream');
    }

    await this.put('/api/v3/userDataStream', { listenKey });
  }

  /**
   * Fecha user data stream
   */
  public async closeUserDataStream(listenKey: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('API Key é obrigatória para fechar user data stream');
    }

    await this.delete('/api/v3/userDataStream', { listenKey });
  }

  /**
   * Faz requisição PUT
   */
  private async put<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.httpClient.put(endpoint, null, { params });
      return response.data;
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro na requisição PUT ${endpoint}`,
        error as Error,
        { params }
      );
      throw error;
    }
  }

  // ============================================================================
  // MÉTODOS DE ANÁLISE
  // ============================================================================

  /**
   * Analisa um símbolo específico
   */
  public async analyzeSymbol(symbol: string): Promise<any> {
    try {
      const [ticker, orderBook, recentTrades] = await Promise.all([
        this.get24hrTicker(symbol),
        this.getOrderBook(symbol, 20),
        this.getRecentTrades(symbol, 100)
      ]);

      // Calcula métricas básicas
      const priceChange = parseFloat(ticker.price_change);
      const priceChangePercent = parseFloat(ticker.price_change_percent);
      const volume = parseFloat(ticker.volume);
      const quoteVolume = parseFloat(ticker.quote_volume);

      // Calcula spread
      const bestBid = parseFloat(orderBook.bids[0]?.[0] || '0');
      const bestAsk = parseFloat(orderBook.asks[0]?.[0] || '0');
      const spread = bestAsk - bestBid;
      const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;

      // Analisa volume de trades recentes
      const avgTradeSize = recentTrades.reduce((sum, trade) => 
        sum + parseFloat(trade.qty), 0) / recentTrades.length;

      return {
        symbol,
        analysis: {
          price_metrics: {
            current_price: parseFloat(ticker.last_price),
            price_change_24h: priceChange,
            price_change_percent_24h: priceChangePercent,
            high_24h: parseFloat(ticker.high_price),
            low_24h: parseFloat(ticker.low_price),
            open_price: parseFloat(ticker.open_price),
            close_price: parseFloat(ticker.prev_close_price)
          },
          volume_metrics: {
            volume_24h: volume,
            quote_volume_24h: quoteVolume,
            avg_trade_size: avgTradeSize,
            trades_count_24h: ticker.count
          },
          liquidity_metrics: {
            best_bid: bestBid,
            best_ask: bestAsk,
            spread: spread,
            spread_percent: spreadPercent,
            bid_depth: orderBook.bids.length,
            ask_depth: orderBook.asks.length
          },
          market_metrics: {
            weighted_avg_price: parseFloat(ticker.weighted_avg_price),
            first_id: ticker.first_id,
            last_id: ticker.last_id,
            count: ticker.count
          }
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro ao analisar símbolo ${symbol}`,
        error as Error
      );
      throw error;
    }
  }

  /**
   * Analisa todos os símbolos configurados
   */
  public async analyzeAllSymbols(): Promise<any[]> {
    try {
      const config = getConfig();
      const symbols = config.getSymbols();
      
      this.logger.info(
        SystemAction.DataProcessing,
        `Iniciando análise de ${symbols.length} símbolos`,
        { symbols }
      );

      // Analisa símbolos em paralelo com limite
      const analyses = await PromiseUtils.parallelLimit(
        symbols.map(symbol => () => this.analyzeSymbol(symbol)),
        5 // Máximo 5 análises simultâneas
      );

      this.logger.info(
        SystemAction.DataProcessing,
        `Análise concluída para ${analyses.length} símbolos`
      );

      return analyses;
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        'Erro ao analisar todos os símbolos',
        error as Error
      );
      throw error;
    }
  }

  /**
   * Verifica conectividade com a API
   */
  public async checkConnectivity(): Promise<boolean> {
    try {
      await this.get('/api/v3/ping');
      return true;
    } catch (error) {
      this.logger.error(
        SystemAction.ErrorHandling,
        'Erro de conectividade com Binance API',
        error as Error
      );
      return false;
    }
  }

  /**
   * Compatibilidade com chamadas antigas
   */
  public async testConnectivity(): Promise<boolean> {
    return this.checkConnectivity();
  }

  /**
   * Obtém informações do servidor
   */
  public async getServerTime(): Promise<{ serverTime: number }> {
    return this.get<{ serverTime: number }>('/api/v3/time');
  }

  /**
   * Sincroniza o offset de tempo com o servidor Binance
   */
  private async syncServerTime(): Promise<void> {
    try {
      const localBefore = Date.now();
      const { serverTime } = await this.getServerTime();
      const localAfter = Date.now();
      // Estimar latência e ajustar offset pelo meio da janela
      const rtt = localAfter - localBefore;
      const estimatedServerAtMid = serverTime + rtt / 2;
      this.timeOffsetMs = Math.floor(estimatedServerAtMid - localAfter); // CRÍTICO: Math.floor para garantir inteiro
      this.lastTimeSyncMs = localAfter;
    } catch {
      // Ignora falha de sync; mantém offset anterior
    }
  }

  /**
   * Obtém estatísticas da API
   */
  public getApiStats(): any {
    return {
      base_url: this.baseUrl,
      testnet: this.testnet,
      has_api_key: !!this.apiKey,
      has_secret_key: !!this.secretKey,
      timeout: this.httpClient.defaults.timeout
    };
  }
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém instância do cliente Binance
 */
export function getBinanceClient(): BinanceApiClient {
  return BinanceApiClient.getInstance();
}

/**
 * Cria cliente Binance com configurações específicas
 */
export function createBinanceClient(baseUrl?: string, apiKey?: string, secretKey?: string): BinanceApiClient {
  return BinanceApiClient.getInstance(baseUrl, apiKey, secretKey);
}

/**
 * Verifica se as APIs estão funcionando
 */
export async function checkBinanceApis(): Promise<{ status: string; details: any }> {
  try {
    const client = getBinanceClient();
    const [connectivity, serverTime, exchangeInfo] = await Promise.all([
      client.checkConnectivity(),
      client.getServerTime(),
      client.getExchangeInfo()
    ]);

    return {
      status: 'healthy',
      details: {
        connectivity,
        server_time: serverTime.serverTime,
        symbols_count: exchangeInfo.symbols.length,
        api_stats: client.getApiStats()
      }
    };
  } catch (error) {
    return {
      status: 'error',
      details: {
        error: (error as Error).message,
        api_stats: getBinanceClient().getApiStats()
      }
    };
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default BinanceApiClient;

// Export instance for easy import
export const binanceApiClient = BinanceApiClient.getInstance();
