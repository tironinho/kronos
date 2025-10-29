/**
 * Database Population Service
 * 
 * Serviço responsável por preencher automaticamente todas as tabelas do banco de dados
 * que não estão sendo populadas pelo sistema principal.
 * 
 * Este serviço roda periodicamente e garante que todos os dados sejam coletados e salvos.
 */

import { supabase } from './supabase-db';
import { getBinanceClient } from './binance-api';
import DataPersistenceService from './data-persistence-service';
import { getComponentLogger, SystemAction, SystemComponent } from './logger';
import EquityMonitoringService from './equity-monitoring-service';
import TechnicalAnalysisService from './technical-analysis-service';

const logger = getComponentLogger(SystemComponent.TradingEngine);

export class DatabasePopulationService {
  private static instance: DatabasePopulationService;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POPULATION_INTERVAL = 300000; // 5 minutos
  private dataPersistence: DataPersistenceService;

  private constructor() {
    this.dataPersistence = DataPersistenceService.getInstance();
  }

  public static getInstance(): DatabasePopulationService {
    if (!DatabasePopulationService.instance) {
      DatabasePopulationService.instance = new DatabasePopulationService();
    }
    return DatabasePopulationService.instance;
  }

  /**
   * Inicia o serviço de preenchimento automático
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.info(SystemAction.Monitoring, 'Serviço de preenchimento já está rodando');
      return;
    }

    this.isRunning = true;
    logger.info(SystemAction.Monitoring, 'Iniciando serviço de preenchimento de banco de dados');

    // Primeira execução imediata
    await this.populateAllTables();

    // Configurar intervalo
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.populateAllTables();
      }
    }, this.POPULATION_INTERVAL);

    logger.info(
      SystemAction.Monitoring,
      `Serviço de preenchimento ativo (intervalo: ${this.POPULATION_INTERVAL / 1000 / 60} minutos)`
    );
  }

  /**
   * Para o serviço de preenchimento
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info(SystemAction.Monitoring, 'Serviço de preenchimento parado');
  }

  /**
   * Preenche todas as tabelas
   */
  private async populateAllTables(): Promise<void> {
    const startTime = Date.now();
    logger.info(SystemAction.DataProcessing, 'Iniciando preenchimento de todas as tabelas...');

    try {
      // Executar todos os preenchimentos em paralelo (onde possível)
      await Promise.allSettled([
        this.populateKronosMetrics(),
        this.populateMarketDataRealtime(),
        this.populateSentimentData(),
        this.populateMacroIndicators(),
        this.populateSystemPerformance(),
        this.populateTechnicalIndicatorsHistory(),
      ]);

      // Preenchimentos que dependem de dados anteriores (sequenciais)
      await this.populateSystemAlerts();

      const duration = Date.now() - startTime;
      logger.info(
        SystemAction.DataProcessing,
        `Preenchimento concluído em ${duration}ms`
      );
    } catch (error) {
      logger.error(
        SystemAction.SystemError,
        'Erro no preenchimento de tabelas',
        error as Error
      );
    }
  }

  /**
   * 1. Preenche kronos_metrics
   */
  private async populateKronosMetrics(): Promise<void> {
    try {
      const binanceClient = getBinanceClient();
      const futuresAccount = await binanceClient.getFuturesAccountInfo();
      const equity = parseFloat(futuresAccount.totalWalletBalance || '0');

      // Obter trades para calcular métricas
      const { data: trades } = await supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(100);

      const totalTrades = trades?.length || 0;
      const winningTrades = trades?.filter(t => (t.pnl || 0) > 0).length || 0;
      const pnlDay = trades?.filter(t => {
        const closedAt = new Date(t.closed_at || t.opened_at);
        const today = new Date();
        return closedAt.toDateString() === today.toDateString();
      }).reduce((sum, t) => sum + parseFloat(t.pnl?.toString() || '0'), 0) || 0;

      // Calcular fills_ratio (trades executadas vs tentadas)
      const { data: allTrades } = await supabase
        .from('real_trades')
        .select('status')
        .limit(1000);

      const totalAttempts = allTrades?.length || 1;
      const executedTrades = allTrades?.filter(t => t.status !== 'cancelled').length || 0;
      const fillsRatio = executedTrades / totalAttempts;

      const { error } = await supabase.from('kronos_metrics').insert({
        ts: new Date().toISOString(),
        equity: equity,
        pnl_day: pnlDay,
        fills_ratio: fillsRatio,
        selected_symbols: null,
        notes: `Auto-populated at ${new Date().toISOString()}`,
      });

      if (error) {
        throw error;
      }

      logger.debug(SystemAction.DataPersistence, 'kronos_metrics populada');
    } catch (error) {
      logger.error(
        SystemAction.DataPersistence,
        'Erro ao preencher kronos_metrics',
        error as Error
      );
    }
  }

