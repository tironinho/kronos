// ============================================================================
// TIPOS E INTERFACES PRINCIPAIS DO SISTEMA KRONOS-X
// ============================================================================

export interface EngineEnv {
  env: string;
  useTestnet: boolean;
  symbols: string[];
  depthUpdateSpeed: string;
  streams: string[];
  recordParquet: boolean;
  dataRetentionDays: number;
  logLatency: boolean;
  baseUrl: string;
  wsUrl: string;
  snapshotDepth: number;
  snapshotIntervalMs: number;
  healthCheck: HealthCheck;
}

export interface HealthCheck {
  maxSpreadTicks: number;
  minBookDepthLevels: number;
  maxFeedDelayMs: number;
}

export interface OfiCfg {
  windowsMs: number[];
  zScoreThreshold: number;
  cooldownMs: number;
}

export interface MicroMomentumCfg {
  returnWindowsMs: number[];
  minEdgeBps: number;
  minVolumeUsd: number;
}

export interface MeanRevCfg {
  deviationTicks: number;
  targetSpreadFactor: number;
  cooldownMs: number;
}

export interface SymbolSelCfg {
  enabled: boolean;
  volatilityThreshold: number;
  topNVolume: number;
}

export interface StrategyCfg {
  ofi: OfiCfg;
  microMomentum: MicroMomentumCfg;
  meanReversion: MeanRevCfg;
  symbolSelection: SymbolSelCfg;
}

export interface RiskCfg {
  maxPositionSize: number;
  maxDailyLoss: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxConcurrentPositions: number;
}

// ============================================================================
// DADOS DE TRADING
// ============================================================================

export interface TradeData {
  price: number;
  quantity: number;
  is_buyer_maker: boolean;
  timestamp: number;
}

export interface DepthData {
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][]; // [price, quantity]
  timestamp: number;
}

export interface SymbolMetrics {
  symbol: string;
  volume_24h: number;
  volatility: number;
  last_price: number;
  spread_bps: number;
  ofi_score: number;
  momentum_score: number;
  mean_reversion_score: number;
}

export interface TradingSignal {
  symbol: string;
  signal_type: string; // "BUY", "SELL", "HOLD"
  strength: number;    // -1.0 to 1.0
  confidence: number;  // 0.0 to 1.0
  reason: string;
  timestamp: number;
}

// ============================================================================
// BINANCE API TYPES
// ============================================================================

export interface BinanceSymbolInfo {
  symbol: string;
  status: string;
  base_asset: string;
  base_asset_precision: number;
  quote_asset: string;
  quote_precision: number;
  order_types: string[];
  iceberg_allowed: boolean;
  oco_allowed: boolean;
  is_spot_trading_allowed: boolean;
  is_margin_trading_allowed: boolean;
  filters: BinanceFilter[];
}

export interface BinanceFilter {
  filter_type: string;
  min_price?: string;
  max_price?: string;
  tick_size?: string;
  min_qty?: string;
  max_qty?: string;
  step_size?: string;
  min_notional?: string;
  apply_to_market?: boolean;
  limit?: number;
  max_num_orders?: number;
  max_num_algo_orders?: number;
}

export interface BinanceTicker24hr {
  symbol: string;
  price_change: string;
  price_change_percent: string;
  weighted_avg_price: string;
  prev_close_price: string;
  last_price: string;
  last_qty: string;
  bid_price: string;
  bid_qty: string;
  ask_price: string;
  ask_qty: string;
  open_price: string;
  high_price: string;
  low_price: string;
  volume: string;
  quote_volume: string;
  open_time: number;
  close_time: number;
  first_id: number;
  last_id: number;
  count: number;
}

export interface BinanceKline {
  open_time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  close_time: number;
  quote_asset_volume: string;
  number_of_trades: number;
  taker_buy_base_asset_volume: string;
  taker_buy_quote_asset_volume: string;
  ignore: string;
}

export interface BinanceOrderBook {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface BinanceTrade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}

export interface BinanceFundingRate {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
}

export interface BinanceOpenInterest {
  symbol: string;
  openInterest: string;
  time: number;
}

