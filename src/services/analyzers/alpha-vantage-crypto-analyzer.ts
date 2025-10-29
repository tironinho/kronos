// ============================================================================
// ALPHA VANTAGE CRYPTO ANALYZER
// Integração específica da Alpha Vantage para análise de criptomoedas
// Complementa a análise técnica atual com dados adicionais confiáveis
// ============================================================================

import { alphaVantageClient } from '../alpha-vantage-client';
import { logger, logTrading } from '../logger';

export interface AlphaVantageCryptoAnalysis {
  symbol: string;
  timestamp: number;
  
  // Dados de mercado
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  
  // Indicadores técnicos Alpha Vantage
  rsi: number | null;
  rsiSignal: 'oversold' | 'neutral' | 'overbought' | null;
  
  // Análise de tendência
  trendIntraday: 'bullish' | 'bearish' | 'neutral';
  volatility: 'low' | 'medium' | 'high';
  
  // Score consolidado Alpha Vantage (-10 a +10)
  alphaVantageScore: number;
  confidence: number; // 0-100%
  
  // Metadados
  dataQuality: 'high' | 'medium' | 'low';
  dataPoints: number;
}

export class AlphaVantageCryptoAnalyzer {
  private cache: Map<string, { data: AlphaVantageCryptoAnalysis; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 300000; // 5 minutos

  /**
   * ✅ Analisa criptomoeda usando Alpha Vantage
   */
  async analyze(symbol: string): Promise<AlphaVantageCryptoAnalysis | null> {
    try {
      // Verificar cache
      const cached = this.getCached(symbol);
      if (cached) {
        logTrading(`📦 Alpha Vantage Crypto: Usando dados em cache para ${symbol}`);
        return cached;
      }

      console.log(`🔍 [Alpha Vantage Crypto] Analisando ${symbol}...`);

      // Converter símbolo (BTCUSDT -> BTC)
      const baseSymbol = this.extractBaseSymbol(symbol);

      // Buscar dados em paralelo (respeitando rate limit)
      const [quote, exchangeRate, dailySeries, rsiData] = await Promise.allSettled([
        alphaVantageClient.getCryptoQuote(baseSymbol),
        alphaVantageClient.getCryptoExchangeRate(baseSymbol, 'USD'),
        alphaVantageClient.getCryptoDailySeries(baseSymbol, 'USD', 30), // Últimos 30 dias
        alphaVantageClient.getCryptoRSI(baseSymbol, 'daily', 14).catch(() => null)
      ]);

      // Processar cotação
      const quoteData = quote.status === 'fulfilled' ? quote.value : null;
      if (!quoteData) {
        logTrading(`⚠️ Alpha Vantage Crypto: Não foi possível obter cotação de ${symbol}`);
        return null;
      }

      // Calcular RSI
      let rsi: number | null = null;
      let rsiSignal: 'oversold' | 'neutral' | 'overbought' | null = null;
      
      if (rsiData.status === 'fulfilled' && rsiData.value && rsiData.value.values.length > 0) {
        rsi = rsiData.value.values[rsiData.value.values.length - 1].value;
        if (rsi >= 70) rsiSignal = 'overbought';
        else if (rsi <= 30) rsiSignal = 'oversold';
        else rsiSignal = 'neutral';
      }

      // Análise de tendência intradiária
      const trendIntraday = this.analyzeTrend(quoteData.changePercent);
      
      // Análise de volatilidade
      const dailyData = dailySeries.status === 'fulfilled' && dailySeries.value ? dailySeries.value.data : [];
      const volatility = this.calculateVolatility(dailyData);

      // Calcular score Alpha Vantage
      const alphaVantageScore = this.calculateScore({
        changePercent: quoteData.changePercent,
        rsi,
        rsiSignal,
        trendIntraday,
        volume24h: quoteData.volume
      });

      // Calcular confiança
      const confidence = this.calculateConfidence({
        hasRSI: rsi !== null,
        hasDailySeries: dailyData.length > 0,
        hasExchangeRate: exchangeRate.status === 'fulfilled'
      });

      // Avaliar qualidade dos dados
      const dataQuality = this.assessDataQuality({
        hasRSI: rsi !== null,
        hasDailyData: dailyData.length > 0,
        hasExchangeRate: exchangeRate.status === 'fulfilled',
        dataPoints: dailyData.length
      });

      const analysis: AlphaVantageCryptoAnalysis = {
        symbol,
        timestamp: Date.now(),
        currentPrice: quoteData.price,
        change24h: quoteData.change,
        changePercent24h: quoteData.changePercent,
        volume24h: quoteData.volume,
        rsi,
        rsiSignal,
        trendIntraday,
        volatility,
        alphaVantageScore,
        confidence,
        dataQuality,
        dataPoints: dailyData.length
      };

      // Salvar no cache
      this.setCached(symbol, analysis);

      logTrading(`✅ Alpha Vantage Crypto: Análise completa para ${symbol}`, {
        price: analysis.currentPrice,
        change24h: analysis.changePercent24h.toFixed(2) + '%',
        rsi: analysis.rsi?.toFixed(2) || 'N/A',
        score: analysis.alphaVantageScore.toFixed(2),
        confidence: analysis.confidence + '%'
      });

      return analysis;

    } catch (error) {
      logger.error(`❌ Alpha Vantage Crypto: Erro ao analisar ${symbol}:`, 'ANALYZER', null, error as Error);
      return null;
    }
  }

  /**
   * Extrai símbolo base (BTCUSDT -> BTC)
   */
  private extractBaseSymbol(symbol: string): string {
    // Remover sufixos comuns
    const base = symbol
      .replace('USDT', '')
      .replace('USD', '')
      .replace('BTC', '')
      .replace('ETH', '')
      .replace(/[0-9]/g, '');
    
    return base || symbol.substring(0, 3); // Fallback: primeiros 3 caracteres
  }

  /**
   * Analisa tendência intradiária
   */
  private analyzeTrend(changePercent: number): 'bullish' | 'bearish' | 'neutral' {
    if (changePercent > 2) return 'bullish';
    if (changePercent < -2) return 'bearish';
    return 'neutral';
  }

  /**
   * Calcula volatilidade baseada em dados diários
   */
  private calculateVolatility(dailyData: Array<{ high: number; low: number; close: number }>): 'low' | 'medium' | 'high' {
    if (dailyData.length < 7) return 'medium';

    // Calcular volatilidade média (high-low range como % do preço)
    const volatilities = dailyData.slice(-7).map(day => {
      const range = day.high - day.low;
      const avgPrice = (day.high + day.low + day.close) / 3;
      return (range / avgPrice) * 100;
    });

    const avgVolatility = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;

    if (avgVolatility > 8) return 'high';
    if (avgVolatility < 3) return 'low';
    return 'medium';
  }

  /**
   * Calcula score Alpha Vantage (-10 a +10)
   */
  private calculateScore(data: {
    changePercent: number;
    rsi: number | null;
    rsiSignal: 'oversold' | 'neutral' | 'overbought' | null;
    trendIntraday: 'bullish' | 'bearish' | 'neutral';
    volume24h: number;
  }): number {
    let score = 0;

    // Mudança percentual 24h (peso: 40%)
    if (data.changePercent > 5) score += 4;
    else if (data.changePercent > 2) score += 2;
    else if (data.changePercent > 0) score += 1;
    else if (data.changePercent < -5) score -= 4;
    else if (data.changePercent < -2) score -= 2;
    else if (data.changePercent < 0) score -= 1;

    // RSI (peso: 30%)
    if (data.rsi !== null) {
      if (data.rsiSignal === 'oversold') score += 3; // Oportunidade de compra
      else if (data.rsiSignal === 'overbought') score -= 3; // Possível correção
      // RSI neutro não adiciona/subtrai
    }

    // Tendência intradiária (peso: 20%)
    if (data.trendIntraday === 'bullish') score += 2;
    else if (data.trendIntraday === 'bearish') score -= 2;

    // Volume (peso: 10%) - volume alto confirma movimento
    // Por enquanto não temos referência de volume médio, então pulamos

    return Math.max(-10, Math.min(10, score));
  }

  /**
   * Calcula confiança (0-100%)
   */
  private calculateConfidence(data: {
    hasRSI: boolean;
    hasDailySeries: boolean;
    hasExchangeRate: boolean;
  }): number {
    let confidence = 50; // Base

    if (data.hasRSI) confidence += 20;
    if (data.hasDailySeries) confidence += 20;
    if (data.hasExchangeRate) confidence += 10;

    return Math.min(100, confidence);
  }

  /**
   * Avalia qualidade dos dados
   */
  private assessDataQuality(data: {
    hasRSI: boolean;
    hasDailyData: boolean;
    hasExchangeRate: boolean;
    dataPoints: number;
  }): 'high' | 'medium' | 'low' {
    let qualityScore = 0;

    if (data.hasRSI) qualityScore += 2;
    if (data.hasDailyData) qualityScore += 2;
    if (data.hasExchangeRate) qualityScore += 1;
    if (data.dataPoints >= 20) qualityScore += 1;

    if (qualityScore >= 5) return 'high';
    if (qualityScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Obtém dados do cache
   */
  private getCached(symbol: string): AlphaVantageCryptoAnalysis | null {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  /**
   * Salva no cache
   */
  private setCached(symbol: string, data: AlphaVantageCryptoAnalysis): void {
    this.cache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Limpa cache
   */
  public clearCache(): void {
    this.cache.clear();
    logTrading('🧹 Alpha Vantage Crypto: Cache limpo');
  }
}

export const alphaVantageCryptoAnalyzer = new AlphaVantageCryptoAnalyzer();
export default AlphaVantageCryptoAnalyzer;
