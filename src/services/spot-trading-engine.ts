// ============================================================================
// SPOT TRADING ENGINE - Executa Trades REAIS na Binance Spot
// ============================================================================

import { getBinanceClient } from './binance-api';

interface SpotTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'closed';
  pnl: number;
  pnlPercent: number;
  openedAt: number;
  closedAt?: number;
  algorithm: string;
  confidence: number;
  binanceOrderId?: string;
}

export class SpotTradingEngine {
  private static instance: SpotTradingEngine;
  private binanceClient = getBinanceClient();
  private isRunning = false;
  private activeTrades: Map<string, SpotTrade> = new Map();
  
  // Estratégia otimizada baseada nas análises
  private strategy = {
    symbols: ['ETHUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT'],
    allocation: { ETHUSDT: 0.40, ADAUSDT: 0.30, XRPUSDT: 0.20, SOLUSDT: 0.10 },
    buyProbability: 0.75,
    stopLoss: 0.5,    // 0.5% stop loss
    takeProfit: 2.0,  // 2.0% take profit
    minConfidence: 60
  };

  private constructor() {}

  public static getInstance(): SpotTradingEngine {
    if (!SpotTradingEngine.instance) {
      SpotTradingEngine.instance = new SpotTradingEngine();
    }
    return SpotTradingEngine.instance;
  }

