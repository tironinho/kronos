import axios from 'axios';
import { logger, logTrading } from './logger';

export interface AlphaVantageConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
}

export interface TechnicalIndicator {
  symbol: string;
  indicator: string;
  timeframe: string;
  values: Array<{
    date: string;
    value: number;
  }>;
}

export interface EconomicIndicator {
  indicator: string;
  value: number;
  unit: string;
  date: string;
  country: string;
}

export interface NewsSentiment {
  title: string;
  url: string;
  timePublished: string;
  authors: string[];
  summary: string;
  bannerImage: string;
  source: string;
  categoryWithinSource: string;
  sourceDomain: string;
  topics: Array<{
    topic: string;
    relevanceScore: string;
  }>;
  overallSentimentScore: number;
  overallSentimentLabel: string;
  tickerSentiment: Array<{
    ticker: string;
    relevanceScore: string;
    tickerSentimentScore: string;
    tickerSentimentLabel: string;
  }>;
}

export interface CryptoQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
}

/**
 * ✅ CLIENTE ALPHA VANTAGE API
 * Objetivo: Integrar dados fundamentais, indicadores econômicos e análise de sentimentos
 */
export class AlphaVantageClient {
  private config: AlphaVantageConfig;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly RATE_LIMIT = 5; // 5 requests per minute for free tier
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute

  // ✅ Mapeamento de símbolos Binance para códigos Alpha Vantage suportados
  private readonly SYMBOL_MAP: Record<string, string> = {
    'BTC': 'BTC',
    'ETH': 'ETH',
    'BNB': 'BNB',  // Pode não ser suportado, mas tentamos
    'ADA': 'ADA',
    'SOL': 'SOL',
    'XRP': 'XRP',
    'DOGE': 'DOGE',
    'MATIC': 'MATIC',
    'DOT': 'DOT',
    'AVAX': 'AVAX',
    'LINK': 'LINK',
    'UNI': 'UNI',
    'LTC': 'LTC',
    'ATOM': 'ATOM',
    'ALGO': 'ALGO'
  };

  constructor(apiKey: string) {
    this.config = {
      apiKey,
      baseUrl: 'https://www.alphavantage.co/query',
      timeout: 10000
    };
    
    logger.info('✅ AlphaVantageClient: Initialized', 'API', { apiKey: apiKey.substring(0, 8) + '...' });
  }

