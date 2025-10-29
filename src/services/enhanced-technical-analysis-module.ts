import { alphaVantageClient } from './alpha-vantage-client';
import { logger, logTrading } from './logger';

export interface EnhancedTechnicalAnalysis {
  symbol: string;
  timestamp: number;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  technicalIndicators: {
    rsi: {
      value: number;
      signal: 'oversold' | 'neutral' | 'overbought';
      strength: number;
    };
    macd: {
      value: number;
      signal: 'bullish' | 'neutral' | 'bearish';
      strength: number;
    };
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
      position: 'above_upper' | 'upper_band' | 'middle' | 'lower_band' | 'below_lower';
      signal: 'overbought' | 'neutral' | 'oversold';
    };
  };
  fundamentalData: {
    marketCap?: number;
    pe?: number;
    eps?: number;
    dividend?: number;
  };
  sentimentAnalysis: {
    newsSentiment: number;
    sentimentLabel: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
    newsCount: number;
    avgRelevance: number;
  };
  economicContext: {
    gdp?: number;
    inflation?: number;
    economicHealth: 'excellent' | 'good' | 'moderate' | 'poor' | 'critical';
  };
  overallScore: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  reasoning: string[];
}

export interface MarketOverview {
  timestamp: number;
  marketIndices: {
    sp500?: number;
    nasdaq?: number;
    dow?: number;
  };
  sectorPerformance: Array<{
    sector: string;
    performance: number;
    sentiment: number;
  }>;
  economicIndicators: {
    gdp?: number;
    inflation?: number;
    unemployment?: number;
  };
  marketSentiment: {
    overall: number;
    crypto: number;
    tech: number;
    finance: number;
  };
  volatility: {
    vix?: number;
    marketFear: 'low' | 'moderate' | 'high' | 'extreme';
  };
}

/**
 * ✅ MÓDULO DE ANÁLISE TÉCNICA APRIMORADA COM ALPHA VANTAGE
 * Objetivo: Combinar dados da Alpha Vantage com análise técnica para decisões mais informadas
 */
