/**
 * Regime Detection
 * 
 * Detecta regimes de mercado:
 * - Tendência vs Mean-Reversion
 * - Baixa vs Alta Liquidez
 * - Alta vs Baixa Volatilidade
 */

import { MicrostructuralFeatures } from './feature-store';

export type RegimeType = 'TRENDING' | 'MEAN_REVERTING' | 'UNKNOWN';
export type LiquidityRegime = 'HIGH' | 'LOW' | 'MEDIUM';
export type VolatilityRegime = 'HIGH' | 'LOW' | 'MEDIUM';

export interface MarketRegime {
  timestamp: number;
  symbol: string;
  type: RegimeType;
  liquidity: LiquidityRegime;
  volatility: VolatilityRegime;
  confidence: number; // 0-1
  features: {
    trendStrength: number;
    meanReversionStrength: number;
    liquidityScore: number;
    volatilityScore: number;
  };
}

export class RegimeDetector {
  private static instance: RegimeDetector;
  private regimes: Map<string, MarketRegime[]> = new Map();
  
  // Thresholds
  private readonly TREND_THRESHOLD = 0.6;
  private readonly MEAN_REVERSION_THRESHOLD = 0.6;
  private readonly HIGH_VOLATILITY_THRESHOLD = 5.0; // 5% annualized
  private readonly LOW_VOLATILITY_THRESHOLD = 1.0;
  private readonly HIGH_LIQUIDITY_THRESHOLD = 50; // Trades/min
  private readonly LOW_LIQUIDITY_THRESHOLD = 5;

  private constructor() {}

  public static getInstance(): RegimeDetector {
    if (!RegimeDetector.instance) {
      RegimeDetector.instance = new RegimeDetector();
    }
    return RegimeDetector.instance;
  }

  /**
   * Detecta regime atual baseado em features
   */
  public detectRegime(
    symbol: string,
    features: MicrostructuralFeatures[],
    recentTicks: any[]
  ): MarketRegime {
    if (features.length === 0) {
      return this.createUnknownRegime(symbol);
    }

    const latest = features[features.length - 1];
    const window = features.slice(-20); // Últimas 20 features

    // 1. Detectar tipo de regime (Trend vs Mean-Reversion)
    const { type, trendStrength, meanReversionStrength } = this.detectTrendVsMeanReversion(window);

    // 2. Detectar regime de liquidez
    const { liquidity, liquidityScore } = this.detectLiquidityRegime(window, recentTicks);

    // 3. Detectar regime de volatilidade
    const { volatility, volatilityScore } = this.detectVolatilityRegime(window);

    // Calcular confiança
    const confidence = this.calculateConfidence(
      trendStrength,
      meanReversionStrength,
      liquidityScore,
      volatilityScore
    );

    const regime: MarketRegime = {
      timestamp: latest.timestamp,
      symbol,
      type,
      liquidity,
      volatility,
      confidence,
      features: {
        trendStrength,
        meanReversionStrength,
        liquidityScore,
        volatilityScore
      }
    };

    // Armazenar
    if (!this.regimes.has(symbol)) {
      this.regimes.set(symbol, []);
    }
    const regimeBuffer = this.regimes.get(symbol)!;
    regimeBuffer.push(regime);
    if (regimeBuffer.length > 100) {
      regimeBuffer.shift();
    }

    return regime;
  }

  /**
   * Detecta Trend vs Mean-Reversion
   */
  private detectTrendVsMeanReversion(
    features: MicrostructuralFeatures[]
  ): {
    type: RegimeType;
    trendStrength: number;
    meanReversionStrength: number;
  } {
    if (features.length < 5) {
      return { type: 'UNKNOWN', trendStrength: 0, meanReversionStrength: 0 };
    }

    // Trend: momentum persistente, autocorrelação positiva
    const prices = features.map(f => f.midPrice);
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Autocorrelação de primeira ordem
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    let autocorr = 0;
    if (variance > 0 && returns.length > 1) {
      for (let i = 1; i < returns.length; i++) {
        autocorr += (returns[i] - mean) * (returns[i - 1] - mean);
      }
      autocorr = autocorr / ((returns.length - 1) * variance);
    }

    // Micro-momentum (persistência direcional)
    const microMomentums = features.map(f => f.microMomentum);
    const avgMicroMomentum = microMomentums.reduce((sum, m) => sum + Math.abs(m), 0) / microMomentums.length;

    // Trend strength: autocorrelação positiva + momentum persistente
    const trendStrength = (autocorr + 1) / 2; // Normalizar [-1, 1] -> [0, 1]
    const momentumContribution = Math.min(avgMicroMomentum / 2, 1); // Normalizar
    const combinedTrendStrength = (trendStrength * 0.7 + momentumContribution * 0.3);

    // Mean-reversion strength: autocorrelação negativa + reversão de sinais
    const meanReversionStrength = 1 - combinedTrendStrength;

    const type: RegimeType = 
      combinedTrendStrength >= this.TREND_THRESHOLD ? 'TRENDING' :
      meanReversionStrength >= this.MEAN_REVERSION_THRESHOLD ? 'MEAN_REVERTING' :
      'UNKNOWN';

    return { type, trendStrength: combinedTrendStrength, meanReversionStrength };
  }

