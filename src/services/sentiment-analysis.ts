import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface SentimentData {
  id: string;
  symbol: string;
  timestamp: number;
  source: 'news' | 'social' | 'fear_greed' | 'market' | 'onchain';
  sentiment_score: number; // -1 to 1
  confidence: number; // 0 to 1
  text_content?: string;
  metadata: {
    author?: string;
    url?: string;
    platform?: string;
    engagement?: {
      likes: number;
      shares: number;
      comments: number;
    };
    keywords: string[];
    language: string;
  };
}

export interface SentimentAnalysisConfig {
  sources: string[];
  update_interval_ms: number;
  confidence_threshold: number;
  keywords_weight: number;
  engagement_weight: number;
  time_decay_factor: number;
  max_history_days: number;
  api_keys: {
    news_api?: string;
    twitter_api?: string;
    reddit_api?: string;
    fear_greed_api?: string;
  };
}

export interface SentimentMetrics {
  symbol: string;
  timestamp: number;
  overall_sentiment: number; // -1 to 1
  confidence: number; // 0 to 1
  source_breakdown: {
    news: { sentiment: number; confidence: number; count: number };
    social: { sentiment: number; confidence: number; count: number };
    fear_greed: { sentiment: number; confidence: number; count: number };
    market: { sentiment: number; confidence: number; count: number };
    onchain: { sentiment: number; confidence: number; count: number };
  };
  trend: {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; // 0 to 1
    duration_hours: number;
  };
  alerts: Array<{
    type: 'EXTREME_BULLISH' | 'EXTREME_BEARISH' | 'SENTIMENT_SHIFT';
    message: string;
    timestamp: number;
  }>;
}

export interface SentimentEngineStats {
  total_analyses: number;
  successful_analyses: number;
  failed_analyses: number;
  average_processing_time_ms: number;
  data_points_collected: number;
  alerts_generated: number;
  last_analysis: number;
  active_sources: number;
}

