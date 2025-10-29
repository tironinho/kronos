import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface HistoricalDataPoint {
  timestamp: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades_count?: number;
  vwap?: number;
}

export interface DataProcessorConfig {
  batch_size: number;
  max_workers: number;
  processing_interval_ms: number;
  data_retention_days: number;
  compression_enabled: boolean;
  cache_size_mb: number;
  symbols: string[];
  timeframes: string[];
}

export interface ProcessedData {
  id: string;
  symbol: string;
  timeframe: string;
  start_timestamp: number;
  end_timestamp: number;
  data_points: HistoricalDataPoint[];
  indicators: {
    sma_20: number[];
    sma_50: number[];
    ema_12: number[];
    ema_26: number[];
    rsi: number[];
    macd: number[];
    macd_signal: number[];
    macd_histogram: number[];
    bollinger_upper: number[];
    bollinger_lower: number[];
    bollinger_middle: number[];
    atr: number[];
    obv: number[];
    adx: number[];
    stochastic_k: number[];
    stochastic_d: number[];
    williams_r: number[];
    cci: number[];
    roc: number[];
    momentum: number[];
  };
  patterns: {
    doji: boolean[];
    hammer: boolean[];
    shooting_star: boolean[];
    engulfing: boolean[];
    harami: boolean[];
    morning_star: boolean[];
    evening_star: boolean[];
  };
  statistics: {
    volatility: number;
    average_volume: number;
    price_range: number;
    trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    support_levels: number[];
    resistance_levels: number[];
  };
  processed_at: number;
}

export interface DataProcessorStats {
  total_processed: number;
  successful_processing: number;
  failed_processing: number;
  average_processing_time_ms: number;
  cache_hits: number;
  cache_misses: number;
  cache_hit_rate: number;
  data_points_processed: number;
  last_processing: number;
  active_workers: number;
}

