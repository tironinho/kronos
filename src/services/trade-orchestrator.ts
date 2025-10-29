import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';
import { MonteCarloEngine, MonteCarloResult } from './monte-carlo';

export interface TradeOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  priority: number; // 1-10, higher is more important
  timestamp: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
  reason: string;
  metadata?: Record<string, any>;
}

export interface OrchestratorConfig {
  max_concurrent_trades: number;
  priority_threshold: number;
  execution_delay_ms: number;
  retry_attempts: number;
  risk_limit_per_symbol: number;
  max_daily_trades: number;
}

export interface TradeAlert {
  id: string;
  type: 'HIGH_PRIORITY' | 'RISK_LIMIT' | 'EXECUTION_FAILED' | 'SYSTEM_ERROR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  symbol?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface OrchestratorStats {
  total_trades_processed: number;
  successful_trades: number;
  failed_trades: number;
  cancelled_trades: number;
  average_execution_time_ms: number;
  queue_size: number;
  active_trades: number;
  daily_trade_count: number;
  last_reset_date: string;
}

export class TradeOrchestrator {
  private config: OrchestratorConfig;
  private priorityQueue: TradeOrder[] = [];
  private activeTrades: Map<string, TradeOrder> = new Map();
  private tradeHistory: TradeOrder[] = [];
  private alerts: TradeAlert[] = [];
  private stats: OrchestratorStats;
  private monteCarloEngine: MonteCarloEngine;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<OrchestratorConfig>, monteCarloEngine?: MonteCarloEngine) {
    this.config = {
      max_concurrent_trades: config?.max_concurrent_trades || 5,
      priority_threshold: config?.priority_threshold || 7,
      execution_delay_ms: config?.execution_delay_ms || 1000,
      retry_attempts: config?.retry_attempts || 3,
      risk_limit_per_symbol: config?.risk_limit_per_symbol || 1000,
      max_daily_trades: config?.max_daily_trades || 100,
    };

    this.monteCarloEngine = monteCarloEngine || new MonteCarloEngine();

    this.stats = {
      total_trades_processed: 0,
      successful_trades: 0,
      failed_trades: 0,
      cancelled_trades: 0,
      average_execution_time_ms: 0,
      queue_size: 0,
      active_trades: 0,
      daily_trade_count: 0,
      last_reset_date: new Date().toISOString().split('T')[0],
    };

    info('Trade Orchestrator initialized', { config: this.config });
    this.startProcessing();
  }

  public updateConfig(newConfig: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Trade Orchestrator config updated', { newConfig });
  }

  public addTrade(trade: Omit<TradeOrder, 'id' | 'timestamp' | 'status'>): string {
    const tradeOrder: TradeOrder = {
      id: generateUniqueId(),
      timestamp: Date.now(),
      status: 'PENDING',
      ...trade,
    };

    // Validate trade
    if (!this.validateTrade(tradeOrder)) {
      this.addAlert({
        type: 'EXECUTION_FAILED',
        severity: 'HIGH',
        message: `Trade validation failed for ${tradeOrder.symbol}`,
        symbol: tradeOrder.symbol,
        metadata: { trade: tradeOrder },
      });
      return tradeOrder.id;
    }

    // Check daily limit
    if (this.stats.daily_trade_count >= this.config.max_daily_trades) {
      this.addAlert({
        type: 'RISK_LIMIT',
        severity: 'HIGH',
        message: 'Daily trade limit reached',
        metadata: { dailyCount: this.stats.daily_trade_count },
      });
      tradeOrder.status = 'CANCELLED';
      tradeOrder.reason = 'Daily trade limit exceeded';
      this.tradeHistory.push(tradeOrder);
      return tradeOrder.id;
    }

    // Add to priority queue
    this.addToPriorityQueue(tradeOrder);
    this.stats.queue_size = this.priorityQueue.length;

    info(`Trade added to queue`, {
      id: tradeOrder.id,
      symbol: tradeOrder.symbol,
      side: tradeOrder.side,
      priority: tradeOrder.priority,
      queueSize: this.priorityQueue.length,
    });

    return tradeOrder.id;
  }

  private validateTrade(trade: TradeOrder): boolean {
    // Check if symbol is valid
    if (!trade.symbol || trade.symbol.length < 6) {
      return false;
    }

    // Check quantity
    if (trade.quantity <= 0) {
      return false;
    }

    // Check price for limit orders
    if (trade.type === 'LIMIT' && (!trade.price || trade.price <= 0)) {
      return false;
    }

    // Check priority
    if (trade.priority < 1 || trade.priority > 10) {
      return false;
    }

    // Check risk limits
    const symbolRisk = this.calculateSymbolRisk(trade.symbol);
    if (symbolRisk + trade.quantity * (trade.price || 0) > this.config.risk_limit_per_symbol) {
      return false;
    }

    return true;
  }

  private calculateSymbolRisk(symbol: string): number {
    let risk = 0;
    this.activeTrades.forEach(trade => {
      if (trade.symbol === symbol && trade.status === 'PENDING') {
        risk += trade.quantity * (trade.price || 0);
      }
    });
    return risk;
  }

  private addToPriorityQueue(trade: TradeOrder): void {
    // Insert trade in priority order (higher priority first)
    let inserted = false;
    for (let i = 0; i < this.priorityQueue.length; i++) {
      if (trade.priority > this.priorityQueue[i].priority) {
        this.priorityQueue.splice(i, 0, trade);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.priorityQueue.push(trade);
    }
  }

  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.execution_delay_ms);

    info('Trade Orchestrator processing started');
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.priorityQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process high priority trades first
      const highPriorityTrades = this.priorityQueue.filter(trade => trade.priority >= this.config.priority_threshold);
      
      for (const trade of highPriorityTrades) {
        if (this.activeTrades.size >= this.config.max_concurrent_trades) {
          break;
        }

        await this.executeTrade(trade);
      }

      // Process remaining trades
      const remainingTrades = this.priorityQueue.filter(trade => trade.priority < this.config.priority_threshold);
      
      for (const trade of remainingTrades) {
        if (this.activeTrades.size >= this.config.max_concurrent_trades) {
          break;
        }

        await this.executeTrade(trade);
      }

    } catch (err: any) {
      error('Error processing trade queue', { error: err.message });
      this.addAlert({
        type: 'SYSTEM_ERROR',
        severity: 'CRITICAL',
        message: 'Trade queue processing failed',
        metadata: { error: err.message },
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeTrade(trade: TradeOrder): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Remove from queue
      const index = this.priorityQueue.findIndex(t => t.id === trade.id);
      if (index !== -1) {
        this.priorityQueue.splice(index, 1);
      }

      // Add to active trades
      this.activeTrades.set(trade.id, trade);
      trade.status = 'PENDING';

      // Get Monte Carlo analysis if available
      const monteCarloResult = this.monteCarloEngine.getResult(trade.symbol);
      
      // Simulate trade execution (in real implementation, this would call the trading API)
      const success = await this.simulateTradeExecution(trade, monteCarloResult);

      if (success) {
        trade.status = 'EXECUTED';
        this.stats.successful_trades++;
        this.stats.daily_trade_count++;
        
        info(`Trade executed successfully`, {
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          executionTime: Date.now() - startTime,
        });
      } else {
        trade.status = 'FAILED';
        trade.reason = 'Execution failed';
        this.stats.failed_trades++;
        
        this.addAlert({
          type: 'EXECUTION_FAILED',
          severity: 'MEDIUM',
          message: `Trade execution failed for ${trade.symbol}`,
          symbol: trade.symbol,
          metadata: { tradeId: trade.id },
        });
      }

    } catch (err: any) {
      trade.status = 'FAILED';
      trade.reason = err.message;
      this.stats.failed_trades++;
      
      error(`Trade execution error`, {
        id: trade.id,
        symbol: trade.symbol,
        error: err.message,
      });

      this.addAlert({
        type: 'EXECUTION_FAILED',
        severity: 'HIGH',
        message: `Trade execution error: ${err.message}`,
        symbol: trade.symbol,
        metadata: { tradeId: trade.id, error: err.message },
      });
    } finally {
      // Remove from active trades
      this.activeTrades.delete(trade.id);
      
      // Add to history
      this.tradeHistory.push(trade);
      
      // Update stats
      this.stats.total_trades_processed++;
      this.stats.queue_size = this.priorityQueue.length;
      this.stats.active_trades = this.activeTrades.size;
      
      const executionTime = Date.now() - startTime;
      this.stats.average_execution_time_ms = 
        (this.stats.average_execution_time_ms * (this.stats.total_trades_processed - 1) + executionTime) / 
        this.stats.total_trades_processed;
    }
  }

  private async simulateTradeExecution(trade: TradeOrder, monteCarloResult?: MonteCarloResult): Promise<boolean> {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    // Simulate success rate based on Monte Carlo analysis
    if (monteCarloResult) {
      const successRate = trade.side === 'BUY' ? monteCarloResult.probability_up : monteCarloResult.probability_down;
      return Math.random() < successRate;
    }

    // Default 85% success rate
    return Math.random() < 0.85;
  }

  public cancelTrade(tradeId: string): boolean {
    // Check if trade is in queue
    const queueIndex = this.priorityQueue.findIndex(trade => trade.id === tradeId);
    if (queueIndex !== -1) {
      const trade = this.priorityQueue[queueIndex];
      trade.status = 'CANCELLED';
      trade.reason = 'Cancelled by user';
      this.priorityQueue.splice(queueIndex, 1);
      this.tradeHistory.push(trade);
      this.stats.cancelled_trades++;
      this.stats.queue_size = this.priorityQueue.length;
      
      info(`Trade cancelled from queue`, { id: tradeId });
      return true;
    }

    // Check if trade is active
    const activeTrade = this.activeTrades.get(tradeId);
    if (activeTrade) {
      activeTrade.status = 'CANCELLED';
      activeTrade.reason = 'Cancelled by user';
      this.activeTrades.delete(tradeId);
      this.tradeHistory.push(activeTrade);
      this.stats.cancelled_trades++;
      this.stats.active_trades = this.activeTrades.size;
      
      info(`Active trade cancelled`, { id: tradeId });
      return true;
    }

    return false;
  }

  public cancelAllTrades(symbol?: string): number {
    let cancelledCount = 0;

    // Cancel from queue
    const tradesToCancel = this.priorityQueue.filter(trade => 
      !symbol || trade.symbol === symbol
    );

    tradesToCancel.forEach(trade => {
      trade.status = 'CANCELLED';
      trade.reason = 'Cancelled by system';
      this.tradeHistory.push(trade);
      cancelledCount++;
    });

    this.priorityQueue = this.priorityQueue.filter(trade => 
      symbol ? trade.symbol !== symbol : false
    );

    // Cancel active trades
    this.activeTrades.forEach(trade => {
      if (!symbol || trade.symbol === symbol) {
        trade.status = 'CANCELLED';
        trade.reason = 'Cancelled by system';
        this.tradeHistory.push(trade);
        this.activeTrades.delete(trade.id);
        cancelledCount++;
      }
    });

    this.stats.cancelled_trades += cancelledCount;
    this.stats.queue_size = this.priorityQueue.length;
    this.stats.active_trades = this.activeTrades.size;

    info(`Cancelled ${cancelledCount} trades`, { symbol });
    return cancelledCount;
  }

  private addAlert(alert: Omit<TradeAlert, 'id' | 'timestamp'>): void {
    const newAlert: TradeAlert = {
      id: generateUniqueId(),
      timestamp: Date.now(),
      ...alert,
    };

    this.alerts.unshift(newAlert); // Add to beginning
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(0, 1000);
    }

    info(`Alert added`, {
      type: newAlert.type,
      severity: newAlert.severity,
      message: newAlert.message,
    });
  }

  public getStats(): OrchestratorStats {
    // Reset daily count if new day
    const today = new Date().toISOString().split('T')[0];
    if (this.stats.last_reset_date !== today) {
      this.stats.daily_trade_count = 0;
      this.stats.last_reset_date = today;
    }

    return { ...this.stats };
  }

  public getPriorityQueue(): TradeOrder[] {
    return [...this.priorityQueue];
  }

  public getActiveTrades(): TradeOrder[] {
    return Array.from(this.activeTrades.values());
  }

  public getTradeHistory(limit?: number): TradeOrder[] {
    const history = [...this.tradeHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  public getAlerts(limit?: number): TradeAlert[] {
    return limit ? this.alerts.slice(0, limit) : this.alerts;
  }

  public getTradeById(id: string): TradeOrder | undefined {
    // Check queue
    const queueTrade = this.priorityQueue.find(trade => trade.id === id);
    if (queueTrade) return queueTrade;

    // Check active trades
    const activeTrade = this.activeTrades.get(id);
    if (activeTrade) return activeTrade;

    // Check history
    return this.tradeHistory.find(trade => trade.id === id);
  }

  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    info('Trade Orchestrator stopped');
  }

  public reset(): void {
    this.priorityQueue = [];
    this.activeTrades.clear();
    this.tradeHistory = [];
    this.alerts = [];
    this.stats = {
      total_trades_processed: 0,
      successful_trades: 0,
      failed_trades: 0,
      cancelled_trades: 0,
      average_execution_time_ms: 0,
      queue_size: 0,
      active_trades: 0,
      daily_trade_count: 0,
      last_reset_date: new Date().toISOString().split('T')[0],
    };
    info('Trade Orchestrator reset');
  }
}

export const tradeOrchestrator = new TradeOrchestrator();
