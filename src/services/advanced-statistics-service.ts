import { createClient } from '@supabase/supabase-js';

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

interface EquityData {
  id: number;
  symbol: string;
  equity: number;
  timestamp: string;
}

interface AdvancedMetrics {
  // Métricas básicas
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  averagePnl: number;
  
  // Métricas de risco
  maxDrawdown: number;
  maxDrawdownDuration: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  var95: number; // Value at Risk 95%
  
  // Métricas de performance
  profitFactor: number;
  expectancy: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  
  // Métricas de consistência
  consecutiveWins: number;
  consecutiveLosses: number;
  winStreakProbability: number;
  lossStreakProbability: number;
  
  // Métricas de timing
  averageTradeDuration: number;
  tradesPerDay: number;
  bestTradingDay: string;
  worstTradingDay: string;
  
  // Métricas por símbolo
  symbolPerformance: Record<string, {
    trades: number;
    winRate: number;
    pnl: number;
    avgConfidence: number;
  }>;
  
  // Métricas por algoritmo
  algorithmPerformance: Record<string, {
    trades: number;
    winRate: number;
    pnl: number;
    avgConfidence: number;
  }>;
  
  // Análise temporal
  monthlyReturns: Array<{month: string, return: number, trades: number}>;
  weeklyReturns: Array<{week: string, return: number, trades: number}>;
  dailyReturns: Array<{date: string, return: number, trades: number}>;
  
  // Equity curve
  equityCurve: Array<{timestamp: string, equity: number, drawdown: number}>;
  
  // Análise de confiança
  confidenceAnalysis: {
    highConfidenceTrades: number;
    mediumConfidenceTrades: number;
    lowConfidenceTrades: number;
    confidenceVsWinRate: Array<{confidence: number, winRate: number}>;
  };
}

interface StrategyOptimization {
  currentSettings: Record<string, any>;
  recommendedSettings: Record<string, any>;
  expectedImprovement: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
}

export class AdvancedStatisticsService {
  private supabase: any;

  constructor() {
    this.initializeSupabase();
  }

