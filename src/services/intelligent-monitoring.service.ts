import { Logger } from './logger';
import { AdvancedTradingEngine } from './advanced-trading-engine';
import { BinanceApiService } from './binance-api';
import { SupabaseService } from './supabase';

export enum TrendDirection {
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  SIDEWAYS = 'sideways',
  REVERSING = 'reversing'
}

export enum WhaleActivityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EXTREME = 'extreme'
}

export enum ManipulationSignal {
  NONE = 'none',
  SUSPICIOUS = 'suspicious',
  HIGH_PROBABILITY = 'high_probability',
  CONFIRMED = 'confirmed'
}

export interface TrendAnalysis {
  direction: TrendDirection;
  strength: number;
  confidence: number;
  reversalProbability: number;
  timeframe: string;
  timestamp: Date;
}

export interface WhaleActivity {
  level: WhaleActivityLevel;
  volumeSpike: number;
  priceImpact: number;
  manipulationSignal: ManipulationSignal;
  confidence: number;
  timestamp: Date;
}

export interface MarketAlert {
  type: string;
  severity: string;
  message: string;
  confidence: number;
  recommendedAction: string;
  timestamp: Date;
}

export interface MonitoringRecommendation {
  trendAction: string;
  whaleAction: string;
  finalAction: string;
}

export class IntelligentMonitoringService {
  private readonly logger = Logger.getInstance();
  
  // Armazenamento de dados históricos
  private marketData = new Map<string, {
    prices: number[];
    volumes: number[];
    timestamps: Date[];
  }>();
  
  // Configurações
  private readonly WINDOW_SIZE = 100;
  private readonly VOLUME_THRESHOLD_MULTIPLIER = 3.0;
  private readonly REVERSAL_THRESHOLD = 0.7;
  private readonly WHALE_ACTIVITY_THRESHOLD = 0.8;
  
  constructor() {
    this.logger.log('🚀 Sistema de Monitoramento Inteligente inicializado');
  }

  /**
   * Monitora o mercado em tempo real e gera alertas
   */
  async monitorMarket(): Promise<void> {
    try {
      const symbols = await this.getActiveSymbols();
      
      for (const symbol of symbols) {
        await this.analyzeSymbol(symbol);
      }
      
    } catch (error) {
      this.logger.error('❌ Erro no monitoramento do mercado:', error);
    }
  }

  /**
   * Analisa um símbolo específico
   */
  private async analyzeSymbol(symbol: string): Promise<void> {
    try {
      // Busca dados atuais
      const currentData = await this.getCurrentMarketData(symbol);
      if (!currentData) return;

      // Adiciona dados ao histórico
      this.addMarketData(symbol, currentData.price, currentData.volume);

      // Análise de tendência
      const trendAnalysis = await this.analyzeTrend(symbol);

      // Análise de atividade de baleias
      const whaleActivity = await this.analyzeWhaleActivity(symbol);

      // Geração de alertas
      const alerts = await this.generateAlerts(symbol, trendAnalysis, whaleActivity);

      // Recomendações de ação
      const recommendations = await this.generateRecommendations(symbol, trendAnalysis, whaleActivity);

      // Processa alertas críticos
      await this.processCriticalAlerts(symbol, alerts, recommendations);

      // Log da análise
      this.logAnalysis(symbol, trendAnalysis, whaleActivity, alerts, recommendations);

    } catch (error) {
      this.logger.error(`❌ Erro ao analisar ${symbol}:`, error);
    }
  }

