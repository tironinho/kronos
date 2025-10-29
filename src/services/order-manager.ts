import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';
import { binanceApiClient } from './binance-api';

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  filledQuantity: number;
  averagePrice?: number;
  commission?: number;
  commissionAsset?: string;
  timestamp: number;
  updateTime: number;
  clientOrderId?: string;
  origClientOrderId?: string;
  executedQty: number;
  cummulativeQuoteQty: number;
  isWorking: boolean;
  selfTradePreventionMode?: string;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  clientOrderId?: string;
}

export interface RiskConfig {
  max_position_size_usd: number;
  max_daily_loss_percent: number;
  max_drawdown_percent: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  max_open_positions: number;
  position_size_percent: number;
}

export interface OrderManagerStats {
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  cancelled_orders: number;
  total_volume_usd: number;
  total_commission_usd: number;
  average_execution_time_ms: number;
  active_orders: number;
  daily_pnl: number;
  last_reset_date: string;
}

export class OrderManager {
  private orders: Map<string, Order> = new Map();
  private riskConfig: RiskConfig;
  private stats: OrderManagerStats;
  private activePositions: Map<string, { side: 'BUY' | 'SELL'; quantity: number; averagePrice: number }> = new Map();

  constructor(riskConfig?: Partial<RiskConfig>) {
    this.riskConfig = {
      max_position_size_usd: riskConfig?.max_position_size_usd || 1000,
      max_daily_loss_percent: riskConfig?.max_daily_loss_percent || 0.05,
      max_drawdown_percent: riskConfig?.max_drawdown_percent || 0.10,
      stop_loss_percent: riskConfig?.stop_loss_percent || 0.01,
      take_profit_percent: riskConfig?.take_profit_percent || 0.02,
      max_open_positions: riskConfig?.max_open_positions || 5,
      position_size_percent: riskConfig?.position_size_percent || 0.1,
    };

    this.stats = {
      total_orders: 0,
      successful_orders: 0,
      failed_orders: 0,
      cancelled_orders: 0,
      total_volume_usd: 0,
      total_commission_usd: 0,
      average_execution_time_ms: 0,
      active_orders: 0,
      daily_pnl: 0,
      last_reset_date: new Date().toISOString().split('T')[0],
    };

    info('Order Manager initialized', { riskConfig: this.riskConfig });
  }

  public updateRiskConfig(newConfig: Partial<RiskConfig>): void {
    this.riskConfig = { ...this.riskConfig, ...newConfig };
    info('Risk config updated', { newConfig });
  }

  public async placeOrder(orderRequest: OrderRequest): Promise<Order> {
    const startTime = Date.now();

    try {
      // Validate order
      if (!this.validateOrder(orderRequest)) {
        throw new Error('Order validation failed');
      }

      // Check risk limits
      if (!this.checkRiskLimits(orderRequest)) {
        throw new Error('Risk limits exceeded');
      }

      // Create order object
      const order: Order = {
        id: generateUniqueId(),
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        quantity: orderRequest.quantity,
        price: orderRequest.price,
        stopPrice: orderRequest.stopPrice,
        timeInForce: orderRequest.timeInForce || 'GTC',
        status: 'NEW',
        filledQuantity: 0,
        timestamp: Date.now(),
        updateTime: Date.now(),
        clientOrderId: orderRequest.clientOrderId || generateUniqueId(),
        executedQty: 0,
        cummulativeQuoteQty: 0,
        isWorking: true,
      };

      // Place order via Binance API
      const binanceResponse = await this.placeBinanceOrder(orderRequest);
      
      if (binanceResponse) {
        // Update order with Binance response
        order.id = binanceResponse.orderId?.toString() || order.id;
        order.status = this.mapBinanceStatus(binanceResponse.status);
        order.filledQuantity = parseFloat(binanceResponse.executedQty || '0');
        order.averagePrice = parseFloat(binanceResponse.avgPrice || '0');
        order.commission = parseFloat(binanceResponse.commission || '0');
        order.commissionAsset = binanceResponse.commissionAsset;
        order.executedQty = parseFloat(binanceResponse.executedQty || '0');
        order.cummulativeQuoteQty = parseFloat(binanceResponse.cummulativeQuoteQty || '0');
        order.isWorking = binanceResponse.isWorking || false;
        order.updateTime = Date.now();

        this.orders.set(order.id, order);
        this.updateStats(order, Date.now() - startTime);
        this.updatePosition(order);

        info(`Order placed successfully`, {
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          quantity: order.quantity,
          status: order.status,
        });

        return order;
      } else {
        throw new Error('Failed to place order via Binance API');
      }

    } catch (err: any) {
      error(`Order placement failed`, {
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        error: err.message,
      });

      // Create failed order record
      const failedOrder: Order = {
        id: generateUniqueId(),
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        quantity: orderRequest.quantity,
        price: orderRequest.price,
        stopPrice: orderRequest.stopPrice,
        timeInForce: orderRequest.timeInForce || 'GTC',
        status: 'REJECTED',
        filledQuantity: 0,
        timestamp: Date.now(),
        updateTime: Date.now(),
        clientOrderId: orderRequest.clientOrderId,
        executedQty: 0,
        cummulativeQuoteQty: 0,
        isWorking: false,
      };

      this.orders.set(failedOrder.id, failedOrder);
      this.stats.failed_orders++;
      this.stats.total_orders++;

      throw err;
    }
  }

