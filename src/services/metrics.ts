// ============================================================================
// SISTEMA DE MÉTRICAS KRONOS-X
// ============================================================================

import { EventEmitter } from 'events';
import {
  MetricsUpdate,
  SystemMetrics,
  ComponentHealth,
  HealthStatusLevel
} from '../types';

// ============================================================================
// INTERFACE DE MÉTRICAS
// ============================================================================

export interface MetricsData {
  equity: number;
  pnl_day: number;
  fills_ratio: number;
  selected_symbols: string[];
  notes: string;
  timestamp: number;
}

export interface PerformanceMetrics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  daily_pnl: number;
  sharpe_ratio: number;
  max_drawdown: number;
  profit_factor: number;
  average_win: number;
  average_loss: number;
  largest_win: number;
  largest_loss: number;
  consecutive_wins: number;
  consecutive_losses: number;
  last_updated: number;
}

export interface TradingMetrics {
  active_positions: number;
  max_positions: number;
  position_utilization: number;
  risk_exposure: number;
  margin_used: number;
  margin_available: number;
  leverage: number;
  last_trade_time: number;
}

export interface SystemHealthMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_latency_ms: number;
  active_connections: number;
  queue_size: number;
  error_rate: number;
  throughput_per_second: number;
  last_updated: number;
}

// ============================================================================
// CLASSE PRINCIPAL DE MÉTRICAS
// ============================================================================

