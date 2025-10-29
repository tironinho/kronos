/**
 * Decision Gates (N0-N5)
 * 
 * Validação em múltiplos níveis antes de executar ordem:
 * - N0: Dados válidos (latência, heartbeat)
 * - N1: Confiança mínima do modelo
 * - N2: Consenso entre modelos/regimes
 * - N3: Risk gates
 * - N4: Execução viável
 * - N5: Juiz IA (referee)
 */

import { MicrostructuralFeatures } from './feature-store';
import { MarketRegime } from './regime-detection';
import { Tick } from './tick-ingestion';

export interface DecisionGateResult {
  passed: boolean;
  gate: 'N0' | 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
  reason: string;
  reasonCode: string;
  metadata?: any;
}

export interface ModelPrediction {
  modelId: string;
  probability: number; // 0-1
  expectedBps: number; // Basis points esperados
  confidence: number; // 0-1
  regime: MarketRegime | null;
  features: MicrostructuralFeatures | null;
}

export interface DecisionContext {
  symbol: string;
  timestamp: number;
  predictions: ModelPrediction[];
  currentRegime: MarketRegime;
  features: MicrostructuralFeatures;
  openPositions: any[];
  accountBalance: number;
  riskMetrics: {
    dailyPnL: number;
    drawdown: number;
    var: number;
  };
}

export interface ValidationResult {
  approved: boolean;
  action: 'BUY' | 'SELL' | 'HOLD';
  size: number; // Original ou reduzido
  gates: DecisionGateResult[];
  reasonCodes: string[];
  expectedValue: number;
  riskAdjustedSize: number;
}

export class DecisionGatesValidator {
  private static instance: DecisionGatesValidator;
  
  // Thresholds
  private readonly MIN_LATENCY_MS = 100;
  private readonly MIN_PROBABILITY = 0.55; // 55% mínimo
  private readonly MIN_EXPECTED_BPS = 5; // 5 bps mínimo para cobrir custos
  private readonly MIN_CONSENSUS_MODELS = 2; // Pelo menos 2 modelos concordando
  private readonly MAX_DAILY_LOSS_PCT = 1.5;
  private readonly MAX_DRAWDOWN_PCT = 8;
  private readonly MAX_POSITION_SIZE_PCT = 5; // 5% do capital por trade
  private readonly MAX_CORRELATION = 0.7; // Máxima correlação com posições abertas

  private constructor() {}

  public static getInstance(): DecisionGatesValidator {
    if (!DecisionGatesValidator.instance) {
      DecisionGatesValidator.instance = new DecisionGatesValidator();
    }
    return DecisionGatesValidator.instance;
  }

  /**
   * Valida decisão através de todos os gates (N0-N5)
   */
  public async validateDecision(context: DecisionContext): Promise<ValidationResult> {
    const gates: DecisionGateResult[] = [];

    // N0: Dados válidos
    const n0 = await this.validateN0(context);
    gates.push(n0);
    if (!n0.passed) {
      return this.createRejectionResult(gates, 'N0_FAILED', n0.reason);
    }

    // N1: Confiança mínima do modelo
    const n1 = await this.validateN1(context);
    gates.push(n1);
    if (!n1.passed) {
      return this.createRejectionResult(gates, 'N1_FAILED', n1.reason);
    }

    // N2: Consenso entre modelos
    const n2 = await this.validateN2(context);
    gates.push(n2);
    if (!n2.passed) {
      return this.createRejectionResult(gates, 'N2_FAILED', n2.reason);
    }

    // N3: Risk gates
    const n3 = await this.validateN3(context);
    gates.push(n3);
    if (!n3.passed) {
      return this.createRejectionResult(gates, 'N3_FAILED', n3.reason);
    }

    // N4: Execução viável
    const n4 = await this.validateN4(context);
    gates.push(n4);
    if (!n4.passed) {
      return this.createRejectionResult(gates, 'N4_FAILED', n4.reason);
    }

    // N5: Juiz IA (referee)
    const n5 = await this.validateN5(context, gates);
    gates.push(n5);
    if (!n5.passed) {
      return this.createRejectionResult(gates, 'N5_FAILED', n5.reason);
    }

    // Todos os gates passaram - calcular tamanho final
    const size = this.calculatePositionSize(context);
    const expectedValue = this.calculateExpectedValue(context);

    return {
      approved: true,
      action: this.determineAction(context),
      size,
      gates,
      reasonCodes: gates.map(g => g.reasonCode).filter(c => c.startsWith('OK_')),
      expectedValue,
      riskAdjustedSize: size
    };
  }

