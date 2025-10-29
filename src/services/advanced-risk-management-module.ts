import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger, logTrading, logPerformance } from './logger';

export interface RiskLimits {
  maxDailyLoss: number;
  maxDailyLossPercent: number;
  maxPositionSize: number;
  maxPositionSizePercent: number;
  maxConcurrentPositions: number;
  maxDrawdownPercent: number;
  maxConsecutiveLosses: number;
  maxTradesPerDay: number;
  maxTradesPerHour: number;
  minTimeBetweenTrades: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  riskRewardRatio: number;
}

export interface RiskMetrics {
  currentDrawdown: number;
  currentDrawdownPercent: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  currentPositions: number;
  tradesToday: number;
  tradesThisHour: number;
  consecutiveLosses: number;
  lastTradeTime: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
}

export interface RiskAlert {
  type: 'DRAWDOWN' | 'DAILY_LOSS' | 'POSITION_SIZE' | 'CONSECUTIVE_LOSSES' | 'TRADE_FREQUENCY' | 'TIME_BETWEEN_TRADES';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  currentValue: number;
  limitValue: number;
  recommendation: string;
  timestamp: number;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  activeAlerts: RiskAlert[];
  recommendations: string[];
  canTrade: boolean;
  reason?: string;
}

/**
 * ✅ MÓDULO DE GESTÃO DE RISCO AVANÇADA
 * Objetivo: Implementar limites dinâmicos e gestão de risco profissional
 */
export class AdvancedRiskManagementModule {
  private supabase: SupabaseClient | null = null;
  private riskLimits: RiskLimits;
  private currentMetrics: RiskMetrics | null = null;
  private alerts: RiskAlert[] = [];

  constructor() {
    this.initializeSupabase();
    this.riskLimits = this.getDefaultRiskLimits();
  }

