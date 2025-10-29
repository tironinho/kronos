import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger, logTrading, logPerformance } from './logger';

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  strategy: string;
  parameters: Record<string, any>;
  commission: number;
  slippage: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  equityCurve: Array<{ date: string; equity: number; drawdown: number }>;
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    profitFactor: number;
    sharpeRatio: number;
    calmarRatio: number;
    sortinoRatio: number;
    averageTradeDuration: number;
    tradesPerDay: number;
  };
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    beta: number;
    alpha: number;
    informationRatio: number;
  };
  riskMetrics: {
    var95: number;
    var99: number;
    cvar95: number;
    cvar99: number;
    maxConsecutiveLosses: number;
    maxConsecutiveWins: number;
    recoveryFactor: number;
  };
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTime: string;
  exitTime: string;
  duration: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  slippage: number;
  netPnL: number;
  reason: string;
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  grossPnL: number;
  netPnL: number;
  totalCommission: number;
  totalSlippage: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number;
  averageTradeDuration: number;
  tradesPerDay: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  equityCurve: Array<{ date: string; equity: number; drawdown: number }>;
}

export interface OptimizationResult {
  bestParameters: Record<string, any>;
  bestMetrics: BacktestMetrics;
  parameterSweep: Array<{
    parameters: Record<string, any>;
    metrics: BacktestMetrics;
    score: number;
  }>;
  optimizationScore: number;
}

/**
 * ✅ MÓDULO DE BACKTESTING AUTOMATIZADO
 * Objetivo: Testar estratégias em dados históricos para validar eficácia
 */
export class AutomatedBacktestingModule {
  private supabase: SupabaseClient | null = null;

  constructor() {
    this.initializeSupabase();
  }

