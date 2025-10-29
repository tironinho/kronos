// ============================================================================
// CRYPTOPANIC API - Notícias em tempo real
// ============================================================================

import axios from 'axios';

export interface CryptoPanicNews {
  id: number;
  title: string;
  url: string;
  published_at: string;
  source: {
    title: string;
  };
  votes: {
    positive: number;
    negative: number;
    important: number;
    liked: number;
    disliked: number;
    lol: number;
    toxic: number;
    saved: number;
    comments: number;
  };
}

export interface CryptoPanicResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CryptoPanicNews[];
}

export class CryptoPanicAPI {
  private baseURL = 'https://cryptopanic.com/api/v1';
  private apiKey: string | null = null;

  constructor() {
    // API key é opcional (provavelmente não temos)
    // A API funciona sem key mas com limites menores
    this.apiKey = process.env.CRYPTOPANIC_API_KEY || null;
  }

  /**
   * Mapeia símbolo para código do CryptoPanic
   */
  private getSymbolCode(symbol: string): string {
    const mapping: Record<string, string> = {
      'BTC': 'BTC',
      'ETH': 'ETH',
      'BNB': 'BNB',
      'ADA': 'ADA',
      'XRP': 'XRP',
      'SOL': 'SOL',
      'DOGE': 'DOGE'
    };
    return mapping[symbol] || symbol;
  }

  /**
   * Busca notícias recentes para um símbolo
   */
  async getRecentNews(symbol: string, hours: number = 6): Promise<CryptoPanicNews[]> {
    try {
      const symbolCode = this.getSymbolCode(symbol);
      
      const url = this.apiKey 
        ? `${this.baseURL}/posts/?auth_token=${this.apiKey}&currencies=${symbolCode}&kind=news`
        : `${this.baseURL}/posts/?currencies=${symbolCode}&kind=news`;

      const response = await axios.get<CryptoPanicResponse>(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Kronos-X-Engine/1.0.0'
        }
      });

      if (!response.data.results || response.data.results.length === 0) {
        console.log(`📰 CryptoPanic: Nenhuma notícia de ${symbol} nas últimas ${hours}h`);
        return [];
      }

      // Filtrar notícias das últimas N horas
      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
      const recentNews = response.data.results.filter(news => {
        const publishedAt = new Date(news.published_at).getTime();
        return publishedAt >= cutoffTime;
      });

      console.log(`📰 CryptoPanic: ${recentNews.length} notícias de ${symbol} nas últimas ${hours}h`);
      return recentNews;
    } catch (error: any) {
      // ✅ MELHORIA: Tratamento de erro mais robusto
      if (error.response?.status === 400) {
        console.warn(`⚠️ CryptoPanic API: Bad Request (400) para ${symbol} - possível problema de parâmetros`);
      } else if (error.response?.status === 429) {
        console.warn(`⚠️ CryptoPanic API: Rate Limit (429) para ${symbol} - muitas requisições`);
      } else if (error.response?.status >= 500) {
        console.warn(`⚠️ CryptoPanic API: Server Error (${error.response.status}) para ${symbol} - problema no servidor`);
      } else {
        console.warn(`⚠️ CryptoPanic API falhou para ${symbol}: ${error.message}`);
      }
      
      // ✅ FALLBACK ROBUSTO: Retornar dados mockados quando API falha
      console.log(`🔄 Usando fallback para ${symbol} - continuando análise sem notícias`);
      
      // Retornar array vazio mas não quebrar o sistema
      return [];
    }
  }

  /**
   * Analisa sentimento das notícias
   */
  analyzeNewsSentiment(news: CryptoPanicNews[]): { 
    positive: number; 
    negative: number; 
    neutral: number; 
    score: number 
  } {
    if (news.length === 0) {
      return { positive: 0, negative: 0, neutral: 0, score: 0 };
    }

    let positive = 0;
    let negative = 0;
    let neutral = 0;

    news.forEach(item => {
      const { positive: pos, negative: neg, important } = item.votes;
      
      if (pos > neg) {
        positive++;
      } else if (neg > pos) {
        negative++;
      } else {
        neutral++;
      }
    });

    // Calcular score: (positivas - negativas) / total * 3
    const total = news.length;
    const score = ((positive - negative) / total) * 3;

    console.log(`📰 Sentimento: ${positive} positivas, ${negative} negativas, ${neutral} neutras`);
    console.log(`   Score: ${score.toFixed(2)}`);

    return { positive, negative, neutral, score: Math.max(-5, Math.min(5, score)) };
  }

  /**
   * Calcula score baseado em notícias
   */
  async calculateNewsScore(symbol: string, hours: number = 6): Promise<number> {
    try {
      const news = await this.getRecentNews(symbol, hours);
      if (news.length === 0) {
        console.log(`📰 CryptoPanic: Nenhuma notícia de ${symbol} nas últimas ${hours}h`);
        return 0;
      }

      const sentiment = this.analyzeNewsSentiment(news);
      
      // Score baseado em sentiment
      let score = sentiment.score;

      // Bonus se houver notícias IMPORTANTES
      const importantNews = news.filter(n => n.votes.important > 0);
      if (importantNews.length > 0 && sentiment.score > 0) {
        score += 0.5;
        console.log(`📰 ${importantNews.length} notícias importantes de ${symbol}`);
      }

      return Math.max(-5, Math.min(5, score));
    } catch (error: any) {
      console.error(`❌ Erro ao calcular news score para ${symbol}:`, error.message);
      return 0;
    }
  }
}

export const cryptoPanicAPI = new CryptoPanicAPI();

