import { Logger } from './logger';
import TradingConfigurationService from './trading-configuration-service';
import EquityMonitoringService from './equity-monitoring-service';

export interface PositionSizingConfig {
  basePositionSize: number;        // % base do capital (ex: 2%)
  maxPositionSize: number;         // % máxima do capital (ex: 10%)
  exceptionalMultiplier: number;    // Multiplicador para trades excepcionais (ex: 2.5x)
  capitalGrowthFactor: number;      // Fator de crescimento baseado no capital (ex: 1.2)
  riskRewardThreshold: number;      // Threshold mínimo de risco-recompensa (ex: 1:3)
  confluenceThreshold: number;      // Threshold de confluência para trade excepcional (ex: 0.85)
}

export interface TradeAnalysis {
  confidence: number;              // Confiança da trade (0-1)
  score: number;                  // Score da análise (0-100)
  riskRewardRatio: number;        // Razão risco-recompensa
  confluenceScore: number;        // Score de confluência de fatores
  volatility: number;             // Volatilidade do ativo
  marketCondition: string;        // Condição do mercado
  technicalSignals: number;       // Número de sinais técnicos confirmando
  fundamentalScore: number;       // Score fundamental
}

export interface PositionSizingResult {
  positionSize: number;           // Tamanho da posição em %
  positionValue: number;          // Valor da posição em USD
  isExceptional: boolean;         // Se é uma trade excepcional
  sizingReason: string;           // Razão do dimensionamento
  riskAmount: number;             // Valor em risco
  potentialReward: number;        // Recompensa potencial
  riskRewardRatio: number;       // Razão risco-recompensa final
}

export class DynamicPositionSizingService {
  private readonly logger = Logger.getInstance();
  
  private config: PositionSizingConfig;
  private configService: TradingConfigurationService;
  private equityService: EquityMonitoringService;
  
  // Histórico de performance para ajuste dinâmico
  private performanceHistory: {
    trades: number;
    wins: number;
    totalReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
  } = {
    trades: 0,
    wins: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0
  };

  constructor() {
    this.configService = TradingConfigurationService.getInstance();
    this.equityService = EquityMonitoringService.getInstance();
    this.initializeConfig();
  }

  private initializeConfig(): void {
    this.config = {
      basePositionSize: 2.0,        // 2% do capital base
      maxPositionSize: 10.0,        // 10% máximo do capital
      exceptionalMultiplier: 2.5,    // 2.5x para trades excepcionais
      capitalGrowthFactor: 1.2,     // 20% de aumento por crescimento de capital
      riskRewardThreshold: 3.0,     // Mínimo 1:3 risco-recompensa
      confluenceThreshold: 0.85     // 85% de confluência para trade excepcional
    };
  }

