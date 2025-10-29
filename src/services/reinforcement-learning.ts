import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';
import { TradingSignal } from '../types';

export interface RLState {
  id: string;
  timestamp: number;
  symbol: string;
  price: number;
  volume: number;
  technical_indicators: {
    rsi: number;
    macd: number;
    sma_20: number;
    sma_50: number;
    bollinger_position: number; // 0 to 1
    volume_ratio: number;
    price_change_1h: number;
    price_change_4h: number;
    price_change_24h: number;
  };
  market_context: {
    volatility: number;
    trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    market_cap_rank: number;
    volume_rank: number;
    sentiment_score: number;
  };
  portfolio_state: {
    current_position: number; // -1 to 1
    available_capital: number;
    total_equity: number;
    unrealized_pnl: number;
    risk_level: number; // 0 to 1
  };
}

export interface RLAction {
  id: string;
  timestamp: number;
  symbol: string;
  action_type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0 to 1
  position_size: number; // -1 to 1
  stop_loss: number;
  take_profit: number;
  reasoning: string;
  metadata: {
    q_value?: number;
    policy_probability?: number;
    exploration_rate?: number;
  };
}

export interface RLExperience {
  id: string;
  timestamp: number;
  state: RLState;
  action: RLAction;
  reward: number;
  next_state: RLState;
  done: boolean;
  metadata: {
    episode_id: string;
    step_number: number;
    total_reward: number;
  };
}

export interface RLConfig {
  learning_rate: number;
  discount_factor: number;
  exploration_rate: number;
  exploration_decay: number;
  min_exploration_rate: number;
  memory_size: number;
  batch_size: number;
  target_update_frequency: number;
  network_layers: number[];
  activation_function: 'relu' | 'tanh' | 'sigmoid';
  optimizer: 'adam' | 'sgd' | 'rmsprop';
  loss_function: 'mse' | 'huber' | 'mae';
  training_frequency: number; // episodes
  evaluation_frequency: number; // episodes
  max_episode_length: number;
  reward_scaling: number;
}

export interface RLAgentStats {
  total_episodes: number;
  total_steps: number;
  average_reward: number;
  best_reward: number;
  worst_reward: number;
  current_exploration_rate: number;
  training_loss: number;
  evaluation_score: number;
  last_training: number;
  last_evaluation: number;
  memory_usage: number;
  model_updates: number;
}

export class RLAgent {
  private config: RLConfig;
  private stats: RLAgentStats;
  private experienceMemory: RLExperience[] = [];
  private currentEpisode: string | null = null;
  private episodeStep: number = 0;
  private totalReward: number = 0;
  private isTraining: boolean = false;
  private model: any = null; // Placeholder for neural network model

  constructor(config?: Partial<RLConfig>) {
    this.config = {
      learning_rate: config?.learning_rate || 0.001,
      discount_factor: config?.discount_factor || 0.95,
      exploration_rate: config?.exploration_rate || 0.1,
      exploration_decay: config?.exploration_decay || 0.995,
      min_exploration_rate: config?.min_exploration_rate || 0.01,
      memory_size: config?.memory_size || 10000,
      batch_size: config?.batch_size || 32,
      target_update_frequency: config?.target_update_frequency || 100,
      network_layers: config?.network_layers || [128, 64, 32],
      activation_function: config?.activation_function || 'relu',
      optimizer: config?.optimizer || 'adam',
      loss_function: config?.loss_function || 'mse',
      training_frequency: config?.training_frequency || 10,
      evaluation_frequency: config?.evaluation_frequency || 50,
      max_episode_length: config?.max_episode_length || 1000,
      reward_scaling: config?.reward_scaling || 1.0,
    };

    this.stats = {
      total_episodes: 0,
      total_steps: 0,
      average_reward: 0,
      best_reward: -Infinity,
      worst_reward: Infinity,
      current_exploration_rate: this.config.exploration_rate,
      training_loss: 0,
      evaluation_score: 0,
      last_training: 0,
      last_evaluation: 0,
      memory_usage: 0,
      model_updates: 0,
    };

    this.initializeModel();
    info('RL Agent initialized', { config: this.config });
  }