  /**
   * 2. Preenche market_data_realtime
   */
  private async populateMarketDataRealtime(): Promise<void> {
    try {
      // Obter símbolos ativos das trades
      const { data: activeTrades } = await supabase
        .from('real_trades')
        .select('symbol')
        .eq('status', 'open')
        .limit(10);

      const symbols = activeTrades?.map(t => t.symbol) || ['BTCUSDT', 'ETHUSDT'];

      // Salvar dados de mercado para cada símbolo
      for (const symbol of symbols) {
        await this.dataPersistence.saveMarketData(symbol);
      }

      logger.debug(SystemAction.DataPersistence, 'market_data_realtime populada');
    } catch (error) {
      logger.error(
        SystemAction.DataPersistence,
        'Erro ao preencher market_data_realtime',
        error as Error
      );
    }
  }

  /**
   * 3. Preenche sentiment_data
   */
  private async populateSentimentData(): Promise<void> {
    try {
      await this.dataPersistence.saveSentimentData('BTCUSDT');
      logger.debug(SystemAction.DataPersistence, 'sentiment_data populada');
    } catch (error) {
      logger.error(
        SystemAction.DataPersistence,
        'Erro ao preencher sentiment_data',
        error as Error
      );
    }
  }

  /**
   * 4. Preenche macro_indicators
   */
  private async populateMacroIndicators(): Promise<void> {
    try {
      await this.dataPersistence.saveMacroIndicators();
      logger.debug(SystemAction.DataPersistence, 'macro_indicators populada');
    } catch (error) {
      logger.error(
        SystemAction.DataPersistence,
        'Erro ao preencher macro_indicators',
        error as Error
      );
    }
  }

  /**
   * 5. Preenche system_performance
   */
  private async populateSystemPerformance(): Promise<void> {
    try {
      const equityMonitoring = EquityMonitoringService.getInstance();

      // Buscar todas as trades fechadas
      const { data: closedTrades } = await supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'closed');

      if (!closedTrades || closedTrades.length === 0) {
        return;
      }

      const totalTrades = closedTrades.length;
      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
      const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0).length;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

      const pnls = closedTrades.map(t => parseFloat(t.pnl?.toString() || '0'));
      const totalPnL = pnls.reduce((a, b) => a + b, 0);

      // Calcular P&L diário/semanal/mensal
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

      const dailyPnL = closedTrades
        .filter(t => new Date(t.closed_at || t.opened_at).getTime() >= oneDayAgo)
        .reduce((sum, t) => sum + parseFloat(t.pnl?.toString() || '0'), 0);

      const weeklyPnL = closedTrades
        .filter(t => new Date(t.closed_at || t.opened_at).getTime() >= oneWeekAgo)
        .reduce((sum, t) => sum + parseFloat(t.pnl?.toString() || '0'), 0);

      const monthlyPnL = closedTrades
        .filter(t => new Date(t.closed_at || t.opened_at).getTime() >= oneMonthAgo)
        .reduce((sum, t) => sum + parseFloat(t.pnl?.toString() || '0'), 0);

      // Calcular wins/losses
      const wins = pnls.filter(p => p > 0);
      const losses = pnls.filter(p => p < 0);
      const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
      const maxWin = wins.length > 0 ? Math.max(...wins) : 0;
      const maxLoss = losses.length > 0 ? Math.min(...losses) : 0;

      // Calcular sequência de wins/losses
      let maxConsecutiveWins = 0;
      let maxConsecutiveLosses = 0;
      let currentWins = 0;
      let currentLosses = 0;

