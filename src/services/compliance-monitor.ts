/**
 * COMPLIANCE MONITOR
 * 
 * Sistema de monitoramento de conformidade com regras e alertas automáticos
 * Detecta violações e dispara alertas em tempo real
 */

import { supabase } from './supabase-db';
import TradingConfigurationService from './trading-configuration-service';

interface ComplianceCheck {
  rule: string;
  status: 'compliant' | 'violation' | 'warning';
  currentValue: any;
  expectedValue: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

interface ComplianceReport {
  timestamp: Date;
  overallCompliance: boolean;
  checks: ComplianceCheck[];
  violations: ComplianceCheck[];
  warnings: ComplianceCheck[];
}

export class ComplianceMonitor {
  private static instance: ComplianceMonitor;
  private configService = TradingConfigurationService.getInstance();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // 1 minuto

  private constructor() {}

  public static getInstance(): ComplianceMonitor {
    if (!ComplianceMonitor.instance) {
      ComplianceMonitor.instance = new ComplianceMonitor();
    }
    return ComplianceMonitor.instance;
  }

  /**
   * Inicia monitoramento contínuo
   */
  public startMonitoring(): void {
    if (this.checkInterval) {
      return; // Já está rodando
    }

    console.log('🔒 Sistema de monitoramento de conformidade iniciado');

    // Primeira verificação imediata
    this.checkCompliance().catch(err => {
      console.error('❌ Erro na verificação inicial de conformidade:', err);
    });

    // Verificações periódicas
    this.checkInterval = setInterval(() => {
      this.checkCompliance().catch(err => {
        console.error('❌ Erro na verificação periódica de conformidade:', err);
      });
    }, this.CHECK_INTERVAL);
  }

