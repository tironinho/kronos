// ============================================================================
// PREDICTIVE ANALYZER V2 - Consolidação INTELIGENTE com Pesos
// ============================================================================

import { technicalAnalyzerV2, TechnicalSignal } from './technical-analyzer-v2';
import { sentimentAnalyzer } from './sentiment-analyzer';
import { onChainAnalyzer } from './onchain-analyzer';
import { derivativesAnalyzer } from './derivatives-analyzer';
import { macroAnalyzer } from './macro-analyzer';
import { smartMoneyAnalyzer } from './smartmoney-analyzer';
import { coinGeckoAPI } from './coingecko-api';
import { fearGreedAPI } from './fear-greed-api';
import { cryptoPanicAPI } from './cryptopanic-api';

export interface PredictiveAnalysisV2 {
  scores: {
    technical: number;      // Peso: 40%
    sentiment: number;       // Peso: 15%
    onchain: number;         // Peso: 15%
    derivatives: number;      // Peso: 15%
    macro: number;           // Peso: 10%
    smartmoney: number;       // Peso: 5%
  };
  
  weightedScore: number;     // Score ponderado
  confidence: number;        // 0 a 100%
  
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  strength: 'weak' | 'moderate' | 'strong';
  rationale: string;
  
  technicalDetails: TechnicalSignal;
}

export class PredictiveAnalyzerV2 {
  // Pesos baseados em confiabilidade histórica
  private weights = {
    technical: 0.40,      // Maior peso: análises técnicas são mais confiáveis
    sentiment: 0.08,       // ✅ REDUZIDO: sentiment pode ser volátil
    onchain: 0.15,         // Médio: dados reais mas podem ter delay
    derivatives: 0.27,     // ✅ AUMENTADO: derivativos são CRÍTICOS para identificar reversão
    macro: 0.05,           // ✅ REDUZIDO: macro afeta longo prazo
    smartmoney: 0.05       // Muito baixo: dados limitados
  };
  
