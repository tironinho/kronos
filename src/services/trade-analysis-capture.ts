import { createClient } from '@supabase/supabase-js';
import { logger, logSupabase } from './logger';

export interface TechnicalAnalysisParams {
  rsi?: number;
  macd?: {
    signal: number;
    histogram: number;
  };
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
  volumeRatio?: number;
  priceChange24h?: number;
  supportLevel?: number;
  resistanceLevel?: number;
}

export interface PredictiveV2Params {
  signal: string;
  confidence: number;
  weightedScore: number;
  technicalScore: number;
  sentimentScore: number;
  onchainScore: number;
  derivativesScore: number;
  macroScore: number;
  smartMoneyScore: number;
  newsScore: number;
  fundamentalScore: number;
}

export interface HFTParams {
  vwap?: number;
  meanReversionSignal?: string;
  confirmationsCount?: number;
  confirmationsScore?: number;
  volumeAnalysis?: string;
  atr?: number;
  positionSize?: number;
  volatilityAdjustment?: number;
  atrAdjustment?: number;
}

export interface RiskParams {
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  leverage: number;
  marginRequired: number;
  maxLoss: number;
  riskRewardRatio: number;
}

export interface MarketParams {
  currentPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  fundingRate?: number;
  openInterest?: number;
}

export interface DecisionParams {
  action: string;
  confidence: number;
  reason: string;
  algorithm: string;
  multipleConfirmations: boolean;
  volumeConfirmed: boolean;
  riskAcceptable: boolean;
}

export interface StructuredData {
  technicalIndicators?: any;
  sentimentData?: any;
  onchainMetrics?: any;
  derivativesData?: any;
  macroIndicators?: any;
  smartMoneyFlows?: any;
  newsSentiment?: any;
  fundamentalAnalysis?: any;
}

export interface AnalysisMetadata {
  durationMs: number;
  apiCallsCount: number;
  errorsEncountered: string[];
  warningsGenerated: string[];
}

export interface TradeAnalysisParameters {
  tradeId: string;
  symbol: string;
  technical?: TechnicalAnalysisParams;
  predictiveV2?: PredictiveV2Params;
  hft?: HFTParams;
  risk?: RiskParams;
  market?: MarketParams;
  decision?: DecisionParams;
  structuredData?: StructuredData;
  metadata?: AnalysisMetadata;
}

export class TradeAnalysisCapture {
  private supabase: any;
  private currentAnalysis: Partial<TradeAnalysisParameters> = {};
  private analysisStartTime: number = 0;
  private apiCallsCount: number = 0;
  private errorsEncountered: string[] = [];
  private warningsGenerated: string[] = [];

  constructor() {
    this.initializeSupabase();
  }