export class DataProcessor {
  private config: DataProcessorConfig;
  private stats: DataProcessorStats;
  private cache: Map<string, ProcessedData> = new Map();
  private workers: Set<Promise<void>> = new Set();
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<DataProcessorConfig>) {
    this.config = {
      batch_size: config?.batch_size || 1000,
      max_workers: config?.max_workers || 4,
      processing_interval_ms: config?.processing_interval_ms || 60000,
      data_retention_days: config?.data_retention_days || 30,
      compression_enabled: config?.compression_enabled || true,
      cache_size_mb: config?.cache_size_mb || 100,
      symbols: config?.symbols || ['BTCUSDT', 'ETHUSDT'],
      timeframes: config?.timeframes || ['1m', '5m', '15m', '1h', '4h', '1d'],
    };

    this.stats = {
      total_processed: 0,
      successful_processing: 0,
      failed_processing: 0,
      average_processing_time_ms: 0,
      cache_hits: 0,
      cache_misses: 0,
      cache_hit_rate: 0,
      data_points_processed: 0,
      last_processing: 0,
      active_workers: 0,
    };

    info('Data Processor initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<DataProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Data Processor config updated', { newConfig });
  }

  public async processHistoricalData(
    symbol: string,
    timeframe: string,
    data: HistoricalDataPoint[]
  ): Promise<ProcessedData> {
    const startTime = Date.now();
    const cacheKey = `${symbol}_${timeframe}_${data[0]?.timestamp}_${data[data.length - 1]?.timestamp}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      this.stats.cache_hits++;
      this.updateCacheHitRate();
      info('Data retrieved from cache', { symbol, timeframe, dataPoints: data.length });
      return this.cache.get(cacheKey)!;
    }

    this.stats.cache_misses++;
    this.updateCacheHitRate();

    try {
      info('Processing historical data', { symbol, timeframe, dataPoints: data.length });

      // Calculate technical indicators
      const indicators = this.calculateTechnicalIndicators(data);

      // Detect candlestick patterns
      const patterns = this.detectCandlestickPatterns(data);

      // Calculate statistics
      const statistics = this.calculateStatistics(data);

      const processedData: ProcessedData = {
        id: generateUniqueId(),
        symbol,
        timeframe,
        start_timestamp: data[0]?.timestamp || 0,
        end_timestamp: data[data.length - 1]?.timestamp || 0,
        data_points: data,
        indicators,
        patterns,
        statistics,
        processed_at: Date.now(),
      };

      // Cache the result
      this.cache.set(cacheKey, processedData);
      this.cleanupCache();

      // Update stats
      this.updateStats(startTime, data.length, true);

      info('Historical data processed successfully', {
        symbol,
        timeframe,
        dataPoints: data.length,
        processingTime: `${Date.now() - startTime}ms`,
      });

      return processedData;

    } catch (err: any) {
      error('Failed to process historical data', { symbol, timeframe, error: err.message });
      this.updateStats(startTime, data.length, false);
      throw err;
    }
  }

  private calculateTechnicalIndicators(data: HistoricalDataPoint[]): ProcessedData['indicators'] {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    return {
      sma_20: this.calculateSMA(closes, 20),
      sma_50: this.calculateSMA(closes, 50),
      ema_12: this.calculateEMA(closes, 12),
      ema_26: this.calculateEMA(closes, 26),
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes),
      macd_signal: this.calculateMACDSignal(closes),
      macd_histogram: this.calculateMACDHistogram(closes),
      bollinger_upper: this.calculateBollingerBands(closes, 20, 2).upper,
      bollinger_lower: this.calculateBollingerBands(closes, 20, 2).lower,
      bollinger_middle: this.calculateBollingerBands(closes, 20, 2).middle,
      atr: this.calculateATR(highs, lows, closes, 14),
      obv: this.calculateOBV(closes, volumes),
      adx: this.calculateADX(highs, lows, closes, 14),
      stochastic_k: this.calculateStochasticK(highs, lows, closes, 14),
      stochastic_d: this.calculateStochasticD(highs, lows, closes, 14),
      williams_r: this.calculateWilliamsR(highs, lows, closes, 14),
      cci: this.calculateCCI(highs, lows, closes, 20),
      roc: this.calculateROC(closes, 10),
      momentum: this.calculateMomentum(closes, 10),
    };
  }

  private calculateSMA(data: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  private calculateEMA(data: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA is SMA
    const firstSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(firstSMA);

    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    return ema;
  }

  private calculateRSI(data: number[], period: number): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  }

  private calculateMACD(data: number[]): number[] {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macd: number[] = [];

    const minLength = Math.min(ema12.length, ema26.length);
    for (let i = 0; i < minLength; i++) {
      macd.push(ema12[i] - ema26[i]);
    }

    return macd;
  }

  private calculateMACDSignal(data: number[]): number[] {
    const macd = this.calculateMACD(data);
    return this.calculateEMA(macd, 9);
  }

  private calculateMACDHistogram(data: number[]): number[] {
    const macd = this.calculateMACD(data);
    const signal = this.calculateMACDSignal(data);
    const histogram: number[] = [];

    const minLength = Math.min(macd.length, signal.length);
    for (let i = 0; i < minLength; i++) {
      histogram.push(macd[i] - signal[i]);
    }

    return histogram;
  }

  private calculateBollingerBands(data: number[], period: number, stdDev: number): { upper: number[]; middle: number[]; lower: number[] } {
    const sma = this.calculateSMA(data, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i - period + 1];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);

      upper.push(mean + (standardDeviation * stdDev));
      lower.push(mean - (standardDeviation * stdDev));
    }

    return { upper, middle: sma, lower };
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const trueRanges: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return this.calculateSMA(trueRanges, period);
  }

  private calculateOBV(closes: number[], volumes: number[]): number[] {
    const obv: number[] = [volumes[0]];

    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv.push(obv[obv.length - 1] + volumes[i]);
      } else if (closes[i] < closes[i - 1]) {
        obv.push(obv[obv.length - 1] - volumes[i]);
      } else {
        obv.push(obv[obv.length - 1]);
      }
    }

    return obv;
  }

  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number[] {
    // Simplified ADX calculation
    const adx: number[] = [];
    for (let i = period; i < highs.length; i++) {
      const slice = highs.slice(i - period, i);
      const avgHigh = slice.reduce((a, b) => a + b, 0) / period;
      const sliceLow = lows.slice(i - period, i);
      const avgLow = sliceLow.reduce((a, b) => a + b, 0) / period;
      
      const dx = Math.abs(avgHigh - avgLow) / (avgHigh + avgLow) * 100;
      adx.push(dx);
    }
    return adx;
  }

  private calculateStochasticK(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const k: number[] = [];
    
    for (let i = period - 1; i < highs.length; i++) {
      const highSlice = highs.slice(i - period + 1, i + 1);
      const lowSlice = lows.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...highSlice);
      const lowestLow = Math.min(...lowSlice);
      
      const kValue = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
      k.push(kValue);
    }
    
    return k;
  }

  private calculateStochasticD(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const k = this.calculateStochasticK(highs, lows, closes, period);
    return this.calculateSMA(k, 3);
  }

  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const wr: number[] = [];
    
    for (let i = period - 1; i < highs.length; i++) {
      const highSlice = highs.slice(i - period + 1, i + 1);
      const lowSlice = lows.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...highSlice);
      const lowestLow = Math.min(...lowSlice);
      
      const wrValue = ((highestHigh - closes[i]) / (highestHigh - lowestLow)) * -100;
      wr.push(wrValue);
    }
    
    return wr;
  }

  private calculateCCI(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const cci: number[] = [];
    
    for (let i = period - 1; i < highs.length; i++) {
      const typicalPrices: number[] = [];
      for (let j = i - period + 1; j <= i; j++) {
        typicalPrices.push((highs[j] + lows[j] + closes[j]) / 3);
      }
      
      const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
      const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
      
      const currentTP = (highs[i] + lows[i] + closes[i]) / 3;
      const cciValue = meanDeviation === 0 ? 0 : (currentTP - sma) / (0.015 * meanDeviation);
      cci.push(cciValue);
    }
    
    return cci;
  }

  private calculateROC(data: number[], period: number): number[] {
    const roc: number[] = [];
    
    for (let i = period; i < data.length; i++) {
      const rocValue = ((data[i] - data[i - period]) / data[i - period]) * 100;
      roc.push(rocValue);
    }
    
    return roc;
  }

  private calculateMomentum(data: number[], period: number): number[] {
    const momentum: number[] = [];
    
    for (let i = period; i < data.length; i++) {
      momentum.push(data[i] - data[i - period]);
    }
    
    return momentum;
  }

  private detectCandlestickPatterns(data: HistoricalDataPoint[]): ProcessedData['patterns'] {
    const patterns = {
      doji: new Array(data.length).fill(false),
      hammer: new Array(data.length).fill(false),
      shooting_star: new Array(data.length).fill(false),
      engulfing: new Array(data.length).fill(false),
      harami: new Array(data.length).fill(false),
      morning_star: new Array(data.length).fill(false),
      evening_star: new Array(data.length).fill(false),
    };

    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      const bodySize = Math.abs(current.close - current.open);
      const totalSize = current.high - current.low;
      const upperShadow = current.high - Math.max(current.open, current.close);
      const lowerShadow = Math.min(current.open, current.close) - current.low;

      // Doji pattern
      if (bodySize < totalSize * 0.1) {
        patterns.doji[i] = true;
      }

      // Hammer pattern
      if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
        patterns.hammer[i] = true;
      }

      // Shooting star pattern
      if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5) {
        patterns.shooting_star[i] = true;
      }

      // Engulfing pattern
      if (i > 0) {
        const prevBodySize = Math.abs(previous.close - previous.open);
        const currentBodySize = Math.abs(current.close - current.open);
        
        if (currentBodySize > prevBodySize && 
            ((previous.close < previous.open && current.close > current.open) ||
             (previous.close > previous.open && current.close < current.open))) {
          patterns.engulfing[i] = true;
        }
      }

      // Harami pattern
      if (i > 0) {
        const prevBodySize = Math.abs(previous.close - previous.open);
        const currentBodySize = Math.abs(current.close - current.open);
        
        if (currentBodySize < prevBodySize * 0.5) {
          patterns.harami[i] = true;
        }
      }
    }

    return patterns;
  }

  private calculateStatistics(data: HistoricalDataPoint[]): ProcessedData['statistics'] {
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    // Calculate volatility (standard deviation of returns)
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Calculate average volume
    const averageVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    // Calculate price range
    const priceRange = Math.max(...closes) - Math.min(...closes);

    // Determine trend direction
    const firstPrice = closes[0];
    const lastPrice = closes[closes.length - 1];
    const priceChange = (lastPrice - firstPrice) / firstPrice;
    
    let trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS';
    if (priceChange > 0.05) {
      trendDirection = 'UP';
    } else if (priceChange < -0.05) {
      trendDirection = 'DOWN';
    } else {
      trendDirection = 'SIDEWAYS';
    }

    // Calculate support and resistance levels (simplified)
    const supportLevels = this.calculateSupportLevels(closes);
    const resistanceLevels = this.calculateResistanceLevels(closes);

    return {
      volatility,
      average_volume: averageVolume,
      price_range: priceRange,
      trend_direction: trendDirection,
      support_levels: supportLevels,
      resistance_levels: resistanceLevels,
    };
  }

  private calculateSupportLevels(closes: number[]): number[] {
    const levels: number[] = [];
    const sortedCloses = [...closes].sort((a, b) => a - b);
    
    // Find local minima
    for (let i = 1; i < closes.length - 1; i++) {
      if (closes[i] < closes[i - 1] && closes[i] < closes[i + 1]) {
        levels.push(closes[i]);
      }
    }
    
    return levels.slice(0, 5); // Return top 5 support levels
  }

  private calculateResistanceLevels(closes: number[]): number[] {
    const levels: number[] = [];
    
    // Find local maxima
    for (let i = 1; i < closes.length - 1; i++) {
      if (closes[i] > closes[i - 1] && closes[i] > closes[i + 1]) {
        levels.push(closes[i]);
      }
    }
    
    return levels.slice(0, 5); // Return top 5 resistance levels
  }

  private updateCacheHitRate(): void {
    const total = this.stats.cache_hits + this.stats.cache_misses;
    this.stats.cache_hit_rate = total > 0 ? this.stats.cache_hits / total : 0;
  }

  private cleanupCache(): void {
    if (this.cache.size > 1000) { // Limit cache size
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].processed_at - b[1].processed_at);
      
      // Remove oldest 20% of entries
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  private updateStats(startTime: number, dataPoints: number, success: boolean): void {
    const processingTime = Date.now() - startTime;
    
    this.stats.total_processed++;
    if (success) {
      this.stats.successful_processing++;
    } else {
      this.stats.failed_processing++;
    }
    
    this.stats.data_points_processed += dataPoints;
    this.stats.last_processing = Date.now();
    
    this.stats.average_processing_time_ms = 
      (this.stats.average_processing_time_ms * (this.stats.total_processed - 1) + processingTime) / 
      this.stats.total_processed;
  }

  public getStats(): DataProcessorStats {
    return { ...this.stats };
  }

  public getConfig(): DataProcessorConfig {
    return { ...this.config };
  }

  public clearCache(): void {
    this.cache.clear();
    info('Data Processor cache cleared');
  }

  public clearData(): void {
    this.cache.clear();
    this.stats = {
      total_processed: 0,
      successful_processing: 0,
      failed_processing: 0,
      average_processing_time_ms: 0,
      cache_hits: 0,
      cache_misses: 0,
      cache_hit_rate: 0,
      data_points_processed: 0,
      last_processing: 0,
      active_workers: 0,
    };
    info('Data Processor data cleared');
  }
}

export const dataProcessor = new DataProcessor();