  /**
   * Consolida todas as análises com PESOS
   */
  async consolidate(symbol: string): Promise<PredictiveAnalysisV2> {
    console.log('🧠 [V2] Consolidando análises preditivas com pesos...');
    
    // Executar TODAS as análises em paralelo
    const [technical, sentiment, onchain, derivatives, macro, smartmoney] = await Promise.all([
      technicalAnalyzerV2.analyze(symbol, '1h'),
      sentimentAnalyzer.analyze(symbol),
      onChainAnalyzer.analyze(symbol),
      derivativesAnalyzer.analyze(symbol),
      macroAnalyzer.analyze(symbol),
      smartMoneyAnalyzer.analyze(symbol)
    ]);
    
    // ✅ NOVAS APIs GRATUITAS: Buscar dados em paralelo
    const [coingeckoScore, fearGreedScore, newsScore] = await Promise.all([
      coinGeckoAPI.calculateVolumeScore(symbol).catch(() => 0),
      fearGreedAPI.calculateSentimentScore().catch(() => 0),
      cryptoPanicAPI.calculateNewsScore(symbol, 6).catch(() => 0)
    ]);
    
    console.log(`🔍 [APIS GRATUITAS] CoinGecko: ${coingeckoScore.toFixed(2)} | Fear&Greed: ${fearGreedScore.toFixed(2)} | Notícias: ${newsScore.toFixed(2)}`);
    
    // Normalizar scores para -10 a +10
    // ✅ FIX: socialVolume deve ser normalizado para 0-1 antes de passar para normalizeToScore
    const scores = {
      technical: this.normalizeToSignal(technical.signal, technical.confidence),
      sentiment: this.normalizeToScore(sentiment.consolidatedScore, Math.min(sentiment.socialVolume / 1000, 1)),
      onchain: this.normalizeToScore(onchain.onChainScore, 1),
      derivatives: this.normalizeToScore(derivatives.derivativesScore, 1),
      macro: this.normalizeToScore(macro.macroScore, 1),
      smartmoney: this.normalizeToScore(smartmoney.smartMoneyScore, 1),
      // ✅ NOVOS: APIs gratuitas
      coingecko: this.normalizeToScore(coingeckoScore, 1),
      feargreed: this.normalizeToScore(fearGreedScore, 1),
      news: this.normalizeToScore(newsScore, 1)
    };
    
    // 🔍 DEBUG: Mostrar scores individuais
    console.log(`🔍 [DEBUG] Scores individuais:`);
    console.log(`   Technical: ${scores.technical.toFixed(2)} (weight: ${this.weights.technical})`);
    console.log(`   Sentiment: ${scores.sentiment.toFixed(2)} (weight: ${this.weights.sentiment})`);
    console.log(`   On-chain: ${scores.onchain.toFixed(2)} (weight: ${this.weights.onchain})`);
    console.log(`   Derivatives: ${scores.derivatives.toFixed(2)} (weight: ${this.weights.derivatives})`);
    console.log(`   Macro: ${scores.macro.toFixed(2)} (weight: ${this.weights.macro})`);
    console.log(`   Smart Money: ${scores.smartmoney.toFixed(2)} (weight: ${this.weights.smartmoney})`);
    console.log(`   CoinGecko: ${scores.coingecko.toFixed(2)} (weight: 0.02)`);
    console.log(`   Fear & Greed: ${scores.feargreed.toFixed(2)} (weight: 0.02)`);
    console.log(`   Notícias: ${scores.news.toFixed(2)} (weight: 0.01)`);
    
    // ✅ NOVO: Calcular score PONDERADO ignorando indicadores zerados
    const scoreData = [
      { name: 'technical', score: scores.technical, weight: this.weights.technical },
      { name: 'sentiment', score: scores.sentiment, weight: this.weights.sentiment },
      { name: 'onchain', score: scores.onchain, weight: this.weights.onchain },
      { name: 'derivatives', score: scores.derivatives, weight: this.weights.derivatives },
      { name: 'macro', score: scores.macro, weight: this.weights.macro },
      { name: 'smartmoney', score: scores.smartmoney, weight: this.weights.smartmoney },
      { name: 'coingecko', score: scores.coingecko, weight: 0.02 },
      { name: 'feargreed', score: scores.feargreed, weight: 0.02 },
      { name: 'news', score: scores.news, weight: 0.01 }
    ];
    
    // Filtrar apenas indicadores com dados (não zerados)
    const activeIndicators = scoreData.filter(item => item.score !== 0);
    
    // Calcular peso total dos indicadores ativos
    const totalActiveWeight = activeIndicators.reduce((sum, item) => sum + item.weight, 0);
    
    // Normalizar pesos para somar 100% apenas entre ativos
    const normalizedWeights = activeIndicators.map(item => ({
      ...item,
      normalizedWeight: item.weight / totalActiveWeight
    }));
    
    // Calcular score ponderado apenas com indicadores ativos
    const weightedScore = normalizedWeights.reduce((sum, item) => 
      sum + (item.score * item.normalizedWeight), 0
    );
    
    // Debug dos pesos normalizados
    if (activeIndicators.length !== scoreData.length) {
      console.log(`⚠️ [FILTRO] ${scoreData.length - activeIndicators.length} indicadores ZERADOS removidos do cálculo`);
      console.log(`📊 [NORMALIZADO] Peso total ativo: ${(totalActiveWeight * 100).toFixed(0)}%`);
    }
    
    // Calcular confiança baseada em CONVERGÊNCIA (usando apenas indicadores ativos)
    const confidence = this.calculateConfidence(
      scores, 
      technical, 
      activeIndicators.length,
      scoreData.length
    );
    
    // Gerar sinal
    const { signal, strength, rationale } = this.generateSignal(weightedScore, confidence, technical);
    
    console.log(`✅ Score ponderado: ${weightedScore.toFixed(2)} (Confiança: ${confidence}%)`);
    console.log(`📋 Sinal: ${signal} ${strength}`);
    
    return {
      scores,
      weightedScore,
      confidence,
      signal,
      strength,
      rationale,
      technicalDetails: technical
    };
  }
  
  /**
   * Normaliza sinal técnico para -10 a +10
   */
  private normalizeToSignal(signal: string, confidence: number): number {
    const scoreMap: Record<string, number> = {
      'STRONG_BUY': 10,
      'BUY': 6,
      'HOLD': 0,
      'SELL': -6,
      'STRONG_SELL': -10
    };
    
    const baseScore = scoreMap[signal] || 0;
    // Ajustar por confiança (60% = 1.0x, 95% = 1.5x)
    const multiplier = 0.5 + (confidence / 100);
    return baseScore * multiplier;
  }
  
  /**
   * Normaliza qualquer score para -10 a +10
   */
  private normalizeToScore(value: number, volume: number = 1): number {
    // Limitar a -2 a +2 primeiro
    const limited = Math.max(-2, Math.min(2, value));
    // Escalar para -10 a +10
    return limited * 5 * volume;
  }
  