      for (const pnl of pnls) {
        if (pnl > 0) {
          currentWins++;
          currentLosses = 0;
          maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
        } else if (pnl < 0) {
          currentLosses++;
          currentWins = 0;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
        }
      }

      // Calcular duração média das trades
      const durations = closedTrades
        .filter(t => t.opened_at && t.closed_at)
        .map(t => {
          const opened = new Date(t.opened_at).getTime();
          const closed = new Date(t.closed_at).getTime();
          return (closed - opened) / (1000 * 60); // em minutos
        });

      const avgTradeDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      // Calcular drawdown (simplificado)
      const { data: equityHistory } = await supabase
        .from('equity_history')
        .select('equity')
        .eq('symbol', 'USDT_FUTURES')
        .order('timestamp', { ascending: true })
        .limit(100);

      let maxEquity = 0;
      let maxDrawdown = 0;

      if (equityHistory && equityHistory.length > 0) {
        for (const point of equityHistory) {
          const equity = parseFloat(point.equity?.toString() || '0');
          maxEquity = Math.max(maxEquity, equity);
          const drawdown = maxEquity - equity;
          maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
      }

      const profitFactor = Math.abs(avgLoss) > 0
        ? Math.abs(avgWin) / Math.abs(avgLoss)
        : 0;

      await this.dataPersistence.saveSystemPerformance({
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        dailyPnL,
        weeklyPnL,
        monthlyPnL,
        maxDrawdown,
        sharpeRatio: 0, // Calcular depois se necessário
        profitFactor,
        avgWin,
        avgLoss,
        maxWin,
        maxLoss,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        avgTradeDuration,
      });

      logger.debug(SystemAction.DataPersistence, 'system_performance populada');
    } catch (error) {
      logger.error(
        SystemAction.DataPersistence,
        'Erro ao preencher system_performance',
        error as Error
      );
    }
  }

  /**
   * 6. Preenche technical_indicators_history
   */
  private async populateTechnicalIndicatorsHistory(): Promise<void> {
    try {
      // Obter símbolos ativos
      const { data: activeTrades } = await supabase
        .from('real_trades')
        .select('symbol')
        .eq('status', 'open')
        .limit(5);

      const symbols = activeTrades?.map(t => t.symbol) || ['BTCUSDT', 'ETHUSDT'];

      const technicalService = TechnicalAnalysisService.getInstance();
      const binanceClient = getBinanceClient();

      for (const symbol of symbols) {
        try {
          // Obter preço atual
          const priceData = await binanceClient.getPrice(symbol);
          const currentPrice = parseFloat(priceData.price);

          // Obter klines para cálculo de indicadores
          const klines = await binanceClient.getKlines(symbol, '1h', 200);

          if (!klines || klines.length === 0) {
            continue;
          }

          const closes = klines.map((k: any) => parseFloat(k.close));
          const highs = klines.map((k: any) => parseFloat(k.high));
          const lows = klines.map((k: any) => parseFloat(k.low));
          const volumes = klines.map((k: any) => parseFloat(k.volume));

          // Calcular RSI (simplificado)
          const rsi = this.calculateRSI(closes, 14);

          // Calcular MACD (simplificado)
          const macd = this.calculateMACD(closes, 12, 26, 9);
          const macdLine = macd.macd;
          const macdSignal = macd.signal;
          const macdHistogram = macd.histogram;

          // Calcular Bollinger Bands
          const bb = this.calculateBollingerBands(closes, 20, 2);

          // Calcular EMAs
          const ema9 = this.calculateEMA(closes, 9);
          const ema21 = this.calculateEMA(closes, 21);
          const ema50 = this.calculateEMA(closes, 50);

          // Calcular SMAs
          const sma20 = this.calculateSMA(closes, 20);
          const sma50 = this.calculateSMA(closes, 50);
          const sma200 = this.calculateSMA(closes, 200);

          // Volume MA
          const volumeMA20 = this.calculateSMA(volumes, 20);
          const currentVolume = volumes[volumes.length - 1];
          const volumeRatio = volumeMA20 > 0 ? currentVolume / volumeMA20 : 1;

          // Obter último kline para OHLCV
          const lastKline = klines[klines.length - 1];
          const openPrice = parseFloat(lastKline.open);
          const highPrice = parseFloat(lastKline.high);
          const lowPrice = parseFloat(lastKline.low);
          const closePrice = parseFloat(lastKline.close);
          const volume = parseFloat(lastKline.volume);

          // Calcular suporte e resistência (simplificado)
          const supportLevel = Math.min(...lows.slice(-20));
          const resistanceLevel = Math.max(...highs.slice(-20));

          const { error } = await supabase.from('technical_indicators_history').insert({
            symbol,
            timeframe: '1h',
            rsi: rsi,
            macd_line: macdLine,
            macd_signal: macdSignal,
            macd_histogram: macdHistogram,
            bb_upper: bb.upper,
            bb_middle: bb.middle,
            bb_lower: bb.lower,
            bb_width: bb.upper - bb.lower,
            ema_9: ema9,
            ema_21: ema21,
            ema_50: ema50,
            sma_20: sma20,
            sma_50: sma50,
            sma_200: sma200,
            volume_ma_20: volumeMA20,
            volume_ratio: volumeRatio,
            support_level: supportLevel,
            resistance_level: resistanceLevel,
            open_price: openPrice,
            high_price: highPrice,
            low_price: lowPrice,
            close_price: closePrice,
            volume: volume,
          });

          if (error) {
            logger.warn(
              SystemAction.DataPersistence,
              `Erro ao salvar indicadores técnicos para ${symbol}: ${error.message}`
            );
          }
        } catch (error) {
          logger.warn(
            SystemAction.DataPersistence,
            `Erro ao processar ${symbol} para indicadores técnicos`,
            error as Error
          );
        }
      }

      logger.debug(SystemAction.DataPersistence, 'technical_indicators_history populada');
    } catch (error) {
      logger.error(
        SystemAction.DataPersistence,
        'Erro ao preencher technical_indicators_history',
        error as Error
      );
    }
  }

  /**
   * 7. Preenche system_alerts (baseado em condições do sistema)
   */
  private async populateSystemAlerts(): Promise<void> {
    try {
      // Verificar condições que podem gerar alertas
      const { data: openTrades } = await supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'open');

      if (!openTrades || openTrades.length === 0) {
        return;
      }

      // Verificar trades com P&L negativo significativo
      for (const trade of openTrades) {
        const pnlPercent = parseFloat(trade.pnl_percent?.toString() || '0');
        
        if (pnlPercent < -10) {
          await this.dataPersistence.saveSystemAlert({
            alertType: 'trade_loss',
            severity: 'high',
            symbol: trade.symbol,
            title: `Trade com perda significativa: ${trade.symbol}`,
            message: `Trade ${trade.trade_id} está com ${pnlPercent.toFixed(2)}% de perda`,
            relatedData: { trade_id: trade.trade_id, pnl_percent: pnlPercent },
          });
        }
      }

      logger.debug(SystemAction.DataPersistence, 'system_alerts populada');
    } catch (error) {
      logger.error(
        SystemAction.DataPersistence,
        'Erro ao preencher system_alerts',
        error as Error
      );
    }
  }

  // ============================================================================
  // Funções auxiliares para cálculos técnicos
  // ============================================================================

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    }
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateMACD(
    prices: number[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number
  ): { macd: number; signal: number; histogram: number } {
    if (prices.length < slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 };
    }

    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    const macd = fastEMA - slowEMA;

    // Signal line é EMA do MACD (simplificado - usar apenas o valor atual)
    // Em produção, calcular histórico completo do MACD
    const signal = macd * 0.9; // Simplificação
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  private calculateBollingerBands(
    prices: number[],
    period: number,
    numStdDev: number
  ): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);

    const variance = slice.reduce((sum, price) => {
      return sum + Math.pow(price - sma, 2);
    }, 0) / period;

    const stdDev = Math.sqrt(variance);

    return {
      middle: sma,
      upper: sma + (stdDev * numStdDev),
      lower: sma - (stdDev * numStdDev),
    };
  }
}

export const databasePopulationService = DatabasePopulationService.getInstance();