  private initializeModel(): void {
    // Placeholder for neural network initialization
    // In a real implementation, this would initialize TensorFlow.js models
    this.model = {
      layers: this.config.network_layers,
      activation: this.config.activation_function,
      optimizer: this.config.optimizer,
      loss: this.config.loss_function,
    };
    
    info('Neural network model initialized', { model: this.model });
  }

  public updateConfig(newConfig: Partial<RLConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.stats.current_exploration_rate = this.config.exploration_rate;
    info('RL Agent config updated', { newConfig });
  }

  public async startEpisode(): Promise<string> {
    const episodeId = generateUniqueId();
    this.currentEpisode = episodeId;
    this.episodeStep = 0;
    this.totalReward = 0;

    info('RL episode started', { episodeId });
    return episodeId;
  }

  public async endEpisode(): Promise<void> {
    if (!this.currentEpisode) {
      warn('No active episode to end');
      return;
    }

    this.stats.total_episodes++;
    this.stats.average_reward = 
      (this.stats.average_reward * (this.stats.total_episodes - 1) + this.totalReward) / 
      this.stats.total_episodes;

    if (this.totalReward > this.stats.best_reward) {
      this.stats.best_reward = this.totalReward;
    }
    if (this.totalReward < this.stats.worst_reward) {
      this.stats.worst_reward = this.totalReward;
    }

    // Decay exploration rate
    this.stats.current_exploration_rate = Math.max(
      this.config.min_exploration_rate,
      this.stats.current_exploration_rate * this.config.exploration_decay
    );

    info('RL episode ended', {
      episodeId: this.currentEpisode,
      totalReward: this.totalReward,
      steps: this.episodeStep,
      explorationRate: this.stats.current_exploration_rate,
    });

    this.currentEpisode = null;
    this.episodeStep = 0;
    this.totalReward = 0;

    // Check if training is needed
    if (this.stats.total_episodes % this.config.training_frequency === 0) {
      await this.train();
    }

    // Check if evaluation is needed
    if (this.stats.total_episodes % this.config.evaluation_frequency === 0) {
      await this.evaluate();
    }
  }

  public async selectAction(state: RLState): Promise<RLAction> {
    if (!this.currentEpisode) {
      throw new Error('No active episode. Call startEpisode() first.');
    }

    this.episodeStep++;

    // Check if episode should end
    if (this.episodeStep >= this.config.max_episode_length) {
      await this.endEpisode();
      await this.startEpisode();
    }

    // Select action using epsilon-greedy policy
    const shouldExplore = Math.random() < this.stats.current_exploration_rate;
    
    let action: RLAction;
    
    if (shouldExplore) {
      action = this.exploreAction(state);
    } else {
      action = await this.exploitAction(state);
    }

    info('RL action selected', {
      episodeId: this.currentEpisode,
      step: this.episodeStep,
      action: action.action_type,
      confidence: action.confidence,
      exploration: shouldExplore,
    });

    return action;
  }

  private exploreAction(state: RLState): RLAction {
    // Random exploration
    const actionTypes: ('BUY' | 'SELL' | 'HOLD')[] = ['BUY', 'SELL', 'HOLD'];
    const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
    
    const positionSize = Math.random() * 2 - 1; // -1 to 1
    const confidence = Math.random() * 0.5 + 0.3; // 0.3 to 0.8 for exploration

    return {
      id: generateUniqueId(),
      timestamp: Date.now(),
      symbol: state.symbol,
      action_type: actionType,
      confidence,
      position_size: positionSize,
      stop_loss: state.price * (actionType === 'BUY' ? 0.98 : 1.02),
      take_profit: state.price * (actionType === 'BUY' ? 1.04 : 0.96),
      reasoning: 'Random exploration',
      metadata: {
        exploration_rate: this.stats.current_exploration_rate,
      },
    };
  }

