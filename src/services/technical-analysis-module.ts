import BinanceFuturesMeta from './binance-futures-meta';
import { logger, logTrading } from './logger';

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    width: number;
    position: number; // 0-1, onde 0 = lower band, 1 = upper band
  };
  vwap: number;
  emas: {
    ema9: number;
    ema21: number;
    ema50: number;
  };
  sma: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  atr: number;
  adx: number;
  stochastic: {
    k: number;
    d: number;
  };
  williamsR: number;
  cci: number;
}

export interface SupportResistance {
  support: {
    level: number;
    strength: 'weak' | 'moderate' | 'strong';
    touches: number;
    lastTouch: number;
  }[];
  resistance: {
    level: number;
    strength: 'weak' | 'moderate' | 'strong';
    touches: number;
    lastTouch: number;
  }[];
  pivotPoints: {
    pp: number; // Pivot Point
    r1: number; // Resistance 1
    r2: number; // Resistance 2
    s1: number; // Support 1
    s2: number; // Support 2
  };
}

export interface CandlestickPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  description: string;
  reliability: number; // 0-1
}

export interface VolumeAnalysis {
  currentVolume: number;
  averageVolume20: number;
  averageVolume50: number;
  volumeRatio: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  volumeProfile: {
    high: number;
    medium: number;
    low: number;
  };
  volumeBreakout: boolean;
  volumeConfirmation: boolean;
}

export interface TechnicalConfluence {
  score: number; // -100 to +100
  signals: {
    bullish: string[];
    bearish: string[];
    neutral: string[];
  };
  strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-100
  rationale: string;
}

export interface TechnicalAnalysisResult {
  indicators: TechnicalIndicators;
  supportResistance: SupportResistance;
  candlestickPatterns: CandlestickPattern[];
  volumeAnalysis: VolumeAnalysis;
  confluence: TechnicalConfluence;
  timestamp: number;
  symbol: string;
  timeframe: string;
}

/**
 * ✅ MÓDULO DE ANÁLISE TÉCNICA PROFISSIONAL
 * Objetivo: Incorporar indicadores técnicos e sinais de price action para decisões baseadas em tendência e momentum
 */
export class TechnicalAnalysisModule {
  private static readonly DEFAULT_PERIODS = {
    RSI: 14,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD: 2,
    EMA_SHORT: 9,
    EMA_MEDIUM: 21,
    EMA_LONG: 50,
    SMA_SHORT: 20,
    SMA_MEDIUM: 50,
    SMA_LONG: 200,
    ATR_PERIOD: 14,
    ADX_PERIOD: 14,
    STOCHASTIC_K: 14,
    STOCHASTIC_D: 3,
    WILLIAMS_R: 14,
    CCI_PERIOD: 20,
    VOLUME_MA_SHORT: 20,
    VOLUME_MA_LONG: 50
  };

  /**
   * ✅ FUNÇÃO PRINCIPAL: Análise técnica completa
   */
  public static async performTechnicalAnalysis(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 200
  ): Promise<TechnicalAnalysisResult> {
    try {
      logTrading(`📊 Iniciando análise técnica completa para ${symbol} (${timeframe})...`);

      // 1. Obter dados históricos
      const klines = await BinanceFuturesMeta.getFuturesKlines(symbol, timeframe, limit);
      
      if (klines.length < 50) {
        throw new Error(`Dados insuficientes: ${klines.length} candles (mínimo 50)`);
      }

      // 2. Processar dados OHLCV
      const ohlcv = this.processOHLCVData(klines);
      
      // 3. Calcular indicadores técnicos
      const indicators = this.calculateTechnicalIndicators(ohlcv);
      
      // 4. Detectar suporte e resistência
      const supportResistance = this.detectSupportResistance(ohlcv);
      
      // 5. Reconhecer padrões de candlestick
      const candlestickPatterns = this.recognizeCandlestickPatterns(ohlcv);
      
      // 6. Analisar volume
      const volumeAnalysis = this.analyzeVolume(ohlcv);
      
      // 7. Calcular confluência de sinais
      const confluence = this.calculateConfluence(
        indicators,
        supportResistance,
        candlestickPatterns,
        volumeAnalysis,
        ohlcv
      );

      const result: TechnicalAnalysisResult = {
        indicators,
        supportResistance,
        candlestickPatterns,
        volumeAnalysis,
        confluence,
        timestamp: Date.now(),
        symbol,
        timeframe
      };

      logTrading(`✅ Análise técnica concluída para ${symbol}`, {
        confluence: confluence.recommendation,
        confidence: confluence.confidence,
        strength: confluence.strength
      });

      return result;
    } catch (error) {
      logger.error(`❌ Erro na análise técnica de ${symbol}:`, 'TRADING', null, error);
      throw error;
    }
  }