  /**
   * Para monitoramento
   */
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🔒 Sistema de monitoramento de conformidade parado');
    }
  }

  /**
   * Executa verificação completa de conformidade
   */
  public async checkCompliance(): Promise<ComplianceReport> {
    const checks: ComplianceCheck[] = [];
    
    try {
      // 1. Verificar limite de trades abertas
      const maxTradesCheck = await this.checkMaxOpenTrades();
      checks.push(maxTradesCheck);

      // 2. Verificar limite por símbolo
      const maxPerSymbolChecks = await this.checkMaxPerSymbol();
      checks.push(...maxPerSymbolChecks);

      // 3. Verificar confiança mínima nas trades abertas
      const minConfidenceCheck = await this.checkMinConfidence();
      checks.push(minConfidenceCheck);

      // 4. Verificar drawdown máximo
      const drawdownCheck = await this.checkMaxDrawdown();
      checks.push(drawdownCheck);

      // 5. Verificar perda diária máxima
      const dailyLossCheck = await this.checkMaxDailyLoss();
      checks.push(dailyLossCheck);

      // Filtrar violações e avisos
      const violations = checks.filter((c: ComplianceCheck) => c.status === 'violation');
      const warnings = checks.filter((c: ComplianceCheck) => c.status === 'warning');

      // Disparar alertas se houver violações críticas
      if (violations.some((v: ComplianceCheck) => v.severity === 'critical' || v.severity === 'high')) {
        await this.createAlerts(violations.filter((v: ComplianceCheck) => v.severity === 'critical' || v.severity === 'high'));
      }

      const report: ComplianceReport = {
        timestamp: new Date(),
        overallCompliance: violations.length === 0,
        checks,
        violations,
        warnings
      };

      // Log resumido
      if (violations.length > 0) {
        console.log(`🚨 ${violations.length} violação(ões) de conformidade detectada(s)`);
        violations.forEach(v => {
          console.log(`   ❌ ${v.rule}: ${v.message}`);
        });
      }

      return report;

    } catch (error) {
      console.error('❌ Erro ao verificar conformidade:', error);
      
      return {
        timestamp: new Date(),
        overallCompliance: false,
        checks,
        violations: [],
        warnings: []
      };
    }
  }

  /**
   * Verifica limite máximo de trades abertas
   */
  private async checkMaxOpenTrades(): Promise<ComplianceCheck> {
    const config = this.configService.getTradeLimits();
    const maxActiveTrades = config.maxActiveTrades || this.configService.getRiskManagement().maxTotalPositions;

    const { data: openTrades, error } = await supabase
      .from('real_trades')
      .select('trade_id')
      .eq('status', 'open');

    const currentCount = openTrades?.length || 0;
    const isViolation = maxActiveTrades && currentCount > maxActiveTrades;

    return {
      rule: 'maxActiveTrades',
      status: isViolation ? 'violation' : 'compliant',
      currentValue: currentCount,
      expectedValue: maxActiveTrades,
      severity: isViolation ? 'critical' : 'low',
      message: isViolation
        ? `CRÍTICO: ${currentCount} trades abertas, limite é ${maxActiveTrades}`
        : `${currentCount}/${maxActiveTrades} trades abertas (OK)`
    };
  }

  /**
   * Verifica limite por símbolo
   */
  private async checkMaxPerSymbol(): Promise<ComplianceCheck[]> {
    const config = this.configService.getRiskManagement();
    const maxPerSymbol = config.maxPositionsPerSymbol;

    const { data: openTrades, error } = await supabase
      .from('real_trades')
      .select('symbol')
      .eq('status', 'open');

    if (!openTrades || openTrades.length === 0) {
      return [];
    }

    // Contar trades por símbolo
    const tradesBySymbol: { [key: string]: number } = {};
    openTrades.forEach((t: any) => {
      tradesBySymbol[t.symbol] = (tradesBySymbol[t.symbol] || 0) + 1;
    });

    const checks: ComplianceCheck[] = [];

    Object.entries(tradesBySymbol).forEach(([symbol, count]) => {
      const isViolation = count > maxPerSymbol;
      checks.push({
        rule: `maxPositionsPerSymbol_${symbol}`,
        status: isViolation ? 'violation' : 'compliant',
        currentValue: count,
        expectedValue: maxPerSymbol,
        severity: isViolation ? 'high' : 'low',
        message: isViolation
          ? `${symbol}: ${count} trades, limite é ${maxPerSymbol}`
          : `${symbol}: ${count}/${maxPerSymbol} (OK)`
      });
    });

    return checks;
  }

  /**
   * Verifica confiança mínima nas trades abertas
   */
  private async checkMinConfidence(): Promise<ComplianceCheck> {
    const config = this.configService.getQualityFilters();
    const minConfidence = config.minConfidence;

    const { data: openTrades, error } = await supabase
      .from('real_trades')
      .select('confidence')
      .eq('status', 'open');

    if (!openTrades || openTrades.length === 0) {
      return {
        rule: 'minConfidence',
        status: 'compliant',
        currentValue: 'N/A',
        expectedValue: minConfidence,
        severity: 'low',
        message: 'Nenhuma trade aberta'
      };
    }

    const lowConfidenceTrades = openTrades.filter((t: any) => 
      parseFloat(t.confidence?.toString() || '0') < minConfidence
    );

    const isViolation = lowConfidenceTrades.length > 0;
    const avgConfidence = openTrades.reduce((sum: number, t: any) => 
      sum + parseFloat(t.confidence?.toString() || '0'), 0
    ) / openTrades.length;

    return {
      rule: 'minConfidence',
      status: isViolation ? 'violation' : 'compliant',
      currentValue: avgConfidence.toFixed(1),
      expectedValue: minConfidence,
      severity: isViolation ? 'high' : 'low',
      message: isViolation
        ? `${lowConfidenceTrades.length} trade(s) com confiança < ${minConfidence}%`
        : `Confiança média: ${avgConfidence.toFixed(1)}% (OK)`
    };
  }

  /**
   * Verifica drawdown máximo
   */
  private async checkMaxDrawdown(): Promise<ComplianceCheck> {
    const config = this.configService.getRiskManagement();
    const maxDrawdownPct = config.maxDrawdownPct;

    // Buscar equity history para calcular drawdown
    const { data: equityHistory, error } = await supabase
      .from('equity_history')
      .select('equity')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (!equityHistory || equityHistory.length < 2) {
      return {
        rule: 'maxDrawdown',
        status: 'warning',
        currentValue: 'N/A',
        expectedValue: maxDrawdownPct,
        severity: 'low',
        message: 'Dados insuficientes para calcular drawdown'
      };
    }

    const equities = equityHistory.map((e: any) => parseFloat(e.equity?.toString() || '0')).filter((e: number) => e > 0);
    const maxEquity = Math.max(...equities);
    const currentEquity = equities[equities.length - 1];
    const drawdownPercent = maxEquity > 0 ? ((maxEquity - currentEquity) / maxEquity) * 100 : 0;

    const isViolation = drawdownPercent > maxDrawdownPct;

    return {
      rule: 'maxDrawdown',
      status: isViolation ? 'violation' : (drawdownPercent > maxDrawdownPct * 0.8 ? 'warning' : 'compliant'),
      currentValue: drawdownPercent.toFixed(2),
      expectedValue: maxDrawdownPct,
      severity: isViolation ? 'critical' : (drawdownPercent > maxDrawdownPct * 0.8 ? 'medium' : 'low'),
      message: isViolation
        ? `CRÍTICO: Drawdown ${drawdownPercent.toFixed(2)}% > ${maxDrawdownPct}%`
        : `Drawdown: ${drawdownPercent.toFixed(2)}% (OK)`
    };
  }

  /**
   * Verifica perda diária máxima
   */
  private async checkMaxDailyLoss(): Promise<ComplianceCheck> {
    const config = this.configService.getRiskManagement();
    const maxDailyLossPct = config.maxDailyLossPct;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayTrades, error } = await supabase
      .from('real_trades')
      .select('pnl, pnl_percent')
      .eq('status', 'closed')
      .gte('closed_at', today.toISOString());

    if (!todayTrades || todayTrades.length === 0) {
      return {
        rule: 'maxDailyLoss',
        status: 'compliant',
        currentValue: '0',
        expectedValue: maxDailyLossPct,
        severity: 'low',
        message: 'Nenhuma trade fechada hoje'
      };
    }

    const totalLoss = todayTrades
      .filter((t: any) => parseFloat(t.pnl?.toString() || '0') < 0)
      .reduce((sum: number, t: any) => sum + Math.abs(parseFloat(t.pnl?.toString() || '0')), 0);

    // Obter equity inicial do dia
    const { data: initialEquity } = await supabase
      .from('equity_history')
      .select('equity')
      .lte('timestamp', today.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1);

    const initialEquityValue = initialEquity?.[0]?.equity 
      ? parseFloat(initialEquity[0].equity.toString()) 
      : 1000; // Fallback

    const dailyLossPercent = initialEquityValue > 0 
      ? (totalLoss / initialEquityValue) * 100 
      : 0;

    const isViolation = dailyLossPercent > maxDailyLossPct;

    return {
      rule: 'maxDailyLoss',
      status: isViolation ? 'violation' : (dailyLossPercent > maxDailyLossPct * 0.8 ? 'warning' : 'compliant'),
      currentValue: dailyLossPercent.toFixed(2),
      expectedValue: maxDailyLossPct,
      severity: isViolation ? 'critical' : 'low',
      message: isViolation
        ? `CRÍTICO: Perda diária ${dailyLossPercent.toFixed(2)}% > ${maxDailyLossPct}%`
        : `Perda diária: ${dailyLossPercent.toFixed(2)}% (OK)`
    };
  }

  /**
   * Cria alertas no banco de dados
   */
  private async createAlerts(violations: ComplianceCheck[]): Promise<void> {
    for (const violation of violations) {
      try {
        await supabase.from('system_alerts').insert({
          alert_type: 'compliance_violation',
          severity: violation.severity,
          symbol: null,
          title: `Violação de Conformidade: ${violation.rule}`,
          message: violation.message,
          is_read: false,
          is_resolved: false,
          related_data: {
            rule: violation.rule,
            currentValue: violation.currentValue,
            expectedValue: violation.expectedValue
          }
        });
      } catch (error) {
        console.error(`❌ Erro ao criar alerta para ${violation.rule}:`, error);
      }
    }
  }

  /**
   * Obtém último relatório de conformidade
   */
  public getLastReport(): ComplianceReport | null {
    // Em produção, seria salvo em cache ou banco
    // Por enquanto, precisa rodar checkCompliance() novamente
    return null;
  }
}

export const complianceMonitor = ComplianceMonitor.getInstance();

