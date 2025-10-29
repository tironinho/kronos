import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface AnalysisIntegrationConfig {
  enabled_analyses: string[];
  integration_weights: {
    technical_analysis: number;
    fundamental_analysis: number;
    sentiment_analysis: number;
    onchain_analysis: number;
    market_structure: number;
    volume_analysis: number;
    momentum_analysis: number;
    volatility_analysis: number;
  };
  consensus_threshold: number;
  conflict_resolution: 'MAJORITY' | 'WEIGHTED' | 'CONFIDENCE_BASED';
  update_frequency_ms: number;
  data_sources: {
    price_data: boolean;
    volume_data: boolean;
    orderbook_data: boolean;
    news_data: boolean;
    social_data: boolean;
    onchain_data: boolean;
    macro_data: boolean;
  };
}

export interface IntegratedAnalysisResult {
  id: string;
  symbol: string;
  timestamp: number;
  overall_score: number;
  confidence: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  analysis_breakdown: {
    technical_analysis: {
      score: number;
      confidence: number;
      signals: string[];
      indicators: { [key: string]: number };
    };
    fundamental_analysis: {
      score: number;
      confidence: number;
      factors: string[];
      metrics: { [key: string]: number };
    };
    sentiment_analysis: {
      score: number;
      confidence: number;
      sentiment: number;
      sources: { [key: string]: number };
    };
    onchain_analysis: {
      score: number;
      confidence: number;
      metrics: { [key: string]: number };
      alerts: string[];
    };
    market_structure: {
      score: number;
      confidence: number;
      trend: string;
      support_resistance: { support: number[]; resistance: number[] };
    };
    volume_analysis: {
      score: number;
      confidence: number;
      volume_trend: string;
      volume_profile: { [key: string]: number };
    };
    momentum_analysis: {
      score: number;
      confidence: number;
      momentum: number;
      acceleration: number;
    };
    volatility_analysis: {
      score: number;
      confidence: number;
      volatility: number;
      volatility_trend: string;
    };
  };
  consensus: {
    agreement_level: number;
    conflicting_signals: string[];
    dominant_factors: string[];
    risk_factors: string[];
  };
  risk_assessment: {
    overall_risk: number;
    technical_risk: number;
    fundamental_risk: number;
    sentiment_risk: number;
    market_risk: number;
    liquidity_risk: number;
  };
  execution_recommendation: {
    position_size: number;
    entry_strategy: string;
    stop_loss: number;
    take_profit: number;
    time_horizon: string;
    risk_reward_ratio: number;
  };
}

export interface AnalysisIntegrationStats {
  total_analyses: number;
  successful_integrations: number;
  failed_integrations: number;
  average_processing_time_ms: number;
  consensus_achieved: number;
  conflicts_resolved: number;
  last_analysis: number;
  active_symbols: number;
}

