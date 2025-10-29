// ============================================================================
// SISTEMA DE CONFIGURAÇÃO KRONOS-X
// ============================================================================

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  EngineEnv,
  StrategyCfg,
  RiskCfg,
  AppConfig,
  DatabaseConfig,
  RedisConfig,
  AIConfig,
  MonitoringConfig,
  OfiCfg,
  MicroMomentumCfg,
  MeanRevCfg,
  SymbolSelCfg,
  HealthCheck
} from '../types';

// Carrega variáveis de ambiente
dotenv.config();

// ============================================================================
// CONFIGURAÇÕES PADRÃO
// ============================================================================

const DEFAULT_OFI_CONFIG: OfiCfg = {
  windowsMs: [1000, 5000, 10000],
  zScoreThreshold: 2.0,
  cooldownMs: 60000
};

const DEFAULT_MICRO_MOMENTUM_CONFIG: MicroMomentumCfg = {
  returnWindowsMs: [100, 500, 1000],
  minEdgeBps: 0.5,
  minVolumeUsd: 10000.0
};

const DEFAULT_MEAN_REVERSION_CONFIG: MeanRevCfg = {
  deviationTicks: 10,
  targetSpreadFactor: 0.5,
  cooldownMs: 30000
};

const DEFAULT_SYMBOL_SELECTION_CONFIG: SymbolSelCfg = {
  enabled: true,
  volatilityThreshold: 0.5,
  topNVolume: 10
};

const DEFAULT_HEALTH_CHECK: HealthCheck = {
  maxSpreadTicks: 3,
  minBookDepthLevels: 5,
  maxFeedDelayMs: 500
};

const DEFAULT_ENGINE_ENV: EngineEnv = {
  env: process.env.NODE_ENV || 'development',
  useTestnet: process.env.BINANCE_TESTNET === 'true',
  symbols: (process.env.SYMBOLS || 'BTCUSDT,ETHUSDT').split(',').map(s => s.trim()),
  depthUpdateSpeed: process.env.DEPTH_SPEED || '100ms',
  streams: ['depth', 'aggTrade', 'markPrice', 'userData'],
  recordParquet: false,
  dataRetentionDays: 7,
  logLatency: true,
  baseUrl: process.env.BINANCE_BASE_REST || 'https://api.binance.com',
  wsUrl: process.env.BINANCE_BASE_WS || 'wss://stream.binance.com:9443',
  snapshotDepth: 1000,
  snapshotIntervalMs: 60000,
  healthCheck: DEFAULT_HEALTH_CHECK
};

const DEFAULT_STRATEGY_CONFIG: StrategyCfg = {
  ofi: DEFAULT_OFI_CONFIG,
  microMomentum: DEFAULT_MICRO_MOMENTUM_CONFIG,
  meanReversion: DEFAULT_MEAN_REVERSION_CONFIG,
  symbolSelection: DEFAULT_SYMBOL_SELECTION_CONFIG
};

const DEFAULT_RISK_CONFIG: RiskCfg = {
  maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '1000'),
  maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '100'),
  stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '2'),
  takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '4'),
  maxConcurrentPositions: parseInt(process.env.MAX_CONCURRENT_POSITIONS || '5')
};

const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'kronos_x',
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  ssl: process.env.POSTGRES_SSL === 'true',
  pool_size: parseInt(process.env.POSTGRES_POOL_SIZE || '10')
};

const DEFAULT_REDIS_CONFIG: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  ttl: parseInt(process.env.REDIS_TTL || '3600')
};

const DEFAULT_AI_CONFIG: AIConfig = {
  openai_api_key: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4',
  max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  timeout_ms: parseInt(process.env.OPENAI_TIMEOUT_MS || '30000')
};

const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  log_level: (process.env.LOG_LEVEL as any) || 'info',
  metrics_interval_ms: parseInt(process.env.METRICS_INTERVAL_MS || '5000'),
  health_check_interval_ms: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000'),
  alert_webhook_url: process.env.ALERT_WEBHOOK_URL,
  retention_days: parseInt(process.env.LOG_RETENTION_DAYS || '30')
};