  /**
   * ✅ Verificar limite de rate
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastRequestTime > this.RATE_LIMIT_WINDOW) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }
    
    if (this.requestCount >= this.RATE_LIMIT) {
      const waitTime = this.RATE_LIMIT_WINDOW - (now - this.lastRequestTime);
      logTrading(`⏳ Alpha Vantage: Rate limit atingido. Aguardando ${Math.ceil(waitTime / 1000)} segundos...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }
    
    this.requestCount++;
  }

  /**
   * ✅ Fazer requisição para Alpha Vantage
   */
  private async makeRequest(params: Record<string, string>): Promise<any> {
    await this.checkRateLimit();
    
    try {
      const requestParams = {
        ...params,
        apikey: this.config.apiKey
      };
      
      logTrading(`📡 Alpha Vantage: Fazendo requisição para ${params.function}`, { params });
      
      const response = await axios.get(this.config.baseUrl, {
        params: requestParams,
        timeout: this.config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Kronos-X-Engine/1.0.0'
        }
      });
      
      // Verificar erros, mas tratar "Invalid API call" de forma especial
      if (response.data['Error Message']) {
        const errorMsg = response.data['Error Message'];
        // "Invalid API call" indica que o símbolo/endpoint não é suportado - não é erro crítico
        if (errorMsg.includes('Invalid API call')) {
          logTrading(`⚠️ Alpha Vantage: ${errorMsg} para ${params.function}`);
          // Retornar os dados com erro para que métodos chamadores possam tratá-lo
          return response.data;
        }
        // Outros erros são críticos
        throw new Error(`Alpha Vantage Error: ${errorMsg}`);
      }
      
      if (response.data['Note']) {
        throw new Error(`Alpha Vantage Rate Limit: ${response.data['Note']}`);
      }
      
      logTrading(`✅ Alpha Vantage: Requisição bem-sucedida para ${params.function}`);
      return response.data;
      
    } catch (error: any) {
      // Não logar como ERROR se for "Invalid API call" (já foi tratado acima)
      if (!error?.message?.includes('Invalid API call')) {
        logger.error(`❌ Alpha Vantage: Erro na requisição para ${params.function}:`, 'API', null, error as Error);
      }
      throw error;
    }
  }

  /**
   * ✅ Obter cotação de ação
   */
  public async getStockQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const data = await this.makeRequest({
        function: 'GLOBAL_QUOTE',
        symbol: symbol
      });
      
      const quote = data['Global Quote'];
      if (!quote) {
        logTrading(`⚠️ Alpha Vantage: Nenhuma cotação encontrada para ${symbol}`);
        return null;
      }
      
      const result: StockQuote = {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        marketCap: 0, // Alpha Vantage não fornece market cap na cotação global
        timestamp: quote['07. latest trading day']
      };
      
      logTrading(`📊 Alpha Vantage: Cotação obtida para ${symbol}`, {
        price: result.price,
        change: result.change,
        changePercent: result.changePercent
      });
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter cotação de ${symbol}:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ Obter indicador técnico RSI
   */
  public async getRSI(symbol: string, timeframe: string = 'daily', period: number = 14): Promise<TechnicalIndicator | null> {
    try {
      const data = await this.makeRequest({
        function: 'RSI',
        symbol: symbol,
        interval: timeframe,
        time_period: period.toString(),
        series_type: 'close'
      });
      
      const rsiData = data[`Technical Analysis: RSI`];
      if (!rsiData) {
        logTrading(`⚠️ Alpha Vantage: Nenhum dado RSI encontrado para ${symbol}`);
        return null;
      }
      
      const values = Object.entries(rsiData).map(([date, data]: [string, any]) => ({
        date,
        value: parseFloat(data.RSI)
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const result: TechnicalIndicator = {
        symbol,
        indicator: 'RSI',
        timeframe,
        values
      };
      
      logTrading(`📊 Alpha Vantage: RSI obtido para ${symbol}`, {
        timeframe,
        period,
        valuesCount: values.length,
        latestValue: values[values.length - 1]?.value
      });
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter RSI de ${symbol}:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ Obter indicador técnico MACD
   */
  public async getMACD(symbol: string, timeframe: string = 'daily'): Promise<TechnicalIndicator | null> {
    try {
      const data = await this.makeRequest({
        function: 'MACD',
        symbol: symbol,
        interval: timeframe,
        series_type: 'close'
      });
      
      const macdData = data[`Technical Analysis: MACD`];
      if (!macdData) {
        logTrading(`⚠️ Alpha Vantage: Nenhum dado MACD encontrado para ${symbol}`);
        return null;
      }
      
      const values = Object.entries(macdData).map(([date, data]: [string, any]) => ({
        date,
        value: parseFloat(data.MACD)
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const result: TechnicalIndicator = {
        symbol,
        indicator: 'MACD',
        timeframe,
        values
      };
      
      logTrading(`📊 Alpha Vantage: MACD obtido para ${symbol}`, {
        timeframe,
        valuesCount: values.length,
        latestValue: values[values.length - 1]?.value
      });
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter MACD de ${symbol}:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ Obter indicador técnico Bollinger Bands
   */
  public async getBollingerBands(symbol: string, timeframe: string = 'daily', period: number = 20): Promise<any> {
    try {
      const data = await this.makeRequest({
        function: 'BBANDS',
        symbol: symbol,
        interval: timeframe,
        time_period: period.toString(),
        series_type: 'close'
      });
      
      const bbData = data[`Technical Analysis: BBANDS`];
      if (!bbData) {
        logTrading(`⚠️ Alpha Vantage: Nenhum dado Bollinger Bands encontrado para ${symbol}`);
        return null;
      }
      
      const values = Object.entries(bbData).map(([date, data]: [string, any]) => ({
        date,
        upper: parseFloat(data['Real Upper Band']),
        middle: parseFloat(data['Real Middle Band']),
        lower: parseFloat(data['Real Lower Band'])
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      logTrading(`📊 Alpha Vantage: Bollinger Bands obtido para ${symbol}`, {
        timeframe,
        period,
        valuesCount: values.length
      });
      
      return {
        symbol,
        indicator: 'BBANDS',
        timeframe,
        values
      };
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter Bollinger Bands de ${symbol}:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ Obter indicador econômico (GDP)
   */
  public async getGDP(country: string = 'united states'): Promise<EconomicIndicator | null> {
    try {
      const data = await this.makeRequest({
        function: 'REAL_GDP',
        interval: 'quarterly'
      });
      
      const gdpData = data.data;
      if (!gdpData || gdpData.length === 0) {
        logTrading(`⚠️ Alpha Vantage: Nenhum dado GDP encontrado`);
        return null;
      }
      
      const latest = gdpData[0];
      const result: EconomicIndicator = {
        indicator: 'GDP',
        value: parseFloat(latest.value),
        unit: 'USD',
        date: latest.date,
        country: country
      };
      
      logTrading(`📊 Alpha Vantage: GDP obtido`, {
        country,
        value: result.value,
        date: result.date
      });
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter GDP:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ Obter indicador econômico (Inflação)
   */
  public async getInflation(country: string = 'united states'): Promise<EconomicIndicator | null> {
    try {
      const data = await this.makeRequest({
        function: 'INFLATION'
      });
      
      const inflationData = data.data;
      if (!inflationData || inflationData.length === 0) {
        logTrading(`⚠️ Alpha Vantage: Nenhum dado de inflação encontrado`);
        return null;
      }
      
      const latest = inflationData[0];
      const result: EconomicIndicator = {
        indicator: 'INFLATION',
        value: parseFloat(latest.value),
        unit: 'Percent',
        date: latest.date,
        country: country
      };
      
      logTrading(`📊 Alpha Vantage: Inflação obtida`, {
        country,
        value: result.value,
        date: result.date
      });
      
      return result;
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter inflação:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ Obter análise de sentimento de notícias
   */
  public async getNewsSentiment(topics: string[] = ['blockchain', 'earnings'], limit: number = 50): Promise<NewsSentiment[]> {
    try {
      const data = await this.makeRequest({
        function: 'NEWS_SENTIMENT',
        topics: topics.join(','),
        limit: limit.toString(),
        sort: 'LATEST'
      });
      
      const newsData = data.feed;
      if (!newsData || newsData.length === 0) {
        logTrading(`⚠️ Alpha Vantage: Nenhuma notícia encontrada`);
        return [];
      }
      
      const results: NewsSentiment[] = newsData.map((item: any) => ({
        title: item.title,
        url: item.url,
        timePublished: item.time_published,
        authors: item.authors || [],
        summary: item.summary,
        bannerImage: item.banner_image,
        source: item.source,
        categoryWithinSource: item.category_within_source,
        sourceDomain: item.source_domain,
        topics: item.topics || [],
        overallSentimentScore: parseFloat(item.overall_sentiment_score),
        overallSentimentLabel: item.overall_sentiment_label,
        tickerSentiment: item.ticker_sentiment || []
      }));
      
      logTrading(`📊 Alpha Vantage: Análise de sentimento obtida`, {
        topics,
        newsCount: results.length,
        avgSentiment: results.reduce((sum, item) => sum + item.overallSentimentScore, 0) / results.length
      });
      
      return results;
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter análise de sentimento:`, 'API', null, error as Error);
      return [];
    }
  }

  /**
   * ✅ Helper: Verifica se símbolo é suportado pela Alpha Vantage
   */
  private isSymbolSupported(symbol: string): boolean {
    return symbol in this.SYMBOL_MAP;
  }

  /**
   * ✅ Helper: Converte símbolo para código Alpha Vantage (se disponível)
   */
  private normalizeSymbol(symbol: string): string | null {
    const normalized = symbol.toUpperCase();
    if (this.SYMBOL_MAP[normalized]) {
      return this.SYMBOL_MAP[normalized];
    }
    // Se não está no mapa, tenta usar o símbolo diretamente
    return normalized;
  }

  /**
   * ✅ Obter cotação de criptomoeda (melhorado com dados mais completos)
   */
  public async getCryptoQuote(symbol: string): Promise<CryptoQuote | null> {
    try {
      const normalizedSymbol = this.normalizeSymbol(symbol);
      if (!normalizedSymbol) {
        logTrading(`⚠️ Alpha Vantage: Símbolo ${symbol} não suportado`);
        return null;
      }

      const data = await this.makeRequest({
        function: 'DIGITAL_CURRENCY_DAILY',
        symbol: normalizedSymbol,
        market: 'USD'
      });
      
      // Verificar se há erro específico da API
      if (data['Error Message'] && data['Error Message'].includes('Invalid API call')) {
        logTrading(`⚠️ Alpha Vantage: Símbolo ${symbol} não suportado pelo endpoint DIGITAL_CURRENCY_DAILY`);
        return null;
      }
      
      const timeSeries = data['Time Series (Digital Currency Daily)'];
      if (!timeSeries) {
        logTrading(`⚠️ Alpha Vantage: Nenhuma cotação de crypto encontrada para ${symbol}`);
        return null;
      }
      
      const dates = Object.keys(timeSeries).sort().reverse();
      const latestDate = dates[0];
      const previousDate = dates[1];
      
      const latestData = timeSeries[latestDate];
      const previousData = previousDate ? timeSeries[previousDate] : null;
      
      const price = parseFloat(latestData['4a. close (USD)']);
      const previousPrice = previousData ? parseFloat(previousData['4a. close (USD)']) : price;
      const change = price - previousPrice;
      const changePercent = previousPrice !== 0 ? (change / previousPrice) * 100 : 0;
      
      const result: CryptoQuote = {
        symbol: symbol,
        price,
        change,
        changePercent,
        volume: parseFloat(latestData['5. volume']),
        marketCap: 0, // Alpha Vantage não fornece market cap diretamente
        timestamp: latestDate
      };
      
      logTrading(`📊 Alpha Vantage: Cotação crypto obtida para ${symbol}`, {
        price: result.price,
        change: result.change,
        changePercent: result.changePercent.toFixed(2) + '%',
        volume: result.volume,
        date: result.timestamp
      });
      
      return result;
      
    } catch (error: any) {
      // Tratar especificamente "Invalid API call" como não suportado, não erro crítico
      if (error?.message?.includes('Invalid API call')) {
        logTrading(`⚠️ Alpha Vantage: Símbolo ${symbol} não suportado (Invalid API call)`);
        return null;
      }
      // Outros erros logamos mas não quebramos o fluxo
      logTrading(`⚠️ Alpha Vantage: Erro ao obter cotação crypto de ${symbol} - continuando sem esses dados`);
      return null;
    }
  }

  /**
   * ✅ NOVO: Obter taxa de câmbio crypto em tempo real
   */
  public async getCryptoExchangeRate(fromCurrency: string, toCurrency: string = 'USD'): Promise<{
    from: string;
    to: string;
    rate: number;
    timestamp: string;
  } | null> {
    try {
      const normalizedSymbol = this.normalizeSymbol(fromCurrency);
      if (!normalizedSymbol) {
        logTrading(`⚠️ Alpha Vantage: Símbolo ${fromCurrency} não suportado para taxa de câmbio`);
        return null;
      }

      const data = await this.makeRequest({
        function: 'CURRENCY_EXCHANGE_RATE',
        from_currency: normalizedSymbol,
        to_currency: toCurrency
      });
      
      // Verificar se há erro específico da API
      if (data['Error Message'] && data['Error Message'].includes('Invalid API call')) {
        logTrading(`⚠️ Alpha Vantage: Símbolo ${fromCurrency} não suportado pelo endpoint CURRENCY_EXCHANGE_RATE`);
        return null;
      }
      
      const exchangeRate = data['Realtime Currency Exchange Rate'];
      if (!exchangeRate) {
        logTrading(`⚠️ Alpha Vantage: Nenhuma taxa de câmbio encontrada para ${fromCurrency}/${toCurrency}`);
        return null;
      }
      
      const result = {
        from: exchangeRate['1. From_Currency Code'],
        to: exchangeRate['3. To_Currency Code'],
        rate: parseFloat(exchangeRate['5. Exchange Rate']),
        timestamp: exchangeRate['6. Last Refreshed']
      };
      
      logTrading(`💱 Alpha Vantage: Taxa de câmbio ${fromCurrency}/${toCurrency}`, {
        rate: result.rate,
        timestamp: result.timestamp
      });
      
      return result;
      
    } catch (error: any) {
      // Tratar especificamente "Invalid API call" como não suportado, não erro crítico
      if (error?.message?.includes('Invalid API call')) {
        logTrading(`⚠️ Alpha Vantage: Símbolo ${fromCurrency} não suportado para taxa de câmbio (Invalid API call)`);
        return null;
      }
      // Outros erros logamos mas não quebramos o fluxo
      logTrading(`⚠️ Alpha Vantage: Erro ao obter taxa de câmbio ${fromCurrency}/${toCurrency} - continuando sem esses dados`);
      return null;
    }
  }

  /**
   * ✅ NOVO: Obter dados intradiários de criptomoeda
   */
  public async getCryptoIntraday(symbol: string, interval: string = '5min', market: string = 'USD'): Promise<{
    symbol: string;
    interval: string;
    data: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  } | null> {
    try {
      const data = await this.makeRequest({
        function: 'CRYPTO_INTRADAY',
        symbol: symbol,
        market: market,
        interval: interval
      });
      
      const timeSeries = data[`Time Series Crypto (${interval})`];
      if (!timeSeries) {
        logTrading(`⚠️ Alpha Vantage: Nenhum dado intradiário encontrado para ${symbol}`);
        return null;
      }
      
      const dataPoints = Object.entries(timeSeries)
        .map(([timestamp, values]: [string, any]) => ({
          timestamp,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseFloat(values['5. volume'])
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      logTrading(`📊 Alpha Vantage: Dados intradiários obtidos para ${symbol}`, {
        interval,
        dataPoints: dataPoints.length,
        latestPrice: dataPoints[dataPoints.length - 1]?.close
      });
      
      return {
        symbol,
        interval,
        data: dataPoints
      };
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter dados intradiários de ${symbol}:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ NOVO: Obter série temporal diária completa de crypto
   */
  public async getCryptoDailySeries(symbol: string, market: string = 'USD', days: number = 100): Promise<{
    symbol: string;
    data: Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  } | null> {
    try {
      const data = await this.makeRequest({
        function: 'DIGITAL_CURRENCY_DAILY',
        symbol: symbol,
        market: market
      });
      
      const timeSeries = data['Time Series (Digital Currency Daily)'];
      if (!timeSeries) {
        logTrading(`⚠️ Alpha Vantage: Nenhuma série diária encontrada para ${symbol}`);
        return null;
      }
      
      const dataPoints = Object.entries(timeSeries)
        .slice(0, days)
        .map(([date, values]: [string, any]) => ({
          date,
          open: parseFloat(values['1a. open (USD)']),
          high: parseFloat(values['2a. high (USD)']),
          low: parseFloat(values['3a. low (USD)']),
          close: parseFloat(values['4a. close (USD)']),
          volume: parseFloat(values['5. volume'])
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      logTrading(`📊 Alpha Vantage: Série diária obtida para ${symbol}`, {
        days: dataPoints.length,
        latestClose: dataPoints[dataPoints.length - 1]?.close
      });
      
      return {
        symbol,
        data: dataPoints
      };
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter série diária de ${symbol}:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ NOVO: Obter indicadores técnicos aplicados a crypto (RSI)
   */
  public async getCryptoRSI(symbol: string, interval: string = 'daily', period: number = 14): Promise<TechnicalIndicator | null> {
    try {
      // Para crypto, primeiro obtemos dados intradiários/diários e então calculamos RSI
      // Ou podemos usar a API de technical indicators se disponível para crypto
      // Por enquanto, usamos DIGITAL_CURRENCY_DAILY e calculamos internamente
      const cryptoData = await this.getCryptoDailySeries(symbol, 'USD', period + 20);
      
      if (!cryptoData || cryptoData.data.length < period + 1) {
        logTrading(`⚠️ Alpha Vantage: Dados insuficientes para calcular RSI de ${symbol}`);
        return null;
      }
      
      // Calcular RSI localmente
      const closes = cryptoData.data.map(d => d.close);
      const rsiValues = this.calculateRSILocal(closes, period);
      
      const values = cryptoData.data.slice(period).map((d, idx) => ({
        date: d.date,
        value: rsiValues[idx]
      }));
      
      return {
        symbol,
        indicator: 'RSI',
        timeframe: interval,
        values
      };
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter RSI de crypto ${symbol}:`, 'API', null, error as Error);
      return null;
    }
  }

  /**
   * ✅ NOVO: Calcular RSI localmente (helper)
   */
  private calculateRSILocal(prices: number[], period: number = 14): number[] {
    const rsiValues: number[] = [];
    
    for (let i = period; i < prices.length; i++) {
      const slice = prices.slice(i - period, i + 1);
      const gains: number[] = [];
      const losses: number[] = [];
      
      for (let j = 1; j < slice.length; j++) {
        const change = slice[j] - slice[j - 1];
        if (change > 0) {
          gains.push(change);
          losses.push(0);
        } else {
          gains.push(0);
          losses.push(Math.abs(change));
        }
      }
      
      const avgGain = gains.reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        rsiValues.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiValues.push(rsi);
      }
    }
    
    return rsiValues;
  }

  /**
   * ✅ Obter múltiplas cotações de ações
   */
  public async getMultipleStockQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const quotes = new Map<string, StockQuote>();
    
    logTrading(`📊 Alpha Vantage: Obtendo cotações para ${symbols.length} símbolos...`);
    
    for (const symbol of symbols) {
      try {
        const quote = await this.getStockQuote(symbol);
        if (quote) {
          quotes.set(symbol, quote);
        }
        
        // Pequena pausa para respeitar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logger.error(`❌ Alpha Vantage: Erro ao obter cotação de ${symbol}:`, 'API', null, error as Error);
      }
    }
    
    logTrading(`✅ Alpha Vantage: Cotações obtidas: ${quotes.size}/${symbols.length}`);
    return quotes;
  }

  /**
   * ✅ Obter análise técnica completa
   */
  public async getCompleteTechnicalAnalysis(symbol: string): Promise<{
    rsi: TechnicalIndicator | null;
    macd: TechnicalIndicator | null;
    bollingerBands: any;
    quote: StockQuote | null;
  }> {
    try {
      logTrading(`📊 Alpha Vantage: Iniciando análise técnica completa para ${symbol}...`);
      
      const [rsi, macd, bollingerBands, quote] = await Promise.all([
        this.getRSI(symbol),
        this.getMACD(symbol),
        this.getBollingerBands(symbol),
        this.getStockQuote(symbol)
      ]);
      
      logTrading(`✅ Alpha Vantage: Análise técnica completa obtida para ${symbol}`, {
        rsi: rsi ? 'OK' : 'N/A',
        macd: macd ? 'OK' : 'N/A',
        bollingerBands: bollingerBands ? 'OK' : 'N/A',
        quote: quote ? 'OK' : 'N/A'
      });
      
      return {
        rsi,
        macd,
        bollingerBands,
        quote
      };
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro na análise técnica completa de ${symbol}:`, 'API', null, error as Error);
      return {
        rsi: null,
        macd: null,
        bollingerBands: null,
        quote: null
      };
    }
  }

  /**
   * ✅ Obter dados econômicos completos
   */
  public async getCompleteEconomicData(): Promise<{
    gdp: EconomicIndicator | null;
    inflation: EconomicIndicator | null;
  }> {
    try {
      logTrading(`📊 Alpha Vantage: Obtendo dados econômicos completos...`);
      
      const [gdp, inflation] = await Promise.all([
        this.getGDP(),
        this.getInflation()
      ]);
      
      logTrading(`✅ Alpha Vantage: Dados econômicos obtidos`, {
        gdp: gdp ? 'OK' : 'N/A',
        inflation: inflation ? 'OK' : 'N/A'
      });
      
      return {
        gdp,
        inflation
      };
      
    } catch (error) {
      logger.error(`❌ Alpha Vantage: Erro ao obter dados econômicos:`, 'API', null, error as Error);
      return {
        gdp: null,
        inflation: null
      };
    }
  }

  /**
   * ✅ Obter estatísticas de uso da API
   */
  public getApiStats(): {
    requestCount: number;
    lastRequestTime: number;
    rateLimitRemaining: number;
  } {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const rateLimitRemaining = timeSinceLastRequest > this.RATE_LIMIT_WINDOW ? 
      this.RATE_LIMIT : 
      Math.max(0, this.RATE_LIMIT - this.requestCount);
    
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      rateLimitRemaining
    };
  }

  /**
   * ✅ Resetar contador de rate limit
   */
  public resetRateLimit(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    logTrading('🔄 Alpha Vantage: Rate limit resetado');
  }
}

// Instância global do cliente Alpha Vantage
export const alphaVantageClient = new AlphaVantageClient('8A4WAOBVXKU5OCF7');
export default AlphaVantageClient;
