/**
 * HFT Labeling System
 * 
 * Implementa sistemas de labeling profissional:
 * - Triple-Barrier Method (Lopez de Prado)
 * - Meta-Labeling (SML)
 * - Dynamic Thresholds
 */

export interface LabelConfig {
  // Triple-Barrier parameters
  profitBarrier: number; // % para Take Profit
  stopBarrier: number; // % para Stop Loss
  timeBarrier: number; // minutos para timeout
  volatilityMultiplier?: number; // multiplicador de volatilidade para barriers dinâmicos
}

export interface LabelResult {
  label: number; // 1 = win, 0 = loss, -1 = timeout
  labelType: 'triple_barrier' | 'meta_label';
  exitReason: 'profit' | 'stop' | 'timeout';
  exitTime: number; // timestamp
  exitPrice: number;
  returnPercent: number;
  confidence: number; // 0-1 (para meta-labeling)
}

export interface PriceBarrier {
  upper: number; // Take Profit
  lower: number; // Stop Loss
  expiration: number; // timestamp
}

export class LabelingSystem {
  private static instance: LabelingSystem;
  private config: LabelConfig;

  private constructor() {
    // Configuração padrão conservadora
    this.config = {
      profitBarrier: 2.0, // 2% TP
      stopBarrier: 1.0, // 1% SL
      timeBarrier: 60, // 60 minutos
      volatilityMultiplier: 1.5
    };
  }

  public static getInstance(): LabelingSystem {
    if (!LabelingSystem.instance) {
      LabelingSystem.instance = new LabelingSystem();
    }
    return LabelingSystem.instance;
  }

