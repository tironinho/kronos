/**
 * Trade Price Monitor Service
 * 
 * Monitora e registra o histórico de preços das trades em execução
 * para análise posterior de comportamento, performance e padrões
 */

import { getBinanceClient } from './binance-api';
import { supabase } from './supabase-db';

// Importação segura do logger
let logger: any;

// Constantes para compatibilidade
const SystemAction = {
  Monitoring: 'monitoring',
  DataFetching: 'data_fetching',
  DataProcessing: 'data_processing',
  DataPersistence: 'data_persistence',
  SystemError: 'system_error'
} as const;

// Inicializar logger de forma segura (lazy loading)
function getLogger() {
  if (logger) {
    return logger;
  }

  try {
    // Tentar importar do logging.ts
    const loggingModule = require('./logging');
    
    if (loggingModule && loggingModule.getComponentLogger) {
      // Tentar obter SystemComponent do módulo
      const SystemComponent = loggingModule.SystemComponent || {
        TradingEngine: 'trading_engine'
      };
      
      const component = SystemComponent.TradingEngine || 'trading_engine';
      logger = loggingModule.getComponentLogger(component);
      
      if (logger) {
        return logger;
      }
    }
  } catch (error) {
    // Silenciosamente ignorar erro
  }
  
  // Fallback: logger simples usando console
  logger = {
    info: (action?: any, message?: any, error?: any, ...args: any[]) => {
      console.log(`[INFO] ${action || ''}:`, message || '', error || '', ...args);
    },
    warn: (action?: any, message?: any, error?: any, ...args: any[]) => {
      console.warn(`[WARN] ${action || ''}:`, message || '', error || '', ...args);
    },
    error: (action?: any, message?: any, error?: any, ...args: any[]) => {
      console.error(`[ERROR] ${action || ''}:`, message || '', error || '', ...args);
    },
    debug: (action?: any, message?: any, error?: any, ...args: any[]) => {
      console.debug(`[DEBUG] ${action || ''}:`, message || '', error || '', ...args);
    },
  };
  
  return logger;
}

// Inicializar logger
logger = getLogger();

interface PriceSnapshot {
  trade_id: string;
  symbol: string;
  timestamp: Date;
  current_price: number;
  entry_price: number;
  high_price?: number;
  low_price?: number;
  pnl: number;
  pnl_percent: number;
  price_change: number;
  price_change_percent: number;
  distance_to_stop_loss?: number;
  distance_to_take_profit?: number;
  volume_24h?: number;
  volume_change_percent?: number;
  rsi?: number;
  macd?: number;
  bb_position?: number;
  volatility_24h?: number;
  atr?: number;
  minutes_since_entry: number;
  hours_since_entry: number;
  market_condition?: string;
  funding_rate?: number;
  notes?: string;
}

interface TradeInfo {
  trade_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  quantity: number;
  opened_at: Date;
}