  private initializeSupabase() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        logger.warn('⚠️ AdvancedRiskManagementModule: Supabase credentials not found', 'PERFORMANCE');
        this.supabase = null;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      logger.info('✅ AdvancedRiskManagementModule: Supabase initialized', 'PERFORMANCE');
    } catch (error) {
      logger.error('❌ AdvancedRiskManagementModule: Failed to initialize Supabase:', 'PERFORMANCE', null, error);
      this.supabase = null;
    }
  }

  /**
   * ✅ Obter limites de risco padrão
   */
  private getDefaultRiskLimits(): RiskLimits {
    return {
      maxDailyLoss: 50, // $50
      maxDailyLossPercent: 5, // 5%
      maxPositionSize: 100, // $100
      maxPositionSizePercent: 10, // 10%
      maxConcurrentPositions: 3,
      maxDrawdownPercent: 15, // 15%
      maxConsecutiveLosses: 5,
      maxTradesPerDay: 20,
      maxTradesPerHour: 5,
      minTimeBetweenTrades: 300000, // 5 minutos
      stopLossPercent: 2, // 2%
      takeProfitPercent: 4, // 4%
      riskRewardRatio: 2 // 2:1
    };
  }

  /**
   * ✅ FUNÇÃO PRINCIPAL: Avaliar risco antes de abrir trade
   */
  public async assessRiskBeforeTrade(
    symbol: string,
    side: 'BUY' | 'SELL',
    positionSize: number,
    currentPrice: number,
    availableBalance: number
  ): Promise<RiskAssessment> {
    try {
      logTrading(`🔍 Avaliando risco antes de abrir trade ${symbol}...`);

      // 1. Atualizar métricas de risco
      await this.updateRiskMetrics(availableBalance);
      
      if (!this.currentMetrics) {
        throw new Error('Não foi possível obter métricas de risco');
      }

      // 2. Verificar limites de risco
      const riskChecks = await this.performRiskChecks(symbol, side, positionSize, currentPrice, availableBalance);
      
      // 3. Calcular score de risco
      const riskScore = this.calculateRiskScore(riskChecks);
      
      // 4. Determinar nível de risco geral
      const overallRisk = this.determineOverallRisk(riskScore);
      
      // 5. Gerar recomendações
      const recommendations = this.generateRiskRecommendations(riskChecks, overallRisk);
      
      // 6. Determinar se pode fazer trade
      const canTrade = this.canExecuteTrade(riskChecks, overallRisk);
      
      const assessment: RiskAssessment = {
        overallRisk,
        riskScore,
        activeAlerts: this.alerts,
        recommendations,
        canTrade,
        reason: canTrade ? undefined : this.getBlockReason(riskChecks)
      };

      logTrading(`📊 Avaliação de risco concluída para ${symbol}`, {
        overallRisk,
        riskScore,
        canTrade,
        alerts: this.alerts.length
      });

      return assessment;
    } catch (error) {
      logger.error(`❌ Erro na avaliação de risco para ${symbol}:`, 'PERFORMANCE', null, error);
      
      // Em caso de erro, ser conservador
      return {
        overallRisk: 'high',
        riskScore: 80,
        activeAlerts: [{
          type: 'DRAWDOWN',
          severity: 'high',
          message: 'Erro na avaliação de risco',
          currentValue: 0,
          limitValue: 0,
          recommendation: 'Aguardar resolução do erro',
          timestamp: Date.now()
        }],
        recommendations: ['Erro na avaliação de risco - não executar trade'],
        canTrade: false,
        reason: 'Erro na avaliação de risco'
      };
    }
  }

  /**
   * ✅ Atualizar métricas de risco
   */
  private async updateRiskMetrics(availableBalance: number): Promise<void> {
    if (!this.supabase) {
      this.currentMetrics = this.getEmptyMetrics();
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      // Obter trades de hoje
      const { data: todayTrades } = await this.supabase
        .from('real_trades')
        .select('*')
        .gte('opened_at', `${today}T00:00:00`)
        .lte('opened_at', `${today}T23:59:59`);

      // Obter trades da última hora
      const { data: recentTrades } = await this.supabase
        .from('real_trades')
        .select('*')
        .gte('opened_at', oneHourAgo);

      // Obter trades abertas
      const { data: openTrades } = await this.supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'open');

      // Obter histórico de equity
      const { data: equityHistory } = await this.supabase
        .from('equity_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      // Calcular métricas
      const dailyPnL = todayTrades?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0;
      const dailyPnLPercent = availableBalance > 0 ? (dailyPnL / availableBalance) * 100 : 0;
      
      // Calcular drawdown atual
      const currentDrawdown = this.calculateCurrentDrawdown(equityHistory || [], availableBalance);
      
      // Calcular sequência de perdas
      const consecutiveLosses = this.calculateConsecutiveLosses(todayTrades || []);
      
      // Obter última trade
      const lastTrade = todayTrades?.sort((a, b) => 
        new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
      )[0];
      
      const lastTradeTime = lastTrade ? new Date(lastTrade.opened_at).getTime() : 0;

      this.currentMetrics = {
        currentDrawdown: currentDrawdown.amount,
        currentDrawdownPercent: currentDrawdown.percent,
        dailyPnL,
        dailyPnLPercent,
        currentPositions: openTrades?.length || 0,
        tradesToday: todayTrades?.length || 0,
        tradesThisHour: recentTrades?.length || 0,
        consecutiveLosses,
        lastTradeTime,
        riskLevel: 'low',
        riskScore: 0
      };

    } catch (error) {
      logger.error('❌ Erro ao atualizar métricas de risco:', 'PERFORMANCE', null, error);
      this.currentMetrics = this.getEmptyMetrics();
    }
  }

  /**
   * ✅ Calcular drawdown atual
   */
  private calculateCurrentDrawdown(equityHistory: any[], currentBalance: number): { amount: number; percent: number } {
    if (equityHistory.length === 0) return { amount: 0, percent: 0 };
    
    const maxEquity = Math.max(...equityHistory.map(e => parseFloat(e.equity)), currentBalance);
    const currentDrawdown = maxEquity - currentBalance;
    const currentDrawdownPercent = maxEquity > 0 ? (currentDrawdown / maxEquity) * 100 : 0;
    
    return { amount: currentDrawdown, percent: currentDrawdownPercent };
  }

  /**
   * ✅ Calcular sequência de perdas
   */
  private calculateConsecutiveLosses(trades: any[]): number {
    if (trades.length === 0) return 0;
    
    const sortedTrades = trades.sort((a, b) => 
      new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
    );
    
    let consecutiveLosses = 0;
    
    for (const trade of sortedTrades) {
      if (trade.pnl < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }
    
    return consecutiveLosses;
  }

  /**
   * ✅ Realizar verificações de risco
   */
  private async performRiskChecks(
    symbol: string,
    side: 'BUY' | 'SELL',
    positionSize: number,
    currentPrice: number,
    availableBalance: number
  ): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];
    
    if (!this.currentMetrics) return alerts;

    // 1. Verificar drawdown
    if (this.currentMetrics.currentDrawdownPercent > this.riskLimits.maxDrawdownPercent) {
      alerts.push({
        type: 'DRAWDOWN',
        severity: this.currentMetrics.currentDrawdownPercent > this.riskLimits.maxDrawdownPercent * 1.5 ? 'critical' : 'high',
        message: `Drawdown atual ${this.currentMetrics.currentDrawdownPercent.toFixed(2)}% excede limite de ${this.riskLimits.maxDrawdownPercent}%`,
        currentValue: this.currentMetrics.currentDrawdownPercent,
        limitValue: this.riskLimits.maxDrawdownPercent,
        recommendation: 'Reduzir position size ou pausar trading',
        timestamp: Date.now()
      });
    }

    // 2. Verificar perda diária
    if (this.currentMetrics.dailyPnLPercent < -this.riskLimits.maxDailyLossPercent) {
      alerts.push({
        type: 'DAILY_LOSS',
        severity: this.currentMetrics.dailyPnLPercent < -this.riskLimits.maxDailyLossPercent * 1.5 ? 'critical' : 'high',
        message: `Perda diária ${this.currentMetrics.dailyPnLPercent.toFixed(2)}% excede limite de ${this.riskLimits.maxDailyLossPercent}%`,
        currentValue: Math.abs(this.currentMetrics.dailyPnLPercent),
        limitValue: this.riskLimits.maxDailyLossPercent,
        recommendation: 'Parar trading por hoje',
        timestamp: Date.now()
      });
    }

    // 3. Verificar tamanho da posição
    const positionSizePercent = (positionSize / availableBalance) * 100;
    if (positionSizePercent > this.riskLimits.maxPositionSizePercent) {
      alerts.push({
        type: 'POSITION_SIZE',
        severity: positionSizePercent > this.riskLimits.maxPositionSizePercent * 1.5 ? 'critical' : 'high',
        message: `Position size ${positionSizePercent.toFixed(2)}% excede limite de ${this.riskLimits.maxPositionSizePercent}%`,
        currentValue: positionSizePercent,
        limitValue: this.riskLimits.maxPositionSizePercent,
        recommendation: 'Reduzir tamanho da posição',
        timestamp: Date.now()
      });
    }

    // 4. Verificar posições concorrentes
    if (this.currentMetrics.currentPositions >= this.riskLimits.maxConcurrentPositions) {
      alerts.push({
        type: 'POSITION_SIZE',
        severity: 'high',
        message: `Número de posições ${this.currentMetrics.currentPositions} excede limite de ${this.riskLimits.maxConcurrentPositions}`,
        currentValue: this.currentMetrics.currentPositions,
        limitValue: this.riskLimits.maxConcurrentPositions,
        recommendation: 'Aguardar fechamento de posições existentes',
        timestamp: Date.now()
      });
    }

    // 5. Verificar sequência de perdas
    if (this.currentMetrics.consecutiveLosses >= this.riskLimits.maxConsecutiveLosses) {
      alerts.push({
        type: 'CONSECUTIVE_LOSSES',
        severity: this.currentMetrics.consecutiveLosses >= this.riskLimits.maxConsecutiveLosses * 1.5 ? 'critical' : 'high',
        message: `Sequência de ${this.currentMetrics.consecutiveLosses} perdas excede limite de ${this.riskLimits.maxConsecutiveLosses}`,
        currentValue: this.currentMetrics.consecutiveLosses,
        limitValue: this.riskLimits.maxConsecutiveLosses,
        recommendation: 'Pausar trading temporariamente',
        timestamp: Date.now()
      });
    }

    // 6. Verificar frequência de trades
    if (this.currentMetrics.tradesToday >= this.riskLimits.maxTradesPerDay) {
      alerts.push({
        type: 'TRADE_FREQUENCY',
        severity: 'high',
        message: `Trades hoje ${this.currentMetrics.tradesToday} excede limite de ${this.riskLimits.maxTradesPerDay}`,
        currentValue: this.currentMetrics.tradesToday,
        limitValue: this.riskLimits.maxTradesPerDay,
        recommendation: 'Limite diário atingido',
        timestamp: Date.now()
      });
    }

    if (this.currentMetrics.tradesThisHour >= this.riskLimits.maxTradesPerHour) {
      alerts.push({
        type: 'TRADE_FREQUENCY',
        severity: 'medium',
        message: `Trades na última hora ${this.currentMetrics.tradesThisHour} excede limite de ${this.riskLimits.maxTradesPerHour}`,
        currentValue: this.currentMetrics.tradesThisHour,
        limitValue: this.riskLimits.maxTradesPerHour,
        recommendation: 'Aguardar antes de fazer nova trade',
        timestamp: Date.now()
      });
    }

    // 7. Verificar tempo entre trades
    const timeSinceLastTrade = Date.now() - this.currentMetrics.lastTradeTime;
    if (timeSinceLastTrade < this.riskLimits.minTimeBetweenTrades) {
      alerts.push({
        type: 'TIME_BETWEEN_TRADES',
        severity: 'medium',
        message: `Tempo desde última trade ${(timeSinceLastTrade / 1000 / 60).toFixed(1)}min é menor que ${(this.riskLimits.minTimeBetweenTrades / 1000 / 60).toFixed(1)}min`,
        currentValue: timeSinceLastTrade,
        limitValue: this.riskLimits.minTimeBetweenTrades,
        recommendation: 'Aguardar tempo mínimo entre trades',
        timestamp: Date.now()
      });
    }

    this.alerts = alerts;
    return alerts;
  }

  /**
   * ✅ Calcular score de risco
   */
  private calculateRiskScore(alerts: RiskAlert[]): number {
    let score = 0;
    
    alerts.forEach(alert => {
      switch (alert.severity) {
        case 'critical':
          score += 40;
          break;
        case 'high':
          score += 25;
          break;
        case 'medium':
          score += 15;
          break;
        case 'low':
          score += 5;
          break;
      }
    });
    
    return Math.min(100, score);
  }

  /**
   * ✅ Determinar nível de risco geral
   */
  private determineOverallRisk(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }

  /**
   * ✅ Gerar recomendações de risco
   */
  private generateRiskRecommendations(alerts: RiskAlert[], overallRisk: string): string[] {
    const recommendations: string[] = [];
    
    if (overallRisk === 'critical') {
      recommendations.push('RISCO CRÍTICO: Parar trading imediatamente');
    } else if (overallRisk === 'high') {
      recommendations.push('RISCO ALTO: Reduzir position size e aumentar filtros');
    } else if (overallRisk === 'medium') {
      recommendations.push('RISCO MÉDIO: Monitorar métricas de perto');
    } else {
      recommendations.push('RISCO BAIXO: Condições normais de trading');
    }
    
    // Recomendações específicas baseadas nos alertas
    alerts.forEach(alert => {
      if (alert.severity === 'critical' || alert.severity === 'high') {
        recommendations.push(alert.recommendation);
      }
    });
    
    return recommendations;
  }

  /**
   * ✅ Verificar se pode executar trade
   */
  private canExecuteTrade(alerts: RiskAlert[], overallRisk: string): boolean {
    // Não permitir trades em risco crítico
    if (overallRisk === 'critical') return false;
    
    // Não permitir trades com alertas críticos
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) return false;
    
    // Permitir trades em risco baixo/médio
    return true;
  }

  /**
   * ✅ Obter razão do bloqueio
   */
  private getBlockReason(alerts: RiskAlert[]): string {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      return criticalAlerts[0].message;
    }
    
    const highAlerts = alerts.filter(a => a.severity === 'high');
    if (highAlerts.length > 0) {
      return highAlerts[0].message;
    }
    
    return 'Múltiplos alertas de risco';
  }

  /**
   * ✅ Obter métricas vazias
   */
  private getEmptyMetrics(): RiskMetrics {
    return {
      currentDrawdown: 0,
      currentDrawdownPercent: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      currentPositions: 0,
      tradesToday: 0,
      tradesThisHour: 0,
      consecutiveLosses: 0,
      lastTradeTime: 0,
      riskLevel: 'low',
      riskScore: 0
    };
  }

  /**
   * ✅ Atualizar limites de risco
   */
  public updateRiskLimits(newLimits: Partial<RiskLimits>): void {
    this.riskLimits = { ...this.riskLimits, ...newLimits };
    logTrading('📊 Limites de risco atualizados', { newLimits });
  }

  /**
   * ✅ Obter limites atuais
   */
  public getCurrentLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  /**
   * ✅ Obter métricas atuais
   */
  public getCurrentMetrics(): RiskMetrics | null {
    return this.currentMetrics ? { ...this.currentMetrics } : null;
  }

  /**
   * ✅ Obter alertas ativos
   */
  public getActiveAlerts(): RiskAlert[] {
    return [...this.alerts];
  }

  /**
   * ✅ Limpar alertas
   */
  public clearAlerts(): void {
    this.alerts = [];
    logTrading('🧹 Alertas de risco limpos');
  }

  /**
   * ✅ Calcular position size baseado em risco
   */
  public calculateOptimalPositionSize(
    availableBalance: number,
    riskPercent: number,
    stopLossPercent: number
  ): number {
    const riskAmount = availableBalance * (riskPercent / 100);
    const positionSize = riskAmount / (stopLossPercent / 100);
    
    // Aplicar limite máximo de position size
    const maxPositionSize = availableBalance * (this.riskLimits.maxPositionSizePercent / 100);
    
    return Math.min(positionSize, maxPositionSize);
  }

  /**
   * ✅ Verificar se deve pausar trading
   */
  public shouldPauseTrading(): { pause: boolean; reason?: string } {
    if (!this.currentMetrics) return { pause: false };
    
    // Pausar se drawdown muito alto
    if (this.currentMetrics.currentDrawdownPercent > this.riskLimits.maxDrawdownPercent * 1.5) {
      return { pause: true, reason: 'Drawdown crítico' };
    }
    
    // Pausar se perda diária muito alta
    if (this.currentMetrics.dailyPnLPercent < -this.riskLimits.maxDailyLossPercent * 1.5) {
      return { pause: true, reason: 'Perda diária crítica' };
    }
    
    // Pausar se muitas perdas consecutivas
    if (this.currentMetrics.consecutiveLosses >= this.riskLimits.maxConsecutiveLosses * 1.5) {
      return { pause: true, reason: 'Muitas perdas consecutivas' };
    }
    
    return { pause: false };
  }
}

export const advancedRiskManagementModule = new AdvancedRiskManagementModule();
export default AdvancedRiskManagementModule;
