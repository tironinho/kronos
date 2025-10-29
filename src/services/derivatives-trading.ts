import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface DerivativesConfig {
  enabled_derivatives: string[];
  leverage_limits: {
    max_leverage: number;
    default_leverage: number;
    risk_multiplier: number;
  };
  margin_requirements: {
    initial_margin: number;
    maintenance_margin: number;
    margin_call_threshold: number;
  };
  position_limits: {
    max_positions: number;
    max_position_size: number;
    max_daily_trades: number;
  };
  risk_management: {
    stop_loss_percent: number;
    take_profit_percent: number;
    max_drawdown: number;
    liquidation_threshold: number;
  };
  execution: {
    execution_mode: 'LIVE' | 'PAPER' | 'BACKTEST';
    slippage_tolerance: number;
    max_execution_delay: number;
  };
}

export interface DerivativesPosition {
  id: string;
  symbol: string;
  position_type: 'LONG' | 'SHORT';
  size: number;
  entry_price: number;
  current_price: number;
  leverage: number;
  margin_used: number;
  margin_available: number;
  unrealized_pnl: number;
  realized_pnl: number;
  entry_time: number;
  stop_loss: number;
  take_profit: number;
  liquidation_price: number;
  status: 'ACTIVE' | 'CLOSED' | 'LIQUIDATED';
  metadata: {
    funding_rate?: number;
    next_funding_time?: number;
    mark_price?: number;
    index_price?: number;
  };
}

export interface DerivativesOrder {
  id: string;
  symbol: string;
  order_type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  side: 'BUY' | 'SELL';
  size: number;
  price?: number;
  stop_price?: number;
  leverage: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  created_time: number;
  filled_time?: number;
  filled_price?: number;
  filled_size?: number;
  fees: number;
  metadata: {
    client_order_id?: string;
    time_in_force?: string;
    reduce_only?: boolean;
  };
}

export interface DerivativesMetrics {
  total_positions: number;
  active_positions: number;
  closed_positions: number;
  liquidated_positions: number;
  total_pnl: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_volume: number;
  total_fees: number;
  win_rate: number;
  average_leverage: number;
  max_drawdown: number;
  sharpe_ratio: number;
  last_update: number;
}

export interface DerivativesStats {
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  average_execution_time_ms: number;
  total_volume_traded: number;
  total_fees_paid: number;
  margin_calls: number;
  liquidations: number;
  last_order: number;
  active_positions: number;
}

export class DerivativesTradingEngine {
  private config: DerivativesConfig;
  private stats: DerivativesStats;
  private positions: Map<string, DerivativesPosition> = new Map();
  private orders: Map<string, DerivativesOrder> = new Map();
  private orderHistory: DerivativesOrder[] = [];
  private isRunning: boolean = false;

  constructor(config?: Partial<DerivativesConfig>) {
    this.config = {
      enabled_derivatives: config?.enabled_derivatives || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
      leverage_limits: {
        max_leverage: config?.leverage_limits?.max_leverage || 20,
        default_leverage: config?.leverage_limits?.default_leverage || 5,
        risk_multiplier: config?.leverage_limits?.risk_multiplier || 1.5,
      },
      margin_requirements: {
        initial_margin: config?.margin_requirements?.initial_margin || 0.1,
        maintenance_margin: config?.margin_requirements?.maintenance_margin || 0.05,
        margin_call_threshold: config?.margin_requirements?.margin_call_threshold || 0.15,
      },
      position_limits: {
        max_positions: config?.position_limits?.max_positions || 10,
        max_position_size: config?.position_limits?.max_position_size || 0.2,
        max_daily_trades: config?.position_limits?.max_daily_trades || 100,
      },
      risk_management: {
        stop_loss_percent: config?.risk_management?.stop_loss_percent || 0.02,
        take_profit_percent: config?.risk_management?.take_profit_percent || 0.04,
        max_drawdown: config?.risk_management?.max_drawdown || 0.1,
        liquidation_threshold: config?.risk_management?.liquidation_threshold || 0.02,
      },
      execution: {
        execution_mode: config?.execution?.execution_mode || 'PAPER',
        slippage_tolerance: config?.execution?.slippage_tolerance || 0.001,
        max_execution_delay: config?.execution?.max_execution_delay || 5000,
      },
    };

    this.stats = {
      total_orders: 0,
      successful_orders: 0,
      failed_orders: 0,
      average_execution_time_ms: 0,
      total_volume_traded: 0,
      total_fees_paid: 0,
      margin_calls: 0,
      liquidations: 0,
      last_order: 0,
      active_positions: 0,
    };

    info('Derivatives Trading Engine initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<DerivativesConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Derivatives Trading config updated', { newConfig });
  }

