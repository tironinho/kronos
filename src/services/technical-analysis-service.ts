import TechnicalAnalysisModule, { TechnicalAnalysisResult } from './technical-analysis-module';
import { logger, logTrading } from './logger';

export interface TechnicalAnalysisConfig {
  timeframe: string;
  lookbackPeriod: number;
  enablePatterns: boolean;
  enableVolumeAnalysis: boolean;
  enableConfluence: boolean;
  minConfidence: number;
}

export interface TechnicalSignal {
  symbol: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  score: number;
  rationale: string;
  indicators: {
    rsi: number;
    macd: { line: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number; position: number };
    vwap: number;
    emas: { ema9: number; ema21: number; ema50: number };
    atr: number;
  };
  supportResistance: {
    nearestSupport: number | null;
    nearestResistance: number | null;
    pivotPoint: number;
  };
  patterns: string[];
  volumeAnalysis: {
    volumeRatio: number;
    volumeConfirmation: boolean;
    volumeTrend: string;
  };
  timestamp: number;
}

/**
 * ✅ SERVIÇO DE INTEGRAÇÃO: Análise Técnica para Trading
 * Objetivo: Integrar o módulo de análise técnica com o sistema de trading
 */
export class TechnicalAnalysisService {
  private static readonly DEFAULT_CONFIG: TechnicalAnalysisConfig = {
    timeframe: '1h',
    lookbackPeriod: 200,
    enablePatterns: true,
    enableVolumeAnalysis: true,
    enableConfluence: true,
    minConfidence: 40
  };

