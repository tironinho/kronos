// ============================================================================
// SIGNAL ENGINE - MOTOR DE SINAIS KRONOS-X
// ============================================================================

import {
  TradeData,
  DepthData,
  SymbolMetrics,
  TradingSignal,
  OfiCfg,
  MicroMomentumCfg,
  MeanRevCfg,
  SymbolSelCfg
} from '../types';
import { MathUtils, TimeUtils } from '../utils';
import { getComponentLogger, SystemComponent, SystemAction } from './logging';

// ============================================================================
// CLASSE PRINCIPAL DO SIGNAL ENGINE
// ============================================================================

export class SignalEngine {
  private static instance: SignalEngine;
  private logger = getComponentLogger(SystemComponent.SignalEngine);
  
  // Buffers de dados
  private trades: Map<string, TradeData[]> = new Map();
  private depths: Map<string, DepthData[]> = new Map();
  private symbolMetrics: Map<string, SymbolMetrics> = new Map();
  
  // Configurações
  private ofiConfig: OfiCfg;
  private momentumConfig: MicroMomentumCfg;
  private meanRevConfig: MeanRevCfg;
  private symbolSelConfig: SymbolSelCfg;
  
  // Estado interno
  private recentEdges: number[] = [];
  private maxBufferSize = 1000;
  private lastSignalTime: Map<string, number> = new Map();

  private constructor(
    ofiConfig: OfiCfg,
    momentumConfig: MicroMomentumCfg,
    meanRevConfig: MeanRevCfg,
    symbolSelConfig: SymbolSelCfg
  ) {
    this.ofiConfig = ofiConfig;
    this.momentumConfig = momentumConfig;
    this.meanRevConfig = meanRevConfig;
    this.symbolSelConfig = symbolSelConfig;
  }

  public static getInstance(
    ofiConfig?: OfiCfg,
    momentumConfig?: MicroMomentumCfg,
    meanRevConfig?: MeanRevCfg,
    symbolSelConfig?: SymbolSelCfg
  ): SignalEngine {
    if (!SignalEngine.instance) {
      if (!ofiConfig || !momentumConfig || !meanRevConfig || !symbolSelConfig) {
        throw new Error('SignalEngine deve ser inicializado com todas as configurações');
      }
      SignalEngine.instance = new SignalEngine(
        ofiConfig,
        momentumConfig,
        meanRevConfig,
        symbolSelConfig
      );
    }
    return SignalEngine.instance;
  }