  public async placeOrder(orderData: Partial<DerivativesOrder>): Promise<DerivativesOrder> {
    const startTime = Date.now();

    try {
      // Validate order data
      if (!orderData.symbol || !orderData.side || !orderData.size || !orderData.order_type) {
        throw new Error('Missing required order fields');
      }

      // Check if symbol is enabled
      if (!this.config.enabled_derivatives.includes(orderData.symbol)) {
        throw new Error(`Derivatives trading not enabled for ${orderData.symbol}`);
      }

      // Check position limits
      if (this.positions.size >= this.config.position_limits.max_positions) {
        throw new Error('Maximum position limit reached');
      }

      // Calculate leverage
      const leverage = orderData.leverage || this.config.leverage_limits.default_leverage;
      if (leverage > this.config.leverage_limits.max_leverage) {
        throw new Error(`Leverage ${leverage}x exceeds maximum allowed ${this.config.leverage_limits.max_leverage}x`);
      }

      // Create order
      const order: DerivativesOrder = {
        id: generateUniqueId(),
        symbol: orderData.symbol,
        order_type: orderData.order_type,
        side: orderData.side,
        size: orderData.size,
        price: orderData.price,
        stop_price: orderData.stop_price,
        leverage,
        status: 'PENDING',
        created_time: Date.now(),
        fees: 0,
        metadata: orderData.metadata || {},
      };

      // Execute order
      const executedOrder = await this.executeOrder(order);
      
      // Store order
      this.orders.set(order.id, executedOrder);
      this.orderHistory.push(executedOrder);

      // Update stats
      this.updateOrderStats(startTime, executedOrder.status === 'FILLED');

      info('Derivatives order placed', {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        size: order.size,
        leverage: order.leverage,
        status: executedOrder.status,
        executionTime: `${Date.now() - startTime}ms`,
      });

      return executedOrder;

    } catch (err: any) {
      error('Derivatives order placement failed', { error: err.message });
      this.updateOrderStats(startTime, false);
      throw err;
    }
  }

  private async executeOrder(order: DerivativesOrder): Promise<DerivativesOrder> {
    const startTime = Date.now();

    try {
      // Simulate execution delay
      const executionDelay = Math.random() * 1000; // 0-1 second
      await new Promise(resolve => setTimeout(resolve, executionDelay));

      // Simulate execution based on order type
      let executedOrder = { ...order };

      switch (order.order_type) {
        case 'MARKET':
          executedOrder = await this.executeMarketOrder(order);
          break;
        case 'LIMIT':
          executedOrder = await this.executeLimitOrder(order);
          break;
        case 'STOP':
          executedOrder = await this.executeStopOrder(order);
          break;
        case 'STOP_LIMIT':
          executedOrder = await this.executeStopLimitOrder(order);
          break;
      }

      // Calculate fees
      const fees = this.calculateFees(executedOrder);
      executedOrder.fees = fees;

      // Update order status
      if (executedOrder.status === 'FILLED') {
        executedOrder.filled_time = Date.now();
        executedOrder.filled_price = executedOrder.price || this.getCurrentPrice(order.symbol);
        executedOrder.filled_size = executedOrder.size;

        // Create position if order is filled
        await this.createPosition(executedOrder);
      }

      return executedOrder;

    } catch (err: any) {
      error('Order execution failed', { orderId: order.id, error: err.message });
      order.status = 'REJECTED';
      return order;
    }
  }

  private async executeMarketOrder(order: DerivativesOrder): Promise<DerivativesOrder> {
    // Market orders are executed immediately at current price
    const currentPrice = this.getCurrentPrice(order.symbol);
    const slippage = this.calculateSlippage(order.size, order.side);
    
    const executedPrice = order.side === 'BUY' 
      ? currentPrice * (1 + slippage)
      : currentPrice * (1 - slippage);

    return {
      ...order,
      price: executedPrice,
      status: 'FILLED',
    };
  }

