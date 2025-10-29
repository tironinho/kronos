// ============================================================================
// COINGECKO API - Dados gratuitos de mercado em tempo real
// ============================================================================

import axios from 'axios';

export interface CoinGeckoPrice {
  usd: number;
  usd_24h_change?: number;
}

export interface CoinGeckoVolume {
  usd: number;
}

export interface CoinGeckoMarketData {
  current_price: number;
  volume_24h: number;
  market_cap: number;
  price_change_percentage_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
}

export interface CoinGeckoResponse {
  id: string;
  symbol: string;
  name: string;
  market_data: CoinGeckoMarketData;
  last_updated: string;
}

export class CoinGeckoAPI {
  private baseURL = 'https://api.coingecko.com/api/v3';
  private rateLimitMs = 1200; // 50 chamadas por minuto = 1200ms entre chamadas
  private lastCall = 0;

  /**
   * Rate limiting simples
   */
  private async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    if (timeSinceLastCall < this.rateLimitMs) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitMs - timeSinceLastCall));
    }
    this.lastCall = Date.now();
  }

  /**
   * Mapeia símbolo para ID do CoinGecko
   */
  private getCoinGeckoId(symbol: string): string | null {
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'ADA': 'cardano',
      'XRP': 'ripple',
      'SOL': 'solana',
      'DOGE': 'dogecoin',
      'ENA': 'ethena'
    };
    return mapping[symbol] || null;
  }

  /**
   * Busca dados de mercado em tempo real
   */
  async getMarketData(symbol: string): Promise<CoinGeckoResponse | null> {
    try {
      await this.waitForRateLimit();
      
      const coinId = this.getCoinGeckoId(symbol);
      if (!coinId) {
        console.warn(`⚠️ CoinGecko: Símbolo ${symbol} não mapeado`);
        return null;
      }

      const url = `${this.baseURL}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
      
      const response = await axios.get<CoinGeckoResponse>(url, {
        timeout: 10000
      });

      console.log(`📊 CoinGecko: Dados de ${symbol} obtidos`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erro ao buscar dados CoinGecko para ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Busca preço em tempo real
   */
  async getPrice(symbol: string): Promise<number> {
    try {
      const data = await this.getMarketData(symbol);
      return data?.market_data?.current_price?.usd || 0;
    } catch (error: any) {
      console.error(`❌ Erro ao buscar preço CoinGecko para ${symbol}:`, error.message);
      return 0;
    }
  }

  /**
   * Busca volume nas últimas 24h
   */
  async getVolume24h(symbol: string): Promise<number> {
    try {
      const data = await this.getMarketData(symbol);
      return data?.market_data?.total_volume?.usd || 0;
    } catch (error: any) {
      console.error(`❌ Erro ao buscar volume CoinGecko para ${symbol}:`, error.message);
      return 0;
    }
  }

  /**
   * Busca variação de preço nas últimas 24h
   */
  async getPriceChange24h(symbol: string): Promise<number> {
    try {
      const data = await this.getMarketData(symbol);
      return data?.market_data?.price_change_percentage_24h || 0;
    } catch (error: any) {
      console.error(`❌ Erro ao buscar variação CoinGecko para ${symbol}:`, error.message);
      return 0;
    }
  }

  /**
   * Calcula score baseado em volume e tendência
   */
  async calculateVolumeScore(symbol: string): Promise<number> {
    try {
      const data = await this.getMarketData(symbol);
      if (!data) return 0;

      const { total_volume: volume, price_change_percentage_24h: priceChange } = data.market_data;

      let score = 0;

      // Volume alto = interesse crescente
      if (volume.usd > 100000000) { // > $100M em volume
        score += 1;
        console.log(`📈 ${symbol}: Volume alto ($${(volume.usd / 1000000).toFixed(1)}M)`);
      }

      // Preço subindo = momentum positivo
      if (priceChange > 5) {
        score += 2;
        console.log(`📈 ${symbol}: Preço subindo (+${priceChange.toFixed(2)}%)`);
      } else if (priceChange < -5) {
        score -= 2;
        console.log(`📉 ${symbol}: Preço caindo (${priceChange.toFixed(2)}%)`);
      }

      return Math.max(-5, Math.min(5, score)); // Limitar entre -5 e +5
    } catch (error: any) {
      console.error(`❌ Erro ao calcular volume score para ${symbol}:`, error.message);
      return 0;
    }
  }
}

export const coinGeckoAPI = new CoinGeckoAPI();

