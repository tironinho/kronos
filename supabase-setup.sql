-- Adicionar tabelas para armazenar dados de simulação

CREATE TABLE IF NOT EXISTS public.simulated_trades (
  id BIGSERIAL PRIMARY KEY,
  trade_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_time TIMESTAMP WITH TIME ZONE,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity NUMERIC NOT NULL,
  pnl NUMERIC NOT NULL,
  pnl_percent NUMERIC NOT NULL,
  duration_seconds INTEGER,
  algorithm TEXT NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_simulated_trades_symbol ON public.simulated_trades(symbol);
CREATE INDEX idx_simulated_trades_status ON public.simulated_trades(status);
CREATE INDEX idx_simulated_trades_created_at ON public.simulated_trades(created_at);

-- Tabela para armazenar TRADES REAIS executados na Binance
CREATE TABLE IF NOT EXISTS public.real_trades (
  id BIGSERIAL PRIMARY KEY,
  trade_id TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  take_profit NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  pnl NUMERIC NOT NULL DEFAULT 0,
  pnl_percent NUMERIC NOT NULL DEFAULT 0,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE,
  algorithm TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  binance_order_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_real_trades_symbol ON public.real_trades(symbol);
CREATE INDEX idx_real_trades_status ON public.real_trades(status);
CREATE INDEX idx_real_trades_opened_at ON public.real_trades(opened_at);

-- Tabela para armazenar estatísticas de simulação
CREATE TABLE IF NOT EXISTS public.simulation_stats (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  total_pnl_percent NUMERIC NOT NULL DEFAULT 0,
  equity NUMERIC NOT NULL,
  active_positions INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_simulation_stats_symbol ON public.simulation_stats(symbol);

-- Tabela para armazenar configurações de simulação
CREATE TABLE IF NOT EXISTS public.simulation_config (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  initial_capital NUMERIC NOT NULL,
  max_positions INTEGER NOT NULL DEFAULT 3,
  position_size_percent NUMERIC NOT NULL DEFAULT 0.1,
  stop_loss_percent NUMERIC NOT NULL DEFAULT 0.02,
  take_profit_percent NUMERIC NOT NULL DEFAULT 0.04,
  is_active BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE,
  stopped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_simulation_config_symbol ON public.simulation_config(symbol);

-- Tabela para histórico de equity
CREATE TABLE IF NOT EXISTS public.equity_history (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  equity NUMERIC NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_equity_history_symbol ON public.equity_history(symbol);
CREATE INDEX idx_equity_history_timestamp ON public.equity_history(timestamp);

-- Tabela para parâmetros de análise das trades
CREATE TABLE IF NOT EXISTS public.trade_analysis_parameters (
  id BIGSERIAL PRIMARY KEY,
  trade_id TEXT NOT NULL REFERENCES public.real_trades(trade_id),
  symbol TEXT NOT NULL,
  analysis_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Parâmetros de Análise Técnica
  technical_rsi NUMERIC,
  technical_macd_signal NUMERIC,
  technical_macd_histogram NUMERIC,
  technical_bollinger_upper NUMERIC,
  technical_bollinger_middle NUMERIC,
  technical_bollinger_lower NUMERIC,
  technical_volume_ratio NUMERIC,
  technical_price_change_24h NUMERIC,
  technical_support_level NUMERIC,
  technical_resistance_level NUMERIC,
  
  -- Parâmetros de Análise Preditiva V2
  predictive_v2_signal TEXT,
  predictive_v2_confidence NUMERIC,
  predictive_v2_weighted_score NUMERIC,
  predictive_v2_technical_score NUMERIC,
  predictive_v2_sentiment_score NUMERIC,
  predictive_v2_onchain_score NUMERIC,
  predictive_v2_derivatives_score NUMERIC,
  predictive_v2_macro_score NUMERIC,
  predictive_v2_smart_money_score NUMERIC,
  predictive_v2_news_score NUMERIC,
  predictive_v2_fundamental_score NUMERIC,
  
  -- Parâmetros de Análise HFT
  hft_vwap NUMERIC,
  hft_mean_reversion_signal TEXT,
  hft_confirmations_count INTEGER,
  hft_confirmations_score NUMERIC,
  hft_volume_analysis TEXT,
  hft_atr NUMERIC,
  hft_position_size NUMERIC,
  hft_volatility_adjustment NUMERIC,
  hft_atr_adjustment NUMERIC,
  
  -- Parâmetros de Risco
  risk_stop_loss NUMERIC,
  risk_take_profit NUMERIC,
  risk_position_size NUMERIC,
  risk_leverage NUMERIC,
  risk_margin_required NUMERIC,
  risk_max_loss NUMERIC,
  risk_reward_ratio NUMERIC,
  
  -- Parâmetros de Mercado
  market_current_price NUMERIC,
  market_24h_high NUMERIC,
  market_24h_low NUMERIC,
  market_24h_volume NUMERIC,
  market_funding_rate NUMERIC,
  market_open_interest NUMERIC,
  
  -- Parâmetros de Decisão
  decision_action TEXT,
  decision_confidence NUMERIC,
  decision_reason TEXT,
  decision_algorithm TEXT,
  decision_multiple_confirmations BOOLEAN,
  decision_volume_confirmed BOOLEAN,
  decision_risk_acceptable BOOLEAN,
  
  -- Dados Estruturados (JSON)
  technical_indicators JSONB,
  sentiment_data JSONB,
  onchain_metrics JSONB,
  derivatives_data JSONB,
  macro_indicators JSONB,
  smart_money_flows JSONB,
  news_sentiment JSONB,
  fundamental_analysis JSONB,
  
  -- Metadados
  analysis_duration_ms INTEGER,
  api_calls_count INTEGER,
  errors_encountered TEXT[],
  warnings_generated TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trade_analysis_parameters_trade_id ON public.trade_analysis_parameters(trade_id);
CREATE INDEX idx_trade_analysis_parameters_symbol ON public.trade_analysis_parameters(symbol);
CREATE INDEX idx_trade_analysis_parameters_timestamp ON public.trade_analysis_parameters(analysis_timestamp);
CREATE INDEX idx_trade_analysis_parameters_confidence ON public.trade_analysis_parameters(predictive_v2_confidence);

-- Atualizar tabela backtest_results para incluir mais dados
ALTER TABLE public.backtest_results ADD COLUMN IF NOT EXISTS equity_curve JSONB;
ALTER TABLE public.backtest_results ADD COLUMN IF NOT EXISTS trades_data JSONB;
ALTER TABLE public.backtest_results ADD COLUMN IF NOT EXISTS algorithm TEXT;

-- Ativar RLS nas tabelas
ALTER TABLE public.simulated_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equity_history ENABLE ROW LEVEL SECURITY;

-- Políticas para simulated_trades
DROP POLICY IF EXISTS "Permitir leitura de simulated_trades" ON public.simulated_trades;
CREATE POLICY "Permitir leitura de simulated_trades" 
ON public.simulated_trades FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir escrita em simulated_trades" ON public.simulated_trades;
CREATE POLICY "Permitir escrita em simulated_trades" 
ON public.simulated_trades FOR INSERT 
WITH CHECK (true);

-- Políticas para simulation_stats
DROP POLICY IF EXISTS "Permitir leitura de simulation_stats" ON public.simulation_stats;
CREATE POLICY "Permitir leitura de simulation_stats" 
ON public.simulation_stats FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir escrita em simulation_stats" ON public.simulation_stats;
CREATE POLICY "Permitir escrita em simulation_stats" 
ON public.simulation_stats FOR ALL 
USING (true);

-- Políticas para simulation_config
DROP POLICY IF EXISTS "Permitir leitura de simulation_config" ON public.simulation_config;
CREATE POLICY "Permitir leitura de simulation_config" 
ON public.simulation_config FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir escrita em simulation_config" ON public.simulation_config;
CREATE POLICY "Permitir escrita em simulation_config" 
ON public.simulation_config FOR ALL 
USING (true);

-- Políticas para equity_history
DROP POLICY IF EXISTS "Permitir leitura de equity_history" ON public.equity_history;
CREATE POLICY "Permitir leitura de equity_history" 
ON public.equity_history FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir escrita em equity_history" ON public.equity_history;
CREATE POLICY "Permitir escrita em equity_history" 
ON public.equity_history FOR INSERT 
WITH CHECK (true);

-- Função para calcular estatísticas automaticamente
CREATE OR REPLACE FUNCTION update_simulation_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.simulation_stats (
    symbol,
    total_trades,
    winning_trades,
    losing_trades,
    win_rate,
    total_pnl,
    total_pnl_percent,
    equity,
    active_positions,
    updated_at
  )
  SELECT 
    NEW.symbol,
    COUNT(*) FILTER (WHERE status = 'closed'),
    COUNT(*) FILTER (WHERE status = 'closed' AND pnl > 0),
    COUNT(*) FILTER (WHERE status = 'closed' AND pnl <= 0),
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'closed') > 0 
      THEN COUNT(*) FILTER (WHERE status = 'closed' AND pnl > 0)::NUMERIC / COUNT(*) FILTER (WHERE status = 'closed')
      ELSE 0
    END * 100,
    COALESCE(SUM(pnl) FILTER (WHERE status = 'closed'), 0),
    CASE 
      WHEN SUM(pnl) FILTER (WHERE status = 'closed') > 0
      THEN SUM(pnl) FILTER (WHERE status = 'closed')::NUMERIC / SUM(entry_price * quantity) FILTER (WHERE status = 'closed') * 100
      ELSE 0
    END,
    COALESCE(SUM(entry_price * quantity) FILTER (WHERE status = 'open'), 0),
    COUNT(*) FILTER (WHERE status = 'open'),
    NOW()
  FROM public.simulated_trades
  WHERE symbol = NEW.symbol
  ON CONFLICT (symbol) DO UPDATE SET
    total_trades = EXCLUDED.total_trades,
    winning_trades = EXCLUDED.winning_trades,
    losing_trades = EXCLUDED.losing_trades,
    win_rate = EXCLUDED.win_rate,
    total_pnl = EXCLUDED.total_pnl,
    total_pnl_percent = EXCLUDED.total_pnl_percent,
    equity = EXCLUDED.equity,
    active_positions = EXCLUDED.active_positions,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar estatísticas automaticamente
CREATE TRIGGER trigger_update_stats
  AFTER INSERT OR UPDATE ON public.simulated_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_simulation_stats();

-- Tabela para armazenar simulações Monte Carlo
CREATE TABLE IF NOT EXISTS public.monte_carlo_simulations (
  id BIGSERIAL PRIMARY KEY,
  simulation_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  current_price NUMERIC NOT NULL,
  price_change NUMERIC NOT NULL,
  price_change_percent NUMERIC NOT NULL,
  initial_capital NUMERIC NOT NULL,
  num_simulations INTEGER NOT NULL,
  expected_return NUMERIC NOT NULL,
  volatility NUMERIC NOT NULL,
  sharpe_ratio NUMERIC NOT NULL,
  max_drawdown NUMERIC NOT NULL,
  confidence_lower NUMERIC NOT NULL,
  confidence_upper NUMERIC NOT NULL,
  estimated_profit NUMERIC,
  risk_reward_ratio NUMERIC,
  success_probability NUMERIC,
  execution_time_ms INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_monte_carlo_simulations_symbol ON public.monte_carlo_simulations(symbol);
CREATE INDEX idx_monte_carlo_simulations_timestamp ON public.monte_carlo_simulations(timestamp);
CREATE INDEX idx_monte_carlo_simulations_simulation_id ON public.monte_carlo_simulations(simulation_id);

-- Ativar RLS
ALTER TABLE public.monte_carlo_simulations ENABLE ROW LEVEL SECURITY;

-- Políticas para monte_carlo_simulations
DROP POLICY IF EXISTS "Permitir leitura de monte_carlo_simulations" ON public.monte_carlo_simulations;
CREATE POLICY "Permitir leitura de monte_carlo_simulations" 
ON public.monte_carlo_simulations FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir escrita em monte_carlo_simulations" ON public.monte_carlo_simulations;
CREATE POLICY "Permitir escrita em monte_carlo_simulations" 
ON public.monte_carlo_simulations FOR INSERT 
WITH CHECK (true);

