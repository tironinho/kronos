import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger, logTrading, logPerformance } from './logger';

export interface StrategyConfig {
  name: string;
  type: 'MOMENTUM' | 'MEAN_REVERSION' | 'BREAKOUT' | 'SCALPING' | 'SWING' | 'ARBITRAGE';
  timeframe: string;
  symbols: string[];
  parameters: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  maxPositionSize: number;
  maxConcurrentPositions: number;
  enabled: boolean;
  priority: number;
}

export interface DiversificationMetrics {
  totalStrategies: number;
  activeStrategies: number;
  strategyDistribution: Record<string, number>;
  correlationMatrix: Record<string, Record<string, number>>;
  riskConcentration: number;
  diversificationScore: number;
  portfolioVolatility: number;
  expectedReturn: number;
  sharpeRatio: number;
}

export interface StrategyPerformance {
  strategyName: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  tradesToday: number;
  activePositions: number;
  lastTrade: string;
  status: 'active' | 'paused' | 'disabled';
}

export interface PortfolioAllocation {
  strategyName: string;
  allocationPercent: number;
  currentAllocation: number;
  targetAllocation: number;
  rebalanceNeeded: boolean;
  reason: string;
}

export interface DiversificationRecommendation {
  type: 'ADD_STRATEGY' | 'REMOVE_STRATEGY' | 'REBALANCE' | 'ADJUST_PARAMETERS';
  priority: 'low' | 'medium' | 'high';
  description: string;
  expectedImpact: string;
  implementation: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * ✅ MÓDULO DE DIVERSIFICAÇÃO DE ESTRATÉGIAS
 * Objetivo: Implementar diversificação para evitar concentração excessiva
 */
export class StrategyDiversificationModule {
  private supabase: SupabaseClient | null = null;
  private strategies: StrategyConfig[] = [];
  private performance: Map<string, StrategyPerformance> = new Map();
  private allocations: Map<string, PortfolioAllocation> = new Map();

  constructor() {
    this.initializeSupabase();
    this.loadDefaultStrategies();
  }

