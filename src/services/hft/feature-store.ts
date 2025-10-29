/**
 * Feature Store Microestrutural
 * 
 * Features de baixa latência para HFT:
 * - Mid/Microprice
 * - Spread efetivo
 * - Order Flow Imbalance (OFI)
 * - Queue imbalance (5-10 primeiros níveis)
 * - Razão de cancelamentos
 * - Pressão de livro
 * - VPIN simplificado
 * - Volatilidade realizada
 * - Micro-momentum
 * - Skew/Kurtosis (janelas 50-500ms)
 */

import { Tick } from './tick-ingestion';

export interface OrderBookLevel {
  price: number;
  quantity: number;
  side: 'bid' | 'ask';
}

export interface MicrostructuralFeatures {
  timestamp: number;
  symbol: string;
  
  // Preço
  midPrice: number;
  microPrice: number; // Weighted mid price
  
  // Spread
  spread: number;
  effectiveSpread: number;
  relativeSpread: number; // BPS
  
  // Order Flow
  ofi: number; // Order Flow Imbalance
  queueImbalance: number; // Imbalance nos primeiros 5-10 níveis
  
  // Cancelamentos
  cancelRatio: number;
  
  // Pressão
  bookPressure: number; // Pressão de compra vs venda
  
  // VPIN
  vpin: number;
  
  // Volatilidade
  realizedVolatility: number;
  
  // Momentum
  microMomentum: number;
  
  // Estatísticas de ordem superior
  priceSkew: number;
  priceKurtosis: number;
}

export interface FeatureStoreConfig {
  windowSizes: number[]; // [50, 100, 200, 500] ms
  queueDepth: number; // Níveis do book a considerar (5-10)
}

export class MicrostructuralFeatureStore {
  private static instance: MicrostructuralFeatureStore;
  private features: Map<string, MicrostructuralFeatures[]> = new Map();
  private ticks: Map<string, Tick[]> = new Map();
  private orderBooks: Map<string, OrderBookLevel[]> = new Map();
  private config: FeatureStoreConfig = {
    windowSizes: [50, 100, 200, 500],
    queueDepth: 5
  };

  private constructor() {}

  public static getInstance(): MicrostructuralFeatureStore {
    if (!MicrostructuralFeatureStore.instance) {
      MicrostructuralFeatureStore.instance = new MicrostructuralFeatureStore();
    }
    return MicrostructuralFeatureStore.instance;
  }

  /**
   * Adiciona tick e atualiza features
   */
  public async addTick(tick: Tick, orderBook?: OrderBookLevel[]): Promise<MicrostructuralFeatures | null> {
    // Adicionar tick ao buffer
    if (!this.ticks.has(tick.symbol)) {
      this.ticks.set(tick.symbol, []);
    }
    const tickBuffer = this.ticks.get(tick.symbol)!;
    tickBuffer.push(tick);
    
    // Manter apenas últimas 5000 ticks
    if (tickBuffer.length > 5000) {
      tickBuffer.shift();
    }

    // Atualizar order book se fornecido
    if (orderBook) {
      this.orderBooks.set(tick.symbol, orderBook);
    }

    // Calcular features
    const features = await this.calculateFeatures(tick.symbol, tick.timestamp);
    
    if (features) {
      // Armazenar
      if (!this.features.has(tick.symbol)) {
        this.features.set(tick.symbol, []);
      }
      const featureBuffer = this.features.get(tick.symbol)!;
      featureBuffer.push(features);
      
      // Manter apenas últimas 1000 features
      if (featureBuffer.length > 1000) {
        featureBuffer.shift();
      }
    }

    return features;
  }

  /**
   * ✅ NOVO: Atualiza order book diretamente (para usar com dados de depth do WebSocket)
   */
  public updateOrderBook(symbol: string, orderBook: OrderBookLevel[]): void {
    this.orderBooks.set(symbol, orderBook);
    // Recalcular features se houver ticks recentes
    const ticks = this.ticks.get(symbol);
    if (ticks && ticks.length > 0) {
      const latestTick = ticks[ticks.length - 1];
      this.calculateFeatures(symbol, latestTick.timestamp).then(features => {
        if (features && this.features.has(symbol)) {
          const featureBuffer = this.features.get(symbol)!;
          featureBuffer.push(features);
          if (featureBuffer.length > 1000) {
            featureBuffer.shift();
          }
        }
      }).catch(err => {
        // Não bloquear se falhar
        console.warn(`⚠️ Erro ao recalcular features após atualizar order book:`, err);
      });
    }
  }

