import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';
import { TradingSignal } from '../types';

export interface BacktestConfig {
  start_date: string;
  end_date: string;
  initial_capital: number;
  commission_rate: number;
  slippage_rate: number;
  max_positions: number;
  position_size_percent: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  symbols: string[];
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
}

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  start_time: number;
  end_time: number;
  duration_ms: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_return: number;
  annualized_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  profit_factor: number;
  average_trade_duration: number;
  best_trade: number;
  worst_trade: number;
  final_capital: number;
  equity_curve: Array<{ timestamp: number; equity: number }>;
  trade_history: BacktestTrade[];
  monthly_returns: Array<{ month: string; return: number }>;
  symbol_performance: Array<{ symbol: string; return: number; trades: number }>;
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_time: number;
  exit_time: number;
  duration_minutes: number;
  pnl: number;
  pnl_percent: number;
  commission: number;
  slippage: number;
  signal_strength: number;
  signal_confidence: number;
  stop_loss_hit: boolean;
  take_profit_hit: boolean;
}

export interface BacktestMetrics {
  total_backtests: number;
  successful_backtests: number;
  failed_backtests: number;
  average_duration_ms: number;
  best_performance: number;
  worst_performance: number;
  last_backtest: number;
}

export class BacktestEngine {
  private config: BacktestConfig;
  private metrics: BacktestMetrics;
  private historicalData: Map<string, Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>> = new Map();
  private isRunning: boolean = false;

  constructor(config?: Partial<BacktestConfig>) {
    this.config = {
      start_date: config?.start_date || '2024-01-01',
      end_date: config?.end_date || '2024-12-31',
      initial_capital: config?.initial_capital || 10000,
      commission_rate: config?.commission_rate || 0.001,
      slippage_rate: config?.slippage_rate || 0.0005,
      max_positions: config?.max_positions || 5,
      position_size_percent: config?.position_size_percent || 0.2,
      stop_loss_percent: config?.stop_loss_percent || 0.02,
      take_profit_percent: config?.take_profit_percent || 0.04,
      symbols: config?.symbols || ['BTCUSDT', 'ETHUSDT'],
      timeframe: config?.timeframe || '1h',
    };

    this.metrics = {
      total_backtests: 0,
      successful_backtests: 0,
      failed_backtests: 0,
      average_duration_ms: 0,
      best_performance: 0,
      worst_performance: 0,
      last_backtest: 0,
    };

    info('Backtest Engine initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<BacktestConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Backtest config updated', { newConfig });
  }

  public async loadHistoricalData(symbol: string, data: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>): Promise<void> {
    this.historicalData.set(symbol, data);
    info(`Historical data loaded for ${symbol}`, { dataPoints: data.length });
  }

