// ============================================================================
// PREDICTIVE ANALYZER - Consolidação de Todas as Análises
// ============================================================================

export interface PredictiveAnalysis {
  categories: {
    technical: number;             // -2 a +2
    sentiment: number;              // -2 a +2
    onchain: number;                // -2 a +2
    derivatives: number;             // -2 a +2
    macro: number;                  // -2 a +2
    smartmoney: number;             // -2 a +2
  };
  
  consolidatedScore: number;        // -12 a +12
  confidence: number;               // 0 a 100%
  
  recommendation: {
    action: 'BUY' | 'SELL' | 'HOLD';
    strength: 'weak' | 'moderate' | 'strong';
    rationale: string;
  };
}

export class PredictiveAnalyzer {
  /**
   * Consolida todas as análises
   */
  consolidate(data: {
    technical: number;
    sentiment: number;
    onchain: number;
    derivatives: number;
    macro: number;
    smartmoney: number;
  }): PredictiveAnalysis {
    console.log('🧠 Consolidando análises preditivas...');
    
    const categories = {
      technical: this.normalizeScore(data.technical, -10, 10, -2, 2),
      sentiment: data.sentiment,
      onchain: data.onchain,
      derivatives: data.derivatives,
      macro: data.macro,
      smartmoney: data.smartmoney
    };
    
    // Calcular score consolidado (soma de todos)
    const consolidatedScore = 
      categories.technical +
      categories.sentiment +
      categories.onchain +
      categories.derivatives +
      categories.macro +
      categories.smartmoney;
    
    // Calcular confiança baseada em convergência
    const confidence = this.calculateConfidence(categories);
    
    // Gerar recomendação
    const recommendation = this.generateRecommendation(consolidatedScore, confidence, categories);
    
    console.log(`✅ Score consolidado: ${consolidatedScore} (Confiança: ${confidence}%)`);
    console.log(`📋 Recomendação: ${recommendation.action} ${recommendation.strength}`);
    
    return {
      categories,
      consolidatedScore,
      confidence,
      recommendation
    };
  }
  
  /**
   * Normaliza score
   */
  private normalizeScore(value: number, min: number, max: number, newMin: number, newMax: number): number {
    const normalized = ((value - min) / (max - min)) * (newMax - newMin) + newMin;
    return Math.max(newMin, Math.min(newMax, normalized));
  }
  
  /**
   * Calcula confiança baseada em convergência
   */
  private calculateConfidence(categories: any): number {
    // Verifica quão alinhados estão os sinais
    const scores = Object.values(categories).map((v: any) => Math.abs(v));
    const averageAlignment = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // AJUSTADO: Base de confiança aumentada para executar mais trades
    // ANTES: 60% base
    // AGORA: 70% base (acima do threshold de 70%)
    let confidence = 70; // Base aumentada
    
    if (averageAlignment > 1.0) confidence = 75;  // Sinais alinhados (antes 1.5)
    if (averageAlignment > 1.5) confidence = 85;  // Sinais muito alinhados (antes 2.0)
    if (averageAlignment > 2.0) confidence = 95;  // Sinais extremamente alinhados
    
    // Penalizar se há sinais conflitantes (mas menos que antes)
    const positives = Object.values(categories).filter((v: any) => v > 0).length;
    const negatives = Object.values(categories).filter((v: any) => v < 0).length;
    
    if (positives > 0 && negatives > 0) {
      const conflict = Math.min(positives, negatives);
      confidence -= conflict * 5; // Menos penalização (era 10)
    }
    
    // Garantir mínimo de 60% para permitir execução
    return Math.max(60, Math.min(100, confidence));
  }
  
  /**
   * Gera recomendação final
   */
  private generateRecommendation(
    score: number,
    confidence: number,
    categories: any
  ): { action: 'BUY' | 'SELL' | 'HOLD'; strength: 'weak' | 'moderate' | 'strong'; rationale: string } {
    
    // AJUSTADO: Limites ULTRA baixos para executar trades com capital baixo
    // ANTES: score >= 0.3 → BUY, score <= -0.3 → SELL
    // AGORA: score >= 0.0 → BUY, score <= 0.0 → SELL (permite QUALQUER score positivo/negativo)
    const action = score > 0 ? 'BUY' : score < 0 ? 'SELL' : 'HOLD';
    
    // ATENÇÃO: strength não mudou, ainda usa limites originais
    const strength = Math.abs(score) >= 8 ? 'strong' : Math.abs(score) >= 4 ? 'moderate' : 'weak';
    
    // Gerar rationale explicando os sinais
    const rationale = this.generateRationale(action, score, categories);
    
    return { action, strength, rationale };
  }
  
  /**
   * Gera explicação detalhada
   */
  private generateRationale(action: string, score: number, categories: any): string {
    const signals: string[] = [];
    
    if (categories.technical > 1) signals.push('Análise técnica bullish');
    if (categories.technical < -1) signals.push('Análise técnica bearish');
    
    if (categories.sentiment > 1) signals.push('Sentimento positivo');
    if (categories.sentiment < -1) signals.push('Sentimento negativo');
    
    if (categories.onchain > 1) signals.push('Dados on-chain favoráveis');
    if (categories.onchain < -1) signals.push('Dados on-chain desfavoráveis');
    
    if (categories.derivatives > 1) signals.push('Derivativos indicam reversão');
    if (categories.derivatives < -1) signals.push('Derivativos indicam continuidade');
    
    if (categories.macro > 1) signals.push('Macro ambiente favorável');
    if (categories.macro < -1) signals.push('Macro ambiente desfavorável');
    
    if (categories.smartmoney > 1) signals.push('Smart money acumulando');
    if (categories.smartmoney < -1) signals.push('Smart money distribuindo');
    
    const reason = signals.length > 0 
      ? signals.join(', ')
      : 'Sinais mistos ou neutros';
    
    return `Score: ${score.toFixed(1)}. ${reason}. Confiança: ${this.calculateConfidence(categories)}%.`;
  }
}

export const predictiveAnalyzer = new PredictiveAnalyzer();