  /**
   * Calcula o tamanho da posição baseado na análise da trade e capital atual
   */
  async calculatePositionSize(
    symbol: string,
    tradeAnalysis: TradeAnalysis,
    currentPrice: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<PositionSizingResult> {
    try {
      // 1. Obter capital atual
      const currentCapital = await this.getCurrentCapital();
      
      // 2. Calcular tamanho base
      const baseSize = this.calculateBasePositionSize(currentCapital);
      
      // 3. Verificar se é trade excepcional
      const isExceptional = this.isExceptionalTrade(tradeAnalysis);
      
      // 4. Calcular risco-recompensa
      const riskRewardRatio = this.calculateRiskRewardRatio(currentPrice, stopLoss, takeProfit);
      
      // 5. Calcular tamanho final
      let finalPositionSize: number;
      let sizingReason: string;
      
      if (isExceptional && riskRewardRatio >= this.config.riskRewardThreshold) {
        // Trade excepcional com boa relação risco-recompensa
        finalPositionSize = Math.min(
          baseSize * this.config.exceptionalMultiplier,
          this.config.maxPositionSize
        );
        sizingReason = `Trade excepcional (confiança: ${(tradeAnalysis.confidence * 100).toFixed(1)}%, confluência: ${(tradeAnalysis.confluenceScore * 100).toFixed(1)}%, R:R: ${riskRewardRatio.toFixed(1)})`;
      } else if (tradeAnalysis.confidence > 0.8 && riskRewardRatio >= 2.0) {
        // Trade de alta confiança
        finalPositionSize = Math.min(baseSize * 1.5, this.config.maxPositionSize);
        sizingReason = `Trade de alta confiança (${(tradeAnalysis.confidence * 100).toFixed(1)}%, R:R: ${riskRewardRatio.toFixed(1)})`;
      } else if (tradeAnalysis.confidence > 0.7) {
        // Trade normal de boa qualidade
        finalPositionSize = baseSize;
        sizingReason = `Trade padrão (confiança: ${(tradeAnalysis.confidence * 100).toFixed(1)}%, R:R: ${riskRewardRatio.toFixed(1)})`;
      } else {
        // Trade de menor qualidade
        finalPositionSize = baseSize * 0.7;
        sizingReason = `Trade conservadora (confiança: ${(tradeAnalysis.confidence * 100).toFixed(1)}%, R:R: ${riskRewardRatio.toFixed(1)})`;
      }
      
      // 6. Aplicar ajustes baseados no capital
      finalPositionSize = this.applyCapitalGrowthAdjustment(finalPositionSize, currentCapital);
      
      // 7. Calcular valores finais
      const positionValue = (currentCapital * finalPositionSize) / 100;
      const riskAmount = Math.abs(currentPrice - stopLoss) * (positionValue / currentPrice);
      const potentialReward = Math.abs(takeProfit - currentPrice) * (positionValue / currentPrice);
      
      const result: PositionSizingResult = {
        positionSize: finalPositionSize,
        positionValue,
        isExceptional,
        sizingReason,
        riskAmount,
        potentialReward,
        riskRewardRatio
      };
      
      this.logger.log(`📊 Position Sizing para ${symbol}:`);
      this.logger.log(`   Capital atual: $${currentCapital.toFixed(2)}`);
      this.logger.log(`   Tamanho da posição: ${finalPositionSize.toFixed(2)}% ($${positionValue.toFixed(2)})`);
      this.logger.log(`   Trade excepcional: ${isExceptional ? 'SIM' : 'NÃO'}`);
      this.logger.log(`   Razão: ${sizingReason}`);
      this.logger.log(`   Risco: $${riskAmount.toFixed(2)} | Recompensa: $${potentialReward.toFixed(2)}`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`❌ Erro ao calcular position sizing para ${symbol}:`, error);
      
      // Fallback para tamanho conservador
      const currentCapital = await this.getCurrentCapital();
      const fallbackSize = this.config.basePositionSize * 0.5; // 50% do tamanho base
      
      return {
        positionSize: fallbackSize,
        positionValue: (currentCapital * fallbackSize) / 100,
        isExceptional: false,
        sizingReason: 'Erro no cálculo - usando tamanho conservador',
        riskAmount: 0,
        potentialReward: 0,
        riskRewardRatio: 0
      };
    }
  }

  /**
   * Obtém o capital atual do sistema
   */
  private async getCurrentCapital(): Promise<number> {
    try {
      const equity = await this.equityService.getCurrentEquity();
      return equity || 1000; // Fallback para $1000 se não conseguir obter
    } catch (error) {
      this.logger.warn('⚠️ Erro ao obter capital atual, usando fallback:', error.message);
      return 1000; // Fallback conservador
    }
  }

  /**
   * Calcula o tamanho base da posição baseado no capital atual
   */
  private calculateBasePositionSize(currentCapital: number): number {
    // Tamanho base aumenta conforme o capital cresce
    let baseSize = this.config.basePositionSize;
    
    // Ajuste baseado no capital (mais capital = posições maiores permitidas)
    if (currentCapital > 50000) {
      baseSize *= 1.5; // 50% maior para capital > $50k
    } else if (currentCapital > 25000) {
      baseSize *= 1.3; // 30% maior para capital > $25k
    } else if (currentCapital > 10000) {
      baseSize *= 1.1; // 10% maior para capital > $10k
    }
    
    // Ajuste baseado na performance histórica
    if (this.performanceHistory.trades > 10) {
      const winRate = this.performanceHistory.wins / this.performanceHistory.trades;
      if (winRate > 0.7) {
        baseSize *= 1.2; // 20% maior se win rate > 70%
      } else if (winRate < 0.4) {
        baseSize *= 0.8; // 20% menor se win rate < 40%
      }
    }
    
    return Math.min(baseSize, this.config.maxPositionSize);
  }

  /**
   * Verifica se é uma trade excepcional baseada na análise
   */
  private isExceptionalTrade(tradeAnalysis: TradeAnalysis): boolean {
    // Critérios para trade excepcional
    const criteria = {
      highConfidence: tradeAnalysis.confidence >= 0.9,
      highScore: tradeAnalysis.score >= 85,
      highConfluence: tradeAnalysis.confluenceScore >= this.config.confluenceThreshold,
      lowVolatility: tradeAnalysis.volatility <= 0.05, // Baixa volatilidade
      multipleSignals: tradeAnalysis.technicalSignals >= 5,
      goodFundamentals: tradeAnalysis.fundamentalScore >= 0.8,
      favorableMarket: ['bull_market', 'consolidation', 'breakout'].includes(tradeAnalysis.marketCondition)
    };
    
    // Contar critérios atendidos
    const metCriteria = Object.values(criteria).filter(Boolean).length;
    const totalCriteria = Object.keys(criteria).length;
    
    // Trade excepcional se atender pelo menos 75% dos critérios
    const isExceptional = metCriteria / totalCriteria >= 0.75;
    
    this.logger.log(`🔍 Análise de Trade Excepcional:`);
    this.logger.log(`   Confiança: ${(tradeAnalysis.confidence * 100).toFixed(1)}%`);
    this.logger.log(`   Score: ${tradeAnalysis.score.toFixed(1)}`);
    this.logger.log(`   Confluência: ${(tradeAnalysis.confluenceScore * 100).toFixed(1)}%`);
    this.logger.log(`   Volatilidade: ${(tradeAnalysis.volatility * 100).toFixed(1)}%`);
    this.logger.log(`   Sinais técnicos: ${tradeAnalysis.technicalSignals}`);
    this.logger.log(`   Score fundamental: ${(tradeAnalysis.fundamentalScore * 100).toFixed(1)}%`);
    this.logger.log(`   Condição do mercado: ${tradeAnalysis.marketCondition}`);
    this.logger.log(`   Critérios atendidos: ${metCriteria}/${totalCriteria} (${(metCriteria/totalCriteria*100).toFixed(1)}%)`);
    this.logger.log(`   Trade excepcional: ${isExceptional ? 'SIM' : 'NÃO'}`);
    
    return isExceptional;
  }

  /**
   * Calcula a razão risco-recompensa
   */
  private calculateRiskRewardRatio(currentPrice: number, stopLoss: number, takeProfit: number): number {
    const risk = Math.abs(currentPrice - stopLoss);
    const reward = Math.abs(takeProfit - currentPrice);
    
    if (risk === 0) return 0;
    
    return reward / risk;
  }

  /**
   * Aplica ajustes baseados no crescimento do capital
   */
  private applyCapitalGrowthAdjustment(baseSize: number, currentCapital: number): number {
    // Ajuste baseado no crescimento do capital
    const initialCapital = 1000; // Capital inicial assumido
    const growthRatio = currentCapital / initialCapital;
    
    let adjustedSize = baseSize;
    
    if (growthRatio > 10) {
      // Capital cresceu mais de 10x - permitir posições maiores
      adjustedSize *= 1.3;
    } else if (growthRatio > 5) {
      // Capital cresceu mais de 5x
      adjustedSize *= 1.2;
    } else if (growthRatio > 2) {
      // Capital cresceu mais de 2x
      adjustedSize *= 1.1;
    }
    
    // Limitar ao máximo configurado
    return Math.min(adjustedSize, this.config.maxPositionSize);
  }

  /**
   * Calcula score de confluência de fatores
   */
  calculateConfluenceScore(tradeAnalysis: TradeAnalysis): number {
    const factors = {
      technical: tradeAnalysis.technicalSignals / 10, // Normalizar para 0-1
      fundamental: tradeAnalysis.fundamentalScore,
      confidence: tradeAnalysis.confidence,
      volatility: 1 - tradeAnalysis.volatility, // Inverter volatilidade (menor = melhor)
      marketCondition: this.getMarketConditionScore(tradeAnalysis.marketCondition)
    };
    
    // Média ponderada dos fatores
    const weights = {
      technical: 0.3,
      fundamental: 0.2,
      confidence: 0.25,
      volatility: 0.15,
      marketCondition: 0.1
    };
    
    let confluenceScore = 0;
    for (const [factor, value] of Object.entries(factors)) {
      confluenceScore += value * weights[factor];
    }
    
    return Math.min(confluenceScore, 1.0);
  }

  /**
   * Converte condição do mercado em score numérico
   */
  private getMarketConditionScore(condition: string): number {
    const scores = {
      'bull_market': 1.0,
      'breakout': 0.9,
      'consolidation': 0.8,
      'sideways': 0.6,
      'correction': 0.4,
      'bear_market': 0.2,
      'crash': 0.1
    };
    
    return scores[condition] || 0.5;
  }

  /**
   * Atualiza histórico de performance
   */
  updatePerformanceHistory(tradeResult: {
    pnl: number;
    isWin: boolean;
    positionSize: number;
  }): void {
    this.performanceHistory.trades++;
    
    if (tradeResult.isWin) {
      this.performanceHistory.wins++;
    }
    
    this.performanceHistory.totalReturn += tradeResult.pnl;
    
    // Calcular drawdown máximo
    if (tradeResult.pnl < 0) {
      this.performanceHistory.maxDrawdown = Math.min(
        this.performanceHistory.maxDrawdown,
        tradeResult.pnl
      );
    }
    
    // Recalcular Sharpe ratio (simplificado)
    if (this.performanceHistory.trades > 10) {
      const avgReturn = this.performanceHistory.totalReturn / this.performanceHistory.trades;
      const volatility = Math.abs(this.performanceHistory.maxDrawdown) / 10; // Simplificado
      this.performanceHistory.sharpeRatio = avgReturn / volatility;
    }
    
    this.logger.log(`📈 Performance atualizada:`);
    this.logger.log(`   Trades: ${this.performanceHistory.trades}`);
    this.logger.log(`   Win Rate: ${(this.performanceHistory.wins / this.performanceHistory.trades * 100).toFixed(1)}%`);
    this.logger.log(`   Retorno Total: $${this.performanceHistory.totalReturn.toFixed(2)}`);
    this.logger.log(`   Max Drawdown: $${this.performanceHistory.maxDrawdown.toFixed(2)}`);
    this.logger.log(`   Sharpe Ratio: ${this.performanceHistory.sharpeRatio.toFixed(2)}`);
  }

  /**
   * Obtém configurações atuais
   */
  getConfig(): PositionSizingConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configurações
   */
  updateConfig(newConfig: Partial<PositionSizingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('⚙️ Configurações de position sizing atualizadas:', this.config);
  }

  /**
   * Obtém histórico de performance
   */
  getPerformanceHistory() {
    return { ...this.performanceHistory };
  }

  /**
   * Calcula tamanho de posição para trade excepcional com confluência máxima
   */
  async calculateExceptionalPositionSize(
    symbol: string,
    tradeAnalysis: TradeAnalysis,
    currentPrice: number,
    stopLoss: number,
    takeProfit: number
  ): Promise<PositionSizingResult> {
    // Para trades excepcionais, usar configuração especial
    const originalConfig = { ...this.config };
    
    // Aumentar limites para trade excepcional
    this.config.exceptionalMultiplier = 3.0; // 3x em vez de 2.5x
    this.config.maxPositionSize = 15.0; // 15% em vez de 10%
    
    const result = await this.calculatePositionSize(symbol, tradeAnalysis, currentPrice, stopLoss, takeProfit);
    
    // Restaurar configuração original
    this.config = originalConfig;
    
    this.logger.log(`🚀 TRADE EXCEPCIONAL CALCULADA para ${symbol}:`);
    this.logger.log(`   Tamanho: ${result.positionSize.toFixed(2)}% ($${result.positionValue.toFixed(2)})`);
    this.logger.log(`   Razão: ${result.sizingReason}`);
    
    return result;
  }

  /**
   * Verifica se o capital atual permite posições maiores
   */
  async canIncreasePositionSize(): Promise<boolean> {
    const currentCapital = await this.getCurrentCapital();
    const performance = this.getPerformanceHistory();
    
    // Critérios para permitir posições maiores
    const criteria = {
      sufficientCapital: currentCapital > 5000,
      goodWinRate: performance.trades > 10 && (performance.wins / performance.trades) > 0.6,
      positiveReturn: performance.totalReturn > 0,
      manageableDrawdown: Math.abs(performance.maxDrawdown) < currentCapital * 0.1
    };
    
    const metCriteria = Object.values(criteria).filter(Boolean).length;
    const canIncrease = metCriteria >= 3; // Pelo menos 3 de 4 critérios
    
    this.logger.log(`🔍 Verificação para aumentar posições:`);
    this.logger.log(`   Capital suficiente: ${criteria.sufficientCapital}`);
    this.logger.log(`   Win rate bom: ${criteria.goodWinRate}`);
    this.logger.log(`   Retorno positivo: ${criteria.positiveReturn}`);
    this.logger.log(`   Drawdown controlado: ${criteria.manageableDrawdown}`);
    this.logger.log(`   Pode aumentar: ${canIncrease ? 'SIM' : 'NÃO'}`);
    
    return canIncrease;
  }
}