  /**
   * N0: Validação de dados (latência, heartbeat)
   */
  private async validateN0(context: DecisionContext): Promise<DecisionGateResult> {
    // Importar tick ingestion
    const { tickIngestion } = await import('./tick-ingestion');
    const dataQuality = tickIngestion.validateDataQuality(context.symbol);

    if (!dataQuality.valid) {
      return {
        passed: false,
        gate: 'N0',
        reason: `Dados inválidos: latência ${dataQuality.latency.toFixed(0)}ms, heartbeat ${dataQuality.heartbeatOk}, age ${dataQuality.lastTickAge.toFixed(0)}ms`,
        reasonCode: 'N0_DATA_INVALID'
      };
    }

    if (dataQuality.latency > this.MIN_LATENCY_MS) {
      return {
        passed: false,
        gate: 'N0',
        reason: `Latência alta: ${dataQuality.latency.toFixed(0)}ms > ${this.MIN_LATENCY_MS}ms`,
        reasonCode: 'N0_HIGH_LATENCY'
      };
    }

    return {
      passed: true,
      gate: 'N0',
      reason: 'Dados válidos',
      reasonCode: 'OK_N0_DATA_VALID',
      metadata: { latency: dataQuality.latency, heartbeatOk: dataQuality.heartbeatOk }
    };
  }

  /**
   * N1: Confiança mínima do modelo
   */
  private async validateN1(context: DecisionContext): Promise<DecisionGateResult> {
    if (context.predictions.length === 0) {
      return {
        passed: false,
        gate: 'N1',
        reason: 'Nenhuma predição disponível',
        reasonCode: 'N1_NO_PREDICTIONS'
      };
    }

    // Encontrar melhor predição
    const bestPrediction = context.predictions.reduce((best, pred) => 
      pred.probability > best.probability ? pred : best
    );

    if (bestPrediction.probability < this.MIN_PROBABILITY) {
      return {
        passed: false,
        gate: 'N1',
        reason: `Probabilidade ${(bestPrediction.probability * 100).toFixed(1)}% < ${(this.MIN_PROBABILITY * 100)}%`,
        reasonCode: 'N1_LOW_PROBABILITY'
      };
    }

    if (bestPrediction.expectedBps < this.MIN_EXPECTED_BPS) {
      return {
        passed: false,
        gate: 'N1',
        reason: `Expected BPS ${bestPrediction.expectedBps.toFixed(1)} < ${this.MIN_EXPECTED_BPS}`,
        reasonCode: 'N1_LOW_EXPECTED_VALUE'
      };
    }

    return {
      passed: true,
      gate: 'N1',
      reason: `Modelo confiável: ${(bestPrediction.probability * 100).toFixed(1)}%, ${bestPrediction.expectedBps.toFixed(1)}bps`,
      reasonCode: 'OK_N1_CONFIDENCE_OK',
      metadata: { probability: bestPrediction.probability, expectedBps: bestPrediction.expectedBps }
    };
  }

