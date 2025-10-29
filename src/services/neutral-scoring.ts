import { logger, logTrading } from './logger';

export interface FactorScore {
  name: string;          // "Technical", "Derivatives", ...
  score: number | null;  // null = sem dado
  weight: number;
  originalWeight: number; // peso original antes do ajuste
}

export interface ScoringResult {
  weightedScore: number;
  confidencePct: number;
  factors: FactorScore[];
  totalWeight: number;
  validFactors: number;
}

/**
 * ✅ CORREÇÃO CRÍTICA: Sistema de scoring neutro
 * Problema: Quando dados faltavam, aplicava -5 com peso alto, matando sinais bons
 */
export class NeutralScoring {
  
  // Pesos originais dos fatores
  private static readonly FACTOR_WEIGHTS = {
    TECHNICAL: 0.40,
    SENTIMENT: 0.08,
    ONCHAIN: 0.15,
    DERIVATIVES: 0.27,
    MACRO: 0.05,
    SMART_MONEY: 0.05,
    COINGECKO: 0.02,
    FEAR_GREED: 0.02,
    NEWS: 0.01
  };

  /**
   * ✅ NOVO: Calcular score ponderado com tratamento neutro para dados ausentes
   */
  public static computeWeightedSignal(factors: FactorScore[]): ScoringResult {
    let numerator = 0;
    let denominator = 0;
    let validFactors = 0;
    let totalWeight = 0;

    const processedFactors: FactorScore[] = [];

    logTrading('🧮 Calculando score ponderado com tratamento neutro...');

    for (const factor of factors) {
      const processedFactor: FactorScore = {
        ...factor,
        originalWeight: factor.weight
      };

      // ✅ CORREÇÃO: Se score é null ou NaN, ignora completamente
      if (factor.score === null || Number.isNaN(factor.score)) {
        processedFactor.weight = 0; // Peso zero para fatores sem dado
        logTrading(`⚠️ ${factor.name}: Sem dado (score: ${factor.score}) - peso ajustado para 0`);
      } else {
        // Fator válido - usar peso original
        numerator += factor.score * factor.weight;
        denominator += factor.weight;
        validFactors++;
        logTrading(`✅ ${factor.name}: Score ${factor.score.toFixed(2)} (peso: ${factor.weight})`);
      }

      totalWeight += factor.originalWeight;
      processedFactors.push(processedFactor);
    }

    // ✅ CORREÇÃO: Calcular score ponderado
    const weightedScore = denominator === 0 ? 0 : numerator / denominator;
    
    // ✅ CORREÇÃO: Confiança baseada na massa de peso válida
    const confidencePct = denominator === 0 ? 0 : Math.min(100, Math.round((denominator / totalWeight) * 100));

    logTrading('📊 Resultado do scoring:', {
      weightedScore: weightedScore.toFixed(2),
      confidencePct,
      validFactors,
      totalFactors: factors.length,
      totalWeight: totalWeight.toFixed(2),
      usedWeight: denominator.toFixed(2)
    });

    return {
      weightedScore,
      confidencePct,
      factors: processedFactors,
      totalWeight,
      validFactors
    };
  }

  /**
   * ✅ NOVO: Criar fatores com tratamento neutro automático
   */
  public static createFactors(data: {
    technical?: number | null;
    sentiment?: number | null;
    onchain?: number | null;
    derivatives?: number | null;
    macro?: number | null;
    smartMoney?: number | null;
    coingecko?: number | null;
    fearGreed?: number | null;
    news?: number | null;
  }): FactorScore[] {
    
    const factors: FactorScore[] = [
      {
        name: 'Technical',
        score: data.technical ?? null,
        weight: this.FACTOR_WEIGHTS.TECHNICAL,
        originalWeight: this.FACTOR_WEIGHTS.TECHNICAL
      },
      {
        name: 'Sentiment',
        score: data.sentiment ?? null,
        weight: this.FACTOR_WEIGHTS.SENTIMENT,
        originalWeight: this.FACTOR_WEIGHTS.SENTIMENT
      },
      {
        name: 'OnChain',
        score: data.onchain ?? null,
        weight: this.FACTOR_WEIGHTS.ONCHAIN,
        originalWeight: this.FACTOR_WEIGHTS.ONCHAIN
      },
      {
        name: 'Derivatives',
        score: data.derivatives ?? null, // ✅ CORREÇÃO: null em vez de -5
        weight: this.FACTOR_WEIGHTS.DERIVATIVES,
        originalWeight: this.FACTOR_WEIGHTS.DERIVATIVES
      },
      {
        name: 'Macro',
        score: data.macro ?? null,
        weight: this.FACTOR_WEIGHTS.MACRO,
        originalWeight: this.FACTOR_WEIGHTS.MACRO
      },
      {
        name: 'SmartMoney',
        score: data.smartMoney ?? null,
        weight: this.FACTOR_WEIGHTS.SMART_MONEY
      },
      {
        name: 'CoinGecko',
        score: data.coingecko ?? null,
        weight: this.FACTOR_WEIGHTS.COINGECKO
      },
      {
        name: 'FearGreed',
        score: data.fearGreed ?? null,
        weight: this.FACTOR_WEIGHTS.FEAR_GREED
      },
      {
        name: 'News',
        score: data.news ?? null,
        weight: this.FACTOR_WEIGHTS.NEWS,
        originalWeight: this.FACTOR_WEIGHTS.NEWS
      }
    ];

    return factors;
  }