export class SentimentAnalysisEngine {
  private config: SentimentAnalysisConfig;
  private stats: SentimentEngineStats;
  private sentimentHistory: Map<string, SentimentData[]> = new Map();
  private currentMetrics: Map<string, SentimentMetrics> = new Map();
  private isRunning: boolean = false;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SentimentAnalysisConfig>) {
    this.config = {
      sources: config?.sources || ['news', 'social', 'fear_greed', 'market'],
      update_interval_ms: config?.update_interval_ms || 300000, // 5 minutes
      confidence_threshold: config?.confidence_threshold || 0.6,
      keywords_weight: config?.keywords_weight || 0.3,
      engagement_weight: config?.engagement_weight || 0.2,
      time_decay_factor: config?.time_decay_factor || 0.95,
      max_history_days: config?.max_history_days || 7,
      api_keys: config?.api_keys || {},
    };

    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_processing_time_ms: 0,
      data_points_collected: 0,
      alerts_generated: 0,
      last_analysis: 0,
      active_sources: 0,
    };

    info('Sentiment Analysis Engine initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<SentimentAnalysisConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Sentiment Analysis config updated', { newConfig });
  }

  public async startAnalysis(): Promise<void> {
    if (this.isRunning) {
      warn('Sentiment analysis is already running');
      return;
    }

    this.isRunning = true;
    info('Starting sentiment analysis engine');

    // Start periodic analysis
    this.analysisInterval = setInterval(async () => {
      try {
        await this.performAnalysis();
      } catch (err: any) {
        error('Error in periodic sentiment analysis', { error: err.message });
      }
    }, this.config.update_interval_ms);

    // Perform initial analysis
    await this.performAnalysis();
  }

  public async stopAnalysis(): Promise<void> {
    if (!this.isRunning) {
      warn('Sentiment analysis is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    info('Sentiment analysis engine stopped');
  }

  public async addSentimentData(sentimentData: SentimentData): Promise<void> {
    const symbol = sentimentData.symbol;
    
    if (!this.sentimentHistory.has(symbol)) {
      this.sentimentHistory.set(symbol, []);
    }

    this.sentimentHistory.get(symbol)!.push(sentimentData);
    this.stats.data_points_collected++;

    // Cleanup old data
    this.cleanupOldData(symbol);

    info('Sentiment data added', {
      symbol,
      source: sentimentData.source,
      sentiment: sentimentData.sentiment_score,
      confidence: sentimentData.confidence,
    });
  }

  public async analyzeSentiment(symbol: string): Promise<SentimentMetrics> {
    const startTime = Date.now();

    try {
      const sentimentData = this.sentimentHistory.get(symbol) || [];
      
      if (sentimentData.length === 0) {
        throw new Error(`No sentiment data available for ${symbol}`);
      }

      // Calculate sentiment metrics
      const metrics = this.calculateSentimentMetrics(symbol, sentimentData);
      
      // Store current metrics
      this.currentMetrics.set(symbol, metrics);

      // Check for alerts
      await this.checkForAlerts(symbol, metrics);

      // Update stats
      this.updateStats(startTime, true);

      info('Sentiment analysis completed', {
        symbol,
        overallSentiment: metrics.overall_sentiment,
        confidence: metrics.confidence,
        processingTime: `${Date.now() - startTime}ms`,
      });

      return metrics;

    } catch (err: any) {
      error('Sentiment analysis failed', { symbol, error: err.message });
      this.updateStats(startTime, false);
      throw err;
    }
  }

  private calculateSentimentMetrics(symbol: string, sentimentData: SentimentData[]): SentimentMetrics {
    const now = Date.now();
    const recentData = sentimentData.filter(d => 
      now - d.timestamp < this.config.max_history_days * 24 * 60 * 60 * 1000
    );

    // Group by source
    const sourceGroups = {
      news: recentData.filter(d => d.source === 'news'),
      social: recentData.filter(d => d.source === 'social'),
      fear_greed: recentData.filter(d => d.source === 'fear_greed'),
      market: recentData.filter(d => d.source === 'market'),
      onchain: recentData.filter(d => d.source === 'onchain'),
    };

    // Calculate source breakdown
    const sourceBreakdown = {
      news: this.calculateSourceMetrics(sourceGroups.news),
      social: this.calculateSourceMetrics(sourceGroups.social),
      fear_greed: this.calculateSourceMetrics(sourceGroups.fear_greed),
      market: this.calculateSourceMetrics(sourceGroups.market),
      onchain: this.calculateSourceMetrics(sourceGroups.onchain),
    };

    // Calculate overall sentiment
    const overallSentiment = this.calculateOverallSentiment(sourceBreakdown);

    // Calculate trend
    const trend = this.calculateTrend(symbol, recentData);

    // Generate alerts
    const alerts = this.generateAlerts(symbol, overallSentiment, trend);

    return {
      symbol,
      timestamp: now,
      overall_sentiment: overallSentiment.sentiment,
      confidence: overallSentiment.confidence,
      source_breakdown: sourceBreakdown,
      trend,
      alerts,
    };
  }

  private calculateSourceMetrics(data: SentimentData[]): { sentiment: number; confidence: number; count: number } {
    if (data.length === 0) {
      return { sentiment: 0, confidence: 0, count: 0 };
    }

    // Apply time decay
    const now = Date.now();
    const weightedSentiment = data.reduce((sum, d) => {
      const timeDecay = Math.pow(this.config.time_decay_factor, (now - d.timestamp) / (60 * 60 * 1000)); // Decay per hour
      const weight = d.confidence * timeDecay;
      return sum + (d.sentiment_score * weight);
    }, 0);

    const totalWeight = data.reduce((sum, d) => {
      const timeDecay = Math.pow(this.config.time_decay_factor, (now - d.timestamp) / (60 * 60 * 1000));
      return sum + (d.confidence * timeDecay);
    }, 0);

    const sentiment = totalWeight > 0 ? weightedSentiment / totalWeight : 0;
    const confidence = Math.min(totalWeight / data.length, 1);

    return {
      sentiment,
      confidence,
      count: data.length,
    };
  }

  private calculateOverallSentiment(sourceBreakdown: any): { sentiment: number; confidence: number } {
    const sources = Object.values(sourceBreakdown) as Array<{ sentiment: number; confidence: number; count: number }>;
    
    const weightedSentiment = sources.reduce((sum, source) => {
      return sum + (source.sentiment * source.confidence * source.count);
    }, 0);

    const totalWeight = sources.reduce((sum, source) => {
      return sum + (source.confidence * source.count);
    }, 0);

    const sentiment = totalWeight > 0 ? weightedSentiment / totalWeight : 0;
    const confidence = Math.min(totalWeight / sources.length, 1);

    return { sentiment, confidence };
  }

  private calculateTrend(symbol: string, recentData: SentimentData[]): SentimentMetrics['trend'] {
    if (recentData.length < 2) {
      return { direction: 'NEUTRAL', strength: 0, duration_hours: 0 };
    }

    // Sort by timestamp
    const sortedData = recentData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate sentiment change over time
    const timeWindow = 6; // 6 hours
    const now = Date.now();
    const recentWindow = sortedData.filter(d => now - d.timestamp < timeWindow * 60 * 60 * 1000);
    const olderWindow = sortedData.filter(d => {
      const age = now - d.timestamp;
      return age >= timeWindow * 60 * 60 * 1000 && age < timeWindow * 2 * 60 * 60 * 1000;
    });

    if (recentWindow.length === 0 || olderWindow.length === 0) {
      return { direction: 'NEUTRAL', strength: 0, duration_hours: 0 };
    }

    const recentSentiment = recentWindow.reduce((sum, d) => sum + d.sentiment_score, 0) / recentWindow.length;
    const olderSentiment = olderWindow.reduce((sum, d) => sum + d.sentiment_score, 0) / olderWindow.length;
    
    const sentimentChange = recentSentiment - olderSentiment;
    const strength = Math.abs(sentimentChange);

    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (sentimentChange > 0.1) {
      direction = 'BULLISH';
    } else if (sentimentChange < -0.1) {
      direction = 'BEARISH';
    } else {
      direction = 'NEUTRAL';
    }

    // Calculate trend duration
    const trendStart = this.findTrendStart(sortedData, direction);
    const durationHours = trendStart ? (now - trendStart) / (60 * 60 * 1000) : 0;

    return { direction, strength, duration_hours: durationHours };
  }

  private findTrendStart(data: SentimentData[], direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): number | null {
    if (direction === 'NEUTRAL') return null;

    const threshold = direction === 'BULLISH' ? 0.1 : -0.1;
    
    for (let i = data.length - 1; i >= 0; i--) {
      if (direction === 'BULLISH' && data[i].sentiment_score < threshold) {
        return data[i].timestamp;
      } else if (direction === 'BEARISH' && data[i].sentiment_score > threshold) {
        return data[i].timestamp;
      }
    }

    return data[0]?.timestamp || null;
  }

  private generateAlerts(symbol: string, overallSentiment: { sentiment: number; confidence: number }, trend: SentimentMetrics['trend']): Array<{ type: string; message: string; timestamp: number }> {
    const alerts: Array<{ type: string; message: string; timestamp: number }> = [];
    const now = Date.now();

    // Extreme sentiment alerts
    if (overallSentiment.sentiment > 0.8 && overallSentiment.confidence > this.config.confidence_threshold) {
      alerts.push({
        type: 'EXTREME_BULLISH',
        message: `Extreme bullish sentiment detected for ${symbol} (${(overallSentiment.sentiment * 100).toFixed(1)}%)`,
        timestamp: now,
      });
      this.stats.alerts_generated++;
    }

    if (overallSentiment.sentiment < -0.8 && overallSentiment.confidence > this.config.confidence_threshold) {
      alerts.push({
        type: 'EXTREME_BEARISH',
        message: `Extreme bearish sentiment detected for ${symbol} (${(overallSentiment.sentiment * 100).toFixed(1)}%)`,
        timestamp: now,
      });
      this.stats.alerts_generated++;
    }

    // Sentiment shift alerts
    if (trend.strength > 0.3 && trend.duration_hours > 2) {
      alerts.push({
        type: 'SENTIMENT_SHIFT',
        message: `Significant sentiment shift detected for ${symbol}: ${trend.direction} trend for ${trend.duration_hours.toFixed(1)} hours`,
        timestamp: now,
      });
      this.stats.alerts_generated++;
    }

    return alerts;
  }

  private async checkForAlerts(symbol: string, metrics: SentimentMetrics): Promise<void> {
    if (metrics.alerts.length > 0) {
      for (const alert of metrics.alerts) {
        info('Sentiment alert generated', {
          symbol,
          type: alert.type,
          message: alert.message,
        });
      }
    }
  }

  private async performAnalysis(): Promise<void> {
    const symbols = Array.from(this.sentimentHistory.keys());
    
    for (const symbol of symbols) {
      try {
        await this.analyzeSentiment(symbol);
      } catch (err: any) {
        error('Failed to analyze sentiment for symbol', { symbol, error: err.message });
      }
    }
  }

  private cleanupOldData(symbol: string): void {
    const data = this.sentimentHistory.get(symbol);
    if (!data) return;

    const cutoffTime = Date.now() - (this.config.max_history_days * 24 * 60 * 60 * 1000);
    const filteredData = data.filter(d => d.timestamp > cutoffTime);
    
    this.sentimentHistory.set(symbol, filteredData);
  }

  private updateStats(startTime: number, success: boolean): void {
    const processingTime = Date.now() - startTime;
    
    this.stats.total_analyses++;
    if (success) {
      this.stats.successful_analyses++;
    } else {
      this.stats.failed_analyses++;
    }
    
    this.stats.last_analysis = Date.now();
    
    this.stats.average_processing_time_ms = 
      (this.stats.average_processing_time_ms * (this.stats.total_analyses - 1) + processingTime) / 
      this.stats.total_analyses;
  }

  public getSentimentMetrics(symbol: string): SentimentMetrics | null {
    return this.currentMetrics.get(symbol) || null;
  }

  public getAllSentimentMetrics(): Map<string, SentimentMetrics> {
    return new Map(this.currentMetrics);
  }

  public getStats(): SentimentEngineStats {
    return { ...this.stats };
  }

  public getConfig(): SentimentAnalysisConfig {
    return { ...this.config };
  }

  public clearData(): void {
    this.sentimentHistory.clear();
    this.currentMetrics.clear();
    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_processing_time_ms: 0,
      data_points_collected: 0,
      alerts_generated: 0,
      last_analysis: 0,
      active_sources: 0,
    };
    info('Sentiment Analysis Engine data cleared');
  }
}

export const sentimentAnalysisEngine = new SentimentAnalysisEngine();