export class EnhancedTechnicalAnalysisModule {
  private cache: Map<string, { data: EnhancedTechnicalAnalysis; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  constructor() {
    logger.info('✅ EnhancedTechnicalAnalysisModule: Initialized', 'TECHNICAL');
  }

  /**
   * ✅ FUNÇÃO PRINCIPAL: Análise técnica aprimorada
   */
  public async performEnhancedAnalysis(symbol: string): Promise<EnhancedTechnicalAnalysis | null> {
    try {
      logTrading(`🔍 Iniciando análise técnica aprimorada para ${symbol}...`);

      // Verificar cache
      const cached = this.getFromCache(symbol);
      if (cached) {
        logTrading(`📊 Usando análise em cache para ${symbol}`);
        return cached;
      }

      // 1. Obter dados técnicos da Alpha Vantage
      const technicalData = await alphaVantageClient.getCompleteTechnicalAnalysis(symbol);
      
      if (!technicalData.quote) {
        logTrading(`⚠️ Nenhuma cotação encontrada para ${symbol}`);
        return null;
      }

      // 2. Obter análise de sentimento
      const newsSentiment = await this.getSentimentAnalysis(symbol);

      // 3. Obter contexto econômico
      const economicContext = await this.getEconomicContext();

      // 4. Processar indicadores técnicos
      const processedIndicators = this.processTechnicalIndicators(technicalData);

      // 5. Calcular score geral e recomendação
      const analysis = this.calculateOverallAnalysis(
        symbol,
        technicalData.quote,
        processedIndicators,
        newsSentiment,
        economicContext
      );

      // 6. Salvar no cache
      this.setToCache(symbol, analysis);

      logTrading(`✅ Análise técnica aprimorada concluída para ${symbol}`, {
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        overallScore: analysis.overallScore
      });

      return analysis;
    } catch (error) {
      logger.error(`❌ Erro na análise técnica aprimorada de ${symbol}:`, 'TECHNICAL', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ Obter análise de sentimento
   */
  private async getSentimentAnalysis(symbol: string): Promise<{
    newsSentiment: number;
    sentimentLabel: string;
    newsCount: number;
    avgRelevance: number;
  }> {
    try {
      const newsData = await alphaVantageClient.getNewsSentiment(['blockchain', 'earnings', symbol.toLowerCase()], 20);
      
      if (newsData.length === 0) {
        return {
          newsSentiment: 0,
          sentimentLabel: 'neutral',
          newsCount: 0,
          avgRelevance: 0
        };
      }

      const avgSentiment = newsData.reduce((sum, item) => sum + item.overallSentimentScore, 0) / newsData.length;
      const avgRelevance = newsData.reduce((sum, item) => {
        const tickerSentiment = item.tickerSentiment.find(t => t.ticker.toLowerCase() === symbol.toLowerCase());
        return sum + (tickerSentiment ? parseFloat(tickerSentiment.relevanceScore) : 0);
      }, 0) / newsData.length;

      let sentimentLabel = 'neutral';
      if (avgSentiment > 0.3) sentimentLabel = 'very_positive';
      else if (avgSentiment > 0.1) sentimentLabel = 'positive';
      else if (avgSentiment < -0.3) sentimentLabel = 'very_negative';
      else if (avgSentiment < -0.1) sentimentLabel = 'negative';

      return {
        newsSentiment: avgSentiment,
        sentimentLabel,
        newsCount: newsData.length,
        avgRelevance
      };
    } catch (error) {
      logger.error(`❌ Erro ao obter análise de sentimento para ${symbol}:`, 'TECHNICAL', null, error as Error);
      return {
        newsSentiment: 0,
        sentimentLabel: 'neutral',
        newsCount: 0,
        avgRelevance: 0
      };
    }
  }

  /**
   * ✅ Obter contexto econômico
   */
  private async getEconomicContext(): Promise<{
    gdp?: number;
    inflation?: number;
    economicHealth: string;
  }> {
    try {
      const economicData = await alphaVantageClient.getCompleteEconomicData();
      
      let economicHealth = 'moderate';
      
      if (economicData.gdp && economicData.inflation) {
        const gdpGrowth = (economicData.gdp as any).value > 0 ? 1 : 0;
        const inflationControl = (economicData.inflation as any).value > 0 && (economicData.inflation as any).value < 5 ? 1 : 0;
        
        if (gdpGrowth && inflationControl) economicHealth = 'excellent';
        else if (gdpGrowth || inflationControl) economicHealth = 'good';
        else if ((economicData.inflation as any).value > 10) economicHealth = 'critical';
        else economicHealth = 'poor';
      }

      return {
        gdp: economicData.gdp?.value,
        inflation: economicData.inflation?.value,
        economicHealth
      };
    } catch (error) {
      logger.error('❌ Erro ao obter contexto econômico:', 'TECHNICAL', null, error as Error);
      return {
        economicHealth: 'moderate'
      };
    }
  }

  /**
   * ✅ Processar indicadores técnicos
   */
  private processTechnicalIndicators(technicalData: any): any {
    const indicators: any = {
      rsi: { value: 50, signal: 'neutral', strength: 0 },
      macd: { value: 0, signal: 'neutral', strength: 0 },
      bollingerBands: { upper: 0, middle: 0, lower: 0, position: 'middle', signal: 'neutral' }
    };

    // Processar RSI
    if (technicalData.rsi && technicalData.rsi.values.length > 0) {
      const latestRsi = technicalData.rsi.values[technicalData.rsi.values.length - 1].value;
      indicators.rsi.value = latestRsi;
      
      if (latestRsi > 70) {
        indicators.rsi.signal = 'overbought';
        indicators.rsi.strength = Math.min(1, (latestRsi - 70) / 30);
      } else if (latestRsi < 30) {
        indicators.rsi.signal = 'oversold';
        indicators.rsi.strength = Math.min(1, (30 - latestRsi) / 30);
      } else {
        indicators.rsi.signal = 'neutral';
        indicators.rsi.strength = 0;
      }
    }

    // Processar MACD
    if (technicalData.macd && technicalData.macd.values.length > 0) {
      const latestMacd = technicalData.macd.values[technicalData.macd.values.length - 1].value;
      indicators.macd.value = latestMacd;
      
      if (latestMacd > 0) {
        indicators.macd.signal = 'bullish';
        indicators.macd.strength = Math.min(1, latestMacd / 0.1);
      } else {
        indicators.macd.signal = 'bearish';
        indicators.macd.strength = Math.min(1, Math.abs(latestMacd) / 0.1);
      }
    }

    // Processar Bollinger Bands
    if (technicalData.bollingerBands && technicalData.bollingerBands.values.length > 0) {
      const latestBB = technicalData.bollingerBands.values[technicalData.bollingerBands.values.length - 1];
      indicators.bollingerBands.upper = latestBB.upper;
      indicators.bollingerBands.middle = latestBB.middle;
      indicators.bollingerBands.lower = latestBB.lower;
      
      // Determinar posição relativa (simplificado)
      const price = technicalData.quote?.price || 0;
      if (price > latestBB.upper) {
        indicators.bollingerBands.position = 'above_upper';
        indicators.bollingerBands.signal = 'overbought';
      } else if (price < latestBB.lower) {
        indicators.bollingerBands.position = 'below_lower';
        indicators.bollingerBands.signal = 'oversold';
      } else {
        indicators.bollingerBands.position = 'middle';
        indicators.bollingerBands.signal = 'neutral';
      }
    }

    return indicators;
  }

  /**
   * ✅ Calcular análise geral
   */
  private calculateOverallAnalysis(
    symbol: string,
    quote: any,
    indicators: any,
    sentiment: any,
    economic: any
  ): EnhancedTechnicalAnalysis {
    let score = 0;
    const reasoning: string[] = [];

    // Score baseado no preço (simplificado)
    if (quote.changePercent > 2) {
      score += 20;
      reasoning.push(`Preço subindo ${quote.changePercent.toFixed(2)}%`);
    } else if (quote.changePercent < -2) {
      score -= 20;
      reasoning.push(`Preço caindo ${Math.abs(quote.changePercent).toFixed(2)}%`);
    }

    // Score baseado no RSI
    if (indicators.rsi.signal === 'oversold') {
      score += 15;
      reasoning.push(`RSI oversold (${indicators.rsi.value.toFixed(1)}) - possível reversão`);
    } else if (indicators.rsi.signal === 'overbought') {
      score -= 15;
      reasoning.push(`RSI overbought (${indicators.rsi.value.toFixed(1)}) - possível correção`);
    }

    // Score baseado no MACD
    if (indicators.macd.signal === 'bullish') {
      score += 10;
      reasoning.push(`MACD bullish (${indicators.macd.value.toFixed(4)})`);
    } else if (indicators.macd.signal === 'bearish') {
      score -= 10;
      reasoning.push(`MACD bearish (${indicators.macd.value.toFixed(4)})`);
    }

    // Score baseado no Bollinger Bands
    if (indicators.bollingerBands.signal === 'oversold') {
      score += 10;
      reasoning.push(`Preço abaixo da banda inferior - oversold`);
    } else if (indicators.bollingerBands.signal === 'overbought') {
      score -= 10;
      reasoning.push(`Preço acima da banda superior - overbought`);
    }

    // Score baseado no sentimento
    if (sentiment.sentimentLabel === 'very_positive') {
      score += 15;
      reasoning.push(`Sentimento muito positivo (${sentiment.newsSentiment.toFixed(2)})`);
    } else if (sentiment.sentimentLabel === 'positive') {
      score += 10;
      reasoning.push(`Sentimento positivo (${sentiment.newsSentiment.toFixed(2)})`);
    } else if (sentiment.sentimentLabel === 'negative') {
      score -= 10;
      reasoning.push(`Sentimento negativo (${sentiment.newsSentiment.toFixed(2)})`);
    } else if (sentiment.sentimentLabel === 'very_negative') {
      score -= 15;
      reasoning.push(`Sentimento muito negativo (${sentiment.newsSentiment.toFixed(2)})`);
    }

    // Score baseado no contexto econômico
    if (economic.economicHealth === 'excellent') {
      score += 10;
      reasoning.push(`Contexto econômico excelente`);
    } else if (economic.economicHealth === 'good') {
      score += 5;
      reasoning.push(`Contexto econômico bom`);
    } else if (economic.economicHealth === 'poor') {
      score -= 5;
      reasoning.push(`Contexto econômico ruim`);
    } else if (economic.economicHealth === 'critical') {
      score -= 10;
      reasoning.push(`Contexto econômico crítico`);
    }

    // Normalizar score para 0-100
    const normalizedScore = Math.max(0, Math.min(100, 50 + score));

    // Determinar recomendação
    let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    let confidence: number;

    if (normalizedScore >= 80) {
      recommendation = 'STRONG_BUY';
      confidence = 85;
    } else if (normalizedScore >= 65) {
      recommendation = 'BUY';
      confidence = 75;
    } else if (normalizedScore >= 35) {
      recommendation = 'HOLD';
      confidence = 60;
    } else if (normalizedScore >= 20) {
      recommendation = 'SELL';
      confidence = 75;
    } else {
      recommendation = 'STRONG_SELL';
      confidence = 85;
    }

    return {
      symbol,
      timestamp: Date.now(),
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: quote.volume,
      technicalIndicators: indicators,
      fundamentalData: {},
      sentimentAnalysis: sentiment,
      economicContext: economic,
      overallScore: normalizedScore,
      recommendation,
      confidence,
      reasoning
    };
  }

  /**
   * ✅ Obter visão geral do mercado
   */
  public async getMarketOverview(): Promise<MarketOverview | null> {
    try {
      logTrading('🌍 Obtendo visão geral do mercado...');

      // Obter dados econômicos
      const economicData = await alphaVantageClient.getCompleteEconomicData();

      // Obter análise de sentimento geral
      const generalSentiment = await alphaVantageClient.getNewsSentiment(['market', 'economy', 'fed'], 30);
      const cryptoSentiment = await alphaVantageClient.getNewsSentiment(['cryptocurrency', 'bitcoin'], 20);
      const techSentiment = await alphaVantageClient.getNewsSentiment(['technology', 'tech'], 20);
      const financeSentiment = await alphaVantageClient.getNewsSentiment(['banking', 'finance'], 20);

      // Calcular sentimento médio
      const overallSentiment = generalSentiment.length > 0 ? 
        generalSentiment.reduce((sum, item) => sum + item.overallSentimentScore, 0) / generalSentiment.length : 0;
      
      const cryptoSentimentAvg = cryptoSentiment.length > 0 ? 
        cryptoSentiment.reduce((sum, item) => sum + item.overallSentimentScore, 0) / cryptoSentiment.length : 0;
      
      const techSentimentAvg = techSentiment.length > 0 ? 
        techSentiment.reduce((sum, item) => sum + item.overallSentimentScore, 0) / techSentiment.length : 0;
      
      const financeSentimentAvg = financeSentiment.length > 0 ? 
        financeSentiment.reduce((sum, item) => sum + item.overallSentimentScore, 0) / financeSentiment.length : 0;

      // Determinar nível de medo do mercado (simplificado)
      let marketFear: 'low' | 'moderate' | 'high' | 'extreme' = 'moderate';
      if (overallSentiment < -0.3) marketFear = 'extreme';
      else if (overallSentiment < -0.1) marketFear = 'high';
      else if (overallSentiment > 0.3) marketFear = 'low';

      const overview: MarketOverview = {
        timestamp: Date.now(),
        marketIndices: {}, // Alpha Vantage não fornece índices diretamente
        sectorPerformance: [], // Seria necessário implementar separadamente
        economicIndicators: {
          gdp: economicData.gdp?.value,
          inflation: economicData.inflation?.value
        },
        marketSentiment: {
          overall: overallSentiment,
          crypto: cryptoSentimentAvg,
          tech: techSentimentAvg,
          finance: financeSentimentAvg
        },
        volatility: {
          marketFear
        }
      };

      logTrading('✅ Visão geral do mercado obtida', {
        overallSentiment: overallSentiment.toFixed(2),
        marketFear,
        economicIndicators: Object.keys(overview.economicIndicators).length
      });

      return overview;
    } catch (error) {
      logger.error('❌ Erro ao obter visão geral do mercado:', 'TECHNICAL', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ Obter do cache
   */
  private getFromCache(symbol: string): EnhancedTechnicalAnalysis | null {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  /**
   * ✅ Salvar no cache
   */
  private setToCache(symbol: string, data: EnhancedTechnicalAnalysis): void {
    this.cache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * ✅ Limpar cache
   */
  public clearCache(): void {
    this.cache.clear();
    logTrading('🧹 Cache de análise técnica limpo');
  }

  /**
   * ✅ Obter estatísticas do cache
   */
  public getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.cache.size,
      symbols: Array.from(this.cache.keys())
    };
  }
}

export const enhancedTechnicalAnalysisModule = new EnhancedTechnicalAnalysisModule();
export default EnhancedTechnicalAnalysisModule;
