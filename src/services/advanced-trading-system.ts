import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';
import { TradingSignal } from '../types';
import { monteCarloEngine } from './monte-carlo';
import { tradeOrchestrator } from './trade-orchestrator';
import { confidenceModel } from './confidence-model';
import { orderManager } from './order-manager';
import { riskManager } from './risk-manager';
import { accountBalanceManager } from './account-balance-manager';

export interface AdvancedTradingConfig {
  target_accuracy_percent: number;
  target_daily_growth_percent: number;
  max_positions_per_symbol: number;
  position_sizing_method: 'FIXED' | 'RISK_BASED' | 'VOLATILITY_ADJUSTED';
  signal_confidence_threshold: number;
  monte_carlo_confidence_threshold: number;
  risk_reward_ratio: number;
  max_drawdown_percent: number;
  trading_hours: {
    start_hour: number;
    end_hour: number;
    timezone: string;
  };
  auto_rebalance: boolean;
  rebalance_threshold_percent: number;
}

export interface TradingDecision {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
  confidence: number;
  reasoning: string[];
  risk_assessment: {
    risk_score: number;
    position_size_usd: number;
    stop_loss_price: number;
    take_profit_price: number;
    risk_reward_ratio: number;
  };
  market_analysis: {
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    volume_profile: 'LOW' | 'MEDIUM' | 'HIGH';
    momentum: 'STRONG' | 'WEAK' | 'NEUTRAL';
  };
  timestamp: number;
  executed: boolean;
  execution_price?: number;
  execution_time?: number;
}

export interface TradingPerformance {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  daily_pnl: number;
  max_drawdown: number;
  sharpe_ratio: number;
  average_trade_duration_minutes: number;
  best_trade_pnl: number;
  worst_trade_pnl: number;
  consecutive_wins: number;
  consecutive_losses: number;
  accuracy_vs_target: number;
  growth_vs_target: number;
  last_updated: number;
}

export interface AdvancedTradingStats {
  system_status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  target_accuracy: number;
  current_accuracy: number;
  target_daily_growth: number;
  current_daily_growth: number;
  active_positions: number;
  pending_decisions: number;
  system_uptime_hours: number;
  last_signal_time: number;
  performance: TradingPerformance;
}

export class AdvancedTradingSystem {
  private config: AdvancedTradingConfig;
  private stats: AdvancedTradingStats;
  private activeDecisions: Map<string, TradingDecision> = new Map();
  private decisionHistory: TradingDecision[] = [];
  private isActive: boolean = false;
  private startTime: number = Date.now();
  private signalProcessor: NodeJS.Timeout | null = null;

  constructor(config?: Partial<AdvancedTradingConfig>) {
    this.config = {
      target_accuracy_percent: config?.target_accuracy_percent || 90,
      target_daily_growth_percent: config?.target_daily_growth_percent || 100,
      max_positions_per_symbol: config?.max_positions_per_symbol || 2,
      position_sizing_method: config?.position_sizing_method || 'RISK_BASED',
      signal_confidence_threshold: config?.signal_confidence_threshold || 0.7,
      monte_carlo_confidence_threshold: config?.monte_carlo_confidence_threshold || 0.6,
      risk_reward_ratio: config?.risk_reward_ratio || 2.0,
      max_drawdown_percent: config?.max_drawdown_percent || 0.05,
      trading_hours: {
        start_hour: config?.trading_hours?.start_hour || 9,
        end_hour: config?.trading_hours?.end_hour || 17,
        timezone: config?.trading_hours?.timezone || 'UTC',
      },
      auto_rebalance: config?.auto_rebalance || false,
      rebalance_threshold_percent: config?.rebalance_threshold_percent || 0.1,
    };

    this.stats = {
      system_status: 'STOPPED',
      target_accuracy: this.config.target_accuracy_percent,
      current_accuracy: 0,
      target_daily_growth: this.config.target_daily_growth_percent,
      current_daily_growth: 0,
      active_positions: 0,
      pending_decisions: 0,
      system_uptime_hours: 0,
      last_signal_time: 0,
      performance: {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        daily_pnl: 0,
        max_drawdown: 0,
        sharpe_ratio: 0,
        average_trade_duration_minutes: 0,
        best_trade_pnl: 0,
        worst_trade_pnl: 0,
        consecutive_wins: 0,
        consecutive_losses: 0,
        accuracy_vs_target: 0,
        growth_vs_target: 0,
        last_updated: Date.now(),
      },
    };

    info('Advanced Trading System initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<AdvancedTradingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Advanced Trading System config updated', { newConfig });
  }

