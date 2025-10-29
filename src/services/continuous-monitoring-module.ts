import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger, logTrading, logPerformance, logMonitoring } from './logger';

export interface MonitoringConfig {
  checkInterval: number; // em milissegundos
  enableRealTimeMonitoring: boolean;
  enablePerformanceTracking: boolean;
  enableRiskMonitoring: boolean;
  enableStrategyOptimization: boolean;
  alertThresholds: {
    drawdownPercent: number;
    dailyLossPercent: number;
    consecutiveLosses: number;
    winRateDrop: number;
    performanceDegradation: number;
  };
}

export interface MonitoringMetrics {
  timestamp: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  performanceScore: number;
  riskScore: number;
  activeTrades: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  currentDrawdown: number;
  currentDrawdownPercent: number;
  winRate: number;
  tradesToday: number;
  consecutiveLosses: number;
  systemUptime: number;
  lastOptimization: number;
  alerts: MonitoringAlert[];
}

export interface MonitoringAlert {
  id: string;
  type: 'PERFORMANCE' | 'RISK' | 'SYSTEM' | 'STRATEGY';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  resolved: boolean;
  resolution?: string;
  resolvedAt?: number;
}

export interface DynamicAdjustment {
  type: 'PARAMETER' | 'RISK_LIMIT' | 'STRATEGY_SWITCH' | 'POSITION_SIZE' | 'FILTER_THRESHOLD';
  parameter: string;
  oldValue: any;
  newValue: any;
  reason: string;
  timestamp: number;
  effectiveness?: number;
}

export interface OptimizationTrigger {
  condition: string;
  threshold: number;
  action: 'OPTIMIZE_PARAMETERS' | 'ADJUST_RISK_LIMITS' | 'SWITCH_STRATEGY' | 'PAUSE_TRADING';
  parameters: Record<string, any>;
  enabled: boolean;
}

/**
 * ✅ MÓDULO DE MONITORAMENTO CONTÍNUO E AJUSTES DINÂMICOS
 * Objetivo: Monitorar sistema continuamente e fazer ajustes automáticos
 */