  /**
   * Obtém dados atuais do mercado
   */
  private async getCurrentMarketData(symbol: string): Promise<{price: number, volume: number} | null> {
    try {
      // Mock data para desenvolvimento
      const ticker = { price: '50000' };
      const stats = { volume: '1000000' };
      
      return {
        price: parseFloat(ticker.price),
        volume: parseFloat(stats.volume)
      };
    } catch (error) {
      this.logger.warn(`⚠️ Erro ao obter dados para ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Adiciona dados ao histórico
   */
  private addMarketData(symbol: string, price: number, volume: number): void {
    if (!this.marketData.has(symbol)) {
      this.marketData.set(symbol, {
        prices: [],
        volumes: [],
        timestamps: []
      });
    }

    const data = this.marketData.get(symbol);
    data.prices.push(price);
    data.volumes.push(volume);
    data.timestamps.push(new Date());

    // Mantém apenas os últimos dados
    if (data.prices.length > this.WINDOW_SIZE) {
      data.prices.shift();
      data.volumes.shift();
      data.timestamps.shift();
    }
  }

  /**
   * Analisa tendência do mercado
   */
  private async analyzeTrend(symbol: string): Promise<TrendAnalysis> {
    const data = this.marketData.get(symbol);
    if (!data || data.prices.length < 20) {
      return this.getDefaultTrendAnalysis();
    }

    const prices = data.prices;
    const volumes = data.volumes;

    // 1. Detecção de direção da tendência
    const direction = this.detectTrendDirection(prices, volumes);

    // 2. Cálculo da força da tendência
    const strength = this.calculateTrendStrength(prices, volumes);

    // 3. Probabilidade de reversão
    const reversalProbability = this.calculateReversalProbability(prices, volumes);

    // 4. Confiança na análise
    const confidence = (strength + (1 - reversalProbability)) / 2;

    return {
      direction,
      strength,
      confidence,
      reversalProbability,
      timeframe: 'real_time',
      timestamp: new Date()
    };
  }

  /**
   * Detecta direção da tendência
   */
  private detectTrendDirection(prices: number[], volumes: number[]): TrendDirection {
    if (prices.length < 20) return TrendDirection.SIDEWAYS;

    // Análise de médias móveis
    const ma5 = this.calculateMA(prices, 5);
    const ma10 = this.calculateMA(prices, 10);
    const ma20 = this.calculateMA(prices, 20);

    // Análise de momentum
    const momentum5 = (prices[prices.length - 1] - prices[prices.length - 6]) / prices[prices.length - 6];
    const momentum10 = (prices[prices.length - 1] - prices[prices.length - 11]) / prices[prices.length - 11];

    // Análise de reversão
    const reversalSignals = this.detectReversalSignals(prices, volumes);

    let bullishSignals = 0;
    let bearishSignals = 0;

    // Sinais de tendência
    if (ma5 > ma10 && ma10 > ma20) bullishSignals += 2;
    else if (ma5 < ma10 && ma10 < ma20) bearishSignals += 2;

    if (momentum5 > 0.02) bullishSignals += 1;
    else if (momentum5 < -0.02) bearishSignals += 1;

    // Verificação de reversão
    if (reversalSignals >= 2) return TrendDirection.REVERSING;
    else if (bullishSignals > bearishSignals) return TrendDirection.BULLISH;
    else if (bearishSignals > bullishSignals) return TrendDirection.BEARISH;
    else return TrendDirection.SIDEWAYS;
  }

  /**
   * Calcula força da tendência
   */
  private calculateTrendStrength(prices: number[], volumes: number[]): number {
    if (prices.length < 20) return 0;

    // 1. Análise de inclinação (regressão linear)
    const x = Array.from({length: prices.length}, (_, i) => i);
    const slope = this.calculateSlope(x, prices);
    const slopeStrength = Math.abs(slope) / this.calculateStandardDeviation(prices);

    // 2. Convergência de médias móveis
    const maShort = this.calculateMA(prices, 10);
    const maLong = this.calculateMA(prices, 20);
    const maConvergence = Math.abs(maShort - maLong) / maLong;

    // 3. Momentum de preço
    const momentum = (prices[prices.length - 1] - prices[prices.length - 11]) / prices[prices.length - 11];
    const momentumStrength = Math.abs(momentum);

    // 4. Confirmação de volume
    const recentVolume = this.calculateMA(volumes, 10);
    const avgVolume = this.calculateMA(volumes, 20);
    const volumeConfirmation = recentVolume / avgVolume;

    // Combinação ponderada
    const trendStrength = (
      slopeStrength * 0.3 +
      maConvergence * 0.25 +
      momentumStrength * 0.25 +
      Math.min(volumeConfirmation, 2.0) * 0.2
    );

    return Math.min(trendStrength, 1.0);
  }

  /**
   * Calcula probabilidade de reversão
   */
  private calculateReversalProbability(prices: number[], volumes: number[]): number {
    if (prices.length < 30) return 0;

    let reversalSignals = 0;
    let totalSignals = 0;

    // 1. Análise de divergência preço-volume
    const priceTrend = this.calculateSlope(
      Array.from({length: 10}, (_, i) => i),
      prices.slice(-10)
    );
    const volumeTrend = this.calculateSlope(
      Array.from({length: 10}, (_, i) => i),
      volumes.slice(-10)
    );

    if ((priceTrend > 0 && volumeTrend < 0) || (priceTrend < 0 && volumeTrend < 0)) {
      reversalSignals += 1;
    }
    totalSignals += 1;

    // 2. Análise de RSI
    const rsiValues = this.calculateRSI(prices);
    if (rsiValues.length >= 10) {
      const rsiTrend = this.calculateSlope(
        Array.from({length: 10}, (_, i) => i),
        rsiValues.slice(-10)
      );
      const priceTrendShort = this.calculateSlope(
        Array.from({length: 10}, (_, i) => i),
        prices.slice(-10)
      );

      if ((rsiTrend < 0 && priceTrendShort > 0) || (rsiTrend > 0 && priceTrendShort < 0)) {
        reversalSignals += 1;
      }
      totalSignals += 1;
    }

    // 3. Análise de volatilidade
    const volatility = this.calculateStandardDeviation(prices.slice(-10)) / this.calculateMA(prices.slice(-10), 10);
    if (volatility > 0.05) {
      reversalSignals += 0.5;
    }
    totalSignals += 1;

    return Math.min(reversalSignals / totalSignals, 1.0);
  }

  /**
   * Analisa atividade de baleias
   */
  private async analyzeWhaleActivity(symbol: string): Promise<WhaleActivity> {
    const data = this.marketData.get(symbol);
    if (!data || data.prices.length < 20) {
      return this.getDefaultWhaleActivity();
    }

    const prices = data.prices;
    const volumes = data.volumes;

    // 1. Detecção de spike de volume
    const volumeSpike = this.detectVolumeSpike(volumes);

    // 2. Análise de impacto no preço
    const priceImpact = this.calculatePriceImpact(prices, volumes);

    // 3. Detecção de padrões suspeitos
    const manipulationSignal = this.detectManipulationPatterns(prices, volumes);

    // 4. Determinação do nível de atividade
    const activityLevel = this.determineActivityLevel(volumeSpike, priceImpact, manipulationSignal);

    // 5. Cálculo de confiança
    const confidence = this.calculateWhaleConfidence(volumeSpike, priceImpact, manipulationSignal);

    return {
      level: activityLevel,
      volumeSpike,
      priceImpact,
      manipulationSignal,
      confidence,
      timestamp: new Date()
    };
  }

  /**
   * Detecta spike de volume
   */
  private detectVolumeSpike(volumes: number[]): number {
    if (volumes.length < 20) return 0;

    const recentVolume = this.calculateMA(volumes.slice(-5), 5);
    const avgVolume = this.calculateMA(volumes.slice(-20), 20);
    const stdVolume = this.calculateStandardDeviation(volumes.slice(-20));

    if (avgVolume === 0) return 0;

    const zScore = (recentVolume - avgVolume) / stdVolume;
    return Math.min(Math.max(zScore / 3.0, 0), 1.0);
  }

  /**
   * Calcula impacto no preço
   */
  private calculatePriceImpact(prices: number[], volumes: number[]): number {
    if (prices.length < 10) return 0;

    const priceChanges = this.calculateDifferences(prices.slice(-10));
    const volumeChanges = this.calculateDifferences(volumes.slice(-10));

    if (priceChanges.length === 0 || this.calculateStandardDeviation(volumeChanges) === 0) {
      return 0;
    }

    const correlation = this.calculateCorrelation(priceChanges, volumeChanges);
    const totalVolume = volumes.slice(-10).reduce((sum, vol) => sum + vol, 0);
    const totalPriceChange = Math.abs(prices[prices.length - 1] - prices[prices.length - 11]) / prices[prices.length - 11];

    if (totalVolume === 0) return 0;

    const priceImpact = (totalPriceChange * correlation) / (totalVolume / this.calculateMA(volumes.slice(-20), 20));
    return Math.min(Math.max(priceImpact, 0), 1.0);
  }

  /**
   * Detecta padrões de manipulação
   */
  private detectManipulationPatterns(prices: number[], volumes: number[]): ManipulationSignal {
    if (volumes.length < 30) return ManipulationSignal.NONE;

    let manipulationScore = 0;

    // 1. Detecção de Pump and Dump
    manipulationScore += this.detectPumpDumpPattern(prices, volumes);

    // 2. Detecção de Wash Trading
    manipulationScore += this.detectWashTrading(volumes);

    // 3. Detecção de Spoofing
    manipulationScore += this.detectSpoofingPattern(prices, volumes);

    // 4. Detecção de manipulação de volume
    manipulationScore += this.detectVolumeManipulation(volumes);

    if (manipulationScore >= 0.8) return ManipulationSignal.CONFIRMED;
    else if (manipulationScore >= 0.6) return ManipulationSignal.HIGH_PROBABILITY;
    else if (manipulationScore >= 0.3) return ManipulationSignal.SUSPICIOUS;
    else return ManipulationSignal.NONE;
  }

  /**
   * Detecta padrão de pump and dump
   */
  private detectPumpDumpPattern(prices: number[], volumes: number[]): number {
    if (prices.length < 20) return 0;

    const priceChanges = this.calculateDifferences(prices.slice(-20));
    const maxPriceChange = Math.max(...priceChanges);
    const minPriceChange = Math.min(...priceChanges);

    if (maxPriceChange > 0.05 && minPriceChange < -0.03) {
      const pumpVolume = this.calculateMA(volumes.slice(-15, -5), 10);
      const dumpVolume = this.calculateMA(volumes.slice(-5), 5);

      if (pumpVolume > dumpVolume * 1.5) {
        return 0.7;
      }
    }

    return 0;
  }

  /**
   * Detecta wash trading
   */
  private detectWashTrading(volumes: number[]): number {
    if (volumes.length < 30) return 0;

    const volumeVariance = this.calculateVariance(volumes.slice(-20));
    const volumeMean = this.calculateMA(volumes.slice(-20), 20);

    const cv = volumeVariance / volumeMean;
    if (cv < 0.1) {
      return 0.5;
    }

    return 0;
  }

  /**
   * Detecta padrão de spoofing
   */
  private detectSpoofingPattern(prices: number[], volumes: number[]): number {
    if (prices.length < 30) return 0;

    const priceChanges = this.calculateDifferences(prices.slice(-20)).map(Math.abs);
    const volumeChanges = this.calculateDifferences(volumes.slice(-20)).map(Math.abs);

    let suspiciousMoves = 0;
    const avgVolumeChange = this.calculateMA(volumeChanges, volumeChanges.length);

    for (let i = 0; i < priceChanges.length; i++) {
      if (priceChanges[i] > 0.02 && volumeChanges[i] < avgVolumeChange * 0.5) {
        suspiciousMoves++;
      }
    }

    return Math.min(suspiciousMoves / priceChanges.length * 2, 1.0);
  }

  /**
   * Detecta manipulação de volume
   */
  private detectVolumeManipulation(volumes: number[]): number {
    if (volumes.length < 30) return 0;

    const volumePercentiles = this.calculatePercentiles(volumes.slice(-30), [25, 50, 75, 90, 95]);
    const extremeVolumes = volumes.slice(-30).filter(v => v > volumePercentiles[3]).length;

    if (extremeVolumes > 5) {
      return 0.6;
    }

    return 0;
  }

  /**
   * Determina nível de atividade das baleias
   */
  private determineActivityLevel(volumeSpike: number, priceImpact: number, manipulationSignal: ManipulationSignal): WhaleActivityLevel {
    let score = volumeSpike + priceImpact;

    if (manipulationSignal === ManipulationSignal.CONFIRMED) score += 0.5;
    else if (manipulationSignal === ManipulationSignal.HIGH_PROBABILITY) score += 0.3;
    else if (manipulationSignal === ManipulationSignal.SUSPICIOUS) score += 0.1;

    if (score >= 1.5) return WhaleActivityLevel.EXTREME;
    else if (score >= 1.0) return WhaleActivityLevel.HIGH;
    else if (score >= 0.5) return WhaleActivityLevel.MEDIUM;
    else return WhaleActivityLevel.LOW;
  }

  /**
   * Calcula confiança na detecção de baleias
   */
  private calculateWhaleConfidence(volumeSpike: number, priceImpact: number, manipulationSignal: ManipulationSignal): number {
    let baseConfidence = (volumeSpike + priceImpact) / 2;

    if (manipulationSignal === ManipulationSignal.CONFIRMED) baseConfidence += 0.3;
    else if (manipulationSignal === ManipulationSignal.HIGH_PROBABILITY) baseConfidence += 0.2;
    else if (manipulationSignal === ManipulationSignal.SUSPICIOUS) baseConfidence += 0.1;

    return Math.min(baseConfidence, 1.0);
  }

  /**
   * Gera alertas baseados na análise
   */
  private async generateAlerts(symbol: string, trendAnalysis: TrendAnalysis, whaleActivity: WhaleActivity): Promise<MarketAlert[]> {
    const alerts: MarketAlert[] = [];

    // Alerta de mudança de tendência
    if (trendAnalysis.reversalProbability > this.REVERSAL_THRESHOLD) {
      alerts.push({
        type: 'trend_reversal',
        severity: 'high',
        message: `Alta probabilidade de reversão de tendência detectada para ${symbol}`,
        confidence: trendAnalysis.reversalProbability,
        recommendedAction: 'Considerar fechamento de posições',
        timestamp: new Date()
      });
    }

    // Alerta de atividade de baleias
    if (whaleActivity.level === WhaleActivityLevel.HIGH || whaleActivity.level === WhaleActivityLevel.EXTREME) {
      alerts.push({
        type: 'whale_activity',
        severity: whaleActivity.level === WhaleActivityLevel.HIGH ? 'medium' : 'high',
        message: `Atividade intensa de baleias detectada para ${symbol}`,
        confidence: whaleActivity.confidence,
        recommendedAction: 'Monitorar de perto e considerar fechamento preventivo',
        timestamp: new Date()
      });
    }

    // Alerta de manipulação
    if (whaleActivity.manipulationSignal === ManipulationSignal.HIGH_PROBABILITY || 
        whaleActivity.manipulationSignal === ManipulationSignal.CONFIRMED) {
      alerts.push({
        type: 'market_manipulation',
        severity: 'high',
        message: `Possível manipulação de mercado detectada para ${symbol}`,
        confidence: whaleActivity.confidence,
        recommendedAction: 'Fechar posições imediatamente',
        timestamp: new Date()
      });
    }

    return alerts;
  }

  /**
   * Gera recomendações de ação
   */
  private async generateRecommendations(symbol: string, trendAnalysis: TrendAnalysis, whaleActivity: WhaleActivity): Promise<MonitoringRecommendation> {
    const recommendations: MonitoringRecommendation = {
      trendAction: 'MONITOR',
      whaleAction: 'MONITOR',
      finalAction: 'MONITOR'
    };

    // Recomendação baseada na tendência
    if (trendAnalysis.direction === TrendDirection.REVERSING) {
      recommendations.trendAction = 'CLOSE_POSITIONS';
    } else if (trendAnalysis.direction === TrendDirection.BULLISH && trendAnalysis.confidence > 0.7) {
      recommendations.trendAction = 'HOLD_LONG';
    } else if (trendAnalysis.direction === TrendDirection.BEARISH && trendAnalysis.confidence > 0.7) {
      recommendations.trendAction = 'HOLD_SHORT';
    }

    // Recomendação baseada na atividade de baleias
    if (whaleActivity.level === WhaleActivityLevel.EXTREME) {
      recommendations.whaleAction = 'CLOSE_IMMEDIATELY';
    } else if (whaleActivity.level === WhaleActivityLevel.HIGH) {
      recommendations.whaleAction = 'CLOSE_PREVENTIVELY';
    } else if (whaleActivity.level === WhaleActivityLevel.MEDIUM) {
      recommendations.whaleAction = 'REDUCE_POSITION';
    }

    // Recomendação final combinada
    if (recommendations.whaleAction === 'CLOSE_IMMEDIATELY' || recommendations.whaleAction === 'CLOSE_PREVENTIVELY') {
      recommendations.finalAction = recommendations.whaleAction;
    } else if (recommendations.trendAction === 'CLOSE_POSITIONS') {
      recommendations.finalAction = 'CLOSE_POSITIONS';
    }

    return recommendations;
  }

  /**
   * Processa alertas críticos
   */
  private async processCriticalAlerts(symbol: string, alerts: MarketAlert[], recommendations: MonitoringRecommendation): Promise<void> {
    const criticalAlerts = alerts.filter(alert => alert.severity === 'high');

    if (criticalAlerts.length > 0) {
      this.logger.warn(`🚨 ALERTAS CRÍTICOS para ${symbol}:`, criticalAlerts);

      // Emite evento para o sistema de trading
      // Mock event emission para desenvolvimento
      console.log('🚨 ALERTA CRÍTICO DE MERCADO:', {
        symbol,
        alerts: criticalAlerts,
        recommendations,
        timestamp: new Date()
      });

      // Salva alertas no banco de dados
      await this.saveAlertsToDatabase(symbol, criticalAlerts);
    }
  }

  /**
   * Salva alertas no banco de dados
   */
  private async saveAlertsToDatabase(symbol: string, alerts: MarketAlert[]): Promise<void> {
    try {
      for (const alert of alerts) {
        // Mock supabase para desenvolvimento
        console.log('💾 Salvando alerta no banco de dados:', {
          symbol,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          confidence: alert.confidence,
          recommended_action: alert.recommendedAction,
          created_at: alert.timestamp
        });
      }
    } catch (error) {
      this.logger.error('❌ Erro ao salvar alertas no banco:', error);
    }
  }

  /**
   * Determina se uma trade deve ser fechada
   */
  async shouldCloseTrade(tradeId: string, symbol: string, currentPnl: number): Promise<{shouldClose: boolean, reason: string}> {
    try {
      const data = this.marketData.get(symbol);
      if (!data || data.prices.length < 20) {
        return { shouldClose: false, reason: 'Dados insuficientes para análise' };
      }

      // Análise atual
      const trendAnalysis = await this.analyzeTrend(symbol);
      const whaleActivity = await this.analyzeWhaleActivity(symbol);

      // Verifica alertas críticos
      if (whaleActivity.level === WhaleActivityLevel.EXTREME && whaleActivity.confidence > this.WHALE_ACTIVITY_THRESHOLD) {
        return {
          shouldClose: true,
          reason: `Fechamento por atividade extrema de baleias (confiança: ${whaleActivity.confidence.toFixed(2)})`
        };
      }

      // Verifica probabilidade de reversão com lucro
      if (trendAnalysis.reversalProbability > this.REVERSAL_THRESHOLD && currentPnl > 0) {
        return {
          shouldClose: true,
          reason: `Fechamento preventivo por alta probabilidade de reversão (${trendAnalysis.reversalProbability.toFixed(2)}) com lucro`
        };
      }

      // Verifica manipulação confirmada
      if (whaleActivity.manipulationSignal === ManipulationSignal.CONFIRMED) {
        return {
          shouldClose: true,
          reason: 'Fechamento por manipulação de mercado confirmada'
        };
      }

      return { shouldClose: false, reason: 'Nenhum sinal crítico detectado' };

    } catch (error) {
      this.logger.error(`❌ Erro ao verificar fechamento de trade ${tradeId}:`, error);
      return { shouldClose: false, reason: 'Erro na análise' };
    }
  }

  /**
   * Obtém símbolos ativos para monitoramento
   */
  private async getActiveSymbols(): Promise<string[]> {
    try {
      // Mock supabase para desenvolvimento
      console.log('📊 Obtendo símbolos ativos para monitoramento');
      return ['BTCUSDT', 'ETHUSDT']; // Fallback para desenvolvimento
    } catch (error) {
      this.logger.warn('⚠️ Erro ao obter símbolos ativos, usando fallback:', error.message);
      return ['BTCUSDT', 'ETHUSDT'];
    }
  }

  /**
   * Log da análise
   */
  private logAnalysis(symbol: string, trendAnalysis: TrendAnalysis, whaleActivity: WhaleActivity, alerts: MarketAlert[], recommendations: MonitoringRecommendation): void {
    if (alerts.length > 0 || whaleActivity.level !== WhaleActivityLevel.LOW) {
      this.logger.log(`📊 ${symbol}: Tendência=${trendAnalysis.direction}, Força=${trendAnalysis.strength.toFixed(2)}, Reversão=${trendAnalysis.reversalProbability.toFixed(2)}`);
      this.logger.log(`🐋 ${symbol}: Atividade=${whaleActivity.level}, Manipulação=${whaleActivity.manipulationSignal}, Confiança=${whaleActivity.confidence.toFixed(2)}`);
      
      if (alerts.length > 0) {
        this.logger.warn(`🚨 ${symbol}: ${alerts.length} alerta(s) - ${alerts.map(a => a.type).join(', ')}`);
      }
      
      this.logger.log(`🎯 ${symbol}: Ação recomendada = ${recommendations.finalAction}`);
    }
  }

  // Métodos auxiliares matemáticos
  private calculateMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / slice.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMA(values, values.length);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMA(values, values.length);
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private calculateSlope(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateDifferences(values: number[]): number[] {
    return values.slice(1).map((val, i) => val - values[i]);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const meanX = this.calculateMA(x, x.length);
    const meanY = this.calculateMA(y, y.length);
    
    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;
    
    for (let i = 0; i < x.length; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      sumXSquared += diffX * diffX;
      sumYSquared += diffY * diffY;
    }
    
    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateRSI(prices: number[], period: number = 14): number[] {
    if (prices.length < period + 1) return [];
    
    const deltas = this.calculateDifferences(prices);
    const gains = deltas.map(delta => delta > 0 ? delta : 0);
    const losses = deltas.map(delta => delta < 0 ? -delta : 0);
    
    const rsiValues: number[] = [];
    
    for (let i = period; i <= gains.length; i++) {
      const avgGain = this.calculateMA(gains.slice(i - period, i), period);
      const avgLoss = this.calculateMA(losses.slice(i - period, i), period);
      
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

  private calculatePercentiles(values: number[], percentiles: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    return percentiles.map(p => {
      const index = (p / 100) * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      
      if (upper >= sorted.length) return sorted[sorted.length - 1];
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    });
  }

  private detectReversalSignals(prices: number[], volumes: number[]): number {
    if (prices.length < 10 || volumes.length < 10) return 0;
    
    let signals = 0;
    
    // Divergência entre preço e volume
    const priceChange = (prices[prices.length - 1] - prices[prices.length - 6]) / prices[prices.length - 6];
    const volumeChange = this.calculateMA(volumes.slice(-5), 5) / this.calculateMA(volumes.slice(-10, -5), 5);
    
    if ((priceChange > 0 && volumeChange < 0.8) || (priceChange < 0 && volumeChange < 0.8)) {
      signals++;
    }
    
    return signals;
  }

  private getDefaultTrendAnalysis(): TrendAnalysis {
    return {
      direction: TrendDirection.SIDEWAYS,
      strength: 0,
      confidence: 0,
      reversalProbability: 0,
      timeframe: 'insufficient_data',
      timestamp: new Date()
    };
  }

  private getDefaultWhaleActivity(): WhaleActivity {
    return {
      level: WhaleActivityLevel.LOW,
      volumeSpike: 0,
      priceImpact: 0,
      manipulationSignal: ManipulationSignal.NONE,
      confidence: 0,
      timestamp: new Date()
    };
  }
}