  public async start(): Promise<void> {
    if (this.isActive) {
      warn('Advanced Trading System is already active');
      return;
    }

    this.isActive = true;
    this.stats.system_status = 'ACTIVE';
    this.startTime = Date.now();

    // Start signal processing loop
    this.signalProcessor = setInterval(async () => {
      await this.processSignals();
    }, 5000); // Process signals every 5 seconds

    info('Advanced Trading System started', {
      targetAccuracy: this.config.target_accuracy_percent,
      targetGrowth: this.config.target_daily_growth_percent,
    });
  }

  public stop(): void {
    if (!this.isActive) {
      warn('Advanced Trading System is not active');
      return;
    }

    this.isActive = false;
    this.stats.system_status = 'STOPPED';

    if (this.signalProcessor) {
      clearInterval(this.signalProcessor);
      this.signalProcessor = null;
    }

    info('Advanced Trading System stopped');
  }

  public pause(): void {
    if (!this.isActive) {
      warn('Advanced Trading System is not active');
      return;
    }

    this.stats.system_status = 'PAUSED';
    info('Advanced Trading System paused');
  }

  public resume(): void {
    if (!this.isActive) {
      warn('Advanced Trading System is not active');
      return;
    }

    this.stats.system_status = 'ACTIVE';
    info('Advanced Trading System resumed');
  }

  private async processSignals(): Promise<void> {
    if (this.stats.system_status !== 'ACTIVE') {
      return;
    }

    try {
      // Check if we're in trading hours
      if (!this.isTradingHours()) {
        return;
      }

      // Get signals from SignalEngine (mock for now)
      const signals: any[] = [];
      
      for (const signal of signals) {
        await this.processSignal(signal);
      }

      // Update system stats
      this.updateSystemStats();

    } catch (err: any) {
      error('Error processing signals', { error: err.message });
    }
  }

  private async processSignal(signal: TradingSignal): Promise<void> {
    try {
      // Check signal confidence threshold
      if (signal.confidence < this.config.signal_confidence_threshold) {
        return;
      }

      // Get Monte Carlo analysis
      const monteCarloResult = monteCarloEngine.getResult(signal.symbol);
      if (monteCarloResult && monteCarloResult.probability_up < this.config.monte_carlo_confidence_threshold) {
        return;
      }

      // Get confidence model analysis
      const confidenceMetrics = confidenceModel.getSymbolConfidence(signal.symbol);
      if (!confidenceMetrics || confidenceMetrics.overall_confidence < this.config.signal_confidence_threshold) {
        return;
      }

      // Check risk limits
      const riskAssessment = this.assessRisk(signal);
      if (!riskManager.shouldAllowTrade(signal.symbol, riskAssessment.position_size_usd / 50000, 50000, signal.signal_type as 'BUY' | 'SELL')) {
        return;
      }

      // Generate trading decision
      const decision = await this.generateTradingDecision(signal, monteCarloResult, confidenceMetrics, riskAssessment);
      
      if (decision.action !== 'HOLD') {
        await this.executeDecision(decision);
      }

    } catch (err: any) {
      error('Error processing signal', { symbol: signal.symbol, error: err.message });
    }
  }

  private assessRisk(signal: TradingSignal): {
    risk_score: number;
    position_size_usd: number;
    stop_loss_price: number;
    take_profit_price: number;
    risk_reward_ratio: number;
  } {
    const currentPrice = 50000; // Placeholder - would get from market data
    const positionSize = this.calculatePositionSize(signal.symbol, currentPrice);
    const riskScore = riskManager.calculatePositionRisk(signal.symbol, positionSize / currentPrice, currentPrice, signal.signal_type as 'BUY' | 'SELL');
    
    const stopLossPrice = riskManager.getRecommendedStopLoss(signal.symbol, currentPrice, signal.signal_type as 'BUY' | 'SELL');
    const takeProfitPrice = riskManager.getRecommendedTakeProfit(signal.symbol, currentPrice, signal.signal_type as 'BUY' | 'SELL');
    
    const riskRewardRatio = Math.abs(takeProfitPrice - currentPrice) / Math.abs(currentPrice - stopLossPrice);

    return {
      risk_score: riskScore,
      position_size_usd: positionSize,
      stop_loss_price: stopLossPrice,
      take_profit_price: takeProfitPrice,
      risk_reward_ratio: riskRewardRatio,
    };
  }