  /**
   * Configura parâmetros de labeling
   */
  public configure(config: Partial<LabelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * ✅ Triple-Barrier Method (Lopez de Prado)
   * 
   * Define 3 barreiras:
   * 1. Profit barrier (TP)
   * 2. Stop barrier (SL)
   * 3. Time barrier (timeout)
   * 
   * O primeiro a ser atingido define o label
   */
  public calculateTripleBarrier(
    entryPrice: number,
    side: 'BUY' | 'SELL',
    currentVolatility: number,
    timestamp: number = Date.now()
  ): PriceBarrier {
    // ✅ Barriers dinâmicos baseados em volatilidade
    const volAdjustment = currentVolatility * (this.config.volatilityMultiplier || 1.5);
    const profitPct = this.config.profitBarrier + (volAdjustment * 0.5);
    const stopPct = this.config.stopBarrier + (volAdjustment * 0.3);

    let upper: number;
    let lower: number;

    if (side === 'BUY') {
      upper = entryPrice * (1 + profitPct / 100); // TP acima
      lower = entryPrice * (1 - stopPct / 100); // SL abaixo
    } else {
      // SELL: invertido
      upper = entryPrice * (1 + stopPct / 100); // SL acima
      lower = entryPrice * (1 - profitPct / 100); // TP abaixo
    }

    const expiration = timestamp + (this.config.timeBarrier * 60 * 1000);

    return { upper, lower, expiration };
  }

  /**
   * ✅ Processa histórico de preços e gera labels
   */
  public async processHistoricalPrices(
    prices: Array<{ price: number; timestamp: number }>,
    entryPrice: number,
    entryTime: number,
    side: 'BUY' | 'SELL',
    volatility: number
  ): Promise<LabelResult | null> {
    const barriers = this.calculateTripleBarrier(entryPrice, side, volatility, entryTime);
    
    // Verificar qual barreira foi atingida primeiro
    for (const tick of prices) {
      if (tick.timestamp < entryTime) continue; // Ignora ticks anteriores
      if (tick.timestamp > barriers.expiration) {
        // Timeout atingido
        return {
          label: -1,
          labelType: 'triple_barrier',
          exitReason: 'timeout',
          exitTime: barriers.expiration,
          exitPrice: tick.price,
          returnPercent: ((tick.price - entryPrice) / entryPrice) * 100 * (side === 'BUY' ? 1 : -1),
          confidence: 0.5
        };
      }

      if (side === 'BUY') {
        // Profit barrier (upper)
        if (tick.price >= barriers.upper) {
          return {
            label: 1,
            labelType: 'triple_barrier',
            exitReason: 'profit',
            exitTime: tick.timestamp,
            exitPrice: tick.price,
            returnPercent: ((tick.price - entryPrice) / entryPrice) * 100,
            confidence: 0.9
          };
        }
        // Stop barrier (lower)
        if (tick.price <= barriers.lower) {
          return {
            label: 0,
            labelType: 'triple_barrier',
            exitReason: 'stop',
            exitTime: tick.timestamp,
            exitPrice: tick.price,
            returnPercent: ((tick.price - entryPrice) / entryPrice) * 100,
            confidence: 0.9
          };
        }
      } else {
        // SELL: invertido
        // Profit barrier (lower = TP para SELL)
        if (tick.price <= barriers.lower) {
          return {
            label: 1,
            labelType: 'triple_barrier',
            exitReason: 'profit',
            exitTime: tick.timestamp,
            exitPrice: tick.price,
            returnPercent: ((entryPrice - tick.price) / entryPrice) * 100,
            confidence: 0.9
          };
        }
        // Stop barrier (upper = SL para SELL)
        if (tick.price >= barriers.upper) {
          return {
            label: 0,
            labelType: 'triple_barrier',
            exitReason: 'stop',
            exitTime: tick.timestamp,
            exitPrice: tick.price,
            returnPercent: ((entryPrice - tick.price) / entryPrice) * 100,
            confidence: 0.9
          };
        }
      }
    }

    // Se chegou aqui, não houve conclusão (dados incompletos)
    return null;
  }

  /**
   * ✅ Meta-Labeling (Secondary Machine Learning Label)
   * 
   * Usado APÓS triple-barrier para classificar:
   * "Dado que o modelo principal previu corretamente (triple-barrier win),
   *  qual a confiança/qualidade dessa predição?"
   * 
   * Útil para:
   * - Filtrar "falsos positivos" (wins por acaso)
   * - Identificar wins de alta qualidade
   * - Ajustar position sizing baseado em qualidade
   */
  public calculateMetaLabel(
    primaryLabel: number, // 1 = win, 0 = loss
    features: {
      volumeRatio: number; // volume atual / volume médio
      volatility: number; // volatilidade no momento
      trendStrength: number; // 0-1 (forte tendência = mais confiável)
      spreadTightness: number; // 0-1 (spread apertado = mais liquidez)
      slippageEstimate: number; // % estimado de slippage
      momentumScore: number; // -1 a +1
    }
  ): number {
    // ✅ Meta-label só faz sentido para wins (triple-barrier = 1)
    if (primaryLabel !== 1) {
      return 0; // Loss = baixa qualidade por definição
    }

    let qualityScore = 0.5; // Base

    // ✅ Ajustes de qualidade:
    // + Volume alto = movimento confirmado
    if (features.volumeRatio > 1.5) qualityScore += 0.15;
    else if (features.volumeRatio < 0.8) qualityScore -= 0.15;

    // + Tendência forte = mais confiável
    qualityScore += features.trendStrength * 0.2;

    // + Spread apertado = menos slippage
    qualityScore += features.spreadTightness * 0.1;

    // - Slippage alto = qualidade reduzida
    qualityScore -= Math.min(features.slippageEstimate / 2, 0.2);

    // + Momentum alinhado = mais confiável
    if (features.momentumScore > 0.5) qualityScore += 0.1;
    else if (features.momentumScore < -0.5) qualityScore -= 0.1;

    // Normalizar para 0-1
    qualityScore = Math.max(0, Math.min(1, qualityScore));

    // ✅ Meta-label: 1 = win de alta qualidade, 0 = win de baixa qualidade
    return qualityScore >= 0.6 ? 1 : 0;
  }

  /**
   * ✅ Gera dataset completo para treinamento ML
   */
  public async generateTrainingDataset(
    trades: Array<{
      entryPrice: number;
      entryTime: number;
      side: 'BUY' | 'SELL';
      exitPrice: number;
      exitTime: number;
      features: Record<string, number>;
    }>,
    volatility: number
  ): Promise<Array<{
    features: Record<string, number>;
    primaryLabel: number; // Triple-barrier
    metaLabel: number; // Meta-labeling
    returnPercent: number;
  }>> {
    const dataset = [];

    for (const trade of trades) {
      // Calcular triple-barrier label
      const barriers = this.calculateTripleBarrier(
        trade.entryPrice,
        trade.side,
        volatility,
        trade.entryTime
      );

      let primaryLabel = -1; // timeout por padrão
      if (trade.side === 'BUY') {
        if (trade.exitPrice >= barriers.upper) primaryLabel = 1;
        else if (trade.exitPrice <= barriers.lower) primaryLabel = 0;
      } else {
        if (trade.exitPrice <= barriers.lower) primaryLabel = 1;
        else if (trade.exitPrice >= barriers.upper) primaryLabel = 0;
      }

      // Calcular meta-label
      const metaLabel = this.calculateMetaLabel(primaryLabel, {
        volumeRatio: trade.features.volumeRatio || 1.0,
        volatility: volatility,
        trendStrength: trade.features.trendStrength || 0.5,
        spreadTightness: trade.features.spreadTightness || 0.5,
        slippageEstimate: trade.features.slippageEstimate || 0.1,
        momentumScore: trade.features.momentumScore || 0
      });

      const returnPercent = trade.side === 'BUY'
        ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - trade.exitPrice) / trade.entryPrice) * 100;

      dataset.push({
        features: trade.features,
        primaryLabel,
        metaLabel,
        returnPercent
      });
    }

    return dataset;
  }
}

export const labelingSystem = LabelingSystem.getInstance();