  public async runBacktest(signals: TradingSignal[]): Promise<BacktestResult> {
    if (this.isRunning) {
      throw new Error('Backtest is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const backtestId = generateUniqueId();

    try {
      info('Starting backtest', { backtestId, signalsCount: signals.length });

      // Initialize backtest state
      let currentCapital = this.config.initial_capital;
      let positions: Map<string, BacktestTrade> = new Map();
      const tradeHistory: BacktestTrade[] = [];
      const equityCurve: Array<{ timestamp: number; equity: number }> = [];
      
      // Sort signals by timestamp
      const sortedSignals = signals.sort((a, b) => a.timestamp - b.timestamp);

      // Process each signal
      for (const signal of sortedSignals) {
        const currentPrice: number | null = await this.getPriceAtTime(signal.symbol, signal.timestamp);
        if (!currentPrice) continue;

        // Check if we can open a new position
        if (positions.size < this.config.max_positions && signal.signal_type !== 'HOLD') {
          const positionSize = currentCapital * this.config.position_size_percent;
          const quantity = positionSize / currentPrice as number;

          const trade: BacktestTrade = {
            id: generateUniqueId(),
            symbol: signal.symbol,
            side: signal.signal_type as 'BUY' | 'SELL',
            entry_price: currentPrice as number,
            exit_price: 0,
            quantity,
            entry_time: signal.timestamp,
            exit_time: 0,
            duration_minutes: 0,
            pnl: 0,
            pnl_percent: 0,
            commission: positionSize * this.config.commission_rate,
            slippage: positionSize * this.config.slippage_rate,
            signal_strength: signal.strength,
            signal_confidence: signal.confidence,
            stop_loss_hit: false,
            take_profit_hit: false,
          };

          positions.set(signal.symbol, trade);
          currentCapital -= positionSize + trade.commission + trade.slippage;

          info('Position opened', { 
            symbol: signal.symbol, 
            side: signal.signal_type as 'BUY' | 'SELL', 
            price: currentPrice as number,
            quantity: quantity.toFixed(4)
          });
        }

        // Check existing positions for exit conditions
        for (const [symbol, position] of positions) {
          const currentPrice: number | null = await this.getPriceAtTime(symbol, signal.timestamp);
          if (!currentPrice) continue;

          let shouldExit = false;
          let exitReason = '';

          // Check stop loss
          const stopLossPrice = position.side === 'BUY' 
            ? position.entry_price * (1 - this.config.stop_loss_percent)
            : position.entry_price * (1 + this.config.stop_loss_percent);

          if ((position.side === 'BUY' && currentPrice as number <= stopLossPrice) ||
              (position.side === 'SELL' && currentPrice as number >= stopLossPrice)) {
            shouldExit = true;
            exitReason = 'stop_loss';
            position.stop_loss_hit = true;
          }

          // Check take profit
          const takeProfitPrice = position.side === 'BUY'
            ? position.entry_price * (1 + this.config.take_profit_percent)
            : position.entry_price * (1 - this.config.take_profit_percent);

          if ((position.side === 'BUY' && currentPrice as number >= takeProfitPrice) ||
              (position.side === 'SELL' && currentPrice as number <= takeProfitPrice)) {
            shouldExit = true;
            exitReason = 'take_profit';
            position.take_profit_hit = true;
          }

          // Check time-based exit (24 hours)
          const maxHoldTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          if (signal.timestamp - position.entry_time > maxHoldTime) {
            shouldExit = true;
            exitReason = 'time_exit';
          }

          if (shouldExit) {
            // Close position
            position.exit_price = currentPrice as number;
            position.exit_time = signal.timestamp;
            position.duration_minutes = (position.exit_time - position.entry_time) / (1000 * 60);

            // Calculate PnL
            if (position.side === 'BUY') {
              position.pnl = (position.exit_price - position.entry_price) * position.quantity;
            } else {
              position.pnl = (position.entry_price - position.exit_price) * position.quantity;
            }

            position.pnl_percent = position.pnl / (position.entry_price * position.quantity);
            
            // Apply commission and slippage
            const exitValue = position.exit_price * position.quantity;
            const exitCommission = exitValue * this.config.commission_rate;
            const exitSlippage = exitValue * this.config.slippage_rate;
            
            position.pnl -= exitCommission + exitSlippage;
            currentCapital += exitValue - exitCommission - exitSlippage;

            tradeHistory.push({ ...position });
            positions.delete(symbol);

            info('Position closed', { 
              symbol, 
              exitReason, 
              pnl: position.pnl.toFixed(2),
              pnlPercent: (position.pnl_percent * 100).toFixed(2) + '%'
            });
          }
        }

        // Update equity curve
        let positionsValue = 0;
        for (const pos of Array.from(positions.values())) {
          const currentPrice = (await this.getPriceAtTime(pos.symbol, signal.timestamp)) || (pos.entry_price as number);
          const unrealizedPnL = pos.side === 'BUY' 
            ? (currentPrice - (pos.entry_price as number)) * pos.quantity
            : ((pos.entry_price as number) - currentPrice) * pos.quantity;
          positionsValue += ((pos.entry_price as number) * pos.quantity) + unrealizedPnL;
        }
        const totalEquity = currentCapital + positionsValue;

        equityCurve.push({
          timestamp: signal.timestamp,
          equity: totalEquity,
        });
      }

      // Close any remaining positions
      for (const [symbol, position] of positions) {
        const finalPrice = await this.getPriceAtTime(symbol, Date.now()) || position.entry_price;
        position.exit_price = finalPrice;
        position.exit_time = Date.now();
        position.duration_minutes = (position.exit_time - position.entry_time) / (1000 * 60);

        if (position.side === 'BUY') {
          position.pnl = (position.exit_price - position.entry_price) * position.quantity;
        } else {
          position.pnl = (position.entry_price - position.exit_price) * position.quantity;
        }

        position.pnl_percent = position.pnl / (position.entry_price * position.quantity);
        
        const exitValue = position.exit_price * position.quantity;
        const exitCommission = exitValue * this.config.commission_rate;
        const exitSlippage = exitValue * this.config.slippage_rate;
        
        position.pnl -= exitCommission + exitSlippage;
        currentCapital += exitValue - exitCommission - exitSlippage;

        tradeHistory.push({ ...position });
      }

      // Calculate final metrics
      const endTime = Date.now();
      const duration = endTime - startTime;
      const totalTrades = tradeHistory.length;
      const winningTrades = tradeHistory.filter(t => t.pnl > 0).length;
      const losingTrades = tradeHistory.filter(t => t.pnl < 0).length;
      const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
      const totalReturn = (currentCapital - this.config.initial_capital) / this.config.initial_capital;
      
      // Calculate additional metrics
      const maxDrawdown = this.calculateMaxDrawdown(equityCurve);
      const sharpeRatio = this.calculateSharpeRatio(equityCurve);
      const sortinoRatio = this.calculateSortinoRatio(equityCurve);
      const calmarRatio = totalReturn / Math.max(maxDrawdown, 0.001);
      const profitFactor = this.calculateProfitFactor(tradeHistory);
      const averageTradeDuration = tradeHistory.reduce((sum, t) => sum + t.duration_minutes, 0) / totalTrades;
      const bestTrade = Math.max(...tradeHistory.map(t => t.pnl));
      const worstTrade = Math.min(...tradeHistory.map(t => t.pnl));

      // Calculate annualized return
      const daysInPeriod = (new Date(this.config.end_date).getTime() - new Date(this.config.start_date).getTime()) / (1000 * 60 * 60 * 24);
      const annualizedReturn = Math.pow(1 + totalReturn, 365 / daysInPeriod) - 1;

      // Calculate monthly returns
      const monthlyReturns = this.calculateMonthlyReturns(equityCurve);

      // Calculate symbol performance
      const symbolPerformance = this.calculateSymbolPerformance(tradeHistory);

      const result: BacktestResult = {
        id: backtestId,
        config: this.config,
        start_time: startTime,
        end_time: endTime,
        duration_ms: duration,
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        win_rate: winRate,
        total_return: totalReturn,
        annualized_return: annualizedReturn,
        max_drawdown: maxDrawdown,
        sharpe_ratio: sharpeRatio,
        sortino_ratio: sortinoRatio,
        calmar_ratio: calmarRatio,
        profit_factor: profitFactor,
        average_trade_duration: averageTradeDuration,
        best_trade: bestTrade,
        worst_trade: worstTrade,
        final_capital: currentCapital,
        equity_curve: equityCurve,
        trade_history: tradeHistory,
        monthly_returns: monthlyReturns,
        symbol_performance: symbolPerformance,
      };

      // Update metrics
      this.updateMetrics(result);

      info('Backtest completed', {
        id: backtestId,
        duration: `${duration}ms`,
        totalReturn: (totalReturn * 100).toFixed(2) + '%',
        winRate: (winRate * 100).toFixed(2) + '%',
        totalTrades,
        finalCapital: currentCapital.toFixed(2),
      });

      return result;

    } catch (err: any) {
      error('Backtest failed', { backtestId, error: err.message });
      this.metrics.failed_backtests++;
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  private async getPriceAtTime(symbol: string, timestamp: number): Promise<number | null> {
    const data = this.historicalData.get(symbol);
    if (!data || data.length === 0) return null;

    // Find the closest price data point
    const closest = data.reduce((prev, curr) => 
      Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp) ? curr : prev
    );

    return closest.close;
  }

  private calculateMaxDrawdown(equityCurve: Array<{ timestamp: number; equity: number }>): number {
    let maxDrawdown = 0;
    let peak = equityCurve[0]?.equity || 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const drawdown = (peak - point.equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateSharpeRatio(equityCurve: Array<{ timestamp: number; equity: number }>): number {
    if (equityCurve.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const returnRate = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
      returns.push(returnRate);
    }

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : meanReturn / stdDev;
  }

  private calculateSortinoRatio(equityCurve: Array<{ timestamp: number; equity: number }>): number {
    if (equityCurve.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const returnRate = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity;
      returns.push(returnRate);
    }

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);

    return downsideDeviation === 0 ? 0 : meanReturn / downsideDeviation;
  }

  private calculateProfitFactor(trades: BacktestTrade[]): number {
    const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    
    return grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
  }

  private calculateMonthlyReturns(equityCurve: Array<{ timestamp: number; equity: number }>): Array<{ month: string; return: number }> {
    const monthlyReturns: Array<{ month: string; return: number }> = [];
    const monthlyData = new Map<string, number[]>();

    for (const point of equityCurve) {
      const date = new Date(point.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, []);
      }
      monthlyData.get(monthKey)!.push(point.equity);
    }

    for (const [month, values] of monthlyData) {
      if (values.length > 1) {
        const returnRate = (values[values.length - 1] - values[0]) / values[0];
        monthlyReturns.push({ month, return: returnRate });
      }
    }

    return monthlyReturns;
  }

  private calculateSymbolPerformance(trades: BacktestTrade[]): Array<{ symbol: string; return: number; trades: number }> {
    const symbolData = new Map<string, { trades: number; totalPnL: number; initialValue: number }>();

    for (const trade of trades) {
      if (!symbolData.has(trade.symbol)) {
        symbolData.set(trade.symbol, { trades: 0, totalPnL: 0, initialValue: trade.entry_price * trade.quantity });
      }
      
      const data = symbolData.get(trade.symbol)!;
      data.trades++;
      data.totalPnL += trade.pnl;
    }

    return Array.from(symbolData.entries()).map(([symbol, data]) => ({
      symbol,
      return: data.totalPnL / data.initialValue,
      trades: data.trades,
    }));
  }

  private updateMetrics(result: BacktestResult): void {
    this.metrics.total_backtests++;
    this.metrics.successful_backtests++;
    this.metrics.last_backtest = Date.now();
    
    this.metrics.average_duration_ms = 
      (this.metrics.average_duration_ms * (this.metrics.total_backtests - 1) + result.duration_ms) / 
      this.metrics.total_backtests;

    if (result.total_return > this.metrics.best_performance) {
      this.metrics.best_performance = result.total_return;
    }
    if (result.total_return < this.metrics.worst_performance) {
      this.metrics.worst_performance = result.total_return;
    }
  }

  public getMetrics(): BacktestMetrics {
    return { ...this.metrics };
  }

  public getConfig(): BacktestConfig {
    return { ...this.config };
  }

  public isBacktestRunning(): boolean {
    return this.isRunning;
  }

  public clearData(): void {
    this.historicalData.clear();
    this.metrics = {
      total_backtests: 0,
      successful_backtests: 0,
      failed_backtests: 0,
      average_duration_ms: 0,
      best_performance: 0,
      worst_performance: 0,
      last_backtest: 0,
    };
    info('Backtest Engine data cleared');
  }
}

export const backtestEngine = new BacktestEngine();
