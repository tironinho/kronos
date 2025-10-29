import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface RiskLimits {
  max_position_size_usd: number;
  max_daily_loss_percent: number;
  max_drawdown_percent: number;
  max_open_positions: number;
  position_size_percent: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  max_leverage: number;
  max_correlation: number;
  max_sector_exposure: number;
}

export interface RiskMetrics {
  current_drawdown: number;
  daily_pnl: number;
  total_pnl: number;
  sharpe_ratio: number;
  max_drawdown: number;
  var_95: number; // Value at Risk 95%
  var_99: number; // Value at Risk 99%
  expected_shortfall: number;
  portfolio_beta: number;
  correlation_risk: number;
  concentration_risk: number;
  last_updated: number;
}

export interface RiskAlert {
  id: string;
  type: 'POSITION_SIZE' | 'DAILY_LOSS' | 'DRAWDOWN' | 'CORRELATION' | 'CONCENTRATION' | 'VAR_BREACH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  current_value: number;
  limit_value: number;
  symbol?: string;
  timestamp: number;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface RiskConfig {
  limits: RiskLimits;
  alert_thresholds: {
    position_size_warning: number; // % of limit
    daily_loss_warning: number; // % of limit
    drawdown_warning: number; // % of limit
  };
  calculation_periods: {
    var_period: number; // days
    sharpe_period: number; // days
    correlation_period: number; // days
  };
  auto_actions: {
    auto_stop_loss: boolean;
    auto_position_reduction: boolean;
    auto_portfolio_rebalance: boolean;
  };
}

export interface PositionRisk {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  average_price: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  position_size_usd: number;
  risk_score: number;
  stop_loss_price?: number;
  take_profit_price?: number;
  days_held: number;
}

export class RiskManager {
  private config: RiskConfig;
  private riskMetrics: RiskMetrics;
  private alerts: RiskAlert[] = [];
  private positions: Map<string, PositionRisk> = new Map();
  private historicalPnL: Array<{ timestamp: number; pnl: number }> = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<RiskConfig>) {
    this.config = {
      limits: {
        max_position_size_usd: config?.limits?.max_position_size_usd || 1000,
        max_daily_loss_percent: config?.limits?.max_daily_loss_percent || 0.05,
        max_drawdown_percent: config?.limits?.max_drawdown_percent || 0.10,
        max_open_positions: config?.limits?.max_open_positions || 5,
        position_size_percent: config?.limits?.position_size_percent || 0.1,
        stop_loss_percent: config?.limits?.stop_loss_percent || 0.01,
        take_profit_percent: config?.limits?.take_profit_percent || 0.02,
        max_leverage: config?.limits?.max_leverage || 1,
        max_correlation: config?.limits?.max_correlation || 0.7,
        max_sector_exposure: config?.limits?.max_sector_exposure || 0.3,
      },
      alert_thresholds: {
        position_size_warning: config?.alert_thresholds?.position_size_warning || 0.8,
        daily_loss_warning: config?.alert_thresholds?.daily_loss_warning || 0.7,
        drawdown_warning: config?.alert_thresholds?.drawdown_warning || 0.8,
      },
      calculation_periods: {
        var_period: config?.calculation_periods?.var_period || 30,
        sharpe_period: config?.calculation_periods?.sharpe_period || 30,
        correlation_period: config?.calculation_periods?.correlation_period || 7,
      },
      auto_actions: {
        auto_stop_loss: config?.auto_actions?.auto_stop_loss || true,
        auto_position_reduction: config?.auto_actions?.auto_position_reduction || false,
        auto_portfolio_rebalance: config?.auto_actions?.auto_portfolio_rebalance || false,
      },
    };

    this.riskMetrics = {
      current_drawdown: 0,
      daily_pnl: 0,
      total_pnl: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      var_95: 0,
      var_99: 0,
      expected_shortfall: 0,
      portfolio_beta: 1,
      correlation_risk: 0,
      concentration_risk: 0,
      last_updated: Date.now(),
    };

    info('Risk Manager initialized', { config: this.config });
    this.startMonitoring();
  }