  private initializeSupabase() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        logger.warn('⚠️ StrategyDiversificationModule: Supabase credentials not found', 'PERFORMANCE');
        this.supabase = null;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      logger.info('✅ StrategyDiversificationModule: Supabase initialized', 'PERFORMANCE');
    } catch (error) {
      logger.error('❌ StrategyDiversificationModule: Failed to initialize Supabase:', 'PERFORMANCE', null, error);
      this.supabase = null;
    }
  }

  /**
   * ✅ Carregar estratégias padrão
   */
  private loadDefaultStrategies(): void {
    this.strategies = [
      {
        name: 'Momentum Strategy',
        type: 'MOMENTUM',
        timeframe: '1h',
        symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
        parameters: {
          rsiPeriod: 14,
          rsiOverbought: 70,
          rsiOversold: 30,
          volumeThreshold: 1.2,
          minConfidence: 60
        },
        riskLevel: 'medium',
        maxPositionSize: 0.1,
        maxConcurrentPositions: 2,
        enabled: true,
        priority: 1
      },
      {
        name: 'Mean Reversion Strategy',
        type: 'MEAN_REVERSION',
        timeframe: '4h',
        symbols: ['BTCUSDT', 'ETHUSDT', 'XRPUSDT'],
        parameters: {
          bollingerPeriod: 20,
          bollingerStd: 2,
          rsiPeriod: 14,
          minConfidence: 55
        },
        riskLevel: 'low',
        maxPositionSize: 0.08,
        maxConcurrentPositions: 3,
        enabled: true,
        priority: 2
      },
      {
        name: 'Breakout Strategy',
        type: 'BREAKOUT',
        timeframe: '1h',
        symbols: ['SOLUSDT', 'DOGEUSDT', 'BNBUSDT'],
        parameters: {
          atrPeriod: 14,
          atrMultiplier: 2,
          volumeThreshold: 1.5,
          minConfidence: 65
        },
        riskLevel: 'high',
        maxPositionSize: 0.12,
        maxConcurrentPositions: 2,
        enabled: true,
        priority: 3
      },
      {
        name: 'Scalping Strategy',
        type: 'SCALPING',
        timeframe: '15m',
        symbols: ['BTCUSDT', 'ETHUSDT'],
        parameters: {
          emaFast: 9,
          emaSlow: 21,
          stopLoss: 0.5,
          takeProfit: 1.0,
          minConfidence: 70
        },
        riskLevel: 'high',
        maxPositionSize: 0.05,
        maxConcurrentPositions: 4,
        enabled: false,
        priority: 4
      }
    ];
  }

  /**
   * ✅ FUNÇÃO PRINCIPAL: Analisar diversificação atual
   */
  public async analyzeDiversification(): Promise<DiversificationMetrics> {
    try {
      logPerformance('📊 Analisando diversificação de estratégias...');

      // 1. Atualizar performance das estratégias
      await this.updateStrategyPerformance();
      
      // 2. Calcular métricas de diversificação
      const metrics = await this.calculateDiversificationMetrics();
      
      // 3. Gerar recomendações
      const recommendations = await this.generateDiversificationRecommendations(metrics);
      
      logPerformance('✅ Análise de diversificação concluída', {
        totalStrategies: metrics.totalStrategies,
        activeStrategies: metrics.activeStrategies,
        diversificationScore: metrics.diversificationScore,
        recommendations: recommendations.length
      });

      return metrics;
    } catch (error) {
      logger.error('❌ Erro na análise de diversificação:', 'PERFORMANCE', null, error);
      throw error;
    }
  }

  /**
   * ✅ Atualizar performance das estratégias
   */
  private async updateStrategyPerformance(): Promise<void> {
    if (!this.supabase) return;

    try {
      for (const strategy of this.strategies) {
        if (!strategy.enabled) continue;

        // Obter trades da estratégia
        const { data: trades } = await this.supabase
          .from('real_trades')
          .select('*')
          .eq('algorithm', strategy.name)
          .gte('opened_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 7 dias

        // Obter trades abertas
        const { data: openTrades } = await this.supabase
          .from('real_trades')
          .select('*')
          .eq('algorithm', strategy.name)
          .eq('status', 'open');

        // Calcular métricas de performance
        const performance = this.calculateStrategyPerformance(trades || [], openTrades || []);

        this.performance.set(strategy.name, performance);
      }
    } catch (error) {
      logger.error('❌ Erro ao atualizar performance das estratégias:', 'PERFORMANCE', null, error);
    }
  }

  /**
   * ✅ Calcular performance da estratégia
   */
  private calculateStrategyPerformance(trades: any[], openTrades: any[]): StrategyPerformance {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    // Calcular drawdown máximo
    const maxDrawdown = this.calculateMaxDrawdown(trades);
    
    // Calcular Sharpe Ratio
    const sharpeRatio = this.calculateSharpeRatio(trades);
    
    // Obter última trade
    const lastTrade = trades.length > 0 ? 
      trades.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())[0].opened_at : 
      'N/A';

    return {
      strategyName: trades[0]?.algorithm || 'Unknown',
      totalTrades: trades.length,
      winRate,
      totalPnL,
      maxDrawdown,
      sharpeRatio,
      tradesToday: trades.filter(t => 
        new Date(t.opened_at).toDateString() === new Date().toDateString()
      ).length,
      activePositions: openTrades.length,
      lastTrade,
      status: 'active'
    };
  }

  /**
   * ✅ Calcular máximo drawdown
   */
  private calculateMaxDrawdown(trades: any[]): number {
    if (trades.length === 0) return 0;

    let maxEquity = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    trades.forEach(trade => {
      runningPnL += trade.pnl || 0;
      const currentEquity = 1000 + runningPnL; // Assumir capital inicial de $1000
      
      if (currentEquity > maxEquity) {
        maxEquity = currentEquity;
      }
      
      const drawdown = maxEquity - currentEquity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  /**
   * ✅ Calcular Sharpe Ratio
   */
  private calculateSharpeRatio(trades: any[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.pnl_percent || 0);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);

    return returnStdDev > 0 ? avgReturn / returnStdDev : 0;
  }

  /**
   * ✅ Calcular métricas de diversificação
   */
  private async calculateDiversificationMetrics(): Promise<DiversificationMetrics> {
    const activeStrategies = this.strategies.filter(s => s.enabled);
    const totalStrategies = this.strategies.length;
    
    // Calcular distribuição de estratégias
    const strategyDistribution: Record<string, number> = {};
    activeStrategies.forEach(strategy => {
      strategyDistribution[strategy.type] = (strategyDistribution[strategy.type] || 0) + 1;
    });

    // Calcular matriz de correlação (simplificada)
    const correlationMatrix = this.calculateCorrelationMatrix(activeStrategies);

    // Calcular concentração de risco
    const riskConcentration = this.calculateRiskConcentration(activeStrategies);

    // Calcular score de diversificação
    const diversificationScore = this.calculateDiversificationScore(
      activeStrategies.length,
      strategyDistribution,
      riskConcentration
    );

    // Calcular volatilidade do portfólio
    const portfolioVolatility = this.calculatePortfolioVolatility(activeStrategies);

    // Calcular retorno esperado
    const expectedReturn = this.calculateExpectedReturn(activeStrategies);

    // Calcular Sharpe Ratio do portfólio
    const sharpeRatio = portfolioVolatility > 0 ? expectedReturn / portfolioVolatility : 0;

    return {
      totalStrategies,
      activeStrategies: activeStrategies.length,
      strategyDistribution,
      correlationMatrix,
      riskConcentration,
      diversificationScore,
      portfolioVolatility,
      expectedReturn,
      sharpeRatio
    };
  }

  /**
   * ✅ Calcular matriz de correlação
   */
  private calculateCorrelationMatrix(strategies: StrategyConfig[]): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};
    
    strategies.forEach(strategy1 => {
      matrix[strategy1.name] = {};
      strategies.forEach(strategy2 => {
        if (strategy1.name === strategy2.name) {
          matrix[strategy1.name][strategy2.name] = 1.0;
        } else {
          // Calcular correlação baseada em símbolos compartilhados
          const sharedSymbols = strategy1.symbols.filter(s => strategy2.symbols.includes(s));
          const correlation = sharedSymbols.length / Math.max(strategy1.symbols.length, strategy2.symbols.length);
          matrix[strategy1.name][strategy2.name] = correlation;
        }
      });
    });
    
    return matrix;
  }

  /**
   * ✅ Calcular concentração de risco
   */
  private calculateRiskConcentration(strategies: StrategyConfig[]): number {
    if (strategies.length === 0) return 0;

    const totalRisk = strategies.reduce((sum, s) => {
      const riskWeight = s.riskLevel === 'high' ? 3 : s.riskLevel === 'medium' ? 2 : 1;
      return sum + (s.maxPositionSize * riskWeight);
    }, 0);

    const maxRisk = Math.max(...strategies.map(s => {
      const riskWeight = s.riskLevel === 'high' ? 3 : s.riskLevel === 'medium' ? 2 : 1;
      return s.maxPositionSize * riskWeight;
    }));

    return totalRisk > 0 ? maxRisk / totalRisk : 0;
  }

  /**
   * ✅ Calcular score de diversificação
   */
  private calculateDiversificationScore(
    activeStrategies: number,
    distribution: Record<string, number>,
    riskConcentration: number
  ): number {
    let score = 0;

    // Pontuação por número de estratégias ativas
    if (activeStrategies >= 4) score += 30;
    else if (activeStrategies >= 3) score += 20;
    else if (activeStrategies >= 2) score += 10;

    // Pontuação por diversificação de tipos
    const strategyTypes = Object.keys(distribution).length;
    if (strategyTypes >= 4) score += 25;
    else if (strategyTypes >= 3) score += 20;
    else if (strategyTypes >= 2) score += 10;

    // Pontuação por baixa concentração de risco
    if (riskConcentration < 0.3) score += 25;
    else if (riskConcentration < 0.5) score += 15;
    else if (riskConcentration < 0.7) score += 5;

    // Pontuação por distribuição equilibrada
    const distributionValues = Object.values(distribution);
    const maxDistribution = Math.max(...distributionValues);
    const distributionRatio = maxDistribution / activeStrategies;
    
    if (distributionRatio < 0.4) score += 20;
    else if (distributionRatio < 0.6) score += 10;

    return Math.min(100, score);
  }

  /**
   * ✅ Calcular volatilidade do portfólio
   */
  private calculatePortfolioVolatility(strategies: StrategyConfig[]): number {
    if (strategies.length === 0) return 0;

    // Simplificado - em implementação real seria baseado em dados históricos
    const avgVolatility = strategies.reduce((sum, s) => {
      const baseVolatility = s.riskLevel === 'high' ? 0.3 : s.riskLevel === 'medium' ? 0.2 : 0.1;
      return sum + baseVolatility;
    }, 0) / strategies.length;

    return avgVolatility;
  }

  /**
   * ✅ Calcular retorno esperado
   */
  private calculateExpectedReturn(strategies: StrategyConfig[]): number {
    if (strategies.length === 0) return 0;

    // Simplificado - em implementação real seria baseado em dados históricos
    const avgReturn = strategies.reduce((sum, s) => {
      const baseReturn = s.riskLevel === 'high' ? 0.15 : s.riskLevel === 'medium' ? 0.10 : 0.05;
      return sum + baseReturn;
    }, 0) / strategies.length;

    return avgReturn;
  }

  /**
   * ✅ Gerar recomendações de diversificação
   */
  private async generateDiversificationRecommendations(metrics: DiversificationMetrics): Promise<DiversificationRecommendation[]> {
    const recommendations: DiversificationRecommendation[] = [];

    // Verificar número de estratégias ativas
    if (metrics.activeStrategies < 3) {
      recommendations.push({
        type: 'ADD_STRATEGY',
        priority: 'high',
        description: 'Poucas estratégias ativas - adicionar mais estratégias para melhor diversificação',
        expectedImpact: 'Redução de risco e aumento de oportunidades',
        implementation: [
          'Ativar estratégia de Scalping',
          'Implementar estratégia de Arbitragem',
          'Adicionar estratégia de Swing Trading'
        ],
        riskLevel: 'low'
      });
    }

    // Verificar concentração de risco
    if (metrics.riskConcentration > 0.6) {
      recommendations.push({
        type: 'REBALANCE',
        priority: 'high',
        description: 'Alta concentração de risco - rebalancear alocações',
        expectedImpact: 'Redução de risco concentrado',
        implementation: [
          'Reduzir position size das estratégias de alto risco',
          'Aumentar alocação para estratégias de baixo risco',
          'Implementar limites de correlação'
        ],
        riskLevel: 'medium'
      });
    }

    // Verificar diversificação de tipos
    const strategyTypes = Object.keys(metrics.strategyDistribution).length;
    if (strategyTypes < 3) {
      recommendations.push({
        type: 'ADD_STRATEGY',
        priority: 'medium',
        description: 'Baixa diversificação de tipos de estratégia',
        expectedImpact: 'Melhoria da diversificação e redução de correlação',
        implementation: [
          'Adicionar estratégia de Mean Reversion',
          'Implementar estratégia de Breakout',
          'Considerar estratégia de Arbitragem'
        ],
        riskLevel: 'low'
      });
    }

    // Verificar score de diversificação
    if (metrics.diversificationScore < 60) {
      recommendations.push({
        type: 'ADJUST_PARAMETERS',
        priority: 'medium',
        description: 'Score de diversificação baixo - ajustar parâmetros',
        expectedImpact: 'Melhoria geral da diversificação',
        implementation: [
          'Ajustar timeframes das estratégias',
          'Diversificar símbolos por estratégia',
          'Balancear níveis de risco'
        ],
        riskLevel: 'low'
      });
    }

    return recommendations;
  }

  /**
   * ✅ Otimizar alocação do portfólio
   */
  public async optimizePortfolioAllocation(): Promise<PortfolioAllocation[]> {
    try {
      logPerformance('🔧 Otimizando alocação do portfólio...');

      const allocations: PortfolioAllocation[] = [];
      const activeStrategies = this.strategies.filter(s => s.enabled);
      
      if (activeStrategies.length === 0) {
        logPerformance('⚠️ Nenhuma estratégia ativa para otimizar');
        return allocations;
      }

      // Calcular alocações baseadas em performance e risco
      for (const strategy of activeStrategies) {
        const performance = this.performance.get(strategy.name);
        
        if (!performance) continue;

        // Calcular alocação baseada em Sharpe Ratio e risco
        const sharpeWeight = Math.max(0, performance.sharpeRatio);
        const riskWeight = strategy.riskLevel === 'low' ? 1.2 : strategy.riskLevel === 'medium' ? 1.0 : 0.8;
        const performanceWeight = performance.winRate / 100;
        
        const allocationScore = sharpeWeight * riskWeight * performanceWeight;
        
        // Normalizar alocação
        const totalScore = activeStrategies.reduce((sum, s) => {
          const perf = this.performance.get(s.name);
          if (!perf) return sum;
          
          const sharpe = Math.max(0, perf.sharpeRatio);
          const risk = s.riskLevel === 'low' ? 1.2 : s.riskLevel === 'medium' ? 1.0 : 0.8;
          const perfWeight = perf.winRate / 100;
          
          return sum + (sharpe * risk * perfWeight);
        }, 0);

        const targetAllocation = totalScore > 0 ? (allocationScore / totalScore) * 100 : 100 / activeStrategies.length;
        const currentAllocation = this.getAllocationPercent(strategy.name);
        
        allocations.push({
          strategyName: strategy.name,
          allocationPercent: targetAllocation,
          currentAllocation,
          targetAllocation,
          rebalanceNeeded: Math.abs(targetAllocation - currentAllocation) > 5,
          reason: `Baseado em Sharpe: ${sharpeWeight.toFixed(2)}, Risco: ${riskWeight}, Performance: ${performanceWeight.toFixed(2)}`
        });
      }

      this.allocations.clear();
      allocations.forEach(allocation => {
        this.allocations.set(allocation.strategyName, allocation);
      });

      logPerformance('✅ Otimização de alocação concluída', {
        strategies: allocations.length,
        rebalanceNeeded: allocations.filter(a => a.rebalanceNeeded).length
      });

      return allocations;
    } catch (error) {
      logger.error('❌ Erro na otimização de alocação:', 'PERFORMANCE', null, error);
      return [];
    }
  }

  /**
   * ✅ Obter percentual de alocação atual
   */
  private getAllocationPercent(strategyName: string): number {
    // Simplificado - em implementação real seria baseado em posições ativas
    return 25; // Assumir distribuição igual
  }

  /**
   * ✅ Adicionar nova estratégia
   */
  public addStrategy(strategy: StrategyConfig): void {
    this.strategies.push(strategy);
    logPerformance('✅ Nova estratégia adicionada', { strategy: strategy.name });
  }

  /**
   * ✅ Remover estratégia
   */
  public removeStrategy(strategyName: string): void {
    this.strategies = this.strategies.filter(s => s.name !== strategyName);
    this.performance.delete(strategyName);
    this.allocations.delete(strategyName);
    logPerformance('✅ Estratégia removida', { strategy: strategyName });
  }

  /**
   * ✅ Ativar/desativar estratégia
   */
  public toggleStrategy(strategyName: string, enabled: boolean): void {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (strategy) {
      strategy.enabled = enabled;
      logPerformance(`✅ Estratégia ${enabled ? 'ativada' : 'desativada'}`, { strategy: strategyName });
    }
  }

  /**
   * ✅ Obter estratégias ativas
   */
  public getActiveStrategies(): StrategyConfig[] {
    return this.strategies.filter(s => s.enabled);
  }

  /**
   * ✅ Obter performance das estratégias
   */
  public getStrategyPerformance(): Map<string, StrategyPerformance> {
    return new Map(this.performance);
  }

  /**
   * ✅ Obter alocações do portfólio
   */
  public getPortfolioAllocations(): Map<string, PortfolioAllocation> {
    return new Map(this.allocations);
  }

  /**
   * ✅ Atualizar parâmetros da estratégia
   */
  public updateStrategyParameters(strategyName: string, parameters: Record<string, any>): void {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (strategy) {
      strategy.parameters = { ...strategy.parameters, ...parameters };
      logPerformance('✅ Parâmetros da estratégia atualizados', { strategy: strategyName, parameters });
    }
  }

  /**
   * ✅ Obter recomendações de diversificação
   */
  public async getDiversificationRecommendations(): Promise<DiversificationRecommendation[]> {
    const metrics = await this.analyzeDiversification();
    return await this.generateDiversificationRecommendations(metrics);
  }
}

export const strategyDiversificationModule = new StrategyDiversificationModule();
export default StrategyDiversificationModule;
