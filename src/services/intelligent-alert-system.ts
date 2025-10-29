import { EventEmitter } from 'events';

interface Alert {
  id: string;
  type: 'DRAWDOWN' | 'LOSING_STREAK' | 'PERFORMANCE' | 'RISK' | 'SYSTEM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  data: any;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  type: string;
  condition: (data: any) => boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | ((data: any) => 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL');
  cooldown: number; // em minutos
  lastTriggered?: Date;
}

interface PerformanceThresholds {
  maxDrawdown: number;
  maxConsecutiveLosses: number;
  minWinRate: number;
  maxDailyLoss: number;
  minSharpeRatio: number;
  maxPositionSize: number;
}

export class IntelligentAlertSystem extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private thresholds: PerformanceThresholds;
  private isActive = false;

  constructor() {
    super();
    this.thresholds = {
      maxDrawdown: 15, // 15%
      maxConsecutiveLosses: 5,
      minWinRate: 40, // 40%
      maxDailyLoss: 5, // $5
      minSharpeRatio: 1.0,
      maxPositionSize: 20 // 20% do saldo
    };
    
    this.initializeRules();
  }

  /**
   * Inicializa regras de alerta
   */
  private initializeRules() {
    // Regra de Drawdown
    this.addRule({
      id: 'drawdown_alert',
      name: 'Drawdown Alert',
      type: 'DRAWDOWN',
      condition: (data: any) => data.drawdown > this.thresholds.maxDrawdown,
      severity: (data: any) => data.drawdown > 25 ? 'CRITICAL' : data.drawdown > 20 ? 'HIGH' : 'MEDIUM',
      cooldown: 30 // 30 minutos
    });

    // Regra de Sequência Perdedora
    this.addRule({
      id: 'losing_streak_alert',
      name: 'Losing Streak Alert',
      type: 'LOSING_STREAK',
      condition: (data: any) => data.consecutiveLosses >= this.thresholds.maxConsecutiveLosses,
      severity: (data: any) => data.consecutiveLosses >= 7 ? 'CRITICAL' : 'HIGH',
      cooldown: 15 // 15 minutos
    });

    // Regra de Performance Baixa
    this.addRule({
      id: 'low_performance_alert',
      name: 'Low Performance Alert',
      type: 'PERFORMANCE',
      condition: (data: any) => data.winRate < this.thresholds.minWinRate,
      severity: (data: any) => data.winRate < 25 ? 'HIGH' : 'MEDIUM',
      cooldown: 60 // 1 hora
    });

    // Regra de Perda Diária
    this.addRule({
      id: 'daily_loss_alert',
      name: 'Daily Loss Alert',
      type: 'RISK',
      condition: (data: any) => data.dailyLoss > this.thresholds.maxDailyLoss,
      severity: (data: any) => data.dailyLoss > 10 ? 'CRITICAL' : 'HIGH',
      cooldown: 5 // 5 minutos
    });

    // Regra de Sharpe Ratio Baixo
    this.addRule({
      id: 'low_sharpe_alert',
      name: 'Low Sharpe Ratio Alert',
      type: 'PERFORMANCE',
      condition: (data: any) => data.sharpeRatio < this.thresholds.minSharpeRatio,
      severity: (data: any) => data.sharpeRatio < 0.5 ? 'HIGH' : 'MEDIUM',
      cooldown: 120 // 2 horas
    });

    // Regra de Position Size Excessivo
    this.addRule({
      id: 'excessive_position_alert',
      name: 'Excessive Position Size Alert',
      type: 'RISK',
      condition: (data: any) => data.positionSizePercent > this.thresholds.maxPositionSize,
      severity: (data: any) => data.positionSizePercent > 30 ? 'CRITICAL' : 'HIGH',
      cooldown: 10 // 10 minutos
    });

    // Regra de Sistema (APIs falhando)
    this.addRule({
      id: 'api_failure_alert',
      name: 'API Failure Alert',
      type: 'SYSTEM',
      condition: (data: any) => data.apiFailures > 3,
      severity: 'MEDIUM',
      cooldown: 5 // 5 minutos
    });

    console.log('✅ IntelligentAlertSystem: Rules initialized');
  }