export interface BinanceLongShortRatio {
  symbol: string;
  longShortRatio: string;
  longAccount: string;
  shortAccount: string;
  timestamp: number;
}

// ============================================================================
// CONFIDENCE MODEL TYPES
// ============================================================================

export interface ConfidenceMetrics {
  symbol: string;
  total_signals: number;
  correct_signals: number;
  accuracy_percentage: number;
  confidence_score: number;
  last_updated: number;
  strategy_breakdown: Record<string, StrategyMetrics>;
}

export interface StrategyMetrics {
  strategy_name: string;
  total_signals: number;
  correct_signals: number;
  accuracy_percentage: number;
  avg_confidence: number;
  profit_factor: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
}

export interface SignalOutcome {
  signal_id: string;
  symbol: string;
  strategy: string;
  signal_type: string;
  signal_strength: number;
  signal_confidence: number;
  entry_price: number;
  exit_price?: number;
  exit_time?: number;
  pnl?: number;
  pnl_percentage?: number;
  was_correct?: boolean;
  hold_duration_ms?: number;
  created_at: number;
}

export interface ConfidenceConfig {
  min_signals_for_confidence: number;
  confidence_threshold: number;
  accuracy_threshold: number;
  update_interval_ms: number;
  max_history_days: number;
}

// ============================================================================
// ML MODELS TYPES
// ============================================================================

export interface MLConfig {
  lstm_hidden_size: number;
  lstm_layers: number;
  cnn_filters: number;
  sequence_length: number;
  prediction_horizon: number;
  learning_rate: number;
  batch_size: number;
  epochs: number;
}

export interface MLFeatures {
  price_features: number[];
  volume_features: number[];
  technical_features: number[];
  market_features: number[];
  timestamp: number;
}

export interface MLPrediction {
  symbol: string;
  prediction_type: string;
  predicted_price: number;
  confidence: number;
  features_used: string[];
  timestamp: number;
}

export interface MLPerformance {
  model_name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  mse: number;
  mae: number;
  last_trained: number;
  training_samples: number;
}

// ============================================================================
// REINFORCEMENT LEARNING TYPES
// ============================================================================

export interface RLConfig {
  learning_rate: number;
  discount_factor: number;
  epsilon: number;
  epsilon_decay: number;
  min_epsilon: number;
  memory_size: number;
  batch_size: number;
  target_update_frequency: number;
}

export interface RLState {
  symbol: string;
  price_features: number[];
  volume_features: number[];
  technical_indicators: number[];
  market_context: number[];
  timestamp: number;
}

