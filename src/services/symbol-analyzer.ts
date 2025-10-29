import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface SymbolAnalysisData {
  id: string;
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  market_cap?: number;
  technical_indicators: {
    rsi: number;
    macd: number;
    sma_20: number;
    sma_50: number;
    ema_12: number;
    ema_26: number;
    bollinger_upper: number;
    bollinger_lower: number;
    bollinger_middle: number;
    atr: number;
    obv: number;
    adx: number;
    stochastic_k: number;
    stochastic_d: number;
    williams_r: number;
    cci: number;
    roc: number;
    momentum: number;
  };
  market_structure: {
    support_levels: number[];
    resistance_levels: number[];
    trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    trend_strength: number;
    volatility: number;
    liquidity: number;
  };
  patterns: {
    candlestick_patterns: string[];
    chart_patterns: string[];
    volume_patterns: string[];
    price_patterns: string[];
  };
  sentiment: {
    overall_sentiment: number;
    technical_sentiment: number;
    volume_sentiment: number;
    momentum_sentiment: number;
  };
  ranking: {
    technical_score: number;
    volume_score: number;
    momentum_score: number;
    volatility_score: number;
    overall_score: number;
    rank: number;
  };
}

export interface SymbolAnalyzerConfig {
  symbols: string[];
  analysis_interval_ms: number;
  technical_indicators: {
    rsi_period: number;
    macd_fast: number;
    macd_slow: number;
    macd_signal: number;
    sma_periods: number[];
    ema_periods: number[];
    bollinger_period: number;
    bollinger_std: number;
    atr_period: number;
    adx_period: number;
    stochastic_k_period: number;
    stochastic_d_period: number;
    williams_r_period: number;
    cci_period: number;
    roc_period: number;
    momentum_period: number;
  };
  patterns: {
    candlestick_patterns: boolean;
    chart_patterns: boolean;
    volume_patterns: boolean;
    price_patterns: boolean;
  };
  ranking: {
    enabled: boolean;
    update_frequency_ms: number;
    criteria: string[];
    weights: { [key: string]: number };
  };
}

export interface SymbolAnalyzerStats {
  total_analyses: number;
  successful_analyses: number;
  failed_analyses: number;
  average_analysis_time_ms: number;
  symbols_analyzed: number;
  patterns_detected: number;
  last_analysis: number;
  ranking_updates: number;
}