export class TradePriceMonitorService {
  private static instance: TradePriceMonitorService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private readonly MONITORING_INTERVAL = 60000; // 1 minuto
  private lastSnapshotTime: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): TradePriceMonitorService {
    if (!TradePriceMonitorService.instance) {
      TradePriceMonitorService.instance = new TradePriceMonitorService();
    }
    return TradePriceMonitorService.instance;
  }

  /**
   * Verifica se o monitoramento está ativo
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Inicia monitoramento contínuo de todas as trades abertas
   */
  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      getLogger().info(SystemAction.Monitoring, 'Monitoramento já está ativo');
      return;
    }

    try {
      this.isMonitoring = true;
      getLogger().info(SystemAction.Monitoring, 'Iniciando monitoramento de preços das trades');

      // Primeira execução imediata (com tratamento de erro)
      try {
        await this.monitorAllOpenTrades();
      } catch (initialError) {
        getLogger().warn(
          SystemAction.Monitoring,
          'Erro na primeira execução do monitoramento (continuando)',
          initialError as Error
        );
      }

      // Configurar intervalo
      this.monitoringInterval = setInterval(async () => {
        if (this.isMonitoring) {
          try {
            await this.monitorAllOpenTrades();
          } catch (intervalError) {
            getLogger().error(
              SystemAction.Monitoring,
              'Erro no monitoramento periódico',
              intervalError as Error
            );
          }
        }
      }, this.MONITORING_INTERVAL);

      getLogger().info(SystemAction.Monitoring, `Monitoramento ativo (intervalo: ${this.MONITORING_INTERVAL / 1000}s)`);
    } catch (error) {
      this.isMonitoring = false;
      getLogger().error(
        SystemAction.Monitoring,
        'Erro crítico ao iniciar monitoramento',
        error as Error
      );
      throw error;
    }
  }

  /**
   * Para o monitoramento
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    getLogger().info(SystemAction.Monitoring, 'Monitoramento de preços parado');
  }

  /**
   * Monitora todas as trades abertas e registra snapshots
   */
  private async monitorAllOpenTrades(): Promise<void> {
    try {
      if (!supabase) {
        getLogger().warn(SystemAction.Monitoring, 'Supabase não disponível para monitoramento');
        return;
      }

      // Buscar todas as trades abertas
      const { data: openTrades, error } = await supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (error) {
        getLogger().error(SystemAction.ErrorHandling, 'Erro ao buscar trades abertas', error as Error);
        return;
      }

      if (!openTrades || openTrades.length === 0) {
        return; // Sem trades abertas, não há nada para monitorar
      }

      getLogger().info(SystemAction.Monitoring, `Monitorando ${openTrades.length} trade(s) aberta(s)`);

      // Criar snapshots para cada trade
      const snapshotPromises = openTrades.map(trade => this.createSnapshot(trade));
      await Promise.all(snapshotPromises);

    } catch (error) {
      getLogger().error(SystemAction.ErrorHandling, 'Erro no monitoramento de trades', error as Error);
    }
  }

  /**
   * Cria um snapshot de preço para uma trade específica
   */
  private async createSnapshot(trade: any): Promise<void> {
    try {
      const tradeId = trade.trade_id;
      if (!tradeId || !trade.symbol || !trade.entry_price) {
        return; // Trade inválida
      }

      // Evitar snapshots muito frequentes (mínimo 30 segundos entre snapshots da mesma trade)
      const lastSnapshot = this.lastSnapshotTime.get(tradeId);
      const nowTimestamp = Date.now();
      if (lastSnapshot && (nowTimestamp - lastSnapshot) < 30000) {
        return; // Muito recente, pular
      }
      this.lastSnapshotTime.set(tradeId, nowTimestamp);

      const binanceClient = getBinanceClient();

      // 1. Obter preço atual
      const priceData = await binanceClient.getPrice(trade.symbol);
      const currentPrice = parseFloat(priceData.price);

      // 2. Obter histórico de preços desta trade para calcular high/low
      const { data: priceHistory } = await supabase
        .from('trade_price_history')
        .select('current_price')
        .eq('trade_id', tradeId)
        .order('timestamp', { ascending: false })
        .limit(1);

      const previousPrice = priceHistory && priceHistory.length > 0 
        ? parseFloat(priceHistory[0].current_price.toString())
        : trade.entry_price;

      // Calcular high e low desde a entrada
      const highPrice = currentPrice > trade.entry_price ? currentPrice : trade.entry_price;
      const lowPrice = currentPrice < trade.entry_price ? currentPrice : trade.entry_price;

      // 3. Calcular P&L
      const pnl = this.calculatePnL(
        currentPrice,
        trade.entry_price,
        trade.quantity,
        trade.side
      );
      const investedCapital = trade.entry_price * trade.quantity;
      const pnlPercent = investedCapital > 0 ? (pnl / investedCapital) * 100 : 0;

      // 4. Calcular mudanças de preço
      const priceChange = currentPrice - previousPrice;
      const priceChangePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;

      // 5. Calcular distâncias até SL e TP
      const distanceToSL = trade.stop_loss 
        ? ((currentPrice - trade.stop_loss) / trade.entry_price) * 100
        : null;
      const distanceToTP = trade.take_profit
        ? ((currentPrice - trade.take_profit) / trade.entry_price) * 100
        : null;

      // 6. Obter métricas adicionais (com fallback em caso de erro)
      let volume24h: number | undefined;
      let rsi: number | undefined;
      let volatility24h: number | undefined;
      let fundingRate: number | undefined;

      try {
        // Volume 24h (tentar obter via API de ticker)
        const ticker = await binanceClient.get24hrTicker(trade.symbol);
        volume24h = parseFloat(ticker.quote_volume || ticker.volume || '0');
      } catch (error) {
        // Continuar sem volume
      }

      try {
        // Funding rate (Futures)
        const funding = await binanceClient.getFundingRate(trade.symbol);
        fundingRate = parseFloat(funding.fundingRate || '0');
      } catch (error) {
        // Continuar sem funding rate
      }

      // 7. Calcular tempo decorrido
      const openedAt = new Date(trade.opened_at);
      const currentTime = new Date();
      const minutesSinceEntry = Math.floor((currentTime.getTime() - openedAt.getTime()) / (1000 * 60));
      const hoursSinceEntry = (currentTime.getTime() - openedAt.getTime()) / (1000 * 60 * 60);

      // 8. Determinar condição de mercado (simplificado)
      const marketCondition = this.determineMarketCondition(
        currentPrice,
        trade.entry_price,
        priceChangePercent
      );

      // 9. Criar snapshot
      const snapshot: PriceSnapshot = {
        trade_id: tradeId,
        symbol: trade.symbol,
        timestamp: currentTime,
        current_price: currentPrice,
        entry_price: trade.entry_price,
        high_price: highPrice,
        low_price: lowPrice,
        pnl: pnl,
        pnl_percent: pnlPercent,
        price_change: priceChange,
        price_change_percent: priceChangePercent,
        distance_to_stop_loss: distanceToSL || undefined,
        distance_to_take_profit: distanceToTP || undefined,
        volume_24h: volume24h,
        volatility_24h: volatility24h,
        minutes_since_entry: minutesSinceEntry,
        hours_since_entry: hoursSinceEntry,
        market_condition: marketCondition,
        funding_rate: fundingRate,
      };

      // 10. Salvar no banco
      await this.saveSnapshot(snapshot);

      getLogger().debug(
        SystemAction.DataProcessing,
        `Snapshot criado para ${trade.symbol} (${tradeId}): P&L ${pnlPercent.toFixed(2)}%`
      );

    } catch (error) {
      getLogger().error(
        SystemAction.DataProcessing,
        `Erro ao criar snapshot para trade ${trade.trade_id}`,
        error as Error
      );
    }
  }

  /**
   * Calcula P&L baseado no preço atual e entrada
   */
  private calculatePnL(
    currentPrice: number,
    entryPrice: number,
    quantity: number,
    side: 'BUY' | 'SELL'
  ): number {
    if (side === 'BUY') {
      return (currentPrice - entryPrice) * quantity;
    } else {
      return (entryPrice - currentPrice) * quantity;
    }
  }

  /**
   * Determina condição de mercado básica
   */
  private determineMarketCondition(
    currentPrice: number,
    entryPrice: number,
    priceChangePercent: number
  ): string {
    if (priceChangePercent > 2) return 'strong_bullish';
    if (priceChangePercent > 0.5) return 'bullish';
    if (priceChangePercent < -2) return 'strong_bearish';
    if (priceChangePercent < -0.5) return 'bearish';
    return 'sideways';
  }

  /**
   * Salva snapshot no banco de dados
   */
  private async saveSnapshot(snapshot: PriceSnapshot): Promise<void> {
    try {
      if (!supabase) {
        return;
      }

      const { error } = await supabase
        .from('trade_price_history')
        .insert({
          trade_id: snapshot.trade_id,
          symbol: snapshot.symbol,
          timestamp: snapshot.timestamp.toISOString(),
          current_price: snapshot.current_price,
          entry_price: snapshot.entry_price,
          high_price: snapshot.high_price,
          low_price: snapshot.low_price,
          pnl: snapshot.pnl,
          pnl_percent: snapshot.pnl_percent,
          price_change: snapshot.price_change,
          price_change_percent: snapshot.price_change_percent,
          distance_to_stop_loss: snapshot.distance_to_stop_loss,
          distance_to_take_profit: snapshot.distance_to_take_profit,
          volume_24h: snapshot.volume_24h,
          volume_change_percent: snapshot.volume_change_percent,
          rsi: snapshot.rsi,
          macd: snapshot.macd,
          bb_position: snapshot.bb_position,
          volatility_24h: snapshot.volatility_24h,
          atr: snapshot.atr,
          minutes_since_entry: snapshot.minutes_since_entry,
          hours_since_entry: snapshot.hours_since_entry,
          market_condition: snapshot.market_condition,
          funding_rate: snapshot.funding_rate,
          notes: snapshot.notes,
        });

      if (error) {
        getLogger().error(SystemAction.DataPersistence, `Erro ao salvar snapshot: ${error.message}`, error as Error);
      }
    } catch (error) {
      getLogger().error(SystemAction.DataPersistence, 'Erro ao salvar snapshot no banco', error as Error);
    }
  }

  /**
   * Obtém histórico de preços de uma trade específica
   */
  public async getTradePriceHistory(tradeId: string, limit: number = 1000): Promise<any[]> {
    try {
      if (!supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('trade_price_history')
        .select('*')
        .eq('trade_id', tradeId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) {
        getLogger().error(SystemAction.ErrorHandling, `Erro ao buscar histórico de ${tradeId}`, error as Error);
        return [];
      }

      return data || [];
    } catch (error) {
      getLogger().error(SystemAction.ErrorHandling, 'Erro ao buscar histórico de preços', error as Error);
      return [];
    }
  }

  /**
   * Obtém estatísticas de uma trade baseado no histórico
   */
  public async getTradeStatistics(tradeId: string): Promise<any> {
    try {
      const history = await this.getTradePriceHistory(tradeId);
      
      if (history.length === 0) {
        return null;
      }

      const prices = history.map((h: any) => parseFloat(h.current_price.toString()));
      const pnls = history.map((h: any) => parseFloat(h.pnl_percent.toString()));

      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const maxPnL = Math.max(...pnls);
      const minPnL = Math.min(...pnls);

      const current = history[history.length - 1];
      const first = history[0];

      return {
        trade_id: tradeId,
        total_snapshots: history.length,
        entry_price: parseFloat(first.entry_price.toString()),
        current_price: parseFloat(current.current_price.toString()),
        highest_price: maxPrice,
        lowest_price: minPrice,
        max_pnl_percent: maxPnL,
        min_pnl_percent: minPnL,
        current_pnl_percent: parseFloat(current.pnl_percent.toString()),
        duration_hours: parseFloat(current.hours_since_entry.toString()),
        price_volatility: this.calculateVolatility(prices),
      };
    } catch (error) {
      getLogger().error(SystemAction.DataProcessing, 'Erro ao calcular estatísticas', error as Error);
      return null;
    }
  }

  /**
   * Calcula volatilidade de uma série de preços
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100; // Volatilidade em percentual
  }
}

export const tradePriceMonitor = TradePriceMonitorService.getInstance();

