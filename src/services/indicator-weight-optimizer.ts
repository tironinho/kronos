/**
 * INDICATOR WEIGHT OPTIMIZER
 * 
 * Sistema que otimiza os pesos dos indicadores baseado em resultados reais de trades
 * Analisa trade_analysis_parameters e ajusta pesos dinamicamente
 */

import { supabase } from './supabase-db';

interface IndicatorPerformance {
  indicator: string;
  weight: number;
  totalTrades: number;
  winningTrades: number;
  avgConfidence: number;
  avgPnl: number;
  correlationWithSuccess: number;
  suggestedWeight: number;
}

interface OptimizedWeights {
  technical: number;
  sentiment: number;
  onchain: number;
  derivatives: number;
  macro: number;
  smartmoney: number;
  news?: number;
  fundamental?: number;
}

export class IndicatorWeightOptimizer {
  private static instance: IndicatorWeightOptimizer;
  private currentWeights: OptimizedWeights = {
    technical: 0.40,
    sentiment: 0.08,
    onchain: 0.15,
    derivatives: 0.27,
    macro: 0.05,
    smartmoney: 0.05
  };
  private lastOptimization: Date | null = null;
  private readonly MIN_TRADES_FOR_OPTIMIZATION = 10;
  private readonly OPTIMIZATION_INTERVAL_HOURS = 168; // 1 semana

  private constructor() {}

  public static getInstance(): IndicatorWeightOptimizer {
    if (!IndicatorWeightOptimizer.instance) {
      IndicatorWeightOptimizer.instance = new IndicatorWeightOptimizer();
    }
    return IndicatorWeightOptimizer.instance;
  }

  /**
   * Analisa performance de cada indicador baseado em trades fechadas
   */
  public async analyzeIndicatorPerformance(): Promise<IndicatorPerformance[]> {
    try {
      // Buscar trades fechadas com parâmetros de análise
      const { data: closedTrades, error: tradesError } = await supabase
        .from('real_trades')
        .select('trade_id, pnl, pnl_percent, confidence')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(100);

      if (tradesError || !closedTrades || closedTrades.length < this.MIN_TRADES_FOR_OPTIMIZATION) {
        console.log(`⚠️ Indicadores insuficientes para otimização (mínimo ${this.MIN_TRADES_FOR_OPTIMIZATION} trades)`);
        return [];
      }

      // Buscar parâmetros de análise para essas trades
      const tradeIds = closedTrades.map((t: any) => t.trade_id);
      const { data: analysisParams, error: paramsError } = await supabase
        .from('trade_analysis_parameters')
        .select('*')
        .in('trade_id', tradeIds);

      if (paramsError || !analysisParams || analysisParams.length === 0) {
        console.log('⚠️ Nenhum parâmetro de análise encontrado');
        return [];
      }

      // Mapear trades com seus parâmetros
      const tradesWithParams = closedTrades.map((trade: any) => {
        const params = analysisParams.find((p: any) => p.trade_id === trade.trade_id);
        return {
          trade,
          params,
          isWinner: parseFloat(trade.pnl?.toString() || '0') > 0
        };
      }).filter((t: any) => t.params); // Filtrar apenas trades com parâmetros

      // Analisar cada indicador
      const indicators: IndicatorPerformance[] = [];

      // 1. Technical Score
      const technicalAnalysis = this.analyzeIndicator(
        'technical',
        tradesWithParams,
        (t: any) => parseFloat(t.params.predictive_v2_technical_score || '0'),
        0.40
      );
      if (technicalAnalysis) indicators.push(technicalAnalysis);

      // 2. Sentiment Score
      const sentimentAnalysis = this.analyzeIndicator(
        'sentiment',
        tradesWithParams,
        (t: any) => parseFloat(t.params.predictive_v2_sentiment_score || '0'),
        0.08
      );
      if (sentimentAnalysis) indicators.push(sentimentAnalysis);

      // 3. On-chain Score
      const onchainAnalysis = this.analyzeIndicator(
        'onchain',
        tradesWithParams,
        (t: any) => parseFloat(t.params.predictive_v2_onchain_score || '0'),
        0.15
      );
      if (onchainAnalysis) indicators.push(onchainAnalysis);

      // 4. Derivatives Score
      const derivativesAnalysis = this.analyzeIndicator(
        'derivatives',
        tradesWithParams,
        (t: any) => parseFloat(t.params.predictive_v2_derivatives_score || '0'),
        0.27
      );
      if (derivativesAnalysis) indicators.push(derivativesAnalysis);

      // 5. Macro Score
      const macroAnalysis = this.analyzeIndicator(
        'macro',
        tradesWithParams,
        (t: any) => parseFloat(t.params.predictive_v2_macro_score || '0'),
        0.05
      );
      if (macroAnalysis) indicators.push(macroAnalysis);

      // 6. Smart Money Score
      const smartMoneyAnalysis = this.analyzeIndicator(
        'smartmoney',
        tradesWithParams,
        (t: any) => parseFloat(t.params.predictive_v2_smart_money_score || '0'),
        0.05
      );
      if (smartMoneyAnalysis) indicators.push(smartMoneyAnalysis);

      return indicators;

    } catch (error) {
      console.error('❌ Erro ao analisar performance de indicadores:', error);
      return [];
    }
  }