  private initializeSupabase() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        logger.warn('⚠️ AutomatedBacktestingModule: Supabase credentials not found', 'PERFORMANCE');
        this.supabase = null;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      logger.info('✅ AutomatedBacktestingModule: Supabase initialized', 'PERFORMANCE');
    } catch (error) {
      logger.error('❌ AutomatedBacktestingModule: Failed to initialize Supabase:', 'PERFORMANCE', null, error);
      this.supabase = null;
    }
  }

  /**
   * ✅ FUNÇÃO PRINCIPAL: Executar backtest
   */
  public async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    try {
      logPerformance(`🧪 Iniciando backtest para ${config.symbol}...`, { config });

      // 1. Obter dados históricos
      const historicalData = await this.getHistoricalData(config);
      
      if (historicalData.length === 0) {
        throw new Error('Nenhum dado histórico encontrado');
      }

      // 2. Executar simulação da estratégia
      const trades = await this.simulateStrategy(config, historicalData);
      
      // 3. Calcular métricas
      const metrics = this.calculateMetrics(trades, config.initialCapital);
      
      // 4. Gerar curva de equity
      const equityCurve = this.generateEquityCurve(trades, config.initialCapital);
      
      // 5. Calcular métricas de performance
      const performance = this.calculatePerformanceMetrics(trades, config.initialCapital);
      
      // 6. Calcular métricas de risco
      const riskMetrics = this.calculateRiskMetrics(trades, config.initialCapital);

      const result: BacktestResult = {
        config,
        trades,
        metrics,
        equityCurve,
        summary: {
          totalTrades: metrics.totalTrades,
          winningTrades: metrics.winningTrades,
          losingTrades: metrics.losingTrades,
          winRate: metrics.winRate,
          totalPnL: metrics.netPnL,
          maxDrawdown: metrics.maxDrawdown,
          maxDrawdownPercent: metrics.maxDrawdownPercent,
          profitFactor: metrics.profitFactor,
          sharpeRatio: metrics.sharpeRatio,
          calmarRatio: metrics.calmarRatio,
          sortinoRatio: metrics.sortinoRatio,
          averageTradeDuration: metrics.averageTradeDuration,
          tradesPerDay: metrics.tradesPerDay
        },
        performance,
        riskMetrics
      };

      // 7. Salvar resultado no banco de dados
      await this.saveBacktestResult(result);

      logPerformance('✅ Backtest concluído', {
        totalTrades: result.summary.totalTrades,
        winRate: result.summary.winRate,
        totalPnL: result.summary.totalPnL,
        maxDrawdown: result.summary.maxDrawdownPercent
      });

      return result;
    } catch (error) {
      logger.error(`❌ Erro no backtest para ${config.symbol}:`, 'PERFORMANCE', null, error);
      throw error;
    }
  }

  /**
   * ✅ Obter dados históricos
   */
  private async getHistoricalData(config: BacktestConfig): Promise<any[]> {
    // Simular dados históricos (em implementação real, buscar de API)
    const data: any[] = [];
    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    
    // Gerar dados simulados para demonstração
    let currentDate = new Date(startDate);
    let price = 50000; // Preço inicial simulado
    
    while (currentDate <= endDate) {
      // Simular movimento de preço
      const change = (Math.random() - 0.5) * 0.02; // ±1% por período
      price *= (1 + change);
      
      data.push({
        timestamp: currentDate.toISOString(),
        open: price * 0.999,
        high: price * 1.001,
        low: price * 0.998,
        close: price,
        volume: Math.random() * 1000000
      });
      
      // Avançar para próximo período
      if (config.timeframe === '1h') {
        currentDate.setHours(currentDate.getHours() + 1);
      } else if (config.timeframe === '1d') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else {
        currentDate.setMinutes(currentDate.getMinutes() + 15); // 15min default
      }
    }
    
    return data;
  }

  /**
   * ✅ Simular estratégia
   */
  private async simulateStrategy(config: BacktestConfig, data: any[]): Promise<BacktestTrade[]> {
    const trades: BacktestTrade[] = [];
    let position: BacktestTrade | null = null;
    let tradeId = 1;
    
    for (let i = 1; i < data.length; i++) {
      const currentData = data[i];
      const previousData = data[i - 1];
      
      // Lógica simplificada de estratégia
      const signal = this.generateSignal(currentData, previousData, config.parameters);
      
      if (signal === 'BUY' && !position) {
        // Abrir posição de compra
        position = {
          id: `trade_${tradeId++}`,
          symbol: config.symbol,
          side: 'BUY',
          entryPrice: currentData.close,
          exitPrice: 0,
          quantity: config.initialCapital / currentData.close,
          entryTime: currentData.timestamp,
          exitTime: '',
          duration: 0,
          pnl: 0,
          pnlPercent: 0,
          commission: 0,
          slippage: 0,
          netPnL: 0,
          reason: 'Signal generated'
        };
      } else if (signal === 'SELL' && position) {
        // Fechar posição
        const exitPrice = currentData.close;
        const duration = new Date(currentData.timestamp).getTime() - new Date(position.entryTime).getTime();
        const pnl = (exitPrice - position.entryPrice) * position.quantity;
        const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
        const commission = (position.entryPrice * position.quantity + exitPrice * position.quantity) * config.commission;
        const slippage = (position.entryPrice + exitPrice) * position.quantity * config.slippage;
        const netPnL = pnl - commission - slippage;
        
        position.exitPrice = exitPrice;
        position.exitTime = currentData.timestamp;
        position.duration = duration;
        position.pnl = pnl;
        position.pnlPercent = pnlPercent;
        position.commission = commission;
        position.slippage = slippage;
        position.netPnL = netPnL;
        position.reason = 'Exit signal';
        
        trades.push(position);
        position = null;
      }
    }
    
    // Fechar posição aberta no final
    if (position) {
      const lastData = data[data.length - 1];
      const exitPrice = lastData.close;
      const duration = new Date(lastData.timestamp).getTime() - new Date(position.entryTime).getTime();
      const pnl = (exitPrice - position.entryPrice) * position.quantity;
      const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
      const commission = (position.entryPrice * position.quantity + exitPrice * position.quantity) * config.commission;
      const slippage = (position.entryPrice + exitPrice) * position.quantity * config.slippage;
      const netPnL = pnl - commission - slippage;
      
      position.exitPrice = exitPrice;
      position.exitTime = lastData.timestamp;
      position.duration = duration;
      position.pnl = pnl;
      position.pnlPercent = pnlPercent;
      position.commission = commission;
      position.slippage = slippage;
      position.netPnL = netPnL;
      position.reason = 'End of data';
      
      trades.push(position);
    }
    
    return trades;
  }

  /**
   * ✅ Gerar sinal de trading
   */
  private generateSignal(currentData: any, previousData: any, parameters: Record<string, any>): 'BUY' | 'SELL' | 'HOLD' {
    // Estratégia simplificada baseada em momentum
    const priceChange = (currentData.close - previousData.close) / previousData.close;
    const volumeRatio = currentData.volume / previousData.volume;
    
    // Parâmetros da estratégia
    const momentumThreshold = parameters.momentumThreshold || 0.01;
    const volumeThreshold = parameters.volumeThreshold || 1.2;
    
    if (priceChange > momentumThreshold && volumeRatio > volumeThreshold) {
      return 'BUY';
    } else if (priceChange < -momentumThreshold && volumeRatio > volumeThreshold) {
      return 'SELL';
    }
    
    return 'HOLD';
  }

  /**
   * ✅ Calcular métricas do backtest
   */
  private calculateMetrics(trades: BacktestTrade[], initialCapital: number): BacktestMetrics {
    if (trades.length === 0) {
      return this.getEmptyMetrics();
    }

    const winningTrades = trades.filter(t => t.netPnL > 0);
    const losingTrades = trades.filter(t => t.netPnL < 0);
    
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const netPnL = trades.reduce((sum, t) => sum + t.netPnL, 0);
    const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);
    const totalSlippage = trades.reduce((sum, t) => sum + t.slippage, 0);
    
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const averageWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.netPnL, 0) / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnL, 0)) / losingTrades.length : 0;
    
    const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.netPnL)) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.netPnL)) : 0;
    
    const profitFactor = totalSlippage + totalCommission > 0 ? 
      (totalPnL - totalCommission - totalSlippage) / (totalCommission + totalSlippage) : 
      totalPnL > 0 ? Infinity : 0;
    
    // Calcular Sharpe Ratio
    const returns = trades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;
    
    // Calcular Sortino Ratio
    const negativeReturns = returns.filter(r => r < 0);
    const downsideStdDev = negativeReturns.length > 0 ? 
      Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length) : 0;
    const sortinoRatio = downsideStdDev > 0 ? avgReturn / downsideStdDev : 0;
    
    // Calcular drawdown
    const equityCurve = this.generateEquityCurve(trades, initialCapital);
    const maxDrawdown = this.calculateMaxDrawdown(equityCurve);
    
    // Calcular Calmar Ratio
    const totalReturn = (initialCapital + netPnL) / initialCapital - 1;
    const calmarRatio = maxDrawdown.percent > 0 ? totalReturn / (maxDrawdown.percent / 100) : 0;
    
    // Calcular duração média
    const averageTradeDuration = trades.reduce((sum, t) => sum + t.duration, 0) / trades.length;
    
    // Calcular trades por dia
    const firstTrade = trades[0];
    const lastTrade = trades[trades.length - 1];
    const daysDiff = (new Date(lastTrade.exitTime).getTime() - new Date(firstTrade.entryTime).getTime()) / (1000 * 60 * 60 * 24);
    const tradesPerDay = daysDiff > 0 ? trades.length / daysDiff : 0;
    
    // Calcular sequências
    const consecutiveWins = this.calculateConsecutiveWins(trades);
    const consecutiveLosses = this.calculateConsecutiveLosses(trades);

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalPnL,
      grossPnL: totalPnL,
      netPnL,
      totalCommission,
      totalSlippage,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown: maxDrawdown.amount,
      maxDrawdownPercent: maxDrawdown.percent,
      maxDrawdownDuration: maxDrawdown.duration,
      averageTradeDuration,
      tradesPerDay,
      consecutiveWins,
      consecutiveLosses,
      equityCurve
    };
  }

  /**
   * ✅ Gerar curva de equity
   */
  private generateEquityCurve(trades: BacktestTrade[], initialCapital: number): Array<{ date: string; equity: number; drawdown: number }> {
    let runningPnL = 0;
    let maxEquity = initialCapital;
    const curve: Array<{ date: string; equity: number; drawdown: number }> = [];
    
    trades.forEach(trade => {
      runningPnL += trade.netPnL;
      const currentEquity = initialCapital + runningPnL;
      
      if (currentEquity > maxEquity) {
        maxEquity = currentEquity;
      }
      
      const drawdown = maxEquity - currentEquity;
      
      curve.push({
        date: trade.exitTime,
        equity: currentEquity,
        drawdown
      });
    });
    
    return curve;
  }

  /**
   * ✅ Calcular máximo drawdown
   */
  private calculateMaxDrawdown(equityCurve: Array<{ date: string; equity: number; drawdown: number }>): { amount: number; percent: number; duration: number } {
    if (equityCurve.length === 0) return { amount: 0, percent: 0, duration: 0 };
    
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdownDuration = 0;
    let inDrawdown = false;
    
    equityCurve.forEach(point => {
      if (point.drawdown > maxDrawdown) {
        maxDrawdown = point.drawdown;
        maxDrawdownPercent = point.equity > 0 ? (point.drawdown / point.equity) * 100 : 0;
      }
      
      if (point.drawdown > 0) {
        if (!inDrawdown) {
          inDrawdown = true;
          currentDrawdownDuration = 0;
        }
        currentDrawdownDuration++;
        maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
      } else {
        inDrawdown = false;
        currentDrawdownDuration = 0;
      }
    });
    
    return { amount: maxDrawdown, percent: maxDrawdownPercent, duration: maxDrawdownDuration };
  }

  /**
   * ✅ Calcular sequência de vitórias
   */
  private calculateConsecutiveWins(trades: BacktestTrade[]): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    
    trades.forEach(trade => {
      if (trade.netPnL > 0) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    });
    
    return maxConsecutive;
  }

  /**
   * ✅ Calcular sequência de perdas
   */
  private calculateConsecutiveLosses(trades: BacktestTrade[]): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    
    trades.forEach(trade => {
      if (trade.netPnL < 0) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    });
    
    return maxConsecutive;
  }

  /**
   * ✅ Calcular métricas de performance
   */
  private calculatePerformanceMetrics(trades: BacktestTrade[], initialCapital: number): any {
    const netPnL = trades.reduce((sum, t) => sum + t.netPnL, 0);
    const totalReturn = (initialCapital + netPnL) / initialCapital - 1;
    
    // Calcular retorno anualizado
    const firstTrade = trades[0];
    const lastTrade = trades[trades.length - 1];
    const daysDiff = (new Date(lastTrade.exitTime).getTime() - new Date(firstTrade.entryTime).getTime()) / (1000 * 60 * 60 * 24);
    const years = daysDiff / 365;
    const annualizedReturn = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
    
    // Calcular volatilidade
    const returns = trades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    
    return {
      totalReturn,
      annualizedReturn,
      volatility,
      beta: 1.0, // Simplificado
      alpha: 0, // Simplificado
      informationRatio: 0 // Simplificado
    };
  }

  /**
   * ✅ Calcular métricas de risco
   */
  private calculateRiskMetrics(trades: BacktestTrade[], initialCapital: number): any {
    const returns = trades.map(t => t.pnlPercent);
    
    // Calcular VaR (Value at Risk)
    const sortedReturns = returns.sort((a, b) => a - b);
    const var95Index = Math.floor(sortedReturns.length * 0.05);
    const var99Index = Math.floor(sortedReturns.length * 0.01);
    
    const var95 = sortedReturns[var95Index] || 0;
    const var99 = sortedReturns[var99Index] || 0;
    
    // Calcular CVaR (Conditional Value at Risk)
    const cvar95Returns = sortedReturns.slice(0, var95Index + 1);
    const cvar99Returns = sortedReturns.slice(0, var99Index + 1);
    
    const cvar95 = cvar95Returns.length > 0 ? cvar95Returns.reduce((sum, r) => sum + r, 0) / cvar95Returns.length : 0;
    const cvar99 = cvar99Returns.length > 0 ? cvar99Returns.reduce((sum, r) => sum + r, 0) / cvar99Returns.length : 0;
    
    // Calcular Recovery Factor
    const maxDrawdown = this.calculateMaxDrawdown(this.generateEquityCurve(trades, initialCapital));
    const netPnL = trades.reduce((sum, t) => sum + t.netPnL, 0);
    const recoveryFactor = maxDrawdown.amount > 0 ? netPnL / maxDrawdown.amount : 0;
    
    return {
      var95,
      var99,
      cvar95,
      cvar99,
      maxConsecutiveLosses: this.calculateConsecutiveLosses(trades),
      maxConsecutiveWins: this.calculateConsecutiveWins(trades),
      recoveryFactor
    };
  }

  /**
   * ✅ Salvar resultado do backtest
   */
  private async saveBacktestResult(result: BacktestResult): Promise<void> {
    if (!this.supabase) return;

    try {
      const { error } = await this.supabase
        .from('backtest_results')
        .insert({
          symbol: result.config.symbol,
          timeframe: result.config.timeframe,
          start_date: result.config.startDate,
          end_date: result.config.endDate,
          initial_capital: result.config.initialCapital,
          strategy: result.config.strategy,
          parameters: result.config.parameters,
          total_trades: result.summary.totalTrades,
          win_rate: result.summary.winRate,
          total_pnl: result.summary.totalPnL,
          max_drawdown: result.summary.maxDrawdownPercent,
          profit_factor: result.summary.profitFactor,
          sharpe_ratio: result.summary.sharpeRatio,
          calmar_ratio: result.summary.calmarRatio,
          sortino_ratio: result.summary.sortinoRatio,
          trades_per_day: result.summary.tradesPerDay,
          equity_curve: result.equityCurve,
          trades_data: result.trades,
          algorithm: 'AutomatedBacktestingModule',
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('❌ Erro ao salvar resultado do backtest:', 'PERFORMANCE', null, error);
      } else {
        logPerformance('✅ Resultado do backtest salvo no banco de dados');
      }
    } catch (error) {
      logger.error('❌ Erro ao salvar resultado do backtest:', 'PERFORMANCE', null, error);
    }
  }

  /**
   * ✅ Otimizar parâmetros da estratégia
   */
  public async optimizeStrategy(
    baseConfig: BacktestConfig,
    parameterRanges: Record<string, any[]>
  ): Promise<OptimizationResult | null> {
    try {
      logPerformance('🔧 Iniciando otimização de parâmetros...');

      const combinations = this.generateParameterCombinations(parameterRanges);
      const results: Array<{
        parameters: Record<string, any>;
        metrics: BacktestMetrics;
        score: number;
      }> = [];

      logPerformance(`📊 Testando ${combinations.length} combinações de parâmetros...`);

      for (const combination of combinations) {
        try {
          const config = { ...baseConfig, parameters: combination };
          const backtestResult = await this.runBacktest(config);
          
          const score = this.calculateOptimizationScore(backtestResult.metrics);
          
          results.push({
            parameters: combination,
            metrics: backtestResult.metrics,
            score
          });
        } catch (error) {
          logger.warn('⚠️ Erro ao testar combinação de parâmetros:', 'PERFORMANCE', null, error);
        }
      }

      if (results.length === 0) {
        logPerformance('⚠️ Nenhuma combinação válida encontrada');
        return null;
      }

      // Encontrar melhor resultado
      const bestResult = results.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      const optimizationResult: OptimizationResult = {
        bestParameters: bestResult.parameters,
        bestMetrics: bestResult.metrics,
        parameterSweep: results,
        optimizationScore: bestResult.score
      };

      logPerformance('✅ Otimização concluída', {
        bestScore: bestResult.score,
        winRate: bestResult.metrics.winRate,
        profitFactor: bestResult.metrics.profitFactor,
        maxDrawdown: bestResult.metrics.maxDrawdownPercent
      });

      return optimizationResult;
    } catch (error) {
      logger.error('❌ Erro na otimização de estratégia:', 'PERFORMANCE', null, error);
      return null;
    }
  }

  /**
   * ✅ Gerar combinações de parâmetros
   */
  private generateParameterCombinations(parameterRanges: Record<string, any[]>): Record<string, any>[] {
    const keys = Object.keys(parameterRanges);
    const combinations: Record<string, any>[] = [];
    
    function generateRecursive(index: number, current: Record<string, any>) {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }
      
      const key = keys[index];
      const values = parameterRanges[key];
      
      for (const value of values) {
        current[key] = value;
        generateRecursive(index + 1, current);
      }
    }
    
    generateRecursive(0, {});
    return combinations;
  }

  /**
   * ✅ Calcular score de otimização
   */
  private calculateOptimizationScore(metrics: BacktestMetrics): number {
    let score = 0;
    
    // Win Rate (peso 25%)
    score += (metrics.winRate / 100) * 25;
    
    // Profit Factor (peso 30%)
    score += Math.min(metrics.profitFactor / 2, 1) * 30;
    
    // Sharpe Ratio (peso 20%)
    score += Math.min(metrics.sharpeRatio / 2, 1) * 20;
    
    // Drawdown (peso 15%) - menor é melhor
    score += Math.max(0, (20 - metrics.maxDrawdownPercent) / 20) * 15;
    
    // Trades por dia (peso 10%) - mais trades = mais confiável
    score += Math.min(metrics.tradesPerDay / 10, 1) * 10;
    
    return score;
  }

  /**
   * ✅ Obter métricas vazias
   */
  private getEmptyMetrics(): BacktestMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      grossPnL: 0,
      netPnL: 0,
      totalCommission: 0,
      totalSlippage: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      maxDrawdownDuration: 0,
      averageTradeDuration: 0,
      tradesPerDay: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      equityCurve: []
    };
  }
}

export const automatedBacktestingModule = new AutomatedBacktestingModule();
export default AutomatedBacktestingModule;