  /**
   * N2: Consenso entre modelos/regimes
   */
  private async validateN2(context: DecisionContext): Promise<DecisionGateResult> {
    if (context.predictions.length < this.MIN_CONSENSUS_MODELS) {
      return {
        passed: false,
        gate: 'N2',
        reason: `Apenas ${context.predictions.length} modelo(s), necessário ${this.MIN_CONSENSUS_MODELS}`,
        reasonCode: 'N2_INSUFFICIENT_MODELS'
      };
    }

    // Agrupar por ação prevista
    const buyPredictions = context.predictions.filter(p => p.expectedBps > 0 && p.probability >= this.MIN_PROBABILITY);
    const sellPredictions = context.predictions.filter(p => p.expectedBps < 0 && p.probability >= this.MIN_PROBABILITY);

    // Requer consenso: pelo menos 2 modelos concordando
    const hasBuyConsensus = buyPredictions.length >= this.MIN_CONSENSUS_MODELS;
    const hasSellConsensus = sellPredictions.length >= this.MIN_CONSENSUS_MODELS;

    if (!hasBuyConsensus && !hasSellConsensus) {
      return {
        passed: false,
        gate: 'N2',
        reason: `Sem consenso: ${buyPredictions.length} BUY, ${sellPredictions.length} SELL`,
        reasonCode: 'N2_NO_CONSENSUS'
      };
    }

    // Verificar se regime está alinhado
    const regime = context.currentRegime;
    const action = hasBuyConsensus ? 'BUY' : 'SELL';
    
    // Em regime de tendência, seguir direção
    // Em regime de mean-reversion, ir contra
    let regimeAligned = true;
    if (regime.type === 'TRENDING') {
      // Trend: BUY em momentum positivo, SELL em negativo
      const momentum = context.features.microMomentum;
      regimeAligned = (action === 'BUY' && momentum > 0) || (action === 'SELL' && momentum < 0);
    } else if (regime.type === 'MEAN_REVERTING') {
      // Mean-reversion: BUY quando oversold, SELL quando overbought
      const ofi = context.features.ofi;
      regimeAligned = (action === 'BUY' && ofi < -0.3) || (action === 'SELL' && ofi > 0.3);
    }

    if (!regimeAligned) {
      return {
        passed: false,
        gate: 'N2',
        reason: `Ação ${action} não alinhada com regime ${regime.type}`,
        reasonCode: 'N2_REGIME_MISMATCH'
      };
    }

    return {
      passed: true,
      gate: 'N2',
      reason: `Consenso alcançado: ${hasBuyConsensus ? buyPredictions.length : sellPredictions.length} modelos ${action}`,
      reasonCode: 'OK_N2_CONSENSUS',
      metadata: { consensusCount: hasBuyConsensus ? buyPredictions.length : sellPredictions.length, action }
    };
  }

  /**
   * N3: Risk gates
   */
  private async validateN3(context: DecisionContext): Promise<DecisionGateResult> {
    const risk = context.riskMetrics;

    // Verificar perda diária
    if (risk.dailyPnL < -context.accountBalance * (this.MAX_DAILY_LOSS_PCT / 100)) {
      return {
        passed: false,
        gate: 'N3',
        reason: `Perda diária ${risk.dailyPnL.toFixed(2)} excede limite ${this.MAX_DAILY_LOSS_PCT}%`,
        reasonCode: 'N3_DAILY_LOSS_LIMIT'
      };
    }

    // Verificar drawdown
    if (risk.drawdown > this.MAX_DRAWDOWN_PCT) {
      return {
        passed: false,
        gate: 'N3',
        reason: `Drawdown ${risk.drawdown.toFixed(2)}% excede ${this.MAX_DRAWDOWN_PCT}%`,
        reasonCode: 'N3_DRAWDOWN_LIMIT'
      };
    }

    // Verificar limite de posições
    if (context.openPositions.length >= 2) { // Config
      return {
        passed: false,
        gate: 'N3',
        reason: `Limite de posições atingido: ${context.openPositions.length}`,
        reasonCode: 'N3_POSITION_LIMIT'
      };
    }

    // Verificar correlação com posições abertas
    const correlation = this.calculatePositionCorrelation(context);
    if (Math.abs(correlation) > this.MAX_CORRELATION) {
      return {
        passed: false,
        gate: 'N3',
        reason: `Correlação alta: ${correlation.toFixed(2)} > ${this.MAX_CORRELATION}`,
        reasonCode: 'N3_HIGH_CORRELATION'
      };
    }

    // Kill switch (seria verificado externamente)
    const killSwitchActive = false; // Implementar check real
    if (killSwitchActive) {
      return {
        passed: false,
        gate: 'N3',
        reason: 'Kill switch ativado',
        reasonCode: 'N3_KILL_SWITCH'
      };
    }

    return {
      passed: true,
      gate: 'N3',
      reason: 'Todas as verificações de risco passaram',
      reasonCode: 'OK_N3_RISK_OK',
      metadata: { dailyPnL: risk.dailyPnL, drawdown: risk.drawdown, correlation }
    };
  }

