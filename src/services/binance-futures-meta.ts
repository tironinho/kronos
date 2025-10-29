import axios from 'axios';
import { logger, logBinance } from './logger';

export interface FuturesSymbolMeta {
  stepSize: number;
  minQty: number;
  minNotional: number;
  precision: number;
}

export interface FuturesPriceData {
  symbol: string;
  price: string;
  time: number;
}

export interface FuturesKlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
  ignore: string;
}

/**
 * ✅ CORREÇÃO CRÍTICA: Endpoints corretos para Futures USDⓈ-M
 * Problema: Estava usando /api/v3/ (Spot) em vez de /fapi/v1/ (Futures)
 */
export class BinanceFuturesMeta {
  private static cache = new Map<string, FuturesSymbolMeta>();
  private static cacheExpiry = new Map<string, number>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  /**
   * ✅ NOVO: Busca metadados corretos do símbolo em Futures
   */
  public static async fetchFuturesSymbolMeta(symbol: string): Promise<FuturesSymbolMeta> {
    try {
      // Verificar cache
      const cached = this.cache.get(symbol);
      const expiry = this.cacheExpiry.get(symbol);
      
      if (cached && expiry && Date.now() < expiry) {
        logBinance(`📋 Metadados em cache para ${symbol}`, { cached });
        return cached;
      }

      logBinance(`🔍 Buscando metadados FUTURES para ${symbol}...`);
      
      // ✅ CORREÇÃO: Usar endpoint correto para Futures
      const response = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo', {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0'
        }
      });

      const data = response.data;
      const symbolData = data.symbols.find((s: any) => s.symbol === symbol);
      
      if (!symbolData) {
        throw new Error(`Symbol ${symbol} not found on futures exchangeInfo`);
      }

      // ✅ CORREÇÃO: Buscar filtros corretos para Futures
      const lotSizeFilter = symbolData.filters.find((f: any) => f.filterType === 'LOT_SIZE');
      const notionalFilter = symbolData.filters.find((f: any) => f.filterType === 'NOTIONAL');
      const marketLotSizeFilter = symbolData.filters.find((f: any) => f.filterType === 'MARKET_LOT_SIZE');

      if (!lotSizeFilter) {
        throw new Error(`LOT_SIZE filter not found for ${symbol}`);
      }

      if (!notionalFilter) {
        throw new Error(`NOTIONAL filter not found for ${symbol}`);
      }

      const meta: FuturesSymbolMeta = {
        stepSize: parseFloat(lotSizeFilter.stepSize),
        minQty: parseFloat(lotSizeFilter.minQty),
        minNotional: parseFloat(notionalFilter.notional),
        precision: this.calculatePrecision(lotSizeFilter.stepSize)
      };

      // Cachear resultado
      this.cache.set(symbol, meta);
      this.cacheExpiry.set(symbol, Date.now() + this.CACHE_DURATION);

      logBinance(`✅ Metadados FUTURES obtidos para ${symbol}`, {
        stepSize: meta.stepSize,
        minQty: meta.minQty,
        minNotional: meta.minNotional,
        precision: meta.precision
      });

      return meta;
    } catch (error) {
      logger.error(`❌ Erro ao buscar metadados FUTURES para ${symbol}:`, 'BINANCE', null, error);
      throw error;
    }
  }

  /**
   * ✅ NOVO: Preço atual em Futures (não Spot)
   */
  public static async getFuturesPrice(symbol: string): Promise<number> {
    try {
      logBinance(`💰 Buscando preço FUTURES para ${symbol}...`);
      
      // ✅ CORREÇÃO: Usar endpoint correto para Futures
      const response = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price', {
        params: { symbol },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0'
        }
      });

      const price = parseFloat(response.data.price);
      logBinance(`✅ Preço FUTURES ${symbol}: $${price.toFixed(4)}`);
      
      return price;
    } catch (error) {
      logger.error(`❌ Erro ao buscar preço FUTURES para ${symbol}:`, 'BINANCE', null, error);
      throw error;
    }
  }

  /**
   * ✅ NOVO: Klines em Futures (não Spot)
   */
  public static async getFuturesKlines(
    symbol: string, 
    interval: string = '1h', 
    limit: number = 100
  ): Promise<FuturesKlineData[]> {
    try {
      logBinance(`📊 Buscando klines FUTURES para ${symbol} (${interval}, ${limit})...`);
      
      // ✅ CORREÇÃO: Usar endpoint correto para Futures
      const response = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
        params: { symbol, interval, limit },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0'
        }
      });

      const klines = response.data.map((kline: any[]) => ({
        openTime: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        closeTime: kline[6],
        quoteAssetVolume: kline[7],
        numberOfTrades: kline[8],
        takerBuyBaseAssetVolume: kline[9],
        takerBuyQuoteAssetVolume: kline[10],
        ignore: kline[11]
      }));

      logBinance(`✅ ${klines.length} klines FUTURES obtidas para ${symbol}`);
      
      return klines;
    } catch (error) {
      logger.error(`❌ Erro ao buscar klines FUTURES para ${symbol}:`, 'BINANCE', null, error);
      throw error;
    }
  }

  /**
   * ✅ NOVO: Múltiplos preços em Futures
   */
  public static async getFuturesPrices(symbols: string[]): Promise<Map<string, number>> {
    try {
      logBinance(`💰 Buscando preços FUTURES para ${symbols.length} símbolos...`);
      
      // ✅ CORREÇÃO: Usar endpoint correto para Futures
      const response = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price', {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0'
        }
      });

      const pricesMap = new Map<string, number>();
      
      response.data.forEach((item: FuturesPriceData) => {
        if (symbols.includes(item.symbol)) {
          pricesMap.set(item.symbol, parseFloat(item.price));
        }
      });

      logBinance(`✅ Preços FUTURES obtidos para ${pricesMap.size} símbolos`);
      
      return pricesMap;
    } catch (error) {
      logger.error(`❌ Erro ao buscar preços FUTURES:`, 'BINANCE', null, error);
      throw error;
    }
  }

  /**
   * ✅ NOVO: Informações da conta Futures
   */
  public static async getFuturesAccountInfo(): Promise<any> {
    try {
      logBinance(`🏦 Buscando informações da conta FUTURES...`);
      
      // ✅ CORREÇÃO: Usar endpoint correto para Futures
      const response = await axios.get('https://fapi.binance.com/fapi/v2/account', {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0',
          'X-MBX-APIKEY': process.env.BINANCE_API_KEY || ''
        }
      });

      logBinance(`✅ Informações da conta FUTURES obtidas`);
      
      return response.data;
    } catch (error) {
      logger.error(`❌ Erro ao buscar informações da conta FUTURES:`, 'BINANCE', null, error);
      throw error;
    }
  }

  /**
   * ✅ NOVO: Posições abertas em Futures
   */
  public static async getFuturesPositions(): Promise<any[]> {
    try {
      logBinance(`📊 Buscando posições FUTURES abertas...`);
      
      // ✅ CORREÇÃO: Usar endpoint correto para Futures
      const response = await axios.get('https://fapi.binance.com/fapi/v2/positionRisk', {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0',
          'X-MBX-APIKEY': process.env.BINANCE_API_KEY || ''
        }
      });

      const openPositions = response.data.filter((pos: any) => 
        parseFloat(pos.positionAmt) !== 0
      );

      logBinance(`✅ ${openPositions.length} posições FUTURES abertas encontradas`);
      
      return openPositions;
    } catch (error) {
      logger.error(`❌ Erro ao buscar posições FUTURES:`, 'BINANCE', null, error);
      throw error;
    }
  }

  /**
   * ✅ NOVO: Calcular precisão baseada no stepSize
   */
  private static calculatePrecision(stepSize: string): number {
    const step = parseFloat(stepSize);
    if (step >= 1) return 0;
    if (step >= 0.1) return 1;
    if (step >= 0.01) return 2;
    if (step >= 0.001) return 3;
    if (step >= 0.0001) return 4;
    if (step >= 0.00001) return 5;
    if (step >= 0.000001) return 6;
    if (step >= 0.0000001) return 7;
    if (step >= 0.00000001) return 8;
    return 8;
  }

  /**
   * ✅ NOVO: Arredondar quantidade para stepSize
   */
  public static roundToStepSize(quantity: number, stepSize: number): number {
    return Math.floor(quantity / stepSize) * stepSize;
  }

  /**
   * ✅ NOVO: Validar se quantidade é válida
   */
  public static validateQuantity(
    quantity: number, 
    meta: FuturesSymbolMeta
  ): { valid: boolean; reason?: string; adjustedQuantity?: number } {
    
    // Arredondar para stepSize
    const roundedQty = this.roundToStepSize(quantity, meta.stepSize);
    
    // Verificar minQty
    if (roundedQty < meta.minQty) {
      return {
        valid: false,
        reason: `Quantity ${roundedQty} < minQty ${meta.minQty}`,
        adjustedQuantity: meta.minQty
      };
    }

    return {
      valid: true,
      adjustedQuantity: roundedQty
    };
  }

  /**
   * ✅ NOVO: Validar se notional é válido
   */
  public static validateNotional(
    quantity: number,
    price: number,
    meta: FuturesSymbolMeta
  ): { valid: boolean; reason?: string; notional?: number } {
    
    const notional = quantity * price;
    
    if (notional < meta.minNotional) {
      return {
        valid: false,
        reason: `Notional ${notional.toFixed(2)} < minNotional ${meta.minNotional.toFixed(2)}`,
        notional
      };
    }

    return {
      valid: true,
      notional
    };
  }

  /**
   * ✅ NOVO: Limpar cache
   */
  public static clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
    logBinance('🧹 Cache de metadados FUTURES limpo');
  }

  /**
   * ✅ NOVO: Obter estatísticas do cache
   */
  public static getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.cache.size,
      symbols: Array.from(this.cache.keys())
    };
  }
}

export default BinanceFuturesMeta;
