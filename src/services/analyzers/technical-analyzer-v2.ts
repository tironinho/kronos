// ============================================================================
// TECHNICAL ANALYZER V2 - Análise Técnica MELHORADA com Sinais Reais
// ============================================================================

import { getBinanceClient } from '../binance-api';

export interface TechnicalSignal {
  // Indicadores
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number; bandwidth: number };
  volumeProfile: { high: number; low: number; avg: number };
  
  // Price Action
  trend: 'STRONG_UP' | 'UP' | 'SIDEWAYS' | 'DOWN' | 'STRONG_DOWN';
  momentum: number;  // -3 a +3
  supportResistance: Array<{ level: number; strength: 'weak' | 'medium' | 'strong' }>;
  
  // Padrões
  reversalPattern?: 'hammer' | 'doji' | 'engulfing_bullish' | 'engulfing_bearish';
  divergence?: 'bullish' | 'bearish' | null;
  
  // Score Final
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;  // 0 a 100%
  rationale: string;
}

export class TechnicalAnalyzerV2 {
  private binanceClient = getBinanceClient();
  
  /**
   * Analisa técnicamente com REGRAS REAIS de trading
   */
  async analyze(symbol: string, timeframe: string = '1h'): Promise<TechnicalSignal> {
    console.log(`📊 [V2] Analisando ${symbol} tecnicamente (${timeframe})...`);
    
    // Buscar dados
    const klines = await this.binanceClient.getKlines(symbol, timeframe, 200);
    const closes = klines.map(k => parseFloat(k.close));
    const highs = klines.map(k => parseFloat(k.high));
    const lows = klines.map(k => parseFloat(k.low));
    const volumes = klines.map(k => parseFloat(k.volume));
    
    // Calcular indicadores
    const rsi = this.calculateRSI(closes);
    const macd = this.calculateMACD(closes);
    const bollinger = this.calculateBollingerBands(closes);
    const volumeProfile = this.calculateVolumeProfile(volumes);
    
    // Identificar tendência
    const trend = this.identifyTrend(closes, highs, lows);
    
    // Identificar suporte/resistência
    const supportResistance = this.identifySupportResistance(highs, lows, closes);
    
    // Verificar divergências
    const divergence = this.detectDivergence(closes, rsi, macd.histogram);
    
    // Verificar padrões de reversão
    const reversalPattern = this.detectReversalPattern(klines.slice(-5));
    
    // Calcular momentum
    const momentum = this.calculateMomentum(closes, rsi, macd.histogram);
    
    // Gerar sinal baseado em CONFLUÊNCIA
    const signal = this.generateSignal({
      rsi,
      macd,
      bollinger,
      trend,
      momentum,
      divergence,
      reversalPattern,
      volumeProfile
    });
    
    return signal;
  }
  
  /**
   * RSI (14 períodos)
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    const deltas = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = deltas.filter(d => d > 0);
    const losses = deltas.filter(d => d < 0);
    
    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = Math.abs(losses.reduce((a, b) => a + b, 0) / period);
    
    const rs = avgGain / (avgLoss || 0.001);
    return 100 - (100 / (1 + rs));
  }
  
  /**
   * MACD
   */
  private calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const value = ema12 - ema26;
    const signal = this.calculateEMA([value], 9);
    const histogram = value - signal;
    
