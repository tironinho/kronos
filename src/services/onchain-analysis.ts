import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface OnChainData {
  id: string;
  symbol: string;
  timestamp: number;
  metric_type: 'transaction_count' | 'active_addresses' | 'exchange_flows' | 'whale_movements' | 'mining_data' | 'network_health' | 'defi_metrics';
  value: number;
  metadata: {
    network?: string;
    block_height?: number;
    transaction_hash?: string;
    from_address?: string;
    to_address?: string;
    amount?: number;
    fee?: number;
    gas_price?: number;
    difficulty?: number;
    hash_rate?: number;
    mining_pool?: string;
    defi_protocol?: string;
    tvl?: number;
    volume_24h?: number;
  };
}

export interface OnChainConfig {
  networks: string[];
  update_interval_ms: number;
  whale_threshold_usd: number;
  exchange_addresses: string[];
  mining_pools: string[];
  defi_protocols: string[];
  api_keys: {
    blockchain_api?: string;
    etherscan_api?: string;
    bscscan_api?: string;
    polygonscan_api?: string;
    defi_pulse_api?: string;
  };
  metrics: {
    transaction_count: boolean;
    active_addresses: boolean;
    exchange_flows: boolean;
    whale_movements: boolean;
    mining_data: boolean;
    network_health: boolean;
    defi_metrics: boolean;
  };
}

export interface OnChainMetrics {
  symbol: string;
  timestamp: number;
  network_health: {
    transaction_count_24h: number;
    active_addresses_24h: number;
    average_transaction_fee: number;
    network_congestion: number; // 0 to 1
    hash_rate: number;
    difficulty: number;
    block_time_avg: number;
  };
  exchange_flows: {
    inflow_24h: number;
    outflow_24h: number;
    net_flow_24h: number;
    inflow_count: number;
    outflow_count: number;
    top_exchanges: Array<{ name: string; flow: number; type: 'inflow' | 'outflow' }>;
  };
  whale_activity: {
    large_transactions_24h: number;
    whale_movements_24h: number;
    total_whale_volume: number;
    top_whale_transactions: Array<{
      amount: number;
      from: string;
      to: string;
      timestamp: number;
    }>;
  };
  mining_metrics: {
    hash_rate_24h: number;
    difficulty_adjustment: number;
    mining_revenue_24h: number;
    top_mining_pools: Array<{ name: string; hash_rate: number; percentage: number }>;
  };
  defi_metrics: {
    total_value_locked: number;
    volume_24h: number;
    active_protocols: number;
    top_protocols: Array<{ name: string; tvl: number; volume_24h: number }>;
  };
  alerts: Array<{
    type: 'HIGH_EXCHANGE_INFLOW' | 'HIGH_EXCHANGE_OUTFLOW' | 'WHALE_MOVEMENT' | 'NETWORK_CONGESTION' | 'MINING_DROP';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timestamp: number;
  }>;
}

export interface OnChainEngineStats {
  total_analyses: number;
  successful_analyses: number;
  failed_analyses: number;
  average_processing_time_ms: number;
  data_points_collected: number;
  alerts_generated: number;
  last_analysis: number;
  active_networks: number;
}