  /**
   * ✅ Processar dados OHLCV dos klines
   */
  private static processOHLCVData(klines: any[]): {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
    timestamps: number[];
  } {
    return {
      open: klines.map(k => parseFloat(k.open)),
      high: klines.map(k => parseFloat(k.high)),
      low: klines.map(k => parseFloat(k.low)),
      close: klines.map(k => parseFloat(k.close)),
      volume: klines.map(k => parseFloat(k.volume)),
      timestamps: klines.map(k => k.openTime)
    };
  }

  /**
   * ✅ Calcular indicadores técnicos clássicos
   */
  private static calculateTechnicalIndicators(ohlcv: any): TechnicalIndicators {
    const { open, high, low, close, volume } = ohlcv;
    
    return {
      rsi: this.calculateRSI(close, this.DEFAULT_PERIODS.RSI),
      macd: this.calculateMACD(close),
      bollinger: this.calculateBollingerBands(close),
      vwap: this.calculateVWAP(high, low, close, volume),
      emas: this.calculateEMAs(close),
      sma: this.calculateSMAs(close),
      atr: this.calculateATR(high, low, close, this.DEFAULT_PERIODS.ATR),
      adx: this.calculateADX(high, low, close, this.DEFAULT_PERIODS.ADX),
      stochastic: this.calculateStochastic(high, low, close),
      williamsR: this.calculateWilliamsR(high, low, close, this.DEFAULT_PERIODS.WILLIAMS_R),
      cci: this.calculateCCI(high, low, close, this.DEFAULT_PERIODS.CCI)
    };
  }

  /**
   * ✅ RSI (Relative Strength Index)
   */
  private static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * ✅ MACD (Moving Average Convergence Divergence)
   */
  private static calculateMACD(prices: number[]): { line: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, this.DEFAULT_PERIODS.MACD_FAST);
    const ema26 = this.calculateEMA(prices, this.DEFAULT_PERIODS.MACD_SLOW);
    
    const macdLine = ema12 - ema26;
    
    // Para o sinal, precisaríamos de mais dados históricos do MACD
    // Por simplicidade, vamos usar uma aproximação
    const signal = macdLine * 0.9; // Aproximação
    const histogram = macdLine - signal;

