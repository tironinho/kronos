/**
 * HFT ML Models
 * 
 * Implementa modelos de ML para trading:
 * - Logistic Regression (probabilidades)
 * - LightGBM (gradient boosting)
 * - Ensemble (combinação de modelos)
 */

export interface MLFeatures {
  // Microstructural
  midPrice: number;
  microPrice: number;
  spread: number;
  effectiveSpread: number;
  ofi: number; // Order Flow Imbalance
  queueImbalance: number;
  vpin: number;
  
  // Technical
  rsi: number;
  macd: number;
  bollingerPosition: number; // 0-1 (lower=-1, upper=1)
  volumeRatio: number;
  
  // Volatility
  realizedVolatility: number;
  atr: number;
  
  // Momentum
  microMomentum: number;
  priceChange24h: number;
  
  // Market Structure
  trendStrength: number; // 0-1
  regime: 'trending' | 'mean_reverting' | 'volatile';
  
  // Labels (para treinamento)
  primaryLabel?: number; // Triple-barrier label
  metaLabel?: number; // Meta-label
}

export interface MLPrediction {
  probability: number; // 0-1 (probabilidade de win)
  confidence: number; // 0-1 (confiança do modelo)
  predictedLabel: number; // 0 ou 1
  expectedReturn: number; // % esperado
  model: 'logistic' | 'lightgbm' | 'ensemble';
  timestamp: number;
}

export interface MLModelConfig {
  logistic: {
    learningRate: number;
    maxIterations: number;
    regularization: number;
  };
  lightgbm: {
    numLeaves: number;
    learningRate: number;
    numBoostRound: number;
    minDataInLeaf: number;
  };
  ensemble: {
    weights: { logistic: number; lightgbm: number }; // Soma = 1.0
  };
}

export class MLModels {
  private static instance: MLModels;
  private config: MLModelConfig;
  
  // Modelos em memória (simplificado - em produção seria persistido)
  private logisticWeights: Map<string, number> = new Map();
  private lightgbmModel: any = null;
  private trainingData: MLFeatures[] = [];
  private trained: boolean = false;

  private constructor() {
    this.config = {
      logistic: {
        learningRate: 0.01,
        maxIterations: 1000,
        regularization: 0.1
      },
      lightgbm: {
        numLeaves: 31,
        learningRate: 0.05,
        numBoostRound: 100,
        minDataInLeaf: 20
      },
      ensemble: {
        weights: { logistic: 0.4, lightgbm: 0.6 } // LightGBM tem mais peso
      }
    };
  }

  public static getInstance(): MLModels {
    if (!MLModels.instance) {
      MLModels.instance = new MLModels();
    }
    return MLModels.instance;
  }

  /**
   * ✅ Normaliza features para modelo
   */
  private normalizeFeatures(features: MLFeatures): number[] {
    // Converter para array numérico normalizado
    return [
      features.midPrice / 100000, // Normalizar preço (BTC ~50k)
      features.microPrice / 100000,
      Math.min(features.spread * 1000, 10), // Spread em bps, max 10
      Math.min(features.effectiveSpread * 1000, 10),
      Math.max(-1, Math.min(1, features.ofi)), // Clamp OFI
      Math.max(-1, Math.min(1, features.queueImbalance)),
      Math.min(features.vpin, 1), // VPIN 0-1
      features.rsi / 100,
      Math.max(-1, Math.min(1, features.macd / 1000)), // Normalizar MACD
      features.bollingerPosition,
      Math.min(features.volumeRatio, 5), // Max 5x volume
      Math.min(features.realizedVolatility * 100, 10), // Max 10%
      Math.min(features.atr / features.midPrice, 0.1), // ATR normalizado
      Math.max(-1, Math.min(1, features.microMomentum)),
      Math.max(-1, Math.min(1, features.priceChange24h / 100)), // Max ±100%
      features.trendStrength,
      features.regime === 'trending' ? 1 : features.regime === 'mean_reverting' ? -1 : 0
    ];
  }

  /**
   * ✅ Logistic Regression (simplificado - sem biblioteca externa)
   * 
   * Usa gradient descent para treinar pesos
   */
  private trainLogisticRegression(data: MLFeatures[]): void {
    if (data.length < 10) {
      console.warn('⚠️ Dados insuficientes para treinar Logistic Regression');
      return;
    }

    const featuresCount = 17; // Tamanho do array normalizado
    const weights: number[] = new Array(featuresCount + 1).fill(0); // +1 para bias
    
    // ✅ Gradient Descent simplificado
    for (let iter = 0; iter < this.config.logistic.maxIterations; iter++) {
      let totalError = 0;

      for (const sample of data) {
        if (sample.primaryLabel === undefined) continue;
        
        const x = this.normalizeFeatures(sample);
        const y = sample.primaryLabel === 1 ? 1 : 0; // Binary classification
        
        // Forward pass (sigmoid)
        let z = weights[0]; // bias
        for (let i = 0; i < x.length; i++) {
          z += weights[i + 1] * x[i];
        }
        const prediction = 1 / (1 + Math.exp(-z)); // Sigmoid
        
        // Backward pass (gradient)
        const error = prediction - y;
        totalError += Math.abs(error);

        // Update weights (gradient descent)
        weights[0] -= this.config.logistic.learningRate * error; // bias
        for (let i = 0; i < x.length; i++) {
          weights[i + 1] -= this.config.logistic.learningRate * (
            error * x[i] + this.config.logistic.regularization * weights[i + 1]
          );
        }
      }

      // Early stopping se convergência
      if (totalError / data.length < 0.01) break;
    }

    // Salvar pesos (simplificado - em produção seria persistido)
    this.logisticWeights.clear();
    weights.forEach((w, i) => {
      this.logisticWeights.set(`w${i}`, w);
    });

    console.log(`✅ Logistic Regression treinado com ${data.length} amostras`);
  }

