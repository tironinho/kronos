// ============================================================================
// MACRO ANALYZER - Análise Macro Econômica
// ============================================================================

import { alphaVantageClient } from '../alpha-vantage-client';

export interface MacroAnalysis {
  fedPolicy: 'dovish' | 'hawkish';
  dxy: number;                     // DXY forte = BTC fraco
  sp500Correlation: number;        // Correlação com SP500
  fearGreedGlobal: number;         // Global market sentiment
  newsImpact: 'high' | 'medium' | 'low';
  
  macroScore: number;              // -2 a +2
}

export class MacroAnalyzer {
  /**
   * Analisa macro econômica
   */
  async analyze(symbol: string): Promise<MacroAnalysis> {
    console.log(`🌍 Analisando macro de ${symbol}...`);
    
    const fedPolicy = await this.getFedPolicy();
    const dxy = await this.getDXY();
    const sp500Correlation = await this.getSP500Correlation(symbol);
    
    const macroScore = this.calculateMacroScore({
      fedPolicy,
      dxy,
      sp500Correlation
    });
    
    return {
      fedPolicy,
      dxy,
      sp500Correlation,
      fearGreedGlobal: 50, // Placeholder
      newsImpact: 'low',
      macroScore
    };
  }
  
  /**
   * Obtém política do Fed (usando Alpha Vantage para dados econômicos)
   */
  private async getFedPolicy(): Promise<'dovish' | 'hawkish'> {
    try {
      // Buscar dados econômicos Alpha Vantage (GDP e Inflação)
      const economicData = await alphaVantageClient.getCompleteEconomicData();
      
      if (economicData.gdp && economicData.inflation) {
        // GDP crescendo + inflação controlada = dovish (favorável para risco)
        // GDP caindo OU inflação alta = hawkish (desfavorável para risco)
        const gdpTrend = economicData.gdp.value > 0 ? 1 : -1;
        const inflationRisk = economicData.inflation.value > 3 ? -1 : 1;
        
        const score = gdpTrend + inflationRisk;
        
        return score > 0 ? 'dovish' : 'hawkish';
      }
      
      // Fallback: retorna neutro-dovish
      return 'dovish';
      
    } catch (error) {
      console.warn('⚠️ Macro Analyzer: Erro ao buscar dados do Fed, usando padrão:', error);
      return 'dovish'; // Padrão conservador (favorável)
    }
  }
  
  /**
   * Obtém DXY (índice do dólar)
   */
  private async getDXY(): Promise<number> {
    try {
      // TODO: Integrar API de DXY
      // API sugerida: https://api.twelvedata.com/time_series?symbol=DXY
      return 103.5; // Placeholder
    } catch (error) {
      console.warn('Erro ao buscar DXY:', error as Error);
      return 103.5; // Neutro
    }
  }
  
  /**
   * Obtém correlação com SP500
   */
  private async getSP500Correlation(symbol: string): Promise<number> {
    // TODO: Calcular correlação histórica
    // Por enquanto retorna alta correlação (positiva para BTC)
    return 0.7;
  }
  
  /**
   * Calcula score macro (-2 a +2) melhorado com Alpha Vantage
   */
  private calculateMacroScore(data: any): number {
    let score = 0;
    
    // Fed Policy (peso: 40%)
    if (data.fedPolicy === 'dovish') score += 1;   // Favorável
    else score -= 1;                                // Hawkish = desfavorável
    
    // DXY (índice do dólar) - invertido para crypto (peso: 30%)
    if (data.dxy > 105) score -= 0.6;  // DXY forte = crypto fraco
    else if (data.dxy < 102) score += 0.6; // DXY fraco = crypto forte
    
    // SP500 correlation (peso: 30%)
    if (data.sp500Correlation > 0.7) score += 0.6; // Correlação forte = bom
    else if (data.sp500Correlation < 0.3) score -= 0.3; // Baixa correlação pode indicar isolamento
    
    return Math.max(-2, Math.min(2, score));
  }
}

export const macroAnalyzer = new MacroAnalyzer();

