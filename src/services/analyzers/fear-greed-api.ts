// ============================================================================
// FEAR & GREED INDEX API - Sentimento macro do mercado
// ============================================================================

import axios from 'axios';

export interface FearGreedResponse {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
  metadata: {
    error: null;
  };
}

export class FearGreedAPI {
  private baseURL = 'https://api.alternative.me/fng';
  private cachedData: { value: number; classification: string; timestamp: number } | null = null;
  private cacheTTL = 60000; // Cache por 1 minuto

  /**
   * Busca Fear & Greed Index
   */
  async getFearGreedIndex(): Promise<number> {
    try {
      // Verificar cache
      if (this.cachedData && Date.now() - this.cachedData.timestamp < this.cacheTTL) {
        return this.cachedData.value;
      }

      const response = await axios.get<FearGreedResponse>(this.baseURL, {
        timeout: 10000
      });

      if (response.data.data && response.data.data.length > 0) {
        const latest = response.data.data[0];
        const value = parseInt(latest.value);
        const classification = latest.value_classification;

        this.cachedData = {
          value,
          classification,
          timestamp: Date.now()
        };

        console.log(`📊 Fear & Greed: ${value} (${classification})`);
        return value;
      }

      return 50; // Neutro como fallback
    } catch (error: any) {
      console.error(`❌ Erro ao buscar Fear & Greed Index:`, error.message);
      
      // Fallback otimista (assumir mercado neutro)
      return 50;
    }
  }

  /**
   * Classifica o sentimento
   */
  getClassification(value: number): string {
    if (value <= 24) return 'Extreme Fear';
    if (value <= 45) return 'Fear';
    if (value <= 55) return 'Neutral';
    if (value <= 75) return 'Greed';
    return 'Extreme Greed';
  }

  /**
   * Calcula score baseado em Fear & Greed
   */
  async calculateSentimentScore(): Promise<number> {
    try {
      const index = await this.getFearGreedIndex();
      
      let score = 0;

      // Extreme Fear (0-25) = oportunidade de compra (contrarian)
      if (index <= 25) {
        score = +3; // Muito positivo para compra
        console.log(`🎯 Fear & Greed: Extreme Fear (${index}) - Oportunidade de COMPRA`);
      }
      // Fear (26-45) = pequeno otimismo
      else if (index <= 45) {
        score = +1; // Levemente positivo
        console.log(`🎯 Fear & Greed: Fear (${index}) - Levemente positivo`);
      }
      // Neutral (46-54) = neutro
      else if (index <= 54) {
        score = 0; // Neutro
        console.log(`🎯 Fear & Greed: Neutral (${index}) - Sentimento neutro`);
      }
      // Greed (55-75) = cuidado
      else if (index <= 75) {
        score = -1; // Levemente negativo
        console.log(`🎯 Fear & Greed: Greed (${index}) - Cuidado (sobrecomprado)`);
      }
      // Extreme Greed (76-100) = muito cuidado
      else {
        score = -3; // Muito negativo
        console.log(`🎯 Fear & Greed: Extreme Greed (${index}) - CUIDADO (mercado muito eufórico)`);
      }

      return score;
    } catch (error: any) {
      console.error(`❌ Erro ao calcular sentiment score:`, error.message);
      return 0;
    }
  }
}

export const fearGreedAPI = new FearGreedAPI();