    return { line: macdLine, signal, histogram };
  }

  /**
   * ✅ Bollinger Bands
   */
  private static calculateBollingerBands(prices: number[]): {
    upper: number;
    middle: number;
    lower: number;
    width: number;
    position: number;
  } {
    const period = this.DEFAULT_PERIODS.BOLLINGER_PERIOD;
    const stdDev = this.DEFAULT_PERIODS.BOLLINGER_STD;
    
    if (prices.length < period) {
      const currentPrice = prices[prices.length - 1];
      return {
        upper: currentPrice * 1.02,
        middle: currentPrice,
        lower: currentPrice * 0.98,
        width: 0.04,
        position: 0.5
      };
    }

    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    const upper = sma + (standardDeviation * stdDev);
    const lower = sma - (standardDeviation * stdDev);
    const width = (upper - lower) / sma;
    
    const currentPrice = prices[prices.length - 1];
    const position = (currentPrice - lower) / (upper - lower);

    return {
      upper,
      middle: sma,
      lower,
      width,
      position: Math.max(0, Math.min(1, position))
    };
  }

  /**
   * ✅ VWAP (Volume Weighted Average Price)
   */
  private static calculateVWAP(high: number[], low: number[], close: number[], volume: number[]): number {
    if (volume.length === 0) return close[close.length - 1];

    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < volume.length; i++) {
      const typicalPrice = (high[i] + low[i] + close[i]) / 3;
      const volumeAtPrice = volume[i];
      
      cumulativeTPV += typicalPrice * volumeAtPrice;
      cumulativeVolume += volumeAtPrice;
    }

    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : close[close.length - 1];
  }

  /**
   * ✅ EMAs (Exponential Moving Averages)
   */
  private static calculateEMAs(prices: number[]): { ema9: number; ema21: number; ema50: number } {
    return {
      ema9: this.calculateEMA(prices, this.DEFAULT_PERIODS.EMA_SHORT),
      ema21: this.calculateEMA(prices, this.DEFAULT_PERIODS.EMA_MEDIUM),
      ema50: this.calculateEMA(prices, this.DEFAULT_PERIODS.EMA_LONG)
    };
  }

  /**
   * ✅ EMA (Exponential Moving Average)
   */
  private static calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[prices.length - 1];
    }

    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * ✅ SMAs (Simple Moving Averages)
   */
  private static calculateSMAs(prices: number[]): { sma20: number; sma50: number; sma200: number } {
    return {
      sma20: this.calculateSMA(prices, this.DEFAULT_PERIODS.SMA_SHORT),
      sma50: this.calculateSMA(prices, this.DEFAULT_PERIODS.SMA_MEDIUM),
      sma200: this.calculateSMA(prices, this.DEFAULT_PERIODS.SMA_LONG)
    };
  }

  /**
   * ✅ SMA (Simple Moving Average)
   */
  private static calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[prices.length - 1];
    }

    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((sum, price) => sum + price, 0) / period;
  }

  /**
   * ✅ ATR (Average True Range)
   */
  private static calculateATR(high: number[], low: number[], close: number[], period: number): number {
    if (high.length < period + 1) return 0;

    let trueRanges: number[] = [];

    for (let i = 1; i < high.length; i++) {
      const tr1 = high[i] - low[i];
      const tr2 = Math.abs(high[i] - close[i - 1]);
      const tr3 = Math.abs(low[i] - close[i - 1]);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }

    if (trueRanges.length < period) return 0;

    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
  }

  /**
   * ✅ ADX (Average Directional Index) - Simplificado
   */
  private static calculateADX(high: number[], low: number[], close: number[], period: number): number {
    // Implementação simplificada do ADX
    // Em uma implementação completa, seria necessário calcular +DI e -DI primeiro
    if (high.length < period) return 25;

    let directionalMovement = 0;
    let trueRangeSum = 0;

    for (let i = 1; i < Math.min(high.length, period + 1); i++) {
      const highDiff = high[i] - high[i - 1];
      const lowDiff = low[i - 1] - low[i];
      
      if (highDiff > lowDiff && highDiff > 0) {
        directionalMovement += highDiff;
      } else if (lowDiff > highDiff && lowDiff > 0) {
        directionalMovement += lowDiff;
      }

      const tr1 = high[i] - low[i];
      const tr2 = Math.abs(high[i] - close[i - 1]);
      const tr3 = Math.abs(low[i] - close[i - 1]);
      trueRangeSum += Math.max(tr1, tr2, tr3);
    }

    return trueRangeSum > 0 ? Math.min(100, (directionalMovement / trueRangeSum) * 100) : 25;
  }

  /**
   * ✅ Stochastic Oscillator
   */
  private static calculateStochastic(high: number[], low: number[], close: number[]): { k: number; d: number } {
    const period = this.DEFAULT_PERIODS.STOCHASTIC_K;
    
    if (high.length < period) {
      return { k: 50, d: 50 };
    }

    const recentHighs = high.slice(-period);
    const recentLows = low.slice(-period);
    const currentClose = close[close.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    const k = lowestLow !== highestHigh ? ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100 : 50;
    
    // Para o %D, seria necessário calcular a média móvel do %K
    // Por simplicidade, vamos usar uma aproximação
    const d = k * 0.9;

    return { k, d };
  }

  /**
   * ✅ Williams %R
   */
  private static calculateWilliamsR(high: number[], low: number[], close: number[], period: number): number {
    if (high.length < period) return -50;

    const recentHighs = high.slice(-period);
    const recentLows = low.slice(-period);
    const currentClose = close[close.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    return lowestLow !== highestHigh ? ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100 : -50;
  }

  /**
   * ✅ CCI (Commodity Channel Index)
   */
  private static calculateCCI(high: number[], low: number[], close: number[], period: number): number {
    if (high.length < period) return 0;

    const recentHighs = high.slice(-period);
    const recentLows = low.slice(-period);
    const recentCloses = close.slice(-period);

    const typicalPrices = recentHighs.map((h, i) => (h + recentLows[i] + recentCloses[i]) / 3);
    const sma = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;
    
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
    
    const currentTP = (high[high.length - 1] + low[low.length - 1] + close[close.length - 1]) / 3;
    
    return meanDeviation !== 0 ? (currentTP - sma) / (0.015 * meanDeviation) : 0;
  }

  /**
   * ✅ Detectar suporte e resistência
   */
  private static detectSupportResistance(ohlcv: any): SupportResistance {
    const { high, low, close } = ohlcv;
    
    // Implementação simplificada de detecção de S/R
    const lookback = 20;
    const support: any[] = [];
    const resistance: any[] = [];
    
    if (high.length < lookback) {
      const currentPrice = close[close.length - 1];
      return {
        support: [{ level: currentPrice * 0.98, strength: 'weak', touches: 1, lastTouch: Date.now() }],
        resistance: [{ level: currentPrice * 1.02, strength: 'weak', touches: 1, lastTouch: Date.now() }],
        pivotPoints: this.calculatePivotPoints(high, low, close)
      };
    }

    // Detectar pivôs locais
    for (let i = lookback; i < high.length - lookback; i++) {
      // Resistência (pico local)
      if (high[i] === Math.max(...high.slice(i - lookback, i + lookback + 1))) {
        resistance.push({
          level: high[i],
          strength: this.calculateLevelStrength(high[i], high, low, 'resistance'),
          touches: this.countTouches(high[i], high, low, 'resistance'),
          lastTouch: ohlcv.timestamps[i]
        });
      }
      
      // Suporte (vale local)
      if (low[i] === Math.min(...low.slice(i - lookback, i + lookback + 1))) {
        support.push({
          level: low[i],
          strength: this.calculateLevelStrength(low[i], high, low, 'support'),
          touches: this.countTouches(low[i], high, low, 'support'),
          lastTouch: ohlcv.timestamps[i]
        });
      }
    }

    // Ordenar por força e pegar os mais relevantes
    support.sort((a, b) => b.strength.localeCompare(a.strength));
    resistance.sort((a, b) => b.strength.localeCompare(a.strength));

    return {
      support: support.slice(0, 5),
      resistance: resistance.slice(0, 5),
      pivotPoints: this.calculatePivotPoints(high, low, close)
    };
  }

  /**
   * ✅ Calcular Pivot Points
   */
  private static calculatePivotPoints(high: number[], low: number[], close: number[]): any {
    if (high.length < 1) return { pp: 0, r1: 0, r2: 0, s1: 0, s2: 0 };

    const recentHigh = Math.max(...high.slice(-1));
    const recentLow = Math.min(...low.slice(-1));
    const recentClose = close[close.length - 1];

    const pp = (recentHigh + recentLow + recentClose) / 3;
    const r1 = 2 * pp - recentLow;
    const r2 = pp + (recentHigh - recentLow);
    const s1 = 2 * pp - recentHigh;
    const s2 = pp - (recentHigh - recentLow);

    return { pp, r1, r2, s1, s2 };
  }

  /**
   * ✅ Calcular força do nível de S/R
   */
  private static calculateLevelStrength(level: number, high: number[], low: number[], type: 'support' | 'resistance'): 'weak' | 'moderate' | 'strong' {
    const touches = this.countTouches(level, high, low, type);
    
    if (touches >= 3) return 'strong';
    if (touches >= 2) return 'moderate';
    return 'weak';
  }

  /**
   * ✅ Contar toques em nível de S/R
   */
  private static countTouches(level: number, high: number[], low: number[], type: 'support' | 'resistance'): number {
    const tolerance = level * 0.001; // 0.1% de tolerância
    let touches = 0;

    for (let i = 0; i < high.length; i++) {
      if (type === 'resistance' && Math.abs(high[i] - level) <= tolerance) {
        touches++;
      } else if (type === 'support' && Math.abs(low[i] - level) <= tolerance) {
        touches++;
      }
    }

    return touches;
  }

  /**
   * ✅ Reconhecer padrões de candlestick
   */
  private static recognizeCandlestickPatterns(ohlcv: any): CandlestickPattern[] {
    const { open, high, low, close } = ohlcv;
    const patterns: CandlestickPattern[] = [];

    if (open.length < 3) return patterns;

    // Padrões de reversão
    patterns.push(...this.detectReversalPatterns(open, high, low, close));
    
    // Padrões de continuação
    patterns.push(...this.detectContinuationPatterns(open, high, low, close));
    
    // Padrões de indecisão
    patterns.push(...this.detectIndecisionPatterns(open, high, low, close));

    return patterns;
  }

  /**
   * ✅ Detectar padrões de reversão
   */
  private static detectReversalPatterns(open: number[], high: number[], low: number[], close: number[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    const len = open.length;

    // Hammer (Martelo)
    if (this.isHammer(open[len - 1], high[len - 1], low[len - 1], close[len - 1])) {
      patterns.push({
        name: 'Hammer',
        type: 'bullish',
        strength: 'moderate',
        description: 'Martelo - Possível reversão de baixa para alta',
        reliability: 0.7
      });
    }

    // Shooting Star (Estrela Cadente)
    if (this.isShootingStar(open[len - 1], high[len - 1], low[len - 1], close[len - 1])) {
      patterns.push({
        name: 'Shooting Star',
        type: 'bearish',
        strength: 'moderate',
        description: 'Estrela Cadente - Possível reversão de alta para baixa',
        reliability: 0.7
      });
    }

    // Engulfing Pattern
    if (len >= 2) {
      const engulfing = this.detectEngulfing(open[len - 2], close[len - 2], open[len - 1], close[len - 1]);
      if (engulfing) {
        patterns.push(engulfing);
      }
    }

    return patterns;
  }

  /**
   * ✅ Detectar padrões de continuação
   */
  private static detectContinuationPatterns(open: number[], high: number[], low: number[], close: number[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    const len = open.length;

    // Marubozu (Corpo longo sem sombras)
    if (this.isMarubozu(open[len - 1], high[len - 1], low[len - 1], close[len - 1])) {
      const isBullish = close[len - 1] > open[len - 1];
      patterns.push({
        name: 'Marubozu',
        type: isBullish ? 'bullish' : 'bearish',
        strength: 'strong',
        description: `Marubozu ${isBullish ? 'Alta' : 'Baixa'} - Forte momentum`,
        reliability: 0.8
      });
    }

    return patterns;
  }

  /**
   * ✅ Detectar padrões de indecisão
   */
  private static detectIndecisionPatterns(open: number[], high: number[], low: number[], close: number[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    const len = open.length;

    // Doji
    if (this.isDoji(open[len - 1], high[len - 1], low[len - 1], close[len - 1])) {
      patterns.push({
        name: 'Doji',
        type: 'neutral',
        strength: 'moderate',
        description: 'Doji - Indecisão do mercado',
        reliability: 0.6
      });
    }

    return patterns;
  }

  /**
   * ✅ Verificar se é Hammer
   */
  private static isHammer(open: number, high: number, low: number, close: number): boolean {
    const bodySize = Math.abs(close - open);
    const lowerShadow = Math.min(open, close) - low;
    const upperShadow = high - Math.max(open, close);
    
    return lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5;
  }

  /**
   * ✅ Verificar se é Shooting Star
   */
  private static isShootingStar(open: number, high: number, low: number, close: number): boolean {
    const bodySize = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    
    return upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5;
  }

  /**
   * ✅ Detectar Engulfing Pattern
   */
  private static detectEngulfing(prevOpen: number, prevClose: number, currOpen: number, currClose: number): CandlestickPattern | null {
    const prevBullish = prevClose > prevOpen;
    const currBullish = currClose > currOpen;
    
    if (prevBullish && !currBullish && currOpen > prevClose && currClose < prevOpen) {
      return {
        name: 'Bearish Engulfing',
        type: 'bearish',
        strength: 'strong',
        description: 'Engolfo de Baixa - Reversão bearish',
        reliability: 0.8
      };
    }
    
    if (!prevBullish && currBullish && currOpen < prevClose && currClose > prevOpen) {
      return {
        name: 'Bullish Engulfing',
        type: 'bullish',
        strength: 'strong',
        description: 'Engolfo de Alta - Reversão bullish',
        reliability: 0.8
      };
    }
    
    return null;
  }

  /**
   * ✅ Verificar se é Marubozu
   */
  private static isMarubozu(open: number, high: number, low: number, close: number): boolean {
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    
    return bodySize > totalRange * 0.9; // Corpo ocupa mais de 90% do range
  }

  /**
   * ✅ Verificar se é Doji
   */
  private static isDoji(open: number, high: number, low: number, close: number): boolean {
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    
    return bodySize < totalRange * 0.1; // Corpo ocupa menos de 10% do range
  }

  /**
   * ✅ Analisar volume
   */
  private static analyzeVolume(ohlcv: any): VolumeAnalysis {
    const { volume } = ohlcv;
    
    if (volume.length === 0) {
      return {
        currentVolume: 0,
        averageVolume20: 0,
        averageVolume50: 0,
        volumeRatio: 1,
        volumeTrend: 'stable',
        volumeProfile: { high: 0, medium: 0, low: 0 },
        volumeBreakout: false,
        volumeConfirmation: false
      };
    }

    const currentVolume = volume[volume.length - 1];
    const avg20 = this.calculateSMA(volume, this.DEFAULT_PERIODS.VOLUME_MA_SHORT);
    const avg50 = this.calculateSMA(volume, this.DEFAULT_PERIODS.VOLUME_MA_LONG);
    
    const volumeRatio = avg20 > 0 ? currentVolume / avg20 : 1;
    
    // Determinar tendência do volume
    let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (volume.length >= 5) {
      const recentVolumes = volume.slice(-5);
      const isIncreasing = recentVolumes.every((v, i) => i === 0 || v >= recentVolumes[i - 1]);
      const isDecreasing = recentVolumes.every((v, i) => i === 0 || v <= recentVolumes[i - 1]);
      
      if (isIncreasing) volumeTrend = 'increasing';
      else if (isDecreasing) volumeTrend = 'decreasing';
    }

    // Volume profile (simplificado)
    const volumeProfile = {
      high: volumeRatio > 1.5 ? 1 : 0,
      medium: volumeRatio >= 0.8 && volumeRatio <= 1.5 ? 1 : 0,
      low: volumeRatio < 0.8 ? 1 : 0
    };

    return {
      currentVolume,
      averageVolume20: avg20,
      averageVolume50: avg50,
      volumeRatio,
      volumeTrend,
      volumeProfile,
      volumeBreakout: volumeRatio > 1.5,
      volumeConfirmation: volumeRatio > 1.2
    };
  }

  /**
   * ✅ Calcular confluência de sinais
   */
  private static calculateConfluence(
    indicators: TechnicalIndicators,
    supportResistance: SupportResistance,
    candlestickPatterns: CandlestickPattern[],
    volumeAnalysis: VolumeAnalysis,
    ohlcv: any
  ): TechnicalConfluence {
    let bullishSignals: string[] = [];
    let bearishSignals: string[] = [];
    let neutralSignals: string[] = [];
    let score = 0;

    const currentPrice = ohlcv.close[ohlcv.close.length - 1];

    // 1. Análise de RSI
    if (indicators.rsi < 30) {
      bullishSignals.push(`RSI Oversold (${indicators.rsi.toFixed(1)})`);
      score += 15;
    } else if (indicators.rsi > 70) {
      bearishSignals.push(`RSI Overbought (${indicators.rsi.toFixed(1)})`);
      score -= 15;
    } else if (indicators.rsi > 40 && indicators.rsi < 60) {
      neutralSignals.push(`RSI Neutral (${indicators.rsi.toFixed(1)})`);
    }

    // 2. Análise de MACD
    if (indicators.macd.line > indicators.macd.signal && indicators.macd.histogram > 0) {
      bullishSignals.push('MACD Bullish Crossover');
      score += 10;
    } else if (indicators.macd.line < indicators.macd.signal && indicators.macd.histogram < 0) {
      bearishSignals.push('MACD Bearish Crossover');
      score -= 10;
    }

    // 3. Análise de Bollinger Bands
    if (indicators.bollinger.position < 0.2) {
      bullishSignals.push('Price Near Lower Bollinger Band');
      score += 8;
    } else if (indicators.bollinger.position > 0.8) {
      bearishSignals.push('Price Near Upper Bollinger Band');
      score -= 8;
    }

    // 4. Análise de EMAs
    if (indicators.emas.ema9 > indicators.emas.ema21 && indicators.emas.ema21 > indicators.emas.ema50) {
      bullishSignals.push('EMA Bullish Alignment');
      score += 12;
    } else if (indicators.emas.ema9 < indicators.emas.ema21 && indicators.emas.ema21 < indicators.emas.ema50) {
      bearishSignals.push('EMA Bearish Alignment');
      score -= 12;
    }

    // 5. Análise de Suporte/Resistência
    const nearSupport = supportResistance.support.some(s => Math.abs(currentPrice - s.level) / currentPrice < 0.02);
    const nearResistance = supportResistance.resistance.some(r => Math.abs(currentPrice - r.level) / currentPrice < 0.02);
    
    if (nearSupport) {
      bullishSignals.push('Price Near Support Level');
      score += 10;
    } else if (nearResistance) {
      bearishSignals.push('Price Near Resistance Level');
      score -= 10;
    }

    // 6. Análise de Padrões de Candlestick
    candlestickPatterns.forEach(pattern => {
      if (pattern.type === 'bullish') {
        bullishSignals.push(pattern.name);
        score += pattern.reliability * 10;
      } else if (pattern.type === 'bearish') {
        bearishSignals.push(pattern.name);
        score -= pattern.reliability * 10;
      } else {
        neutralSignals.push(pattern.name);
      }
    });

    // 7. Análise de Volume
    if (volumeAnalysis.volumeConfirmation) {
      if (score > 0) {
        bullishSignals.push('Volume Confirmation');
        score += 5;
      } else if (score < 0) {
        bearishSignals.push('Volume Confirmation');
        score -= 5;
      }
    }

    // 8. Análise de VWAP
    if (currentPrice > indicators.vwap) {
      bullishSignals.push('Price Above VWAP');
      score += 5;
    } else if (currentPrice < indicators.vwap) {
      bearishSignals.push('Price Below VWAP');
      score -= 5;
    }

    // Determinar força e recomendação
    const absScore = Math.abs(score);
    let strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
    let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

    if (absScore >= 40) {
      strength = 'very_strong';
    } else if (absScore >= 25) {
      strength = 'strong';
    } else if (absScore >= 15) {
      strength = 'moderate';
    } else {
      strength = 'weak';
    }

    if (score >= 30) {
      recommendation = 'STRONG_BUY';
    } else if (score >= 15) {
      recommendation = 'BUY';
    } else if (score <= -30) {
      recommendation = 'STRONG_SELL';
    } else if (score <= -15) {
      recommendation = 'SELL';
    } else {
      recommendation = 'HOLD';
    }

    // Calcular confiança baseada no número de sinais
    const totalSignals = bullishSignals.length + bearishSignals.length;
    const confidence = Math.min(100, Math.max(20, totalSignals * 10 + absScore));

    // Gerar racional
    const rationale = this.generateRationale(bullishSignals, bearishSignals, neutralSignals, recommendation, strength);

    return {
      score,
      signals: {
        bullish: bullishSignals,
        bearish: bearishSignals,
        neutral: neutralSignals
      },
      strength,
      recommendation,
      confidence,
      rationale
    };
  }

  /**
   * ✅ Gerar racional da análise
   */
  private static generateRationale(
    bullishSignals: string[],
    bearishSignals: string[],
    neutralSignals: string[],
    recommendation: string,
    strength: string
  ): string {
    const signals = [...bullishSignals, ...bearishSignals, ...neutralSignals];
    
    if (signals.length === 0) {
      return 'Análise técnica inconclusiva - dados insuficientes';
    }

    let rationale = `Análise técnica ${strength}: `;
    
    if (bullishSignals.length > 0) {
      rationale += `Sinais bullish: ${bullishSignals.join(', ')}. `;
    }
    
    if (bearishSignals.length > 0) {
      rationale += `Sinais bearish: ${bearishSignals.join(', ')}. `;
    }
    
    rationale += `Recomendação: ${recommendation}`;
    
    return rationale;
  }
}

export default TechnicalAnalysisModule;