  /**
   * Inicia trading real
   */
  public async startTrading(initialCapital: number) {
    if (this.isRunning) {
      console.warn('⚠️ Spot Trading já está rodando');
      return;
    }

    this.isRunning = true;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 TRADING REAL INICIADO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 Capital: $${initialCapital.toFixed(2)}`);
    console.log(`📊 Estratégia: ${this.strategy.symbols.join(', ')}`);
    console.log(`🛑 Stop Loss: -${this.strategy.stopLoss}%`);
    console.log(`🎯 Take Profit: +${this.strategy.takeProfit}%`);
    console.log('⚠️  Executando trades COM DINHEIRO REAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Inicia loop de monitoramento
    this.startMonitoringLoop();
  }

  /**
   * Para trading
   */
  public stopTrading() {
    this.isRunning = false;
    console.log('⏹️ Trading real parado');
  }

  /**
   * Loop de monitoramento e execução de trades
   */
  private async startMonitoringLoop() {
    while (this.isRunning) {
      try {
        // Buscar saldo disponível
        const balance = await this.getAvailableBalance();
        
        if (balance > 0) {
          // Gerar e executar trades
          await this.executeOptimalTrades(balance);
        }
        
        // Monitorar trades abertos
        await this.monitorOpenTrades();
        
        // Aguarda antes da próxima iteração
        await this.sleep(10000); // 10 segundos
        
      } catch (error) {
        console.error('❌ Erro no loop de trading:', error as Error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * Busca saldo disponível em USDT
   */
  private async getAvailableBalance(): Promise<number> {
    try {
      const accountInfo = await this.binanceClient.getAccountInfo();
      const balances = accountInfo.balances || [];
      
      const usdtBalance = balances.find((b: any) => b.asset === 'USDT');
      if (usdtBalance) {
        const free = parseFloat(usdtBalance.free);
        console.log(`💰 Saldo disponível: $${free.toFixed(2)}`);
        return free;
      }
      
      return 0;
    } catch (error) {
      console.error('Erro ao buscar saldo:', error as Error);
      return 0;
    }
  }

  /**
   * Executa trades otimizados
   */
  private async executeOptimalTrades(availableBalance: number) {
    // Verifica se já temos muitas posições abertas
    if (this.activeTrades.size >= 10) {
      return;
    }

    // Para cada símbolo da estratégia
    for (const symbol of this.strategy.symbols) {
      if (!this.activeTrades.has(symbol)) {
        // Decide se deve abrir trade
        const shouldTrade = this.shouldOpenTrade(symbol);
        
        if (shouldTrade) {
          await this.openTrade(symbol, availableBalance);
        }
      }
    }
  }

  /**
   * Decide se deve abrir trade
   */
  private shouldOpenTrade(symbol: string): boolean {
    // Lógica baseada em probabilidade
    const random = Math.random();
    
    // 75% chance de abrir trade BUY
    // 25% chance de abrir trade SELL
    if (random < this.strategy.buyProbability) {
      return true; // BUY
    }
    
    return random < 0.95; // SELL (menos frequente)
  }

  /**
   * Abre trade
   */
  private async openTrade(symbol: string, availableBalance: number) {
    try {
      // Calcula quantidade baseada na alocação
      const allocation = this.strategy.allocation[symbol as keyof typeof this.strategy.allocation] || 0.1;
      const tradeAmount = availableBalance * allocation;
      
      // Busca preço atual
      const currentPrice = await this.getCurrentPrice(symbol);
      
      // Determina side (75% BUY, 25% SELL)
      const side = Math.random() < this.strategy.buyProbability ? 'BUY' : 'SELL';
      
      // Calcula quantidade (em USDT)
      const quantity = tradeAmount / currentPrice;
      
      // Arredonda quantidade para 8 casas decimais
      const roundedQuantity = Math.floor(quantity * 100000000) / 100000000;
      
      console.log(`🎯 Abrindo ${side} ${symbol} @ $${currentPrice.toFixed(2)}`);
      console.log(`   Quantidade: ${roundedQuantity} | Capital: $${tradeAmount.toFixed(2)}`);
      
      // Executa ordem na Binance
      const orderId = await this.placeBinanceOrder(symbol, side, 'MARKET', roundedQuantity);
      
      if (orderId) {
        // Calcula stop loss e take profit
        const stopLoss = side === 'BUY' 
          ? currentPrice * (1 - this.strategy.stopLoss / 100)
          : currentPrice * (1 + this.strategy.stopLoss / 100);
          
        const takeProfit = side === 'BUY'
          ? currentPrice * (1 + this.strategy.takeProfit / 100)
          : currentPrice * (1 - this.strategy.takeProfit / 100);
        
        // Cria registro do trade
        const trade: SpotTrade = {
          id: `spot_${Date.now()}_${symbol}`,
          symbol,
          side,
          quantity: roundedQuantity,
          entryPrice: currentPrice,
          currentPrice: currentPrice,
          stopLoss,
          takeProfit,
          status: 'open',
          pnl: 0,
          pnlPercent: 0,
          openedAt: Date.now(),
          algorithm: 'spot_optimal',
          confidence: this.strategy.minConfidence,
          binanceOrderId: orderId
        };
        
        this.activeTrades.set(symbol, trade);
        
        // Salva no banco
        await this.saveTradeToDB(trade);
        
        console.log(`✅ Trade aberto com sucesso!`);
        console.log(`   Stop Loss: $${stopLoss.toFixed(2)} (-${this.strategy.stopLoss}%)`);
        console.log(`   Take Profit: $${takeProfit.toFixed(2)} (+${this.strategy.takeProfit}%)`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao abrir trade ${symbol}:`, error as Error);
    }
  }

  /**
   * Coloca ordem na Binance
   */
  private async placeBinanceOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'MARKET' | 'LIMIT',
    quantity: number
  ): Promise<string | null> {
    try {
      const order = await this.binanceClient.createOrder(
        symbol,
        side,
        'MARKET',
        quantity
      );
      
      return order.orderId?.toString() || null;
    } catch (error) {
      console.error('Erro ao colocar ordem na Binance:', error as Error);
      return null;
    }
  }

  /**
   * Busca preço atual
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const ticker = await this.binanceClient.get24hrTicker(symbol);
      return parseFloat((ticker as any).lastPrice || ticker as any).lastPrice || 0;
    } catch (error) {
      console.error('Erro ao buscar preço:', error as Error);
      return 0;
    }
  }

  /**
   * Monitora trades abertos
   */
  private async monitorOpenTrades() {
    for (const [symbol, trade] of this.activeTrades.entries()) {
      if (trade.status === 'open') {
        try {
          // Busca preço atual
          const currentPrice = await this.getCurrentPrice(symbol);
          
          // Calcula P&L
          const pnl = this.calculatePnL(trade, currentPrice);
          const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
          
          // Atualiza trade
          trade.currentPrice = currentPrice;
          trade.pnl = pnl;
          trade.pnlPercent = pnlPercent;
          
          // Verifica se deve fechar
          const shouldClose = this.shouldCloseTrade(trade);
          
          if (shouldClose) {
            await this.closeTrade(trade);
          } else {
            // Atualiza no banco
            await this.updateTradeInDB(trade);
          }
          
        } catch (error) {
          console.error(`Erro ao monitorar trade ${symbol}:`, error as Error);
        }
      }
    }
  }

  /**
   * Calcula P&L
   */
  private calculatePnL(trade: SpotTrade, currentPrice: number): number {
    if (trade.side === 'BUY') {
      return (currentPrice - trade.entryPrice) * trade.quantity;
    } else {
      return (trade.entryPrice - currentPrice) * trade.quantity;
    }
  }

  /**
   * Decide se deve fechar trade
   */
  private shouldCloseTrade(trade: SpotTrade): boolean {
    if (!trade.stopLoss || !trade.takeProfit) return false;
    
    // Verifica stop loss
    if (trade.side === 'BUY' && trade.currentPrice <= trade.stopLoss) {
      console.log(`🛑 STOP LOSS atingido para ${trade.symbol} ${trade.side}`);
      return true;
    }
    
    if (trade.side === 'SELL' && trade.currentPrice >= trade.stopLoss) {
      console.log(`🛑 STOP LOSS atingido para ${trade.symbol} ${trade.side}`);
      return true;
    }
    
    // Verifica take profit
    if (trade.side === 'BUY' && trade.currentPrice >= trade.takeProfit) {
      console.log(`🎯 TAKE PROFIT atingido para ${trade.symbol} ${trade.side}`);
      return true;
    }
    
    if (trade.side === 'SELL' && trade.currentPrice <= trade.takeProfit) {
      console.log(`🎯 TAKE PROFIT atingido para ${trade.symbol} ${trade.side}`);
      return true;
    }
    
    return false;
  }

  /**
   * Fecha trade
   */
  private async closeTrade(trade: SpotTrade) {
    try {
      // Lado oposto para fechar
      const closeSide = trade.side === 'BUY' ? 'SELL' : 'BUY';
      
      // Coloca ordem de fechamento
      const orderId = await this.placeBinanceOrder(
        trade.symbol,
        closeSide,
        'MARKET',
        trade.quantity
      );
      
      if (orderId) {
        // Atualiza trade
        trade.status = 'closed';
        trade.closedAt = Date.now();
        
        // Remove das trades abertas
        this.activeTrades.delete(trade.symbol);
        
        // Atualiza no banco
        await this.updateTradeInDB(trade);
        
        console.log(`📊 Trade ${trade.symbol} ${trade.side} fechado!`);
        console.log(`   P&L: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
      }
      
    } catch (error) {
      console.error('Erro ao fechar trade:', error as Error);
    }
  }

  /**
   * Salva trade no banco
   */
  private async saveTradeToDB(trade: SpotTrade) {
    try {
      const { supabase } = await import('./supabase-db');
      if (supabase) {
        await supabase.from('real_trades').insert({
          trade_id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          entry_price: trade.entryPrice,
          current_price: trade.currentPrice,
          stop_loss: trade.stopLoss || 0,
          take_profit: trade.takeProfit || 0,
          status: trade.status,
          pnl: trade.pnl,
          pnl_percent: trade.pnlPercent,
          opened_at: new Date(trade.openedAt).toISOString(),
          algorithm: trade.algorithm,
          confidence: trade.confidence,
          binance_order_id: trade.binanceOrderId
        });
      }
    } catch (error) {
      console.error('Erro ao salvar trade no banco:', error as Error);
    }
  }

  /**
   * Atualiza trade no banco
   */
  private async updateTradeInDB(trade: SpotTrade) {
    try {
      const { supabase } = await import('./supabase-db');
      if (supabase) {
        await supabase
          .from('real_trades')
          .update({
            current_price: trade.currentPrice,
            pnl: trade.pnl,
            pnl_percent: trade.pnlPercent,
            status: trade.status,
            closed_at: trade.closedAt ? new Date(trade.closedAt).toISOString() : null
          })
          .eq('trade_id', trade.id);
      }
    } catch (error) {
      console.error('Erro ao atualizar trade no banco:', error as Error);
    }
  }

  /**
   * Retorna trades ativos
   */
  public getActiveTrades(): SpotTrade[] {
    return Array.from(this.activeTrades.values());
  }

  /**
   * Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const spotTradingEngine = SpotTradingEngine.getInstance();

