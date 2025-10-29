import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

interface EquityData {
  id: number;
  symbol: string;
  equity: number;
  timestamp: string;
}

interface TradeData {
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
}

interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  averagePnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  equityCurve: Array<{timestamp: string, equity: number}>;
  dailyReturns: Array<{date: string, return: number}>;
}

interface StrategyAnalysis {
  symbol: string;
  algorithm: string;
  performance: PerformanceMetrics;
  recommendations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class ActiveMonitoringService extends EventEmitter {
  private supabase: any;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private analysisInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private lastEquityCheck: string | null = null;
  private lastTradeCheck: string | null = null;

  constructor() {
    super();
    this.initializeSupabase();
  }

  private initializeSupabase() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ ActiveMonitoringService: Supabase credentials not found, using fallback');
        this.supabase = null;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ ActiveMonitoringService: Supabase initialized');
    } catch (error) {
      console.error('❌ ActiveMonitoringService: Failed to initialize Supabase:', error);
      this.supabase = null;
    }
  }

  /**
   * Inicia o monitoramento ativo
   */
  public startMonitoring(intervalMs: number = 30000) {
    if (this.isMonitoring) {
      console.log('⚠️ ActiveMonitoringService: Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log(`🚀 ActiveMonitoringService: Starting active monitoring (${intervalMs}ms interval)`);

    // Monitoramento de equity a cada 30 segundos
    this.monitoringInterval = setInterval(async () => {
      await this.monitorEquityHistory();
      await this.monitorRealTrades();
    }, intervalMs);

    // Análise de performance a cada 5 minutos
    this.analysisInterval = setInterval(async () => {
      await this.performStrategyAnalysis();
    }, 300000);

    // Análise inicial
    this.performInitialAnalysis();
  }

  /**
   * Para o monitoramento ativo
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

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    console.log('🛑 ActiveMonitoringService: Monitoring stopped');
  }

  /**
   * Monitora mudanças na equity_history
   */
  private async monitorEquityHistory() {
    if (!this.supabase) {
      console.warn('⚠️ ActiveMonitoringService: Supabase not available, skipping equity monitoring');
      return;
    }

    try {
      const { data: equityData, error } = await this.supabase
        .from('equity_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Error fetching equity history:', error);
        return;
      }

      if (equityData && equityData.length > 0) {
        const latestEquity = equityData[0];
        
        // Verificar se há mudança significativa
        if (this.lastEquityCheck !== latestEquity.timestamp) {
          this.lastEquityCheck = latestEquity.timestamp;
          
          console.log(`📊 Equity Update: ${latestEquity.symbol} = $${latestEquity.equity.toFixed(2)}`);
          
          // Emitir evento para análise
          this.emit('equityUpdate', latestEquity);
          
          // Verificar drawdown
          await this.checkDrawdown(latestEquity);
        }
      }
    } catch (error) {
      console.error('❌ Error monitoring equity history:', error);
    }
  }

  /**
   * Monitora mudanças na real_trades
   */
  private async monitorRealTrades() {
    if (!this.supabase) {
      console.warn('⚠️ ActiveMonitoringService: Supabase not available, skipping trades monitoring');
      return;
    }

    try {
      const { data: tradesData, error } = await this.supabase
        .from('real_trades')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('❌ Error fetching real trades:', error);
        return;
      }

      if (tradesData && tradesData.length > 0) {
        const latestTrade = tradesData[0];
        
        // Verificar se há nova trade
        if (this.lastTradeCheck !== latestTrade.trade_id) {
          this.lastTradeCheck = latestTrade.trade_id;
          
          console.log(`📈 New Trade: ${latestTrade.symbol} ${latestTrade.side} @ $${latestTrade.entry_price.toFixed(4)}`);
          
          // Emitir evento para análise
          this.emit('newTrade', latestTrade);
          
          // Verificar sequência de trades
          await this.checkTradeSequence(tradesData);
        }
      }
    } catch (error) {
      console.error('❌ Error monitoring real trades:', error);
    }
  }

  /**
   * Verifica drawdown na equity
   */
  private async checkDrawdown(currentEquity: EquityData) {
    if (!this.supabase) {
      return;
    }

    try {
      const { data: equityHistory, error } = await this.supabase
        .from('equity_history')
        .select('equity')
        .eq('symbol', currentEquity.symbol)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error || !equityHistory) return;

      const equityValues = equityHistory.map(e => e.equity);
      const maxEquity = Math.max(...equityValues);
      const currentEquityValue = currentEquity.equity;
      
      const drawdown = ((maxEquity - currentEquityValue) / maxEquity) * 100;

      if (drawdown > 10) {
        console.log(`🚨 DRAWDOWN ALERT: ${currentEquity.symbol} - ${drawdown.toFixed(2)}% drawdown`);
        this.emit('drawdownAlert', {
          symbol: currentEquity.symbol,
          drawdown,
          maxEquity,
          currentEquity: currentEquityValue
        });
      }
    } catch (error) {
      console.error('❌ Error checking drawdown:', error);
    }
  }

  /**
   * Verifica sequência de trades perdedores
   */
  private async checkTradeSequence(trades: TradeData[]) {
    const closedTrades = trades.filter(t => t.status === 'closed');
    
    if (closedTrades.length >= 3) {
      const lastThreeTrades = closedTrades.slice(0, 3);
      const allLosing = lastThreeTrades.every(t => t.pnl < 0);
      
      if (allLosing) {
        console.log(`🚨 LOSING STREAK ALERT: 3 consecutive losing trades`);
        this.emit('losingStreakAlert', {
          trades: lastThreeTrades,
          totalLoss: lastThreeTrades.reduce((sum, t) => sum + t.pnl, 0)
        });
      }
    }
  }

  /**
   * Realiza análise inicial das estratégias
   */
  private async performInitialAnalysis() {
    console.log('🔍 ActiveMonitoringService: Performing initial strategy analysis...');
    await this.performStrategyAnalysis();
  }

  /**
   * Realiza análise completa das estratégias
   */
  private async performStrategyAnalysis() {
    if (!this.supabase) {
      console.warn('⚠️ ActiveMonitoringService: Supabase not available, skipping strategy analysis');
      return;
    }

    try {
      console.log('📊 ActiveMonitoringService: Performing strategy analysis...');

      // Buscar dados de trades fechadas
      const { data: closedTrades, error: tradesError } = await this.supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false });

      if (tradesError) {
        console.error('❌ Error fetching closed trades:', tradesError);
        return;
      }

      // Buscar dados de equity
      const { data: equityData, error: equityError } = await this.supabase
        .from('equity_history')
        .select('*')
        .order('timestamp', { ascending: true });

      if (equityError) {
        console.error('❌ Error fetching equity data:', equityError);
        return;
      }

      if (closedTrades && closedTrades.length > 0) {
        const analysis = this.calculatePerformanceMetrics(closedTrades, equityData);
        const recommendations = this.generateRecommendations(analysis);
        
        console.log('📈 Strategy Analysis Results:');
        console.log(`   Total Trades: ${analysis.totalTrades}`);
        console.log(`   Win Rate: ${analysis.winRate.toFixed(2)}%`);
        console.log(`   Total PnL: $${analysis.totalPnl.toFixed(2)}`);
        console.log(`   Max Drawdown: ${analysis.maxDrawdown.toFixed(2)}%`);
        console.log(`   Sharpe Ratio: ${analysis.sharpeRatio.toFixed(2)}`);

        // Emitir evento com análise completa
        this.emit('strategyAnalysis', {
          metrics: analysis,
          recommendations,
          timestamp: new Date().toISOString()
        });

        // Aplicar recomendações automaticamente
        await this.applyRecommendations(recommendations);
      }
    } catch (error) {
      console.error('❌ Error performing strategy analysis:', error);
    }
  }

  /**
   * Calcula métricas de performance
   */
  private calculatePerformanceMetrics(trades: TradeData[], equityData: EquityData[]): PerformanceMetrics {
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const averagePnl = totalTrades > 0 ? totalPnl / totalTrades : 0;
    
    // Calcular drawdown máximo
    const equityValues = equityData.map(e => e.equity);
    let maxDrawdown = 0;
    let peak = equityValues[0];
    
    for (let i = 1; i < equityValues.length; i++) {
      if (equityValues[i] > peak) {
        peak = equityValues[i];
      }
      const drawdown = ((peak - equityValues[i]) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Calcular Sharpe Ratio (simplificado)
    const returns = this.calculateDailyReturns(equityData);
    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r.return, 0) / returns.length : 0;
    const returnStdDev = this.calculateStandardDeviation(returns.map(r => r.return));
    const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;

    // Calcular Profit Factor
    const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnl,
      averagePnl,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      equityCurve: equityData.map(e => ({ timestamp: e.timestamp, equity: e.equity })),
      dailyReturns: returns
    };
  }

  /**
   * Calcula retornos diários
   */
  private calculateDailyReturns(equityData: EquityData[]) {
    const returns = [];
    
    for (let i = 1; i < equityData.length; i++) {
      const prevEquity = equityData[i - 1].equity;
      const currentEquity = equityData[i].equity;
      const dailyReturn = ((currentEquity - prevEquity) / prevEquity) * 100;
      
      returns.push({
        date: equityData[i].timestamp,
        return: dailyReturn
      });
    }
    
    return returns;
  }

  /**
   * Calcula desvio padrão
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Gera recomendações baseadas na análise
   */
  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    // Análise de Win Rate
    if (metrics.winRate < 40) {
      recommendations.push('INCREASE_CONFIDENCE_THRESHOLD');
      recommendations.push('IMPROVE_ENTRY_SIGNALS');
    } else if (metrics.winRate > 70) {
      recommendations.push('INCREASE_POSITION_SIZE');
    }

    // Análise de Drawdown
    if (metrics.maxDrawdown > 15) {
      recommendations.push('REDUCE_POSITION_SIZE');
      recommendations.push('TIGHTEN_STOP_LOSS');
    }

    // Análise de Sharpe Ratio
    if (metrics.sharpeRatio < 1.0) {
      recommendations.push('IMPROVE_RISK_MANAGEMENT');
      recommendations.push('OPTIMIZE_ENTRY_EXIT_TIMING');
    }

    // Análise de Profit Factor
    if (metrics.profitFactor < 1.2) {
      recommendations.push('IMPROVE_RISK_REWARD_RATIO');
      recommendations.push('BETTER_TAKE_PROFIT_LEVELS');
    }

    return recommendations;
  }

  /**
   * Aplica recomendações automaticamente
   */
  private async applyRecommendations(recommendations: string[]) {
    console.log('🔧 ActiveMonitoringService: Applying recommendations...');
    
    for (const recommendation of recommendations) {
      console.log(`   📋 Recommendation: ${recommendation}`);
      
      // Emitir evento para o sistema aplicar a recomendação
      this.emit('recommendation', recommendation);
    }
  }

  /**
   * Obtém análise por símbolo
   */
  public async getSymbolAnalysis(symbol: string): Promise<StrategyAnalysis | null> {
    if (!this.supabase) {
      console.warn('⚠️ ActiveMonitoringService: Supabase not available, cannot get symbol analysis');
      return null;
    }

    try {
      const { data: trades, error } = await this.supabase
        .from('real_trades')
        .select('*')
        .eq('symbol', symbol)
        .eq('status', 'closed');

      if (error || !trades || trades.length === 0) {
        return null;
      }

      const { data: equityData } = await this.supabase
        .from('equity_history')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: true });

      const metrics = this.calculatePerformanceMetrics(trades, equityData || []);
      const recommendations = this.generateRecommendations(metrics);
      
      const riskLevel = this.determineRiskLevel(metrics);

      return {
        symbol,
        algorithm: trades[0]?.algorithm || 'unknown',
        performance: metrics,
        recommendations,
        riskLevel
      };
    } catch (error) {
      console.error('❌ Error getting symbol analysis:', error);
      return null;
    }
  }

  /**
   * Determina nível de risco baseado nas métricas
   */
  private determineRiskLevel(metrics: PerformanceMetrics): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (metrics.winRate > 60 && metrics.maxDrawdown < 10 && metrics.sharpeRatio > 1.5) {
      return 'LOW';
    } else if (metrics.winRate > 45 && metrics.maxDrawdown < 20 && metrics.sharpeRatio > 1.0) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  /**
   * Obtém status do monitoramento
   */
  public getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastEquityCheck: this.lastEquityCheck,
      lastTradeCheck: this.lastTradeCheck,
      uptime: this.isMonitoring ? Date.now() - (this.monitoringInterval ? Date.now() : 0) : 0
    };
  }
}

export const activeMonitoringService = new ActiveMonitoringService();