  private initializeSupabase() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ AdvancedStatisticsService: Supabase credentials not found, using fallback');
        this.supabase = null;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ AdvancedStatisticsService: Initialized');
    } catch (error) {
      console.error('❌ AdvancedStatisticsService: Failed to initialize:', error);
      this.supabase = null;
    }
  }

  /**
   * Realiza análise estatística completa
   */
  public async performCompleteAnalysis(): Promise<AdvancedMetrics> {
    console.log('📊 AdvancedStatisticsService: Performing complete analysis...');

    if (!this.supabase) {
      console.warn('⚠️ AdvancedStatisticsService: Supabase not available, returning empty analysis');
      return this.getEmptyMetrics();
    }

    try {
      // Buscar dados
      const trades = await this.getClosedTrades();
      const equityData = await this.getEquityData();

      if (!trades || trades.length === 0) {
        console.warn('⚠️ AdvancedStatisticsService: No closed trades found');
        return this.getEmptyMetrics();
      }

      // Calcular métricas
      const metrics: AdvancedMetrics = {
        // Métricas básicas
        totalTrades: trades.length,
        winningTrades: trades.filter(t => t.pnl > 0).length,
        losingTrades: trades.filter(t => t.pnl < 0).length,
        winRate: 0,
        totalPnl: trades.reduce((sum, t) => sum + t.pnl, 0),
        averagePnl: 0,
        
        // Métricas de risco
        maxDrawdown: 0,
        maxDrawdownDuration: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        var95: 0,
        
        // Métricas de performance
        profitFactor: 0,
        expectancy: 0,
        averageWin: 0,
        averageLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        
        // Métricas de consistência
        consecutiveWins: 0,
        consecutiveLosses: 0,
        winStreakProbability: 0,
        lossStreakProbability: 0,
        
        // Métricas de timing
        averageTradeDuration: 0,
        tradesPerDay: 0,
        bestTradingDay: '',
        worstTradingDay: '',
        
        // Métricas por símbolo
        symbolPerformance: {},
        
        // Métricas por algoritmo
        algorithmPerformance: {},
        
        // Análise temporal
        monthlyReturns: [],
        weeklyReturns: [],
        dailyReturns: [],
        
        // Equity curve
        equityCurve: [],
        
        // Análise de confiança
        confidenceAnalysis: {
          highConfidenceTrades: 0,
          mediumConfidenceTrades: 0,
          lowConfidenceTrades: 0,
          confidenceVsWinRate: []
        }
      };

      // Calcular métricas básicas
      metrics.winRate = (metrics.winningTrades / metrics.totalTrades) * 100;
      metrics.averagePnl = metrics.totalPnl / metrics.totalTrades;

      // Calcular métricas de risco
      await this.calculateRiskMetrics(metrics, trades, equityData);

      // Calcular métricas de performance
      this.calculatePerformanceMetrics(metrics, trades);

      // Calcular métricas de consistência
      this.calculateConsistencyMetrics(metrics, trades);

      // Calcular métricas de timing
      this.calculateTimingMetrics(metrics, trades);

      // Calcular métricas por símbolo e algoritmo
      this.calculateSymbolAndAlgorithmMetrics(metrics, trades);

      // Calcular análise temporal
      this.calculateTemporalAnalysis(metrics, trades, equityData);

      // Calcular equity curve
      this.calculateEquityCurve(metrics, equityData);

      // Calcular análise de confiança
      this.calculateConfidenceAnalysis(metrics, trades);

      console.log('✅ AdvancedStatisticsService: Analysis completed');
      return metrics;

    } catch (error) {
      console.error('❌ AdvancedStatisticsService: Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Calcula métricas de risco
   */
  private async calculateRiskMetrics(metrics: AdvancedMetrics, trades: TradeData[], equityData: EquityData[]) {
    // Max Drawdown
    const equityValues = equityData.map(e => e.equity);
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let peak = equityValues[0];
    let peakIndex = 0;
    
    for (let i = 1; i < equityValues.length; i++) {
      if (equityValues[i] > peak) {
        peak = equityValues[i];
        peakIndex = i;
      }
      const drawdown = ((peak - equityValues[i]) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownDuration = i - peakIndex;
      }
    }

    metrics.maxDrawdown = maxDrawdown;
    metrics.maxDrawdownDuration = maxDrawdownDuration;

    // Sharpe Ratio
    const returns = this.calculateDailyReturns(equityData);
    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r.return, 0) / returns.length : 0;
    const returnStdDev = this.calculateStandardDeviation(returns.map(r => r.return));
    metrics.sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;

    // Sortino Ratio (considerando apenas retornos negativos)
    const negativeReturns = returns.filter(r => r.return < 0).map(r => r.return);
    const downsideDeviation = this.calculateStandardDeviation(negativeReturns);
    metrics.sortinoRatio = downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;

    // Calmar Ratio
    const annualizedReturn = avgReturn * 365; // Aproximação
    metrics.calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    // Value at Risk 95%
    const sortedReturns = returns.map(r => r.return).sort((a, b) => a - b);
    const varIndex = Math.floor(sortedReturns.length * 0.05);
    metrics.var95 = sortedReturns[varIndex] || 0;
  }

  /**
   * Calcula métricas de performance
   */
  private calculatePerformanceMetrics(metrics: AdvancedMetrics, trades: TradeData[]) {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    // Profit Factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    metrics.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    // Expectancy
    const winProbability = metrics.winRate / 100;
    const lossProbability = 1 - winProbability;
    metrics.expectancy = winProbability * (grossProfit / winningTrades.length) - 
                        lossProbability * (grossLoss / losingTrades.length);

    // Average Win/Loss
    metrics.averageWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    metrics.averageLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

    // Largest Win/Loss
    metrics.largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
    metrics.largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;
  }

  /**
   * Calcula métricas de consistência
   */
  private calculateConsistencyMetrics(metrics: AdvancedMetrics, trades: TradeData[]) {
    const sortedTrades = trades.sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());
    
    let currentConsecutiveWins = 0;
    let currentConsecutiveLosses = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;

    for (const trade of sortedTrades) {
      if (trade.pnl > 0) {
        currentConsecutiveWins++;
        currentConsecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentConsecutiveWins);
      } else {
        currentConsecutiveLosses++;
        currentConsecutiveWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
      }
    }

    metrics.consecutiveWins = maxConsecutiveWins;
    metrics.consecutiveLosses = maxConsecutiveLosses;

    // Probabilidades de streak (simplificado)
    const winRate = metrics.winRate / 100;
    metrics.winStreakProbability = Math.pow(winRate, 3); // Probabilidade de 3 wins consecutivos
    metrics.lossStreakProbability = Math.pow(1 - winRate, 3); // Probabilidade de 3 losses consecutivos
  }

  /**
   * Calcula métricas de timing
   */
  private calculateTimingMetrics(metrics: AdvancedMetrics, trades: TradeData[]) {
    const tradeDurations = trades.map(trade => {
      const opened = new Date(trade.opened_at);
      const closed = new Date(trade.closed_at!);
      return closed.getTime() - opened.getTime();
    });

    metrics.averageTradeDuration = tradeDurations.length > 0 ? 
      tradeDurations.reduce((sum, d) => sum + d, 0) / tradeDurations.length : 0;

    // Trades por dia
    const firstTrade = new Date(Math.min(...trades.map(t => new Date(t.opened_at).getTime())));
    const lastTrade = new Date(Math.max(...trades.map(t => new Date(t.closed_at!).getTime())));
    const daysDiff = (lastTrade.getTime() - firstTrade.getTime()) / (1000 * 60 * 60 * 24);
    metrics.tradesPerDay = daysDiff > 0 ? trades.length / daysDiff : 0;

    // Melhor e pior dia de trading
    const dailyPnl = this.calculateDailyPnl(trades);
    if (dailyPnl.length > 0) {
      const bestDay = dailyPnl.reduce((max, day) => day.pnl > max.pnl ? day : max);
      const worstDay = dailyPnl.reduce((min, day) => day.pnl < min.pnl ? day : min);
      metrics.bestTradingDay = bestDay.date;
      metrics.worstTradingDay = worstDay.date;
    }
  }

  /**
   * Calcula métricas por símbolo e algoritmo
   */
  private calculateSymbolAndAlgorithmMetrics(metrics: AdvancedMetrics, trades: TradeData[]) {
    // Por símbolo
    const symbolGroups = trades.reduce((groups, trade) => {
      if (!groups[trade.symbol]) {
        groups[trade.symbol] = [];
      }
      groups[trade.symbol].push(trade);
      return groups;
    }, {} as Record<string, TradeData[]>);

    for (const [symbol, symbolTrades] of Object.entries(symbolGroups)) {
      const wins = symbolTrades.filter(t => t.pnl > 0).length;
      const pnl = symbolTrades.reduce((sum, t) => sum + t.pnl, 0);
      const avgConfidence = symbolTrades.reduce((sum, t) => sum + t.confidence, 0) / symbolTrades.length;

      metrics.symbolPerformance[symbol] = {
        trades: symbolTrades.length,
        winRate: (wins / symbolTrades.length) * 100,
        pnl,
        avgConfidence
      };
    }

    // Por algoritmo
    const algorithmGroups = trades.reduce((groups, trade) => {
      if (!groups[trade.algorithm]) {
        groups[trade.algorithm] = [];
      }
      groups[trade.algorithm].push(trade);
      return groups;
    }, {} as Record<string, TradeData[]>);

    for (const [algorithm, algorithmTrades] of Object.entries(algorithmGroups)) {
      const wins = algorithmTrades.filter(t => t.pnl > 0).length;
      const pnl = algorithmTrades.reduce((sum, t) => sum + t.pnl, 0);
      const avgConfidence = algorithmTrades.reduce((sum, t) => sum + t.confidence, 0) / algorithmTrades.length;

      metrics.algorithmPerformance[algorithm] = {
        trades: algorithmTrades.length,
        winRate: (wins / algorithmTrades.length) * 100,
        pnl,
        avgConfidence
      };
    }
  }

  /**
   * Calcula análise temporal
   */
  private calculateTemporalAnalysis(metrics: AdvancedMetrics, trades: TradeData[], equityData: EquityData[]) {
    // Retornos diários
    metrics.dailyReturns = this.calculateDailyReturns(equityData).map(item => ({ ...item, trades: 0 }));

    // Retornos semanais
    metrics.weeklyReturns = this.calculateWeeklyReturns(equityData);

    // Retornos mensais
    metrics.monthlyReturns = this.calculateMonthlyReturns(equityData);
  }

  /**
   * Calcula equity curve
   */
  private calculateEquityCurve(metrics: AdvancedMetrics, equityData: EquityData[]) {
    const equityValues = equityData.map(e => e.equity);
    let peak = equityValues[0];

    metrics.equityCurve = equityData.map((equity, index) => {
      if (equityValues[index] > peak) {
        peak = equityValues[index];
      }
      const drawdown = ((peak - equityValues[index]) / peak) * 100;
      
      return {
        timestamp: equity.timestamp,
        equity: equity.equity,
        drawdown
      };
    });
  }

  /**
   * Calcula análise de confiança
   */
  private calculateConfidenceAnalysis(metrics: AdvancedMetrics, trades: TradeData[]) {
    const highConfidenceTrades = trades.filter(t => t.confidence >= 70);
    const mediumConfidenceTrades = trades.filter(t => t.confidence >= 50 && t.confidence < 70);
    const lowConfidenceTrades = trades.filter(t => t.confidence < 50);

    metrics.confidenceAnalysis.highConfidenceTrades = highConfidenceTrades.length;
    metrics.confidenceAnalysis.mediumConfidenceTrades = mediumConfidenceTrades.length;
    metrics.confidenceAnalysis.lowConfidenceTrades = lowConfidenceTrades.length;

    // Análise de confiança vs win rate
    const confidenceRanges = [
      { min: 0, max: 30, label: '0-30%' },
      { min: 30, max: 50, label: '30-50%' },
      { min: 50, max: 70, label: '50-70%' },
      { min: 70, max: 100, label: '70-100%' }
    ];

    metrics.confidenceAnalysis.confidenceVsWinRate = confidenceRanges.map(range => {
      const rangeTrades = trades.filter(t => t.confidence >= range.min && t.confidence < range.max);
      const wins = rangeTrades.filter(t => t.pnl > 0).length;
      const winRate = rangeTrades.length > 0 ? (wins / rangeTrades.length) * 100 : 0;

      return {
        confidence: (range.min + range.max) / 2,
        winRate
      };
    });
  }

  /**
   * Gera recomendações de otimização
   */
  public generateOptimizationRecommendations(metrics: AdvancedMetrics): StrategyOptimization {
    const recommendations: Record<string, any> = {};
    let expectedImprovement = 0;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let confidence = 0;

    // Análise de Win Rate
    if (metrics.winRate < 40) {
      recommendations.minConfidence = 50; // Aumentar confiança mínima
      recommendations.positionSizing = 'conservative';
      expectedImprovement += 15;
      riskLevel = 'HIGH';
    } else if (metrics.winRate > 70) {
      recommendations.positionSizing = 'aggressive';
      recommendations.maxDailyTrades = 10;
      expectedImprovement += 10;
      riskLevel = 'LOW';
    }

    // Análise de Drawdown
    if (metrics.maxDrawdown > 15) {
      recommendations.stopLossPercentage = 1.0; // Reduzir stop loss
      recommendations.maxConcurrentPositions = 1;
      recommendations.positionSizing = 'conservative';
      expectedImprovement += 20;
      riskLevel = 'HIGH';
    }

    // Análise de Sharpe Ratio
    if (metrics.sharpeRatio < 1.0) {
      recommendations.riskManagement = 'improved';
      recommendations.takeProfitPercentage = 2.5; // Melhorar risk/reward
      expectedImprovement += 12;
    }

    // Análise de Profit Factor
    if (metrics.profitFactor < 1.2) {
      recommendations.takeProfitPercentage = 3.0;
      recommendations.stopLossPercentage = 1.5;
      expectedImprovement += 18;
    }

    // Análise de consistência
    if (metrics.consecutiveLosses > 5) {
      recommendations.circuitBreaker = true;
      recommendations.maxConsecutiveLosses = 3;
      expectedImprovement += 25;
      riskLevel = 'HIGH';
    }

    // Calcular confiança das recomendações
    confidence = Math.min(95, 60 + (metrics.totalTrades / 10) * 2);

    return {
      currentSettings: {
        minConfidence: 30,
        positionSizing: 'moderate',
        stopLossPercentage: 1.5,
        takeProfitPercentage: 3.0,
        maxConcurrentPositions: 2,
        maxDailyTrades: 400
      },
      recommendedSettings: recommendations,
      expectedImprovement,
      riskLevel,
      confidence
    };
  }

  // Métodos auxiliares
  private getEmptyMetrics(): AdvancedMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnl: 0,
      averagePnl: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      var95: 0,
      profitFactor: 0,
      expectancy: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      winStreakProbability: 0,
      lossStreakProbability: 0,
      averageTradeDuration: 0,
      tradesPerDay: 0,
      bestTradingDay: '',
      worstTradingDay: '',
      symbolPerformance: {},
      algorithmPerformance: {},
      monthlyReturns: [],
      weeklyReturns: [],
      dailyReturns: [],
      equityCurve: [],
      confidenceAnalysis: {
        highConfidenceTrades: 0,
        mediumConfidenceTrades: 0,
        lowConfidenceTrades: 0,
        confidenceVsWinRate: []
      }
    };
  }

  private async getClosedTrades(): Promise<TradeData[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'closed')
      .order('closed_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private async getEquityData(): Promise<EquityData[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('equity_history')
      .select('*')
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private calculateDailyReturns(equityData: EquityData[]) {
    const returns = [];
    for (let i = 1; i < equityData.length; i++) {
      const prevEquity = equityData[i - 1].equity;
      const currentEquity = equityData[i].equity;
      const dailyReturn = ((currentEquity - prevEquity) / prevEquity) * 100;
      returns.push({
        date: equityData[i].timestamp.split('T')[0],
        return: dailyReturn
      });
    }
    return returns;
  }

  private calculateWeeklyReturns(equityData: EquityData[]) {
    // Implementação simplificada - agrupar por semana
    const weeklyData = new Map<string, {equity: number, count: number}>();
    
    equityData.forEach(equity => {
      const week = this.getWeekKey(equity.timestamp);
      if (!weeklyData.has(week)) {
        weeklyData.set(week, { equity: 0, count: 0 });
      }
      const weekData = weeklyData.get(week)!;
      weekData.equity += equity.equity;
      weekData.count += 1;
    });

    const weeklyReturns = [];
    const sortedWeeks = Array.from(weeklyData.keys()).sort();
    
    for (let i = 1; i < sortedWeeks.length; i++) {
      const prevWeek = weeklyData.get(sortedWeeks[i - 1])!;
      const currentWeek = weeklyData.get(sortedWeeks[i])!;
      const prevAvgEquity = prevWeek.equity / prevWeek.count;
      const currentAvgEquity = currentWeek.equity / currentWeek.count;
      const weeklyReturn = ((currentAvgEquity - prevAvgEquity) / prevAvgEquity) * 100;
      
      weeklyReturns.push({
        week: sortedWeeks[i],
        return: weeklyReturn,
        trades: 0 // Simplificado
      });
    }

    return weeklyReturns;
  }

  private calculateMonthlyReturns(equityData: EquityData[]) {
    // Implementação simplificada - agrupar por mês
    const monthlyData = new Map<string, {equity: number, count: number}>();
    
    equityData.forEach(equity => {
      const month = equity.timestamp.substring(0, 7); // YYYY-MM
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { equity: 0, count: 0 });
      }
      const monthData = monthlyData.get(month)!;
      monthData.equity += equity.equity;
      monthData.count += 1;
    });

    const monthlyReturns = [];
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    
    for (let i = 1; i < sortedMonths.length; i++) {
      const prevMonth = monthlyData.get(sortedMonths[i - 1])!;
      const currentMonth = monthlyData.get(sortedMonths[i])!;
      const prevAvgEquity = prevMonth.equity / prevMonth.count;
      const currentAvgEquity = currentMonth.equity / currentMonth.count;
      const monthlyReturn = ((currentAvgEquity - prevAvgEquity) / prevAvgEquity) * 100;
      
      monthlyReturns.push({
        month: sortedMonths[i],
        return: monthlyReturn,
        trades: 0 // Simplificado
      });
    }

    return monthlyReturns;
  }

  private calculateDailyPnl(trades: TradeData[]) {
    const dailyPnl = new Map<string, number>();
    
    trades.forEach(trade => {
      const date = trade.closed_at!.split('T')[0];
      if (!dailyPnl.has(date)) {
        dailyPnl.set(date, 0);
      }
      dailyPnl.set(date, dailyPnl.get(date)! + trade.pnl);
    });

    return Array.from(dailyPnl.entries()).map(([date, pnl]) => ({ date, pnl }));
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  private getWeekKey(timestamp: string): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const week = Math.ceil(((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
    return `${year}-W${week}`;
  }
}

export const advancedStatisticsService = new AdvancedStatisticsService();