  /**
   * Calcula confiança baseada em CONVERGÊNCIA (quanto mais sinais alinhados, maior confiança)
   * ✅ MELHORIA: Ignora indicadores zerados no cálculo
   */
  private calculateConfidence(
    scores: any, 
    technical: any,
    activeIndicators: number,
    totalIndicators: number
  ): number {
    // Base de confiança do técnico
    let confidence = technical.confidence || 60;
    
    console.log(`🔍 [DEBUG CONFIANÇA] Base técnico: ${technical.confidence || 60}%`);
    
    // ✅ AJUSTE: Bonus/penalidade baseado em indicadores ativos (mais suave)
    const activeRatio = activeIndicators / totalIndicators;
    if (activeRatio >= 0.8) {
      confidence += 10; // 80%+ dos indicadores ativos = +10% confiança
      console.log(`🔍 [DEBUG CONFIANÇA] +10% bonus (${(activeRatio * 100).toFixed(0)}% ativos) = ${confidence}%`);
    } else if (activeRatio >= 0.6) {
      confidence += 5;  // 60%+ dos indicadores ativos = +5% confiança
      console.log(`🔍 [DEBUG CONFIANÇA] +5% bonus (${(activeRatio * 100).toFixed(0)}% ativos) = ${confidence}%`);
    } else if (activeRatio >= 0.4) {
      // 40-59% ativos: Mantém confiança (já penalizado pelo score normalizado)
      console.log(`🔍 [DEBUG CONFIANÇA] Sem penalidade (${(activeRatio * 100).toFixed(0)}% ativos é aceitável) = ${confidence}%`);
    } else {
      confidence -= 10; // <40% dos indicadores ativos = -10% confiança (poucos dados)
      console.log(`🔍 [DEBUG CONFIANÇA] -10% penalidade (${(activeRatio * 100).toFixed(0)}% ativos é baixo) = ${confidence}%`);
    }
    
    // Verificar convergência APENAS em indicadores ATIVOS (não zerados)
    const activeScores = Object.values(scores).filter((v: any) => v !== 0);
    const positives = activeScores.filter((v: any) => v > 2).length;
    const negatives = activeScores.filter((v: any) => v < -2).length;
    const neutrals = activeScores.filter((v: any) => Math.abs(v) <= 2).length;
    
    console.log(`🔍 [DEBUG CONFIANÇA] Convergência: +${positives} positivos, -${negatives} negativos, ${neutrals} neutros`);
    
    // TODOS alinhados para BUY
    if (positives >= 4 && negatives === 0) {
      confidence = Math.min(95, confidence + 20);
      console.log(`🔍 [DEBUG CONFIANÇA] +20% (todos alinhados BUY) = ${confidence}%`);
    }
    
    // TODOS alinhados para SELL
    if (negatives >= 4 && positives === 0) {
      confidence = Math.min(95, confidence + 20);
      console.log(`🔍 [DEBUG CONFIANÇA] +20% (todos alinhados SELL) = ${confidence}%`);
    }
    
    // Sinais conflitantes (mix de BUY/SELL) - AJUSTADO: Só penalizar se MUITO conflito
    if (positives > 0 && negatives > 0) {
      const conflictLevel = Math.min(positives, negatives);
      // Só penalizar se conflito forte (positives ≈ negatives)
      if (conflictLevel >= 2) {
        confidence -= 10; // Conflito forte: -10%
        console.log(`🔍 [DEBUG CONFIANÇA] -10% (conflito forte: ${conflictLevel}) = ${confidence}%`);
      } else {
        // Conflito fraco: manter confiança (é normal ter algum desacordo)
        console.log(`🔍 [DEBUG CONFIANÇA] Conflito leve ignorado (${positives} vs ${negatives}) = ${confidence}%`);
      }
    }
    
    // Penalizar se muitos neutros (falta de confluência)
    if (neutrals >= 3) {
      confidence -= 10;
      console.log(`🔍 [DEBUG CONFIANÇA] -10% (muitos neutros) = ${confidence}%`);
    }
    
    const finalConfidence = Math.max(40, Math.min(95, confidence));
    console.log(`🔍 [DEBUG CONFIANÇA] FINAL: ${finalConfidence}%`);
    
    return finalConfidence;
  }
  
  /**
   * Gera sinal final
   */
  private generateSignal(
    score: number, 
    confidence: number, 
    technical: TechnicalSignal
  ): { signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'; strength: 'weak' | 'moderate' | 'strong'; rationale: string } {
    
    // ✅ AJUSTE FINAL: Permitir trades com thresholds mais flexíveis
    let signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    
    // SELL: MUITO PERMISSIVO (score negativo gera SELL facilmente!)
    if (score <= -2 && confidence >= 40) signal = 'STRONG_SELL';
    else if (score <= -0.3 && confidence >= 40) signal = 'SELL';  // ✅ REDUZIDO de -0.5 para -0.3
    
    // BUY: MUITO permissivo agora (permite trades!)
    else if (score >= 2.5 && confidence >= 45) signal = 'STRONG_BUY';  // ✅ REDUZIDO de 4/50 para 2.5/45
    else if (score >= 0.5 && confidence >= 40) signal = 'BUY';         // ✅ REDUZIDO de 2/50 para 0.5/40
    
    else signal = 'HOLD';
    
    // Determinar força
    const strength: 'weak' | 'moderate' | 'strong' = 
      Math.abs(score) >= 6 ? 'strong' : 
      Math.abs(score) >= 3 ? 'moderate' : 'weak';
    
    // Rationale detalhado
    const technicalMsg = technical.signal !== 'HOLD' 
      ? `Técnico: ${technical.signal} (${technical.rsi.toFixed(1)} RSI, ${technical.trend}, ${technical.rationale}).` 
      : 'Técnico neutro.';
    
    const rationale = `${technicalMsg} Score ponderado: ${score.toFixed(2)}. Confiança: ${confidence}%.`;
    
    return { signal, strength, rationale };
  }
}

export const predictiveAnalyzerV2 = new PredictiveAnalyzerV2();

