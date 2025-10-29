import { createClient } from '@supabase/supabase-js';
import { getBinanceClient } from './binance-api';
import { logger, logTrading, logBinance, logSupabase } from './logger';

interface BinanceOrder {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'PENDING_CANCEL' | 'REJECTED' | 'EXPIRED';
  timeInForce: string;
  type: string;
  side: 'BUY' | 'SELL';
  stopPrice: string;
  icebergQty: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origQuoteOrderQty: string;
}

interface TradeRecord {
  id: number;
  trade_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entry_price: number;
  current_price: number;
  stop_loss: number;
  take_profit: number;
  status: 'open' | 'closed';
  pnl: number;
  pnl_percent: number;
  opened_at: string;
  closed_at?: string;
  algorithm: string;
  confidence: number;
  binance_order_id?: string;
}

export class TradeStatusMonitor {
  private supabase: any;
  private binanceClient: any;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private lastCheckTime: number = 0;

  constructor() {
    this.initializeSupabase();
    this.binanceClient = getBinanceClient();
  }

  private initializeSupabase() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ TradeStatusMonitor: Supabase credentials not found, using fallback');
        this.supabase = null;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      logSupabase('✅ TradeStatusMonitor: Supabase initialized');
    } catch (error) {
      logger.error('❌ TradeStatusMonitor: Failed to initialize Supabase:', 'SUPABASE', null, error);
      this.supabase = null;
    }
  }

  /**
   * Inicia o monitoramento de status das trades
   */
  public startMonitoring(intervalMs: number = 30000) {
    if (this.isMonitoring) {
      console.log('⚠️ TradeStatusMonitor: Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log(`🚀 TradeStatusMonitor: Starting trade status monitoring (${intervalMs}ms interval)`);

    // Monitoramento periódico
    this.monitoringInterval = setInterval(async () => {
      await this.checkAndUpdateTradeStatus();
    }, intervalMs);

    // Verificação inicial
    this.checkAndUpdateTradeStatus();
  }

  /**
   * Para o monitoramento
   */
  public stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('🛑 TradeStatusMonitor: Monitoring stopped');
  }

  /**
   * Verifica e atualiza o status das trades
   */
  private async checkAndUpdateTradeStatus() {
    if (!this.supabase) {
      console.warn('⚠️ TradeStatusMonitor: Supabase not available, skipping status check');
      return;
    }

    try {
      console.log('🔍 TradeStatusMonitor: Checking trade status...');

      // Buscar trades abertas
      const { data: openTrades, error: tradesError } = await this.supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (tradesError) {
        console.error('❌ Error fetching open trades:', tradesError);
        return;
      }

      if (!openTrades || openTrades.length === 0) {
        console.log('📊 TradeStatusMonitor: No open trades found');
        return;
      }

      console.log(`📊 TradeStatusMonitor: Found ${openTrades.length} open trades`);

      // Verificar cada trade aberta
      for (const trade of openTrades) {
        await this.checkTradeStatus(trade);
      }

      this.lastCheckTime = Date.now();
    } catch (error) {
      console.error('❌ Error checking trade status:', error);
    }
  }

  /**
   * Verifica o status de uma trade específica
   */
  private async checkTradeStatus(trade: TradeRecord) {
    try {
      // Se não tem binance_order_id, tentar encontrar pela trade_id
      let orderId = trade.binance_order_id;
      
      if (!orderId) {
        console.log(`🔍 TradeStatusMonitor: No order ID for trade ${trade.trade_id}, checking by symbol and time`);
        orderId = await this.findOrderIdByTrade(trade);
      }

      if (!orderId) {
        console.warn(`⚠️ TradeStatusMonitor: Could not find order ID for trade ${trade.trade_id}`);
        return;
      }

      // Buscar informações da ordem na Binance
      const orderInfo = await this.getOrderInfo(trade.symbol, orderId);
      
      if (!orderInfo) {
        console.warn(`⚠️ TradeStatusMonitor: Could not get order info for ${trade.symbol} order ${orderId}`);
        return;
      }

      // Verificar se a ordem foi executada
      if (this.isOrderFilled(orderInfo)) {
        console.log(`✅ TradeStatusMonitor: Order ${orderId} is FILLED, updating trade ${trade.trade_id}`);
        await this.updateTradeToClosed(trade, orderInfo);
      } else if (this.isOrderCanceled(orderInfo)) {
        console.log(`❌ TradeStatusMonitor: Order ${orderId} is CANCELED, updating trade ${trade.trade_id}`);
        await this.updateTradeToClosed(trade, orderInfo, 'CANCELED');
      } else {
        console.log(`⏳ TradeStatusMonitor: Order ${orderId} status: ${orderInfo.status}`);
      }
    } catch (error) {
      console.error(`❌ Error checking trade ${trade.trade_id}:`, error);
    }
  }

  /**
   * Busca informações da ordem na Binance
   */
  private async getOrderInfo(symbol: string, orderId: string): Promise<BinanceOrder | null> {
    try {
      // Para Futures, usar getFuturesOrder
      const orderInfo = await this.binanceClient.getFuturesOrder(symbol, { orderId: parseInt(orderId) });
      return orderInfo;
    } catch (error) {
      console.error(`❌ Error getting order info for ${symbol} order ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Verifica se a ordem foi completamente executada
   */
  private isOrderFilled(orderInfo: BinanceOrder): boolean {
    return orderInfo.status === 'FILLED' && 
           parseFloat(orderInfo.executedQty) > 0 &&
           parseFloat(orderInfo.executedQty) >= parseFloat(orderInfo.origQty);
  }

  /**
   * Verifica se a ordem foi cancelada
   */
  private isOrderCanceled(orderInfo: BinanceOrder): boolean {
    return orderInfo.status === 'CANCELED' || 
           orderInfo.status === 'REJECTED' || 
           orderInfo.status === 'EXPIRED';
  }

  /**
   * Atualiza trade para status "closed"
   */
  private async updateTradeToClosed(trade: TradeRecord, orderInfo: BinanceOrder, reason: string = 'FILLED') {
    try {
      const currentTime = new Date().toISOString();
      
      // Calcular PnL baseado no preço de execução
      const executedPrice = parseFloat(orderInfo.price);
      const executedQty = parseFloat(orderInfo.executedQty);
      
      let pnl = 0;
      let pnlPercent = 0;
      
      if (trade.side === 'BUY') {
        pnl = (executedPrice - trade.entry_price) * executedQty;
        pnlPercent = ((executedPrice - trade.entry_price) / trade.entry_price) * 100;
      } else {
        pnl = (trade.entry_price - executedPrice) * executedQty;
        pnlPercent = ((trade.entry_price - executedPrice) / trade.entry_price) * 100;
      }

      // Atualizar trade no banco
      const { error: updateError } = await this.supabase
        .from('real_trades')
        .update({
          status: 'closed',
          closed_at: currentTime,
          current_price: executedPrice,
          pnl: pnl,
          pnl_percent: pnlPercent,
          binance_order_id: orderInfo.orderId.toString()
        })
        .eq('id', trade.id);

      if (updateError) {
        console.error(`❌ Error updating trade ${trade.trade_id}:`, updateError);
        return;
      }

      console.log(`✅ TradeStatusMonitor: Trade ${trade.trade_id} updated to CLOSED`);
      console.log(`   Symbol: ${trade.symbol}`);
      console.log(`   Side: ${trade.side}`);
      console.log(`   Entry Price: $${trade.entry_price.toFixed(4)}`);
      console.log(`   Exit Price: $${executedPrice.toFixed(4)}`);
      console.log(`   PnL: $${pnl.toFixed(4)} (${pnlPercent.toFixed(2)}%)`);
      console.log(`   Reason: ${reason}`);

      // Emitir evento para outros sistemas
      this.emitTradeClosed(trade, executedPrice, pnl, pnlPercent, reason);

    } catch (error) {
      console.error(`❌ Error updating trade ${trade.trade_id} to closed:`, error);
    }
  }

  /**
   * Tenta encontrar o order ID baseado na trade
   */
  private async findOrderIdByTrade(trade: TradeRecord): Promise<string | null> {
    try {
      // Buscar ordens recentes para o símbolo
      const orders = await this.binanceClient.getFuturesOrders(trade.symbol, { limit: 50 });
      
      // Procurar ordem que corresponde à trade
      const tradeTime = new Date(trade.opened_at).getTime();
      
      for (const order of orders) {
        const orderTime = order.time;
        const timeDiff = Math.abs(orderTime - tradeTime);
        
        // Se a ordem foi criada dentro de 5 minutos da trade e tem o mesmo lado
        if (timeDiff < 5 * 60 * 1000 && order.side === trade.side) {
          console.log(`🔍 TradeStatusMonitor: Found potential order ${order.orderId} for trade ${trade.trade_id}`);
          return order.orderId.toString();
        }
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error finding order ID for trade ${trade.trade_id}:`, error);
      return null;
    }
  }

  /**
   * Emite evento quando uma trade é fechada
   */
  private emitTradeClosed(trade: TradeRecord, exitPrice: number, pnl: number, pnlPercent: number, reason: string) {
    // Aqui você pode implementar eventos para outros sistemas
    console.log(`📢 TradeStatusMonitor: Trade closed event emitted for ${trade.trade_id}`);
    
    // Exemplo de evento para o sistema de monitoramento
    if (typeof process !== 'undefined' && process.emit) {
      process.emit('tradeClosed', {
        tradeId: trade.trade_id,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entry_price,
        exitPrice: exitPrice,
        pnl: pnl,
        pnlPercent: pnlPercent,
        reason: reason,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Força verificação de uma trade específica
   */
  public async forceCheckTrade(tradeId: string): Promise<boolean> {
    if (!this.supabase) {
      console.warn('⚠️ TradeStatusMonitor: Supabase not available');
      return false;
    }

    try {
      const { data: trade, error } = await this.supabase
        .from('real_trades')
        .select('*')
        .eq('trade_id', tradeId)
        .eq('status', 'open')
        .single();

      if (error || !trade) {
        console.log(`📊 TradeStatusMonitor: Trade ${tradeId} not found or already closed`);
        return false;
      }

      await this.checkTradeStatus(trade);
      return true;
    } catch (error) {
      console.error(`❌ Error force checking trade ${tradeId}:`, error);
      return false;
    }
  }

  /**
   * Obtém estatísticas do monitoramento
   */
  public getMonitoringStats() {
    return {
      isMonitoring: this.isMonitoring,
      lastCheckTime: this.lastCheckTime,
      nextCheckIn: this.monitoringInterval ? '30s' : 'N/A'
    };
  }

  /**
   * Limpa trades órfãs (abertas há muito tempo sem ordem correspondente)
   */
  public async cleanupOrphanTrades(maxAgeHours: number = 24) {
    if (!this.supabase) {
      console.warn('⚠️ TradeStatusMonitor: Supabase not available');
      return;
    }

    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

      const { data: orphanTrades, error } = await this.supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'open')
        .lt('opened_at', cutoffTime.toISOString());

      if (error) {
        console.error('❌ Error fetching orphan trades:', error);
        return;
      }

      if (orphanTrades && orphanTrades.length > 0) {
        console.log(`🧹 TradeStatusMonitor: Found ${orphanTrades.length} orphan trades`);
        
        for (const trade of orphanTrades) {
          console.log(`🧹 Cleaning up orphan trade: ${trade.trade_id} (opened: ${trade.opened_at})`);
          
          // Marcar como fechada com motivo "ORPHAN"
          const { error: updateError } = await this.supabase
            .from('real_trades')
            .update({
              status: 'closed',
              closed_at: new Date().toISOString(),
              pnl: 0,
              pnl_percent: 0
            })
            .eq('id', trade.id);

          if (updateError) {
            console.error(`❌ Error cleaning up orphan trade ${trade.trade_id}:`, updateError);
          } else {
            console.log(`✅ Orphan trade ${trade.trade_id} cleaned up`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up orphan trades:', error);
    }
  }
}

export const tradeStatusMonitor = new TradeStatusMonitor();