    return { value, signal, histogram };
  }
  
  /**
   * EMA
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const multiplier = 2 / (period + 1);
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
  
  /**
   * Bollinger Bands
   */
  private calculateBollingerBands(prices: number[], period: number = 20, std: number = 2): { upper: number; middle: number; lower: number; bandwidth: number } {
    if (prices.length < period) {
      const mid = prices[prices.length - 1];
      return { upper: mid, middle: mid, lower: mid, bandwidth: 0 };
    }
    
    const sma = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
    const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const upper = sma + (std * stdDev);
    const lower = sma - (std * stdDev);
    const bandwidth = ((upper - lower) / sma) * 100;
    
    return { upper, middle: sma, lower, bandwidth };
  }
  
  /**
   * Perfil de volume
   */
  private calculateVolumeProfile(volumes: number[]): { high: number; low: number; avg: number } {
    const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recent = volumes.slice(-20);
    const high = Math.max(...recent);
    const low = Math.min(...recent);
    
    return { high, low, avg };
  }
  
  /**
   * Identifica tendência
   */
  private identifyTrend(closes: number[], highs: number[], lows: number[]): 'STRONG_UP' | 'UP' | 'SIDEWAYS' | 'DOWN' | 'STRONG_DOWN' {
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const currentPrice = closes[closes.length - 1];
    
    const priceVsSma20 = currentPrice / sma20;
    const sma20VsSma50 = sma20 / sma50;
    
    if (priceVsSma20 > 1.02 && sma20VsSma50 > 1.01) return 'STRONG_UP';
    if (priceVsSma20 > 1.0 && sma20VsSma50 > 1.0) return 'UP';
    if (priceVsSma20 < 0.98 && sma20VsSma50 < 0.99) return 'STRONG_DOWN';
    if (priceVsSma20 < 1.0 && sma20VsSma50 < 1.0) return 'DOWN';
    return 'SIDEWAYS';
  }
  
  /**
   * Identifica suporte/resistência
   */
  private identifySupportResistance(highs: number[], lows: number[], closes: number[]): Array<{ level: number; strength: 'weak' | 'medium' | 'strong' }> {
    // Análise de pivôs
    const levels: Array<{ level: number; strength: 'weak' | 'medium' | 'strong'; touches: number }> = [];
    
    for (let i = 2; i < highs.length - 2; i++) {
      // Resistência
      if (highs[i] > highs[i-1] && highs[i] > highs[i+1] && highs[i] > highs[i-2] && highs[i] > highs[i+2]) {
        const existing = levels.find(l => Math.abs(l.level - highs[i]) / highs[i] < 0.01);
        if (existing) existing.touches++;
        else levels.push({ level: highs[i], strength: 'weak', touches: 1 });
      }
      
      // Suporte
      if (lows[i] < lows[i-1] && lows[i] < lows[i+1] && lows[i] < lows[i-2] && lows[i] < lows[i+2]) {
        const existing = levels.find(l => Math.abs(l.level - lows[i]) / lows[i] < 0.01);
        if (existing) existing.touches++;
        else levels.push({ level: lows[i], strength: 'weak', touches: 1 });
      }
    }
    
    // Determinar força
    return levels.map(l => ({
      level: l.level,
      strength: l.touches >= 3 ? 'strong' : l.touches >= 2 ? 'medium' : 'weak' as 'weak' | 'medium' | 'strong'
    }));
  }
  
  /**
   * Detecta divergências
   */
  private detectDivergence(closes: number[], rsi: number, histogram: number): 'bullish' | 'bearish' | null {
    // Simplificado: verifica últimos 5 períodos
    const recentCloses = closes.slice(-5);
    const recentRSI = [rsi]; // Simplificado
    
    if (recentCloses[recentCloses.length - 1] < recentCloses[0] && histogram > 0) {
      return 'bullish';
    }
    
    if (recentCloses[recentCloses.length - 1] > recentCloses[0] && histogram < 0) {
      return 'bearish';
    }
    
    return null;
  }
  
  /**
   * Detecta padrões de reversão
   */
  private detectReversalPattern(candles: any[]): 'hammer' | 'doji' | 'engulfing_bullish' | 'engulfing_bearish' | undefined {
    if (candles.length < 2) return;
    
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    
    const open = parseFloat(last.open);
    const close = parseFloat(last.close);
    const high = parseFloat(last.high);
    const low = parseFloat(last.low);
    
    const body = Math.abs(close - open);
    const range = high - low;
    
    // Hammer
    if (body < range * 0.3 && close > open) return 'hammer';
    
    // Doji
    if (body < range * 0.1) return 'doji';
    
    // Engulfing
    if (close > open && parseFloat(prev.close) < parseFloat(prev.open) && 
        close > parseFloat(prev.open) && open < parseFloat(prev.close)) {
      return 'engulfing_bullish';
    }
    
    if (close < open && parseFloat(prev.close) > parseFloat(prev.open) && 
        close < parseFloat(prev.open) && open > parseFloat(prev.close)) {
      return 'engulfing_bearish';
    }
  }
  
  /**
   * Calcula momentum
   */
  private calculateMomentum(closes: number[], rsi: number, histogram: number): number {
    // Score -3 a +3
    let score = 0;
    
    // RSI
    if (rsi < 30) score += 2;      // Oversold
    else if (rsi < 40) score += 1;
    else if (rsi > 70) score -= 2;  // Overbought
    else if (rsi > 60) score -= 1;
    
    // MACD Histogram
    if (histogram > 0) score += 1;
    else score -= 1;
    
    // Aceleração (diferença entre últimos)
    const accel = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
    if (accel > 0.005) score += 0.5;
    else if (accel < -0.005) score -= 0.5;
    
    return Math.max(-3, Math.min(3, score));
  }
  
  /**
   * Gera sinal baseado em CONFLUÊNCIA
   */
  private generateSignal(data: any): TechnicalSignal {
    let buySignals = 0;
    let sellSignals = 0;
    let confidence = 60;
    const reasons: string[] = [];
    
    // RSI
    if (data.rsi < 35) { buySignals++; reasons.push('RSI oversold'); confidence += 10; }
    else if (data.rsi > 65) { sellSignals++; reasons.push('RSI overbought'); confidence += 10; }
    
    // MACD
    if (data.macd.value > data.macd.signal && data.macd.histogram > 0) { 
      buySignals++; 
      reasons.push('MACD bullish crossover'); 
      confidence += 8; 
    }
    else if (data.macd.value < data.macd.signal && data.macd.histogram < 0) { 
      sellSignals++; 
      reasons.push('MACD bearish crossover'); 
      confidence += 8; 
    }
    
    // Bollinger
    const price = data.bollinger.middle; // Simplificado
    if (price < data.bollinger.lower * 0.99) { buySignals++; reasons.push('Preço perto da banda inferior'); confidence += 7; }
    else if (price > data.bollinger.upper * 1.01) { sellSignals++; reasons.push('Preço perto da banda superior'); confidence += 7; }
    
    // Tendência (peso reduzido para balancear)
    if (data.trend === 'STRONG_UP' || data.trend === 'UP') { buySignals += 1; reasons.push('Tendência de alta'); }
    else if (data.trend === 'STRONG_DOWN' || data.trend === 'DOWN') { sellSignals += 1; reasons.push('Tendência de baixa'); }
    
    // Momentum
    if (data.momentum >= 1.5) { buySignals++; confidence += 5; }
    else if (data.momentum <= -1.5) { sellSignals++; confidence += 5; }
    
    // Divergência (peso reduzido para balancear)
    if (data.divergence === 'bullish') { buySignals += 1; reasons.push('Divergência bullish'); confidence += 12; }
    else if (data.divergence === 'bearish') { sellSignals += 1; reasons.push('Divergência bearish'); confidence += 12; }
    
    // Padrão de reversão
    if (data.reversalPattern === 'hammer' || data.reversalPattern === 'engulfing_bullish') { 
      buySignals++; 
      reasons.push(`Padrão: ${data.reversalPattern}`); 
      confidence += 8; 
    }
    else if (data.reversalPattern === 'engulfing_bearish') { 
      sellSignals++; 
      reasons.push('Padrão bearish'); 
      confidence += 8; 
    }
    
    // Volume
    if (data.volumeProfile.avg > data.volumeProfile.low * 1.2) { 
      buySignals++; 
      reasons.push('Volume acima da média'); 
    }
    
    // Determinar sinal final
    const signalDiff = buySignals - sellSignals;
    let signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    
    // ✅ AJUSTE FINAL: Thresholds bem permissivos para gerar mais sinais
    if (signalDiff >= 2 && confidence >= 45) signal = 'STRONG_BUY';
    else if (signalDiff >= 1 && confidence >= 40) signal = 'BUY';
    else if (signalDiff <= -2 && confidence >= 45) signal = 'STRONG_SELL';
    else if (signalDiff <= -1 && confidence >= 40) signal = 'SELL';
    else signal = 'HOLD';
    
    return {
      rsi: data.rsi,
      macd: data.macd,
      bollinger: data.bollinger,
      volumeProfile: data.volumeProfile,
      trend: data.trend,
      momentum: data.momentum,
      supportResistance: data.supportResistance,
      reversalPattern: data.reversalPattern,
      divergence: data.divergence,
      signal,
      confidence: Math.min(95, confidence),
      rationale: reasons.join(', ') || 'Sinais neutros'
    };
  }
}

export const technicalAnalyzerV2 = new TechnicalAnalyzerV2();