  private calculatePositionSize(symbol: string, price: number): number {
    const availableBalance = accountBalanceManager.getCurrentBalance().available_balance_usdt;
    
    switch (this.config.position_sizing_method) {
      case 'FIXED':
        return Math.min(availableBalance * 0.1, this.config.max_positions_per_symbol * 1000);
      
      case 'RISK_BASED':
        return accountBalanceManager.calculatePositionSize(symbol, this.config.max_drawdown_percent);
      
      case 'VOLATILITY_ADJUSTED':
        const baseSize = availableBalance * 0.1;
        const volatility = 0.02; // Placeholder - would get from market data
        return baseSize * (1 - volatility); // Reduce size for high volatility
      
      default:
        return availableBalance * 0.1;
    }
  }

  private async generateTradingDecision(
    signal: TradingSignal,
    monteCarloResult: any,
    confidenceMetrics: any,
    riskAssessment: any
  ): Promise<TradingDecision> {
    const reasoning: string[] = [];
    let action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE' = 'HOLD';
    let confidence = signal.confidence;

    // Analyze signal strength
    if (signal.strength > 0.7) {
      reasoning.push(`Strong signal strength: ${signal.strength.toFixed(3)}`);
    }

    // Analyze Monte Carlo results
    if (monteCarloResult) {
      const probability = signal.signal_type === 'BUY' ? monteCarloResult.probability_up : monteCarloResult.probability_down;
      if (probability > 0.6) {
        reasoning.push(`Monte Carlo probability: ${(probability * 100).toFixed(1)}%`);
        confidence *= probability;
      }
    }

    // Analyze confidence metrics
    if (confidenceMetrics.overall_confidence > 0.7) {
      reasoning.push(`High confidence: ${(confidenceMetrics.overall_confidence * 100).toFixed(1)}%`);
      confidence *= confidenceMetrics.overall_confidence;
    }

    // Analyze risk-reward ratio
    if (riskAssessment.risk_reward_ratio >= this.config.risk_reward_ratio) {
      reasoning.push(`Good risk-reward ratio: ${riskAssessment.risk_reward_ratio.toFixed(2)}`);
    } else {
      reasoning.push(`Poor risk-reward ratio: ${riskAssessment.risk_reward_ratio.toFixed(2)}`);
      confidence *= 0.5; // Reduce confidence for poor risk-reward
    }

    // Determine action
    if (confidence >= this.config.signal_confidence_threshold) {
      action = signal.signal_type as 'BUY' | 'SELL' | 'HOLD';
    }

    // Check for existing positions
    const existingPosition = riskManager.getPosition(signal.symbol);
    if (existingPosition && action !== 'HOLD') {
      if ((existingPosition.side === 'BUY' && action === 'SELL') || 
          (existingPosition.side === 'SELL' && action === 'BUY')) {
        action = 'CLOSE';
        reasoning.push('Closing existing position');
      }
    }

    const decision: TradingDecision = {
      id: generateUniqueId(),
      symbol: signal.symbol,
      action,
      confidence,
      reasoning,
      risk_assessment: riskAssessment,
      market_analysis: {
        trend: signal.strength > 0 ? 'BULLISH' : 'BEARISH',
        volatility: 'MEDIUM', // Placeholder
        volume_profile: 'MEDIUM', // Placeholder
        momentum: signal.strength > 0.5 ? 'STRONG' : 'WEAK',
      },
      timestamp: Date.now(),
      executed: false,
    };

    return decision;
  }