export class OnChainAnalysisEngine {
  private config: OnChainConfig;
  private stats: OnChainEngineStats;
  private onChainHistory: Map<string, OnChainData[]> = new Map();
  private currentMetrics: Map<string, OnChainMetrics> = new Map();
  private isRunning: boolean = false;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<OnChainConfig>) {
    this.config = {
      networks: config?.networks || ['bitcoin', 'ethereum', 'bsc', 'polygon'],
      update_interval_ms: config?.update_interval_ms || 300000, // 5 minutes
      whale_threshold_usd: config?.whale_threshold_usd || 1000000,
      exchange_addresses: config?.exchange_addresses || [],
      mining_pools: config?.mining_pools || [],
      defi_protocols: config?.defi_protocols || [],
      api_keys: config?.api_keys || {},
      metrics: {
        transaction_count: config?.metrics?.transaction_count ?? true,
        active_addresses: config?.metrics?.active_addresses ?? true,
        exchange_flows: config?.metrics?.exchange_flows ?? true,
        whale_movements: config?.metrics?.whale_movements ?? true,
        mining_data: config?.metrics?.mining_data ?? true,
        network_health: config?.metrics?.network_health ?? true,
        defi_metrics: config?.metrics?.defi_metrics ?? true,
      },
    };

    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_processing_time_ms: 0,
      data_points_collected: 0,
      alerts_generated: 0,
      last_analysis: 0,
      active_networks: 0,
    };

    info('On-Chain Analysis Engine initialized', { config: this.config });
  }

  public updateConfig(newConfig: Partial<OnChainConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('On-Chain Analysis config updated', { newConfig });
  }

  public async startAnalysis(): Promise<void> {
    if (this.isRunning) {
      warn('On-chain analysis is already running');
      return;
    }

    this.isRunning = true;
    info('Starting on-chain analysis engine');

    // Start periodic analysis
    this.analysisInterval = setInterval(async () => {
      try {
        await this.performAnalysis();
      } catch (err: any) {
        error('Error in periodic on-chain analysis', { error: err.message });
      }
    }, this.config.update_interval_ms);

    // Perform initial analysis
    await this.performAnalysis();
  }

  public async stopAnalysis(): Promise<void> {
    if (!this.isRunning) {
      warn('On-chain analysis is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    info('On-chain analysis engine stopped');
  }

  public async addOnChainData(onChainData: OnChainData): Promise<void> {
    const symbol = onChainData.symbol;
    
    if (!this.onChainHistory.has(symbol)) {
      this.onChainHistory.set(symbol, []);
    }

    this.onChainHistory.get(symbol)!.push(onChainData);
    this.stats.data_points_collected++;

    // Cleanup old data
    this.cleanupOldData(symbol);

    info('On-chain data added', {
      symbol,
      metricType: onChainData.metric_type,
      value: onChainData.value,
    });
  }

  public async analyzeOnChain(symbol: string): Promise<OnChainMetrics> {
    const startTime = Date.now();

    try {
      const onChainData = this.onChainHistory.get(symbol) || [];
      
      if (onChainData.length === 0) {
        throw new Error(`No on-chain data available for ${symbol}`);
      }

      // Calculate on-chain metrics
      const metrics = this.calculateOnChainMetrics(symbol, onChainData);
      
      // Store current metrics
      this.currentMetrics.set(symbol, metrics);

      // Check for alerts
      await this.checkForAlerts(symbol, metrics);

      // Update stats
      this.updateStats(startTime, true);

      info('On-chain analysis completed', {
        symbol,
        networkHealth: metrics.network_health.transaction_count_24h,
        exchangeFlow: metrics.exchange_flows.net_flow_24h,
        whaleActivity: metrics.whale_activity.large_transactions_24h,
        processingTime: `${Date.now() - startTime}ms`,
      });

      return metrics;

    } catch (err: any) {
      error('On-chain analysis failed', { symbol, error: err.message });
      this.updateStats(startTime, false);
      throw err;
    }
  }

  private calculateOnChainMetrics(symbol: string, onChainData: OnChainData[]): OnChainMetrics {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);
    const recentData = onChainData.filter(d => d.timestamp > last24Hours);

    // Group by metric type
    const transactionData = recentData.filter(d => d.metric_type === 'transaction_count');
    const addressData = recentData.filter(d => d.metric_type === 'active_addresses');
    const exchangeData = recentData.filter(d => d.metric_type === 'exchange_flows');
    const whaleData = recentData.filter(d => d.metric_type === 'whale_movements');
    const miningData = recentData.filter(d => d.metric_type === 'mining_data');
    const networkData = recentData.filter(d => d.metric_type === 'network_health');
    const defiData = recentData.filter(d => d.metric_type === 'defi_metrics');

    // Calculate network health
    const networkHealth = this.calculateNetworkHealth(transactionData, addressData, networkData, miningData);

    // Calculate exchange flows
    const exchangeFlows = this.calculateExchangeFlows(exchangeData);

    // Calculate whale activity
    const whaleActivity = this.calculateWhaleActivity(whaleData);

    // Calculate mining metrics
    const miningMetrics = this.calculateMiningMetrics(miningData);

    // Calculate DeFi metrics
    const defiMetrics = this.calculateDefiMetrics(defiData);

    // Generate alerts
    const alerts = this.generateAlerts(symbol, networkHealth, exchangeFlows, whaleActivity);

    return {
      symbol,
      timestamp: now,
      network_health: networkHealth,
      exchange_flows: exchangeFlows,
      whale_activity: whaleActivity,
      mining_metrics: miningMetrics,
      defi_metrics: defiMetrics,
      alerts,
    };
  }

  private calculateNetworkHealth(transactionData: OnChainData[], addressData: OnChainData[], networkData: OnChainData[], miningData: OnChainData[]): OnChainMetrics['network_health'] {
    const transactionCount24h = transactionData.reduce((sum, d) => sum + d.value, 0);
    const activeAddresses24h = addressData.reduce((sum, d) => sum + d.value, 0);
    
    // Calculate average transaction fee
    const feeData = networkData.filter(d => d.metadata.fee !== undefined);
    const averageTransactionFee = feeData.length > 0 
      ? feeData.reduce((sum, d) => sum + (d.metadata.fee || 0), 0) / feeData.length 
      : 0;

    // Calculate network congestion (simplified)
    const congestionData = networkData.filter(d => d.metadata.gas_price !== undefined);
    const networkCongestion = congestionData.length > 0 
      ? Math.min(congestionData.reduce((sum, d) => sum + (d.metadata.gas_price || 0), 0) / congestionData.length / 100, 1)
      : 0;

    // Calculate hash rate and difficulty
    const hashRateData = miningData.filter(d => d.metadata.hash_rate !== undefined);
    const hashRate = hashRateData.length > 0 
      ? hashRateData.reduce((sum, d) => sum + (d.metadata.hash_rate || 0), 0) / hashRateData.length 
      : 0;

    const difficultyData = miningData.filter(d => d.metadata.difficulty !== undefined);
    const difficulty = difficultyData.length > 0 
      ? difficultyData.reduce((sum, d) => sum + (d.metadata.difficulty || 0), 0) / difficultyData.length 
      : 0;

    // Calculate average block time (simplified)
    const blockTimeAvg = 600; // Default 10 minutes for Bitcoin, adjust based on network

    return {
      transaction_count_24h: transactionCount24h,
      active_addresses_24h: activeAddresses24h,
      average_transaction_fee: averageTransactionFee,
      network_congestion: networkCongestion,
      hash_rate: hashRate,
      difficulty: difficulty,
      block_time_avg: blockTimeAvg,
    };
  }

  private calculateExchangeFlows(exchangeData: OnChainData[]): OnChainMetrics['exchange_flows'] {
    const inflowData = exchangeData.filter(d => d.value > 0);
    const outflowData = exchangeData.filter(d => d.value < 0);

    const inflow24h = inflowData.reduce((sum, d) => sum + d.value, 0);
    const outflow24h = Math.abs(outflowData.reduce((sum, d) => sum + d.value, 0));
    const netFlow24h = inflow24h - outflow24h;

    const inflowCount = inflowData.length;
    const outflowCount = outflowData.length;

    // Calculate top exchanges
    const exchangeMap = new Map<string, { inflow: number; outflow: number }>();
    
    for (const d of exchangeData) {
      const exchange = d.metadata.to_address || 'unknown';
      if (!exchangeMap.has(exchange)) {
        exchangeMap.set(exchange, { inflow: 0, outflow: 0 });
      }
      
      if (d.value > 0) {
        exchangeMap.get(exchange)!.inflow += d.value;
      } else {
        exchangeMap.get(exchange)!.outflow += Math.abs(d.value);
      }
    }

    const topExchanges = Array.from(exchangeMap.entries())
      .map(([name, flows]) => [
        { name, flow: flows.inflow, type: 'inflow' as const },
        { name, flow: flows.outflow, type: 'outflow' as const }
      ])
      .flat()
      .sort((a, b) => b.flow - a.flow)
      .slice(0, 10);

    return {
      inflow_24h: inflow24h,
      outflow_24h: outflow24h,
      net_flow_24h: netFlow24h,
      inflow_count: inflowCount,
      outflow_count: outflowCount,
      top_exchanges: topExchanges,
    };
  }

  private calculateWhaleActivity(whaleData: OnChainData[]): OnChainMetrics['whale_activity'] {
    const largeTransactions24h = whaleData.length;
    const whaleMovements24h = whaleData.filter(d => d.value >= this.config.whale_threshold_usd).length;
    const totalWhaleVolume = whaleData.reduce((sum, d) => sum + d.value, 0);

    // Get top whale transactions
    const topWhaleTransactions = whaleData
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map(d => ({
        amount: d.value,
        from: d.metadata.from_address || 'unknown',
        to: d.metadata.to_address || 'unknown',
        timestamp: d.timestamp,
      }));

    return {
      large_transactions_24h: largeTransactions24h,
      whale_movements_24h: whaleMovements24h,
      total_whale_volume: totalWhaleVolume,
      top_whale_transactions: topWhaleTransactions,
    };
  }

  private calculateMiningMetrics(miningData: OnChainData[]): OnChainMetrics['mining_metrics'] {
    const hashRateData = miningData.filter(d => d.metadata.hash_rate !== undefined);
    const hashRate24h = hashRateData.length > 0 
      ? hashRateData.reduce((sum, d) => sum + (d.metadata.hash_rate || 0), 0) / hashRateData.length 
      : 0;

    const difficultyData = miningData.filter(d => d.metadata.difficulty !== undefined);
    const difficultyAdjustment = difficultyData.length > 1 
      ? ((difficultyData[difficultyData.length - 1].metadata.difficulty || 0) - (difficultyData[0].metadata.difficulty || 0)) / (difficultyData[0].metadata.difficulty || 1)
      : 0;

    const miningRevenue24h = miningData.reduce((sum, d) => sum + d.value, 0);

    // Calculate top mining pools
    const poolMap = new Map<string, number>();
    for (const d of miningData) {
      const pool = d.metadata.mining_pool || 'unknown';
      poolMap.set(pool, (poolMap.get(pool) || 0) + (d.metadata.hash_rate || 0));
    }

    const totalHashRate = Array.from(poolMap.values()).reduce((sum, rate) => sum + rate, 0);
    const topMiningPools = Array.from(poolMap.entries())
      .map(([name, hashRate]) => ({
        name,
        hash_rate: hashRate,
        percentage: totalHashRate > 0 ? (hashRate / totalHashRate) * 100 : 0,
      }))
      .sort((a, b) => b.hash_rate - a.hash_rate)
      .slice(0, 10);

    return {
      hash_rate_24h: hashRate24h,
      difficulty_adjustment: difficultyAdjustment,
      mining_revenue_24h: miningRevenue24h,
      top_mining_pools: topMiningPools,
    };
  }

  private calculateDefiMetrics(defiData: OnChainData[]): OnChainMetrics['defi_metrics'] {
    const tvlData = defiData.filter(d => d.metadata.tvl !== undefined);
    const totalValueLocked = tvlData.reduce((sum, d) => sum + (d.metadata.tvl || 0), 0);

    const volumeData = defiData.filter(d => d.metadata.volume_24h !== undefined);
    const volume24h = volumeData.reduce((sum, d) => sum + (d.metadata.volume_24h || 0), 0);

    const activeProtocols = new Set(defiData.map(d => d.metadata.defi_protocol).filter(Boolean)).size;

    // Calculate top protocols
    const protocolMap = new Map<string, { tvl: number; volume: number }>();
    for (const d of defiData) {
      const protocol = d.metadata.defi_protocol || 'unknown';
      if (!protocolMap.has(protocol)) {
        protocolMap.set(protocol, { tvl: 0, volume: 0 });
      }
      
      protocolMap.get(protocol)!.tvl += d.metadata.tvl || 0;
      protocolMap.get(protocol)!.volume += d.metadata.volume_24h || 0;
    }

    const topProtocols = Array.from(protocolMap.entries())
      .map(([name, metrics]) => ({
        name,
        tvl: metrics.tvl,
        volume_24h: metrics.volume,
      }))
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 10);

    return {
      total_value_locked: totalValueLocked,
      volume_24h: volume24h,
      active_protocols: activeProtocols,
      top_protocols: topProtocols,
    };
  }

  private generateAlerts(symbol: string, networkHealth: OnChainMetrics['network_health'], exchangeFlows: OnChainMetrics['exchange_flows'], whaleActivity: OnChainMetrics['whale_activity']): Array<{ type: string; message: string; severity: string; timestamp: number }> {
    const alerts: Array<{ type: string; message: string; severity: string; timestamp: number }> = [];
    const now = Date.now();

    // High exchange inflow alert
    if (exchangeFlows.inflow_24h > this.config.whale_threshold_usd * 10) {
      alerts.push({
        type: 'HIGH_EXCHANGE_INFLOW',
        message: `High exchange inflow detected for ${symbol}: ${exchangeFlows.inflow_24h.toFixed(2)} USD`,
        severity: 'HIGH',
        timestamp: now,
      });
      this.stats.alerts_generated++;
    }

    // High exchange outflow alert
    if (exchangeFlows.outflow_24h > this.config.whale_threshold_usd * 10) {
      alerts.push({
        type: 'HIGH_EXCHANGE_OUTFLOW',
        message: `High exchange outflow detected for ${symbol}: ${exchangeFlows.outflow_24h.toFixed(2)} USD`,
        severity: 'HIGH',
        timestamp: now,
      });
      this.stats.alerts_generated++;
    }

    // Whale movement alert
    if (whaleActivity.whale_movements_24h > 5) {
      alerts.push({
        type: 'WHALE_MOVEMENT',
        message: `Significant whale activity detected for ${symbol}: ${whaleActivity.whale_movements_24h} large transactions`,
        severity: 'MEDIUM',
        timestamp: now,
      });
      this.stats.alerts_generated++;
    }

    // Network congestion alert
    if (networkHealth.network_congestion > 0.8) {
      alerts.push({
        type: 'NETWORK_CONGESTION',
        message: `High network congestion detected for ${symbol}: ${(networkHealth.network_congestion * 100).toFixed(1)}%`,
        severity: 'MEDIUM',
        timestamp: now,
      });
      this.stats.alerts_generated++;
    }

    // Mining drop alert
    if (networkHealth.hash_rate < 1000000000000) { // 1 TH/s threshold
      alerts.push({
        type: 'MINING_DROP',
        message: `Significant hash rate drop detected for ${symbol}: ${(networkHealth.hash_rate / 1000000000000).toFixed(2)} TH/s`,
        severity: 'HIGH',
        timestamp: now,
      });
      this.stats.alerts_generated++;
    }

    return alerts;
  }

  private async checkForAlerts(symbol: string, metrics: OnChainMetrics): Promise<void> {
    if (metrics.alerts.length > 0) {
      for (const alert of metrics.alerts) {
        info('On-chain alert generated', {
          symbol,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
        });
      }
    }
  }

  private async performAnalysis(): Promise<void> {
    const symbols = Array.from(this.onChainHistory.keys());
    
    for (const symbol of symbols) {
      try {
        await this.analyzeOnChain(symbol);
      } catch (err: any) {
        error('Failed to analyze on-chain data for symbol', { symbol, error: err.message });
      }
    }
  }

  private cleanupOldData(symbol: string): void {
    const data = this.onChainHistory.get(symbol);
    if (!data) return;

    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const filteredData = data.filter(d => d.timestamp > cutoffTime);
    
    this.onChainHistory.set(symbol, filteredData);
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

  public getOnChainMetrics(symbol: string): OnChainMetrics | null {
    return this.currentMetrics.get(symbol) || null;
  }

  public getAllOnChainMetrics(): Map<string, OnChainMetrics> {
    return new Map(this.currentMetrics);
  }

  public getStats(): OnChainEngineStats {
    return { ...this.stats };
  }

  public getConfig(): OnChainConfig {
    return { ...this.config };
  }

  public clearData(): void {
    this.onChainHistory.clear();
    this.currentMetrics.clear();
    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_processing_time_ms: 0,
      data_points_collected: 0,
      alerts_generated: 0,
      last_analysis: 0,
      active_networks: 0,
    };
    info('On-Chain Analysis Engine data cleared');
  }
}

export const onChainAnalysisEngine = new OnChainAnalysisEngine();