  /**
   * N4: Execução viável
   */
  private async validateN4(context: DecisionContext): Promise<DecisionGateResult> {
    const features = context.features;

    // Verificar fill probability (simplificado)
    const liquidity = context.currentRegime.liquidity;
    const fillProbability = liquidity === 'HIGH' ? 0.95 : liquidity === 'MEDIUM' ? 0.80 : 0.60;

    if (fillProbability < 0.70) {
      return {
        passed: false,
        gate: 'N4',
        reason: `Fill probability muito baixa: ${(fillProbability * 100).toFixed(0)}%`,
        reasonCode: 'N4_LOW_FILL_PROBABILITY'
      };
    }

    // Verificar impacto estimado
    const estimatedImpact = features.relativeSpread * 0.5; // Simplificado
    if (estimatedImpact > 20) { // 20 bps
      return {
        passed: false,
        gate: 'N4',
        reason: `Impacto estimado muito alto: ${estimatedImpact.toFixed(1)}bps`,
        reasonCode: 'N4_HIGH_IMPACT'
      };
    }

    // Verificar rate limits (seria verificado em tempo real)
    const rateLimitOk = true; // Implementar check real
    if (!rateLimitOk) {
      return {
        passed: false,
        gate: 'N4',
        reason: 'Rate limit da corretora atingido',
        reasonCode: 'N4_RATE_LIMIT'
      };
    }

    return {
      passed: true,
      gate: 'N4',
      reason: `Execução viável: fill ${(fillProbability * 100).toFixed(0)}%, impacto ${estimatedImpact.toFixed(1)}bps`,
      reasonCode: 'OK_N4_EXECUTION_VIABLE',
      metadata: { fillProbability, estimatedImpact }
    };
  }

  /**
   * N5: Juiz IA (referee)
   */
  private async validateN5(
    context: DecisionContext,
    previousGates: DecisionGateResult[]
  ): Promise<DecisionGateResult> {
    // Verificar consistência entre gates
    const allPassed = previousGates.every(g => g.passed);
    if (!allPassed) {
      return {
        passed: false,
        gate: 'N5',
        reason: 'Gates anteriores falharam',
        reasonCode: 'N5_PREVIOUS_GATES_FAILED'
      };
    }

    // Verificar consistência de sinais
    const predictions = context.predictions;
    const avgProbability = predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length;
    const avgExpectedBps = predictions.reduce((sum, p) => sum + p.expectedBps, 0) / predictions.length;

    // Requisitos do juiz IA
    if (avgProbability < 0.60) {
      return {
        passed: false,
        gate: 'N5',
        reason: `Probabilidade média ${(avgProbability * 100).toFixed(1)}% < 60%`,
        reasonCode: 'N5_IA_JUDGE_LOW_CONFIDENCE'
      };
    }

    if (Math.abs(avgExpectedBps) < 8) { // 8 bps mínimo
      return {
        passed: false,
        gate: 'N5',
        reason: `Expected BPS ${avgExpectedBps.toFixed(1)} < 8`,
        reasonCode: 'N5_IA_JUDGE_LOW_VALUE'
      };
    }

    // Verificar explicação (reason codes)
    const reasonCodes = previousGates.map(g => g.reasonCode).filter(c => c.startsWith('OK_'));
    if (reasonCodes.length < 4) {
      return {
        passed: false,
        gate: 'N5',
        reason: `Poucos reason codes válidos: ${reasonCodes.length}`,
        reasonCode: 'N5_INSUFFICIENT_REASONS'
      };
    }

    return {
      passed: true,
      gate: 'N5',
      reason: `Juiz IA aprovou: prob ${(avgProbability * 100).toFixed(1)}%, BPS ${avgExpectedBps.toFixed(1)}`,
      reasonCode: 'OK_N5_IA_APPROVED',
      metadata: { avgProbability, avgExpectedBps, reasonCodes }
    };
  }

