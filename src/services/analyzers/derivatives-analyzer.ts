// ============================================================================
// DERIVATIVES ANALYZER - Análise de Derivativos
// ============================================================================

import { getBinanceClient } from '../binance-api';

export interface DerivativesAnalysis {
  fundingRate: number;            // > 0.1% = excesso longs = SELL
  openInterest: number;           // Crescimento + price = continuação
  longShortRatio: number;         // Extremos = reversão
  liquidationHeatmap: {
    longs: Array<{ price: number; liqAmount: number }>;
    shorts: Array<{ price: number; liqAmount: number }>;
  };
  
  derivativesScore: number;       // -2 a +2
}

export class DerivativesAnalyzer {
  private binanceClient = getBinanceClient();
  
  /**
   * Analisa derivativos
   */
  async analyze(symbol: string): Promise<DerivativesAnalysis> {
    console.log(`📊 Analisando derivativos de ${symbol}...`);
    
    const fundingRate = await this.getFundingRate(symbol);
    const openInterest = await this.getOpenInterest(symbol);
    const longShortRatio = await this.getLongShortRatio(symbol);
    
    const derivativesScore = this.calculateDerivativesScore({
      fundingRate,
      openInterest,
      longShortRatio
    });
    
    return {
      fundingRate,
      openInterest,
      longShortRatio,
      liquidationHeatmap: {
        longs: [],
        shorts: []
      },
      derivativesScore
    };
  }
  
  /**
   * Obtém funding rate
   */
  private async getFundingRate(symbol: string): Promise<number> {
    try {
      const fundingRate = await this.binanceClient.getFundingRate(symbol);
      return parseFloat(fundingRate.fundingRate || '0');
    } catch (error) {
      console.warn('Erro ao buscar funding rate:', error);
      return 0;
    }
  }
  
  /**
   * Obtém Open Interest
   */
  private async getOpenInterest(symbol: string): Promise<number> {
    try {
      const oi = await this.binanceClient.getOpenInterest(symbol);
      return parseFloat(oi.openInterest || '0');
    } catch (error) {
      console.warn('Erro ao buscar Open Interest:', error);
      return 0;
    }
  }
  
  /**
   * Obtém Long/Short Ratio
   */
  private async getLongShortRatio(symbol: string): Promise<number> {
    try {
      const ratio = await this.binanceClient.getLongShortRatio(symbol, '1h', 1);
      return parseFloat(ratio[0]?.longShortRatio || '0.5');
    } catch (error) {
      console.warn('Erro ao buscar Long/Short ratio:', error);
      return 0.5; // 50/50 neutro
    }
  }
  
  /**
   * Calcula score de derivativos (-2 a +2)
   */
  private calculateDerivativesScore(data: any): number {
    let score = 0;
    
    // Funding Rate
    if (data.fundingRate > 0.1) score -= 2;      // Excess longs = risk
    else if (data.fundingRate < -0.05) score += 2; // Excess shorts = short squeeze
    
    // Long/Short Ratio - contrário dos extremos
    if (data.longShortRatio > 0.9) score -= 1;   // Muitos longs
    else if (data.longShortRatio < 0.1) score += 1; // Muitos shorts
    
    // Normalizar
    return Math.max(-2, Math.min(2, score));
  }
}

export const derivativesAnalyzer = new DerivativesAnalyzer();