  private async executeLimitOrder(order: DerivativesOrder): Promise<DerivativesOrder> {
    // Limit orders wait for price to reach limit price
    const currentPrice = this.getCurrentPrice(order.symbol);
    
    if (!order.price) {
      throw new Error('Price is required for limit orders');
    }

    const canFill = order.side === 'BUY' 
      ? currentPrice <= order.price
      : currentPrice >= order.price;

    if (canFill) {
      return {
        ...order,
        status: 'FILLED',
      };
    } else {
      return {
        ...order,
        status: 'PENDING',
      };
    }
  }

  private async executeStopOrder(order: DerivativesOrder): Promise<DerivativesOrder> {
    // Stop orders become market orders when stop price is reached
    const currentPrice = this.getCurrentPrice(order.symbol);
    
    if (!order.stop_price) {
      throw new Error('Stop price is required for stop orders');
    }

    const stopTriggered = order.side === 'BUY'
      ? currentPrice >= order.stop_price
      : currentPrice <= order.stop_price;

    if (stopTriggered) {
      return await this.executeMarketOrder(order);
    } else {
      return {
        ...order,
        status: 'PENDING',
      };
    }
  }

  private async executeStopLimitOrder(order: DerivativesOrder): Promise<DerivativesOrder> {
    // Stop limit orders become limit orders when stop price is reached
    const currentPrice = this.getCurrentPrice(order.symbol);
    
    if (!order.stop_price || !order.price) {
      throw new Error('Stop price and limit price are required for stop limit orders');
    }

    const stopTriggered = order.side === 'BUY'
      ? currentPrice >= order.stop_price
      : currentPrice <= order.stop_price;

    if (stopTriggered) {
      return await this.executeLimitOrder(order);
    } else {
      return {
        ...order,
        status: 'PENDING',
      };
    }
  }

  private async createPosition(order: DerivativesOrder): Promise<void> {
    if (order.status !== 'FILLED' || !order.filled_price || !order.filled_size) {
      return;
    }

    const position: DerivativesPosition = {
      id: generateUniqueId(),
      symbol: order.symbol,
      position_type: order.side === 'BUY' ? 'LONG' : 'SHORT',
      size: order.filled_size,
      entry_price: order.filled_price,
      current_price: order.filled_price,
      leverage: order.leverage,
      margin_used: (order.filled_size * order.filled_price) / order.leverage,
      margin_available: 0, // Will be calculated
      unrealized_pnl: 0,
      realized_pnl: 0,
      entry_time: order.filled_time || Date.now(),
      stop_loss: this.calculateStopLoss(order),
      take_profit: this.calculateTakeProfit(order),
      liquidation_price: this.calculateLiquidationPrice(order),
      status: 'ACTIVE',
      metadata: {
        funding_rate: 0.0001, // 0.01% funding rate
        next_funding_time: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
        mark_price: order.filled_price,
        index_price: order.filled_price,
      },
    };

    this.positions.set(position.id, position);
    this.stats.active_positions = this.positions.size;

    info('Derivatives position created', {
      positionId: position.id,
      symbol: position.symbol,
      positionType: position.position_type,
      size: position.size,
      entryPrice: position.entry_price,
      leverage: position.leverage,
      marginUsed: position.margin_used,
    });
  }

  private calculateStopLoss(order: DerivativesOrder): number {
    const price = order.filled_price || order.price || this.getCurrentPrice(order.symbol);
    const stopLossPercent = this.config.risk_management.stop_loss_percent;
    
    if (order.side === 'BUY') {
      return price * (1 - stopLossPercent);
    } else {
      return price * (1 + stopLossPercent);
    }
  }

  private calculateTakeProfit(order: DerivativesOrder): number {
    const price = order.filled_price || order.price || this.getCurrentPrice(order.symbol);
    const takeProfitPercent = this.config.risk_management.take_profit_percent;
    
    if (order.side === 'BUY') {
      return price * (1 + takeProfitPercent);
    } else {
      return price * (1 - takeProfitPercent);
    }
  }

  private calculateLiquidationPrice(order: DerivativesOrder): number {
    const price = order.filled_price || order.price || this.getCurrentPrice(order.symbol);
    const leverage = order.leverage;
    const liquidationThreshold = this.config.risk_management.liquidation_threshold;
    
    if (order.side === 'BUY') {
      return price * (1 - (1 / leverage) + liquidationThreshold);
    } else {
      return price * (1 + (1 / leverage) - liquidationThreshold);
    }
  }

