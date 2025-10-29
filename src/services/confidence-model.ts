import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface ConfidenceMetrics {
  symbol: string;
  overall_confidence: number; // 0-1
  signal_confidence: number; // 0-1
  market_confidence: number; // 0-1
  volume_confidence: number; // 0-1
  volatility_confidence: number; // 0-1
  trend_confidence: number; // 0-1
  last_updated: number;
  data_points: number;
}

export interface StrategyConfidence {
  strategy_name: string;
  confidence_score: number; // 0-1
  success_rate: number; // 0-1
  total_signals: number;
  successful_signals: number;
  average_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  last_updated: number;
}

export interface ConfidenceConfig {
  min_data_points: number;
  confidence_threshold: number;
  update_interval_ms: number;
  max_history_days: number;
  volatility_weight: number;
  volume_weight: number;
  trend_weight: number;
}

export interface ConfidenceReport {
  id: string;
  timestamp: number;
  global_confidence: number;
  top_symbols: Array<{
    symbol: string;
    confidence: number;
    metrics: ConfidenceMetrics;
  }>;
  strategy_performance: StrategyConfidence[];
  risk_assessment: {
    high_confidence_symbols: number;
    medium_confidence_symbols: number;
    low_confidence_symbols: number;
    overall_risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface SymbolRanking {
  symbol: string;
  confidence: number;
  rank: number;
  change_from_last: number;
}

export class ConfidenceModel {
  private config: ConfidenceConfig;
  private symbolMetrics: Map<string, ConfidenceMetrics> = new Map();
  private strategyPerformance: Map<string, StrategyConfidence> = new Map();
  private historicalData: Map<string, Array<{ timestamp: number; confidence: number; success: boolean }>> = new Map();
  private reports: ConfidenceReport[] = [];

  constructor(config?: Partial<ConfidenceConfig>) {
    this.config = {
      min_data_points: config?.min_data_points || 10,
      confidence_threshold: config?.confidence_threshold || 0.7,
      update_interval_ms: config?.update_interval_ms || 60000, // 1 minute
      max_history_days: config?.max_history_days || 30,
      volatility_weight: config?.volatility_weight || 0.3,
      volume_weight: config?.volume_weight || 0.2,
      trend_weight: config?.trend_weight || 0.5,
    };

    info('Confidence Model initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<ConfidenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Confidence Model config updated', { newConfig });
  }

  public updateSymbolMetrics(
    symbol: string,
    signalStrength: number,
    marketData: {
      volume: number;
      volatility: number;
      trend: number;
      price: number;
    }
  ): void {
    const existing = this.symbolMetrics.get(symbol);
    const now = Date.now();

    let metrics: ConfidenceMetrics;
    
    if (existing) {
      // Update existing metrics
      metrics = {
        ...existing,
        signal_confidence: this.calculateSignalConfidence(signalStrength),
        market_confidence: this.calculateMarketConfidence(marketData),
        volume_confidence: this.calculateVolumeConfidence(marketData.volume),
        volatility_confidence: this.calculateVolatilityConfidence(marketData.volatility),
        trend_confidence: this.calculateTrendConfidence(marketData.trend),
        last_updated: now,
        data_points: existing.data_points + 1,
      };
    } else {
      // Create new metrics
      metrics = {
        symbol,
        overall_confidence: 0,
        signal_confidence: this.calculateSignalConfidence(signalStrength),
        market_confidence: this.calculateMarketConfidence(marketData),
        volume_confidence: this.calculateVolumeConfidence(marketData.volume),
        volatility_confidence: this.calculateVolatilityConfidence(marketData.volatility),
        trend_confidence: this.calculateTrendConfidence(marketData.trend),
        last_updated: now,
        data_points: 1,
      };
    }

    // Calculate overall confidence
    metrics.overall_confidence = this.calculateOverallConfidence(metrics);

    this.symbolMetrics.set(symbol, metrics);

    // Update historical data
    this.updateHistoricalData(symbol, metrics.overall_confidence, true);

    info(`Symbol metrics updated for ${symbol}`, {
      overallConfidence: metrics.overall_confidence.toFixed(3),
      signalConfidence: metrics.signal_confidence.toFixed(3),
      dataPoints: metrics.data_points,
    });
  }

  private calculateSignalConfidence(signalStrength: number): number {
    // Normalize signal strength to 0-1 range
    return Math.min(Math.max(signalStrength, 0), 1);
  }

  private calculateMarketConfidence(marketData: { volume: number; volatility: number; trend: number; price: number }): number {
    // Higher volume = higher confidence
    const volumeScore = Math.min(marketData.volume / 1000000, 1); // Normalize to 1M volume
    
    // Moderate volatility = higher confidence (too high or too low is bad)
    const volatilityScore = 1 - Math.abs(marketData.volatility - 0.02) / 0.05; // Optimal around 2%
    
    // Strong trend = higher confidence
    const trendScore = Math.abs(marketData.trend);
    
    return (volumeScore * this.config.volume_weight + 
            volatilityScore * this.config.volatility_weight + 
            trendScore * this.config.trend_weight) / 
           (this.config.volume_weight + this.config.volatility_weight + this.config.trend_weight);
  }

  private calculateVolumeConfidence(volume: number): number {
    // Higher volume = higher confidence, but with diminishing returns
    return Math.min(volume / 5000000, 1); // Normalize to 5M volume
  }

  private calculateVolatilityConfidence(volatility: number): number {
    // Moderate volatility is best (not too high, not too low)
    const optimalVolatility = 0.02; // 2%
    const deviation = Math.abs(volatility - optimalVolatility);
    return Math.max(0, 1 - deviation / optimalVolatility);
  }

  private calculateTrendConfidence(trend: number): number {
    // Stronger trend = higher confidence
    return Math.abs(trend);
  }

  private calculateOverallConfidence(metrics: ConfidenceMetrics): number {
    // Weighted average of all confidence metrics
    const weights = {
      signal: 0.3,
      market: 0.25,
      volume: 0.15,
      volatility: 0.15,
      trend: 0.15,
    };

    return (
      metrics.signal_confidence * weights.signal +
      metrics.market_confidence * weights.market +
      metrics.volume_confidence * weights.volume +
      metrics.volatility_confidence * weights.volatility +
      metrics.trend_confidence * weights.trend
    );
  }

  private updateHistoricalData(symbol: string, confidence: number, success: boolean): void {
    const history = this.historicalData.get(symbol) || [];
    history.push({
      timestamp: Date.now(),
      confidence,
      success,
    });

    // Keep only recent data
    const cutoffTime = Date.now() - (this.config.max_history_days * 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(data => data.timestamp > cutoffTime);
    
    this.historicalData.set(symbol, filteredHistory);
  }

  public recordSignalResult(symbol: string, strategy: string, success: boolean, returnValue: number): void {
    // Update strategy performance
    const existing = this.strategyPerformance.get(strategy);
    const now = Date.now();

    if (existing) {
      const newTotalSignals = existing.total_signals + 1;
      const newSuccessfulSignals = existing.successful_signals + (success ? 1 : 0);
      
      existing.total_signals = newTotalSignals;
      existing.successful_signals = newSuccessfulSignals;
      existing.success_rate = newSuccessfulSignals / newTotalSignals;
      existing.average_return = (existing.average_return * (newTotalSignals - 1) + returnValue) / newTotalSignals;
      existing.confidence_score = existing.success_rate * (1 - Math.abs(existing.average_return));
      existing.last_updated = now;
    } else {
      this.strategyPerformance.set(strategy, {
        strategy_name: strategy,
        confidence_score: success ? 1 : 0,
        success_rate: success ? 1 : 0,
        total_signals: 1,
        successful_signals: success ? 1 : 0,
        average_return: returnValue,
        sharpe_ratio: 0,
        max_drawdown: 0,
        last_updated: now,
      });
    }

    // Update historical data for symbol
    const metrics = this.symbolMetrics.get(symbol);
    if (metrics) {
      this.updateHistoricalData(symbol, metrics.overall_confidence, success);
    }

    info(`Signal result recorded`, {
      symbol,
      strategy,
      success,
      return: returnValue.toFixed(4),
    });
  }

  public getSymbolConfidence(symbol: string): ConfidenceMetrics | undefined {
    return this.symbolMetrics.get(symbol);
  }

  public getGlobalConfidence(): ConfidenceMetrics {
    const allMetrics = Array.from(this.symbolMetrics.values());
    
    if (allMetrics.length === 0) {
      return {
        symbol: 'GLOBAL',
        overall_confidence: 0,
        signal_confidence: 0,
        market_confidence: 0,
        volume_confidence: 0,
        volatility_confidence: 0,
        trend_confidence: 0,
        last_updated: Date.now(),
        data_points: 0,
      };
    }

    const avgConfidence = allMetrics.reduce((sum, m) => sum + m.overall_confidence, 0) / allMetrics.length;
    const avgSignalConfidence = allMetrics.reduce((sum, m) => sum + m.signal_confidence, 0) / allMetrics.length;
    const avgMarketConfidence = allMetrics.reduce((sum, m) => sum + m.market_confidence, 0) / allMetrics.length;
    const avgVolumeConfidence = allMetrics.reduce((sum, m) => sum + m.volume_confidence, 0) / allMetrics.length;
    const avgVolatilityConfidence = allMetrics.reduce((sum, m) => sum + m.volatility_confidence, 0) / allMetrics.length;
    const avgTrendConfidence = allMetrics.reduce((sum, m) => sum + m.trend_confidence, 0) / allMetrics.length;

    return {
      symbol: 'GLOBAL',
      overall_confidence: avgConfidence,
      signal_confidence: avgSignalConfidence,
      market_confidence: avgMarketConfidence,
      volume_confidence: avgVolumeConfidence,
      volatility_confidence: avgVolatilityConfidence,
      trend_confidence: avgTrendConfidence,
      last_updated: Date.now(),
      data_points: allMetrics.length,
    };
  }

  public getSymbolRanking(): SymbolRanking[] {
    const rankings: SymbolRanking[] = [];
    
    this.symbolMetrics.forEach((metrics, symbol) => {
      if (metrics.data_points >= this.config.min_data_points) {
        rankings.push({
          symbol,
          confidence: metrics.overall_confidence,
          rank: 0, // Will be set after sorting
          change_from_last: 0, // Would need historical data to calculate
        });
      }
    });

    // Sort by confidence (highest first)
    rankings.sort((a, b) => b.confidence - a.confidence);
    
    // Set ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    return rankings;
  }

  public getStrategyConfidence(symbol: string, strategy: string): StrategyConfidence | undefined {
    return this.strategyPerformance.get(strategy);
  }

  public getStrategyPerformance(): StrategyConfidence[] {
    return Array.from(this.strategyPerformance.values());
  }

  public isSymbolTrustworthy(symbol: string): boolean {
    const metrics = this.symbolMetrics.get(symbol);
    if (!metrics) return false;

    return metrics.overall_confidence >= this.config.confidence_threshold &&
           metrics.data_points >= this.config.min_data_points;
  }

  public generateConfidenceReport(): ConfidenceReport {
    const globalConfidence = this.getGlobalConfidence();
    const rankings = this.getSymbolRanking();
    const strategyPerformance = this.getStrategyPerformance();

    // Get top 10 symbols
    const topSymbols = rankings.slice(0, 10).map(ranking => ({
      symbol: ranking.symbol,
      confidence: ranking.confidence,
      metrics: this.symbolMetrics.get(ranking.symbol)!,
    }));

    // Calculate risk assessment
    const highConfidenceSymbols = rankings.filter(r => r.confidence >= 0.8).length;
    const mediumConfidenceSymbols = rankings.filter(r => r.confidence >= 0.5 && r.confidence < 0.8).length;
    const lowConfidenceSymbols = rankings.filter(r => r.confidence < 0.5).length;

    let overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (globalConfidence.overall_confidence >= 0.7) {
      overallRiskLevel = 'LOW';
    } else if (globalConfidence.overall_confidence >= 0.4) {
      overallRiskLevel = 'MEDIUM';
    } else {
      overallRiskLevel = 'HIGH';
    }

    const report: ConfidenceReport = {
      id: generateUniqueId(),
      timestamp: Date.now(),
      global_confidence: globalConfidence.overall_confidence,
      top_symbols: topSymbols,
      strategy_performance: strategyPerformance,
      risk_assessment: {
        high_confidence_symbols: highConfidenceSymbols,
        medium_confidence_symbols: mediumConfidenceSymbols,
        low_confidence_symbols: lowConfidenceSymbols,
        overall_risk_level: overallRiskLevel,
      },
    };

    this.reports.unshift(report);
    
    // Keep only last 100 reports
    if (this.reports.length > 100) {
      this.reports = this.reports.slice(0, 100);
    }

    info('Confidence report generated', {
      globalConfidence: report.global_confidence.toFixed(3),
      topSymbolsCount: report.top_symbols.length,
      riskLevel: report.risk_assessment.overall_risk_level,
    });

    return report;
  }

  public getRecentReports(limit: number = 10): ConfidenceReport[] {
    return this.reports.slice(0, limit);
  }

  public clearData(): void {
    this.symbolMetrics.clear();
    this.strategyPerformance.clear();
    this.historicalData.clear();
    this.reports = [];
    info('Confidence Model data cleared');
  }

  public getConfig(): ConfidenceConfig {
    return { ...this.config };
  }
}

export const confidenceModel = new ConfidenceModel();
