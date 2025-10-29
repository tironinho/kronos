// ============================================================================
// HFT EXECUTOR - Execução de Alta Frequência
// ============================================================================

import { getBinanceClient } from '../binance-api';

export interface HFTLogic {
  orderSlicing: {
    enabled: boolean;
    slices: number;                 // Dividir ordem em N pedaços
    delayMs: number;                // Delay entre slices
  };
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'PostOnly';
  limitOrderLogic: {
    bidOffset: number;              // % abaixo de mark price
    askOffset: number;              // % acima de mark price
  };
  marketMaking: {
    spreadTolerance: number;        // Spread mínimo para market making
  };
}

export interface TradeDecision {
  action: 'BUY' | 'SELL';
  confidence: number;
  size: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'PostOnly';
  explanation: string;
}

export class HFTExecutor {
  private binanceClient = getBinanceClient();
  
  /**
   * Executa ordem com slicing para ordem grande
   */
  async sliceOrder(symbol: string, decision: TradeDecision): Promise<string[]> {
    console.log(`⚡ Executando ordem fatiada ${symbol} ${decision.action}...`);
    
    const orderIds: string[] = [];
    
    // Dividir ordem em 3-5 pedaços
    const slices = Math.min(5, Math.max(3, Math.ceil(decision.size / 100)));
    const sizePerSlice = decision.size / slices;
    
    console.log(`   Dividindo ordem em ${slices} fatias de ~${sizePerSlice.toFixed(4)}`);
    
    for (let i = 0; i < slices; i++) {
      // Buscar preço atual
      const ticker = await this.binanceClient.get24hrTicker(symbol);
      const currentPrice = parseFloat((ticker as any).lastPrice);
      
      // Executar slice
      const orderId = await this.placeOrderWithLogic(
        symbol,
        decision.action,
        'MARKET',
        sizePerSlice,
        currentPrice
      );
      
      if (orderId) {
        orderIds.push(orderId);
        console.log(`   ✅ Slice ${i + 1}/${slices} executado (ID: ${orderId})`);
      }
      
      // Delay entre slices (exceto na última)
      if (i < slices - 1) {
        await this.sleep(1000 + Math.random() * 2000); // 1-3s delay
      }
    }
    
    return orderIds;
  }
  
  /**
   * Coloca ordem com lógica smart (REAL)
   */
  private async placeOrderWithLogic(
    symbol: string,
    side: 'BUY' | 'SELL',
    type: 'MARKET' | 'LIMIT',
    quantity: number,
    currentPrice: number
  ): Promise<string | null> {
    try {
      // Para MARKET orders, executar direto
      if (type === 'MARKET') {
        console.log(`⚡ Executando ordem REAL: ${side} ${quantity} ${symbol}`);
        const order = await this.binanceClient.createOrder(
          symbol,
          side,
          'MARKET',
          quantity
        );
        
        console.log(`✅ Ordem executada: ${order.orderId}`);
        return order.orderId?.toString() || null;
      }
      
      // Para LIMIT orders, calcular melhor preço
      let price = currentPrice;
      
      if (side === 'BUY') {
        // Comprar 0.05% abaixo do preço atual para melhor execução
        price = currentPrice * 0.9995;
      } else {
        // Vender 0.05% acima do preço atual
        price = currentPrice * 1.0005;
      }
      
      console.log(`⚡ Executando ordem REAL LIMIT: ${side} ${quantity} ${symbol} @ ${price}`);
      const order = await this.binanceClient.createOrder(
        symbol,
        side,
        'LIMIT',
        quantity,
        price
      );
      
      console.log(`✅ Ordem LIMIT executada: ${order.orderId}`);
      return order.orderId?.toString() || null;
      
    } catch (error: any) {
      console.error('❌ Erro ao colocar ordem HFT REAL:', error);
      console.error('   Detalhes:', error.response?.data || error.message);
      return null;
    }
  }
  
  /**
   * Executa ordem regular (pequena)
   */
  async executeOrder(symbol: string, decision: TradeDecision): Promise<string | null> {
    try {
      const ticker = await this.binanceClient.get24hrTicker(symbol);
      const currentPrice = parseFloat((ticker as any).lastPrice);
      
      const order = await this.binanceClient.createOrder(
        symbol,
        decision.action,
        'MARKET',
        decision.size
      );
      
      console.log(`✅ Ordem executada: ${symbol} ${decision.action} @ $${currentPrice.toFixed(2)}`);
      
      return order.orderId?.toString() || null;
    } catch (error) {
      console.error('Erro ao executar ordem:', error);
      return null;
    }
  }
  
  /**
   * Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const hftExecutor = new HFTExecutor();