  private calculateSlippage(size: number, side: string): number {
    // Larger orders have more slippage
    const sizeImpact = Math.min(size / 1000, 0.01); // Max 1% impact
    const baseSlippage = this.config.execution.slippage_tolerance;
    
    return baseSlippage + sizeImpact;
  }

  private calculateFees(order: DerivativesOrder): number {
    // Typical derivatives trading fees: 0.02% for makers, 0.04% for takers
    const feeRate = order.order_type === 'LIMIT' ? 0.0002 : 0.0004;
    const notionalValue = order.size * (order.filled_price || order.price || this.getCurrentPrice(order.symbol));
    
    return notionalValue * feeRate;
  }

  private getCurrentPrice(symbol: string): number {
    // Mock price data - in real implementation, this would fetch from exchange
    const basePrices: { [key: string]: number } = {
      'BTCUSDT': 50000,
      'ETHUSDT': 3000,
      'BNBUSDT': 300,
    };
    
    const basePrice = basePrices[symbol] || 100;
    const volatility = 0.02; // 2% volatility
    const change = (Math.random() - 0.5) * volatility;
    
    return basePrice * (1 + change);
  }

  public async closePosition(positionId: string, size?: number): Promise<DerivativesOrder> {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    if (position.status !== 'ACTIVE') {
      throw new Error(`Position ${positionId} is not active`);
    }

    const closeSize = size || position.size;
    const side = position.position_type === 'LONG' ? 'SELL' : 'BUY';

    const closeOrder = await this.placeOrder({
      symbol: position.symbol,
      order_type: 'MARKET',
      side,
      size: closeSize,
      leverage: position.leverage,
      metadata: {
        reduce_only: true,
        client_order_id: `close_${positionId}`,
      },
    });

    // Update position
    if (closeSize >= position.size) {
      position.status = 'CLOSED';
      position.realized_pnl = this.calculateRealizedPnL(position, closeOrder.filled_price || 0);
    } else {
      position.size -= closeSize;
      position.margin_used = (position.size * position.entry_price) / position.leverage;
    }

    this.stats.active_positions = Array.from(this.positions.values()).filter(p => p.status === 'ACTIVE').length;

    info('Derivatives position closed', {
      positionId,
      closeOrderId: closeOrder.id,
      closedSize: closeSize,
      realizedPnL: position.realized_pnl,
    });

    return closeOrder;
  }

  private calculateRealizedPnL(position: DerivativesPosition, exitPrice: number): number {
    const notionalValue = position.size * position.entry_price;
    const leverage = position.leverage;
    const marginUsed = notionalValue / leverage;

    let pnl;
    if (position.position_type === 'LONG') {
      pnl = (exitPrice - position.entry_price) * position.size;
    } else {
      pnl = (position.entry_price - exitPrice) * position.size;
    }

    return pnl;
  }

  public async updatePositions(): Promise<void> {
    for (const [positionId, position] of this.positions) {
      if (position.status !== 'ACTIVE') continue;

      // Update current price
      position.current_price = this.getCurrentPrice(position.symbol);

      // Update unrealized PnL
      position.unrealized_pnl = this.calculateRealizedPnL(position, position.current_price);

      // Update margin available
      position.margin_available = this.calculateMarginAvailable(position);

      // Check for liquidation
      if (this.isLiquidated(position)) {
        await this.liquidatePosition(positionId);
      }

      // Check for stop loss/take profit
      if (this.shouldClosePosition(position)) {
        await this.closePosition(positionId);
      }
    }
  }

  private calculateMarginAvailable(position: DerivativesPosition): number {
    const notionalValue = position.size * position.current_price;
    const requiredMargin = notionalValue / position.leverage;
    const maintenanceMargin = notionalValue * this.config.margin_requirements.maintenance_margin;
    
    return position.margin_used - maintenanceMargin;
  }

  private isLiquidated(position: DerivativesPosition): boolean {
    const currentPrice = position.current_price;
    const liquidationPrice = position.liquidation_price;
    
    if (position.position_type === 'LONG') {
      return currentPrice <= liquidationPrice;
    } else {
      return currentPrice >= liquidationPrice;
    }
  }