  private async placeBinanceOrder(orderRequest: OrderRequest): Promise<any> {
    try {
      const response = await binanceApiClient.placeOrder(
        orderRequest.symbol,
        orderRequest.side,
        orderRequest.type,
        orderRequest.quantity,
        orderRequest.price,
        orderRequest.timeInForce
      );

      return response;
    } catch (err: any) {
      error(`Binance API error`, { error: err.message });
      return null;
    }
  }

  private validateOrder(orderRequest: OrderRequest): boolean {
    // Check required fields
    if (!orderRequest.symbol || !orderRequest.side || !orderRequest.type || !orderRequest.quantity) {
      return false;
    }

    // Check quantity
    if (orderRequest.quantity <= 0) {
      return false;
    }

    // Check price for limit orders
    if (orderRequest.type === 'LIMIT' && (!orderRequest.price || orderRequest.price <= 0)) {
      return false;
    }

    // Check stop price for stop orders
    if ((orderRequest.type === 'STOP_LOSS' || orderRequest.type === 'TAKE_PROFIT') && 
        (!orderRequest.stopPrice || orderRequest.stopPrice <= 0)) {
      return false;
    }

    return true;
  }

  private checkRiskLimits(orderRequest: OrderRequest): boolean {
    // Check max open positions
    if (this.activePositions.size >= this.riskConfig.max_open_positions) {
      warn('Max open positions limit reached');
      return false;
    }

    // Check position size
    const estimatedValue = orderRequest.quantity * (orderRequest.price || 0);
    if (estimatedValue > this.riskConfig.max_position_size_usd) {
      warn('Position size exceeds limit', { 
        estimatedValue, 
        maxSize: this.riskConfig.max_position_size_usd 
      });
      return false;
    }

    // Check daily loss limit
    if (this.stats.daily_pnl < -this.riskConfig.max_daily_loss_percent) {
      warn('Daily loss limit exceeded');
      return false;
    }

    return true;
  }

  private mapBinanceStatus(binanceStatus: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      'NEW': 'NEW',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
      'FILLED': 'FILLED',
      'CANCELED': 'CANCELED',
      'REJECTED': 'REJECTED',
      'EXPIRED': 'EXPIRED',
    };