export class Metrics extends EventEmitter {
  private static instance: Metrics;
  private data: MetricsData;
  private performance: PerformanceMetrics;
  private trading: TradingMetrics;
  private systemHealth: SystemHealthMetrics;
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.data = this.initializeMetricsData();
    this.performance = this.initializePerformanceMetrics();
    this.trading = this.initializeTradingMetrics();
    this.systemHealth = this.initializeSystemHealthMetrics();
    this.startUpdateLoop();
  }

  public static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  /**
   * Inicializa dados de métricas
   */
  private initializeMetricsData(): MetricsData {
    return {
      equity: 10000.0, // Valor inicial da conta
      pnl_day: 0.0,
      fills_ratio: 0.0,
      selected_symbols: [],
      notes: 'Sistema inicializado',
      timestamp: Date.now()
    };
  }

  /**
   * Inicializa métricas de performance
   */
  private initializePerformanceMetrics(): PerformanceMetrics {
    return {
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      win_rate: 0.0,
      total_pnl: 0.0,
      daily_pnl: 0.0,
      sharpe_ratio: 0.0,
      max_drawdown: 0.0,
      profit_factor: 0.0,
      average_win: 0.0,
      average_loss: 0.0,
      largest_win: 0.0,
      largest_loss: 0.0,
      consecutive_wins: 0,
      consecutive_losses: 0,
      last_updated: Date.now()
    };
  }

  /**
   * Inicializa métricas de trading
   */
  private initializeTradingMetrics(): TradingMetrics {
    return {
      active_positions: 0,
      max_positions: 5,
      position_utilization: 0.0,
      risk_exposure: 0.0,
      margin_used: 0.0,
      margin_available: 10000.0,
      leverage: 1.0,
      last_trade_time: 0
    };
  }

  /**
   * Inicializa métricas de saúde do sistema
   */
  private initializeSystemHealthMetrics(): SystemHealthMetrics {
    return {
      cpu_usage: 0.0,
      memory_usage: 0.0,
      disk_usage: 0.0,
      network_latency_ms: 0.0,
      active_connections: 0,
      queue_size: 0,
      error_rate: 0.0,
      throughput_per_second: 0.0,
      last_updated: Date.now()
    };
  }

  /**
   * Inicia loop de atualização de métricas
   */
  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      this.updateSystemHealth();
      this.emit('metrics_update', this.getMetricsUpdate());
    }, 5000); // Atualiza a cada 5 segundos
  }

  /**
   * Para loop de atualização
   */
  public stopUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Obtém dados de métricas atuais
   */
  public get(): MetricsData {
    return { ...this.data };
  }

  /**
   * Obtém métricas em formato de atualização
   */
  public getMetricsUpdate(): MetricsUpdate {
    return {
      equity: this.data.equity,
      pnl_day: this.data.pnl_day,
      fills_ratio: this.data.fills_ratio,
      selected_symbols: this.data.selected_symbols,
      notes: this.data.notes,
      timestamp: this.data.timestamp
    };
  }

  /**
   * Obtém métricas de performance
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performance };
  }

  /**
   * Obtém métricas de trading
   */
  public getTradingMetrics(): TradingMetrics {
    return { ...this.trading };
  }

  /**
   * Obtém métricas de saúde do sistema
   */
  public getSystemHealthMetrics(): SystemHealthMetrics {
    return { ...this.systemHealth };
  }

  /**
   * Atualiza métricas principais
   */
  public update(updater: (data: MetricsData) => void): void {
    updater(this.data);
    this.data.timestamp = Date.now();
    this.emit('metrics_update', this.getMetricsUpdate());
  }

  /**
   * Atualiza equity
   */
  public updateEquity(equity: number): void {
    this.data.equity = equity;
    this.data.timestamp = Date.now();
    this.emit('metrics_update', this.getMetricsUpdate());
  }

  /**
   * Atualiza PnL diário
   */
  public updateDailyPnL(pnl: number): void {
    this.data.pnl_day = pnl;
    this.data.timestamp = Date.now();
    this.emit('metrics_update', this.getMetricsUpdate());
  }

  /**
   * Atualiza taxa de preenchimento
   */
  public updateFillsRatio(ratio: number): void {
    this.data.fills_ratio = Math.min(ratio, 0.99); // Limita a 99%
    this.data.timestamp = Date.now();
    this.emit('metrics_update', this.getMetricsUpdate());
  }

  /**
   * Atualiza símbolos selecionados
   */
  public updateSelectedSymbols(symbols: string[]): void {
    this.data.selected_symbols = symbols;
    this.data.timestamp = Date.now();
    this.emit('metrics_update', this.getMetricsUpdate());
  }

  /**
   * Atualiza notas
   */
  public updateNotes(notes: string): void {
    this.data.notes = notes;
    this.data.timestamp = Date.now();
    this.emit('metrics_update', this.getMetricsUpdate());
  }

  /**
   * Atualiza métricas de performance
   */
  public updatePerformance(updater: (metrics: PerformanceMetrics) => void): void {
    updater(this.performance);
    this.performance.last_updated = Date.now();
    this.emit('performance_update', this.performance);
  }

  /**
   * Registra trade executado
   */
  public recordTrade(pnl: number, isWin: boolean): void {
    this.performance.total_trades++;
    
    if (isWin) {
      this.performance.winning_trades++;
      this.performance.consecutive_wins++;
      this.performance.consecutive_losses = 0;
      this.performance.largest_win = Math.max(this.performance.largest_win, pnl);
    } else {
      this.performance.losing_trades++;
      this.performance.consecutive_losses++;
      this.performance.consecutive_wins = 0;
      this.performance.largest_loss = Math.min(this.performance.largest_loss, pnl);
    }

    // Atualiza métricas calculadas
    this.performance.win_rate = this.performance.winning_trades / this.performance.total_trades;
    this.performance.total_pnl += pnl;
    this.performance.daily_pnl += pnl;

    // Calcula média de wins e losses
    if (this.performance.winning_trades > 0) {
      this.performance.average_win = this.performance.total_pnl / this.performance.winning_trades;
    }
    if (this.performance.losing_trades > 0) {
      this.performance.average_loss = Math.abs(this.performance.total_pnl / this.performance.losing_trades);
    }

    // Calcula profit factor
    if (this.performance.average_loss > 0) {
      this.performance.profit_factor = this.performance.average_win / this.performance.average_loss;
    }

    this.performance.last_updated = Date.now();
    this.emit('trade_recorded', { pnl, isWin, performance: this.performance });
  }

  /**
   * Atualiza métricas de trading
   */
  public updateTradingMetrics(updater: (metrics: TradingMetrics) => void): void {
    updater(this.trading);
    
    // Calcula utilização de posições
    this.trading.position_utilization = this.trading.active_positions / this.trading.max_positions;
    
    this.emit('trading_update', this.trading);
  }

  /**
   * Atualiza saúde do sistema
   */
  private updateSystemHealth(): void {
    // Simula métricas de sistema (em produção viriam de APIs reais)
    this.systemHealth.cpu_usage = Math.random() * 100;
    this.systemHealth.memory_usage = Math.random() * 100;
    this.systemHealth.disk_usage = Math.random() * 100;
    this.systemHealth.network_latency_ms = Math.random() * 100;
    this.systemHealth.active_connections = Math.floor(Math.random() * 50);
    this.systemHealth.queue_size = Math.floor(Math.random() * 100);
    this.systemHealth.error_rate = Math.random() * 0.1; // 0-10%
    this.systemHealth.throughput_per_second = Math.random() * 1000;
    this.systemHealth.last_updated = Date.now();
  }

  /**
   * Obtém status de saúde do sistema
   */
  public getSystemHealthStatus(): ComponentHealth[] {
    const components: ComponentHealth[] = [
      {
        component_name: 'CPU',
        status: this.systemHealth.cpu_usage > 80 ? HealthStatusLevel.CRITICAL : 
                this.systemHealth.cpu_usage > 60 ? HealthStatusLevel.WARNING : HealthStatusLevel.HEALTHY,
        response_time_ms: 0,
        last_check: Date.now(),
        metrics: { usage: this.systemHealth.cpu_usage }
      },
      {
        component_name: 'Memory',
        status: this.systemHealth.memory_usage > 90 ? HealthStatusLevel.CRITICAL : 
                this.systemHealth.memory_usage > 70 ? HealthStatusLevel.WARNING : HealthStatusLevel.HEALTHY,
        response_time_ms: 0,
        last_check: Date.now(),
        metrics: { usage: this.systemHealth.memory_usage }
      },
      {
        component_name: 'Network',
        status: this.systemHealth.network_latency_ms > 500 ? HealthStatusLevel.CRITICAL : 
                this.systemHealth.network_latency_ms > 200 ? HealthStatusLevel.WARNING : HealthStatusLevel.HEALTHY,
        response_time_ms: this.systemHealth.network_latency_ms,
        last_check: Date.now(),
        metrics: { latency: this.systemHealth.network_latency_ms }
      },
      {
        component_name: 'Queue',
        status: this.systemHealth.queue_size > 1000 ? HealthStatusLevel.CRITICAL : 
                this.systemHealth.queue_size > 500 ? HealthStatusLevel.WARNING : HealthStatusLevel.HEALTHY,
        response_time_ms: 0,
        last_check: Date.now(),
        metrics: { size: this.systemHealth.queue_size }
      }
    ];

    return components;
  }

  /**
   * Obtém resumo de status
   */
  public getStatusSummary(): any {
    const healthComponents = this.getSystemHealthStatus();
    const criticalIssues = healthComponents.filter(c => c.status === HealthStatusLevel.CRITICAL).length;
    const warnings = healthComponents.filter(c => c.status === HealthStatusLevel.WARNING).length;

    return {
      system_status: criticalIssues > 0 ? HealthStatusLevel.CRITICAL : 
                    warnings > 0 ? HealthStatusLevel.WARNING : HealthStatusLevel.HEALTHY,
      active_components: healthComponents.length,
      total_components: healthComponents.length,
      critical_issues: criticalIssues,
      warnings: warnings,
      uptime_percentage: 99.9, // Simulado
      last_updated: Date.now(),
      metrics: {
        equity: this.data.equity,
        pnl_day: this.data.pnl_day,
        win_rate: this.performance.win_rate,
        total_trades: this.performance.total_trades,
        active_positions: this.trading.active_positions
      }
    };
  }

  /**
   * Reseta métricas
   */
  public reset(): void {
    this.data = this.initializeMetricsData();
    this.performance = this.initializePerformanceMetrics();
    this.trading = this.initializeTradingMetrics();
    this.systemHealth = this.initializeSystemHealthMetrics();
    this.emit('metrics_reset');
  }

  /**
   * Exporta métricas para JSON
   */
  public exportMetrics(): string {
    return JSON.stringify({
      data: this.data,
      performance: this.performance,
      trading: this.trading,
      system_health: this.systemHealth,
      exported_at: Date.now()
    }, null, 2);
  }

  /**
   * Importa métricas de JSON
   */
  public importMetrics(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      if (data.data) this.data = data.data;
      if (data.performance) this.performance = data.performance;
      if (data.trading) this.trading = data.trading;
      if (data.system_health) this.systemHealth = data.system_health;
      this.emit('metrics_imported');
    } catch (error) {
      console.error('Erro ao importar métricas:', error);
    }
  }
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém instância singleton das métricas
 */