export class AnalysisIntegrationEngine {
  private config: AnalysisIntegrationConfig;
  private stats: AnalysisIntegrationStats;
  private analysisHistory: Map<string, IntegratedAnalysisResult[]> = new Map();
  private isRunning: boolean = false;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<AnalysisIntegrationConfig>) {
    this.config = {
      enabled_analyses: config?.enabled_analyses || [
        'technical_analysis',
        'fundamental_analysis',
        'sentiment_analysis',
        'onchain_analysis',
        'market_structure',
        'volume_analysis',
        'momentum_analysis',
        'volatility_analysis'
      ],
      integration_weights: {
        technical_analysis: config?.integration_weights?.technical_analysis || 0.25,
        fundamental_analysis: config?.integration_weights?.fundamental_analysis || 0.20,
        sentiment_analysis: config?.integration_weights?.sentiment_analysis || 0.15,
        onchain_analysis: config?.integration_weights?.onchain_analysis || 0.15,
        market_structure: config?.integration_weights?.market_structure || 0.10,
        volume_analysis: config?.integration_weights?.volume_analysis || 0.08,
        momentum_analysis: config?.integration_weights?.momentum_analysis || 0.04,
        volatility_analysis: config?.integration_weights?.volatility_analysis || 0.03,
      },
      consensus_threshold: config?.consensus_threshold || 0.7,
      conflict_resolution: config?.conflict_resolution || 'WEIGHTED',
      update_frequency_ms: config?.update_frequency_ms || 300000, // 5 minutes
      data_sources: {
        price_data: config?.data_sources?.price_data ?? true,
        volume_data: config?.data_sources?.volume_data ?? true,
        orderbook_data: config?.data_sources?.orderbook_data ?? true,
        news_data: config?.data_sources?.news_data ?? true,
        social_data: config?.data_sources?.social_data ?? true,
        onchain_data: config?.data_sources?.onchain_data ?? true,
        macro_data: config?.data_sources?.macro_data ?? true,
      },
    };

    this.stats = {
      total_analyses: 0,
      successful_integrations: 0,
      failed_integrations: 0,
      average_processing_time_ms: 0,
      consensus_achieved: 0,
      conflicts_resolved: 0,
      last_analysis: 0,
      active_symbols: 0,
    };

    info('Analysis Integration Engine initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<AnalysisIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Analysis Integration config updated', { newConfig });
  }

  public async startIntegration(): Promise<void> {
    if (this.isRunning) {
      warn('Analysis integration is already running');
      return;
    }

    this.isRunning = true;
    info('Starting analysis integration engine');

    // Start periodic analysis
    this.analysisInterval = setInterval(async () => {
      try {
        await this.performIntegratedAnalysis();
      } catch (err: any) {
        error('Error in periodic analysis integration', { error: err.message });
      }
    }, this.config.update_frequency_ms);

    // Perform initial analysis
    await this.performIntegratedAnalysis();
  }

  public async stopIntegration(): Promise<void> {
    if (!this.isRunning) {
      warn('Analysis integration is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    info('Analysis integration engine stopped');
  }

  public async integrateAnalysis(symbol: string, analysisData: any): Promise<IntegratedAnalysisResult> {
    const startTime = Date.now();

    try {
      info('Starting integrated analysis', { symbol });

      // Collect data from various analysis sources
      const technicalAnalysis = await this.collectTechnicalAnalysis(symbol, analysisData);
      const fundamentalAnalysis = await this.collectFundamentalAnalysis(symbol, analysisData);
      const sentimentAnalysis = await this.collectSentimentAnalysis(symbol, analysisData);
      const onchainAnalysis = await this.collectOnchainAnalysis(symbol, analysisData);
      const marketStructure = await this.collectMarketStructure(symbol, analysisData);
      const volumeAnalysis = await this.collectVolumeAnalysis(symbol, analysisData);
      const momentumAnalysis = await this.collectMomentumAnalysis(symbol, analysisData);
      const volatilityAnalysis = await this.collectVolatilityAnalysis(symbol, analysisData);

      // Integrate all analyses
      const integratedResult = await this.integrateAnalyses(symbol, {
        technical_analysis: technicalAnalysis,
        fundamental_analysis: fundamentalAnalysis,
        sentiment_analysis: sentimentAnalysis,
        onchain_analysis: onchainAnalysis,
        market_structure: marketStructure,
        volume_analysis: volumeAnalysis,
        momentum_analysis: momentumAnalysis,
        volatility_analysis: volatilityAnalysis,
      });

      // Store analysis result
      if (!this.analysisHistory.has(symbol)) {
        this.analysisHistory.set(symbol, []);
      }
      this.analysisHistory.get(symbol)!.push(integratedResult);

      // Cleanup old data
      this.cleanupOldData(symbol);

      // Update stats
      this.updateStats(startTime, true);

      info('Integrated analysis completed', {
        symbol,
        overallScore: integratedResult.overall_score.toFixed(3),
        confidence: integratedResult.confidence.toFixed(3),
        recommendation: integratedResult.recommendation,
        processingTime: `${Date.now() - startTime}ms`,
      });

      return integratedResult;

    } catch (err: any) {
      error('Integrated analysis failed', { symbol, error: err.message });
      this.updateStats(startTime, false);
      throw err;
    }
  }

  private async collectTechnicalAnalysis(symbol: string, analysisData: any): Promise<any> {
    // Mock technical analysis data
    return {
      score: Math.random() * 2 - 1, // -1 to 1
      confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1
      signals: ['RSI_OVERSOLD', 'MACD_BULLISH', 'BOLLINGER_BREAKOUT'],
      indicators: {
        rsi: 35,
        macd: 0.02,
        sma_20: 50000,
        sma_50: 49500,
        bollinger_position: 0.8,
      },
    };
  }

  private async collectFundamentalAnalysis(symbol: string, analysisData: any): Promise<any> {
    // Mock fundamental analysis data
    return {
      score: Math.random() * 2 - 1,
      confidence: Math.random() * 0.4 + 0.6,
      factors: ['ADOPTION_GROWTH', 'REGULATORY_CLARITY', 'INSTITUTIONAL_INTEREST'],
      metrics: {
        market_cap: 1000000000000,
        volume_24h: 50000000000,
        circulating_supply: 19000000,
        max_supply: 21000000,
      },
    };
  }

  private async collectSentimentAnalysis(symbol: string, analysisData: any): Promise<any> {
    // Mock sentiment analysis data
    return {
      score: Math.random() * 2 - 1,
      confidence: Math.random() * 0.3 + 0.7,
      sentiment: Math.random() * 2 - 1,
      sources: {
        news: Math.random() * 2 - 1,
        social: Math.random() * 2 - 1,
        fear_greed: Math.random() * 2 - 1,
        market: Math.random() * 2 - 1,
      },
    };
  }

  private async collectOnchainAnalysis(symbol: string, analysisData: any): Promise<any> {
    // Mock on-chain analysis data
    return {
      score: Math.random() * 2 - 1,
      confidence: Math.random() * 0.4 + 0.6,
      metrics: {
        network_health: 0.8,
        whale_activity: 0.3,
        exchange_flows: 0.2,
        mining_metrics: 0.9,
      },
      alerts: ['HIGH_EXCHANGE_INFLOW', 'WHALE_MOVEMENT'],
    };
  }

  private async collectMarketStructure(symbol: string, analysisData: any): Promise<any> {
    // Mock market structure data
    return {
      score: Math.random() * 2 - 1,
      confidence: Math.random() * 0.5 + 0.5,
      trend: 'UP',
      support_resistance: {
        support: [48000, 47000, 46000],
        resistance: [52000, 53000, 54000],
      },
    };
  }

  private async collectVolumeAnalysis(symbol: string, analysisData: any): Promise<any> {
    // Mock volume analysis data
    return {
      score: Math.random() * 2 - 1,
      confidence: Math.random() * 0.6 + 0.4,
      volume_trend: 'INCREASING',
      volume_profile: {
        high_volume_zones: [50000, 51000],
        low_volume_zones: [49000, 52000],
        volume_spike: true,
      },
    };
  }

  private async collectMomentumAnalysis(symbol: string, analysisData: any): Promise<any> {
    // Mock momentum analysis data
    return {
      score: Math.random() * 2 - 1,
      confidence: Math.random() * 0.7 + 0.3,
      momentum: Math.random() * 2 - 1,
      acceleration: Math.random() * 2 - 1,
    };
  }

  private async collectVolatilityAnalysis(symbol: string, analysisData: any): Promise<any> {
    // Mock volatility analysis data
    return {
      score: Math.random() * 2 - 1,
      confidence: Math.random() * 0.8 + 0.2,
      volatility: Math.random() * 0.1 + 0.02, // 2% to 12%
      volatility_trend: 'DECREASING',
    };
  }

  private async integrateAnalyses(symbol: string, analyses: any): Promise<IntegratedAnalysisResult> {
    const weights = this.config.integration_weights;
    
    // Calculate weighted overall score
    let weightedScore = 0;
    let totalWeight = 0;
    
    for (const [analysisType, analysis] of Object.entries(analyses)) {
      const weight = weights[analysisType as keyof typeof weights] || 0;
      if (weight > 0) {
        weightedScore += (analysis as any).score * weight;
        totalWeight += weight;
      }
    }
    
    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Calculate overall confidence
    let weightedConfidence = 0;
    let confidenceWeight = 0;
    
    for (const [analysisType, analysis] of Object.entries(analyses)) {
      const weight = weights[analysisType as keyof typeof weights] || 0;
      if (weight > 0) {
        weightedConfidence += (analysis as any).confidence * weight;
        confidenceWeight += weight;
      }
    }
    
    const overallConfidence = confidenceWeight > 0 ? weightedConfidence / confidenceWeight : 0;
    
    // Determine recommendation
    const recommendation = this.determineRecommendation(overallScore, overallConfidence);
    
    // Calculate consensus
    const consensus = this.calculateConsensus(analyses);
    
    // Assess risk
    const riskAssessment = this.assessRisk(analyses, overallScore);
    
    // Generate execution recommendation
    const executionRecommendation = this.generateExecutionRecommendation(overallScore, riskAssessment);
    
    const result: IntegratedAnalysisResult = {
      id: generateUniqueId(),
      symbol,
      timestamp: Date.now(),
      overall_score: overallScore,
      confidence: overallConfidence,
      recommendation,
      analysis_breakdown: analyses,
      consensus,
      risk_assessment: riskAssessment,
      execution_recommendation: executionRecommendation,
    };
    
    return result;
  }

  private determineRecommendation(score: number, confidence: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    if (confidence < 0.5) return 'HOLD';
    
    if (score > 0.6) return 'STRONG_BUY';
    if (score > 0.2) return 'BUY';
    if (score < -0.6) return 'STRONG_SELL';
    if (score < -0.2) return 'SELL';
    
    return 'HOLD';
  }

  private calculateConsensus(analyses: any): IntegratedAnalysisResult['consensus'] {
    const scores = Object.values(analyses).map((analysis: any) => analysis.score);
    const confidences = Object.values(analyses).map((analysis: any) => analysis.confidence);
    
    // Calculate agreement level
    const meanScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length;
    const agreementLevel = Math.max(0, 1 - Math.sqrt(variance));
    
    // Identify conflicting signals
    const conflictingSignals: string[] = [];
    const buySignals = scores.filter(score => score > 0.2).length;
    const sellSignals = scores.filter(score => score < -0.2).length;
    
    if (buySignals > 0 && sellSignals > 0) {
      conflictingSignals.push('MIXED_SIGNALS');
    }
    
    // Identify dominant factors
    const dominantFactors: string[] = [];
    const analysisEntries = Object.entries(analyses);
    analysisEntries.sort((a, b) => Math.abs((b[1] as any).score) - Math.abs((a[1] as any).score));
    dominantFactors.push(analysisEntries[0][0], analysisEntries[1][0]);
    
    // Identify risk factors
    const riskFactors: string[] = [];
    if (analyses.volatility_analysis.volatility > 0.1) {
      riskFactors.push('HIGH_VOLATILITY');
    }
    if (analyses.sentiment_analysis.sentiment < -0.5) {
      riskFactors.push('NEGATIVE_SENTIMENT');
    }
    if (analyses.onchain_analysis.metrics.whale_activity > 0.7) {
      riskFactors.push('HIGH_WHALE_ACTIVITY');
    }
    
    return {
      agreement_level: agreementLevel,
      conflicting_signals: conflictingSignals,
      dominant_factors: dominantFactors,
      risk_factors: riskFactors,
    };
  }

  private assessRisk(analyses: any, overallScore: number): IntegratedAnalysisResult['risk_assessment'] {
    const technicalRisk = 1 - Math.abs(analyses.technical_analysis.score);
    const fundamentalRisk = 1 - Math.abs(analyses.fundamental_analysis.score);
    const sentimentRisk = 1 - Math.abs(analyses.sentiment_analysis.score);
    const marketRisk = analyses.volatility_analysis.volatility * 10;
    const liquidityRisk = 1 - analyses.volume_analysis.confidence;
    
    const overallRisk = (technicalRisk + fundamentalRisk + sentimentRisk + marketRisk + liquidityRisk) / 5;
    
    return {
      overall_risk: Math.min(overallRisk, 1),
      technical_risk: technicalRisk,
      fundamental_risk: fundamentalRisk,
      sentiment_risk: sentimentRisk,
      market_risk: marketRisk,
      liquidity_risk: liquidityRisk,
    };
  }

  private generateExecutionRecommendation(overallScore: number, riskAssessment: any): IntegratedAnalysisResult['execution_recommendation'] {
    const basePositionSize = Math.abs(overallScore) * 0.1; // Max 10% position
    const riskAdjustment = 1 - riskAssessment.overall_risk;
    const positionSize = basePositionSize * riskAdjustment;
    
    const entryStrategy = overallScore > 0.3 ? 'IMMEDIATE' : 'SCALED';
    const stopLoss = riskAssessment.overall_risk * 0.05; // 5% max stop loss
    const takeProfit = stopLoss * 2; // 2:1 risk reward
    const timeHorizon = overallScore > 0.5 ? 'SHORT_TERM' : 'MEDIUM_TERM';
    const riskRewardRatio = takeProfit / stopLoss;
    
    return {
      position_size: Math.max(0.01, Math.min(positionSize, 0.1)), // 1% to 10%
      entry_strategy: entryStrategy,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      time_horizon: timeHorizon,
      risk_reward_ratio: riskRewardRatio,
    };
  }

  private async performIntegratedAnalysis(): Promise<void> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    
    for (const symbol of symbols) {
      try {
        await this.integrateAnalysis(symbol, {});
      } catch (err: any) {
        error('Failed to perform integrated analysis for symbol', { symbol, error: err.message });
      }
    }
  }

  private cleanupOldData(symbol: string): void {
    const data = this.analysisHistory.get(symbol);
    if (!data) return;

    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    const filteredData = data.filter(d => d.timestamp > cutoffTime);
    
    this.analysisHistory.set(symbol, filteredData);
  }

  private updateStats(startTime: number, success: boolean): void {
    const processingTime = Date.now() - startTime;
    
    this.stats.total_analyses++;
    if (success) {
      this.stats.successful_integrations++;
    } else {
      this.stats.failed_integrations++;
    }
    
    this.stats.last_analysis = Date.now();
    
    this.stats.average_processing_time_ms = 
      (this.stats.average_processing_time_ms * (this.stats.total_analyses - 1) + processingTime) / 
      this.stats.total_analyses;
  }

  public getAnalysisHistory(symbol: string): IntegratedAnalysisResult[] {
    return this.analysisHistory.get(symbol) || [];
  }

  public getAllAnalysisHistory(): Map<string, IntegratedAnalysisResult[]> {
    return new Map(this.analysisHistory);
  }

  public getStats(): AnalysisIntegrationStats {
    return { ...this.stats };
  }

  public getConfig(): AnalysisIntegrationConfig {
    return { ...this.config };
  }

  public clearData(): void {
    this.analysisHistory.clear();
    this.stats = {
      total_analyses: 0,
      successful_integrations: 0,
      failed_integrations: 0,
      average_processing_time_ms: 0,
      consensus_achieved: 0,
      conflicts_resolved: 0,
      last_analysis: 0,
      active_symbols: 0,
    };
    info('Analysis Integration Engine data cleared');
  }
}

export const analysisIntegrationEngine = new AnalysisIntegrationEngine();