    return statusMap[binanceStatus] || 'REJECTED';
  }

  private updateStats(order: Order, executionTime: number): void {
    this.stats.total_orders++;

    if (order.status === 'FILLED') {
      this.stats.successful_orders++;
      this.stats.total_volume_usd += order.executedQty * (order.averagePrice || 0);
      this.stats.total_commission_usd += order.commission || 0;
    } else if (order.status === 'CANCELED') {
      this.stats.cancelled_orders++;
    } else if (order.status === 'REJECTED') {
      this.stats.failed_orders++;
    }

    // Update active orders count
    this.stats.active_orders = Array.from(this.orders.values()).filter(o => o.isWorking).length;

    // Update average execution time
    this.stats.average_execution_time_ms = 
      (this.stats.average_execution_time_ms * (this.stats.total_orders - 1) + executionTime) / 
      this.stats.total_orders;

    // Reset daily stats if new day
    const today = new Date().toISOString().split('T')[0];
    if (this.stats.last_reset_date !== today) {
      this.stats.daily_pnl = 0;
      this.stats.last_reset_date = today;
    }
  }

  private updatePosition(order: Order): void {
    if (order.status !== 'FILLED') return;

    const existingPosition = this.activePositions.get(order.symbol);
    const executedQty = order.executedQty;
    const averagePrice = order.averagePrice || 0;

    if (existingPosition) {
      if (existingPosition.side === order.side) {
        // Increase position
        const totalQuantity = existingPosition.quantity + executedQty;
        const totalValue = (existingPosition.quantity * existingPosition.averagePrice) + (executedQty * averagePrice);
        existingPosition.averagePrice = totalValue / totalQuantity;
        existingPosition.quantity = totalQuantity;
      } else {
        // Reduce or close position
        if (executedQty >= existingPosition.quantity) {
          // Position closed or reversed
          const remainingQty = executedQty - existingPosition.quantity;
          if (remainingQty > 0) {
            existingPosition.side = order.side;
            existingPosition.quantity = remainingQty;
            existingPosition.averagePrice = averagePrice;
          } else {
            this.activePositions.delete(order.symbol);
          }
        } else {
          // Partial close
          existingPosition.quantity -= executedQty;
        }
      }
    } else {
      // New position
      this.activePositions.set(order.symbol, {
        side: order.side,
        quantity: executedQty,
        averagePrice: averagePrice,
      });
    }

    info(`Position updated for ${order.symbol}`, {
      side: existingPosition?.side || order.side,
      quantity: existingPosition?.quantity || executedQty,
      averagePrice: existingPosition?.averagePrice || averagePrice,
    });
  }

  public async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        warn(`Order not found: ${orderId}`);
        return false;
      }

      if (!order.isWorking) {
        warn(`Order is not working: ${orderId}`);
        return false;
      }

      // Cancel via Binance API
      const response = await binanceApiClient.cancelOrder(order.symbol, parseInt(order.id));
      
      if (response) {
        order.status = 'CANCELED';
        order.isWorking = false;
        order.updateTime = Date.now();
        
        this.stats.cancelled_orders++;
        this.stats.active_orders = Array.from(this.orders.values()).filter(o => o.isWorking).length;

        info(`Order cancelled successfully`, { id: orderId });
        return true;
      } else {
        error(`Failed to cancel order via Binance API: ${orderId}`);
        return false;
      }

    } catch (err: any) {
      error(`Order cancellation failed`, { orderId, error: err.message });
      return false;
    }
  }

  public async cancelAllOrders(symbol?: string): Promise<number> {
    try {
      const ordersToCancel = Array.from(this.orders.values()).filter(order => 
        order.isWorking && (!symbol || order.symbol === symbol)
      );

      let cancelledCount = 0;

      for (const order of ordersToCancel) {
        if (await this.cancelOrder(order.id)) {
          cancelledCount++;
        }
      }

      info(`Cancelled ${cancelledCount} orders`, { symbol });
      return cancelledCount;

    } catch (err: any) {
      error(`Cancel all orders failed`, { symbol, error: err.message });
      return 0;
    }
  }

  public async killSwitch(): Promise<number> {
    info('Kill switch activated - cancelling all orders');
    return await this.cancelAllOrders();
  }

  public getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  public getActiveOrders(): Order[] {
    return Array.from(this.orders.values()).filter(order => order.isWorking);
  }

  public getOrdersBySymbol(symbol: string): Order[] {
    return Array.from(this.orders.values()).filter(order => order.symbol === symbol);
  }

  public getActivePositions(): Map<string, { side: 'BUY' | 'SELL'; quantity: number; averagePrice: number }> {
    return new Map(this.activePositions);
  }

  public getStats(): OrderManagerStats {
    return { ...this.stats };
  }

  public async refreshOrders(): Promise<void> {
    try {
      // Get open orders from Binance
      const openOrders = await binanceApiClient.getOpenOrders();
      
      if (openOrders && Array.isArray(openOrders)) {
        // Update local orders with fresh data
        for (const binanceOrder of openOrders) {
          const existingOrder = Array.from(this.orders.values()).find(o => o.id === binanceOrder.orderId?.toString());
          
          if (existingOrder) {
            existingOrder.status = this.mapBinanceStatus(binanceOrder.status);
            existingOrder.filledQuantity = parseFloat(binanceOrder.executedQty || '0');
            existingOrder.averagePrice = parseFloat(binanceOrder.avgPrice || '0');
            existingOrder.executedQty = parseFloat(binanceOrder.executedQty || '0');
            existingOrder.cummulativeQuoteQty = parseFloat(binanceOrder.cummulativeQuoteQty || '0');
            existingOrder.isWorking = binanceOrder.isWorking || false;
            existingOrder.updateTime = Date.now();
          }
        }

        info(`Orders refreshed`, { openOrdersCount: openOrders.length });
      }

    } catch (err: any) {
      error(`Failed to refresh orders`, { error: err.message });
    }
  }

  public clearHistory(): void {
    this.orders.clear();
    this.activePositions.clear();
    this.stats = {
      total_orders: 0,
      successful_orders: 0,
      failed_orders: 0,
      cancelled_orders: 0,
      total_volume_usd: 0,
      total_commission_usd: 0,
      average_execution_time_ms: 0,
      active_orders: 0,
      daily_pnl: 0,
      last_reset_date: new Date().toISOString().split('T')[0],
    };
    info('Order Manager history cleared');
  }
}

export const orderManager = new OrderManager();