  /**
   * Analisa um indicador específico
   */
  private analyzeIndicator(
    name: string,
    tradesWithParams: any[],
    getScore: (t: any) => number,
    currentWeight: number
  ): IndicatorPerformance | null {
    const scores = tradesWithParams
      .map((t: any) => ({ score: getScore(t), isWinner: t.isWinner, pnl: parseFloat(t.trade.pnl?.toString() || '0') }))
      .filter((s: any) => !isNaN(s.score) && s.score !== 0);

    if (scores.length < 5) return null; // Mínimo de 5 trades com dados

    const totalTrades = scores.length;
    const winningTrades = scores.filter((s: any) => s.isWinner).length;
    const avgConfidence = scores.reduce((sum: number, s: any) => sum + Math.abs(s.score), 0) / totalTrades;
    const avgPnl = scores.reduce((sum: number, s: any) => sum + s.pnl, 0) / totalTrades;

    // Correlação: score positivo deve estar associado a wins
    const positiveScoreTrades = scores.filter((s: any) => s.score > 0);
    const positiveScoreWins = positiveScoreTrades.filter((s: any) => s.isWinner).length;
    const correlationWithSuccess = positiveScoreTrades.length > 0
      ? positiveScoreWins / positiveScoreTrades.length
      : 0;

    // Calcular peso sugerido baseado em performance
    // Fórmula: peso atual * (correlação * (winRate / 50))
    const winRate = winningTrades / totalTrades;
    const performanceMultiplier = correlationWithSuccess * (winRate / 0.5); // Normalizado para 50% como baseline
    const suggestedWeight = Math.max(0.01, Math.min(0.50, currentWeight * (1 + performanceMultiplier - 1)));

    return {
      indicator: name,
      weight: currentWeight,
      totalTrades,
      winningTrades,
      avgConfidence,
      avgPnl,
      correlationWithSuccess,
      suggestedWeight
    };
  }

  /**
   * Otimiza pesos dos indicadores
   */
  public async optimizeWeights(): Promise<OptimizedWeights | null> {
    // Verificar se já otimizou recentemente
    if (this.lastOptimization) {
      const hoursSinceLastOptimization = (Date.now() - this.lastOptimization.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastOptimization < this.OPTIMIZATION_INTERVAL_HOURS) {
        console.log(`⏸️ Otimização recente (há ${hoursSinceLastOptimization.toFixed(1)}h), aguardando ${this.OPTIMIZATION_INTERVAL_HOURS}h`);
        return null;
      }
    }

    console.log('🔧 Iniciando otimização de pesos de indicadores...');
    
    const performance = await this.analyzeIndicatorPerformance();
    
    if (performance.length === 0) {
      console.log('⚠️ Dados insuficientes para otimização');
      return null;
    }

      // Calcular novos pesos baseado em performance
      const totalSuggestedWeight = performance.reduce((sum: number, p: IndicatorPerformance) => sum + p.suggestedWeight, 0);
    
    // Normalizar para somar 1.0
    const normalizedWeights: OptimizedWeights = {
      technical: 0,
      sentiment: 0,
      onchain: 0,
      derivatives: 0,
      macro: 0,
      smartmoney: 0
    };

      performance.forEach((p: IndicatorPerformance) => {
      const normalized = p.suggestedWeight / totalSuggestedWeight;
      switch (p.indicator) {
        case 'technical':
          normalizedWeights.technical = normalized;
          break;
        case 'sentiment':
          normalizedWeights.sentiment = normalized;
          break;
        case 'onchain':
          normalizedWeights.onchain = normalized;
          break;
        case 'derivatives':
          normalizedWeights.derivatives = normalized;
          break;
        case 'macro':
          normalizedWeights.macro = normalized;
          break;
        case 'smartmoney':
          normalizedWeights.smartmoney = normalized;
          break;
      }
    });

    // Aplicar mudança gradual (max 20% de mudança por vez)
    Object.keys(normalizedWeights).forEach(key => {
      const current = this.currentWeights[key as keyof OptimizedWeights];
      const suggested = normalizedWeights[key as keyof OptimizedWeights];
      const change = suggested - current;
      const maxChange = current * 0.2; // Máximo 20% de mudança
      normalizedWeights[key as keyof OptimizedWeights] = current + Math.max(-maxChange, Math.min(maxChange, change));
    });

    // Renormalizar após ajuste gradual
    const finalTotal = Object.values(normalizedWeights).reduce((a: number, b: number) => a + b, 0);
    Object.keys(normalizedWeights).forEach((key: string) => {
      normalizedWeights[key as keyof OptimizedWeights] = normalizedWeights[key as keyof OptimizedWeights] / finalTotal;
    });

    this.currentWeights = normalizedWeights;
    this.lastOptimization = new Date();

    console.log('✅ Pesos otimizados:');
    console.log(`   Technical: ${normalizedWeights.technical.toFixed(3)} (era ${performance.find(p => p.indicator === 'technical')?.weight.toFixed(3)})`);
    console.log(`   Sentiment: ${normalizedWeights.sentiment.toFixed(3)} (era ${performance.find(p => p.indicator === 'sentiment')?.weight.toFixed(3)})`);
    console.log(`   Derivatives: ${normalizedWeights.derivatives.toFixed(3)} (era ${performance.find(p => p.indicator === 'derivatives')?.weight.toFixed(3)})`);

    return normalizedWeights;
  }

  /**
   * Obtém pesos otimizados atuais
   */
  public getOptimizedWeights(): OptimizedWeights {
    return { ...this.currentWeights };
  }

  /**
   * Aplica pesos otimizados ao PredictiveAnalyzerV2
   */
  public async applyOptimizedWeights(): Promise<boolean> {
    const optimized = await this.optimizeWeights();
    
    if (!optimized) {
      return false;
    }

    // Nota: Os pesos precisam ser aplicados no PredictiveAnalyzerV2
    // Isso pode ser feito via configuração ou injeção de dependência
    // Por enquanto, apenas retornamos os pesos otimizados
    // O PredictiveAnalyzerV2 deve ler estes pesos deste serviço

    return true;
  }
}

export const indicatorWeightOptimizer = IndicatorWeightOptimizer.getInstance();