  /**
   * Adiciona uma regra de alerta
   */
  public addRule(rule: AlertRule) {
    this.rules.set(rule.id, rule);
    console.log(`📋 Alert rule added: ${rule.name}`);
  }

  /**
   * Remove uma regra de alerta
   */
  public removeRule(ruleId: string) {
    this.rules.delete(ruleId);
    console.log(`🗑️ Alert rule removed: ${ruleId}`);
  }

  /**
   * Ativa o sistema de alertas
   */
  public activate() {
    this.isActive = true;
    console.log('🚨 IntelligentAlertSystem: Activated');
  }

  /**
   * Desativa o sistema de alertas
   */
  public deactivate() {
    this.isActive = false;
    console.log('🛑 IntelligentAlertSystem: Deactivated');
  }

  /**
   * Processa dados e verifica alertas
   */
  public async processData(data: any) {
    if (!this.isActive) return;

    console.log('🔍 IntelligentAlertSystem: Processing data...');

    for (const [ruleId, rule] of this.rules) {
      try {
        // Verificar cooldown
        if (rule.lastTriggered) {
          const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
          const cooldownMs = rule.cooldown * 60 * 1000;
          
          if (timeSinceLastTrigger < cooldownMs) {
            continue; // Ainda em cooldown
          }
        }

        // Verificar condição
        if (rule.condition(data)) {
          await this.triggerAlert(rule, data);
          rule.lastTriggered = new Date();
        }
      } catch (error) {
        console.error(`❌ Error processing rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Dispara um alerta
   */
  private async triggerAlert(rule: AlertRule, data: any) {
    const alertId = `${rule.id}_${Date.now()}`;
    const severity = typeof rule.severity === 'function' ? rule.severity(data) : rule.severity;
    
    const alert: Alert = {
      id: alertId,
      type: rule.type as any,
      severity,
      title: rule.name,
      message: this.generateAlertMessage(rule, data),
      data,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false
    };

    this.alerts.set(alertId, alert);

    console.log(`🚨 ALERT TRIGGERED: ${alert.title} (${alert.severity})`);
    console.log(`   Message: ${alert.message}`);

    // Emitir evento
    this.emit('alert', alert);

    // Ações automáticas baseadas no tipo de alerta
    await this.executeAutomaticActions(alert);
  }

  /**
   * Gera mensagem do alerta
   */
  private generateAlertMessage(rule: AlertRule, data: any): string {
    switch (rule.id) {
      case 'drawdown_alert':
        return `Drawdown de ${data.drawdown.toFixed(2)}% detectado. Máximo permitido: ${this.thresholds.maxDrawdown}%`;
      
      case 'losing_streak_alert':
        return `${data.consecutiveLosses} trades perdedores consecutivos. Máximo permitido: ${this.thresholds.maxConsecutiveLosses}`;
      
      case 'low_performance_alert':
        return `Win rate baixo: ${data.winRate.toFixed(2)}%. Mínimo esperado: ${this.thresholds.minWinRate}%`;
      
      case 'daily_loss_alert':
        return `Perda diária de $${data.dailyLoss.toFixed(2)}. Máximo permitido: $${this.thresholds.maxDailyLoss}`;
      
      case 'low_sharpe_alert':
        return `Sharpe ratio baixo: ${data.sharpeRatio.toFixed(2)}. Mínimo esperado: ${this.thresholds.minSharpeRatio}`;
      
      case 'excessive_position_alert':
        return `Position size excessivo: ${data.positionSizePercent.toFixed(2)}%. Máximo permitido: ${this.thresholds.maxPositionSize}%`;
      
      case 'api_failure_alert':
        return `${data.apiFailures} falhas de API detectadas nas últimas verificações`;
      
      default:
        return `Alerta: ${rule.name} - Condição atendida`;
    }
  }

  /**
   * Executa ações automáticas baseadas no alerta
   */
  private async executeAutomaticActions(alert: Alert) {
    console.log(`🔧 Executing automatic actions for alert: ${alert.id}`);

    switch (alert.type) {
      case 'DRAWDOWN':
        if (alert.severity === 'CRITICAL') {
          this.emit('emergencyStop', alert);
          console.log('🛑 EMERGENCY STOP: Critical drawdown detected');
        } else if (alert.severity === 'HIGH') {
          this.emit('reducePositionSize', { factor: 0.5 });
          console.log('📉 Reducing position size by 50%');
        }
        break;

      case 'LOSING_STREAK':
        if (alert.severity === 'CRITICAL') {
          this.emit('pauseTrading', { duration: 3600000 }); // 1 hora
          console.log('⏸️ Pausing trading for 1 hour');
        } else {
          this.emit('increaseConfidenceThreshold', { increment: 10 });
          console.log('📈 Increasing confidence threshold by 10%');
        }
        break;

      case 'PERFORMANCE':
        this.emit('optimizeStrategy', alert.data);
        console.log('🔧 Triggering strategy optimization');
        break;

      case 'RISK':
        this.emit('tightenRiskManagement', alert.data);
        console.log('🛡️ Tightening risk management');
        break;

      case 'SYSTEM':
        this.emit('switchToFallback', alert.data);
        console.log('🔄 Switching to fallback systems');
        break;
    }
  }

  /**
   * Reconhece um alerta
   */
  public acknowledgeAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`✅ Alert acknowledged: ${alertId}`);
      this.emit('alertAcknowledged', alert);
    }
  }

  /**
   * Resolve um alerta
   */
  public resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`✅ Alert resolved: ${alertId}`);
      this.emit('alertResolved', alert);
    }
  }

  /**
   * Obtém alertas ativos
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Obtém alertas por severidade
   */
  public getAlertsBySeverity(severity: string): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => 
      alert.severity === severity && !alert.resolved
    );
  }

  /**
   * Obtém estatísticas de alertas
   */
  public getAlertStatistics() {
    const alerts = Array.from(this.alerts.values());
    const activeAlerts = alerts.filter(alert => !alert.resolved);
    const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged);
    const resolvedAlerts = alerts.filter(alert => alert.resolved);

    const severityCounts = {
      LOW: alerts.filter(a => a.severity === 'LOW').length,
      MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
      HIGH: alerts.filter(a => a.severity === 'HIGH').length,
      CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length
    };

    const typeCounts = {
      DRAWDOWN: alerts.filter(a => a.type === 'DRAWDOWN').length,
      LOSING_STREAK: alerts.filter(a => a.type === 'LOSING_STREAK').length,
      PERFORMANCE: alerts.filter(a => a.type === 'PERFORMANCE').length,
      RISK: alerts.filter(a => a.type === 'RISK').length,
      SYSTEM: alerts.filter(a => a.type === 'SYSTEM').length
    };

    return {
      total: alerts.length,
      active: activeAlerts.length,
      acknowledged: acknowledgedAlerts.length,
      resolved: resolvedAlerts.length,
      severityCounts,
      typeCounts,
      lastAlert: alerts.length > 0 ? alerts[alerts.length - 1] : null
    };
  }

  /**
   * Atualiza thresholds
   */
  public updateThresholds(newThresholds: Partial<PerformanceThresholds>) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('📊 Alert thresholds updated:', newThresholds);
  }

  /**
   * Limpa alertas antigos
   */
  public cleanupOldAlerts(daysOld: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let cleanedCount = 0;
    for (const [alertId, alert] of this.alerts) {
      if (new Date(alert.timestamp) < cutoffDate && alert.resolved) {
        this.alerts.delete(alertId);
        cleanedCount++;
      }
    }

    console.log(`🧹 Cleaned up ${cleanedCount} old alerts`);
  }

  /**
   * Obtém status do sistema
   */
  public getStatus() {
    return {
      isActive: this.isActive,
      totalRules: this.rules.size,
      totalAlerts: this.alerts.size,
      activeAlerts: this.getActiveAlerts().length,
      criticalAlerts: this.getAlertsBySeverity('CRITICAL').length,
      thresholds: this.thresholds
    };
  }
}

export const intelligentAlertSystem = new IntelligentAlertSystem();
