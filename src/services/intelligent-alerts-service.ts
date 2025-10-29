/**
 * Sistema de Alertas Inteligentes
 * Implementa alertas com níveis de severidade, regras dinâmicas e notificações
 */

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface AlertNotification {
  type: 'email' | 'webhook' | 'slack' | 'discord';
  config: Record<string, any>;
  enabled: boolean;
}

class IntelligentAlertsService {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private notifications: AlertNotification[] = [];
  private isRunning = false;

  constructor() {
    this.initializeDefaultRules();
    this.initializeDefaultNotifications();
  }

  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'equity-drop',
        name: 'Queda Significativa de Equity',
        description: 'Alerta quando equity cai mais de 5% em 1 hora',
        condition: 'equity_change_percent < -5 AND time_window = "1h"',
        severity: 'high',
        enabled: true,
        cooldownMinutes: 30,
        triggerCount: 0
      },
      {
        id: 'high-drawdown',
        name: 'Drawdown Alto',
        description: 'Alerta quando drawdown excede 10%',
        condition: 'drawdown_percent > 10',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 15,
        triggerCount: 0
      },
      {
        id: 'low-win-rate',
        name: 'Taxa de Acerto Baixa',
        description: 'Alerta quando win rate fica abaixo de 40%',
        condition: 'win_rate < 40 AND total_trades > 10',
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 60,
        triggerCount: 0
      },
      {
        id: 'api-error-rate',
        name: 'Taxa de Erro de API Alta',
        description: 'Alerta quando taxa de erro da API excede 5%',
        condition: 'api_error_rate > 5',
        severity: 'high',
        enabled: true,
        cooldownMinutes: 10,
        triggerCount: 0
      },
      {
        id: 'position-size-large',
        name: 'Posição Muito Grande',
        description: 'Alerta quando posição excede 15% do capital',
        condition: 'position_size_percent > 15',
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 20,
        triggerCount: 0
      },
      {
        id: 'connection-lost',
        name: 'Conexão Perdida',
        description: 'Alerta quando conexão com exchange é perdida',
        condition: 'connection_status = "disconnected"',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
        triggerCount: 0
      },
      {
        id: 'unusual-volume',
        name: 'Volume Anômalo',
        description: 'Alerta quando volume é 3x maior que a média',
        condition: 'volume_ratio > 3',
        severity: 'low',
        enabled: true,
        cooldownMinutes: 15,
        triggerCount: 0
      },
      {
        id: 'profit-target-reached',
        name: 'Meta de Lucro Atingida',
        description: 'Alerta quando meta diária de lucro é atingida',
        condition: 'daily_pnl_percent >= profit_target_percent',
        severity: 'low',
        enabled: true,
        cooldownMinutes: 60,
        triggerCount: 0
      }
    ];
  }

  private initializeDefaultNotifications(): void {
    this.notifications = [
      {
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL || '',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN || ''}`
          }
        },
        enabled: !!process.env.ALERT_WEBHOOK_URL
      },
      {
        type: 'email',
        config: {
          smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
              user: process.env.SMTP_USER || '',
              pass: process.env.SMTP_PASS || ''
            }
          },
          from: process.env.SMTP_FROM || '',
          to: process.env.SMTP_TO || ''
        },
        enabled: !!process.env.SMTP_USER
      }
    ];
  }

  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚨 Sistema de Alertas Inteligentes iniciado');
    
    // Verificar alertas a cada 30 segundos
    setInterval(() => {
      this.checkAlerts();
    }, 30000);
  }

  public stop(): void {
    this.isRunning = false;
    console.log('🚨 Sistema de Alertas Inteligentes parado');
  }

  private async checkAlerts(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Buscar dados atuais do sistema
      const systemData = await this.getSystemData();
      
      // Verificar cada regra
      for (const rule of this.rules) {
        if (!rule.enabled) continue;
        
        // Verificar cooldown
        if (rule.lastTriggered) {
          const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
          if (timeSinceLastTrigger < rule.cooldownMinutes * 60 * 1000) {
            continue;
          }
        }

        // Avaliar condição
        if (await this.evaluateCondition(rule.condition, systemData)) {
          await this.triggerAlert(rule, systemData);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar alertas:', error);
    }
  }

  private async getSystemData(): Promise<Record<string, any>> {
    try {
      // Buscar dados do sistema via APIs internas
      const [equityRes, tradesRes, performanceRes] = await Promise.allSettled([
        fetch('/api/trading/equity'),
        fetch('/api/trading/metrics'),
        fetch('/api/trading/performance')
      ]);

      const equity = equityRes.status === 'fulfilled' ? await equityRes.value.json() : null;
      const trades = tradesRes.status === 'fulfilled' ? await tradesRes.value.json() : null;
      const performance = performanceRes.status === 'fulfilled' ? await performanceRes.value.json() : null;

      return {
        equity: equity?.data?.current || 0,
        equity_change_percent: equity?.data?.change_percent || 0,
        drawdown_percent: performance?.data?.max_drawdown || 0,
        win_rate: trades?.data?.win_rate || 0,
        total_trades: trades?.data?.total_trades || 0,
        api_error_rate: this.calculateApiErrorRate(),
        position_size_percent: this.calculatePositionSizePercent(),
        connection_status: this.getConnectionStatus(),
        volume_ratio: this.calculateVolumeRatio(),
        daily_pnl_percent: performance?.data?.daily_pnl_percent || 0,
        profit_target_percent: 5 // Meta de 5% ao dia
      };
    } catch (error) {
      console.error('Erro ao buscar dados do sistema:', error);
      return {};
    }
  }

  private async evaluateCondition(condition: string, data: Record<string, any>): Promise<boolean> {
    try {
      // Substituir variáveis na condição
      let evalCondition = condition;
      for (const [key, value] of Object.entries(data)) {
        evalCondition = evalCondition.replace(new RegExp(key, 'g'), String(value));
      }

      // Avaliar condição (versão simplificada)
      return this.safeEval(evalCondition);
    } catch (error) {
      console.error('Erro ao avaliar condição:', error);
      return false;
    }
  }

  private safeEval(expression: string): boolean {
    // Implementação segura de avaliação de expressões
    try {
      // Substituir operadores por funções JavaScript
      const safeExpression = expression
        .replace(/< /g, ' < ')
        .replace(/> /g, ' > ')
        .replace(/<=/g, ' <= ')
        .replace(/>=/g, ' >= ')
        .replace(/==/g, ' === ')
        .replace(/!=/g, ' !== ')
        .replace(/AND/g, '&&')
        .replace(/OR/g, '||');

      // Avaliar apenas expressões matemáticas e lógicas simples
      if (/^[0-9\s<>=!&|().-]+$/.test(safeExpression)) {
        return eval(safeExpression);
      }
      
      return false;
    } catch (error) {
      console.error('Erro na avaliação segura:', error);
      return false;
    }
  }

  private async triggerAlert(rule: AlertRule, systemData: Record<string, any>): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${rule.id}`,
      ruleId: rule.id,
      title: rule.name,
      message: this.generateAlertMessage(rule, systemData),
      severity: rule.severity,
      timestamp: new Date(),
      resolved: false,
      metadata: {
        rule: rule,
        systemData: systemData,
        triggerCount: rule.triggerCount + 1
      }
    };

    // Adicionar alerta à lista
    this.alerts.unshift(alert);
    this.alerts = this.alerts.slice(0, 1000); // Manter apenas os últimos 1000

    // Atualizar regra
    rule.lastTriggered = new Date();
    rule.triggerCount++;

    // Enviar notificações
    await this.sendNotifications(alert);

    console.log(`🚨 ALERTA ${rule.severity.toUpperCase()}: ${rule.name}`);
    console.log(`   Mensagem: ${alert.message}`);
  }

  private generateAlertMessage(rule: AlertRule, systemData: Record<string, any>): string {
    const messages = {
      'equity-drop': `Equity caiu ${systemData.equity_change_percent?.toFixed(2)}% nas últimas horas. Valor atual: $${systemData.equity?.toFixed(2)}`,
      'high-drawdown': `Drawdown crítico de ${systemData.drawdown_percent?.toFixed(2)}% detectado. Ação imediata necessária.`,
      'low-win-rate': `Taxa de acerto baixa: ${systemData.win_rate?.toFixed(1)}% em ${systemData.total_trades} trades.`,
      'api-error-rate': `Taxa de erro da API alta: ${systemData.api_error_rate?.toFixed(1)}%. Verificar conectividade.`,
      'position-size-large': `Posição muito grande: ${systemData.position_size_percent?.toFixed(1)}% do capital.`,
      'connection-lost': `Conexão com exchange perdida. Sistema pode estar offline.`,
      'unusual-volume': `Volume anômalo detectado: ${systemData.volume_ratio?.toFixed(1)}x a média normal.`,
      'profit-target-reached': `Meta diária de lucro atingida: ${systemData.daily_pnl_percent?.toFixed(2)}%.`
    };

    return messages[rule.id as keyof typeof messages] || rule.description;
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    for (const notification of this.notifications) {
      if (!notification.enabled) continue;

      try {
        switch (notification.type) {
          case 'webhook':
            await this.sendWebhookNotification(alert, notification.config);
            break;
          case 'email':
            await this.sendEmailNotification(alert, notification.config);
            break;
        }
      } catch (error) {
        console.error(`Erro ao enviar notificação ${notification.type}:`, error);
      }
    }
  }

  private async sendWebhookNotification(alert: Alert, config: any): Promise<void> {
    if (!config.url) return;

    const payload = {
      alert: {
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.timestamp.toISOString(),
        metadata: alert.metadata
      },
      system: 'Kronos-X Trading System'
    };

    await fetch(config.url, {
      method: 'POST',
      headers: config.headers || {},
      body: JSON.stringify(payload)
    });
  }

  private async sendEmailNotification(alert: Alert, config: any): Promise<void> {
    // Implementação simplificada - em produção usar biblioteca de email
    console.log(`📧 Email enviado para ${config.to}: ${alert.title}`);
  }

  // Métodos auxiliares
  private calculateApiErrorRate(): number {
    // Implementar cálculo baseado em logs de API
    return 0;
  }

  private calculatePositionSizePercent(): number {
    // Implementar cálculo baseado em posições ativas
    return 0;
  }

  private getConnectionStatus(): string {
    // Implementar verificação de status de conexão
    return 'connected';
  }

  private calculateVolumeRatio(): number {
    // Implementar cálculo de volume anômalo
    return 1;
  }

  // Métodos públicos para gerenciamento
  public getAlerts(limit = 50): Alert[] {
    return this.alerts.slice(0, limit);
  }

  public getRules(): AlertRule[] {
    return this.rules;
  }

  public addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  public updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex !== -1) {
      this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    }
  }

  public deleteRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  public resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
    }
  }

  public getAlertStats(): Record<string, any> {
    const total = this.alerts.length;
    const resolved = this.alerts.filter(a => a.resolved).length;
    const bySeverity = this.alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      resolved,
      unresolved: total - resolved,
      bySeverity,
      activeRules: this.rules.filter(r => r.enabled).length
    };
  }
}

export default new IntelligentAlertsService();
