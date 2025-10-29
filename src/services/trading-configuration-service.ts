// ============================================================================
// TRADING CONFIGURATION SERVICE - Configurações do Sistema de Trading
// ============================================================================

interface TradingConfig {
  // Filtros de Qualidade
  qualityFilters: {
    minWinRate: number;
    minConfidence: number;
    maxDrawdown: number;
    minProfitFactor: number;
    minTradeDuration: number;
    maxTradeDuration: number;
    minVolumeFactor: number;
    maxVolatility: number;
  };
  
  // Gestão de Risco
  riskManagement: {
    maxPositionsPerSymbol: number;
    maxTotalPositions: number;
    positionSizePct: number;
    stopLossPct: number;
    takeProfitPct: number;
    maxDailyLossPct: number;
    maxDrawdownPct: number;
    minRiskRewardRatio: number;
    maxCorrelation: number;
  };
  
  // Análise Técnica
  technicalAnalysis: {
    rsi: { period: number; overbought: number; oversold: number };
    macd: { fast: number; slow: number; signal: number };
    bollingerBands: { period: number; stdDev: number };
    emas: number[];
    smas: number[];
    volume: { minVolumeFactor: number };
    supportResistance: { lookbackPeriods: number };
    atr: { period: number };
    adx: { period: number };
    stochastic: { k: number; d: number };
    williamsR: { period: number };
    cci: { period: number };
  };
  
  // Configuração de Símbolos
  symbolConfig: {
    blacklistedSymbols: string[];
    prioritySymbols: string[];
    allowedSymbols: string[];
    symbolSettings: Record<string, { minConfidence: number; maxPositions: number }>;
  };
  
  // Limites de Trades
  tradeLimits: {
    maxActiveTrades: number | null;
    allowNewTrades: boolean;
    checkParameters: boolean;
  };
}

class TradingConfigurationService {
  private static instance: TradingConfigurationService;
  private config: TradingConfig;

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  public static getInstance(): TradingConfigurationService {
    if (!TradingConfigurationService.instance) {
      TradingConfigurationService.instance = new TradingConfigurationService();
    }
    return TradingConfigurationService.instance;
  }

  private getDefaultConfig(): TradingConfig {
    return {
      qualityFilters: {
        minWinRate: 45,
        minConfidence: 40.0,
        maxDrawdown: 15,
        minProfitFactor: 1.2,
        minTradeDuration: 30, // minutos
        maxTradeDuration: 1440, // 24 horas
        minVolumeFactor: 1.2,
        maxVolatility: 5.0
      },
      
      riskManagement: {
        maxPositionsPerSymbol: 2,
        maxTotalPositions: 10, // Aumentado de 8 para 10
        positionSizePct: 5, // % do capital
        stopLossPct: 2,
        takeProfitPct: 4,
        maxDailyLossPct: 3,
        maxDrawdownPct: 15,
        minRiskRewardRatio: 1.5,
        maxCorrelation: 0.7
      },
      
      technicalAnalysis: {
        rsi: { period: 14, overbought: 70, oversold: 30 },
        macd: { fast: 12, slow: 26, signal: 9 },
        bollingerBands: { period: 20, stdDev: 2 },
        emas: [9, 21, 50],
        smas: [20, 50, 200],
        volume: { minVolumeFactor: 1.2 },
        supportResistance: { lookbackPeriods: 50 },
        atr: { period: 14 },
        adx: { period: 14 },
        stochastic: { k: 14, d: 3 },
        williamsR: { period: 14 },
        cci: { period: 20 }
      },
      
      symbolConfig: {
        blacklistedSymbols: ['ENAUSDT'], // Evitar ENA
        prioritySymbols: ['BTCUSDT', 'ETHUSDT'], // Priorizar BTC e ETH
        allowedSymbols: [
          'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 
          'ADAUSDT', 'XRPUSDT', 'AVAXUSDT', 'MATICUSDT', 'DOTUSDT', 
          'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT', 'FTMUSDT'
        ],
        symbolSettings: {
          'BTCUSDT': { minConfidence: 35, maxPositions: 2 },
          'ETHUSDT': { minConfidence: 35, maxPositions: 2 },
          'ADAUSDT': { minConfidence: 40, maxPositions: 1 },
          'SOLUSDT': { minConfidence: 40, maxPositions: 1 },
          'XRPUSDT': { minConfidence: 40, maxPositions: 1 }
        }
      },
      
      tradeLimits: {
        maxActiveTrades: null, // Sem limite
        allowNewTrades: true,
        checkParameters: true
      }
    };
  }

