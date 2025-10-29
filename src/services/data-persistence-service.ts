import { supabase } from './supabase-db';
import EnhancedDataCollector from './enhanced-data-collector';

export interface DataSaveResult {
  success: boolean;
  recordsSaved: number;
  errors: string[];
}

export class DataPersistenceService {
  private static instance: DataPersistenceService;
  private collector: EnhancedDataCollector;

  private constructor() {
    this.collector = EnhancedDataCollector.getInstance();
  }

  public static getInstance(): DataPersistenceService {
    if (!DataPersistenceService.instance) {
      DataPersistenceService.instance = new DataPersistenceService();
    }
    return DataPersistenceService.instance;
  }

  /**
   * Salva dados de mercado em tempo real
   */
  public async saveMarketData(symbol: string): Promise<DataSaveResult> {
    try {
      const data = await this.collector.collectBinanceFuturesData(symbol);
      
      const { error } = await supabase
        .from('market_data_realtime')
        .insert({
          symbol,
          funding_rate: data.fundingRate,
          open_interest: data.openInterest,
          long_short_ratio: data.longShortRatio,
          liquidations_24h: data.liquidations24h,
          trade_flow_data: data.tradeFlow,
          api_trading_status: data.apiTradingStatus
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        recordsSaved: 1,
        errors: []
      };
    } catch (error: any) {
      console.error(`Erro ao salvar dados de mercado para ${symbol}:`, error);
      return {
        success: false,
        recordsSaved: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Salva dados de sentiment
   */
  public async saveSentimentData(symbol?: string): Promise<DataSaveResult> {
    try {
      const data = await this.collector.collectMarketSentimentData();
      
      const { error } = await supabase
        .from('sentiment_data')
        .insert({
          symbol,
          fear_greed_index: data.fearGreedIndex,
          social_sentiment: data.socialSentiment,
          news_sentiment: data.newsSentiment,
          raw_data: data
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        recordsSaved: 1,
        errors: []
      };
    } catch (error: any) {
      console.error('Erro ao salvar dados de sentiment:', error);
      return {
        success: false,
        recordsSaved: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Salva indicadores macroeconômicos
   */
  public async saveMacroIndicators(): Promise<DataSaveResult> {
    try {
      const data = await this.collector.collectMarketSentimentData();
      
      const { error } = await supabase
        .from('macro_indicators')
        .insert({
          dxy: data.macroIndicators.dxy,
          sp500: data.macroIndicators.sp500,
          gold_price: data.macroIndicators.gold,
          oil_price: data.macroIndicators.oil,
          raw_data: data.macroIndicators
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        recordsSaved: 1,
        errors: []
      };
    } catch (error: any) {
      console.error('Erro ao salvar indicadores macro:', error);
      return {
        success: false,
        recordsSaved: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Salva dados completos para um símbolo
   */
  public async saveCompleteData(symbol: string): Promise<DataSaveResult> {
    const results: DataSaveResult[] = [];
    let totalRecords = 0;
    const allErrors: string[] = [];

    try {
      // Salvar dados de mercado
      const marketResult = await this.saveMarketData(symbol);
      results.push(marketResult);
      totalRecords += marketResult.recordsSaved;
      allErrors.push(...marketResult.errors);

      // Salvar dados de sentiment (uma vez por execução)
      if (symbol === 'BTCUSDT') { // Apenas para BTC para evitar duplicatas
        const sentimentResult = await this.saveSentimentData(symbol);
        results.push(sentimentResult);
        totalRecords += sentimentResult.recordsSaved;
        allErrors.push(...sentimentResult.errors);

        const macroResult = await this.saveMacroIndicators();
        results.push(macroResult);
        totalRecords += macroResult.recordsSaved;
        allErrors.push(...macroResult.errors);
      }

      return {
        success: results.every(r => r.success),
        recordsSaved: totalRecords,
        errors: allErrors
      };
    } catch (error: any) {
      console.error(`Erro ao salvar dados completos para ${symbol}:`, error);
      return {
        success: false,
        recordsSaved: totalRecords,
        errors: [...allErrors, error.message]
      };
    }
  }

  /**
   * Salva dados para múltiplos símbolos
   */
  public async saveMultipleSymbols(symbols: string[]): Promise<DataSaveResult> {
    const results: DataSaveResult[] = [];
    let totalRecords = 0;
    const allErrors: string[] = [];

    try {
      for (const symbol of symbols) {
        const result = await this.saveCompleteData(symbol);
        results.push(result);
        totalRecords += result.recordsSaved;
        allErrors.push(...result.errors);
      }

      return {
        success: results.every(r => r.success),
        recordsSaved: totalRecords,
        errors: allErrors
      };
    } catch (error: any) {
      console.error('Erro ao salvar dados para múltiplos símbolos:', error);
      return {
        success: false,
        recordsSaved: totalRecords,
        errors: [...allErrors, error.message]
      };
    }
  }

  /**
   * Salva performance do sistema
   */
  public async saveSystemPerformance(performanceData: any): Promise<DataSaveResult> {
    try {
      const { error } = await supabase
        .from('system_performance')
        .insert({
          total_trades: performanceData.totalTrades,
          winning_trades: performanceData.winningTrades,
          losing_trades: performanceData.losingTrades,
          win_rate: performanceData.winRate,
          total_pnl: performanceData.totalPnL,
          daily_pnl: performanceData.dailyPnL,
          weekly_pnl: performanceData.weeklyPnL,
          monthly_pnl: performanceData.monthlyPnL,
          max_drawdown: performanceData.maxDrawdown,
          sharpe_ratio: performanceData.sharpeRatio,
          profit_factor: performanceData.profitFactor,
          avg_win: performanceData.avgWin,
          avg_loss: performanceData.avgLoss,
          max_consecutive_wins: performanceData.maxConsecutiveWins,
          max_consecutive_losses: performanceData.maxConsecutiveLosses,
          avg_trade_duration_minutes: performanceData.avgTradeDuration
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        recordsSaved: 1,
        errors: []
      };
    } catch (error: any) {
      console.error('Erro ao salvar performance do sistema:', error);
      return {
        success: false,
        recordsSaved: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Salva alerta do sistema
   */
  public async saveSystemAlert(alertData: {
    alertType: string;
    severity: string;
    symbol?: string;
    title: string;
    message: string;
    relatedData?: any;
  }): Promise<DataSaveResult> {
    try {
      const { error } = await supabase
        .from('system_alerts')
        .insert({
          alert_type: alertData.alertType,
          severity: alertData.severity,
          symbol: alertData.symbol,
          title: alertData.title,
          message: alertData.message,
          related_data: alertData.relatedData
        });

      if (error) {
        throw error;
      }

      return {
        success: true,
        recordsSaved: 1,
        errors: []
      };
    } catch (error: any) {
      console.error('Erro ao salvar alerta do sistema:', error);
      return {
        success: false,
        recordsSaved: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Busca dados históricos de mercado
   */
  public async getMarketDataHistory(symbol: string, hours: number = 24): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('market_data_realtime')
        .select('*')
        .eq('symbol', symbol)
        .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Erro ao buscar histórico de dados de mercado:', error);
      return [];
    }
  }

  /**
   * Busca dados de sentiment recentes
   */
  public async getRecentSentimentData(hours: number = 24): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('sentiment_data')
        .select('*')
        .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Erro ao buscar dados de sentiment:', error);
      return [];
    }
  }

  /**
   * Busca performance do sistema
   */
  public async getSystemPerformance(days: number = 7): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('system_performance')
        .select('*')
        .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Erro ao buscar performance do sistema:', error);
      return [];
    }
  }

  /**
   * Busca alertas não lidos
   */
  public async getUnreadAlerts(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('is_read', false)
        .order('timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Erro ao buscar alertas não lidos:', error);
      return [];
    }
  }

  /**
   * Marca alerta como lido
   */
  public async markAlertAsRead(alertId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('system_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error: any) {
      console.error('Erro ao marcar alerta como lido:', error);
      return false;
    }
  }
}

export default DataPersistenceService;
