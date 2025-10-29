import PositionSizing, { SizingInput, SizingResult } from './position-sizing';
import NeutralScoring, { ScoringResult } from './neutral-scoring';
import { logger, logTrading, logBinance } from './logger';

export interface TradingOpportunity {
  symbol: string;
  side: 'BUY' | 'SELL';
  leverage: number;
  maxMarginUsd: number;
  sizing: SizingResult;
  scoring: ScoringResult;
  action: 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL';
  strength: 'strong' | 'moderate' | 'weak';
  confidence: number;
}

export interface DecisionConfig {
  minConfidence: number;
  strongBuyThreshold: number;
  buyThreshold: number;
  sellThreshold: number;
  strongSellThreshold: number;
  maxTrades: number;
  maxMarginPerTrade: number;
  leverage: number;
}

/**
 * ✅ CORREÇÃO CRÍTICA: Pipeline de decisão consistente
 * Problema: Aprovava internamente mas depois bloqueava por HOLD no agregador final
 */
export class ConsistentDecisionEngine {
  
  private static readonly DEFAULT_CONFIG: DecisionConfig = {
    minConfidence: 45,
    strongBuyThreshold: 3.0,
    buyThreshold: 1.5,
    sellThreshold: -1.5,
    strongSellThreshold: -3.0,
    maxTrades: 2,
    maxMarginPerTrade: 0.8, // 80% do saldo disponível
    leverage: 2
  };

