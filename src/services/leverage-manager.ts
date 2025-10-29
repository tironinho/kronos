// ============================================================================
// LEVERAGE MANAGER - Gerenciamento Inteligente de Alavancagem
// ============================================================================

interface LeverageStrategy {
  timeframe: 'scalper' | 'day' | 'swing';
  baseLeverage: number;
  maxLeverage: number;
  confidenceMultiplier: number;
  volatilityFactor: number;
}

interface TradeContext {
  symbol: string;
  confidence: number;
  signal: string;
  timeframe: 'scalper' | 'day' | 'swing';
  volatility: number;
  availableBalance: number;
  currentLeverage: number;
}

export class LeverageManager {
  /**
   * Estratégias de alavancagem por timeframe
   */
  private strategies: Record<'scalper' | 'day' | 'swing', LeverageStrategy> = {
    scalper: {
      timeframe: 'scalper',
      baseLeverage: 10,        // Alta alavancagem para scalping
      maxLeverage: 20,
      confidenceMultiplier: 1.2,  // +20% por confiança
      volatilityFactor: 0.9      // Reduz 10% se alta volatilidade
    },
    day: {
      timeframe: 'day',
      baseLeverage: 5,         // Alavancagem moderada para day trading
      maxLeverage: 10,
      confidenceMultiplier: 1.15,  // +15% por confiança
      volatilityFactor: 0.85      // Reduz 15% se alta volatilidade
    },
    swing: {
      timeframe: 'swing',
      baseLeverage: 3,         // Baixa alavancagem para swing trading
      maxLeverage: 5,
      confidenceMultiplier: 1.1,   // +10% por confiança
      volatilityFactor: 0.75      // Reduz 25% se alta volatilidade
    }
  };
  
  /**
   * Determina timeframe baseado em confiança e tipo de sinal
   */
  determineTimeframe(context: TradeContext): 'scalper' | 'day' | 'swing' {
    // Scalper: Sinais muito fortes com confiança alta (STRONG_BUY/SELL)
    if (context.confidence >= 85 && (context.signal === 'STRONG_BUY' || context.signal === 'STRONG_SELL')) {
      console.log('⏱️  Timeframe: SCALPER (sinal muito forte, alta confiança)');
      return 'scalper';
    }
    
    // Day: Sinais moderados com confiança boa (BUY/SELL)
    if (context.confidence >= 70 && (context.signal === 'BUY' || context.signal === 'SELL')) {
      console.log('⏱️  Timeframe: DAY (sinal moderado, boa confiança)');
      return 'day';
    }
    
    // Swing: Sinais fracos ou confiança baixa (HOLD ou sinais fracos)
    console.log('⏱️  Timeframe: SWING (sinal fraco ou confiança baixa)');
    return 'swing';
  }
  
  /**
   * Calcula alavancagem OTIMIZADA baseada em contexto
   */
  calculateOptimalLeverage(context: TradeContext): {
    leverage: number;
    timeframe: 'scalper' | 'day' | 'swing';
    rationale: string;
    marginRequired: number;
    maxPositionSize: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const timeframe = this.determineTimeframe(context);
    const strategy = this.strategies[timeframe];
    
    // Alavancagem base
    let leverage = strategy.baseLeverage;
    
    // Ajustar por confiança
    if (context.confidence >= 90) {
      leverage = Math.min(strategy.maxLeverage, leverage * strategy.confidenceMultiplier);
    } else if (context.confidence >= 75) {
      leverage = leverage * (1 + (context.confidence - 75) / 100 * 0.5);
    } else if (context.confidence < 60) {
      leverage = leverage * 0.7; // Reduz 30% se baixa confiança
    }
    
    // Ajustar por volatilidade
    if (context.volatility > 0.03) { // Alta volatilidade > 3%
      leverage = leverage * strategy.volatilityFactor;
      console.log(`⚠️ Alta volatilidade detectada (${(context.volatility * 100).toFixed(2)}%): Reduzindo alavancagem`);
    }
    
    // Limites de segurança
    leverage = Math.max(1, Math.min(strategy.maxLeverage, Math.round(leverage)));
    
    // Calcular margem necessária
    const marginRequired = context.availableBalance / leverage;
    const maxPositionSize = context.availableBalance * leverage;
    
    // Determinar nível de risco
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (leverage <= 3) riskLevel = 'LOW';
    else if (leverage <= 8) riskLevel = 'MEDIUM';
    else riskLevel = 'HIGH';
    
    const rationale = [
      `Timeframe: ${timeframe}`,
      `Confiança: ${context.confidence}%`,
      `Sinal: ${context.signal}`,
      `Volatilidade: ${(context.volatility * 100).toFixed(2)}%`
    ].join(', ');
    
    console.log(`⚙️ Leverage otimizado: ${leverage}x (${riskLevel} risk)`);
    console.log(`   Margem necessária: $${marginRequired.toFixed(2)}`);
    console.log(`   Tamanho máximo posição: $${maxPositionSize.toFixed(2)}`);
    
    return {
      leverage,
      timeframe,
      rationale,
      marginRequired,
      maxPositionSize,
      riskLevel
    };
  }
  
  /**
   * Verifica se margem é suficiente para o trade
   */
  canOpenTrade(
    availableBalance: number,
    requiredMargin: number,
    currentPositions: number
  ): boolean {
    // ✅ USER REQUEST: Permitir múltiplas trades pequenas sem limite artificial
    // SEM LIMITE DE QUANTIDADE - apenas verificar se tem margem suficiente
    
    console.log(`🔍 Verificando margem: disponível=$${availableBalance.toFixed(2)}, necessária=$${requiredMargin.toFixed(2)}, posições abertas=${currentPositions}`);
    
    // Margem necessária deve ser <= 95% do saldo disponível (antes era 90%)
    const safeMargin = availableBalance * 0.95;
    
    if (requiredMargin > safeMargin) {
      console.log(`⏸️ ${requiredMargin > safeMargin ? 'Margem insuficiente' : 'OK'}: precisa $${requiredMargin.toFixed(2)} vs disponível $${availableBalance.toFixed(2)} (90% = $${safeMargin.toFixed(2)})`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Calcula volatilidade de um símbolo
   */
  calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0.02; // 2% default
    
    const returns = prices.slice(1).map((price, i) => 
      (price - prices[i]) / prices[i]
    );
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Determina tempo de exposição recomendado
   */
  getRecommendedExposureTime(timeframe: 'scalper' | 'day' | 'swing'): {
    minMinutes: number;
    maxMinutes: number;
    targetMinutes: number;
  } {
    const exposure = {
      scalper: { minMinutes: 5, maxMinutes: 30, targetMinutes: 15 },
      day: { minMinutes: 60, maxMinutes: 480, targetMinutes: 240 },
      swing: { minMinutes: 1440, maxMinutes: 10080, targetMinutes: 4320 } // 1-7 dias
    };
    
    return exposure[timeframe];
  }
}

export const leverageManager = new LeverageManager();