  public updateConfig(newConfig: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Risk Manager config updated', { newConfig });
  }

  public updatePosition(symbol: string, position: Omit<PositionRisk, 'symbol'>): void {
    this.positions.set(symbol, { symbol, ...position });
    this.calculateRiskMetrics();
    this.checkRiskLimits();
  }

  public removePosition(symbol: string): void {
    this.positions.delete(symbol);
    this.calculateRiskMetrics();
    info(`Position removed for ${symbol}`);
  }

  public recordPnL(pnl: number): void {
    this.historicalPnL.push({
      timestamp: Date.now(),
      pnl,
    });

    // Keep only last 365 days of data
    const cutoffTime = Date.now() - (365 * 24 * 60 * 60 * 1000);
    this.historicalPnL = this.historicalPnL.filter(data => data.timestamp > cutoffTime);

    this.calculateRiskMetrics();
    this.checkRiskLimits();
  }

  private calculateRiskMetrics(): void {
    const now = Date.now();
    
    // Calculate daily PnL
    const today = new Date().toISOString().split('T')[0];
    const todayPnL = this.historicalPnL
      .filter(data => new Date(data.timestamp).toISOString().split('T')[0] === today)
      .reduce((sum, data) => sum + data.pnl, 0);
    
    this.riskMetrics.daily_pnl = todayPnL;

    // Calculate total PnL
    this.riskMetrics.total_pnl = this.historicalPnL.reduce((sum, data) => sum + data.pnl, 0);

    // Calculate current drawdown
    const peakPnL = Math.max(...this.historicalPnL.map(data => data.pnl), 0);
    this.riskMetrics.current_drawdown = Math.max(0, peakPnL - this.riskMetrics.total_pnl);

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let runningPnL = 0;

    for (const data of this.historicalPnL) {
      runningPnL += data.pnl;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    this.riskMetrics.max_drawdown = maxDrawdown;

    // Calculate Sharpe ratio
    this.riskMetrics.sharpe_ratio = this.calculateSharpeRatio();

    // Calculate VaR and Expected Shortfall
    const varData = this.calculateVaR();
    this.riskMetrics.var_95 = varData.var95;
    this.riskMetrics.var_99 = varData.var99;
    this.riskMetrics.expected_shortfall = varData.expectedShortfall;

    // Calculate portfolio beta (simplified)
    this.riskMetrics.portfolio_beta = this.calculatePortfolioBeta();

    // Calculate correlation risk
    this.riskMetrics.correlation_risk = this.calculateCorrelationRisk();

    // Calculate concentration risk
    this.riskMetrics.concentration_risk = this.calculateConcentrationRisk();

    this.riskMetrics.last_updated = now;
  }

  private calculateSharpeRatio(): number {
    if (this.historicalPnL.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < this.historicalPnL.length; i++) {
      returns.push(this.historicalPnL[i].pnl - this.historicalPnL[i - 1].pnl);
    }

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : meanReturn / stdDev;
  }

  private calculateVaR(): { var95: number; var99: number; expectedShortfall: number } {
    if (this.historicalPnL.length < 30) {
      return { var95: 0, var99: 0, expectedShortfall: 0 };
    }

    const returns = [];
    for (let i = 1; i < this.historicalPnL.length; i++) {
      returns.push(this.historicalPnL[i].pnl - this.historicalPnL[i - 1].pnl);
    }

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95Index = Math.floor(0.05 * sortedReturns.length);
    const var99Index = Math.floor(0.01 * sortedReturns.length);

    const var95 = sortedReturns[var95Index] || 0;
    const var99 = sortedReturns[var99Index] || 0;

    // Expected Shortfall (average of returns below VaR 95%)
    const tailReturns = sortedReturns.slice(0, var95Index);
    const expectedShortfall = tailReturns.length > 0 
      ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length 
      : 0;

    return { var95, var99, expectedShortfall };
  }

  private calculatePortfolioBeta(): number {
    // Simplified beta calculation - in reality would compare to market index
    const totalExposure = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.position_size_usd, 0);
    
    if (totalExposure === 0) return 1;

    // Assume crypto portfolio has higher beta than traditional markets
    return Math.min(2.0, 1 + (totalExposure / 10000)); // Scale with exposure
  }