  /**
   * Detecta regime de liquidez
   */
  private detectLiquidityRegime(
    features: MicrostructuralFeatures[],
    recentTicks: any[]
  ): {
    liquidity: LiquidityRegime;
    liquidityScore: number;
  } {
    const latest = features[features.length - 1];

    // Múltiplos indicadores de liquidez
    const spreads = features.map(f => f.relativeSpread);
    const avgSpread = spreads.reduce((sum, s) => sum + s, 0) / spreads.length;
    
    // Volume médio
    const tickCount = recentTicks.length;
    const avgVolume = recentTicks.reduce((sum, t) => sum + (t.quantity || 0), 0) / Math.max(tickCount, 1);
    
    // Depth do order book (simulado via queue imbalance)
    const avgQueueImbalance = features.map(f => Math.abs(f.queueImbalance)).reduce((sum, q) => sum + q, 0) / features.length;

    // Score combinado de liquidez (0-1)
    const spreadScore = Math.max(0, 1 - avgSpread / 100); // Spread baixo = alta liquidez
    const volumeScore = Math.min(1, avgVolume / 100); // Volume alto = alta liquidez
    const depthScore = 1 - avgQueueImbalance; // Queue balanceada = alta liquidez

    const liquidityScore = (spreadScore * 0.4 + volumeScore * 0.4 + depthScore * 0.2);

    const liquidity: LiquidityRegime =
      liquidityScore >= 0.7 ? 'HIGH' :
      liquidityScore <= 0.3 ? 'LOW' :
      'MEDIUM';

    return { liquidity, liquidityScore };
  }

  /**
   * Detecta regime de volatilidade
   */
  private detectVolatilityRegime(
    features: MicrostructuralFeatures[]
  ): {
    volatility: VolatilityRegime;
    volatilityScore: number;
  } {
    const volatilities = features.map(f => f.realizedVolatility);
    const avgVolatility = volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length;

    // Normalizar para score 0-1
    const volatilityScore = Math.min(avgVolatility / 10, 1); // 10% = máxima

    const volatility: VolatilityRegime =
      avgVolatility >= this.HIGH_VOLATILITY_THRESHOLD ? 'HIGH' :
      avgVolatility <= this.LOW_VOLATILITY_THRESHOLD ? 'LOW' :
      'MEDIUM';

    return { volatility, volatilityScore };
  }

  /**
   * Calcula confiança do regime detectado
   */
  private calculateConfidence(
    trendStrength: number,
    meanReversionStrength: number,
    liquidityScore: number,
    volatilityScore: number
  ): number {
    // Confiança baseada em quão claro são os sinais
    const typeConfidence = Math.max(trendStrength, meanReversionStrength);
    const regimeConfidence = (liquidityScore + volatilityScore) / 2;
    
    return (typeConfidence * 0.6 + regimeConfidence * 0.4);
  }

  /**
   * Cria regime desconhecido
   */
  private createUnknownRegime(symbol: string): MarketRegime {
    return {
      timestamp: Date.now(),
      symbol,
      type: 'UNKNOWN',
      liquidity: 'MEDIUM',
      volatility: 'MEDIUM',
      confidence: 0,
      features: {
        trendStrength: 0,
        meanReversionStrength: 0,
        liquidityScore: 0.5,
        volatilityScore: 0.5
      }
    };
  }

  /**
   * Obtém regime mais recente
   */
  public getLatestRegime(symbol: string): MarketRegime | null {
    const regimes = this.regimes.get(symbol);
    return regimes && regimes.length > 0 ? regimes[regimes.length - 1] : null;
  }
}

export const regimeDetector = RegimeDetector.getInstance();