// ============================================================================
// CLASSE DE CONFIGURAÇÃO
// ============================================================================

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), 'config');
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Carrega configuração completa
   */
  private loadConfig(): AppConfig {
    try {
      const engineConfig = this.loadEngineConfig();
      const strategyConfig = this.loadStrategyConfig();
      const riskConfig = this.loadRiskConfig();

      return {
        engine: engineConfig,
        strategy: strategyConfig,
        risk: riskConfig,
        database: DEFAULT_DATABASE_CONFIG,
        redis: DEFAULT_REDIS_CONFIG,
        ai: DEFAULT_AI_CONFIG,
        monitoring: DEFAULT_MONITORING_CONFIG
      };
    } catch (error) {
      console.warn('Erro ao carregar configurações, usando padrões:', error);
      return {
        engine: DEFAULT_ENGINE_ENV,
        strategy: DEFAULT_STRATEGY_CONFIG,
        risk: DEFAULT_RISK_CONFIG,
        database: DEFAULT_DATABASE_CONFIG,
        redis: DEFAULT_REDIS_CONFIG,
        ai: DEFAULT_AI_CONFIG,
        monitoring: DEFAULT_MONITORING_CONFIG
      };
    }
  }

  /**
   * Carrega configuração do engine
   */
  private loadEngineConfig(): EngineEnv {
    try {
      const configFile = path.join(this.configPath, 'engine.env.json');
      if (fs.existsSync(configFile)) {
        const content = fs.readFileSync(configFile, 'utf8');
        const config = JSON.parse(content);
        return { ...DEFAULT_ENGINE_ENV, ...config };
      }
    } catch (error) {
      console.warn('Erro ao carregar engine.env.json:', error);
    }
    return DEFAULT_ENGINE_ENV;
  }

  /**
   * Carrega configuração de estratégia
   */
  private loadStrategyConfig(): StrategyCfg {
    try {
      const configFile = path.join(this.configPath, 'strategy.config.json');
      if (fs.existsSync(configFile)) {
        const content = fs.readFileSync(configFile, 'utf8');
        const config = JSON.parse(content);
        return {
          ofi: { ...DEFAULT_OFI_CONFIG, ...config.ofi },
          microMomentum: { ...DEFAULT_MICRO_MOMENTUM_CONFIG, ...config.microMomentum },
          meanReversion: { ...DEFAULT_MEAN_REVERSION_CONFIG, ...config.meanReversion },
          symbolSelection: { ...DEFAULT_SYMBOL_SELECTION_CONFIG, ...config.symbolSelection }
        };
      }
    } catch (error) {
      console.warn('Erro ao carregar strategy.config.json:', error);
    }
    return DEFAULT_STRATEGY_CONFIG;
  }

  /**
   * Carrega configuração de risco
   */
  private loadRiskConfig(): RiskCfg {
    try {
      const configFile = path.join(this.configPath, 'risk.config.json');
      if (fs.existsSync(configFile)) {
        const content = fs.readFileSync(configFile, 'utf8');
        const config = JSON.parse(content);
        return { ...DEFAULT_RISK_CONFIG, ...config };
      }
    } catch (error) {
      console.warn('Erro ao carregar risk.config.json:', error);
    }
    return DEFAULT_RISK_CONFIG;
  }

  /**
   * Obtém configuração completa
   */
  public getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Obtém configuração do engine
   */
  public getEngineConfig(): EngineEnv {
    return this.config.engine;
  }

  /**
   * Obtém configuração de estratégia
   */
  public getStrategyConfig(): StrategyCfg {
    return this.config.strategy;
  }

  /**
   * Obtém configuração de risco
   */
  public getRiskConfig(): RiskCfg {
    return this.config.risk;
  }

  /**
   * Obtém configuração do banco de dados
   */
  public getDatabaseConfig(): DatabaseConfig {
    return this.config.database;
  }

  /**
   * Obtém configuração do Redis
   */
  public getRedisConfig(): RedisConfig {
    return this.config.redis;
  }

  /**
   * Obtém configuração da IA
   */
  public getAIConfig(): AIConfig {
    return this.config.ai;
  }

  /**
   * Obtém configuração de monitoramento
   */
  public getMonitoringConfig(): MonitoringConfig {
    return this.config.monitoring;
  }

  /**
   * Atualiza configuração específica
   */
  public updateConfig(section: keyof AppConfig, updates: Partial<AppConfig[keyof AppConfig]>): void {
    (this.config[section] as any) = { ...this.config[section], ...updates };
    this.saveConfig();
  }

  /**
   * Salva configuração atual
   */
  private saveConfig(): void {
    try {
      // Cria diretório de configuração se não existir
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }

      // Salva configurações individuais
      fs.writeFileSync(
        path.join(this.configPath, 'engine.env.json'),
        JSON.stringify(this.config.engine, null, 2)
      );

      fs.writeFileSync(
        path.join(this.configPath, 'strategy.config.json'),
        JSON.stringify(this.config.strategy, null, 2)
      );

      fs.writeFileSync(
        path.join(this.configPath, 'risk.config.json'),
        JSON.stringify(this.config.risk, null, 2)
      );

      console.log('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    }
  }

  /**
   * Valida configuração
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Valida configuração do engine
    if (!this.config.engine.baseUrl) {
      errors.push('Engine baseUrl é obrigatório');
    }

    if (!this.config.engine.wsUrl) {
      errors.push('Engine wsUrl é obrigatório');
    }

    if (this.config.engine.symbols.length === 0) {
      errors.push('Pelo menos um símbolo deve ser configurado');
    }

    // Valida configuração de risco
    if (this.config.risk.maxPositionSize <= 0) {
      errors.push('Max position size deve ser maior que zero');
    }

    if (this.config.risk.maxDailyLoss <= 0) {
      errors.push('Max daily loss deve ser maior que zero');
    }

    if (this.config.risk.stopLossPercentage <= 0 || this.config.risk.stopLossPercentage > 100) {
      errors.push('Stop loss percentage deve estar entre 0 e 100');
    }

    if (this.config.risk.takeProfitPercentage <= 0 || this.config.risk.takeProfitPercentage > 100) {
      errors.push('Take profit percentage deve estar entre 0 e 100');
    }

    // Valida configuração do banco de dados
    if (!this.config.database.host) {
      errors.push('Database host é obrigatório');
    }

    if (!this.config.database.database) {
      errors.push('Database name é obrigatório');
    }

    // Valida configuração da IA
    if (this.config.ai.openai_api_key && !this.config.ai.openai_api_key.startsWith('sk-')) {
      errors.push('OpenAI API key deve começar com "sk-"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Recarrega configuração
   */
  public reloadConfig(): void {
    this.config = this.loadConfig();
  }

  /**
   * Obtém variável de ambiente com fallback
   */
  public getEnvVar(key: string, defaultValue?: string): string {
    return process.env[key] || defaultValue || '';
  }

  /**
   * Obtém variável de ambiente numérica
   */
  public getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
  }

  /**
   * Obtém variável de ambiente booleana
   */
  public getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    return value ? value.toLowerCase() === 'true' : defaultValue;
  }

  /**
   * Verifica se está em modo de desenvolvimento
   */
  public isDevelopment(): boolean {
    return this.config.engine.env === 'development';
  }

  /**
   * Verifica se está em modo de produção
   */
  public isProduction(): boolean {
    return this.config.engine.env === 'production';
  }

  /**
   * Verifica se está usando testnet
   */
  public isTestnet(): boolean {
    return this.config.engine.useTestnet;
  }

  /**
   * Obtém URL base da Binance
   */
  public getBinanceBaseUrl(): string {
    return this.config.engine.baseUrl;
  }

  /**
   * Obtém URL WebSocket da Binance
   */
  public getBinanceWsUrl(): string {
    return this.config.engine.wsUrl;
  }

  /**
   * Obtém símbolos configurados
   */
  public getSymbols(): string[] {
    return this.config.engine.symbols;
  }

  /**
   * Obtém streams configurados
   */
  public getStreams(): string[] {
    return this.config.engine.streams;
  }

  /**
   * Obtém configuração de API keys
   */
  public getApiKeys(): { apiKey: string; secretKey: string } {
    const apiKey = this.getEnvVar('BINANCE_API_KEY');
    const secretKey = this.getEnvVar('BINANCE_SECRET_KEY');
    
    // DEBUG: Verificar variáveis de ambiente (SEM mostrar Secret Key!)
    console.log('🔍 DEBUG - getApiKeys():');
    console.log('  API Key presente:', !!apiKey);
    console.log('  Secret Key presente:', !!secretKey);
    console.log('  API Key (primeiros 20):', apiKey?.substring(0, 20));
    
    return {
      apiKey,
      secretKey
    };
  }

  /**
   * Verifica se API keys estão configuradas
   */
  public hasApiKeys(): boolean {
    const { apiKey, secretKey } = this.getApiKeys();
    return !!(apiKey && secretKey);
  }

  /**
   * Obtém configuração de porta
   */
  public getPort(): number {
    return this.getEnvNumber('PORT', 3000);
  }

  /**
   * Obtém configuração de timeout
   */
  public getTimeout(): number {
    return this.getEnvNumber('TIMEOUT_MS', 30000);
  }

  /**
   * Obtém configuração de retry
   */
  public getRetryConfig(): { maxRetries: number; delayMs: number } {
    return {
      maxRetries: this.getEnvNumber('MAX_RETRIES', 3),
      delayMs: this.getEnvNumber('RETRY_DELAY_MS', 1000)
    };
  }
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Carrega configuração JSON de arquivo
 */