  public getConfig(): TradingConfig {
    return this.config;
  }

  public getQualityFilters() {
    return this.config.qualityFilters;
  }

  public getRiskManagement() {
    return this.config.riskManagement;
  }

  public getTechnicalAnalysis() {
    return this.config.technicalAnalysis;
  }

  public getSymbolConfig() {
    return this.config.symbolConfig;
  }

  public getTradeLimits() {
    return this.config.tradeLimits;
  }

  public isSymbolAllowed(symbol: string): boolean {
    const { blacklistedSymbols, allowedSymbols } = this.config.symbolConfig;
    return !blacklistedSymbols.includes(symbol) && allowedSymbols.includes(symbol);
  }

  public isSymbolPriority(symbol: string): boolean {
    return this.config.symbolConfig.prioritySymbols.includes(symbol);
  }

  public getSymbolSettings(symbol: string) {
    return this.config.symbolConfig.symbolSettings[symbol] || {
      minConfidence: this.config.qualityFilters.minConfidence,
      maxPositions: this.config.riskManagement.maxPositionsPerSymbol
    };
  }

  public canOpenNewTrade(currentTrades: number): boolean {
    const { maxActiveTrades, allowNewTrades, checkParameters } = this.config.tradeLimits;
    
    if (!allowNewTrades) return false;
    if (maxActiveTrades === null) return true; // Sem limite
    if (currentTrades >= maxActiveTrades) return false;
    
    return true;
  }

  public updateConfig(updates: Partial<TradingConfig>) {
    this.config = { ...this.config, ...updates };
  }

  public logConfig() {
    console.log('\n📋 CONFIGURAÇÃO ATUAL DO SISTEMA:');
    console.log('='.repeat(50));
    
    console.log('\n🚫 Símbolos Bloqueados:', this.config.symbolConfig.blacklistedSymbols.join(', '));
    console.log('⭐ Símbolos Prioritários:', this.config.symbolConfig.prioritySymbols.join(', '));
    console.log('📊 Total de Símbolos Permitidos:', this.config.symbolConfig.allowedSymbols.length);
    
    console.log('\n🎯 Filtros de Qualidade:');
    console.log(`   - Win Rate mínimo: ${this.config.qualityFilters.minWinRate}%`);
    console.log(`   - Confiança mínima: ${this.config.qualityFilters.minConfidence}%`);
    console.log(`   - Drawdown máximo: ${this.config.qualityFilters.maxDrawdown}%`);
    
    console.log('\n⚖️ Gestão de Risco:');
    console.log(`   - Máximo de posições por símbolo: ${this.config.riskManagement.maxPositionsPerSymbol}`);
    console.log(`   - Máximo de posições totais: ${this.config.riskManagement.maxTotalPositions}`);
    console.log(`   - Tamanho da posição: ${this.config.riskManagement.positionSizePct}% do capital`);
    
    console.log('\n📈 Análise Técnica:');
    console.log(`   - RSI: período ${this.config.technicalAnalysis.rsi.period}`);
    console.log(`   - MACD: ${this.config.technicalAnalysis.macd.fast}/${this.config.technicalAnalysis.macd.slow}/${this.config.technicalAnalysis.macd.signal}`);
    console.log(`   - EMAs: ${this.config.technicalAnalysis.emas.join(', ')}`);
    
    console.log('\n🔢 Limites de Trades:');
    console.log(`   - Máximo de trades ativas: ${this.config.tradeLimits.maxActiveTrades || 'Sem limite'}`);
    console.log(`   - Permitir novos trades: ${this.config.tradeLimits.allowNewTrades ? 'Sim' : 'Não'}`);
    console.log(`   - Verificar parâmetros: ${this.config.tradeLimits.checkParameters ? 'Sim' : 'Não'}`);
  }
}

export default TradingConfigurationService;
