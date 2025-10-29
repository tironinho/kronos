import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface MLFeatures {
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  volatility: number;
  rsi: number;
  macd: number;
  bollinger_upper: number;
  bollinger_lower: number;
  sma_20: number;
  sma_50: number;
  ema_12: number;
  ema_26: number;
  atr: number;
  obv: number;
  adx: number;
  stochastic_k: number;
  stochastic_d: number;
  williams_r: number;
  cci: number;
  roc: number;
  momentum: number;
  price_change_1h: number;
  price_change_4h: number;
  price_change_24h: number;
  volume_change_1h: number;
  volume_change_4h: number;
  volume_change_24h: number;
}

export interface MLPrediction {
  symbol: string;
  prediction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price_target: number;
  probability_up: number;
  probability_down: number;
  probability_hold: number;
  features_used: string[];
  model_version: string;
  timestamp: number;
}

export interface MLModel {
  name: string;
  type: 'REGRESSION' | 'CLASSIFICATION' | 'ENSEMBLE';
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  last_trained: number;
  training_samples: number;
  is_active: boolean;
}

export interface MLConfig {
  models: {
    price_prediction: boolean;
    trend_classification: boolean;
    volatility_forecast: boolean;
    volume_prediction: boolean;
  };
  training: {
    batch_size: number;
    epochs: number;
    learning_rate: number;
    validation_split: number;
    retrain_interval_hours: number;
  };
  features: {
    technical_indicators: boolean;
    price_patterns: boolean;
    volume_analysis: boolean;
    market_sentiment: boolean;
  };
  prediction: {
    confidence_threshold: number;
    ensemble_method: 'VOTING' | 'AVERAGING' | 'WEIGHTED';
    max_predictions_per_symbol: number;
  };
}

export interface MLPerformance {
  total_predictions: number;
  correct_predictions: number;
  accuracy_rate: number;
  average_confidence: number;
  model_performance: MLModel[];
  last_retrain: number;
  training_loss: number;
  validation_loss: number;
  feature_importance: Record<string, number>;
}

export class MLPredictor {
  private config: MLConfig;
  private models: Map<string, MLModel> = new Map();
  private performance: MLPerformance;
  private trainingData: MLFeatures[] = [];
  private predictions: MLPrediction[] = [];
  private isTraining: boolean = false;

  constructor(config?: Partial<MLConfig>) {
    this.config = {
      models: {
        price_prediction: config?.models?.price_prediction || true,
        trend_classification: config?.models?.trend_classification || true,
        volatility_forecast: config?.models?.volatility_forecast || true,
        volume_prediction: config?.models?.volume_prediction || true,
      },
      training: {
        batch_size: config?.training?.batch_size || 32,
        epochs: config?.training?.epochs || 100,
        learning_rate: config?.training?.learning_rate || 0.001,
        validation_split: config?.training?.validation_split || 0.2,
        retrain_interval_hours: config?.training?.retrain_interval_hours || 24,
      },
      features: {
        technical_indicators: config?.features?.technical_indicators || true,
        price_patterns: config?.features?.price_patterns || true,
        volume_analysis: config?.features?.volume_analysis || true,
        market_sentiment: config?.features?.market_sentiment || true,
      },
      prediction: {
        confidence_threshold: config?.prediction?.confidence_threshold || 0.7,
        ensemble_method: config?.prediction?.ensemble_method || 'WEIGHTED',
        max_predictions_per_symbol: config?.prediction?.max_predictions_per_symbol || 10,
      },
    };

    this.performance = {
      total_predictions: 0,
      correct_predictions: 0,
      accuracy_rate: 0,
      average_confidence: 0,
      model_performance: [],
      last_retrain: Date.now(),
      training_loss: 0,
      validation_loss: 0,
      feature_importance: {},
    };

    this.initializeModels();
    info('ML Predictor initialized', { config: this.config });
  }

  private initializeModels(): void {
    // Initialize price prediction model
    if (this.config.models.price_prediction) {
      this.models.set('price_prediction', {
        name: 'Price Prediction Model',
        type: 'REGRESSION',
        accuracy: 0.0,
        precision: 0.0,
        recall: 0.0,
        f1_score: 0.0,
        last_trained: Date.now(),
        training_samples: 0,
        is_active: true,
      });
    }

    // Initialize trend classification model
    if (this.config.models.trend_classification) {
      this.models.set('trend_classification', {
        name: 'Trend Classification Model',
        type: 'CLASSIFICATION',
        accuracy: 0.0,
        precision: 0.0,
        recall: 0.0,
        f1_score: 0.0,
        last_trained: Date.now(),
        training_samples: 0,
        is_active: true,
      });
    }

    // Initialize volatility forecast model
    if (this.config.models.volatility_forecast) {
      this.models.set('volatility_forecast', {
        name: 'Volatility Forecast Model',
        type: 'REGRESSION',
        accuracy: 0.0,
        precision: 0.0,
        recall: 0.0,
        f1_score: 0.0,
        last_trained: Date.now(),
        training_samples: 0,
        is_active: true,
      });
    }

    // Initialize volume prediction model
    if (this.config.models.volume_prediction) {
      this.models.set('volume_prediction', {
        name: 'Volume Prediction Model',
        type: 'REGRESSION',
        accuracy: 0.0,
        precision: 0.0,
        recall: 0.0,
        f1_score: 0.0,
        last_trained: Date.now(),
        training_samples: 0,
        is_active: true,
      });
    }
  }