  /**
   * Calcula tamanho da posição (Kelly fracionado)
   */
  private calculatePositionSize(context: DecisionContext): number {
    const bestPrediction = context.predictions.reduce((best, p) => 
      p.probability > best.probability ? p : best
    );

    // Kelly fracionado: f = p - (1-p) / (w/l)
    // onde p = probabilidade, w = win ratio, l = loss ratio
    const p = bestPrediction.probability;
    const expectedReturn = Math.abs(bestPrediction.expectedBps) / 10000; // Converter bps para decimal
    
    // Simplificado: usar 1/4 do Kelly para ser conservador
    const kelly = (p * expectedReturn - (1 - p)) / expectedReturn;
    const fractionalKelly = Math.max(0, Math.min(kelly * 0.25, 0.05)); // Máximo 5% do capital

    // Ajustar por confiança do ensemble
    const ensembleConfidence = context.predictions.reduce((sum, pred) => sum + pred.confidence, 0) / context.predictions.length;
    const adjustedSize = fractionalKelly * ensembleConfidence;

    // Limitar por risco
    const maxRisk = context.accountBalance * (this.MAX_POSITION_SIZE_PCT / 100);
    return Math.min(adjustedSize * context.accountBalance, maxRisk);
  }

  /**
   * Calcula expected value
   */
  private calculateExpectedValue(context: DecisionContext): number {
    const predictions = context.predictions;
    if (predictions.length === 0) return 0;

    // Média ponderada por confiança
    let totalWeight = 0;
    let weightedSum = 0;

    for (const pred of predictions) {
      const weight = pred.confidence * pred.probability;
      weightedSum += pred.expectedBps * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Determina ação (BUY/SELL)
   */
  private determineAction(context: DecisionContext): 'BUY' | 'SELL' {
    const buyPredictions = context.predictions.filter(p => p.expectedBps > 0);
    const sellPredictions = context.predictions.filter(p => p.expectedBps < 0);

    const buyWeight = buyPredictions.reduce((sum, p) => sum + p.confidence * p.probability, 0);
    const sellWeight = sellPredictions.reduce((sum, p) => sum + p.confidence * p.probability, 0);

    return buyWeight > sellWeight ? 'BUY' : 'SELL';
  }

  /**
   * Calcula correlação com posições abertas
   */
  private calculatePositionCorrelation(context: DecisionContext): number {
    if (context.openPositions.length === 0) return 0;

    const sameSymbol = context.openPositions.filter(p => p.symbol === context.symbol);
    if (sameSymbol.length > 0) return 0.9; // Alta correlação mesmo símbolo

    // Simplificado: correlacionar por mercado (seria mais complexo)
    return 0.3;
  }

  /**
   * Cria resultado de rejeição
   */
  private createRejectionResult(
    gates: DecisionGateResult[],
    finalReasonCode: string,
    finalReason: string
  ): ValidationResult {
    return {
      approved: false,
      action: 'HOLD',
      size: 0,
      gates,
      reasonCodes: [finalReasonCode],
      expectedValue: 0,
      riskAdjustedSize: 0
    };
  }
}

export const decisionGates = DecisionGatesValidator.getInstance();

