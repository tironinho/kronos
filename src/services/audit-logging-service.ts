/**
 * Sistema de Auditoria e Logs Detalhados
 * Implementa logging estruturado, auditoria de ações e rastreamento de eventos
 */

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  component: string;
  action: string;
  message: string;
  userId?: string;
  sessionId?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  sessionId: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata: Record<string, any>;
}

export interface LogFilter {
  level?: string[];
  component?: string[];
  action?: string[];
  userId?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditFilter {
  userId?: string;
  sessionId?: string;
  action?: string[];
  resource?: string[];
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

class AuditLoggingService {
  private logs: LogEntry[] = [];
  private auditEvents: AuditEvent[] = [];
  private isRunning = false;
  private logLevels = ['debug', 'info', 'warn', 'error', 'critical'];
  private components = [
    'trading-engine',
    'risk-manager',
    'position-sizer',
    'technical-analysis',
    'binance-api',
    'database',
    'websocket',
    'backup-service',
    'alert-service',
    'user-interface'
  ];

  constructor() {
    this.start();
  }

  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📝 Sistema de Auditoria e Logs iniciado');
    
    // Log inicial
    this.log('audit-logging', 'system-start', 'Sistema de auditoria e logs iniciado', 'info');
    
    // Limpeza de logs antigos a cada hora
    setInterval(() => {
      this.cleanupOldLogs();
    }, 3600000);
  }

  public stop(): void {
    this.isRunning = false;
    this.log('audit-logging', 'system-stop', 'Sistema de auditoria e logs parado', 'info');
    console.log('📝 Sistema de Auditoria e Logs parado');
  }

  public log(
    component: string,
    action: string,
    message: string,
    level: 'debug' | 'info' | 'warn' | 'error' | 'critical' = 'info',
    metadata: Record<string, any> = {},
    userId?: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): LogEntry {
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      component,
      action,
      message,
      userId,
      sessionId,
      metadata,
      ipAddress,
      userAgent
    };

    this.logs.unshift(logEntry);
    this.logs = this.logs.slice(0, 10000); // Manter apenas os últimos 10k logs

    // Log no console baseado no nível
    this.logToConsole(logEntry);

    return logEntry;
  }

  public audit(
    userId: string,
    sessionId: string,
    action: string,
    resource: string,
    resourceId?: string,
    oldValue?: any,
    newValue?: any,
    success: boolean = true,
    errorMessage?: string,
    metadata: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): AuditEvent {
    const auditEvent: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      sessionId,
      action,
      resource,
      resourceId,
      oldValue,
      newValue,
      ipAddress,
      userAgent,
      success,
      errorMessage,
      metadata
    };

    this.auditEvents.unshift(auditEvent);
    this.auditEvents = this.auditEvents.slice(0, 5000); // Manter apenas os últimos 5k eventos

    // Log da auditoria
    this.log(
      'audit-system',
      'audit-event',
      `Ação auditada: ${action} em ${resource}`,
      success ? 'info' : 'warn',
      {
        auditEvent: auditEvent,
        userId,
        sessionId,
        success
      }
    );