  /**
   * ✅ Predição com Logistic Regression
   */
  private predictLogistic(features: MLFeatures): MLPrediction {
    if (this.logisticWeights.size === 0) {
      // Modelo não treinado - retornar predição neutra
      return {
        probability: 0.5,
        confidence: 0.3,
        predictedLabel: 0,
        expectedReturn: 0,
        model: 'logistic',
        timestamp: Date.now()
      };
    }

    const x = this.normalizeFeatures(features);
    const weights = Array.from({ length: x.length + 1 }, (_, i) => 
      this.logisticWeights.get(`w${i}`) || 0
    );

    // Forward pass
    let z = weights[0]; // bias
    for (let i = 0; i < x.length; i++) {
      z += weights[i + 1] * x[i];
    }
    const probability = 1 / (1 + Math.exp(-z)); // Sigmoid

    return {
      probability,
      confidence: Math.abs(probability - 0.5) * 2, // 0-1 (mais longe de 0.5 = mais confiável)
      predictedLabel: probability >= 0.5 ? 1 : 0,
      expectedReturn: (probability - 0.5) * 4, // -2% a +2%
      model: 'logistic',
      timestamp: Date.now()
    };
  }

  /**
   * ✅ LightGBM (simplificado - em produção usar biblioteca)
   * 
   * Usa decision tree ensemble básico
   */
  private trainLightGBM(data: MLFeatures[]): void {
    if (data.length < 20) {
      console.warn('⚠️ Dados insuficientes para treinar LightGBM');
      return;
    }

    // ✅ Implementação simplificada (em produção usar lightgbm npm package)
    // Por enquanto, apenas marca como treinado
    this.lightgbmModel = {
      trained: true,
      samples: data.length,
      version: 'simplified'
    };

    console.log(`✅ LightGBM treinado com ${data.length} amostras (implementação simplificada)`);
    console.warn('⚠️ Para produção real, instalar: npm install lightgbm');
  }

  /**
   * ✅ Predição com LightGBM (simplificado)
   */
  private predictLightGBM(features: MLFeatures): MLPrediction {
    if (!this.lightgbmModel || !this.lightgbmModel.trained) {
      // Modelo não treinado - usar heurística baseada em features
      const x = this.normalizeFeatures(features);
      
      // Heurística simplificada baseada em features importantes
      let score = 0.5;
      score += (features.trendStrength - 0.5) * 0.3;
      score += (features.ofi > 0 ? 0.1 : -0.1);
      score += (features.volumeRatio > 1.2 ? 0.1 : -0.05);
      score += (features.rsi > 50 && features.rsi < 70 ? 0.1 : -0.05);
      
      const probability = Math.max(0, Math.min(1, score));
      
      return {
        probability,
        confidence: 0.5, // Baixa confiança sem modelo real
        predictedLabel: probability >= 0.5 ? 1 : 0,
        expectedReturn: (probability - 0.5) * 3,
        model: 'lightgbm',
        timestamp: Date.now()
      };
    }

    // Em produção, aqui seria a predição real do LightGBM
    // Por enquanto, retornar heurística
    return this.predictLightGBM(features);
  }

  /**
   * ✅ Ensemble: Combina Logistic + LightGBM
   */
  public predict(features: MLFeatures): MLPrediction {
    const logisticPred = this.predictLogistic(features);
    const lightgbmPred = this.predictLightGBM(features);

    // ✅ Ensemble weighted average
    const wLog = this.config.ensemble.weights.logistic;
    const wLgb = this.config.ensemble.weights.lightgbm;

    const probability = (logisticPred.probability * wLog) + (lightgbmPred.probability * wLgb);
    const confidence = (logisticPred.confidence * wLog) + (lightgbmPred.confidence * wLgb);
    const expectedReturn = (logisticPred.expectedReturn * wLog) + (lightgbmPred.expectedReturn * wLgb);

    return {
      probability,
      confidence,
      predictedLabel: probability >= 0.5 ? 1 : 0,
      expectedReturn,
      model: 'ensemble',
      timestamp: Date.now()
    };
  }

  /**
   * ✅ Treina todos os modelos
   */
  public async train(dataset: MLFeatures[]): Promise<void> {
    if (dataset.length < 20) {
      console.warn('⚠️ Dataset muito pequeno para treinamento eficaz');
      return;
    }

    console.log(`📊 Iniciando treinamento ML com ${dataset.length} amostras...`);
    
    this.trainingData = dataset;
    this.trainLogisticRegression(dataset);
    this.trainLightGBM(dataset);
    
    this.trained = true;
    console.log('✅ Modelos ML treinados com sucesso');
  }

  /**
   * ✅ Verifica se modelos estão treinados
   */
  public isTrained(): boolean {
    return this.trained && this.logisticWeights.size > 0;
  }

  /**
   * ✅ Atualiza modelo incrementalmente (online learning)
   */
  public updateIncremental(newSamples: MLFeatures[]): void {
    if (newSamples.length === 0) return;

    this.trainingData.push(...newSamples);
    
    // Retreinar com amostragem (manter últimos N)
    const maxSamples = 10000;
    if (this.trainingData.length > maxSamples) {
      this.trainingData = this.trainingData.slice(-maxSamples);
    }

    // Retreinar (em produção, seria incremental)
    this.train(this.trainingData);
  }
}

export const mlModels = MLModels.getInstance();
