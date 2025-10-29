// ============================================================================
// TECHNICAL ANALYZER - Análise Técnica Avançada
// ============================================================================

import { getBinanceClient } from '../binance-api';

export interface TechnicalAnalysis {
  // Indicadores
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  bollingerBands: { upper: number; middle: number; lower: number };
  vwap: number;
  ema9: number;
  ema21: number;
  ema50: number;
  
  // Price Action
  supportLevels: number[];
  resistanceLevels: number[];
  trend: 'up' | 'down' | 'sideways';
  
  // Padrões de Candles
  candlePattern: string;
  engulfingPattern: boolean;
  
  // Volume
  volume: number;
  volumeMA: number;
  
  // Confluência
  confluenceScore: number;  // -10 a +10
  
  // Reversões
  divergenceBullish: boolean;
  divergenceBearish: boolean;
}

export class TechnicalAnalyzer {
  private binanceClient = getBinanceClient();
  private priceHistory: Map<string, number[]> = new Map();
  
  /**
   * Analisa símbolo tecnicamente (multi-timeframe)
   */
  async analyze(symbol: string, timeframe: string = '1h'): Promise<TechnicalAnalysis> {
    console.log(`📊 Analisando ${symbol} tecnicamente (${timeframe})...`);
    
    // Buscar dados históricos
    const klines = await this.binanceClient.getKlines(symbol, timeframe, 200);
    const prices = klines.map(k => parseFloat(k.close));
    const volumes = klines.map(k => parseFloat(k.volume));
    const highs = klines.map(k => parseFloat(k.high));
    const lows = klines.map(k => parseFloat(k.low));
    
    // Guardar histórico
    this.priceHistory.set(symbol, prices);
    
    // Calcular indicadores
    const rsi = this.calculateRSI(prices, 14);
    const macd = this.calculateMACD(prices);
    const bollingerBands = this.calculateBollingerBands(prices, 20);
    const ema9 = this.calculateEMA(prices, 9);
    const ema21 = this.calculateEMA(prices, 21);
    const ema50 = this.calculateEMA(prices, 50);
    
    // VWAP aproximado (média ponderada)
    const vwap = this.calculateVWAPApprox(prices, volumes);
    
    // Identificar suportes e resistências
    const { supports, resistances } = this.identifySupportResistance(highs, lows, prices);
    
    // Determinar tendência
    const trend = this.determineTrend(prices, ema9, ema21, ema50);
    
    // Padrões de candles
    const candlePattern = this.detectCandlePattern(klines.slice(-2));
    const engulfingPattern = this.detectEngulfing(klines.slice(-2));
    
    // Volume
    const volume = volumes[volumes.length - 1];
    const volumeMA = this.calculateSMA(volumes, 20);
    
    // Divergências
    const divergence = this.detectDivergence(prices, rsi, macd);
    
    // Calcular score de confluência (-10 a +10)
    const confluenceScore = this.calculateConfluenceScore({
      rsi,
      macd,
      ema9,
      ema21,
      ema50,
      trend,
      supportLevels: supports,
      resistanceLevels: resistances,
      volume: volume,
      volumeMA: volumeMA,
      divergence
    });
    
    const analysis: TechnicalAnalysis = {
      rsi,
      macd,
      bollingerBands,
      vwap,
      ema9,
      ema21,
      ema50,
      supportLevels: supports,
      resistanceLevels: resistances,
      trend,
      candlePattern,
      engulfingPattern,
      volume,
      volumeMA,
      confluenceScore,
      divergenceBullish: divergence.bullish,
      divergenceBearish: divergence.bearish
    };
    
    console.log(`✅ Análise técnica concluída: ${symbol} - Confluência: ${confluenceScore}`);
    
    return analysis;
  }
  
  /**
   * Calcula RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
  
  /**
   * Calcula MACD
   */
  private calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdValue = ema12 - ema26;
    const signal = this.calculateEMA(prices.slice(-12), 9);
    
