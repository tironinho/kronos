import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

export interface MonteCarloConfig {
  num_simulations: number;
  forecast_period_minutes: number;
  confidence_level: number;
  parallel_threads: number;
  volatility_factor: number;
  drift_factor: number;
}

export interface MonteCarloResult {
  id: string;
  symbol: string;
  current_price: number;
  forecast_price: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  probability_up: number;
  probability_down: number;
  expected_return: number;
  risk_score: number;
  timestamp: number;
  simulations: number;
}

export interface PerformanceMetrics {
  total_simulations: number;
  successful_predictions: number;
  accuracy_rate: number;
  average_execution_time_ms: number;
  last_update: number;
}

export class MonteCarloEngine {
  private config: MonteCarloConfig;
  private performanceMetrics: PerformanceMetrics;
  private historicalData: Map<string, PricePoint[]> = new Map();
  private results: Map<string, MonteCarloResult> = new Map();

  constructor(config?: Partial<MonteCarloConfig>) {
    this.config = {
      num_simulations: config?.num_simulations || 10000,
      forecast_period_minutes: config?.forecast_period_minutes || 60,
      confidence_level: config?.confidence_level || 0.95,
      parallel_threads: config?.parallel_threads || 4,
      volatility_factor: config?.volatility_factor || 1.0,
      drift_factor: config?.drift_factor || 0.0,
    };

    this.performanceMetrics = {
      total_simulations: 0,
      successful_predictions: 0,
      accuracy_rate: 0,
      average_execution_time_ms: 0,
      last_update: Date.now(),
    };

    info('Monte Carlo Engine initialized', { config: this.config });
  }