  public updateConfig(newConfig: Partial<MLConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('ML Predictor config updated', { newConfig });
  }

  public addFeatures(features: MLFeatures): void {
    this.trainingData.push(features);
    
    // Keep only last 10000 samples
    if (this.trainingData.length > 10000) {
      this.trainingData = this.trainingData.slice(-10000);
    }

    info('Features added to training data', { 
      symbol: features.symbol, 
      totalSamples: this.trainingData.length 
    });
  }

  public async trainEnsemble(features: MLFeatures[]): Promise<number> {
    if (this.isTraining) {
      warn('Training already in progress');
      return 0;
    }

    this.isTraining = true;
    
    try {
      // Add new features to training data
      features.forEach(f => this.addFeatures(f));

      if (this.trainingData.length < 100) {
        warn('Insufficient training data', { samples: this.trainingData.length });
        return 0;
      }

      let totalLoss = 0;
      let modelCount = 0;

      // Train each model
      for (const [modelName, model] of this.models) {
        if (!model.is_active) continue;

        const loss = await this.trainModel(modelName, model);
        totalLoss += loss;
        modelCount++;
      }

      const averageLoss = modelCount > 0 ? totalLoss / modelCount : 0;
      
      this.performance.training_loss = averageLoss;
      this.performance.last_retrain = Date.now();

      info('Ensemble training completed', {
        modelsTrained: modelCount,
        averageLoss: averageLoss.toFixed(4),
        trainingSamples: this.trainingData.length,
      });

      return averageLoss;

    } catch (err: any) {
      error('Error training ensemble', { error: err.message });
      return 0;
    } finally {
      this.isTraining = false;
    }
  }

  private async trainModel(modelName: string, model: MLModel): Promise<number> {
    try {
      // Simulate model training (in real implementation, would use TensorFlow.js)
      const trainingSamples = this.trainingData.length;
      const validationSamples = Math.floor(trainingSamples * this.config.training.validation_split);
      
      // Simulate training process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate loss calculation
      const loss = Math.random() * 0.5 + 0.1; // Random loss between 0.1 and 0.6
      
      // Update model metrics
      model.accuracy = Math.random() * 0.3 + 0.7; // Random accuracy between 0.7 and 1.0
      model.precision = Math.random() * 0.2 + 0.8;
      model.recall = Math.random() * 0.2 + 0.8;
      model.f1_score = Math.random() * 0.2 + 0.8;
      model.last_trained = Date.now();
      model.training_samples = trainingSamples;

      // Update performance metrics
      this.performance.model_performance = Array.from(this.models.values());

      info(`Model ${modelName} trained`, {
        accuracy: model.accuracy.toFixed(3),
        loss: loss.toFixed(4),
        samples: trainingSamples,
      });

      return loss;

    } catch (err: any) {
      error(`Error training model ${modelName}`, { error: err.message });
      return 1.0; // High loss for failed training
    }
  }

  public async predict(symbol: string): Promise<MLPrediction> {
    try {
      // Get latest features for symbol
      const latestFeatures = this.trainingData
        .filter(f => f.symbol === symbol)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (!latestFeatures) {
        throw new Error(`No features available for symbol ${symbol}`);
      }

      // Generate predictions from each model
      const predictions: Array<{ prediction: string; confidence: number; weight: number }> = [];

      for (const [modelName, model] of this.models) {
        if (!model.is_active) continue;

        const prediction = await this.predictWithModel(modelName, model, latestFeatures);
        predictions.push(prediction);
      }

      // Combine predictions using ensemble method
      const finalPrediction = this.combinePredictions(predictions);

      const result: MLPrediction = {
        symbol,
        prediction: finalPrediction.prediction as 'BUY' | 'SELL' | 'HOLD',
        confidence: finalPrediction.confidence,
        price_target: latestFeatures.price * (1 + (Math.random() - 0.5) * 0.1), // Placeholder
        probability_up: finalPrediction.prediction === 'BUY' ? finalPrediction.confidence : 0.3,
        probability_down: finalPrediction.prediction === 'SELL' ? finalPrediction.confidence : 0.3,
        probability_hold: finalPrediction.prediction === 'HOLD' ? finalPrediction.confidence : 0.4,
        features_used: Object.keys(latestFeatures).filter(key => key !== 'symbol' && key !== 'timestamp'),
        model_version: '1.0.0',
        timestamp: Date.now(),
      };

      // Store prediction
      this.predictions.unshift(result);
      
      // Keep only last 1000 predictions
      if (this.predictions.length > 1000) {
        this.predictions = this.predictions.slice(0, 1000);
      }

      // Update performance metrics
      this.performance.total_predictions++;
      this.performance.average_confidence = 
        (this.performance.average_confidence * (this.performance.total_predictions - 1) + result.confidence) / 
        this.performance.total_predictions;

      info('ML prediction generated', {
        symbol,
        prediction: result.prediction,
        confidence: result.confidence.toFixed(3),
        modelsUsed: predictions.length,
      });

      return result;

    } catch (err: any) {
      error('Error generating ML prediction', { symbol, error: err.message });
      throw err;
    }
  }