  private initializeSupabase() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ TradeAnalysisCapture: Supabase credentials not found, using fallback');
        this.supabase = null;
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      logSupabase('✅ TradeAnalysisCapture: Supabase initialized');
    } catch (error) {
      logger.error('❌ TradeAnalysisCapture: Failed to initialize Supabase:', 'SUPABASE', null, error);
      this.supabase = null;
    }
  }

  /**
   * Inicia captura de parâmetros para uma nova análise
   */
  public startAnalysis(symbol: string, tradeId?: string) {
    this.analysisStartTime = Date.now();
    this.apiCallsCount = 0;
    this.errorsEncountered = [];
    this.warningsGenerated = [];
    
    this.currentAnalysis = {
      symbol,
      tradeId: tradeId || `ANALYSIS_${Date.now()}_${symbol}`,
      metadata: {
        durationMs: 0,
        apiCallsCount: 0,
        errorsEncountered: [],
        warningsGenerated: []
      }
    };

    logger.debug(`🔍 Starting analysis capture for ${symbol}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Captura parâmetros de análise técnica
   */
  public captureTechnicalAnalysis(technical: TechnicalAnalysisParams) {
    this.currentAnalysis.technical = technical;
    logger.debug(`📊 Technical analysis captured for ${this.currentAnalysis.symbol}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Captura parâmetros de análise preditiva V2
   */
  public capturePredictiveV2(predictiveV2: PredictiveV2Params) {
    this.currentAnalysis.predictiveV2 = predictiveV2;
    logger.debug(`🧠 Predictive V2 analysis captured for ${this.currentAnalysis.symbol}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Captura parâmetros de análise HFT
   */
  public captureHFT(hft: HFTParams) {
    this.currentAnalysis.hft = hft;
    logger.debug(`⚡ HFT analysis captured for ${this.currentAnalysis.symbol}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Captura parâmetros de risco
   */
  public captureRisk(risk: RiskParams) {
    this.currentAnalysis.risk = risk;
    logger.debug(`🛡️ Risk parameters captured for ${this.currentAnalysis.symbol}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Captura parâmetros de mercado
   */
  public captureMarket(market: MarketParams) {
    this.currentAnalysis.market = market;
    logger.debug(`📈 Market parameters captured for ${this.currentAnalysis.symbol}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Captura parâmetros de decisão
   */
  public captureDecision(decision: DecisionParams) {
    this.currentAnalysis.decision = decision;
    logger.debug(`🎯 Decision parameters captured for ${this.currentAnalysis.symbol}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Captura dados estruturados
   */
  public captureStructuredData(data: StructuredData) {
    this.currentAnalysis.structuredData = data;
    logger.debug(`📋 Structured data captured for ${this.currentAnalysis.symbol}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Registra chamada de API
   */
  public recordApiCall() {
    this.apiCallsCount++;
  }

  /**
   * Registra erro encontrado
   */
  public recordError(error: string) {
    this.errorsEncountered.push(error);
    logger.warn(`⚠️ Analysis error recorded: ${error}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Registra warning gerado
   */
  public recordWarning(warning: string) {
    this.warningsGenerated.push(warning);
    logger.warn(`⚠️ Analysis warning recorded: ${warning}`, 'ANALYSIS_CAPTURE');
  }

  /**
   * Finaliza análise e salva parâmetros no banco
   */
  public async finishAnalysis(): Promise<boolean> {
    if (!this.supabase) {
      logger.warn('⚠️ TradeAnalysisCapture: Supabase not available, skipping save', 'ANALYSIS_CAPTURE');
      return false;
    }

    try {
      const durationMs = Date.now() - this.analysisStartTime;
      
      // Atualizar metadados
      if (this.currentAnalysis.metadata) {
        this.currentAnalysis.metadata.durationMs = durationMs;
        this.currentAnalysis.metadata.apiCallsCount = this.apiCallsCount;
        this.currentAnalysis.metadata.errorsEncountered = this.errorsEncountered;
        this.currentAnalysis.metadata.warningsGenerated = this.warningsGenerated;
      }

      // Preparar dados para inserção
      const analysisData = this.prepareAnalysisData();
      
      // Salvar no banco
      const { error } = await this.supabase
        .from('trade_analysis_parameters')
        .insert(analysisData);

      if (error) {
        logger.error('❌ Error saving analysis parameters:', 'ANALYSIS_CAPTURE', { error });
        return false;
      }

      logger.info(`✅ Analysis parameters saved for ${this.currentAnalysis.symbol}`, 'ANALYSIS_CAPTURE', {
        tradeId: this.currentAnalysis.tradeId,
        durationMs,
        apiCallsCount: this.apiCallsCount,
        errorsCount: this.errorsEncountered.length,
        warningsCount: this.warningsGenerated.length
      });

      // Limpar análise atual
      this.currentAnalysis = {};
      
      return true;
    } catch (error) {
      logger.error('❌ Error finishing analysis:', 'ANALYSIS_CAPTURE', null, error);
      return false;
    }
  }

  /**
   * Prepara dados para inserção no banco
   */
  private prepareAnalysisData() {
    const data: any = {
      trade_id: this.currentAnalysis.tradeId,
      symbol: this.currentAnalysis.symbol,
      analysis_timestamp: new Date().toISOString()
    };

    // Parâmetros técnicos
    if (this.currentAnalysis.technical) {
      const tech = this.currentAnalysis.technical;
      data.technical_rsi = tech.rsi;
      data.technical_macd_signal = tech.macd?.signal;
      data.technical_macd_histogram = tech.macd?.histogram;
      data.technical_bollinger_upper = tech.bollinger?.upper;
      data.technical_bollinger_middle = tech.bollinger?.middle;
      data.technical_bollinger_lower = tech.bollinger?.lower;
      data.technical_volume_ratio = tech.volumeRatio;
      data.technical_price_change_24h = tech.priceChange24h;
      data.technical_support_level = tech.supportLevel;
      data.technical_resistance_level = tech.resistanceLevel;
    }

    // Parâmetros preditivos V2
    if (this.currentAnalysis.predictiveV2) {
      const pred = this.currentAnalysis.predictiveV2;
      data.predictive_v2_signal = pred.signal;
      data.predictive_v2_confidence = pred.confidence;
      data.predictive_v2_weighted_score = pred.weightedScore;
      data.predictive_v2_technical_score = pred.technicalScore;
      data.predictive_v2_sentiment_score = pred.sentimentScore;
      data.predictive_v2_onchain_score = pred.onchainScore;
      data.predictive_v2_derivatives_score = pred.derivativesScore;
      data.predictive_v2_macro_score = pred.macroScore;
      data.predictive_v2_smart_money_score = pred.smartMoneyScore;
      data.predictive_v2_news_score = pred.newsScore;
      data.predictive_v2_fundamental_score = pred.fundamentalScore;
    }

    // Parâmetros HFT
    if (this.currentAnalysis.hft) {
      const hft = this.currentAnalysis.hft;
      data.hft_vwap = hft.vwap;
      data.hft_mean_reversion_signal = hft.meanReversionSignal;
      data.hft_confirmations_count = hft.confirmationsCount;
      data.hft_confirmations_score = hft.confirmationsScore;
      data.hft_volume_analysis = hft.volumeAnalysis;
      data.hft_atr = hft.atr;
      data.hft_position_size = hft.positionSize;
      data.hft_volatility_adjustment = hft.volatilityAdjustment;
      data.hft_atr_adjustment = hft.atrAdjustment;
    }

    // Parâmetros de risco
    if (this.currentAnalysis.risk) {
      const risk = this.currentAnalysis.risk;
      data.risk_stop_loss = risk.stopLoss;
      data.risk_take_profit = risk.takeProfit;
      data.risk_position_size = risk.positionSize;
      data.risk_leverage = risk.leverage;
      data.risk_margin_required = risk.marginRequired;
      data.risk_max_loss = risk.maxLoss;
      data.risk_reward_ratio = risk.riskRewardRatio;
    }

    // Parâmetros de mercado
    if (this.currentAnalysis.market) {
      const market = this.currentAnalysis.market;
      data.market_current_price = market.currentPrice;
      data.market_24h_high = market.high24h;
      data.market_24h_low = market.low24h;
      data.market_24h_volume = market.volume24h;
      data.market_funding_rate = market.fundingRate;
      data.market_open_interest = market.openInterest;
    }

    // Parâmetros de decisão
    if (this.currentAnalysis.decision) {
      const decision = this.currentAnalysis.decision;
      data.decision_action = decision.action;
      data.decision_confidence = decision.confidence;
      data.decision_reason = decision.reason;
      data.decision_algorithm = decision.algorithm;
      data.decision_multiple_confirmations = decision.multipleConfirmations;
      data.decision_volume_confirmed = decision.volumeConfirmed;
      data.decision_risk_acceptable = decision.riskAcceptable;
    }

    // Dados estruturados
    if (this.currentAnalysis.structuredData) {
      const structured = this.currentAnalysis.structuredData;
      data.technical_indicators = structured.technicalIndicators;
      data.sentiment_data = structured.sentimentData;
      data.onchain_metrics = structured.onchainMetrics;
      data.derivatives_data = structured.derivativesData;
      data.macro_indicators = structured.macroIndicators;
      data.smart_money_flows = structured.smartMoneyFlows;
      data.news_sentiment = structured.newsSentiment;
      data.fundamental_analysis = structured.fundamentalAnalysis;
    }

    // Metadados
    if (this.currentAnalysis.metadata) {
      const meta = this.currentAnalysis.metadata;
      data.analysis_duration_ms = meta.durationMs;
      data.api_calls_count = meta.apiCallsCount;
      data.errors_encountered = meta.errorsEncountered;
      data.warnings_generated = meta.warningsGenerated;
    }

    return data;
  }

  /**
   * Obtém parâmetros de análise de uma trade específica
   */
  public async getAnalysisParameters(tradeId: string): Promise<TradeAnalysisParameters | null> {
    if (!this.supabase) {
      logger.warn('⚠️ TradeAnalysisCapture: Supabase not available', 'ANALYSIS_CAPTURE');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('trade_analysis_parameters')
        .select('*')
        .eq('trade_id', tradeId)
        .single();

      if (error) {
        logger.error('❌ Error fetching analysis parameters:', 'ANALYSIS_CAPTURE', { error });
        return null;
      }

      return this.parseAnalysisData(data);
    } catch (error) {
      logger.error('❌ Error fetching analysis parameters:', 'ANALYSIS_CAPTURE', null, error);
      return null;
    }
  }

  /**
   * Converte dados do banco para objeto de análise
   */
  private parseAnalysisData(data: any): TradeAnalysisParameters {
    return {
      tradeId: data.trade_id,
      symbol: data.symbol,
      technical: {
        rsi: data.technical_rsi,
        macd: data.technical_macd_signal ? {
          signal: data.technical_macd_signal,
          histogram: data.technical_macd_histogram
        } : undefined,
        bollinger: data.technical_bollinger_upper ? {
          upper: data.technical_bollinger_upper,
          middle: data.technical_bollinger_middle,
          lower: data.technical_bollinger_lower
        } : undefined,
        volumeRatio: data.technical_volume_ratio,
        priceChange24h: data.technical_price_change_24h,
        supportLevel: data.technical_support_level,
        resistanceLevel: data.technical_resistance_level
      },
      predictiveV2: data.predictive_v2_signal ? {
        signal: data.predictive_v2_signal,
        confidence: data.predictive_v2_confidence,
        weightedScore: data.predictive_v2_weighted_score,
        technicalScore: data.predictive_v2_technical_score,
        sentimentScore: data.predictive_v2_sentiment_score,
        onchainScore: data.predictive_v2_onchain_score,
        derivativesScore: data.predictive_v2_derivatives_score,
        macroScore: data.predictive_v2_macro_score,
        smartMoneyScore: data.predictive_v2_smart_money_score,
        newsScore: data.predictive_v2_news_score,
        fundamentalScore: data.predictive_v2_fundamental_score
      } : undefined,
      hft: data.hft_vwap ? {
        vwap: data.hft_vwap,
        meanReversionSignal: data.hft_mean_reversion_signal,
        confirmationsCount: data.hft_confirmations_count,
        confirmationsScore: data.hft_confirmations_score,
        volumeAnalysis: data.hft_volume_analysis,
        atr: data.hft_atr,
        positionSize: data.hft_position_size,
        volatilityAdjustment: data.hft_volatility_adjustment,
        atrAdjustment: data.hft_atr_adjustment
      } : undefined,
      risk: data.risk_stop_loss ? {
        stopLoss: data.risk_stop_loss,
        takeProfit: data.risk_take_profit,
        positionSize: data.risk_position_size,
        leverage: data.risk_leverage,
        marginRequired: data.risk_margin_required,
        maxLoss: data.risk_max_loss,
        riskRewardRatio: data.risk_reward_ratio
      } : undefined,
      market: data.market_current_price ? {
        currentPrice: data.market_current_price,
        high24h: data.market_24h_high,
        low24h: data.market_24h_low,
        volume24h: data.market_24h_volume,
        fundingRate: data.market_funding_rate,
        openInterest: data.market_open_interest
      } : undefined,
      decision: data.decision_action ? {
        action: data.decision_action,
        confidence: data.decision_confidence,
        reason: data.decision_reason,
        algorithm: data.decision_algorithm,
        multipleConfirmations: data.decision_multiple_confirmations,
        volumeConfirmed: data.decision_volume_confirmed,
        riskAcceptable: data.decision_risk_acceptable
      } : undefined,
      structuredData: {
        technicalIndicators: data.technical_indicators,
        sentimentData: data.sentiment_data,
        onchainMetrics: data.onchain_metrics,
        derivativesData: data.derivatives_data,
        macroIndicators: data.macro_indicators,
        smartMoneyFlows: data.smart_money_flows,
        newsSentiment: data.news_sentiment,
        fundamentalAnalysis: data.fundamental_analysis
      },
      metadata: {
        durationMs: data.analysis_duration_ms,
        apiCallsCount: data.api_calls_count,
        errorsEncountered: data.errors_encountered || [],
        warningsGenerated: data.warnings_generated || []
      }
    };
  }

  /**
   * Obtém estatísticas de análise
   */
  public async getAnalysisStats(): Promise<any> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('trade_analysis_parameters')
        .select('symbol, predictive_v2_confidence, decision_action, analysis_duration_ms, api_calls_count');

      if (error) {
        logger.error('❌ Error fetching analysis stats:', 'ANALYSIS_CAPTURE', { error });
        return null;
      }

      return {
        totalAnalyses: data.length,
        averageConfidence: data.reduce((sum: number, item: any) => sum + (item.predictive_v2_confidence || 0), 0) / data.length,
        averageDuration: data.reduce((sum: number, item: any) => sum + (item.analysis_duration_ms || 0), 0) / data.length,
        averageApiCalls: data.reduce((sum: number, item: any) => sum + (item.api_calls_count || 0), 0) / data.length,
        actions: data.reduce((acc: any, item: any) => {
          acc[item.decision_action] = (acc[item.decision_action] || 0) + 1;
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('❌ Error fetching analysis stats:', 'ANALYSIS_CAPTURE', null, error);
      return null;
    }
  }
}

export const tradeAnalysisCapture = new TradeAnalysisCapture();