  private async exploitAction(state: RLState): Promise<RLAction> {
    // Use neural network to select best action
    const qValues = await this.predictQValues(state);
    const bestActionIndex = qValues.indexOf(Math.max(...qValues));
    
    const actionTypes: ('BUY' | 'SELL' | 'HOLD')[] = ['BUY', 'SELL', 'HOLD'];
    const actionType = actionTypes[bestActionIndex];
    
    // Calculate position size based on confidence and market conditions
    const baseConfidence = Math.min(qValues[bestActionIndex], 1.0);
    const marketConfidence = this.calculateMarketConfidence(state);
    const confidence = (baseConfidence + marketConfidence) / 2;
    
    const positionSize = this.calculatePositionSize(state, confidence);
    
    const stopLoss = this.calculateStopLoss(state, actionType);
    const takeProfit = this.calculateTakeProfit(state, actionType);

    return {
      id: generateUniqueId(),
      timestamp: Date.now(),
      symbol: state.symbol,
      action_type: actionType,
      confidence,
      position_size: positionSize,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      reasoning: this.generateReasoning(state, actionType, confidence),
      metadata: {
        q_value: qValues[bestActionIndex],
        policy_probability: confidence,
        exploration_rate: this.stats.current_exploration_rate,
      },
    };
  }

  private async predictQValues(state: RLState): Promise<number[]> {
    // Placeholder for neural network prediction
    // In a real implementation, this would use TensorFlow.js to predict Q-values
    
    const stateVector = this.stateToVector(state);
    
    // Simulate neural network output
    const qValues = [
      Math.random() * 2 - 1, // BUY
      Math.random() * 2 - 1, // SELL
      Math.random() * 2 - 1, // HOLD
    ];

    return qValues;
  }

  private stateToVector(state: RLState): number[] {
    return [
      state.price,
      state.volume,
      state.technical_indicators.rsi,
      state.technical_indicators.macd,
      state.technical_indicators.sma_20,
      state.technical_indicators.sma_50,
      state.technical_indicators.bollinger_position,
      state.technical_indicators.volume_ratio,
      state.technical_indicators.price_change_1h,
      state.technical_indicators.price_change_4h,
      state.technical_indicators.price_change_24h,
      state.market_context.volatility,
      state.market_context.sentiment_score,
      state.portfolio_state.current_position,
      state.portfolio_state.available_capital,
      state.portfolio_state.total_equity,
      state.portfolio_state.unrealized_pnl,
      state.portfolio_state.risk_level,
    ];
  }

