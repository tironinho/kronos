import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';
import { TradingSignal } from '../types';

export interface TradingIntegrationConfig {
  enabled_strategies: string[];
  risk_management: {
    max_position_size: number;
    max_daily_loss: number;
    max_drawdown: number;
    stop_loss_percent: number;
    take_profit_percent: number;
  };
  execution: {
    execution_mode: 'LIVE' | 'PAPER' | 'BACKTEST';
    slippage_tolerance: number;
    max_execution_delay: number;
    retry_attempts: number;
  };
  integration: {
    signal_engine: boolean;
    monte_carlo: boolean;
    confidence_model: boolean;
    sentiment_analysis: boolean;
    onchain_analysis: boolean;
    reinforcement_learning: boolean;
    ml_models: boolean;
    ai_agent: boolean;
  };
  alerts: {
    enabled: boolean;
    channels: string[];
    thresholds: {
      profit_loss: number;
      position_size: number;
      risk_level: number;
    };
  };
}

export interface IntegratedSignal {
  id: string;
  timestamp: number;
  symbol: string;
  signal_type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strength: number;
  sources: {
    signal_engine: { confidence: number; strength: number; signal: string };
    monte_carlo: { confidence: number; recommendation: string };
    confidence_model: { global_score: number; symbol_score: number };
    sentiment_analysis: { sentiment: number; confidence: number };
    onchain_analysis: { network_health: number; whale_activity: number };
    reinforcement_learning: { action: string; q_value: number };
    ml_models: { prediction: number; confidence: number };
    ai_agent: { decision: string; confidence: number };
  };
  risk_assessment: {
    position_size: number;
    stop_loss: number;
    take_profit: number;
    risk_score: number;
    max_loss: number;
  };
  execution_plan: {
    entry_price: number;
    quantity: number;
    execution_time: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export interface TradingIntegrationStats {
  total_signals: number;
  executed_signals: number;
  successful_trades: number;
  failed_trades: number;
  total_pnl: number;
  average_confidence: number;
  risk_violations: number;
  execution_delays: number;
  last_signal: number;
  active_positions: number;
}

export class TradingIntegrationEngine {
  private config: TradingIntegrationConfig;
  private stats: TradingIntegrationStats;
  private activePositions: Map<string, any> = new Map();
  private signalHistory: IntegratedSignal[] = [];
  private isRunning: boolean = false;

  constructor(config?: Partial<TradingIntegrationConfig>) {
    this.config = {
      enabled_strategies: config?.enabled_strategies || ['signal_engine', 'monte_carlo', 'confidence_model'],
      risk_management: {
        max_position_size: config?.risk_management?.max_position_size || 0.1,
        max_daily_loss: config?.risk_management?.max_daily_loss || 0.05,
        max_drawdown: config?.risk_management?.max_drawdown || 0.1,
        stop_loss_percent: config?.risk_management?.stop_loss_percent || 0.02,
        take_profit_percent: config?.risk_management?.take_profit_percent || 0.04,
      },
      execution: {
        execution_mode: config?.execution?.execution_mode || 'PAPER',
        slippage_tolerance: config?.execution?.slippage_tolerance || 0.001,
        max_execution_delay: config?.execution?.max_execution_delay || 5000,
        retry_attempts: config?.execution?.retry_attempts || 3,
      },
      integration: {
        signal_engine: config?.integration?.signal_engine ?? true,
        monte_carlo: config?.integration?.monte_carlo ?? true,
        confidence_model: config?.integration?.confidence_model ?? true,
        sentiment_analysis: config?.integration?.sentiment_analysis ?? true,
        onchain_analysis: config?.integration?.onchain_analysis ?? true,
        reinforcement_learning: config?.integration?.reinforcement_learning ?? true,
        ml_models: config?.integration?.ml_models ?? true,
        ai_agent: config?.integration?.ai_agent ?? true,
      },
      alerts: {
        enabled: config?.alerts?.enabled ?? true,
        channels: config?.alerts?.channels || ['console', 'email'],
        thresholds: {
          profit_loss: config?.alerts?.thresholds?.profit_loss || 1000,
          position_size: config?.alerts?.thresholds?.position_size || 0.05,
          risk_level: config?.alerts?.thresholds?.risk_level || 0.8,
        },
      },
    };

    this.stats = {
      total_signals: 0,
      executed_signals: 0,
      successful_trades: 0,
      failed_trades: 0,
      total_pnl: 0,
      average_confidence: 0,
      risk_violations: 0,
      execution_delays: 0,
      last_signal: 0,
      active_positions: 0,
    };

    info('Trading Integration Engine initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<TradingIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Trading Integration config updated', { newConfig });
  }

  public async startIntegration(): Promise<void> {
    if (this.isRunning) {
      warn('Trading integration is already running');
      return;
    }

    this.isRunning = true;
    info('Trading Integration Engine started');

    // Start monitoring for signals from various sources
    this.startSignalMonitoring();
  }

  public async stopIntegration(): Promise<void> {
    if (!this.isRunning) {
      warn('Trading integration is not running');
      return;
    }

    this.isRunning = false;
    info('Trading Integration Engine stopped');
  }

  private startSignalMonitoring(): void {
    // This would typically set up event listeners for various signal sources
    // For now, we'll simulate periodic signal processing
    setInterval(() => {
      if (this.isRunning) {
        this.processSignals();
      }
    }, 10000); // Every 10 seconds
  }

  private async processSignals(): Promise<void> {
    try {
      // Collect signals from all integrated sources
      const signals = await this.collectSignalsFromSources();
      
      if (signals.length > 0) {
        // Integrate signals
        const integratedSignal = await this.integrateSignals(signals);
        
        // Assess risk
        const riskAssessment = await this.assessRisk(integratedSignal);
        
        // Create execution plan
        const executionPlan = await this.createExecutionPlan(integratedSignal, riskAssessment);
        
        // Execute if conditions are met
        if (this.shouldExecute(integratedSignal, riskAssessment)) {
          await this.executeSignal(integratedSignal, executionPlan);
        }
      }
    } catch (err: any) {
      error('Error processing signals', { error: err.message });
    }
  }

  private async collectSignalsFromSources(): Promise<any[]> {
    const signals: any[] = [];

    try {
      // Collect from Signal Engine
      if (this.config.integration.signal_engine) {
        // This would typically get signals from the signal engine
        // For now, we'll simulate
        signals.push({
          source: 'signal_engine',
          signal: 'BUY',
          confidence: 0.7,
          strength: 0.8,
        });
      }

      // Collect from Monte Carlo
      if (this.config.integration.monte_carlo) {
        signals.push({
          source: 'monte_carlo',
          recommendation: 'BUY',
          confidence: 0.6,
        });
      }

      // Collect from Confidence Model
      if (this.config.integration.confidence_model) {
        signals.push({
          source: 'confidence_model',
          global_score: 0.75,
          symbol_score: 0.8,
        });
      }

      // Collect from Sentiment Analysis
      if (this.config.integration.sentiment_analysis) {
        signals.push({
          source: 'sentiment_analysis',
          sentiment: 0.6,
          confidence: 0.7,
        });
      }

      // Collect from On-chain Analysis
      if (this.config.integration.onchain_analysis) {
        signals.push({
          source: 'onchain_analysis',
          network_health: 0.8,
          whale_activity: 0.3,
        });
      }

      // Collect from Reinforcement Learning
      if (this.config.integration.reinforcement_learning) {
        signals.push({
          source: 'reinforcement_learning',
          action: 'BUY',
          q_value: 0.7,
        });
      }

      // Collect from ML Models
      if (this.config.integration.ml_models) {
        signals.push({
          source: 'ml_models',
          prediction: 0.65,
          confidence: 0.7,
        });
      }

      // Collect from AI Agent
      if (this.config.integration.ai_agent) {
        signals.push({
          source: 'ai_agent',
          decision: 'BUY',
          confidence: 0.8,
        });
      }

    } catch (err: any) {
      error('Error collecting signals from sources', { error: err.message });
    }

    return signals;
  }

  private async integrateSignals(signals: any[]): Promise<IntegratedSignal> {
    const now = Date.now();
    const symbol = 'BTCUSDT'; // Default symbol, would be determined by context

    // Process signals by source
    const sources: any = {};
    let totalConfidence = 0;
    let signalCount = 0;

    for (const signal of signals) {
      sources[signal.source] = signal;
      totalConfidence += signal.confidence || 0.5;
      signalCount++;
    }

    // Calculate overall confidence
    const averageConfidence = signalCount > 0 ? totalConfidence / signalCount : 0;

    // Determine signal type based on majority vote
    const buySignals = signals.filter(s => 
      s.signal === 'BUY' || s.recommendation === 'BUY' || s.action === 'BUY' || s.decision === 'BUY'
    ).length;
    const sellSignals = signals.filter(s => 
      s.signal === 'SELL' || s.recommendation === 'SELL' || s.action === 'SELL' || s.decision === 'SELL'
    ).length;

    let signalType: 'BUY' | 'SELL' | 'HOLD';
    if (buySignals > sellSignals && buySignals > 0) {
      signalType = 'BUY';
    } else if (sellSignals > buySignals && sellSignals > 0) {
      signalType = 'SELL';
    } else {
      signalType = 'HOLD';
    }

    // Calculate strength based on consensus
    const strength = Math.min(1.0, (Math.max(buySignals, sellSignals) / signals.length) * 2);

    const integratedSignal: IntegratedSignal = {
      id: generateUniqueId(),
      timestamp: now,
      symbol,
      signal_type: signalType,
      confidence: averageConfidence,
      strength,
      sources,
      risk_assessment: {
        position_size: 0,
        stop_loss: 0,
        take_profit: 0,
        risk_score: 0,
        max_loss: 0,
      },
      execution_plan: {
        entry_price: 0,
        quantity: 0,
        execution_time: now,
        priority: 'MEDIUM',
      },
    };

    this.signalHistory.push(integratedSignal);
    this.stats.total_signals++;
    this.stats.last_signal = now;

    info('Signals integrated', {
      signalId: integratedSignal.id,
      signalType,
      confidence: averageConfidence.toFixed(3),
      strength: strength.toFixed(3),
      sourcesCount: signals.length,
    });

    return integratedSignal;
  }

  private async assessRisk(signal: IntegratedSignal): Promise<any> {
    const riskScore = this.calculateRiskScore(signal);
    const positionSize = this.calculatePositionSize(signal, riskScore);
    const stopLoss = this.calculateStopLoss(signal);
    const takeProfit = this.calculateTakeProfit(signal);
    const maxLoss = positionSize * this.config.risk_management.stop_loss_percent;

    const riskAssessment = {
      position_size: positionSize,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      risk_score: riskScore,
      max_loss: maxLoss,
    };

    signal.risk_assessment = riskAssessment;

    // Check for risk violations
    if (riskScore > this.config.alerts.thresholds.risk_level) {
      this.stats.risk_violations++;
      warn('Risk threshold exceeded', {
        signalId: signal.id,
        riskScore: riskScore.toFixed(3),
        threshold: this.config.alerts.thresholds.risk_level,
      });
    }

    return riskAssessment;
  }

  private calculateRiskScore(signal: IntegratedSignal): number {
    let riskScore = 0;

    // Base risk from signal confidence
    riskScore += (1 - signal.confidence) * 0.3;

    // Risk from position size
    const currentPositions = this.activePositions.size;
    riskScore += Math.min(currentPositions / 10, 1) * 0.2;

    // Risk from market volatility (simulated)
    const volatility = 0.3; // Would be calculated from market data
    riskScore += volatility * 0.3;

    // Risk from sentiment divergence
    if (signal.sources.sentiment_analysis) {
      const sentimentRisk = Math.abs(signal.sources.sentiment_analysis.sentiment - 0.5) * 2;
      riskScore += sentimentRisk * 0.2;
    }

    return Math.min(riskScore, 1.0);
  }

  private calculatePositionSize(signal: IntegratedSignal, riskScore: number): number {
    const baseSize = this.config.risk_management.max_position_size;
    const riskAdjustment = 1 - riskScore;
    const confidenceAdjustment = signal.confidence;
    
    return baseSize * riskAdjustment * confidenceAdjustment;
  }

  private calculateStopLoss(signal: IntegratedSignal): number {
    // This would use current market price
    const currentPrice = 50000; // Placeholder
    const stopLossPercent = this.config.risk_management.stop_loss_percent;
    
    if (signal.signal_type === 'BUY') {
      return currentPrice * (1 - stopLossPercent);
    } else if (signal.signal_type === 'SELL') {
      return currentPrice * (1 + stopLossPercent);
    }
    
    return currentPrice;
  }

  private calculateTakeProfit(signal: IntegratedSignal): number {
    // This would use current market price
    const currentPrice = 50000; // Placeholder
    const takeProfitPercent = this.config.risk_management.take_profit_percent;
    
    if (signal.signal_type === 'BUY') {
      return currentPrice * (1 + takeProfitPercent);
    } else if (signal.signal_type === 'SELL') {
      return currentPrice * (1 - takeProfitPercent);
    }
    
    return currentPrice;
  }

  private async createExecutionPlan(signal: IntegratedSignal, riskAssessment: any): Promise<any> {
    const currentPrice = 50000; // Placeholder - would get from market data
    const quantity = riskAssessment.position_size * 10000 / currentPrice; // Assuming 10k capital
    
    const executionPlan = {
      entry_price: currentPrice,
      quantity,
      execution_time: Date.now(),
      priority: this.determinePriority(signal, riskAssessment),
    };

    signal.execution_plan = executionPlan;

    return executionPlan;
  }

  private determinePriority(signal: IntegratedSignal, riskAssessment: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (signal.confidence > 0.8 && signal.strength > 0.8) {
      return 'HIGH';
    } else if (signal.confidence > 0.6 && signal.strength > 0.6) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private shouldExecute(signal: IntegratedSignal, riskAssessment: any): boolean {
    // Don't execute if risk is too high
    if (riskAssessment.risk_score > this.config.alerts.thresholds.risk_level) {
      return false;
    }

    // Don't execute if confidence is too low
    if (signal.confidence < 0.5) {
      return false;
    }

    // Don't execute if it's a HOLD signal
    if (signal.signal_type === 'HOLD') {
      return false;
    }

    // Don't execute if position size is too small
    if (riskAssessment.position_size < 0.01) {
      return false;
    }

    return true;
  }

  private async executeSignal(signal: IntegratedSignal, executionPlan: any): Promise<void> {
    const startTime = Date.now();

    try {
      info('Executing integrated signal', {
        signalId: signal.id,
        signalType: signal.signal_type,
        quantity: executionPlan.quantity.toFixed(4),
        entryPrice: executionPlan.entry_price,
        priority: executionPlan.priority,
      });

      // Simulate execution delay
      const executionDelay = Math.random() * 1000; // 0-1 second
      await new Promise(resolve => setTimeout(resolve, executionDelay));

      // Record execution
      this.stats.executed_signals++;
      this.stats.execution_delays += executionDelay;

      // Simulate trade result
      const isSuccessful = Math.random() > 0.1; // 90% success rate
      if (isSuccessful) {
        this.stats.successful_trades++;
        const pnl = (Math.random() - 0.5) * executionPlan.quantity * executionPlan.entry_price * 0.02;
        this.stats.total_pnl += pnl;
      } else {
        this.stats.failed_trades++;
      }

      // Update average confidence
      this.stats.average_confidence = 
        (this.stats.average_confidence * (this.stats.executed_signals - 1) + signal.confidence) / 
        this.stats.executed_signals;

      // Add to active positions
      this.activePositions.set(signal.id, {
        signal,
        executionPlan,
        executedAt: Date.now(),
        status: isSuccessful ? 'ACTIVE' : 'FAILED',
      });

      this.stats.active_positions = this.activePositions.size;

      info('Signal executed successfully', {
        signalId: signal.id,
        executionTime: `${Date.now() - startTime}ms`,
        success: isSuccessful,
      });

    } catch (err: any) {
      error('Signal execution failed', {
        signalId: signal.id,
        error: err.message,
      });
      this.stats.failed_trades++;
    }
  }

  public getStats(): TradingIntegrationStats {
    return { ...this.stats };
  }

  public getConfig(): TradingIntegrationConfig {
    return { ...this.config };
  }

  public getActivePositions(): Map<string, any> {
    return new Map(this.activePositions);
  }

  public getSignalHistory(): IntegratedSignal[] {
    return [...this.signalHistory];
  }

  public clearData(): void {
    this.activePositions.clear();
    this.signalHistory = [];
    this.stats = {
      total_signals: 0,
      executed_signals: 0,
      successful_trades: 0,
      failed_trades: 0,
      total_pnl: 0,
      average_confidence: 0,
      risk_violations: 0,
      execution_delays: 0,
      last_signal: 0,
      active_positions: 0,
    };
    info('Trading Integration Engine data cleared');
  }
}

export const tradingIntegrationEngine = new TradingIntegrationEngine();
