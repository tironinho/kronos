import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface AIAgentConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  analysis_depth: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  decision_confidence_threshold: number;
  max_analysis_time_ms: number;
  retry_attempts: number;
}

export interface MarketAnalysis {
  id: string;
  symbol: string;
  timestamp: number;
  overall_sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  key_factors: string[];
  technical_analysis: {
    trend: 'UP' | 'DOWN' | 'SIDEWAYS';
    support_levels: number[];
    resistance_levels: number[];
    breakout_probability: number;
  };
  fundamental_analysis: {
    market_cap_trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    volume_analysis: 'HIGH' | 'MEDIUM' | 'LOW';
    news_sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  };
  risk_assessment: {
    volatility_level: 'LOW' | 'MEDIUM' | 'HIGH';
    liquidity_score: number;
    correlation_risk: number;
  };
  recommendations: {
    action: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
    confidence: number;
    reasoning: string[];
    price_targets: {
      conservative: number;
      moderate: number;
      aggressive: number;
    };
    stop_loss: number;
    take_profit: number;
  };
}

export interface TradingDecision {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string[];
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  position_size_percent: number;
  time_horizon: 'SHORT' | 'MEDIUM' | 'LONG';
  expected_return_percent: number;
  max_loss_percent: number;
  timestamp: number;
  analysis_id: string;
}

export interface AIAgentStats {
  total_analyses: number;
  successful_analyses: number;
  failed_analyses: number;
  average_confidence: number;
  decision_accuracy: number;
  average_analysis_time_ms: number;
  last_analysis: number;
  models_used: string[];
  error_rate: number;
}

export interface NegativeResultDetector {
  id: string;
  type: 'PERFORMANCE_DECLINE' | 'HIGH_LOSSES' | 'LOW_CONFIDENCE' | 'SYSTEM_ERROR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metrics: {
    current_value: number;
    threshold_value: number;
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  };
  recommendations: string[];
  timestamp: number;
  acknowledged: boolean;
}

export class BackesTraderAgent {
  private config: AIAgentConfig;
  private stats: AIAgentStats;
  private analyses: Map<string, MarketAnalysis> = new Map();
  private decisions: TradingDecision[] = [];
  private negativeDetectors: NegativeResultDetector[] = [];
  private isActive: boolean = false;

  constructor(config?: Partial<AIAgentConfig>) {
    this.config = {
      model: config?.model || 'gpt-4',
      temperature: config?.temperature || 0.3,
      max_tokens: config?.max_tokens || 2000,
      system_prompt: config?.system_prompt || this.getDefaultSystemPrompt(),
      analysis_depth: config?.analysis_depth || 'ADVANCED',
      decision_confidence_threshold: config?.decision_confidence_threshold || 0.7,
      max_analysis_time_ms: config?.max_analysis_time_ms || 30000,
      retry_attempts: config?.retry_attempts || 3,
    };

    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_confidence: 0,
      decision_accuracy: 0,
      average_analysis_time_ms: 0,
      last_analysis: 0,
      models_used: [this.config.model],
      error_rate: 0,
    };