    return auditEvent;
  }

  private logToConsole(logEntry: LogEntry): void {
    const timestamp = logEntry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${logEntry.level.toUpperCase()}] [${logEntry.component}]`;
    
    switch (logEntry.level) {
      case 'debug':
        console.debug(`${prefix} ${logEntry.message}`, logEntry.metadata);
        break;
      case 'info':
        console.info(`${prefix} ${logEntry.message}`, logEntry.metadata);
        break;
      case 'warn':
        console.warn(`${prefix} ${logEntry.message}`, logEntry.metadata);
        break;
      case 'error':
        console.error(`${prefix} ${logEntry.message}`, logEntry.metadata);
        break;
      case 'critical':
        console.error(`🚨 CRITICAL ${prefix} ${logEntry.message}`, logEntry.metadata);
        break;
    }
  }

  public getLogs(filter: LogFilter = {}): LogEntry[] {
    let filteredLogs = [...this.logs];

    // Aplicar filtros
    if (filter.level && filter.level.length > 0) {
      filteredLogs = filteredLogs.filter(log => filter.level!.includes(log.level));
    }

    if (filter.component && filter.component.length > 0) {
      filteredLogs = filteredLogs.filter(log => filter.component!.includes(log.component));
    }

    if (filter.action && filter.action.length > 0) {
      filteredLogs = filteredLogs.filter(log => filter.action!.includes(log.action));
    }

    if (filter.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
    }

    if (filter.sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === filter.sessionId);
    }

    if (filter.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endDate!);
    }

    // Aplicar paginação
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    
    return filteredLogs.slice(offset, offset + limit);
  }

  public getAuditEvents(filter: AuditFilter = {}): AuditEvent[] {
    let filteredEvents = [...this.auditEvents];

    // Aplicar filtros
    if (filter.userId) {
      filteredEvents = filteredEvents.filter(event => event.userId === filter.userId);
    }

    if (filter.sessionId) {
      filteredEvents = filteredEvents.filter(event => event.sessionId === filter.sessionId);
    }

    if (filter.action && filter.action.length > 0) {
      filteredEvents = filteredEvents.filter(event => filter.action!.includes(event.action));
    }

    if (filter.resource && filter.resource.length > 0) {
      filteredEvents = filteredEvents.filter(event => filter.resource!.includes(event.resource));
    }

    if (filter.success !== undefined) {
      filteredEvents = filteredEvents.filter(event => event.success === filter.success);
    }

    if (filter.startDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp <= filter.endDate!);
    }

    // Aplicar paginação
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    
    return filteredEvents.slice(offset, offset + limit);
  }

  public getLogStats(): Record<string, any> {
    const total = this.logs.length;
    const byLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byComponent = this.logs.reduce((acc, log) => {
      acc[log.component] = (acc[log.component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byAction = this.logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const last24Hours = this.logs.filter(log => 
      log.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    const errors = this.logs.filter(log => 
      log.level === 'error' || log.level === 'critical'
    ).length;

    return {
      total,
      byLevel,
      byComponent,
      byAction,
      last24Hours,
      errors,
      errorRate: total > 0 ? (errors / total) * 100 : 0
    };
  }

  public getAuditStats(): Record<string, any> {
    const total = this.auditEvents.length;
    const successful = this.auditEvents.filter(event => event.success).length;
    const failed = this.auditEvents.filter(event => !event.success).length;

    const byAction = this.auditEvents.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byResource = this.auditEvents.reduce((acc, event) => {
      acc[event.resource] = (acc[event.resource] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byUser = this.auditEvents.reduce((acc, event) => {
      acc[event.userId] = (acc[event.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const last24Hours = this.auditEvents.filter(event => 
      event.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      byAction,
      byResource,
      byUser,
      last24Hours
    };
  }

  private cleanupOldLogs(): void {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias
    
    const oldLogsCount = this.logs.filter(log => log.timestamp < cutoffDate).length;
    const oldAuditCount = this.auditEvents.filter(event => event.timestamp < cutoffDate).length;
    
    if (oldLogsCount > 0 || oldAuditCount > 0) {
      this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);
      this.auditEvents = this.auditEvents.filter(event => event.timestamp >= cutoffDate);
      
      this.log(
        'audit-logging',
        'cleanup',
        `Limpeza de logs antigos: ${oldLogsCount} logs e ${oldAuditCount} eventos removidos`,
        'info'
      );
    }
  }

  // Métodos para integração com outros serviços
  public logTradingAction(
    action: string,
    symbol: string,
    side: string,
    quantity: number,
    price: number,
    success: boolean,
    errorMessage?: string,
    userId?: string,
    sessionId?: string
  ): void {
    this.log(
      'trading-engine',
      action,
      `Trading ${action}: ${side} ${quantity} ${symbol} @ ${price}`,
      success ? 'info' : 'error',
      {
        symbol,
        side,
        quantity,
        price,
        success,
        errorMessage
      },
      userId,
      sessionId
    );

    if (userId && sessionId) {
      this.audit(
        userId,
        sessionId,
        action,
        'trade',
        symbol,
        undefined,
        { symbol, side, quantity, price },
        success,
        errorMessage,
        { symbol, side, quantity, price }
      );
    }
  }

  public logRiskAction(
    action: string,
    riskLevel: string,
    details: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    this.log(
      'risk-manager',
      action,
      `Risk ${action}: ${riskLevel}`,
      riskLevel === 'high' ? 'warn' : 'info',
      details,
      userId,
      sessionId
    );
  }

  public logApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    error?: string
  ): void {
    this.log(
      'api-call',
      `${method} ${endpoint}`,
      `${service} API call: ${method} ${endpoint} - ${statusCode} (${responseTime}ms)`,
      statusCode >= 400 ? 'error' : 'info',
      {
        service,
        endpoint,
        method,
        statusCode,
        responseTime,
        error
      }
    );
  }

  public logSystemEvent(
    component: string,
    event: string,
    details: Record<string, any>,
    level: 'info' | 'warn' | 'error' | 'critical' = 'info'
  ): void {
    this.log(
      component,
      event,
      `System event: ${event}`,
      level,
      details
    );
  }

  // Métodos para exportação e análise
  public exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'component', 'action', 'message', 'userId', 'sessionId'];
      const csvRows = [headers.join(',')];
      
      this.logs.forEach(log => {
        const row = [
          log.timestamp.toISOString(),
          log.level,
          log.component,
          log.action,
          `"${log.message.replace(/"/g, '""')}"`,
          log.userId || '',
          log.sessionId || ''
        ];
        csvRows.push(row.join(','));
      });
      
      return csvRows.join('\n');
    }
    
    return JSON.stringify(this.logs, null, 2);
  }

  public exportAuditEvents(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'userId', 'sessionId', 'action', 'resource', 'resourceId', 'success'];
      const csvRows = [headers.join(',')];
      
      this.auditEvents.forEach(event => {
        const row = [
          event.timestamp.toISOString(),
          event.userId,
          event.sessionId,
          event.action,
          event.resource,
          event.resourceId || '',
          event.success.toString()
        ];
        csvRows.push(row.join(','));
      });
      
      return csvRows.join('\n');
    }
    
    return JSON.stringify(this.auditEvents, null, 2);
  }
}

export default new AuditLoggingService();