  private calculateMarketConfidence(state: RLState): number {
    let confidence = 0.5; // Base confidence

    // RSI confidence
    if (state.technical_indicators.rsi < 30 || state.technical_indicators.rsi > 70) {
      confidence += 0.1;
    }

    // MACD confidence
    if (Math.abs(state.technical_indicators.macd) > 0.01) {
      confidence += 0.1;
    }

    // Trend confidence
    if (state.market_context.trend_direction !== 'SIDEWAYS') {
      confidence += 0.1;
    }

    // Volume confidence
    if (state.technical_indicators.volume_ratio > 1.5) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private calculatePositionSize(state: RLState, confidence: number): number {
    const baseSize = confidence * 0.5; // Max 50% position
    const riskAdjustment = 1 - state.portfolio_state.risk_level;
    const volatilityAdjustment = 1 - state.market_context.volatility;
    
    return baseSize * riskAdjustment * volatilityAdjustment;
  }

  private calculateStopLoss(state: RLState, actionType: string): number {
    const atrMultiplier = 2.0;
    const atr = state.market_context.volatility * state.price;
    
    if (actionType === 'BUY') {
      return state.price - (atr * atrMultiplier);
    } else if (actionType === 'SELL') {
      return state.price + (atr * atrMultiplier);
    }
    
    return state.price;
  }

  private calculateTakeProfit(state: RLState, actionType: string): number {
    const atrMultiplier = 3.0;
    const atr = state.market_context.volatility * state.price;
    
    if (actionType === 'BUY') {
      return state.price + (atr * atrMultiplier);
    } else if (actionType === 'SELL') {
      return state.price - (atr * atrMultiplier);
    }
    
    return state.price;
  }

  private generateReasoning(state: RLState, actionType: string, confidence: number): string {
    const reasons = [];
    
    if (state.technical_indicators.rsi < 30) {
      reasons.push('Oversold conditions');
    } else if (state.technical_indicators.rsi > 70) {
      reasons.push('Overbought conditions');
    }
    
    if (state.technical_indicators.macd > 0) {
      reasons.push('Bullish MACD');
    } else if (state.technical_indicators.macd < 0) {
      reasons.push('Bearish MACD');
    }
    
    if (state.market_context.trend_direction === 'UP') {
      reasons.push('Uptrend');
    } else if (state.market_context.trend_direction === 'DOWN') {
      reasons.push('Downtrend');
    }
    
    if (state.technical_indicators.volume_ratio > 1.5) {
      reasons.push('High volume');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Technical analysis';
  }

  public async addExperience(experience: RLExperience): Promise<void> {
    this.experienceMemory.push(experience);
    this.stats.total_steps++;
    this.totalReward += experience.reward;

    // Limit memory size
    if (this.experienceMemory.length > this.config.memory_size) {
      this.experienceMemory.shift();
    }

    this.stats.memory_usage = this.experienceMemory.length;

    info('RL experience added', {
      episodeId: experience.metadata.episode_id,
      step: experience.metadata.step_number,
      reward: experience.reward,
      totalReward: experience.metadata.total_reward,
    });
  }

  private async train(): Promise<void> {
    if (this.experienceMemory.length < this.config.batch_size) {
      return;
    }

    this.isTraining = true;
    const startTime = Date.now();

    try {
      // Sample batch from experience memory
      const batch = this.sampleBatch(this.config.batch_size);
      
      // Calculate target Q-values
      const targets = batch.map(exp => {
        const reward = exp.reward * this.config.reward_scaling;
        const nextQValues = this.predictQValues(exp.next_state);
        const maxNextQ = Math.max(...nextQValues);
        const target = reward + (exp.done ? 0 : this.config.discount_factor * maxNextQ);
        return target;
      });

      // Update neural network (placeholder)
      const loss = this.updateModel(batch, targets);
      this.stats.training_loss = loss;
      this.stats.model_updates++;
      this.stats.last_training = Date.now();

      info('RL model trained', {
        batchSize: batch.length,
        loss: loss.toFixed(6),
        modelUpdates: this.stats.model_updates,
        trainingTime: `${Date.now() - startTime}ms`,
      });

    } catch (err: any) {
      error('RL training failed', { error: err.message });
    } finally {
      this.isTraining = false;
    }
  }

  private sampleBatch(size: number): RLExperience[] {
    const batch: RLExperience[] = [];
    const memorySize = this.experienceMemory.length;
    
    for (let i = 0; i < size; i++) {
      const randomIndex = Math.floor(Math.random() * memorySize);
      batch.push(this.experienceMemory[randomIndex]);
    }
    
    return batch;
  }

  private updateModel(batch: RLExperience[], targets: number[]): number {
    // Placeholder for neural network update
    // In a real implementation, this would use TensorFlow.js to update the model
    
    const loss = Math.random() * 0.1; // Simulate training loss
    return loss;
  }

  private async evaluate(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Evaluate agent performance on recent experiences
      const recentExperiences = this.experienceMemory.slice(-100);
      const totalReward = recentExperiences.reduce((sum, exp) => sum + exp.reward, 0);
      const averageReward = totalReward / recentExperiences.length;
      
      this.stats.evaluation_score = averageReward;
      this.stats.last_evaluation = Date.now();

      info('RL agent evaluated', {
        evaluationScore: averageReward.toFixed(4),
        recentExperiences: recentExperiences.length,
        evaluationTime: `${Date.now() - startTime}ms`,
      });

    } catch (err: any) {
      error('RL evaluation failed', { error: err.message });
    }
  }

  public getStats(): RLAgentStats {
    return { ...this.stats };
  }

  public getConfig(): RLConfig {
    return { ...this.config };
  }

  public clearData(): void {
    this.experienceMemory = [];
    this.currentEpisode = null;
    this.episodeStep = 0;
    this.totalReward = 0;
    this.stats = {
      total_episodes: 0,
      total_steps: 0,
      average_reward: 0,
      best_reward: -Infinity,
      worst_reward: Infinity,
      current_exploration_rate: this.config.exploration_rate,
      training_loss: 0,
      evaluation_score: 0,
      last_training: 0,
      last_evaluation: 0,
      memory_usage: 0,
      model_updates: 0,
    };
    info('RL Agent data cleared');
  }
}

export const rlAgent = new RLAgent();