  private static cache = new Map<string, { result: TechnicalAnalysisResult; timestamp: number }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  /**
   * ✅ FUNÇÃO PRINCIPAL: Obter sinal técnico para símbolo
   */
  public static async getTechnicalSignal(
    symbol: string,
    config: Partial<TechnicalAnalysisConfig> = {}
  ): Promise<TechnicalSignal | null> {
    try {
      const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
      
      logTrading(`📊 Obtendo sinal técnico para ${symbol} (${finalConfig.timeframe})...`);

      // Verificar cache
      const cacheKey = `${symbol}_${finalConfig.timeframe}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        logTrading(`📋 Usando análise técnica em cache para ${symbol}`);
        return this.convertToTechnicalSignal(cached.result, symbol);
      }

      // Realizar análise técnica
      const analysis = await TechnicalAnalysisModule.performTechnicalAnalysis(
        symbol,
        finalConfig.timeframe,
        finalConfig.lookbackPeriod
      );

      // Cachear resultado
      this.cache.set(cacheKey, { result: analysis, timestamp: Date.now() });

      // Verificar confiança mínima
      if (analysis.confluence.confidence < finalConfig.minConfidence) {
        logTrading(`⚠️ ${symbol}: Confiança técnica baixa (${analysis.confluence.confidence}% < ${finalConfig.minConfidence}%)`);
        return null;
      }

      const signal = this.convertToTechnicalSignal(analysis, symbol);
      
      logTrading(`✅ Sinal técnico obtido para ${symbol}`, {
        recommendation: signal.recommendation,
        confidence: signal.confidence,
        strength: signal.strength,
        score: signal.score
      });

      return signal;
    } catch (error) {
      logger.error(`❌ Erro ao obter sinal técnico para ${symbol}:`, 'TRADING', null, error);
      return null;
    }
  }

  /**
   * ✅ Obter sinais técnicos para múltiplos símbolos
   */
  public static async getMultipleTechnicalSignals(
    symbols: string[],
    config: Partial<TechnicalAnalysisConfig> = {}
  ): Promise<Map<string, TechnicalSignal>> {
    const signals = new Map<string, TechnicalSignal>();
    
    logTrading(`📊 Obtendo sinais técnicos para ${symbols.length} símbolos...`);

    // Processar em paralelo para melhor performance
    const promises = symbols.map(async (symbol) => {
      try {
        const signal = await this.getTechnicalSignal(symbol, config);
        if (signal) {
          signals.set(symbol, signal);
        }
      } catch (error) {
        logger.error(`❌ Erro ao obter sinal técnico para ${symbol}:`, 'TRADING', null, error);
      }
    });

    await Promise.all(promises);

    logTrading(`✅ Sinais técnicos obtidos: ${signals.size}/${symbols.length}`, {
      symbols: Array.from(signals.keys()),
      recommendations: Array.from(signals.values()).map(s => s.recommendation)
    });

    return signals;
  }

  /**
   * ✅ Filtrar símbolos por sinal técnico
   */
  public static async filterSymbolsByTechnicalSignal(
    symbols: string[],
    allowedSignals: ('STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL')[] = ['STRONG_BUY', 'BUY', 'SELL', 'STRONG_SELL'],
    minConfidence: number = 40,
    config: Partial<TechnicalAnalysisConfig> = {}
  ): Promise<string[]> {
    
    logTrading(`🔍 Filtrando ${symbols.length} símbolos por sinal técnico...`, {
      allowedSignals,
      minConfidence
    });

    const signals = await this.getMultipleTechnicalSignals(symbols, config);
    const filteredSymbols: string[] = [];

    signals.forEach((signal, symbol) => {
      if (
        allowedSignals.includes(signal.recommendation) &&
        signal.confidence >= minConfidence
      ) {
        filteredSymbols.push(symbol);
        logTrading(`✅ ${symbol}: ${signal.recommendation} (${signal.confidence}%)`);
      } else {
        logTrading(`⏸️ ${symbol}: ${signal.recommendation} (${signal.confidence}%) - Filtrado`);
      }
    });

    logTrading(`📊 Símbolos filtrados: ${filteredSymbols.length}/${symbols.length}`, {
      filtered: filteredSymbols
    });

    return filteredSymbols;
  }

  /**
   * ✅ Obter análise técnica completa
   */
  public static async getFullTechnicalAnalysis(
    symbol: string,
    config: Partial<TechnicalAnalysisConfig> = {}
  ): Promise<TechnicalAnalysisResult | null> {
    try {
      const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
      
      logTrading(`📊 Obtendo análise técnica completa para ${symbol}...`);

      const analysis = await TechnicalAnalysisModule.performTechnicalAnalysis(
        symbol,
        finalConfig.timeframe,
        finalConfig.lookbackPeriod
      );

      logTrading(`✅ Análise técnica completa obtida para ${symbol}`, {
        confluence: analysis.confluence.recommendation,
        confidence: analysis.confluence.confidence,
        patterns: analysis.candlestickPatterns.length,
        supportLevels: analysis.supportResistance.support.length,
        resistanceLevels: analysis.supportResistance.resistance.length
      });

      return analysis;
    } catch (error) {
      logger.error(`❌ Erro ao obter análise técnica completa para ${symbol}:`, 'TRADING', null, error);
      return null;
    }
  }

  /**
   * ✅ Obter estatísticas de sinais técnicos
   */
  public static async getTechnicalSignalsStats(
    symbols: string[],
    config: Partial<TechnicalAnalysisConfig> = {}
  ): Promise<{
    total: number;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    avgConfidence: number;
    avgScore: number;
    strongSignals: number;
    moderateSignals: number;
    weakSignals: number;
  }> {
    
    const signals = await this.getMultipleTechnicalSignals(symbols, config);
    
    let strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0;
    let totalConfidence = 0, totalScore = 0;
    let strongSignals = 0, moderateSignals = 0, weakSignals = 0;

    signals.forEach(signal => {
      switch (signal.recommendation) {
        case 'STRONG_BUY': strongBuy++; break;
        case 'BUY': buy++; break;
        case 'HOLD': hold++; break;
        case 'SELL': sell++; break;
        case 'STRONG_SELL': strongSell++; break;
      }

      totalConfidence += signal.confidence;
      totalScore += signal.score;

      switch (signal.strength) {
        case 'very_strong':
        case 'strong': strongSignals++; break;
        case 'moderate': moderateSignals++; break;
        case 'weak': weakSignals++; break;
      }
    });

    return {
      total: signals.size,
      strongBuy,
      buy,
      hold,
      sell,
      strongSell,
      avgConfidence: signals.size > 0 ? totalConfidence / signals.size : 0,
      avgScore: signals.size > 0 ? totalScore / signals.size : 0,
      strongSignals,
      moderateSignals,
      weakSignals
    };
  }

  /**
   * ✅ Converter análise técnica para sinal técnico
   */
  private static convertToTechnicalSignal(
    analysis: TechnicalAnalysisResult,
    symbol: string
  ): TechnicalSignal {
    const { indicators, supportResistance, candlestickPatterns, volumeAnalysis, confluence } = analysis;

    // Encontrar suporte e resistência mais próximos
    const currentPrice = indicators.vwap; // Usar VWAP como referência
    const nearestSupport = supportResistance.support.length > 0 
      ? supportResistance.support.reduce((prev, curr) => 
          Math.abs(curr.level - currentPrice) < Math.abs(prev.level - currentPrice) ? curr : prev
        ).level
      : null;
    
    const nearestResistance = supportResistance.resistance.length > 0
      ? supportResistance.resistance.reduce((prev, curr) => 
          Math.abs(curr.level - currentPrice) < Math.abs(prev.level - currentPrice) ? curr : prev
        ).level
      : null;

    return {
      symbol,
      recommendation: confluence.recommendation,
      confidence: confluence.confidence,
      strength: confluence.strength,
      score: confluence.score,
      rationale: confluence.rationale,
      indicators: {
        rsi: indicators.rsi,
        macd: indicators.macd,
        bollinger: indicators.bollinger,
        vwap: indicators.vwap,
        emas: indicators.emas,
        atr: indicators.atr
      },
      supportResistance: {
        nearestSupport,
        nearestResistance,
        pivotPoint: supportResistance.pivotPoints.pp
      },
      patterns: candlestickPatterns.map(p => p.name),
      volumeAnalysis: {
        volumeRatio: volumeAnalysis.volumeRatio,
        volumeConfirmation: volumeAnalysis.volumeConfirmation,
        volumeTrend: volumeAnalysis.volumeTrend
      },
      timestamp: analysis.timestamp
    };
  }

  /**
   * ✅ Limpar cache
   */
  public static clearCache(): void {
    this.cache.clear();
    logTrading('🧹 Cache de análise técnica limpo');
  }

  /**
   * ✅ Obter estatísticas do cache
   */
  public static getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.cache.size,
      symbols: Array.from(this.cache.keys())
    };
  }

  /**
   * ✅ Validar configuração
   */
  public static validateConfig(config: Partial<TechnicalAnalysisConfig>): TechnicalAnalysisConfig {
    const validated = { ...this.DEFAULT_CONFIG, ...config };
    
    // Validar timeframe
    const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
    if (!validTimeframes.includes(validated.timeframe)) {
      logTrading(`⚠️ Timeframe inválido: ${validated.timeframe}, usando padrão: ${this.DEFAULT_CONFIG.timeframe}`);
      validated.timeframe = this.DEFAULT_CONFIG.timeframe;
    }

    // Validar lookback period
    if (validated.lookbackPeriod < 50 || validated.lookbackPeriod > 1000) {
      logTrading(`⚠️ Lookback period inválido: ${validated.lookbackPeriod}, usando padrão: ${this.DEFAULT_CONFIG.lookbackPeriod}`);
      validated.lookbackPeriod = this.DEFAULT_CONFIG.lookbackPeriod;
    }

    // Validar minConfidence
    if (validated.minConfidence < 0 || validated.minConfidence > 100) {
      logTrading(`⚠️ MinConfidence inválido: ${validated.minConfidence}, usando padrão: ${this.DEFAULT_CONFIG.minConfidence}`);
      validated.minConfidence = this.DEFAULT_CONFIG.minConfidence;
    }

    return validated;
  }
}

export default TechnicalAnalysisService;