  private async executeDecision(decision: TradingDecision): Promise<void> {
    try {
      const currentPrice = 50000; // Placeholder - would get from market data
      
      if (decision.action === 'CLOSE') {
        // Close existing position
        const orders = orderManager.getOrdersBySymbol(decision.symbol);
        for (const order of orders) {
          if (order.isWorking) {
            await orderManager.cancelOrder(order.id);
          }
        }
        decision.executed = true;
        decision.execution_price = currentPrice;
        decision.execution_time = Date.now();
      } else if (decision.action === 'BUY' || decision.action === 'SELL') {
        // Place new order
        const quantity = decision.risk_assessment.position_size_usd / currentPrice;
        
        const order = await orderManager.placeOrder({
          symbol: decision.symbol,
          side: decision.action,
          type: 'MARKET',
          quantity,
        });

        if (order.status === 'FILLED') {
          decision.executed = true;
          decision.execution_price = order.averagePrice || currentPrice;
          decision.execution_time = order.updateTime;
        }
      }

      // Add to active decisions
      this.activeDecisions.set(decision.id, decision);
      
      // Add to history
      this.decisionHistory.unshift(decision);
      
      // Keep only last 1000 decisions
      if (this.decisionHistory.length > 1000) {
        this.decisionHistory = this.decisionHistory.slice(0, 1000);
      }

      // Record signal result for confidence model
      if (decision.executed) {
        const returnValue = decision.action === 'BUY' ? 0.02 : -0.02; // Placeholder
        confidenceModel.recordSignalResult(decision.symbol, 'AdvancedTrading', true, returnValue);
      }

      info('Trading decision executed', {
        id: decision.id,
        symbol: decision.symbol,
        action: decision.action,
        confidence: decision.confidence.toFixed(3),
        executed: decision.executed,
      });

    } catch (err: any) {
      error('Error executing trading decision', { 
        decisionId: decision.id, 
        symbol: decision.symbol, 
        error: err.message 
      });
    }
  }

  private isTradingHours(): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    
    return currentHour >= this.config.trading_hours.start_hour && 
           currentHour <= this.config.trading_hours.end_hour;
  }

  private updateSystemStats(): void {
    this.stats.active_positions = riskManager.getPositions().size;
    this.stats.pending_decisions = this.activeDecisions.size;
    this.stats.system_uptime_hours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    
    // Update performance metrics
    const orders = orderManager.getAllOrders();
    const filledOrders = orders.filter(o => o.status === 'FILLED');
    
    this.stats.performance.total_trades = filledOrders.length;
    this.stats.performance.winning_trades = filledOrders.filter(o => (o.averagePrice || 0) > 0).length;
    this.stats.performance.losing_trades = filledOrders.length - this.stats.performance.winning_trades;
    this.stats.performance.win_rate = this.stats.performance.total_trades > 0 ? 
      this.stats.performance.winning_trades / this.stats.performance.total_trades : 0;
    
    this.stats.current_accuracy = this.stats.performance.win_rate * 100;
    this.stats.performance.accuracy_vs_target = this.stats.current_accuracy / this.config.target_accuracy_percent;
    
    this.stats.performance.last_updated = Date.now();
  }

  public getStats(): AdvancedTradingStats {
    return { ...this.stats };
  }

  public getConfig(): AdvancedTradingConfig {
    return { ...this.config };
  }

  public getActiveDecisions(): TradingDecision[] {
    return Array.from(this.activeDecisions.values());
  }

  public getDecisionHistory(limit?: number): TradingDecision[] {
    return limit ? this.decisionHistory.slice(0, limit) : this.decisionHistory;
  }

  public getDecisionById(id: string): TradingDecision | undefined {
    return this.activeDecisions.get(id) || this.decisionHistory.find(d => d.id === id);
  }

  public async processTradingSignal(signal: TradingSignal, marketData: any): Promise<void> {
    await this.processSignal(signal);
  }

  public clearHistory(): void {
    this.decisionHistory = [];
    this.activeDecisions.clear();
    this.stats = {
      system_status: 'STOPPED',
      target_accuracy: this.config.target_accuracy_percent,
      current_accuracy: 0,
      target_daily_growth: this.config.target_daily_growth_percent,
      current_daily_growth: 0,
      active_positions: 0,
      pending_decisions: 0,
      system_uptime_hours: 0,
      last_signal_time: 0,
      performance: {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        daily_pnl: 0,
        max_drawdown: 0,
        sharpe_ratio: 0,
        average_trade_duration_minutes: 0,
        best_trade_pnl: 0,
        worst_trade_pnl: 0,
        consecutive_wins: 0,
        consecutive_losses: 0,
        accuracy_vs_target: 0,
        growth_vs_target: 0,
        last_updated: Date.now(),
      },
    };
    info('Advanced Trading System history cleared');
  }
}

export const advancedTradingSystem = new AdvancedTradingSystem();