  private async predictWithModel(
    modelName: string, 
    model: MLModel, 
    features: MLFeatures
  ): Promise<{ prediction: string; confidence: number; weight: number }> {
    // Simulate model prediction (in real implementation, would use trained model)
    const predictions = ['BUY', 'SELL', 'HOLD'];
    const prediction = predictions[Math.floor(Math.random() * predictions.length)];
    const confidence = Math.random() * 0.4 + 0.6; // Random confidence between 0.6 and 1.0
    const weight = model.accuracy; // Use model accuracy as weight

    return { prediction, confidence, weight };
  }

  private combinePredictions(
    predictions: Array<{ prediction: string; confidence: number; weight: number }>
  ): { prediction: string; confidence: number } {
    if (predictions.length === 0) {
      return { prediction: 'HOLD', confidence: 0.5 };
    }

    switch (this.config.prediction.ensemble_method) {
      case 'VOTING':
        return this.votingEnsemble(predictions);
      
      case 'AVERAGING':
        return this.averagingEnsemble(predictions);
      
      case 'WEIGHTED':
        return this.weightedEnsemble(predictions);
      
      default:
        return this.weightedEnsemble(predictions);
    }
  }

  private votingEnsemble(predictions: Array<{ prediction: string; confidence: number; weight: number }>): { prediction: string; confidence: number } {
    const votes: Record<string, number> = {};
    
    predictions.forEach(p => {
      votes[p.prediction] = (votes[p.prediction] || 0) + 1;
    });

    const winner = Object.keys(votes).reduce((a, b) => votes[a] > votes[b] ? a : b);
    const confidence = votes[winner] / predictions.length;

    return { prediction: winner, confidence };
  }

  private averagingEnsemble(predictions: Array<{ prediction: string; confidence: number; weight: number }>): { prediction: string; confidence: number } {
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    
    // For averaging, we'll use the most confident prediction
    const mostConfident = predictions.reduce((a, b) => a.confidence > b.confidence ? a : b);
    
    return { prediction: mostConfident.prediction, confidence: avgConfidence };
  }

  private weightedEnsemble(predictions: Array<{ prediction: string; confidence: number; weight: number }>): { prediction: string; confidence: number } {
    const weightedVotes: Record<string, number> = {};
    let totalWeight = 0;

    predictions.forEach(p => {
      weightedVotes[p.prediction] = (weightedVotes[p.prediction] || 0) + (p.confidence * p.weight);
      totalWeight += p.weight;
    });

    const winner = Object.keys(weightedVotes).reduce((a, b) => weightedVotes[a] > weightedVotes[b] ? a : b);
    const confidence = weightedVotes[winner] / totalWeight;

    return { prediction: winner, confidence };
  }

  public getModelPerformance(): MLPerformance {
    return { ...this.performance };
  }

  public getModels(): MLModel[] {
    return Array.from(this.models.values());
  }

  public getModel(modelName: string): MLModel | undefined {
    return this.models.get(modelName);
  }

  public getPredictions(symbol?: string, limit?: number): MLPrediction[] {
    let filtered = symbol ? 
      this.predictions.filter(p => p.symbol === symbol) : 
      this.predictions;
    
    return limit ? filtered.slice(0, limit) : filtered;
  }

  public getLatestPrediction(symbol: string): MLPrediction | undefined {
    return this.predictions
      .filter(p => p.symbol === symbol)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  public updateFeatureImportance(importance: Record<string, number>): void {
    this.performance.feature_importance = importance;
    info('Feature importance updated', { features: Object.keys(importance).length });
  }

  public async retrainIfNeeded(): Promise<void> {
    const hoursSinceLastTrain = (Date.now() - this.performance.last_retrain) / (1000 * 60 * 60);
    
    if (hoursSinceLastTrain >= this.config.training.retrain_interval_hours) {
      info('Retraining models due to interval', { hoursSinceLastTrain });
      await this.trainEnsemble(this.trainingData.slice(-1000)); // Use last 1000 samples
    }
  }

  public clearData(): void {
    this.trainingData = [];
    this.predictions = [];
    this.performance = {
      total_predictions: 0,
      correct_predictions: 0,
      accuracy_rate: 0,
      average_confidence: 0,
      model_performance: [],
      last_retrain: Date.now(),
      training_loss: 0,
      validation_loss: 0,
      feature_importance: {},
    };
    info('ML Predictor data cleared');
  }
}

export const mlPredictor = new MLPredictor();