  /**
   * ✅ NOVO: Processar símbolo com decisão consistente
   */
  public static async processSymbol(
    symbol: string,
    scoringData: {
      technical?: number | null;
      sentiment?: number | null;
      onchain?: number | null;
      derivatives?: number | null;
      macro?: number | null;
      smartMoney?: number | null;
      coingecko?: number | null;
      fearGreed?: number | null;
      news?: number | null;
    },
    availableMargin: number,
    config: Partial<DecisionConfig> = {}
  ): Promise<TradingOpportunity | null> {
    
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    logTrading(`🔍 Processando ${symbol} com decisão consistente...`);

    try {
      // 1. ✅ CORREÇÃO: Calcular score com tratamento neutro
      const scoring = NeutralScoring.processDataWithErrorHandling(scoringData);
      
      logTrading(`📊 ${symbol}: Score ${scoring.weightedScore.toFixed(2)}, Confiança ${scoring.confidencePct}%`);

      // 2. ✅ CORREÇÃO: Classificar sinal
      const signal = NeutralScoring.classifySignal(
        scoring.weightedScore,
        scoring.confidencePct,
        {
          minConfidence: finalConfig.minConfidence,
          strongBuyThreshold: finalConfig.strongBuyThreshold,
          buyThreshold: finalConfig.buyThreshold,
          sellThreshold: finalConfig.sellThreshold,
          strongSellThreshold: finalConfig.strongSellThreshold
        }
      );

      logTrading(`🎯 ${symbol}: Sinal classificado como ${signal.action} (${signal.strength})`);

      // 3. ✅ CORREÇÃO: Se HOLD, retornar null (não processar)
      if (signal.action === 'HOLD') {
        logTrading(`⏸️ ${symbol}: Ignorado - ${signal.reason || 'Sinal neutro'}`);
        return null;
      }

      // 4. ✅ CORREÇÃO: Determinar side baseado no sinal
      const side = signal.action.includes('BUY') ? 'BUY' : 'SELL';
      
      // 5. ✅ CORREÇÃO: Calcular margem disponível para esta trade
      const maxMarginForTrade = availableMargin * finalConfig.maxMarginPerTrade;
      
      // 6. ✅ CORREÇÃO: Calcular sizing executável
      const sizing = await PositionSizing.buildOrderSizing({
        symbol,
        side,
        leverage: finalConfig.leverage,
        maxMarginUsd: maxMarginForTrade,
        riskPercentage: 1.0
      });

      logTrading(`📐 ${symbol}: Sizing calculado`, {
        ok: sizing.ok,
        qty: sizing.qty?.toFixed(sizing.meta?.precision || 4),
        notional: sizing.notionalUsd?.toFixed(2),
        requiredMargin: sizing.requiredMargin?.toFixed(2)
      });

      // 7. ✅ CORREÇÃO: Se sizing não é executável, retornar null
      if (!sizing.ok) {
        logTrading(`❌ ${symbol}: Não executável - ${sizing.reason}`);
        return null;
      }

      // 8. ✅ CORREÇÃO: Criar oportunidade de trading
      const opportunity: TradingOpportunity = {
        symbol,
        side,
        leverage: finalConfig.leverage,
        maxMarginUsd: maxMarginForTrade,
        sizing,
        scoring,
        action: signal.action as 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL',
        strength: signal.strength,
        confidence: scoring.confidencePct
      };

      logTrading(`✅ ${symbol}: Oportunidade criada`, {
        action: opportunity.action,
        strength: opportunity.strength,
        confidence: opportunity.confidence,
        qty: opportunity.sizing.qty?.toFixed(opportunity.sizing.meta?.precision || 4),
        notional: opportunity.sizing.notionalUsd?.toFixed(2)
      });

      return opportunity;
    } catch (error) {
      logger.error(`❌ Erro ao processar ${symbol}:`, 'TRADING', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ NOVO: Processar múltiplos símbolos e retornar oportunidades executáveis
   */
  public static async getOptimalSymbols(
    symbols: string[],
    scoringDataMap: Map<string, any>,
    availableMargin: number,
    config: Partial<DecisionConfig> = {}
  ): Promise<TradingOpportunity[]> {
    
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    logTrading(`🔍 Processando ${symbols.length} símbolos para oportunidades executáveis...`);

    const opportunities: TradingOpportunity[] = [];
    
    // Processar símbolos em paralelo para melhor performance
    const promises = symbols.map(async (symbol) => {
      const scoringData = scoringDataMap.get(symbol);
      if (!scoringData) {
        logTrading(`⚠️ ${symbol}: Dados de scoring não encontrados`);
        return null;
      }
      
      return await this.processSymbol(symbol, scoringData, availableMargin, finalConfig);
    });

    const results = await Promise.all(promises);
    
    // Filtrar oportunidades válidas
    results.forEach((opportunity) => {
      if (opportunity) {
        opportunities.push(opportunity);
      }
    });

    // ✅ CORREÇÃO: Ordenar por confiança e força do sinal
    opportunities.sort((a, b) => {
      // Priorizar sinais fortes
      if (a.strength === 'strong' && b.strength !== 'strong') return -1;
      if (b.strength === 'strong' && a.strength !== 'strong') return 1;
      
      // Depois por confiança
      return b.confidence - a.confidence;
    });

    // ✅ CORREÇÃO: Limitar número de trades
    const limitedOpportunities = opportunities.slice(0, finalConfig.maxTrades);

    logTrading(`🎯 Oportunidades encontradas: ${limitedOpportunities.length}/${symbols.length}`, {
      total: symbols.length,
      valid: opportunities.length,
      limited: limitedOpportunities.length,
      opportunities: limitedOpportunities.map(opp => ({
        symbol: opp.symbol,
        action: opp.action,
        strength: opp.strength,
        confidence: opp.confidence,
        notional: opp.sizing.notionalUsd?.toFixed(2)
      }))
    });

    return limitedOpportunities;
  }

  /**
   * ✅ NOVO: Validar oportunidade antes da execução
   */
  public static async validateOpportunity(
    opportunity: TradingOpportunity,
    currentPositions: number = 0,
    maxPositions: number = 2
  ): Promise<{ valid: boolean; reason?: string }> {
    
    // Verificar limite de posições
    if (currentPositions >= maxPositions) {
      return {
        valid: false,
        reason: `Limite de posições atingido: ${currentPositions}/${maxPositions}`
      };
    }

    // Verificar se sizing ainda é válido
    if (!opportunity.sizing.ok) {
      return {
        valid: false,
        reason: `Sizing inválido: ${opportunity.sizing.reason}`
      };
    }

    // Verificar confiança mínima
    if (opportunity.confidence < 30) {
      return {
        valid: false,
        reason: `Confiança muito baixa: ${opportunity.confidence}%`
      };
    }

    // Verificar se notional é válido
    if (!opportunity.sizing.notionalUsd || opportunity.sizing.notionalUsd < 5) {
      return {
        valid: false,
        reason: `Notional muito baixo: $${opportunity.sizing.notionalUsd?.toFixed(2)}`
      };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Executar oportunidade (preparar ordem)
   */
  public static async prepareOrder(opportunity: TradingOpportunity): Promise<{
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET';
    quantity: string;
    notional: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
  } | null> {
    
    try {
      if (!opportunity.sizing.ok || !opportunity.sizing.qty || !opportunity.sizing.meta) {
        logTrading(`❌ ${opportunity.symbol}: Sizing inválido para preparar ordem`);
        return null;
      }

      const order = {
        symbol: opportunity.symbol,
        side: opportunity.side,
        type: 'MARKET' as const,
        quantity: opportunity.sizing.qty.toFixed(opportunity.sizing.meta.precision),
        notional: opportunity.sizing.notionalUsd!,
        leverage: opportunity.leverage
      };

      logTrading(`📋 Ordem preparada para ${opportunity.symbol}`, {
        side: order.side,
        quantity: order.quantity,
        notional: order.notional.toFixed(2),
        leverage: order.leverage
      });

      return order;
    } catch (error) {
      logger.error(`❌ Erro ao preparar ordem para ${opportunity.symbol}:`, 'TRADING', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ NOVO: Obter estatísticas das oportunidades
   */
  public static getOpportunityStats(opportunities: TradingOpportunity[]): {
    total: number;
    buy: number;
    sell: number;
    strong: number;
    moderate: number;
    weak: number;
    avgConfidence: number;
    totalNotional: number;
    totalMargin: number;
  } {
    let buy = 0;
    let sell = 0;
    let strong = 0;
    let moderate = 0;
    let weak = 0;
    let totalConfidence = 0;
    let totalNotional = 0;
    let totalMargin = 0;

    opportunities.forEach(opp => {
      if (opp.action.includes('BUY')) buy++;
      if (opp.action.includes('SELL')) sell++;
      if (opp.strength === 'strong') strong++;
      if (opp.strength === 'moderate') moderate++;
      if (opp.strength === 'weak') weak++;
      
      totalConfidence += opp.confidence;
      totalNotional += opp.sizing.notionalUsd || 0;
      totalMargin += opp.sizing.requiredMargin || 0;
    });

    return {
      total: opportunities.length,
      buy,
      sell,
      strong,
      moderate,
      weak,
      avgConfidence: opportunities.length > 0 ? totalConfidence / opportunities.length : 0,
      totalNotional,
      totalMargin
    };
  }
}

export default ConsistentDecisionEngine;