    info('Backes Trader AI Agent initialized', { config: this.config });
  }

  private getDefaultSystemPrompt(): string {
    return `You are Backes Trader V2, an advanced AI trading agent specializing in cryptocurrency markets. 

Your capabilities:
- Advanced technical analysis using multiple indicators
- Fundamental analysis of market conditions
- Risk assessment and management
- Sentiment analysis from multiple sources
- Pattern recognition and trend analysis
- Portfolio optimization recommendations

Your objectives:
- Achieve 90%+ accuracy in trading decisions
- Maximize risk-adjusted returns
- Minimize drawdowns
- Provide clear, actionable insights
- Maintain consistent performance

Always provide:
1. Clear reasoning for your analysis
2. Confidence levels for your predictions
3. Risk assessments
4. Specific price targets and stop-loss levels
5. Time horizons for recommendations

Be precise, data-driven, and conservative in your approach.`;
  }

  public updateConfig(newConfig: Partial<AIAgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('AI Agent config updated', { newConfig });
  }

  public async analyzeMarket(symbol: string, marketData: any): Promise<MarketAnalysis> {
    const startTime = Date.now();
    const analysisId = generateUniqueId();

    try {
      this.stats.total_analyses++;
      
      // Simulate AI analysis (in real implementation, would call OpenAI API)
      const analysis = await this.performAIAnalysis(symbol, marketData, analysisId);
      
      this.analyses.set(analysisId, analysis);
      this.stats.successful_analyses++;
      this.stats.last_analysis = Date.now();
      
      const analysisTime = Date.now() - startTime;
      this.stats.average_analysis_time_ms = 
        (this.stats.average_analysis_time_ms * (this.stats.total_analyses - 1) + analysisTime) / 
        this.stats.total_analyses;

      // Update average confidence
      this.stats.average_confidence = 
        (this.stats.average_confidence * (this.stats.successful_analyses - 1) + analysis.confidence) / 
        this.stats.successful_analyses;

      info('Market analysis completed', {
        symbol,
        analysisId,
        confidence: analysis.confidence.toFixed(3),
        sentiment: analysis.overall_sentiment,
        analysisTime: `${analysisTime}ms`,
      });

      return analysis;

    } catch (err: any) {
      this.stats.failed_analyses++;
      this.stats.error_rate = this.stats.failed_analyses / this.stats.total_analyses;
      
      error('Market analysis failed', { symbol, error: err.message });
      throw err;
    }
  }

  private async performAIAnalysis(symbol: string, marketData: any, analysisId: string): Promise<MarketAnalysis> {
    // Simulate AI analysis process
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const sentiments = ['BULLISH', 'BEARISH', 'NEUTRAL'];
    const trends = ['UP', 'DOWN', 'SIDEWAYS'];
    const actions = ['BUY', 'SELL', 'HOLD', 'WATCH'];
    
    const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    const trend = trends[Math.floor(Math.random() * trends.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const confidence = Math.random() * 0.4 + 0.6; // 0.6 to 1.0

    const analysis: MarketAnalysis = {
      id: analysisId,
      symbol,
      timestamp: Date.now(),
      overall_sentiment: sentiment as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      confidence,
      key_factors: [
        'Technical indicators show strong momentum',
        'Volume analysis indicates institutional interest',
        'Market sentiment is positive',
        'Risk-reward ratio is favorable',
      ],
      technical_analysis: {
        trend: trend as 'UP' | 'DOWN' | 'SIDEWAYS',
        support_levels: [45000, 46000, 47000],
        resistance_levels: [52000, 53000, 54000],
        breakout_probability: Math.random() * 0.4 + 0.6,
      },
      fundamental_analysis: {
        market_cap_trend: 'INCREASING',
        volume_analysis: 'HIGH',
        news_sentiment: 'POSITIVE',
      },
      risk_assessment: {
        volatility_level: 'MEDIUM',
        liquidity_score: Math.random() * 0.4 + 0.6,
        correlation_risk: Math.random() * 0.3 + 0.2,
      },
      recommendations: {
        action: action as 'BUY' | 'SELL' | 'HOLD' | 'WATCH',
        confidence,
        reasoning: [
          'Strong technical setup',
          'Favorable risk-reward ratio',
          'Positive market sentiment',
          'Good liquidity conditions',
        ],
        price_targets: {
          conservative: 50000 * (1 + (Math.random() - 0.5) * 0.1),
          moderate: 50000 * (1 + (Math.random() - 0.5) * 0.15),
          aggressive: 50000 * (1 + (Math.random() - 0.5) * 0.2),
        },
        stop_loss: 50000 * (1 - Math.random() * 0.05),
        take_profit: 50000 * (1 + Math.random() * 0.1),
      },
    };

    return analysis;
  }

  public async generateTradingDecision(symbol: string, analysis: MarketAnalysis): Promise<TradingDecision> {
    try {
      const decisionId = generateUniqueId();
      
      // Simulate decision generation
      await new Promise(resolve => setTimeout(resolve, 500));

      const actions = ['BUY', 'SELL', 'HOLD', 'CLOSE'];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const confidence = analysis.confidence * (0.8 + Math.random() * 0.4); // Adjust based on analysis confidence

      const decision: TradingDecision = {
        id: decisionId,
        symbol,
        action: action as 'BUY' | 'SELL' | 'HOLD' | 'CLOSE',
        confidence,
        reasoning: analysis.recommendations.reasoning,
        risk_level: analysis.risk_assessment.volatility_level === 'HIGH' ? 'HIGH' : 
                   analysis.risk_assessment.volatility_level === 'MEDIUM' ? 'MEDIUM' : 'LOW',
        position_size_percent: Math.min(10, confidence * 15), // Max 10% position size
        time_horizon: confidence > 0.8 ? 'LONG' : confidence > 0.6 ? 'MEDIUM' : 'SHORT',
        expected_return_percent: (Math.random() - 0.5) * 20, // -10% to +10%
        max_loss_percent: Math.random() * 5, // 0% to 5%
        timestamp: Date.now(),
        analysis_id: analysis.id,
      };

      this.decisions.unshift(decision);
      
      // Keep only last 1000 decisions
      if (this.decisions.length > 1000) {
        this.decisions = this.decisions.slice(0, 1000);
      }

      info('Trading decision generated', {
        symbol,
        action: decision.action,
        confidence: decision.confidence.toFixed(3),
        riskLevel: decision.risk_level,
      });

      return decision;

    } catch (err: any) {
      error('Error generating trading decision', { symbol, error: err.message });
      throw err;
    }
  }

  public async detectNegativeResults(): Promise<NegativeResultDetector[]> {
    const detectors: NegativeResultDetector[] = [];

    try {
      // Check performance decline
      if (this.stats.decision_accuracy < 0.6) {
        detectors.push({
          id: generateUniqueId(),
          type: 'PERFORMANCE_DECLINE',
          severity: 'HIGH',
          description: 'Decision accuracy below 60% threshold',
          metrics: {
            current_value: this.stats.decision_accuracy,
            threshold_value: 0.6,
            trend: 'DECLINING',
          },
          recommendations: [
            'Review recent trading decisions',
            'Adjust confidence thresholds',
            'Consider reducing position sizes',
            'Implement additional risk controls',
          ],
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Check high error rate
      if (this.stats.error_rate > 0.1) {
        detectors.push({
          id: generateUniqueId(),
          type: 'SYSTEM_ERROR',
          severity: 'MEDIUM',
          description: 'Error rate above 10% threshold',
          metrics: {
            current_value: this.stats.error_rate,
            threshold_value: 0.1,
            trend: 'STABLE',
          },
          recommendations: [
            'Check API connectivity',
            'Review error logs',
            'Implement retry mechanisms',
            'Consider fallback strategies',
          ],
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Check low confidence
      if (this.stats.average_confidence < 0.5) {
        detectors.push({
          id: generateUniqueId(),
          type: 'LOW_CONFIDENCE',
          severity: 'MEDIUM',
          description: 'Average confidence below 50%',
          metrics: {
            current_value: this.stats.average_confidence,
            threshold_value: 0.5,
            trend: 'STABLE',
          },
          recommendations: [
            'Improve data quality',
            'Enhance analysis algorithms',
            'Increase training data',
            'Adjust confidence thresholds',
          ],
          timestamp: Date.now(),
          acknowledged: false,
        });
      }

      // Add to negative detectors list
      this.negativeDetectors.unshift(...detectors);
      
      // Keep only last 1000 detectors
      if (this.negativeDetectors.length > 1000) {
        this.negativeDetectors = this.negativeDetectors.slice(0, 1000);
      }

      if (detectors.length > 0) {
        info('Negative results detected', { count: detectors.length });
      }

      return detectors;

    } catch (err: any) {
      error('Error detecting negative results', { error: err.message });
      return [];
    }
  }

  public getStats(): AIAgentStats {
    return { ...this.stats };
  }

  public getAnalysis(analysisId: string): MarketAnalysis | undefined {
    return this.analyses.get(analysisId);
  }

  public getLatestAnalysis(symbol: string): MarketAnalysis | undefined {
    const analyses = Array.from(this.analyses.values())
      .filter(a => a.symbol === symbol)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return analyses[0];
  }

  public getDecisions(symbol?: string, limit?: number): TradingDecision[] {
    let filtered = symbol ? 
      this.decisions.filter(d => d.symbol === symbol) : 
      this.decisions;
    
    return limit ? filtered.slice(0, limit) : filtered;
  }

  public getLatestDecision(symbol: string): TradingDecision | undefined {
    return this.decisions
      .filter(d => d.symbol === symbol)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  public getNegativeDetectors(limit?: number): NegativeResultDetector[] {
    return limit ? this.negativeDetectors.slice(0, limit) : this.negativeDetectors;
  }

  public acknowledgeNegativeDetector(detectorId: string): boolean {
    const detector = this.negativeDetectors.find(d => d.id === detectorId);
    if (detector) {
      detector.acknowledged = true;
      info('Negative detector acknowledged', { detectorId });
      return true;
    }
    return false;
  }

  public start(): void {
    this.isActive = true;
    info('AI Agent started');
  }

  public stop(): void {
    this.isActive = false;
    info('AI Agent stopped');
  }

  public clearData(): void {
    this.analyses.clear();
    this.decisions = [];
    this.negativeDetectors = [];
    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_confidence: 0,
      decision_accuracy: 0,
      average_analysis_time_ms: 0,
      last_analysis: 0,
      models_used: [this.config.model],
      error_rate: 0,
    };
    info('AI Agent data cleared');
  }
}

export const backesTraderAgent = new BackesTraderAgent();