  private calculateCorrelationRisk(): number {
    if (this.positions.size < 2) return 0;

    const symbols = Array.from(this.positions.keys());
    let totalCorrelation = 0;
    let pairCount = 0;

    // Simplified correlation calculation
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        // In reality, would calculate actual correlation from price data
        const correlation = Math.random() * 0.8; // Placeholder
        totalCorrelation += correlation;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalCorrelation / pairCount : 0;
  }

  private calculateConcentrationRisk(): number {
    if (this.positions.size === 0) return 0;

    const totalExposure = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.position_size_usd, 0);

    if (totalExposure === 0) return 0;

    // Calculate Herfindahl-Hirschman Index
    let hhi = 0;
    this.positions.forEach(pos => {
      const share = pos.position_size_usd / totalExposure;
      hhi += share * share;
    });

    return hhi;
  }

  private checkRiskLimits(): void {
    // Check daily loss limit
    const dailyLossPercent = Math.abs(this.riskMetrics.daily_pnl) / 10000; // Assuming 10k portfolio
    if (dailyLossPercent > this.config.limits.max_daily_loss_percent) {
      this.addAlert({
        type: 'DAILY_LOSS',
        severity: 'CRITICAL',
        message: `Daily loss limit exceeded: ${(dailyLossPercent * 100).toFixed(2)}%`,
        current_value: dailyLossPercent,
        limit_value: this.config.limits.max_daily_loss_percent,
      });
    } else if (dailyLossPercent > this.config.limits.max_daily_loss_percent * this.config.alert_thresholds.daily_loss_warning) {
      this.addAlert({
        type: 'DAILY_LOSS',
        severity: 'HIGH',
        message: `Daily loss approaching limit: ${(dailyLossPercent * 100).toFixed(2)}%`,
        current_value: dailyLossPercent,
        limit_value: this.config.limits.max_daily_loss_percent,
      });
    }

    // Check drawdown limit
    const drawdownPercent = this.riskMetrics.current_drawdown / 10000; // Assuming 10k portfolio
    if (drawdownPercent > this.config.limits.max_drawdown_percent) {
      this.addAlert({
        type: 'DRAWDOWN',
        severity: 'CRITICAL',
        message: `Drawdown limit exceeded: ${(drawdownPercent * 100).toFixed(2)}%`,
        current_value: drawdownPercent,
        limit_value: this.config.limits.max_drawdown_percent,
      });
    }

    // Check position size limits
    this.positions.forEach(pos => {
      if (pos.position_size_usd > this.config.limits.max_position_size_usd) {
        this.addAlert({
          type: 'POSITION_SIZE',
          severity: 'CRITICAL',
          message: `Position size exceeds limit for ${pos.symbol}`,
          current_value: pos.position_size_usd,
          limit_value: this.config.limits.max_position_size_usd,
          symbol: pos.symbol,
        });
      }
    });

    // Check correlation risk
    if (this.riskMetrics.correlation_risk > this.config.limits.max_correlation) {
      this.addAlert({
        type: 'CORRELATION',
        severity: 'HIGH',
        message: `Portfolio correlation too high: ${(this.riskMetrics.correlation_risk * 100).toFixed(1)}%`,
        current_value: this.riskMetrics.correlation_risk,
        limit_value: this.config.limits.max_correlation,
      });
    }

    // Check concentration risk
    if (this.riskMetrics.concentration_risk > this.config.limits.max_sector_exposure) {
      this.addAlert({
        type: 'CONCENTRATION',
        severity: 'MEDIUM',
        message: `Portfolio concentration too high: ${(this.riskMetrics.concentration_risk * 100).toFixed(1)}%`,
        current_value: this.riskMetrics.concentration_risk,
        limit_value: this.config.limits.max_sector_exposure,
      });
    }
  }

  private addAlert(alert: Omit<RiskAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const newAlert: RiskAlert = {
      id: generateUniqueId(),
      timestamp: Date.now(),
      acknowledged: false,
      ...alert,
    };

    this.alerts.unshift(newAlert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(0, 1000);
    }

    info(`Risk alert generated`, {
      type: newAlert.type,
      severity: newAlert.severity,
      message: newAlert.message,
    });
  }

  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.calculateRiskMetrics();
      this.checkRiskLimits();
    }, 60000); // Check every minute

    this.isMonitoring = true;
    info('Risk monitoring started');
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    info('Risk monitoring stopped');
  }

  public getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  public getRiskLimits(): RiskLimits {
    return { ...this.config.limits };
  }

  public getAlerts(limit?: number): RiskAlert[] {
    return limit ? this.alerts.slice(0, limit) : this.alerts;
  }

  public getUnacknowledgedAlerts(): RiskAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      info(`Alert acknowledged`, { alertId });
      return true;
    }
    return false;
  }

  public getPositions(): Map<string, PositionRisk> {
    return new Map(this.positions);
  }

  public getPosition(symbol: string): PositionRisk | undefined {
    return this.positions.get(symbol);
  }

  public calculatePositionRisk(symbol: string, quantity: number, price: number, side: 'BUY' | 'SELL'): number {
    const positionValue = quantity * price;
    const positionPercent = positionValue / 10000; // Assuming 10k portfolio

    // Base risk score
    let riskScore = positionPercent;

    // Adjust for existing position
    const existingPosition = this.positions.get(symbol);
    if (existingPosition) {
      const totalValue = existingPosition.position_size_usd + positionValue;
      riskScore = totalValue / 10000;
    }

    // Adjust for volatility (simplified)
    riskScore *= 1.2; // Assume 20% higher risk for crypto

    // Adjust for correlation
    riskScore *= (1 + this.riskMetrics.correlation_risk);

    return Math.min(riskScore, 1.0); // Cap at 100%
  }

  public shouldAllowTrade(symbol: string, quantity: number, price: number, side: 'BUY' | 'SELL'): boolean {
    // Check position size limit
    const positionValue = quantity * price;
    if (positionValue > this.config.limits.max_position_size_usd) {
      return false;
    }

    // Check max open positions
    if (this.positions.size >= this.config.limits.max_open_positions && !this.positions.has(symbol)) {
      return false;
    }

    // Check daily loss limit
    if (Math.abs(this.riskMetrics.daily_pnl) > this.config.limits.max_daily_loss_percent * 10000) {
      return false;
    }

    // Check drawdown limit
    if (this.riskMetrics.current_drawdown > this.config.limits.max_drawdown_percent * 10000) {
      return false;
    }

    return true;
  }

  public getRecommendedStopLoss(symbol: string, entryPrice: number, side: 'BUY' | 'SELL'): number {
    const stopLossPercent = this.config.limits.stop_loss_percent;
    
    if (side === 'BUY') {
      return entryPrice * (1 - stopLossPercent);
    } else {
      return entryPrice * (1 + stopLossPercent);
    }
  }

  public getRecommendedTakeProfit(symbol: string, entryPrice: number, side: 'BUY' | 'SELL'): number {
    const takeProfitPercent = this.config.limits.take_profit_percent;
    
    if (side === 'BUY') {
      return entryPrice * (1 + takeProfitPercent);
    } else {
      return entryPrice * (1 - takeProfitPercent);
    }
  }

  public clearData(): void {
    this.positions.clear();
    this.alerts = [];
    this.historicalPnL = [];
    this.riskMetrics = {
      current_drawdown: 0,
      daily_pnl: 0,
      total_pnl: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      var_95: 0,
      var_99: 0,
      expected_shortfall: 0,
      portfolio_beta: 1,
      correlation_risk: 0,
      concentration_risk: 0,
      last_updated: Date.now(),
    };
    info('Risk Manager data cleared');
  }
}

export const riskManager = new RiskManager();