export interface RLAction {
  action_type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  quantity?: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface RLExperience {
  state: RLState;
  action: RLAction;
  reward: number;
  next_state: RLState;
  done: boolean;
  timestamp: number;
}

export interface RLPerformance {
  total_rewards: number;
  average_reward: number;
  episode_count: number;
  win_rate: number;
  sharpe_ratio: number;
  max_drawdown: number;
  last_updated: number;
}

// ============================================================================
// MONTE CARLO TYPES
// ============================================================================

export interface MonteCarloConfig {
  num_simulations: number;
  forecast_period_minutes: number;
  confidence_level: number;
  parallel_threads: number;
  historical_window_days: number;
  volatility_factor: number;
  sampling_method: SamplingMethod;
  enable_correlation_analysis: boolean;
  enable_regime_analysis: boolean;
}

export enum SamplingMethod {
  BOOTSTRAP = 'bootstrap',
  MONTE_CARLO = 'monte_carlo',
  HISTORICAL = 'historical',
  HYBRID = 'hybrid'
}

export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

export interface SimulationResult {
  simulation_id: string;
  symbol: string;
  forecast_period: number;
  scenarios: PriceScenario[];
  statistics: SimulationStatistics;
  confidence_intervals: ConfidenceInterval[];
  timestamp: number;
}

export interface PriceScenario {
  time_points: number[];
  price_path: number[];
  final_price: number;
  max_price: number;
  min_price: number;
  volatility: number;
}

export interface SimulationStatistics {
  mean_price: number;
  median_price: number;
  std_deviation: number;
  skewness: number;
  kurtosis: number;
  var_95: number;
  var_99: number;
  expected_return: number;
  probability_up: number;
  probability_down: number;
}

export interface ConfidenceInterval {
  confidence_level: number;
  lower_bound: number;
  upper_bound: number;
  width: number;
}

export interface ProbabilisticAnalysis {
  symbol: string;
  current_price: number;
  forecast_horizon: number;
  scenarios: PriceScenario[];
  statistics: SimulationStatistics;
  confidence_intervals: ConfidenceInterval[];
  market_regime: MarketRegime;
  risk_metrics: RiskMetrics;
  timestamp: number;
}

export enum MarketRegime {
  BULL = 'bull',
  BEAR = 'bear',
  SIDEWAYS = 'sideways',
  VOLATILE = 'volatile',
  TRENDING = 'trending'
}

export interface RiskMetrics {
  value_at_risk_95: number;
  value_at_risk_99: number;
  expected_shortfall: number;
  maximum_drawdown: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
}

export interface PerformanceMetrics {
  total_simulations: number;
  successful_simulations: number;
  average_execution_time_ms: number;
  accuracy_rate: number;
  last_updated: number;
}

export interface CachedResult {
  result: ProbabilisticAnalysis;
  timestamp: number;
  ttl_ms: number;
}

// ============================================================================
// TRADE ORCHESTRATOR TYPES
// ============================================================================

export interface OrchestratorConfig {
  max_queue_size: number;
  priority_weights: PriorityWeights;
  execution_threshold: number;
  cooldown_period_ms: number;
  max_concurrent_trades: number;
  risk_limits: RiskLimits;
}

export interface PriorityWeights {
  signal_strength: number;
  confidence_score: number;
  volume_score: number;
  volatility_score: number;
  momentum_score: number;
  ofi_score: number;
  mean_reversion_score: number;
}

export interface RiskLimits {
  max_position_size: number;
  max_daily_loss: number;
  max_correlation: number;
  max_drawdown: number;
}

export interface PrioritizedTrade {
  trade_id: string;
  symbol: string;
  side: TradeSide;
  entry_price: number;
  quantity: number;
  stop_loss: number;
  take_profit: number;
  priority_score: number;
  confidence_score: number;
  risk_score: number;
  created_at: number;
  expires_at: number;
}

export enum TradeSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export interface CachedAnalysis {
  analysis: ProbabilisticAnalysis;
  timestamp: number;
  ttl_ms: number;
}

export interface OrchestratorStats {
  total_trades_processed: number;
  successful_trades: number;
  failed_trades: number;
  average_execution_time_ms: number;
  queue_size: number;
  active_trades: number;
  total_pnl: number;
  win_rate: number;
  sharpe_ratio: number;
  max_drawdown: number;
  last_updated: number;
}

export interface ExecutedTrade {
  trade_id: string;
  symbol: string;
  side: TradeSide;
  entry_price: number;
  quantity: number;
  exit_price?: number;
  exit_time?: number;
  pnl?: number;
  pnl_percentage?: number;
  execution_time_ms: number;
  priority_score: number;
  confidence_score: number;
  status: TradeStatus;
  created_at: number;
}

export enum TradeStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export interface AlertSystem {
  alerts: Alert[];
  max_alerts: number;
  alert_types: AlertType[];
}

export interface Alert {
  alert_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  data: Record<string, any>;
  timestamp: number;
  acknowledged: boolean;
}

export enum AlertType {
  HIGH_RISK = 'high_risk',
  LOW_CONFIDENCE = 'low_confidence',
  SYSTEM_ERROR = 'system_error',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  MARKET_ANOMALY = 'market_anomaly',
  POSITION_LIMIT = 'position_limit'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ============================================================================
// ADVANCED TRADING SYSTEM TYPES
// ============================================================================

export interface PositionManager {
  active_positions: Record<string, Position>;
  max_concurrent_positions: number;
  position_sizing_strategy: PositionSizingStrategy;
}

export enum PositionSizingStrategy {
  FIXED = 'fixed',
  KELLY_CRITERION = 'kelly_criterion',
  VOLATILITY_ADJUSTED = 'volatility_adjusted',
  CONFIDENCE_BASED = 'confidence_based',
  AGGRESSIVE_GROWTH = 'aggressive_growth'
}

export interface Position {
  symbol: string;
  side: string;
  entry_price: number;
  quantity: number;
  stop_loss: number;
  take_profit: number;
  current_price: number;
  unrealized_pnl: number;
  unrealized_pnl_percentage: number;
  created_at: number;
  updated_at: number;
}

export interface SignalValidator {
  validation_rules: ValidationRule[];
  min_confidence_threshold: number;
  max_risk_score: number;
}

export interface ValidationRule {
  rule_name: string;
  rule_type: ValidationRuleType;
  threshold: number;
  weight: number;
  enabled: boolean;
}

export enum ValidationRuleType {
  CONFIDENCE_SCORE = 'confidence_score',
  SIGNAL_STRENGTH = 'signal_strength',
  VOLUME_CONFIRMATION = 'volume_confirmation',
  VOLATILITY_CHECK = 'volatility_check',
  CORRELATION_CHECK = 'correlation_check',
  RISK_SCORE = 'risk_score'
}

export interface AdvancedRiskManager {
  risk_metrics: RiskMetrics;
  position_limits: PositionLimits;
  correlation_matrix: Record<string, Record<string, number>>;
  var_calculator: VaRCalculator;
}

export interface PositionLimits {
  max_position_size: number;
  max_total_exposure: number;
  max_correlation_exposure: number;
  max_sector_exposure: number;
}

export interface VaRCalculator {
  confidence_levels: number[];
  time_horizons: number[];
  methods: VaRMethod[];
}

export enum VaRMethod {
  HISTORICAL = 'historical',
  PARAMETRIC = 'parametric',
  MONTE_CARLO = 'monte_carlo'
}

export interface PerformanceTracker {
  performance_metrics: PerformanceMetrics;
  daily_stats: DailyStats[];
  monthly_stats: MonthlyStats[];
  benchmark_comparison: BenchmarkComparison;
}

export interface DailyStats {
  date: string;
  total_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  sharpe_ratio: number;
  max_drawdown: number;
}

export interface MonthlyStats {
  month: string;
  total_return: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
}

export interface BenchmarkComparison {
  benchmark_name: string;
  benchmark_return: number;
  strategy_return: number;
  alpha: number;
  beta: number;
  tracking_error: number;
  information_ratio: number;
}

export interface AIDecisionEngine {
  decision_models: DecisionModel[];
  ensemble_weights: Record<string, number>;
  confidence_threshold: number;
}

export interface DecisionModel {
  model_name: string;
  model_type: DecisionModelType;
  accuracy: number;
  weight: number;
  enabled: boolean;
}

export enum DecisionModelType {
  SIGNAL_BASED = 'signal_based',
  ML_PREDICTION = 'ml_prediction',
  RL_ACTION = 'rl_action',
  MONTE_CARLO = 'monte_carlo',
  CONFIDENCE_MODEL = 'confidence_model',
  ENSEMBLE = 'ensemble'
}

// ============================================================================
// ACCOUNT BALANCE TYPES
// ============================================================================

export interface AccountBalance {
  total_balance_usdt: number;
  available_balance_usdt: number;
  locked_balance_usdt: number;
  balances: AssetBalance[];
  last_updated: number;
}

export interface AssetBalance {
  asset: string;
  free: string;
  locked: string;
  total: string;
  usdt_value: number;
}

export interface MultiAccountSummary {
  total_balance_usdt: number;
  spot_balance: number;
  margin_balance: number;
  futures_balance: number;
  available_for_trading: number;
  reserved_amount: number;
  last_updated: number;
  accounts: AccountInfo[];
}

export interface AccountInfo {
  account_type: string;
  balance_usdt: number;
  available_usdt: number;
  locked_usdt: number;
  last_updated: number;
}

export interface TradingConfig {
  max_position_size: number;
  risk_per_trade: number;
  stop_loss_percentage: number;
  take_profit_percentage: number;
  max_concurrent_positions: number;
  trading_enabled: boolean;
  auto_trading: boolean;
}

// ============================================================================
// SYSTEM LOGS TYPES
// ============================================================================

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum SystemComponent {
  TradingEngine = 'trading_engine',
  SignalEngine = 'signal_engine',
  BinanceAPI = 'binance_api',
  MonteCarlo = 'monte_carlo',
  TradeOrchestrator = 'trade_orchestrator',
  AdvancedTrading = 'advanced_trading',
  ConfidenceModel = 'confidence_model',
  MLModels = 'ml_models',
  RLAgent = 'rl_agent',
  AIAgent = 'ai_agent',
  HealthMonitor = 'health_monitor',
  Database = 'database',
  WebSocket = 'websocket'
}

export enum SystemAction {
  SystemStart = 'system_start',
  SystemStop = 'system_stop',
  Configuration = 'configuration',
  DataProcessing = 'data_processing',
  SignalGeneration = 'signal_generation',
  TradeExecution = 'trade_execution',
  RiskManagement = 'risk_management',
  ErrorHandling = 'error_handling',
  PerformanceUpdate = 'performance_update',
  AlertTriggered = 'alert_triggered'
}

export interface SystemLog {
  log_id: string;
  level: LogLevel;
  component: SystemComponent;
  action: SystemAction;
  message: string;
  data?: Record<string, any>;
  success: boolean;
  error_message?: string;
  stack_trace?: string;
  timestamp: number;
  duration_ms?: number;
}

export interface LogStatistics {
  total_logs: number;
  logs_by_level: Record<LogLevel, number>;
  logs_by_component: Record<SystemComponent, number>;
  logs_by_action: Record<SystemAction, number>;
  error_rate: number;
  average_response_time_ms: number;
  last_updated: number;
}

// ============================================================================
// HEALTH MONITOR TYPES
// ============================================================================

export interface HealthStatus {
  overall_status: HealthStatusLevel;
  components: ComponentHealth[];
  system_metrics: SystemMetrics;
  last_updated: number;
}

export enum HealthStatusLevel {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  DOWN = 'down'
}

export interface ComponentHealth {
  component_name: string;
  status: HealthStatusLevel;
  response_time_ms: number;
  last_check: number;
  error_message?: string;
  metrics: Record<string, any>;
}

export interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_latency_ms: number;
  active_connections: number;
  queue_size: number;
  error_rate: number;
  throughput_per_second: number;
}

export interface StatusSummary {
  system_status: HealthStatusLevel;
  active_components: number;
  total_components: number;
  critical_issues: number;
  warnings: number;
  uptime_percentage: number;
  last_updated: number;
}

export interface ConnectionStatus {
  binance_rest: boolean;
  binance_websocket: boolean;
  database: boolean;
  redis: boolean;
  ai_service: boolean;
  last_check: number;
}

export interface TradingStatus {
  trading_enabled: boolean;
  auto_trading: boolean;
  active_positions: number;
  max_positions: number;
  daily_pnl: number;
  total_pnl: number;
  win_rate: number;
  last_trade_time: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export interface MetricsUpdate {
  equity: number;
  pnl_day: number;
  fills_ratio: number;
  selected_symbols: string[];
  notes: string;
  timestamp: number;
}

export interface RealtimeData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  data_type: 'trade' | 'depth' | 'ticker';
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface AppConfig {
  engine: EngineEnv;
  strategy: StrategyCfg;
  risk: RiskCfg;
  database: DatabaseConfig;
  redis: RedisConfig;
  ai: AIConfig;
  monitoring: MonitoringConfig;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool_size: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  ttl: number;
}

export interface AIConfig {
  openai_api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
  timeout_ms: number;
}

export interface MonitoringConfig {
  log_level: LogLevel;
  metrics_interval_ms: number;
  health_check_interval_ms: number;
  alert_webhook_url?: string;
  retention_days: number;
}