  private shouldClosePosition(position: DerivativesPosition): boolean {
    const currentPrice = position.current_price;
    
    // Check stop loss
    if (position.position_type === 'LONG' && currentPrice <= position.stop_loss) {
      return true;
    }
    if (position.position_type === 'SHORT' && currentPrice >= position.stop_loss) {
      return true;
    }

    // Check take profit
    if (position.position_type === 'LONG' && currentPrice >= position.take_profit) {
      return true;
    }
    if (position.position_type === 'SHORT' && currentPrice <= position.take_profit) {
      return true;
    }

    return false;
  }

  private async liquidatePosition(positionId: string): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) return;

    position.status = 'LIQUIDATED';
    position.realized_pnl = -position.margin_used; // Lose all margin

    this.stats.liquidations++;
    this.stats.active_positions = Array.from(this.positions.values()).filter(p => p.status === 'ACTIVE').length;

    error('Position liquidated', {
      positionId,
      symbol: position.symbol,
      liquidationPrice: position.current_price,
      loss: position.realized_pnl,
    });
  }

  public getMetrics(): DerivativesMetrics {
    const activePositions = Array.from(this.positions.values()).filter(p => p.status === 'ACTIVE');
    const closedPositions = Array.from(this.positions.values()).filter(p => p.status === 'CLOSED');
    const liquidatedPositions = Array.from(this.positions.values()).filter(p => p.status === 'LIQUIDATED');

    const totalPnL = Array.from(this.positions.values()).reduce((sum, p) => sum + p.realized_pnl, 0);
    const unrealizedPnL = activePositions.reduce((sum, p) => sum + p.unrealized_pnl, 0);
    const realizedPnL = closedPositions.reduce((sum, p) => sum + p.realized_pnl, 0);

    const totalVolume = this.orderHistory.reduce((sum, order) => {
      if (order.status === 'FILLED' && order.filled_price && order.filled_size) {
        return sum + (order.filled_price * order.filled_size);
      }
      return sum;
    }, 0);

    const totalFees = this.orderHistory.reduce((sum, order) => sum + order.fees, 0);

    const winningTrades = closedPositions.filter(p => p.realized_pnl > 0).length;
    const winRate = closedPositions.length > 0 ? winningTrades / closedPositions.length : 0;

    const averageLeverage = activePositions.length > 0 
      ? activePositions.reduce((sum, p) => sum + p.leverage, 0) / activePositions.length 
      : 0;

    return {
      total_positions: this.positions.size,
      active_positions: activePositions.length,
      closed_positions: closedPositions.length,
      liquidated_positions: liquidatedPositions.length,
      total_pnl: totalPnL,
      unrealized_pnl: unrealizedPnL,
      realized_pnl: realizedPnL,
      total_volume: totalVolume,
      total_fees: totalFees,
      win_rate: winRate,
      average_leverage: averageLeverage,
      max_drawdown: 0, // Would be calculated from historical data
      sharpe_ratio: 0, // Would be calculated from historical data
      last_update: Date.now(),
    };
  }

  private updateOrderStats(startTime: number, success: boolean): void {
    const executionTime = Date.now() - startTime;
    
    this.stats.total_orders++;
    if (success) {
      this.stats.successful_orders++;
    } else {
      this.stats.failed_orders++;
    }
    
    this.stats.last_order = Date.now();
    
    this.stats.average_execution_time_ms = 
      (this.stats.average_execution_time_ms * (this.stats.total_orders - 1) + executionTime) / 
      this.stats.total_orders;
  }

  public getStats(): DerivativesStats {
    return { ...this.stats };
  }

  public getConfig(): DerivativesConfig {
    return { ...this.config };
  }

  public getPositions(): Map<string, DerivativesPosition> {
    return new Map(this.positions);
  }

  public getOrders(): Map<string, DerivativesOrder> {
    return new Map(this.orders);
  }

  public getOrderHistory(): DerivativesOrder[] {
    return [...this.orderHistory];
  }

  public clearData(): void {
    this.positions.clear();
    this.orders.clear();
    this.orderHistory = [];
    this.stats = {
      total_orders: 0,
      successful_orders: 0,
      failed_orders: 0,
      average_execution_time_ms: 0,
      total_volume_traded: 0,
      total_fees_paid: 0,
      margin_calls: 0,
      liquidations: 0,
      last_order: 0,
      active_positions: 0,
    };
    info('Derivatives Trading Engine data cleared');
  }
}

export const derivativesTradingEngine = new DerivativesTradingEngine();