  /**
   * Calcula todas as features microestruturais
   */
  private async calculateFeatures(symbol: string, timestamp: number): Promise<MicrostructuralFeatures | null> {
    const ticks = this.ticks.get(symbol);
    const orderBook = this.orderBooks.get(symbol);

    if (!ticks || ticks.length < 10) return null;

    // 1. Mid Price e Micro Price
    const { midPrice, microPrice } = this.calculatePrices(orderBook);
    if (!midPrice) return null;

    // 2. Spread
    const spread = this.calculateSpread(orderBook, midPrice);
    
    // 3. Order Flow Imbalance
    const ofi = this.calculateOFI(ticks, timestamp);
    
    // 4. Queue Imbalance
    const queueImbalance = this.calculateQueueImbalance(orderBook);
    
    // 5. Cancel Ratio (simulado - precisaria de dados de cancelamentos)
    const cancelRatio = 0; // Seria calculado com dados de cancelamentos
    
    // 6. Book Pressure
    const bookPressure = this.calculateBookPressure(orderBook);
    
    // 7. VPIN (simplificado)
    const vpin = this.calculateVPIN(ticks, timestamp);
    
    // 8. Volatilidade realizada
    const realizedVolatility = this.calculateRealizedVolatility(ticks, timestamp);
    
    // 9. Micro-momentum
    const microMomentum = this.calculateMicroMomentum(ticks, timestamp);
    
    // 10. Skew e Kurtosis
    const { skew, kurtosis } = this.calculatePriceStats(ticks, timestamp);

    return {
      timestamp,
      symbol,
      midPrice,
      microPrice: microPrice || midPrice,
      spread: spread.absolute,
      effectiveSpread: spread.effective,
      relativeSpread: spread.relative,
      ofi,
      queueImbalance,
      cancelRatio,
      bookPressure,
      vpin,
      realizedVolatility,
      microMomentum,
      priceSkew: skew,
      priceKurtosis: kurtosis
    };
  }

  /**
   * Calcula mid price e micro price
   */
  private calculatePrices(orderBook: OrderBookLevel[] | undefined): { midPrice: number; microPrice: number | null } {
    if (!orderBook || orderBook.length === 0) {
      // Fallback: usar último preço de trade
      return { midPrice: 0, microPrice: null };
    }

    const bids = orderBook.filter(l => l.side === 'bid').sort((a, b) => b.price - a.price);
    const asks = orderBook.filter(l => l.side === 'ask').sort((a, b) => a.price - b.price);

    if (bids.length === 0 || asks.length === 0) {
      return { midPrice: 0, microPrice: null };
    }

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const midPrice = (bestBid + bestAsk) / 2;

    // Micro price: weighted mid price baseado em volumes
    const bidVolume = bids[0].quantity;
    const askVolume = asks[0].quantity;
    const totalVolume = bidVolume + askVolume;
    
    const microPrice = totalVolume > 0
      ? (bestAsk * bidVolume + bestBid * askVolume) / totalVolume
      : midPrice;

    return { midPrice, microPrice };
  }

  /**
   * Calcula spread
   */
  private calculateSpread(orderBook: OrderBookLevel[] | undefined, midPrice: number): {
    absolute: number;
    effective: number;
    relative: number;
  } {
    if (!orderBook || orderBook.length === 0 || midPrice === 0) {
      return { absolute: 0, effective: 0, relative: 0 };
    }

    const bids = orderBook.filter(l => l.side === 'bid').sort((a, b) => b.price - a.price);
    const asks = orderBook.filter(l => l.side === 'ask').sort((a, b) => a.price - b.price);

    if (bids.length === 0 || asks.length === 0) {
      return { absolute: 0, effective: 0, relative: 0 };
    }

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const absolute = bestAsk - bestBid;
    const relative = (absolute / midPrice) * 10000; // BPS

    // Effective spread: considera micro price
    const effective = Math.abs(bestAsk - bestBid);

    return { absolute, effective, relative };
  }

  /**
   * Calcula Order Flow Imbalance
   */
  private calculateOFI(ticks: Tick[], timestamp: number, windowMs: number = 100): number {
    const cutoff = timestamp - windowMs;
    const windowTicks = ticks.filter(t => t.timestamp >= cutoff && t.timestamp <= timestamp);

    if (windowTicks.length === 0) return 0;

    let ofi = 0;
    for (const tick of windowTicks) {
      const sign = tick.side === 'BUY' ? 1 : -1;
      ofi += sign * tick.quantity;
    }

    // Normalizar
    const totalVolume = windowTicks.reduce((sum, t) => sum + t.quantity, 0);
    return totalVolume > 0 ? ofi / totalVolume : 0;
  }

  /**
   * Calcula Queue Imbalance nos primeiros N níveis
   */
  private calculateQueueImbalance(orderBook: OrderBookLevel[] | undefined): number {
    if (!orderBook) return 0;

    const bids = orderBook
      .filter(l => l.side === 'bid')
      .sort((a, b) => b.price - a.price)
      .slice(0, this.config.queueDepth);
    
    const asks = orderBook
      .filter(l => l.side === 'ask')
      .sort((a, b) => a.price - b.price)
      .slice(0, this.config.queueDepth);

    const bidVolume = bids.reduce((sum, l) => sum + l.quantity, 0);
    const askVolume = asks.reduce((sum, l) => sum + l.quantity, 0);
    const totalVolume = bidVolume + askVolume;

    return totalVolume > 0 ? (bidVolume - askVolume) / totalVolume : 0;
  }