export class ContinuousMonitoringModule {
  private supabase: SupabaseClient | null = null;
  private config: MonitoringConfig;
  private metrics: MonitoringMetrics | null = null;
  private alerts: MonitoringAlert[] = [];
  private adjustments: DynamicAdjustment[] = [];
  private optimizationTriggers: OptimizationTrigger[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {
    this.initializeSupabase();
    this.config = this.getDefaultConfig();
    this.setupOptimizationTriggers();
  }

  private initializeSupabase() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        logger.warn('⚠️ ContinuousMonitoringModule: Supabase credentials not found', 'MONITORING');
        this.supabase = null;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      logger.info('✅ ContinuousMonitoringModule: Supabase initialized', 'MONITORING');
    } catch (error) {
      logger.error('❌ ContinuousMonitoringModule: Failed to initialize Supabase:', 'MONITORING', null, error as Error);
      this.supabase = null;
    }
  }

  /**
   * ✅ Obter configuração padrão
   */
  private getDefaultConfig(): MonitoringConfig {
    return {
      checkInterval: 60000, // 1 minuto
      enableRealTimeMonitoring: true,
      enablePerformanceTracking: true,
      enableRiskMonitoring: true,
      enableStrategyOptimization: true,
      alertThresholds: {
        drawdownPercent: 10,
        dailyLossPercent: 5,
        consecutiveLosses: 5,
        winRateDrop: 20,
        performanceDegradation: 30
      }
    };
  }

  /**
   * ✅ Configurar triggers de otimização
   */
  private setupOptimizationTriggers(): void {
    this.optimizationTriggers = [
      {
        condition: 'winRate < 40',
        threshold: 40,
        action: 'OPTIMIZE_PARAMETERS',
        parameters: { minConfidence: 50, riskRewardRatio: 2.5 },
        enabled: true
      },
      {
        condition: 'drawdownPercent > 15',
        threshold: 15,
        action: 'ADJUST_RISK_LIMITS',
        parameters: { maxPositionSize: 0.05, maxDailyLoss: 0.03 },
        enabled: true
      },
      {
        condition: 'consecutiveLosses > 7',
        threshold: 7,
        action: 'PAUSE_TRADING',
        parameters: { pauseDuration: 3600000 }, // 1 hora
        enabled: true
      },
      {
        condition: 'performanceScore < 30',
        threshold: 30,
        action: 'SWITCH_STRATEGY',
        parameters: { strategy: 'conservative', timeframe: '1h' },
        enabled: true
      }
    ];
  }

  /**
   * ✅ FUNÇÃO PRINCIPAL: Iniciar monitoramento contínuo
   */
  public async startMonitoring(): Promise<void> {
    try {
      if (this.isMonitoring) {
        logMonitoring('⚠️ Monitoramento já está ativo');
        return;
      }

      logMonitoring('🚀 Iniciando monitoramento contínuo do sistema...');

      this.isMonitoring = true;
      
      // Executar primeira verificação
      await this.performMonitoringCheck();
      
      // Configurar intervalo de monitoramento
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.performMonitoringCheck();
        } catch (error) {
          logger.error('❌ Erro no monitoramento contínuo:', 'MONITORING', null, error as Error);
        }
      }, this.config.checkInterval);

      logMonitoring('✅ Monitoramento contínuo iniciado', {
        interval: this.config.checkInterval,
        triggers: this.optimizationTriggers.length
      });
    } catch (error) {
      logger.error('❌ Erro ao iniciar monitoramento:', 'MONITORING', null, error as Error);
      this.isMonitoring = false;
    }
  }

  /**
   * ✅ Parar monitoramento
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    logMonitoring('⏸️ Monitoramento contínuo parado');
  }

  /**
   * ✅ Executar verificação de monitoramento
   */
  private async performMonitoringCheck(): Promise<void> {
    try {
      logMonitoring('🔍 Executando verificação de monitoramento...');

      // 1. Coletar métricas atuais
      await this.collectCurrentMetrics();
      
      // 2. Verificar alertas
      await this.checkAlerts();
      
      // 3. Verificar triggers de otimização
      await this.checkOptimizationTriggers();
      
      // 4. Salvar métricas
      await this.saveMonitoringMetrics();
      
      // 5. Aplicar ajustes dinâmicos se necessário
      await this.applyDynamicAdjustments();

      logMonitoring('✅ Verificação de monitoramento concluída', {
        systemHealth: this.metrics?.systemHealth,
        alerts: this.alerts.length,
        adjustments: this.adjustments.length
      });
    } catch (error) {
      logger.error('❌ Erro na verificação de monitoramento:', 'MONITORING', null, error as Error);
    }
  }

  /**
   * ✅ Coletar métricas atuais
   */
  private async collectCurrentMetrics(): Promise<void> {
    if (!this.supabase) {
      this.metrics = this.getEmptyMetrics();
      return;
    }

    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      
      // Obter trades de hoje
      const { data: todayTrades } = await this.supabase
        .from('real_trades')
        .select('*')
        .gte('opened_at', `${today}T00:00:00`)
        .lte('opened_at', `${today}T23:59:59`);

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
        .limit(50);

      // Calcular métricas
      const dailyPnL = todayTrades?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0;
      const dailyPnLPercent = this.calculateDailyPnLPercent(dailyPnL);
      
      const winRate = this.calculateWinRate(todayTrades || []);
      const consecutiveLosses = this.calculateConsecutiveLosses(todayTrades || []);
      
      const currentDrawdown = this.calculateCurrentDrawdown(equityHistory || []);
      
      // Calcular scores
      const performanceScore = this.calculatePerformanceScore(winRate, dailyPnLPercent, consecutiveLosses);
      const riskScore = this.calculateRiskScore(currentDrawdown.percent, dailyPnLPercent, consecutiveLosses);
      
      // Determinar saúde do sistema
      const systemHealth = this.determineSystemHealth(performanceScore, riskScore);

      this.metrics = {
        timestamp: Date.now(),
        systemHealth,
        performanceScore,
        riskScore,
        activeTrades: openTrades?.length || 0,
        dailyPnL,
        dailyPnLPercent,
        currentDrawdown: currentDrawdown.amount,
        currentDrawdownPercent: currentDrawdown.percent,
        winRate,
        tradesToday: todayTrades?.length || 0,
        consecutiveLosses,
        systemUptime: this.calculateSystemUptime(),
        lastOptimization: this.getLastOptimizationTime(),
        alerts: this.alerts.filter(a => !a.resolved)
      };

    } catch (error) {
      logger.error('❌ Erro ao coletar métricas:', 'MONITORING', null, error as Error);
      this.metrics = this.getEmptyMetrics();
    }
  }

  /**
   * ✅ Calcular percentual de PnL diário
   */
  private calculateDailyPnLPercent(dailyPnL: number): number {
    // Assumir capital inicial de $1000 para cálculo
    const initialCapital = 1000;
    return (dailyPnL / initialCapital) * 100;
  }

  /**
   * ✅ Calcular win rate
   */
  private calculateWinRate(trades: any[]): number {
    if (trades.length === 0) return 0;
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    return (winningTrades.length / trades.length) * 100;
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
   * ✅ Calcular drawdown atual
   */
  private calculateCurrentDrawdown(equityHistory: any[]): { amount: number; percent: number } {
    if (equityHistory.length === 0) return { amount: 0, percent: 0 };
    
    const maxEquity = Math.max(...equityHistory.map(e => parseFloat(e.equity)));
    const currentEquity = parseFloat(equityHistory[0].equity);
    const drawdown = maxEquity - currentEquity;
    const drawdownPercent = maxEquity > 0 ? (drawdown / maxEquity) * 100 : 0;
    
    return { amount: drawdown, percent: drawdownPercent };
  }

  /**
   * ✅ Calcular score de performance
   */
  private calculatePerformanceScore(winRate: number, dailyPnLPercent: number, consecutiveLosses: number): number {
    let score = 50; // Base
    
    // Win Rate
    if (winRate > 60) score += 20;
    else if (winRate > 50) score += 10;
    else if (winRate < 40) score -= 20;
    
    // PnL Diário
    if (dailyPnLPercent > 2) score += 15;
    else if (dailyPnLPercent > 0) score += 5;
    else if (dailyPnLPercent < -2) score -= 15;
    
    // Sequência de perdas
    if (consecutiveLosses > 5) score -= 15;
    else if (consecutiveLosses > 3) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * ✅ Calcular score de risco
   */
  private calculateRiskScore(drawdownPercent: number, dailyPnLPercent: number, consecutiveLosses: number): number {
    let score = 0; // Base (0 = baixo risco, 100 = alto risco)
    
    // Drawdown
    if (drawdownPercent > 15) score += 40;
    else if (drawdownPercent > 10) score += 25;
    else if (drawdownPercent > 5) score += 10;
    
    // PnL Diário
    if (dailyPnLPercent < -5) score += 30;
    else if (dailyPnLPercent < -2) score += 20;
    else if (dailyPnLPercent < 0) score += 10;
    
    // Sequência de perdas
    if (consecutiveLosses > 7) score += 30;
    else if (consecutiveLosses > 5) score += 20;
    else if (consecutiveLosses > 3) score += 10;
    
    return Math.min(100, score);
  }

  /**
   * ✅ Determinar saúde do sistema
   */
  private determineSystemHealth(performanceScore: number, riskScore: number): 'healthy' | 'warning' | 'critical' {
    if (riskScore > 70 || performanceScore < 30) return 'critical';
    if (riskScore > 50 || performanceScore < 50) return 'warning';
    return 'healthy';
  }

  /**
   * ✅ Calcular uptime do sistema
   */
  private calculateSystemUptime(): number {
    // Simplificado - em implementação real seria baseado em timestamp de inicialização
    return Date.now() - (Date.now() - 24 * 60 * 60 * 1000); // Assumir 24h
  }

  /**
   * ✅ Obter última otimização
   */
  private getLastOptimizationTime(): number {
    const lastAdjustment = this.adjustments
      .filter(a => a.type === 'PARAMETER')
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    return lastAdjustment?.timestamp || 0;
  }

  /**
   * ✅ Verificar alertas
   */
  private async checkAlerts(): Promise<void> {
    if (!this.metrics) return;

    const newAlerts: MonitoringAlert[] = [];

    // Verificar drawdown
    if (this.metrics.currentDrawdownPercent > this.config.alertThresholds.drawdownPercent) {
      newAlerts.push({
        id: `drawdown_${Date.now()}`,
        type: 'RISK',
        severity: this.metrics.currentDrawdownPercent > this.config.alertThresholds.drawdownPercent * 1.5 ? 'critical' : 'high',
        title: 'Drawdown Alto',
        message: `Drawdown atual ${this.metrics.currentDrawdownPercent.toFixed(2)}% excede limite de ${this.config.alertThresholds.drawdownPercent}%`,
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Verificar perda diária
    if (this.metrics.dailyPnLPercent < -this.config.alertThresholds.dailyLossPercent) {
      newAlerts.push({
        id: `daily_loss_${Date.now()}`,
        type: 'RISK',
        severity: this.metrics.dailyPnLPercent < -this.config.alertThresholds.dailyLossPercent * 1.5 ? 'critical' : 'high',
        title: 'Perda Diária Alta',
        message: `Perda diária ${this.metrics.dailyPnLPercent.toFixed(2)}% excede limite de ${this.config.alertThresholds.dailyLossPercent}%`,
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Verificar sequência de perdas
    if (this.metrics.consecutiveLosses >= this.config.alertThresholds.consecutiveLosses) {
      newAlerts.push({
        id: `consecutive_losses_${Date.now()}`,
        type: 'PERFORMANCE',
        severity: this.metrics.consecutiveLosses >= this.config.alertThresholds.consecutiveLosses * 1.5 ? 'critical' : 'high',
        title: 'Sequência de Perdas',
        message: `Sequência de ${this.metrics.consecutiveLosses} perdas excede limite de ${this.config.alertThresholds.consecutiveLosses}`,
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Verificar queda de win rate
    if (this.metrics.winRate < this.config.alertThresholds.winRateDrop) {
      newAlerts.push({
        id: `win_rate_drop_${Date.now()}`,
        type: 'PERFORMANCE',
        severity: this.metrics.winRate < this.config.alertThresholds.winRateDrop * 0.5 ? 'critical' : 'medium',
        title: 'Win Rate Baixo',
        message: `Win rate ${this.metrics.winRate.toFixed(2)}% está abaixo do limite de ${this.config.alertThresholds.winRateDrop}%`,
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Verificar degradação de performance
    if (this.metrics.performanceScore < this.config.alertThresholds.performanceDegradation) {
      newAlerts.push({
        id: `performance_degradation_${Date.now()}`,
        type: 'PERFORMANCE',
        severity: this.metrics.performanceScore < this.config.alertThresholds.performanceDegradation * 0.5 ? 'critical' : 'medium',
        title: 'Degradação de Performance',
        message: `Score de performance ${this.metrics.performanceScore.toFixed(2)} está abaixo do limite de ${this.config.alertThresholds.performanceDegradation}`,
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Adicionar novos alertas
    this.alerts.push(...newAlerts);

    // Log de alertas críticos
    const criticalAlerts = newAlerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      logMonitoring('🚨 ALERTAS CRÍTICOS DETECTADOS:', { alerts: criticalAlerts });
    }
  }

  /**
   * ✅ Verificar triggers de otimização
   */
  private async checkOptimizationTriggers(): Promise<void> {
    if (!this.metrics) return;

    for (const trigger of this.optimizationTriggers) {
      if (!trigger.enabled) continue;

      let shouldTrigger = false;

      switch (trigger.condition) {
        case 'winRate < 40':
          shouldTrigger = this.metrics.winRate < trigger.threshold;
          break;
        case 'drawdownPercent > 15':
          shouldTrigger = this.metrics.currentDrawdownPercent > trigger.threshold;
          break;
        case 'consecutiveLosses > 7':
          shouldTrigger = this.metrics.consecutiveLosses > trigger.threshold;
          break;
        case 'performanceScore < 30':
          shouldTrigger = this.metrics.performanceScore < trigger.threshold;
          break;
      }

      if (shouldTrigger) {
        await this.executeOptimizationAction(trigger);
      }
    }
  }

  /**
   * ✅ Executar ação de otimização
   */
  private async executeOptimizationAction(trigger: OptimizationTrigger): Promise<void> {
    try {
      logMonitoring(`🔧 Executando ação de otimização: ${trigger.action}`, { trigger });

      switch (trigger.action) {
        case 'OPTIMIZE_PARAMETERS':
          await this.optimizeParameters(trigger.parameters);
          break;
        case 'ADJUST_RISK_LIMITS':
          await this.adjustRiskLimits(trigger.parameters);
          break;
        case 'PAUSE_TRADING':
          await this.pauseTrading(trigger.parameters);
          break;
        case 'SWITCH_STRATEGY':
          await this.switchStrategy(trigger.parameters);
          break;
      }

      // Registrar ajuste
      this.adjustments.push({
        type: trigger.action as any,
        parameter: trigger.condition,
        oldValue: 'previous',
        newValue: trigger.parameters,
        reason: `Trigger: ${trigger.condition}`,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error(`❌ Erro ao executar ação de otimização ${trigger.action}:`, 'MONITORING', null, error as Error);
    }
  }

  /**
   * ✅ Otimizar parâmetros
   */
  private async optimizeParameters(parameters: Record<string, any>): Promise<void> {
    logMonitoring('🔧 Otimizando parâmetros da estratégia...', { parameters });
    // Implementar lógica de otimização de parâmetros
  }

  /**
   * ✅ Ajustar limites de risco
   */
  private async adjustRiskLimits(parameters: Record<string, any>): Promise<void> {
    logMonitoring('🔧 Ajustando limites de risco...', { parameters });
    // Implementar lógica de ajuste de limites de risco
  }

  /**
   * ✅ Pausar trading
   */
  private async pauseTrading(parameters: Record<string, any>): Promise<void> {
    logMonitoring('⏸️ Pausando trading temporariamente...', { parameters });
    // Implementar lógica de pausa de trading
  }

  /**
   * ✅ Trocar estratégia
   */
  private async switchStrategy(parameters: Record<string, any>): Promise<void> {
    logMonitoring('🔄 Trocando estratégia...', { parameters });
    // Implementar lógica de troca de estratégia
  }

  /**
   * ✅ Aplicar ajustes dinâmicos
   */
  private async applyDynamicAdjustments(): Promise<void> {
    // Implementar lógica de aplicação de ajustes dinâmicos
    logMonitoring('🔧 Aplicando ajustes dinâmicos...');
  }

  /**
   * ✅ Salvar métricas de monitoramento
   */
  private async saveMonitoringMetrics(): Promise<void> {
    if (!this.supabase || !this.metrics) return;

    try {
      const { error } = await this.supabase
        .from('monitoring_metrics')
        .insert({
          timestamp: new Date(this.metrics.timestamp).toISOString(),
          system_health: this.metrics.systemHealth,
          performance_score: this.metrics.performanceScore,
          risk_score: this.metrics.riskScore,
          active_trades: this.metrics.activeTrades,
          daily_pnl: this.metrics.dailyPnL,
          daily_pnl_percent: this.metrics.dailyPnLPercent,
          current_drawdown: this.metrics.currentDrawdown,
          current_drawdown_percent: this.metrics.currentDrawdownPercent,
          win_rate: this.metrics.winRate,
          trades_today: this.metrics.tradesToday,
          consecutive_losses: this.metrics.consecutiveLosses,
          system_uptime: this.metrics.systemUptime,
          last_optimization: this.metrics.lastOptimization,
          alerts_count: this.metrics.alerts.length,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('❌ Erro ao salvar métricas de monitoramento:', 'MONITORING', null, error as Error);
      }
    } catch (error) {
      logger.error('❌ Erro ao salvar métricas de monitoramento:', 'MONITORING', null, error as Error);
    }
  }

  /**
   * ✅ Obter métricas vazias
   */
  private getEmptyMetrics(): MonitoringMetrics {
    return {
      timestamp: Date.now(),
      systemHealth: 'healthy',
      performanceScore: 50,
      riskScore: 0,
      activeTrades: 0,
      dailyPnL: 0,
      dailyPnLPercent: 0,
      currentDrawdown: 0,
      currentDrawdownPercent: 0,
      winRate: 0,
      tradesToday: 0,
      consecutiveLosses: 0,
      systemUptime: 0,
      lastOptimization: 0,
      alerts: []
    };
  }

  /**
   * ✅ Obter métricas atuais
   */
  public getCurrentMetrics(): MonitoringMetrics | null {
    return this.metrics ? { ...this.metrics } : null;
  }

  /**
   * ✅ Obter alertas ativos
   */
  public getActiveAlerts(): MonitoringAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * ✅ Obter ajustes recentes
   */
  public getRecentAdjustments(limit: number = 10): DynamicAdjustment[] {
    return this.adjustments
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * ✅ Atualizar configuração
   */
  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logMonitoring('📊 Configuração de monitoramento atualizada', { newConfig });
  }

  /**
   * ✅ Adicionar trigger de otimização
   */
  public addOptimizationTrigger(trigger: OptimizationTrigger): void {
    this.optimizationTriggers.push(trigger);
    logMonitoring('🔧 Trigger de otimização adicionado', { trigger });
  }

  /**
   * ✅ Remover trigger de otimização
   */
  public removeOptimizationTrigger(condition: string): void {
    this.optimizationTriggers = this.optimizationTriggers.filter(t => t.condition !== condition);
    logMonitoring('🔧 Trigger de otimização removido', { condition });
  }

  /**
   * ✅ Resolver alerta
   */
  public resolveAlert(alertId: string, resolution: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolution = resolution;
      alert.resolvedAt = Date.now();
      logMonitoring('✅ Alerta resolvido', { alertId, resolution });
    }
  }

  /**
   * ✅ Verificar se está monitorando
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

export const continuousMonitoringModule = new ContinuousMonitoringModule();
export default ContinuousMonitoringModule;