    return {
      value: macdValue,
      signal,
      histogram: macdValue - signal
    };
  }
  
  /**
   * Calcula Bollinger Bands
   */
  private calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(prices, period);
    const stdDev = this.calculateStdDev(prices.slice(-period));
    
    const upper = sma + (2 * stdDev);
    const lower = sma - (2 * stdDev);
    
    return { upper, middle: sma, lower };
  }
  
  /**
   * Calcula EMA (Exponential Moving Average)
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const k = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * k) + (ema * (1 - k));
    }
    
    return ema;
  }
  
  /**
   * Calcula SMA (Simple Moving Average)
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
    
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }
  
  /**
   * Calcula desvio padrão
   */
  private calculateStdDev(prices: number[]): number {
    if (prices.length === 0) return 0;
    
    const sma = this.calculateSMA(prices, prices.length);
    const variance = prices.reduce((acc, price) => acc + Math.pow(price - sma, 2), 0) / prices.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Calcula VWAP aproximado
   */
  private calculateVWAPApprox(prices: number[], volumes: number[]): number {
    let totalValue = 0;
    let totalVolume = 0;
    
    for (let i = 0; i < prices.length && i < volumes.length; i++) {
      totalValue += prices[i] * volumes[i];
      totalVolume += volumes[i];
    }
    
    return totalVolume > 0 ? totalValue / totalVolume : prices[prices.length - 1];
  }
  
  /**
   * Identifica suportes e resistências
   */
  private identifySupportResistance(highs: number[], lows: number[], prices: number[]): { supports: number[]; resistances: number[] } {
    const supports: number[] = [];
    const resistances: number[] = [];
    
    const threshold = prices[prices.length - 1] * 0.001; // 0.1% threshold
    
    // Buscar fundos (suportes)
    for (let i = 2; i < lows.length - 2; i++) {
      if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && 
          lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
        supports.push(lows[i]);
      }
    }
    
    // Buscar topos (resistências)
    for (let i = 2; i < highs.length - 2; i++) {
      if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && 
          highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
        resistances.push(highs[i]);
      }
    }
    
    // Remover duplicatas próximas
    const uniqueSupports = this.removeCloseValues(supports, threshold).slice(-3);
    const uniqueResistances = this.removeCloseValues(resistances, threshold).slice(-3);
    
    return { supports: uniqueSupports, resistances: uniqueResistances };
  }
  
  /**
   * Remove valores muito próximos
   */
  private removeCloseValues(values: number[], threshold: number): number[] {
    return values.filter((val, i, arr) => {
      return !arr.slice(0, i).some(v => Math.abs(v - val) < threshold);
    });
  }
  
  /**
   * Determina tendência
   */
  private determineTrend(prices: number[], ema9: number, ema21: number, ema50: number): 'up' | 'down' | 'sideways' {
    const currentPrice = prices[prices.length - 1];
    
    if (currentPrice > ema9 && ema9 > ema21 && ema21 > ema50) {
      return 'up';
    } else if (currentPrice < ema9 && ema9 < ema21 && ema21 < ema50) {
      return 'down';
    }
    
    return 'sideways';
  }
  
  /**
   * Detecta padrões de candles
   */
  private detectCandlePattern(klines: any[]): string {
    if (klines.length < 1) return 'normal';
    
    const lastCandle = klines[klines.length - 1];
    const open = parseFloat(lastCandle.open);
    const close = parseFloat(lastCandle.close);
    const high = parseFloat(lastCandle.high);
    const low = parseFloat(lastCandle.low);
    
    const body = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    
    // Hammer
    if (lowerShadow > 2 * body && upperShadow < body * 0.5 && close > open) {
      return 'hammer';
    }
    
    // Doji
    if (body < (high - low) * 0.1) {
      return 'doji';
    }
    
    // Engulfing
    if (klines.length >= 2) {
      const prevCandle = klines[klines.length - 2];
      const prevOpen = parseFloat(prevCandle.open);
      const prevClose = parseFloat(prevCandle.close);
      
      if (close > open && prevClose < prevOpen && open < prevClose && close > prevOpen) {
        return 'bullish_engulfing';
      }
      
      if (close < open && prevClose > prevOpen && open > prevClose && close < prevOpen) {
        return 'bearish_engulfing';
      }
    }
    
    return 'normal';
  }
  
  /**
   * Detecta engulfing pattern
   */
  private detectEngulfing(klines: any[]): boolean {
    return this.detectCandlePattern(klines).includes('engulfing');
  }
  
  /**
   * Detecta divergências
   */
  private detectDivergence(prices: number[], rsi: number, macd: { value: number }): { bullish: boolean; bearish: boolean } {
    // Simplificado: compara últimas 10 candles
    if (prices.length < 10) return { bullish: false, bearish: false };
    
    const recentPrices = prices.slice(-10);
    const highestPrice = Math.max(...recentPrices);
    const lowestPrice = Math.min(...recentPrices);
    
    const rsiRelative = rsi;
    
    // Divergência bullish: preço faz fundo mais baixo mas RSI/MACD não confirmam
    // (aprox.)
    const bullish = rsi < 40 && prices[prices.length - 1] < prices[prices.length - 5];
    
    // Divergência bearish: preço faz topo mais alto mas RSI/MACD não confirmam
    const bearish = rsi > 60 && prices[prices.length - 1] > prices[prices.length - 5];
    
    return { bullish, bearish };
  }
  
  /**
   * Calcula score de confluência (-10 a +10)
   */
  private calculateConfluenceScore(indicators: any): number {
    let score = 0;
    
    // RSI
    if (indicators.rsi < 30) score += 2;        // Oversold
    else if (indicators.rsi > 70) score -= 2;   // Overbought
    else if (indicators.rsi > 50) score += 1;   // Bullish momentum
    else if (indicators.rsi < 50) score -= 1;    // Bearish momentum
    
    // MACD
    if (indicators.macd.histogram > 0) score += 1;   // Bullish momentum
    else score -= 1;
    
    // EMAs
    if (indicators.trend === 'up') score += 2;
    else if (indicators.trend === 'down') score -= 2;
    
    // Volume
    if (indicators.volume > indicators.volumeMA * 1.2) score += 1; // Volume alto
    
    // Divergência
    if (indicators.divergence.bullish) score += 2;
    if (indicators.divergence.bearish) score -= 2;
    
    // Normalizar para -10 a +10
    return Math.max(-10, Math.min(10, score));
  }
  
  /**
   * Retorna níveis ótimos de entrada
   */
  getOptimalEntry(symbol: string, analysis: TechnicalAnalysis): { price: number; level: 'support' | 'resistance' } | null {
    const priceHistory = this.priceHistory.get(symbol);
    if (!priceHistory) return null;
    
    const currentPrice = priceHistory[priceHistory.length - 1];
    
    // Para BUY: sugerir próximo suporte abaixo
    const nearestSupport = analysis.supportLevels
      .filter(s => s < currentPrice * 0.99)  // Pelo menos 1% abaixo
      .sort((a, b) => b - a)[0];
    
    if (nearestSupport) {
      return { price: nearestSupport, level: 'support' };
    }
    
    // Para SELL: sugerir próxima resistência acima
    const nearestResistance = analysis.resistanceLevels
      .filter(r => r > currentPrice * 1.01)  // Pelo menos 1% acima
      .sort((a, b) => a - b)[0];
    
    if (nearestResistance) {
      return { price: nearestResistance, level: 'resistance' };
    }
    
    return null;
  }

  /**
   * Análise MULTI-TIMEFRAME para otimizar entrada
   * Analisa: Weekly, Daily, 4h, 1h, 15m, 1m
   */
  async analyzeMultiTimeframe(symbol: string): Promise<{
    weekly: TechnicalAnalysis;
    daily: TechnicalAnalysis;
    fourHour: TechnicalAnalysis;
    oneHour: TechnicalAnalysis;
    fifteenMin: TechnicalAnalysis;
    oneMin: TechnicalAnalysis;
    confluenceScore: number;  // Score consolidado de todos timeframes
    recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    rationale: string;
  }> {
    console.log(`\n📊=== ANÁLISE MULTI-TIMEFRAME: ${symbol} ===`);
    
    // Analisar todos os timeframes em paralelo
    const [weekly, daily, fourHour, oneHour, fifteenMin, oneMin] = await Promise.all([
      this.analyze(symbol, '1w'),
      this.analyze(symbol, '1d'),
      this.analyze(symbol, '4h'),
      this.analyze(symbol, '1h'),
      this.analyze(symbol, '15m'),
      this.analyze(symbol, '1m')
    ]);

    console.log(`📈 Weekly: RSI=${weekly.rsi.toFixed(2)}, Confluência=${weekly.confluenceScore}`);
    console.log(`📈 Daily: RSI=${daily.rsi.toFixed(2)}, Confluência=${daily.confluenceScore}`);
    console.log(`📈 4H: RSI=${fourHour.rsi.toFixed(2)}, Confluência=${fourHour.confluenceScore}`);
    console.log(`📈 1H: RSI=${oneHour.rsi.toFixed(2)}, Confluência=${oneHour.confluenceScore}`);
    console.log(`📈 15M: RSI=${fifteenMin.rsi.toFixed(2)}, Confluência=${fifteenMin.confluenceScore}`);
    console.log(`📈 1M: RSI=${oneMin.rsi.toFixed(2)}, Confluência=${oneMin.confluenceScore}`);

    // Calcular score consolidado (timeframes maiores têm mais peso)
    const confluenceScore = 
      weekly.confluenceScore * 0.30 +      // 30% - maior timeframe, mais importante
      daily.confluenceScore * 0.25 +       // 25%
      fourHour.confluenceScore * 0.20 +    // 20%
      oneHour.confluenceScore * 0.15 +     // 15%
      fifteenMin.confluenceScore * 0.07 +  // 7%
      oneMin.confluenceScore * 0.03;       // 3%

    // Determinar recomendação baseada em score
    let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    if (confluenceScore >= 7) recommendation = 'STRONG_BUY';
    else if (confluenceScore >= 3) recommendation = 'BUY';
    else if (confluenceScore <= -7) recommendation = 'STRONG_SELL';
    else if (confluenceScore <= -3) recommendation = 'SELL';
    else recommendation = 'HOLD';

    // Gerar rationale
    const longTermAlign = (weekly.confluenceScore > 0 && daily.confluenceScore > 0) || 
                          (weekly.confluenceScore < 0 && daily.confluenceScore < 0);
    const shortTermAlign = (fourHour.confluenceScore > 0 && oneHour.confluenceScore > 0 && fifteenMin.confluenceScore > 0) ||
                          (fourHour.confluenceScore < 0 && oneHour.confluenceScore < 0 && fifteenMin.confluenceScore < 0);

    let rationale = '';
    if (longTermAlign && shortTermAlign) {
      rationale = `${recommendation}: Alinhamento perfeito entre timeframes (longo prazo + curto prazo)`;
    } else if (longTermAlign) {
      rationale = `${recommendation}: Tendência de longo prazo definida (Weekly/Daily alinhados)`;
    } else if (shortTermAlign) {
      rationale = `${recommendation}: Momentum de curto prazo forte (4H/1H/15M alinhados)`;
    } else {
      rationale = `HOLD: Sinais conflitantes entre timeframes. Aguardar maior confluência.`;
    }

    console.log(`🎯 Score consolidado MULTI-TF: ${confluenceScore.toFixed(2)}`);
    console.log(`📋 Recomendação: ${recommendation}`);
    console.log(`💡 ${rationale}`);

    return {
      weekly,
      daily,
      fourHour,
      oneHour,
      fifteenMin,
      oneMin,
      confluenceScore,
      recommendation,
      rationale
    };
  }
}

export const technicalAnalyzer = new TechnicalAnalyzer();

