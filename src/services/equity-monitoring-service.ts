import { supabase } from './supabase-db';
import { getBinanceClient } from './binance-api';

export interface EquityEvolution {
  currentEquity: number;
  initialEquity: number;
  totalReturn: number;
  totalReturnPercent: number;
  dailyReturn: number;
  dailyReturnPercent: number;
  weeklyReturn: number;
  weeklyReturnPercent: number;
  monthlyReturn: number;
  monthlyReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  volatility: number;
  equityCurve: Array<{
    timestamp: string;
    equity: number;
    return: number;
    returnPercent: number;
  }>;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeDuration: number;
  bestTrade: number;
  worstTrade: number;
}

export class EquityMonitoringService {
  private static instance: EquityMonitoringService;
  private equityHistory: Map<string, EquityEvolution> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  private constructor() {}

  public static getInstance(): EquityMonitoringService {
    if (!EquityMonitoringService.instance) {
      EquityMonitoringService.instance = new EquityMonitoringService();
    }
    return EquityMonitoringService.instance;
  }

  /**
   * Busca evolução do equity para um símbolo específico
   */
  public async getEquityEvolution(symbol: string, days = 30): Promise<EquityEvolution | null> {
    try {
      // Buscar histórico de equity do banco
      const { data: equityData, error } = await supabase
        .from('equity_history')
        .select('*')
        .eq('symbol', symbol)
        .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Erro ao buscar equity history:', error);
        return null;
      }

      if (!equityData || equityData.length === 0) {
        console.warn(`Nenhum dado de equity encontrado para ${symbol}`);
        return null;
      }

      // Buscar saldo atual da Binance
      let currentEquity = 0;
      try {
        const binanceClient = getBinanceClient();
        const accountInfo = await binanceClient.getFuturesAccountInfo();
        currentEquity = parseFloat(accountInfo.totalWalletBalance || '0');
      } catch (binanceError) {
        console.warn('Erro ao buscar saldo atual da Binance:', binanceError);
        // Usar o último valor do histórico como fallback
        currentEquity = equityData[equityData.length - 1].equity;
      }

      const initialEquity = equityData[0].equity;
      const totalReturn = currentEquity - initialEquity;
      const totalReturnPercent = (totalReturn / initialEquity) * 100;

      // Calcular retornos por período
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyEquity = this.getEquityAtTime(equityData, oneDayAgo);
      const weeklyEquity = this.getEquityAtTime(equityData, oneWeekAgo);
      const monthlyEquity = this.getEquityAtTime(equityData, oneMonthAgo);

      const dailyReturn = currentEquity - dailyEquity;
      const dailyReturnPercent = (dailyReturn / dailyEquity) * 100;

      const weeklyReturn = currentEquity - weeklyEquity;
      const weeklyReturnPercent = (weeklyReturn / weeklyEquity) * 100;

      const monthlyReturn = currentEquity - monthlyEquity;
      const monthlyReturnPercent = (monthlyReturn / monthlyEquity) * 100;

      // Calcular drawdown máximo
      const { maxDrawdown, maxDrawdownPercent } = this.calculateMaxDrawdown(equityData);

      // Calcular Sharpe Ratio e volatilidade
      const returns = this.calculateReturns(equityData);
      const { sharpeRatio, volatility } = this.calculateRiskMetrics(returns);

      // Construir curva de equity
      const equityCurve = equityData.map((point, index) => {
        const returnValue = point.equity - initialEquity;
        const returnPercent = (returnValue / initialEquity) * 100;
        return {
          timestamp: point.timestamp,
          equity: point.equity,
          return: returnValue,
          returnPercent
        };
      });

      const evolution: EquityEvolution = {
        currentEquity,
        initialEquity,
        totalReturn,
        totalReturnPercent,
        dailyReturn,
        dailyReturnPercent,
        weeklyReturn,
        weeklyReturnPercent,
        monthlyReturn,
        monthlyReturnPercent,
        maxDrawdown,
        maxDrawdownPercent,
        sharpeRatio,
        volatility,
        equityCurve
      };

      this.equityHistory.set(symbol, evolution);
      return evolution;

    } catch (error) {
      console.error('Erro ao calcular evolução do equity:', error);
      return null;
    }
  }

  /**
   * Busca métricas de performance das trades reais
   */
  public async getPerformanceMetrics(symbol?: string): Promise<PerformanceMetrics | null> {
    try {
      let query = supabase.from('real_trades').select('*');
      
      if (symbol) {
        query = query.eq('symbol', symbol);
      }

      const { data: trades, error } = await query;

      if (error) {
        console.error('Erro ao buscar trades:', error);
        return null;
      }

      if (!trades || trades.length === 0) {
        return null;
      }

      const closedTrades = trades.filter(t => t.status === 'closed');
      const totalTrades = closedTrades.length;
      
      if (totalTrades === 0) {
        return {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalPnL: 0,
          totalPnLPercent: 0,
          avgWin: 0,
          avgLoss: 0,
          profitFactor: 0,
          maxConsecutiveWins: 0,
          maxConsecutiveLosses: 0,
          avgTradeDuration: 0,
          bestTrade: 0,
          worstTrade: 0
        };
      }

      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
      const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
      
      const winRate = (winningTrades.length / totalTrades) * 100;
      
      const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const totalPnLPercent = closedTrades.reduce((sum, t) => sum + (t.pnl_percent || 0), 0) / totalTrades;
      
      const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
      
      const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
      const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
      
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);
      
      // Calcular sequências consecutivas
      const { maxConsecutiveWins, maxConsecutiveLosses } = this.calculateConsecutiveSequences(closedTrades);
      
      // Duração média das trades
      const avgTradeDuration = closedTrades.reduce((sum, t) => {
        const opened = new Date(t.opened_at);
        const closed = t.closed_at ? new Date(t.closed_at) : new Date();
        return sum + (closed.getTime() - opened.getTime()) / 1000 / 60; // em minutos
      }, 0) / totalTrades;
      
      // Melhor e pior trade
      const pnls = closedTrades.map(t => t.pnl || 0);
      const bestTrade = Math.max(...pnls);
      const worstTrade = Math.min(...pnls);

      const metrics: PerformanceMetrics = {
        totalTrades,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate,
        totalPnL,
        totalPnLPercent,
        avgWin,
        avgLoss,
        profitFactor,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        avgTradeDuration,
        bestTrade,
        worstTrade
      };

      this.performanceMetrics.set(symbol || 'all', metrics);
      return metrics;

    } catch (error) {
      console.error('Erro ao calcular métricas de performance:', error);
      return null;
    }
  }

  /**
   * Obtém equity em um momento específico
   */
  private getEquityAtTime(equityData: any[], targetTime: Date): number {
    const targetTimestamp = targetTime.getTime();
    
    // Encontrar o ponto mais próximo no tempo
    let closestPoint = equityData[0];
    let minDiff = Math.abs(new Date(closestPoint.timestamp).getTime() - targetTimestamp);
    
    for (const point of equityData) {
      const pointTime = new Date(point.timestamp).getTime();
      const diff = Math.abs(pointTime - targetTimestamp);
      
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = point;
      }
    }
    
    return closestPoint.equity;
  }

  /**
   * Calcula drawdown máximo
   */
  private calculateMaxDrawdown(equityData: any[]): { maxDrawdown: number; maxDrawdownPercent: number } {
    let maxEquity = equityData[0].equity;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    
    for (const point of equityData) {
      if (point.equity > maxEquity) {
        maxEquity = point.equity;
      }
      
      const drawdown = maxEquity - point.equity;
      const drawdownPercent = (drawdown / maxEquity) * 100;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }
    
    return { maxDrawdown, maxDrawdownPercent };
  }

  /**
   * Calcula retornos diários
   */
  private calculateReturns(equityData: any[]): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < equityData.length; i++) {
      const prevEquity = equityData[i - 1].equity;
      const currentEquity = equityData[i].equity;
      const returnValue = (currentEquity - prevEquity) / prevEquity;
      returns.push(returnValue);
    }
    
    return returns;
  }

  /**
   * Calcula métricas de risco (Sharpe Ratio e volatilidade)
   */
  private calculateRiskMetrics(returns: number[]): { sharpeRatio: number; volatility: number } {
    if (returns.length === 0) {
      return { sharpeRatio: 0, volatility: 0 };
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Sharpe Ratio assumindo taxa livre de risco de 0
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
    
    return { sharpeRatio, volatility };
  }

  /**
   * Calcula sequências consecutivas de vitórias e derrotas
   */
  private calculateConsecutiveSequences(trades: any[]): { maxConsecutiveWins: number; maxConsecutiveLosses: number } {
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    
    for (const trade of trades) {
      const pnl = trade.pnl || 0;
      
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
    
    return { maxConsecutiveWins, maxConsecutiveLosses };
  }

  /**
   * Salva snapshot atual do equity
   */
  public async saveEquitySnapshot(symbol: string): Promise<boolean> {
    try {
      const binanceClient = getBinanceClient();
      const accountInfo = await binanceClient.getFuturesAccountInfo();
      const currentEquity = parseFloat(accountInfo.totalWalletBalance || '0');
      
      const { error } = await supabase
        .from('equity_history')
        .insert({
          symbol,
          equity: currentEquity,
          timestamp: new Date().toISOString()
        });
      
      if (error) {
        console.error('Erro ao salvar snapshot do equity:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar snapshot do equity:', error);
      return false;
    }
  }

  /**
   * Obtém dados em cache
   */
  public getCachedEquityEvolution(symbol: string): EquityEvolution | null {
    return this.equityHistory.get(symbol) || null;
  }

  public getCachedPerformanceMetrics(symbol?: string): PerformanceMetrics | null {
    return this.performanceMetrics.get(symbol || 'all') || null;
  }

  /**
   * Limpa cache
   */
  public clearCache(): void {
    this.equityHistory.clear();
    this.performanceMetrics.clear();
  }
}

export default EquityMonitoringService;