  /**
   * Calcula pressão do livro
   */
  private calculateBookPressure(orderBook: OrderBookLevel[] | undefined): number {
    if (!orderBook) return 0;
    
    const bids = orderBook.filter(l => l.side === 'bid');
    const asks = orderBook.filter(l => l.side === 'ask');
    
    const bidVolume = bids.reduce((sum, l) => sum + l.quantity, 0);
    const askVolume = asks.reduce((sum, l) => sum + l.quantity, 0);
    const totalVolume = bidVolume + askVolume;

    return totalVolume > 0 ? (bidVolume - askVolume) / totalVolume : 0;
  }

  /**
   * Calcula VPIN (Volume-synchronized Probability of Informed Trading)
   */
  private calculateVPIN(ticks: Tick[], timestamp: number, windowMs: number = 5000): number {
    const cutoff = timestamp - windowMs;
    const windowTicks = ticks.filter(t => t.timestamp >= cutoff && t.timestamp <= timestamp);

    if (windowTicks.length < 10) return 0;

    // Dividir em buckets
    const bucketSize = Math.floor(windowTicks.length / 10);
    if (bucketSize === 0) return 0;

    let vpinSum = 0;
    for (let i = 0; i < 10; i++) {
      const bucket = windowTicks.slice(i * bucketSize, (i + 1) * bucketSize);
      const buyVolume = bucket.filter(t => t.side === 'BUY').reduce((sum, t) => sum + t.quantity, 0);
      const sellVolume = bucket.filter(t => t.side === 'SELL').reduce((sum, t) => sum + t.quantity, 0);
      const totalVolume = buyVolume + sellVolume;
      
      if (totalVolume > 0) {
        const imbalance = Math.abs(buyVolume - sellVolume) / totalVolume;
        vpinSum += imbalance;
      }
    }

    return vpinSum / 10;
  }

  /**
   * Calcula volatilidade realizada
   */
  private calculateRealizedVolatility(ticks: Tick[], timestamp: number, windowMs: number = 500): number {
    const cutoff = timestamp - windowMs;
    const windowTicks = ticks.filter(t => t.timestamp >= cutoff && t.timestamp <= timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (windowTicks.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < windowTicks.length; i++) {
      const ret = Math.log(windowTicks[i].price / windowTicks[i - 1].price);
      returns.push(ret);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    // Annualizar (assumindo janela de 500ms)
    const annualized = Math.sqrt(variance) * Math.sqrt(365 * 24 * 60 * 60 * 1000 / windowMs);
    
    return annualized * 100; // Em percentual
  }

  /**
   * Calcula micro-momentum
   */
  private calculateMicroMomentum(ticks: Tick[], timestamp: number, windowMs: number = 100): number {
    const cutoff = timestamp - windowMs;
    const windowTicks = ticks.filter(t => t.timestamp >= cutoff && t.timestamp <= timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (windowTicks.length < 2) return 0;

    const firstPrice = windowTicks[0].price;
    const lastPrice = windowTicks[windowTicks.length - 1].price;
    
    return firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  }

  /**
   * Calcula skew e kurtosis de preços
   */
  private calculatePriceStats(ticks: Tick[], timestamp: number, windowMs: number = 200): {
    skew: number;
    kurtosis: number;
  } {
    const cutoff = timestamp - windowMs;
    const windowTicks = ticks.filter(t => t.timestamp >= cutoff && t.timestamp <= timestamp);
    const prices = windowTicks.map(t => t.price);

    if (prices.length < 3) return { skew: 0, kurtosis: 0 };

    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return { skew: 0, kurtosis: 0 };

    // Skew: E[(X - μ)³] / σ³
    const skew = prices.reduce((sum, p) => {
      const normalized = (p - mean) / stdDev;
      return sum + Math.pow(normalized, 3);
    }, 0) / prices.length;

    // Kurtosis: E[(X - μ)⁴] / σ⁴ - 3 (excesso)
    const kurtosis = prices.reduce((sum, p) => {
      const normalized = (p - mean) / stdDev;
      return sum + Math.pow(normalized, 4);
    }, 0) / prices.length - 3;

    return { skew, kurtosis };
  }

  /**
   * Obtém features mais recentes
   */
  public getLatestFeatures(symbol: string): MicrostructuralFeatures | null {
    const features = this.features.get(symbol);
    return features && features.length > 0 ? features[features.length - 1] : null;
  }

  /**
   * Obtém features em janela temporal
   */
  public getFeaturesInWindow(symbol: string, windowMs: number): MicrostructuralFeatures[] {
    const features = this.features.get(symbol);
    if (!features) return [];

    const cutoff = Date.now() - windowMs;
    return features.filter(f => f.timestamp >= cutoff);
  }
}

export const featureStore = MicrostructuralFeatureStore.getInstance();