  public getConfig(): MonteCarloConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<MonteCarloConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Monte Carlo config updated', { newConfig });
  }

  public addHistoricalData(symbol: string, data: PricePoint[]): void {
    this.historicalData.set(symbol, data);
    info(`Added historical data for ${symbol}`, { dataPoints: data.length });
  }

  public async runSimulation(symbol: string, currentPrice: number): Promise<MonteCarloResult> {
    const startTime = Date.now();
    
    try {
      const historicalData = this.historicalData.get(symbol) || [];
      
      if (historicalData.length < 10) {
        warn(`Insufficient historical data for ${symbol}, using default simulation`);
        return this.runDefaultSimulation(symbol, currentPrice);
      }

      // Calculate historical volatility and drift
      const volatility = this.calculateVolatility(historicalData);
      const drift = this.calculateDrift(historicalData);

      // Run Monte Carlo simulations
      const simulations = await this.runSimulations(
        currentPrice,
        volatility,
        drift,
        this.config.forecast_period_minutes
      );

      // Calculate statistics
      const forecastPrice = this.calculateMean(simulations);
      const confidenceInterval = this.calculateConfidenceInterval(simulations, this.config.confidence_level);
      const probabilityUp = this.calculateProbabilityUp(simulations, currentPrice);
      const probabilityDown = 1 - probabilityUp;
      const expectedReturn = (forecastPrice - currentPrice) / currentPrice;
      const riskScore = this.calculateRiskScore(simulations, currentPrice);

      const result: MonteCarloResult = {
        id: generateUniqueId(),
        symbol,
        current_price: currentPrice,
        forecast_price: forecastPrice,
        confidence_interval: confidenceInterval,
        probability_up: probabilityUp,
        probability_down: probabilityDown,
        expected_return: expectedReturn,
        risk_score: riskScore,
        timestamp: Date.now(),
        simulations: simulations.length,
      };

      this.results.set(symbol, result);
      this.updatePerformanceMetrics(Date.now() - startTime);

      info(`Monte Carlo simulation completed for ${symbol}`, {
        forecastPrice: forecastPrice.toFixed(2),
        probabilityUp: (probabilityUp * 100).toFixed(1) + '%',
        riskScore: riskScore.toFixed(3),
      });

      return result;
    } catch (err: any) {
      error(`Monte Carlo simulation failed for ${symbol}`, { error: err.message });
      throw err;
    }
  }

  private async runSimulations(
    initialPrice: number,
    volatility: number,
    drift: number,
    periods: number
  ): Promise<number[]> {
    const simulations: number[] = [];
    const dt = 1 / (24 * 60); // 1 minute in days
    const adjustedVolatility = volatility * this.config.volatility_factor;
    const adjustedDrift = drift + this.config.drift_factor;

    // Run simulations in batches for better performance
    const batchSize = Math.ceil(this.config.num_simulations / this.config.parallel_threads);
    
    const promises: Promise<number[]>[] = [];
    
    for (let i = 0; i < this.config.parallel_threads; i++) {
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + batchSize, this.config.num_simulations);
      
      promises.push(this.runBatchSimulation(initialPrice, adjustedVolatility, adjustedDrift, dt, periods, startIdx, endIdx));
    }

    const batchResults = await Promise.all(promises);
    batchResults.forEach(batch => simulations.push(...batch));

    return simulations;
  }

  private async runBatchSimulation(
    initialPrice: number,
    volatility: number,
    drift: number,
    dt: number,
    periods: number,
    startIdx: number,
    endIdx: number
  ): Promise<number[]> {
    const simulations: number[] = [];
    
    for (let i = startIdx; i < endIdx; i++) {
      let price = initialPrice;
      
      for (let t = 0; t < periods; t++) {
        // Generate random shock
        const randomShock = this.generateRandomShock();
        
        // Geometric Brownian Motion
        const dS = price * (drift * dt + volatility * Math.sqrt(dt) * randomShock);
        price += dS;
        
        // Ensure price doesn't go negative
        price = Math.max(price, initialPrice * 0.01);
      }
      
      simulations.push(price);
    }
    
    return simulations;
  }

  private generateRandomShock(): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0;
  }

  private calculateVolatility(data: PricePoint[]): number {
    if (data.length < 2) return 0.02; // Default 2% volatility

    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const returnRate = Math.log(data[i].price / data[i - 1].price);
      returns.push(returnRate);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance * 24 * 60); // Annualized volatility
  }

  private calculateDrift(data: PricePoint[]): number {
    if (data.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const returnRate = Math.log(data[i].price / data[i - 1].price);
      returns.push(returnRate);
    }

    return returns.reduce((sum, r) => sum + r, 0) / returns.length * 24 * 60; // Annualized drift
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateConfidenceInterval(values: number[], confidenceLevel: number): { lower: number; upper: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const alpha = 1 - confidenceLevel;
    const lowerIndex = Math.floor(alpha / 2 * sorted.length);
    const upperIndex = Math.ceil((1 - alpha / 2) * sorted.length) - 1;

    return {
      lower: sorted[lowerIndex],
      upper: sorted[upperIndex],
    };
  }

  private calculateProbabilityUp(simulations: number[], currentPrice: number): number {
    const upCount = simulations.filter(price => price > currentPrice).length;
    return upCount / simulations.length;
  }

  private calculateRiskScore(simulations: number[], currentPrice: number): number {
    const returns = simulations.map(price => (price - currentPrice) / currentPrice);
    const mean = this.calculateMean(returns);
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private runDefaultSimulation(symbol: string, currentPrice: number): MonteCarloResult {
    // Default simulation with conservative parameters
    const volatility = 0.02; // 2% volatility
    const drift = 0.0; // No drift
    const simulations = Array.from({ length: 1000 }, () => {
      const randomShock = this.generateRandomShock();
      return currentPrice * (1 + volatility * randomShock);
    });

    const forecastPrice = this.calculateMean(simulations);
    const confidenceInterval = this.calculateConfidenceInterval(simulations, this.config.confidence_level);
    const probabilityUp = this.calculateProbabilityUp(simulations, currentPrice);

    return {
      id: generateUniqueId(),
      symbol,
      current_price: currentPrice,
      forecast_price: forecastPrice,
      confidence_interval: confidenceInterval,
      probability_up: probabilityUp,
      probability_down: 1 - probabilityUp,
      expected_return: (forecastPrice - currentPrice) / currentPrice,
      risk_score: this.calculateRiskScore(simulations, currentPrice),
      timestamp: Date.now(),
      simulations: simulations.length,
    };
  }

  private updatePerformanceMetrics(executionTime: number): void {
    this.performanceMetrics.total_simulations += 1;
    this.performanceMetrics.average_execution_time_ms = 
      (this.performanceMetrics.average_execution_time_ms * (this.performanceMetrics.total_simulations - 1) + executionTime) / 
      this.performanceMetrics.total_simulations;
    this.performanceMetrics.last_update = Date.now();
  }

  public getResult(symbol: string): MonteCarloResult | undefined {
    return this.results.get(symbol);
  }

  public getAllResults(): Map<string, MonteCarloResult> {
    return new Map(this.results);
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  public clearResults(): void {
    this.results.clear();
    info('Monte Carlo results cleared');
  }

  public clearHistoricalData(): void {
    this.historicalData.clear();
    info('Monte Carlo historical data cleared');
  }
}

export const monteCarloEngine = new MonteCarloEngine();