export function getMetrics(): Metrics {
  return Metrics.getInstance();
}

/**
 * Atualiza métricas principais
 */
export function updateMetrics(updater: (data: MetricsData) => void): void {
  getMetrics().update(updater);
}

/**
 * Registra trade executado
 */
export function recordTrade(pnl: number, isWin: boolean): void {
  getMetrics().recordTrade(pnl, isWin);
}

/**
 * Atualiza equity
 */
export function updateEquity(equity: number): void {
  getMetrics().updateEquity(equity);
}

/**
 * Atualiza PnL diário
 */
export function updateDailyPnL(pnl: number): void {
  getMetrics().updateDailyPnL(pnl);
}

/**
 * Atualiza símbolos selecionados
 */
export function updateSelectedSymbols(symbols: string[]): void {
  getMetrics().updateSelectedSymbols(symbols);
}

/**
 * Obtém métricas atuais
 */
export function getCurrentMetrics(): MetricsData {
  return getMetrics().get();
}

/**
 * Obtém métricas de performance
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  return getMetrics().getPerformanceMetrics();
}

/**
 * Obtém métricas de trading
 */
export function getTradingMetrics(): TradingMetrics {
  return getMetrics().getTradingMetrics();
}

/**
 * Obtém status de saúde do sistema
 */
export function getSystemHealthStatus(): ComponentHealth[] {
  return getMetrics().getSystemHealthStatus();
}

/**
 * Obtém resumo de status
 */
export function getStatusSummary(): any {
  return getMetrics().getStatusSummary();
}

/**
 * Atualiza status do sistema
 */
export function updateSystemStatus(statusData: any): void {
  const metrics = getMetrics();
  if (statusData.metrics) {
    metrics.updateMetrics((data) => {
      Object.assign(data, statusData.metrics);
    });
  }
  if (statusData.performance) {
    metrics.updateMetrics((data) => {
      Object.assign(data.performance, statusData.performance);
    });
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default Metrics;