  /**
   * ✅ NOVO: Classificar sinal baseado no score e confiança
   */
  public static classifySignal(
    weightedScore: number, 
    confidencePct: number,
    thresholds: {
      minConfidence?: number;
      strongBuyThreshold?: number;
      buyThreshold?: number;
      sellThreshold?: number;
      strongSellThreshold?: number;
    } = {}
  ): {
    action: 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL' | 'HOLD';
    reason?: string;
    strength: 'strong' | 'moderate' | 'weak';
  } {
    
    const {
      minConfidence = 45,
      strongBuyThreshold = 3.0,
      buyThreshold = 1.5,
      sellThreshold = -1.5,
      strongSellThreshold = -3.0
    } = thresholds;

    logTrading('🎯 Classificando sinal:', {
      weightedScore: weightedScore.toFixed(2),
      confidencePct,
      minConfidence
    });

    // ✅ CORREÇÃO: Verificar confiança mínima primeiro
    if (confidencePct < minConfidence) {
      return {
        action: 'HOLD',
        reason: `Confiança baixa: ${confidencePct}% < ${minConfidence}%`,
        strength: 'weak'
      };
    }

    // ✅ CORREÇÃO: Classificar baseado no score
    if (weightedScore >= strongBuyThreshold) {
      return {
        action: 'STRONG_BUY',
        strength: 'strong'
      };
    }

    if (weightedScore >= buyThreshold) {
      return {
        action: 'BUY',
        strength: 'moderate'
      };
    }

    if (weightedScore <= strongSellThreshold) {
      return {
        action: 'STRONG_SELL',
        strength: 'strong'
      };
    }

    if (weightedScore <= sellThreshold) {
      return {
        action: 'SELL',
        strength: 'moderate'
      };
    }

    return {
      action: 'HOLD',
      reason: `Score neutro: ${weightedScore.toFixed(2)}`,
      strength: 'weak'
    };
  }

  /**
   * ✅ NOVO: Processar dados com tratamento de erros
   */
  public static processDataWithErrorHandling(data: {
    technical?: number | null;
    sentiment?: number | null;
    onchain?: number | null;
    derivatives?: number | null;
    macro?: number | null;
    smartMoney?: number | null;
    coingecko?: number | null;
    fearGreed?: number | null;
    news?: number | null;
  }): ScoringResult {
    
    logTrading('🔄 Processando dados com tratamento de erros...');

    // ✅ CORREÇÃO: Tratar valores inválidos como null
    const processedData = {
      technical: this.sanitizeScore(data.technical),
      sentiment: this.sanitizeScore(data.sentiment),
      onchain: this.sanitizeScore(data.onchain),
      derivatives: this.sanitizeScore(data.derivatives),
      macro: this.sanitizeScore(data.macro),
      smartMoney: this.sanitizeScore(data.smartMoney),
      coingecko: this.sanitizeScore(data.coingecko),
      fearGreed: this.sanitizeScore(data.fearGreed),
      news: this.sanitizeScore(data.news)
    };

    const factors = this.createFactors(processedData);
    return this.computeWeightedSignal(factors);
  }

  /**
   * ✅ NOVO: Sanitizar score (tratar valores inválidos)
   */
  private static sanitizeScore(score: number | null | undefined): number | null {
    if (score === null || score === undefined) {
      return null;
    }
    
    if (Number.isNaN(score) || !Number.isFinite(score)) {
      return null;
    }
    
    return score;
  }

  /**
   * ✅ NOVO: Obter estatísticas de fatores
   */
  public static getFactorStats(factors: FactorScore[]): {
    totalFactors: number;
    validFactors: number;
    invalidFactors: number;
    totalWeight: number;
    usedWeight: number;
    coverage: number;
  } {
    let validFactors = 0;
    let invalidFactors = 0;
    let totalWeight = 0;
    let usedWeight = 0;

    factors.forEach(factor => {
      totalWeight += factor.originalWeight;
      
      if (factor.score !== null && !Number.isNaN(factor.score)) {
        validFactors++;
        usedWeight += factor.weight;
      } else {
        invalidFactors++;
      }
    });

    const coverage = totalWeight > 0 ? (usedWeight / totalWeight) * 100 : 0;

    return {
      totalFactors: factors.length,
      validFactors,
      invalidFactors,
      totalWeight,
      usedWeight,
      coverage
    };
  }

  /**
   * ✅ NOVO: Validar se resultado é confiável
   */
  public static isResultReliable(result: ScoringResult): {
    reliable: boolean;
    reason?: string;
    recommendations?: string[];
  } {
    const recommendations: string[] = [];
    
    // Verificar confiança mínima
    if (result.confidencePct < 30) {
      return {
        reliable: false,
        reason: `Confiança muito baixa: ${result.confidencePct}%`,
        recommendations: ['Aumentar cobertura de dados', 'Verificar conectividade com APIs']
      };
    }

    // Verificar número mínimo de fatores
    if (result.validFactors < 3) {
      recommendations.push('Poucos fatores válidos - considerar aumentar threshold de confiança');
    }

    // Verificar cobertura de peso
    const coverage = (result.totalWeight > 0) ? (result.usedWeight / result.totalWeight) * 100 : 0;
    if (coverage < 50) {
      recommendations.push('Baixa cobertura de dados - verificar APIs externas');
    }

    return {
      reliable: result.confidencePct >= 30 && result.validFactors >= 2,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }
}

export default NeutralScoring;