  /**
   * Adiciona dados de trade
   */
  public addTrade(symbol: string, trade: TradeData): void {
    try {
      if (!this.trades.has(symbol)) {
        this.trades.set(symbol, []);
      }

      const symbolTrades = this.trades.get(symbol)!;
      symbolTrades.push(trade);

      // Mantém apenas os últimos trades
      if (symbolTrades.length > this.maxBufferSize) {
        symbolTrades.splice(0, symbolTrades.length - this.maxBufferSize);
      }

      // Atualiza métricas do símbolo
      this.updateSymbolMetrics(symbol);

      this.logger.debug(
        SystemAction.DataProcessing,
        `Trade adicionado para ${symbol}`,
        { price: trade.price, quantity: trade.quantity, timestamp: trade.timestamp }
      );
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro ao adicionar trade para ${symbol}`,
        error as Error,
        { trade }
      );
    }
  }

  /**
   * Adiciona dados de depth
   */
  public addDepth(symbol: string, depth: DepthData): void {
    try {
      if (!this.depths.has(symbol)) {
        this.depths.set(symbol, []);
      }

      const symbolDepths = this.depths.get(symbol)!;
      symbolDepths.push(depth);

      // Mantém apenas os últimos depths
      if (symbolDepths.length > 100) {
        symbolDepths.splice(0, symbolDepths.length - 100);
      }

      // Atualiza métricas do símbolo
      this.updateSymbolMetrics(symbol);

      this.logger.debug(
        SystemAction.DataProcessing,
        `Depth adicionado para ${symbol}`,
        { 
          bids_count: depth.bids.length, 
          asks_count: depth.asks.length,
          timestamp: depth.timestamp 
        }
      );
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro ao adicionar depth para ${symbol}`,
        error as Error,
        { depth }
      );
    }
  }

  /**
   * Calcula Order Flow Imbalance (OFI)
   */
  public calculateOFI(symbol: string, windowMs: number): number | null {
    try {
      const trades = this.trades.get(symbol);
      if (!trades || trades.length === 0) return null;

      const now = TimeUtils.now();
      const windowStart = now - windowMs;

      let buyVolume = 0;
      let sellVolume = 0;

      // Analisa trades dentro da janela
      for (let i = trades.length - 1; i >= 0; i--) {
        const trade = trades[i];
        if (trade.timestamp < windowStart) break;

        if (trade.is_buyer_maker) {
          sellVolume += trade.quantity;
        } else {
          buyVolume += trade.quantity;
        }
      }

      const totalVolume = buyVolume + sellVolume;
      if (totalVolume === 0) return null;

      const ofi = (buyVolume - sellVolume) / totalVolume;
      
      this.logger.debug(
        SystemAction.SignalGeneration,
        `OFI calculado para ${symbol}`,
        { windowMs, buyVolume, sellVolume, ofi }
      );

      return ofi;
    } catch (error) {
      this.logger.error(
        SystemAction.SignalGeneration,
        `Erro ao calcular OFI para ${symbol}`,
        error as Error,
        { windowMs }
      );
      return null;
    }
  }

  /**
   * Calcula Z-Score do OFI
   */
  public calculateOFIZScore(symbol: string): number | null {
    try {
      const ofiValues: number[] = [];
      
      // Calcula OFI para diferentes janelas
      for (const windowMs of this.ofiConfig.windowsMs) {
        const ofi = this.calculateOFI(symbol, windowMs);
        if (ofi !== null) {
          ofiValues.push(ofi);
        }
      }

      if (ofiValues.length === 0) return null;

      const mean = MathUtils.average(ofiValues);
      const stdDev = MathUtils.standardDeviation(ofiValues);
      
      if (stdDev === 0) return null;

      const currentOFI = ofiValues[ofiValues.length - 1];
      const zScore = MathUtils.zScore(currentOFI, mean, stdDev);

      this.logger.debug(
        SystemAction.SignalGeneration,
        `OFI Z-Score calculado para ${symbol}`,
        { ofiValues, mean, stdDev, zScore }
      );

      return zScore;
    } catch (error) {
      this.logger.error(
        SystemAction.SignalGeneration,
        `Erro ao calcular OFI Z-Score para ${symbol}`,
        error as Error
      );
      return null;
    }
  }

  /**
   * Calcula Micro Momentum
   */
  public calculateMicroMomentum(symbol: string, windowMs: number): number | null {
    try {
      const trades = this.trades.get(symbol);
      if (!trades || trades.length < 2) return null;

      const now = TimeUtils.now();
      const windowStart = now - windowMs;

      // Filtra trades dentro da janela
      const windowTrades = trades.filter(trade => trade.timestamp >= windowStart);
      if (windowTrades.length < 2) return null;

      // Ordena por timestamp
      windowTrades.sort((a, b) => a.timestamp - b.timestamp);

      const firstPrice = windowTrades[0].price;
      const lastPrice = windowTrades[windowTrades.length - 1].price;
      const totalVolume = windowTrades.reduce((sum, trade) => sum + trade.quantity, 0);

      // Verifica volume mínimo
      if (totalVolume < this.momentumConfig.minVolumeUsd) return null;

      const returnPct = (lastPrice - firstPrice) / firstPrice;
      const momentumScore = returnPct * 10000; // Converte para bps

      // Verifica edge mínimo
      if (Math.abs(momentumScore) < this.momentumConfig.minEdgeBps) return null;

      this.logger.debug(
        SystemAction.SignalGeneration,
        `Micro Momentum calculado para ${symbol}`,
        { windowMs, firstPrice, lastPrice, returnPct, momentumScore }
      );

      return momentumScore;
    } catch (error) {
      this.logger.error(
        SystemAction.SignalGeneration,
        `Erro ao calcular Micro Momentum para ${symbol}`,
        error as Error,
        { windowMs }
      );
      return null;
    }
  }

  /**
   * Calcula Mean Reversion
   */
  public calculateMeanReversion(symbol: string): number | null {
    try {
      const depth = this.depths.get(symbol);
      const trades = this.trades.get(symbol);
      
      if (!depth || !trades || depth.length === 0 || trades.length === 0) return null;

      const latestDepth = depth[depth.length - 1];
      if (latestDepth.bids.length === 0 || latestDepth.asks.length === 0) return null;

      const bestBid = latestDepth.bids[0][0];
      const bestAsk = latestDepth.asks[0][0];
      const midPrice = (bestBid + bestAsk) / 2;
      const spread = bestAsk - bestBid;
      const spreadBps = (spread / midPrice) * 10000;

      // Calcula preço médio dos trades recentes
      const recentTrades = trades.slice(-20); // Últimos 20 trades
      if (recentTrades.length === 0) return null;

      const avgPrice = recentTrades.reduce((sum, trade) => sum + trade.price, 0) / recentTrades.length;
      const deviation = (midPrice - avgPrice) / avgPrice;
      const deviationTicks = (deviation * 10000) / spreadBps;

      // Verifica se desvio é significativo
      if (Math.abs(deviationTicks) < this.meanRevConfig.deviationTicks) return null;

      const meanRevScore = -deviationTicks * this.meanRevConfig.targetSpreadFactor;

      this.logger.debug(
        SystemAction.SignalGeneration,
        `Mean Reversion calculado para ${symbol}`,
        { bestBid, bestAsk, midPrice, avgPrice, deviationTicks, meanRevScore }
      );

      return meanRevScore;
    } catch (error) {
      this.logger.error(
        SystemAction.SignalGeneration,
        `Erro ao calcular Mean Reversion para ${symbol}`,
        error as Error
      );
      return null;
    }
  }

  /**
   * Seleciona símbolos para trading
   */
  public selectSymbols(): string[] {
    try {
      if (!this.symbolSelConfig.enabled) {
        return Array.from(this.symbolMetrics.keys());
      }

      const candidates: Array<{ symbol: string; score: number }> = [];

      for (const [symbol, metrics] of this.symbolMetrics) {
        if (metrics.volatility >= this.symbolSelConfig.volatilityThreshold) {
          const score = metrics.volume_24h * metrics.volatility;
          candidates.push({ symbol, score });
        }
      }

      // Ordena por score e retorna os top N
      candidates.sort((a, b) => b.score - a.score);
      const selectedSymbols = candidates
        .slice(0, this.symbolSelConfig.topNVolume)
        .map(c => c.symbol);

      this.logger.info(
        SystemAction.SignalGeneration,
        `Símbolos selecionados: ${selectedSymbols.join(', ')}`,
        { selectedSymbols, total_candidates: candidates.length }
      );

      return selectedSymbols;
    } catch (error) {
      this.logger.error(
        SystemAction.SignalGeneration,
        'Erro ao selecionar símbolos',
        error as Error
      );
      return [];
    }
  }

  /**
   * Gera sinais de trading
   */
  public generateSignals(): TradingSignal[] {
    try {
      const signals: TradingSignal[] = [];
      const selectedSymbols = this.selectSymbols();

      for (const symbol of selectedSymbols) {
        // Verifica cooldown
        const lastSignalTime = this.lastSignalTime.get(symbol) || 0;
        const now = TimeUtils.now();
        
        if (now - lastSignalTime < this.ofiConfig.cooldownMs) {
          continue;
        }

        const signal = this.generateSignalForSymbol(symbol);
        if (signal) {
          signals.push(signal);
          this.lastSignalTime.set(symbol, now);
        }
      }

      this.logger.info(
        SystemAction.SignalGeneration,
        `${signals.length} sinais gerados`,
        { signals: signals.map(s => ({ symbol: s.symbol, type: s.signal_type, strength: s.strength })) }
      );

      return signals;
    } catch (error) {
      this.logger.error(
        SystemAction.SignalGeneration,
        'Erro ao gerar sinais',
        error as Error
      );
      return [];
    }
  }

  /**
   * Gera sinal para um símbolo específico
   */
  private generateSignalForSymbol(symbol: string): TradingSignal | null {
    try {
      let signalStrength = 0;
      let confidence = 0;
      const reasons: string[] = [];

      // Sinal OFI
      const ofiZScore = this.calculateOFIZScore(symbol);
      if (ofiZScore !== null && Math.abs(ofiZScore) >= this.ofiConfig.zScoreThreshold) {
        signalStrength += ofiZScore > 0 ? 0.4 : -0.4;
        confidence += 0.3;
        reasons.push(`OFI z-score: ${ofiZScore.toFixed(2)}`);
      }

      // Sinal Momentum
      const momentum = this.calculateMicroMomentum(symbol, this.momentumConfig.returnWindowsMs[0]);
      if (momentum !== null && Math.abs(momentum) >= this.momentumConfig.minEdgeBps) {
        signalStrength += momentum > 0 ? 0.3 : -0.3;
        confidence += 0.2;
        reasons.push(`Momentum: ${momentum.toFixed(1)}bps`);
      }

      // Sinal Mean Reversion
      const meanRev = this.calculateMeanReversion(symbol);
      if (meanRev !== null && Math.abs(meanRev) >= 1.0) {
        signalStrength += meanRev > 0 ? 0.3 : -0.3;
        confidence += 0.2;
        reasons.push(`Mean Rev: ${meanRev.toFixed(2)}`);
      }

      // Gera sinal se forte o suficiente
      if (Math.abs(signalStrength) >= 0.5 && confidence >= 0.4) {
        const signalType = signalStrength > 0 ? 'BUY' : 'SELL';
        
        const signal: TradingSignal = {
          symbol,
          signal_type: signalType,
          strength: signalStrength,
          confidence: Math.min(confidence, 1.0),
          reason: reasons.join(', '),
          timestamp: TimeUtils.now()
        };

        this.logger.info(
          SystemAction.SignalGeneration,
          `Sinal gerado para ${symbol}`,
          { signal }
        );

        return signal;
      }

      return null;
    } catch (error) {
      this.logger.error(
        SystemAction.SignalGeneration,
        `Erro ao gerar sinal para ${symbol}`,
        error as Error
      );
      return null;
    }
  }

  /**
   * Atualiza métricas do símbolo
   */
  private updateSymbolMetrics(symbol: string): void {
    try {
      const trades = this.trades.get(symbol);
      const depths = this.depths.get(symbol);

      if (!trades || !depths) return;

      let metrics = this.symbolMetrics.get(symbol);
      if (!metrics) {
        metrics = {
          symbol,
          volume_24h: 0,
          volatility: 0,
          last_price: 0,
          spread_bps: 0,
          ofi_score: 0,
          momentum_score: 0,
          mean_reversion_score: 0
        };
        this.symbolMetrics.set(symbol, metrics);
      }

      // Atualiza preço
      if (trades.length > 0) {
        metrics.last_price = trades[trades.length - 1].price;
      }

      // Atualiza spread
      if (depths.length > 0) {
        const latestDepth = depths[depths.length - 1];
        if (latestDepth.bids.length > 0 && latestDepth.asks.length > 0) {
          const bestBid = latestDepth.bids[0][0];
          const bestAsk = latestDepth.asks[0][0];
          const midPrice = (bestBid + bestAsk) / 2;
          metrics.spread_bps = ((bestAsk - bestBid) / midPrice) * 10000;
        }
      }

      // Atualiza OFI score
      const ofiScore = this.calculateOFI(symbol, this.ofiConfig.windowsMs[0]);
      if (ofiScore !== null) {
        metrics.ofi_score = ofiScore;
      }

      // Atualiza momentum score
      const momentumScore = this.calculateMicroMomentum(symbol, this.momentumConfig.returnWindowsMs[0]);
      if (momentumScore !== null) {
        metrics.momentum_score = momentumScore;
      }

      // Atualiza mean reversion score
      const meanRevScore = this.calculateMeanReversion(symbol);
      if (meanRevScore !== null) {
        metrics.mean_reversion_score = meanRevScore;
      }

      // Calcula volatilidade
      if (trades.length >= 10) {
        const recentPrices = trades.slice(-10).map(t => t.price);
        const returns = [];
        for (let i = 1; i < recentPrices.length; i++) {
          returns.push((recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1]);
        }
        metrics.volatility = MathUtils.standardDeviation(returns) * 100;
      }

      // Atualiza volume (simplificado)
      metrics.volume_24h = trades.reduce((sum, trade) => sum + trade.quantity, 0);

    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        `Erro ao atualizar métricas para ${symbol}`,
        error as Error
      );
    }
  }

  /**
   * Obtém métricas de todos os símbolos
   */
  public getSymbolMetrics(): Map<string, SymbolMetrics> {
    return new Map(this.symbolMetrics);
  }

  /**
   * Obtém métricas de um símbolo específico
   */
  public getSymbolMetricsForSymbol(symbol: string): SymbolMetrics | null {
    return this.symbolMetrics.get(symbol) || null;
  }

  /**
   * Limpa dados antigos
   */
  public cleanupOldData(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    try {
      const cutoffTime = TimeUtils.now() - maxAgeMs;

      // Limpa trades antigos
      for (const [symbol, trades] of this.trades) {
        const filteredTrades = trades.filter(trade => trade.timestamp > cutoffTime);
        this.trades.set(symbol, filteredTrades);
      }

      // Limpa depths antigos
      for (const [symbol, depths] of this.depths) {
        const filteredDepths = depths.filter(depth => depth.timestamp > cutoffTime);
        this.depths.set(symbol, filteredDepths);
      }

      this.logger.info(
        SystemAction.DataProcessing,
        'Dados antigos limpos',
        { maxAgeMs, cutoffTime }
      );
    } catch (error) {
      this.logger.error(
        SystemAction.DataProcessing,
        'Erro ao limpar dados antigos',
        error as Error,
        { maxAgeMs }
      );
    }
  }

  /**
   * Reseta o engine
   */
  public reset(): void {
    this.trades.clear();
    this.depths.clear();
    this.symbolMetrics.clear();
    this.recentEdges = [];
    this.lastSignalTime.clear();

    this.logger.info(
      SystemAction.SystemStart,
      'SignalEngine resetado'
    );
  }

  /**
   * Obtém estatísticas do engine
   */
  public getStats(): any {
    const totalTrades = Array.from(this.trades.values()).reduce((sum, trades) => sum + trades.length, 0);
    const totalDepths = Array.from(this.depths.values()).reduce((sum, depths) => sum + depths.length, 0);

    return {
      symbols_tracked: this.symbolMetrics.size,
      total_trades: totalTrades,
      total_depths: totalDepths,
      buffer_size: this.maxBufferSize,
      last_cleanup: TimeUtils.now(),
      config: {
        ofi: this.ofiConfig,
        momentum: this.momentumConfig,
        mean_reversion: this.meanRevConfig,
        symbol_selection: this.symbolSelConfig
      }
    };
  }
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém instância do SignalEngine
 */