export function loadJsonConfig<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`Erro ao carregar configuração ${filePath}:`, error);
  }
  return defaultValue;
}

/**
 * Salva configuração JSON em arquivo
 */
export function saveJsonConfig<T>(filePath: string, config: T): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(`Erro ao salvar configuração ${filePath}:`, error);
  }
}

/**
 * Obtém instância singleton do ConfigManager
 */
export function getConfig(): ConfigManager {
  return ConfigManager.getInstance();
}

/**
 * Obtém configuração do engine
 */
export function getEngineConfig(): EngineEnv {
  return getConfig().getEngineConfig();
}

/**
 * Obtém configuração de estratégia
 */
export function getStrategyConfig(): StrategyCfg {
  return getConfig().getStrategyConfig();
}

/**
 * Obtém configuração de risco
 */
export function getRiskConfig(): RiskCfg {
  return getConfig().getRiskConfig();
}

/**
 * Obtém configuração do banco de dados
 */
export function getDatabaseConfig(): DatabaseConfig {
  return getConfig().getDatabaseConfig();
}

/**
 * Obtém configuração do Redis
 */
export function getRedisConfig(): RedisConfig {
  return getConfig().getRedisConfig();
}

/**
 * Obtém configuração da IA
 */
export function getAIConfig(): AIConfig {
  return getConfig().getAIConfig();
}

/**
 * Obtém configuração de monitoramento
 */
export function getMonitoringConfig(): MonitoringConfig {
  return getConfig().getMonitoringConfig();
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default ConfigManager;