export class SymbolAnalyzer {
  private config: SymbolAnalyzerConfig;
  private stats: SymbolAnalyzerStats;
  private analysisHistory: Map<string, SymbolAnalysisData[]> = new Map();
  private currentRankings: Map<string, number> = new Map();
  private isRunning: boolean = false;
  private analysisInterval: NodeJS.Timeout | null = null;
  private rankingInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SymbolAnalyzerConfig>) {
    this.config = {
      symbols: config?.symbols || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'],
      analysis_interval_ms: config?.analysis_interval_ms || 60000, // 1 minute
      technical_indicators: {
        rsi_period: config?.technical_indicators?.rsi_period || 14,
        macd_fast: config?.technical_indicators?.macd_fast || 12,
        macd_slow: config?.technical_indicators?.macd_slow || 26,
        macd_signal: config?.technical_indicators?.macd_signal || 9,
        sma_periods: config?.technical_indicators?.sma_periods || [20, 50, 200],
        ema_periods: config?.technical_indicators?.ema_periods || [12, 26],
        bollinger_period: config?.technical_indicators?.bollinger_period || 20,
        bollinger_std: config?.technical_indicators?.bollinger_std || 2,
        atr_period: config?.technical_indicators?.atr_period || 14,
        adx_period: config?.technical_indicators?.adx_period || 14,
        stochastic_k_period: config?.technical_indicators?.stochastic_k_period || 14,
        stochastic_d_period: config?.technical_indicators?.stochastic_d_period || 3,
        williams_r_period: config?.technical_indicators?.williams_r_period || 14,
        cci_period: config?.technical_indicators?.cci_period || 20,
        roc_period: config?.technical_indicators?.roc_period || 10,
        momentum_period: config?.technical_indicators?.momentum_period || 10,
      },
      patterns: {
        candlestick_patterns: config?.patterns?.candlestick_patterns ?? true,
        chart_patterns: config?.patterns?.chart_patterns ?? true,
        volume_patterns: config?.patterns?.volume_patterns ?? true,
        price_patterns: config?.patterns?.price_patterns ?? true,
      },
      ranking: {
        enabled: config?.ranking?.enabled ?? true,
        update_frequency_ms: config?.ranking?.update_frequency_ms || 300000, // 5 minutes
        criteria: config?.ranking?.criteria || ['technical_score', 'volume_score', 'momentum_score'],
        weights: config?.ranking?.weights || {
          technical_score: 0.4,
          volume_score: 0.3,
          momentum_score: 0.3,
        },
      },
    };

    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_analysis_time_ms: 0,
      symbols_analyzed: 0,
      patterns_detected: 0,
      last_analysis: 0,
      ranking_updates: 0,
    };

    info('Symbol Analyzer initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<SymbolAnalyzerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Symbol Analyzer config updated', { newConfig });
  }

  public async startAnalysis(): Promise<void> {
    if (this.isRunning) {
      warn('Symbol analysis is already running');
      return;
    }

    this.isRunning = true;
    info('Starting symbol analysis engine');

    // Start periodic analysis
    this.analysisInterval = setInterval(async () => {
      try {
        await this.performAnalysis();
      } catch (err: any) {
        error('Error in periodic symbol analysis', { error: err.message });
      }
    }, this.config.analysis_interval_ms);

    // Start ranking updates if enabled
    if (this.config.ranking.enabled) {
      this.rankingInterval = setInterval(async () => {
        try {
          await this.updateRankings();
        } catch (err: any) {
          error('Error updating symbol rankings', { error: err.message });
        }
      }, this.config.ranking.update_frequency_ms);
    }

    // Perform initial analysis
    await this.performAnalysis();
  }

  public async stopAnalysis(): Promise<void> {
    if (!this.isRunning) {
      warn('Symbol analysis is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    if (this.rankingInterval) {
      clearInterval(this.rankingInterval);
      this.rankingInterval = null;
    }

    info('Symbol analysis engine stopped');
  }

  public async analyzeSymbol(symbol: string, priceData: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>): Promise<SymbolAnalysisData> {
    const startTime = Date.now();

    try {
      if (!priceData || priceData.length === 0) {
        throw new Error(`No price data available for ${symbol}`);
      }

      const latestData = priceData[priceData.length - 1];
      const closes = priceData.map(d => d.close);
      const highs = priceData.map(d => d.high);
      const lows = priceData.map(d => d.low);
      const volumes = priceData.map(d => d.volume);

      // Calculate technical indicators
      const technicalIndicators = this.calculateTechnicalIndicators(closes, highs, lows, volumes);

      // Analyze market structure
      const marketStructure = this.analyzeMarketStructure(priceData);

      // Detect patterns
      const patterns = this.detectPatterns(priceData);

      // Calculate sentiment
      const sentiment = this.calculateSentiment(technicalIndicators, marketStructure, patterns);

      // Calculate ranking scores
      const ranking = this.calculateRanking(technicalIndicators, marketStructure, sentiment);

      const analysisData: SymbolAnalysisData = {
        id: generateUniqueId(),
        symbol,
        timestamp: Date.now(),
        price: latestData.close,
        volume: latestData.volume,
        technical_indicators: technicalIndicators,
        market_structure: marketStructure,
        patterns,
        sentiment,
        ranking,
      };

      // Store analysis data
      if (!this.analysisHistory.has(symbol)) {
        this.analysisHistory.set(symbol, []);
      }
      this.analysisHistory.get(symbol)!.push(analysisData);

      // Cleanup old data
      this.cleanupOldData(symbol);

      // Update stats
      this.updateStats(startTime, true);

      info('Symbol analysis completed', {
        symbol,
        technicalScore: ranking.technical_score.toFixed(3),
        overallScore: ranking.overall_score.toFixed(3),
        patternsDetected: patterns.candlestick_patterns.length + patterns.chart_patterns.length,
        analysisTime: `${Date.now() - startTime}ms`,
      });

      return analysisData;

    } catch (err: any) {
      error('Symbol analysis failed', { symbol, error: err.message });
      this.updateStats(startTime, false);
      throw err;
    }
  }

  private calculateTechnicalIndicators(closes: number[], highs: number[], lows: number[], volumes: number[]): SymbolAnalysisData['technical_indicators'] {
    return {
      rsi: this.calculateRSI(closes, this.config.technical_indicators.rsi_period),
      macd: this.calculateMACD(closes, this.config.technical_indicators.macd_fast, this.config.technical_indicators.macd_slow),
      sma_20: this.calculateSMA(closes, 20),
      sma_50: this.calculateSMA(closes, 50),
      ema_12: this.calculateEMA(closes, 12),
      ema_26: this.calculateEMA(closes, 26),
      bollinger_upper: this.calculateBollingerBands(closes, this.config.technical_indicators.bollinger_period, this.config.technical_indicators.bollinger_std).upper,
      bollinger_lower: this.calculateBollingerBands(closes, this.config.technical_indicators.bollinger_period, this.config.technical_indicators.bollinger_std).lower,
      bollinger_middle: this.calculateBollingerBands(closes, this.config.technical_indicators.bollinger_period, this.config.technical_indicators.bollinger_std).middle,
      atr: this.calculateATR(highs, lows, closes, this.config.technical_indicators.atr_period),
      obv: this.calculateOBV(closes, volumes),
      adx: this.calculateADX(highs, lows, closes, this.config.technical_indicators.adx_period),
      stochastic_k: this.calculateStochasticK(highs, lows, closes, this.config.technical_indicators.stochastic_k_period),
      stochastic_d: this.calculateStochasticD(highs, lows, closes, this.config.technical_indicators.stochastic_d_period),
      williams_r: this.calculateWilliamsR(highs, lows, closes, this.config.technical_indicators.williams_r_period),
      cci: this.calculateCCI(highs, lows, closes, this.config.technical_indicators.cci_period),
      roc: this.calculateROC(closes, this.config.technical_indicators.roc_period),
      momentum: this.calculateMomentum(closes, this.config.technical_indicators.momentum_period),
    };
  }

  private calculateRSI(data: number[], period: number): number {
    if (data.length < period + 1) return 50;

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(data: number[], fastPeriod: number, slowPeriod: number): number {
    const emaFast = this.calculateEMA(data, fastPeriod);
    const emaSlow = this.calculateEMA(data, slowPeriod);
    return emaFast - emaSlow;
  }

  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    return data.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  private calculateBollingerBands(data: number[], period: number, stdDev: number): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(data, period);
    const slice = data.slice(-period);
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev),
    };
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    const trueRanges: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return this.calculateSMA(trueRanges, period);
  }

  private calculateOBV(closes: number[], volumes: number[]): number {
    let obv = volumes[0] || 0;

    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i] || 0;
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i] || 0;
      }
    }

    return obv;
  }

  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number {
    // Simplified ADX calculation
    if (highs.length < period) return 25;
    
    const slice = highs.slice(-period);
    const avgHigh = slice.reduce((a, b) => a + b, 0) / period;
    const sliceLow = lows.slice(-period);
    const avgLow = sliceLow.reduce((a, b) => a + b, 0) / period;
    
    return Math.abs(avgHigh - avgLow) / (avgHigh + avgLow) * 100;
  }

  private calculateStochasticK(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period) return 50;
    
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    const currentClose = closes[closes.length - 1];
    
    return ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  private calculateStochasticD(highs: number[], lows: number[], closes: number[], period: number): number {
    const kValues = [];
    for (let i = period; i <= highs.length; i++) {
      const k = this.calculateStochasticK(highs.slice(0, i), lows.slice(0, i), closes.slice(0, i), period);
      kValues.push(k);
    }
    
    return this.calculateSMA(kValues, 3);
  }

  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period) return -50;
    
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    const currentClose = closes[closes.length - 1];
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  private calculateCCI(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period) return 0;
    
    const typicalPrices: number[] = [];
    for (let i = highs.length - period; i < highs.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }
    
    const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
    
    const currentTP = (highs[highs.length - 1] + lows[lows.length - 1] + closes[closes.length - 1]) / 3;
    
    return meanDeviation === 0 ? 0 : (currentTP - sma) / (0.015 * meanDeviation);
  }

  private calculateROC(data: number[], period: number): number {
    if (data.length < period + 1) return 0;
    
    const current = data[data.length - 1];
    const past = data[data.length - 1 - period];
    
    return ((current - past) / past) * 100;
  }

  private calculateMomentum(data: number[], period: number): number {
    if (data.length < period + 1) return 0;
    
    return data[data.length - 1] - data[data.length - 1 - period];
  }

  private analyzeMarketStructure(priceData: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>): SymbolAnalysisData['market_structure'] {
    const closes = priceData.map(d => d.close);
    const highs = priceData.map(d => d.high);
    const lows = priceData.map(d => d.low);
    const volumes = priceData.map(d => d.volume);

    // Calculate support and resistance levels
    const supportLevels = this.calculateSupportLevels(lows);
    const resistanceLevels = this.calculateResistanceLevels(highs);

    // Determine trend direction
    const trendDirection = this.determineTrendDirection(closes);

    // Calculate trend strength
    const trendStrength = this.calculateTrendStrength(closes);

    // Calculate volatility
    const volatility = this.calculateVolatility(closes);

    // Calculate liquidity
    const liquidity = this.calculateLiquidity(volumes);

    return {
      support_levels: supportLevels,
      resistance_levels: resistanceLevels,
      trend_direction: trendDirection,
      trend_strength: trendStrength,
      volatility,
      liquidity,
    };
  }

  private calculateSupportLevels(lows: number[]): number[] {
    const levels: number[] = [];
    
    for (let i = 2; i < lows.length - 2; i++) {
      if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1] &&
          lows[i] < lows[i - 2] && lows[i] < lows[i + 2]) {
        levels.push(lows[i]);
      }
    }
    
    return levels.slice(-5); // Return last 5 support levels
  }

  private calculateResistanceLevels(highs: number[]): number[] {
    const levels: number[] = [];
    
    for (let i = 2; i < highs.length - 2; i++) {
      if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1] &&
          highs[i] > highs[i - 2] && highs[i] > highs[i + 2]) {
        levels.push(highs[i]);
      }
    }
    
    return levels.slice(-5); // Return last 5 resistance levels
  }

  private determineTrendDirection(closes: number[]): 'UP' | 'DOWN' | 'SIDEWAYS' {
    if (closes.length < 20) return 'SIDEWAYS';
    
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    const currentPrice = closes[closes.length - 1];
    
    if (currentPrice > sma20 && sma20 > sma50) {
      return 'UP';
    } else if (currentPrice < sma20 && sma20 < sma50) {
      return 'DOWN';
    } else {
      return 'SIDEWAYS';
    }
  }

  private calculateTrendStrength(closes: number[]): number {
    if (closes.length < 20) return 0;
    
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    const currentPrice = closes[closes.length - 1];
    
    const priceVsSMA20 = Math.abs(currentPrice - sma20) / sma20;
    const sma20VsSMA50 = Math.abs(sma20 - sma50) / sma50;
    
    return Math.min((priceVsSMA20 + sma20VsSMA50) * 10, 1);
  }

  private calculateVolatility(closes: number[]): number {
    if (closes.length < 20) return 0;
    
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateLiquidity(volumes: number[]): number {
    if (volumes.length < 20) return 0;
    
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const maxVolume = Math.max(...volumes.slice(-20));
    
    return avgVolume / maxVolume;
  }

  private detectPatterns(priceData: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>): SymbolAnalysisData['patterns'] {
    const candlestickPatterns: string[] = [];
    const chartPatterns: string[] = [];
    const volumePatterns: string[] = [];
    const pricePatterns: string[] = [];

    // Detect candlestick patterns
    if (this.config.patterns.candlestick_patterns) {
      candlestickPatterns.push(...this.detectCandlestickPatterns(priceData));
    }

    // Detect chart patterns
    if (this.config.patterns.chart_patterns) {
      chartPatterns.push(...this.detectChartPatterns(priceData));
    }

    // Detect volume patterns
    if (this.config.patterns.volume_patterns) {
      volumePatterns.push(...this.detectVolumePatterns(priceData));
    }

    // Detect price patterns
    if (this.config.patterns.price_patterns) {
      pricePatterns.push(...this.detectPricePatterns(priceData));
    }

    this.stats.patterns_detected += candlestickPatterns.length + chartPatterns.length + volumePatterns.length + pricePatterns.length;

    return {
      candlestick_patterns: candlestickPatterns,
      chart_patterns: chartPatterns,
      volume_patterns: volumePatterns,
      price_patterns: pricePatterns,
    };
  }

  private detectCandlestickPatterns(priceData: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>): string[] {
    const patterns: string[] = [];
    
    if (priceData.length < 3) return patterns;
    
    const recent = priceData.slice(-3);
    const current = recent[2];
    const previous = recent[1];
    const beforePrevious = recent[0];
    
    // Doji pattern
    const bodySize = Math.abs(current.close - current.open);
    const totalSize = current.high - current.low;
    if (bodySize < totalSize * 0.1) {
      patterns.push('DOJI');
    }
    
    // Hammer pattern
    const lowerShadow = Math.min(current.open, current.close) - current.low;
    const upperShadow = current.high - Math.max(current.open, current.close);
    if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
      patterns.push('HAMMER');
    }
    
    // Shooting star pattern
    if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5) {
      patterns.push('SHOOTING_STAR');
    }
    
    return patterns;
  }

  private detectChartPatterns(priceData: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>): string[] {
    const patterns: string[] = [];
    
    if (priceData.length < 20) return patterns;
    
    const closes = priceData.map(d => d.close);
    const highs = priceData.map(d => d.high);
    const lows = priceData.map(d => d.low);
    
    // Head and shoulders pattern (simplified)
    const recentHighs = highs.slice(-20);
    const maxHigh = Math.max(...recentHighs);
    const maxIndex = recentHighs.indexOf(maxHigh);
    
    if (maxIndex > 5 && maxIndex < 15) {
      const leftShoulder = Math.max(...recentHighs.slice(0, maxIndex));
      const rightShoulder = Math.max(...recentHighs.slice(maxIndex + 1));
      
      if (Math.abs(leftShoulder - rightShoulder) / leftShoulder < 0.05) {
        patterns.push('HEAD_AND_SHOULDERS');
      }
    }
    
    return patterns;
  }

  private detectVolumePatterns(priceData: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>): string[] {
    const patterns: string[] = [];
    
    if (priceData.length < 10) return patterns;
    
    const volumes = priceData.map(d => d.volume);
    const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const currentVolume = volumes[volumes.length - 1];
    
    // High volume pattern
    if (currentVolume > avgVolume * 2) {
      patterns.push('HIGH_VOLUME');
    }
    
    // Volume spike pattern
    if (currentVolume > avgVolume * 3) {
      patterns.push('VOLUME_SPIKE');
    }
    
    return patterns;
  }

  private detectPricePatterns(priceData: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>): string[] {
    const patterns: string[] = [];
    
    if (priceData.length < 10) return patterns;
    
    const closes = priceData.map(d => d.close);
    const recent = closes.slice(-10);
    
    // Ascending triangle pattern (simplified)
    const highs = recent.map((_, i) => Math.max(...priceData.slice(-10 + i, -10 + i + 3).map(d => d.high)));
    const lows = recent.map((_, i) => Math.min(...priceData.slice(-10 + i, -10 + i + 3).map(d => d.low)));
    
    const highVariance = this.calculateVariance(highs);
    const lowVariance = this.calculateVariance(lows);
    
    if (highVariance < lowVariance * 0.5) {
      patterns.push('ASCENDING_TRIANGLE');
    }
    
    return patterns;
  }

  private calculateVariance(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  }

  private calculateSentiment(technicalIndicators: any, marketStructure: any, patterns: any): SymbolAnalysisData['sentiment'] {
    let technicalSentiment = 0;
    let volumeSentiment = 0;
    let momentumSentiment = 0;
    
    // Technical sentiment based on indicators
    if (technicalIndicators.rsi < 30) technicalSentiment += 0.3;
    else if (technicalIndicators.rsi > 70) technicalSentiment -= 0.3;
    
    if (technicalIndicators.macd > 0) technicalSentiment += 0.2;
    else if (technicalIndicators.macd < 0) technicalSentiment -= 0.2;
    
    // Volume sentiment
    if (patterns.volume_patterns.includes('HIGH_VOLUME')) volumeSentiment += 0.3;
    if (patterns.volume_patterns.includes('VOLUME_SPIKE')) volumeSentiment += 0.5;
    
    // Momentum sentiment
    if (technicalIndicators.momentum > 0) momentumSentiment += 0.2;
    else if (technicalIndicators.momentum < 0) momentumSentiment -= 0.2;
    
    if (technicalIndicators.roc > 0) momentumSentiment += 0.2;
    else if (technicalIndicators.roc < 0) momentumSentiment -= 0.2;
    
    const overallSentiment = (technicalSentiment + volumeSentiment + momentumSentiment) / 3;
    
    return {
      overall_sentiment: Math.max(-1, Math.min(1, overallSentiment)),
      technical_sentiment: Math.max(-1, Math.min(1, technicalSentiment)),
      volume_sentiment: Math.max(-1, Math.min(1, volumeSentiment)),
      momentum_sentiment: Math.max(-1, Math.min(1, momentumSentiment)),
    };
  }

  private calculateRanking(technicalIndicators: any, marketStructure: any, sentiment: any): SymbolAnalysisData['ranking'] {
    // Calculate individual scores
    const technicalScore = this.calculateTechnicalScore(technicalIndicators);
    const volumeScore = this.calculateVolumeScore(marketStructure);
    const momentumScore = this.calculateMomentumScore(technicalIndicators, sentiment);
    const volatilityScore = this.calculateVolatilityScore(marketStructure);
    
    // Calculate overall score using weights
    const weights = this.config.ranking.weights;
    const overallScore = 
      technicalScore * weights.technical_score +
      volumeScore * weights.volume_score +
      momentumScore * weights.momentum_score;
    
    return {
      technical_score: technicalScore,
      volume_score: volumeScore,
      momentum_score: momentumScore,
      volatility_score: volatilityScore,
      overall_score: overallScore,
      rank: 0, // Will be set by updateRankings
    };
  }

  private calculateTechnicalScore(technicalIndicators: any): number {
    let score = 0;
    
    // RSI score
    if (technicalIndicators.rsi > 30 && technicalIndicators.rsi < 70) score += 0.3;
    
    // MACD score
    if (technicalIndicators.macd > 0) score += 0.2;
    
    // Moving averages alignment
    if (technicalIndicators.sma_20 > technicalIndicators.sma_50) score += 0.2;
    if (technicalIndicators.ema_12 > technicalIndicators.ema_26) score += 0.2;
    
    // Bollinger bands position
    const bbPosition = (technicalIndicators.bollinger_upper - technicalIndicators.bollinger_lower) / 2;
    if (bbPosition > 0.5) score += 0.1;
    
    return Math.min(score, 1);
  }

  private calculateVolumeScore(marketStructure: any): number {
    return marketStructure.liquidity;
  }

  private calculateMomentumScore(technicalIndicators: any, sentiment: any): number {
    let score = 0;
    
    if (technicalIndicators.momentum > 0) score += 0.3;
    if (technicalIndicators.roc > 0) score += 0.3;
    if (sentiment.momentum_sentiment > 0) score += 0.4;
    
    return Math.min(score, 1);
  }

  private calculateVolatilityScore(marketStructure: any): number {
    // Lower volatility is generally better for trading
    return Math.max(0, 1 - marketStructure.volatility * 10);
  }

  private async performAnalysis(): Promise<void> {
    for (const symbol of this.config.symbols) {
      try {
        // This would typically fetch real price data
        // For now, we'll simulate with mock data
        const mockPriceData = this.generateMockPriceData(symbol);
        await this.analyzeSymbol(symbol, mockPriceData);
      } catch (err: any) {
        error('Failed to analyze symbol', { symbol, error: err.message });
      }
    }
  }

  private generateMockPriceData(symbol: string): Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }> {
    const data = [];
    const basePrice = symbol === 'BTCUSDT' ? 50000 : 3000;
    let price = basePrice;
    
    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.5) * 0.02; // ±1% change
      price *= (1 + change);
      
      const high = price * (1 + Math.random() * 0.01);
      const low = price * (1 - Math.random() * 0.01);
      const volume = Math.random() * 1000000;
      
      data.push({
        timestamp: Date.now() - (100 - i) * 60000, // 1 minute intervals
        open: price,
        high,
        low,
        close: price,
        volume,
      });
    }
    
    return data;
  }

  private async updateRankings(): Promise<void> {
    const allAnalyses: Array<{ symbol: string; overall_score: number }> = [];
    
    for (const [symbol, analyses] of this.analysisHistory) {
      if (analyses.length > 0) {
        const latest = analyses[analyses.length - 1];
        allAnalyses.push({
          symbol,
          overall_score: latest.ranking.overall_score,
        });
      }
    }
    
    // Sort by overall score
    allAnalyses.sort((a, b) => b.overall_score - a.overall_score);
    
    // Update rankings
    for (let i = 0; i < allAnalyses.length; i++) {
      const symbol = allAnalyses[i].symbol;
      const analyses = this.analysisHistory.get(symbol);
      if (analyses && analyses.length > 0) {
        analyses[analyses.length - 1].ranking.rank = i + 1;
        this.currentRankings.set(symbol, i + 1);
      }
    }
    
    this.stats.ranking_updates++;
    info('Symbol rankings updated', { totalSymbols: allAnalyses.length });
  }

  private cleanupOldData(symbol: string): void {
    const data = this.analysisHistory.get(symbol);
    if (!data) return;

    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    const filteredData = data.filter(d => d.timestamp > cutoffTime);
    
    this.analysisHistory.set(symbol, filteredData);
  }

  private updateStats(startTime: number, success: boolean): void {
    const analysisTime = Date.now() - startTime;
    
    this.stats.total_analyses++;
    if (success) {
      this.stats.successful_analyses++;
    } else {
      this.stats.failed_analyses++;
    }
    
    this.stats.last_analysis = Date.now();
    
    this.stats.average_analysis_time_ms = 
      (this.stats.average_analysis_time_ms * (this.stats.total_analyses - 1) + analysisTime) / 
      this.stats.total_analyses;
  }

  public getAnalysisHistory(symbol: string): SymbolAnalysisData[] {
    return this.analysisHistory.get(symbol) || [];
  }

  public getAllAnalysisHistory(): Map<string, SymbolAnalysisData[]> {
    return new Map(this.analysisHistory);
  }

  public getCurrentRankings(): Map<string, number> {
    return new Map(this.currentRankings);
  }

  public getStats(): SymbolAnalyzerStats {
    return { ...this.stats };
  }

  public getConfig(): SymbolAnalyzerConfig {
    return { ...this.config };
  }

  public clearData(): void {
    this.analysisHistory.clear();
    this.currentRankings.clear();
    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_analysis_time_ms: 0,
      symbols_analyzed: 0,
      patterns_detected: 0,
      last_analysis: 0,
      ranking_updates: 0,
    };
    info('Symbol Analyzer data cleared');
  }
}

export const symbolAnalyzer = new SymbolAnalyzer();