export function getSignalEngine(
  ofiConfig?: OfiCfg,
  momentumConfig?: MicroMomentumCfg,
  meanRevConfig?: MeanRevCfg,
  symbolSelConfig?: SymbolSelCfg
): SignalEngine {
  return SignalEngine.getInstance(ofiConfig, momentumConfig, meanRevConfig, symbolSelConfig);
}

/**
 * Cria SignalEngine com configurações padrão
 */
export function createSignalEngineWithDefaults(): SignalEngine {
  const defaultOfiConfig: OfiCfg = {
    windowsMs: [1000, 5000, 10000],
    zScoreThreshold: 2.0,
    cooldownMs: 60000
  };

  const defaultMomentumConfig: MicroMomentumCfg = {
    returnWindowsMs: [100, 500, 1000],
    minEdgeBps: 0.5,
    minVolumeUsd: 10000.0
  };

  const defaultMeanRevConfig: MeanRevCfg = {
    deviationTicks: 10,
    targetSpreadFactor: 0.5,
    cooldownMs: 30000
  };

  const defaultSymbolSelConfig: SymbolSelCfg = {
    enabled: true,
    volatilityThreshold: 0.5,
    topNVolume: 10
  };

  return SignalEngine.getInstance(
    defaultOfiConfig,
    defaultMomentumConfig,
    defaultMeanRevConfig,
    defaultSymbolSelConfig
  );
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default SignalEngine;
