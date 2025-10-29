-- ============================================================================
-- EXPANSÃO DO BANCO DE DADOS PARA DADOS ENRIQUECIDOS
-- ============================================================================

-- Tabela para dados de mercado em tempo real
CREATE TABLE IF NOT EXISTS public.market_data_realtime (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Dados Binance Futures
  funding_rate NUMERIC,
  open_interest NUMERIC,
  long_short_ratio NUMERIC,
  liquidations_24h NUMERIC,
  
  -- Trade Flow Data
  trade_flow_data JSONB,
  
  -- Status da API
  api_trading_status JSONB,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_market_data_realtime_symbol ON public.market_data_realtime(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_realtime_timestamp ON public.market_data_realtime(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_realtime_symbol_timestamp ON public.market_data_realtime(symbol, timestamp);

-- Tabela para histórico de indicadores técnicos
CREATE TABLE IF NOT EXISTS public.technical_indicators_history (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indicadores básicos
  rsi NUMERIC,
  macd_line NUMERIC,
  macd_signal NUMERIC,
  macd_histogram NUMERIC,
  
  -- Bollinger Bands
  bb_upper NUMERIC,
  bb_middle NUMERIC,
  bb_lower NUMERIC,
  bb_width NUMERIC,
  
  -- Médias móveis
  ema_9 NUMERIC,
  ema_21 NUMERIC,
  ema_50 NUMERIC,
  sma_20 NUMERIC,
  sma_50 NUMERIC,
  sma_200 NUMERIC,
  
  -- Volume
  volume_ma_20 NUMERIC,
  volume_ratio NUMERIC,
  
  -- Suporte e Resistência
  support_level NUMERIC,
  resistance_level NUMERIC,
  
  -- Dados OHLCV
  open_price NUMERIC,
  high_price NUMERIC,
  low_price NUMERIC,
  close_price NUMERIC,
  volume NUMERIC,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_technical_indicators_symbol ON public.technical_indicators_history(symbol);
CREATE INDEX IF NOT EXISTS idx_technical_indicators_timeframe ON public.technical_indicators_history(timeframe);
CREATE INDEX IF NOT EXISTS idx_technical_indicators_timestamp ON public.technical_indicators_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_technical_indicators_symbol_timeframe_timestamp ON public.technical_indicators_history(symbol, timeframe, timestamp);

-- Tabela para dados de sentiment
CREATE TABLE IF NOT EXISTS public.sentiment_data (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Fear & Greed Index
  fear_greed_index NUMERIC,
  
  -- Sentiment por fonte
  social_sentiment NUMERIC,
  news_sentiment NUMERIC,
  reddit_sentiment NUMERIC,
  twitter_sentiment NUMERIC,
  
  -- Volume de menções
  social_volume INTEGER,
  news_volume INTEGER,
  reddit_volume INTEGER,
  twitter_volume INTEGER,
  
  -- Dados brutos
  raw_data JSONB,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sentiment_data_symbol ON public.sentiment_data(symbol);
CREATE INDEX IF NOT EXISTS idx_sentiment_data_timestamp ON public.sentiment_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_sentiment_data_symbol_timestamp ON public.sentiment_data(symbol, timestamp);

-- Tabela para indicadores macroeconômicos
CREATE TABLE IF NOT EXISTS public.macro_indicators (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indicadores principais
  dxy NUMERIC, -- Dollar Index
  sp500 NUMERIC,
  nasdaq NUMERIC,
  gold_price NUMERIC,
  oil_price NUMERIC,
  bond_yield_10y NUMERIC,
  
  -- Indicadores econômicos
  inflation_rate NUMERIC,
  gdp_growth NUMERIC,
  unemployment_rate NUMERIC,
  fed_funds_rate NUMERIC,
  
  -- Dados brutos
  raw_data JSONB,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_macro_indicators_timestamp ON public.macro_indicators(timestamp);

-- Tabela para análise de correlação entre ativos
CREATE TABLE IF NOT EXISTS public.correlation_analysis (
  id BIGSERIAL PRIMARY KEY,
  symbol1 TEXT NOT NULL,
  symbol2 TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Métricas de correlação
  correlation_coefficient NUMERIC,
  correlation_p_value NUMERIC,
  
  -- Cointegração
  cointegration_statistic NUMERIC,
  cointegration_p_value NUMERIC,
  
  -- Granger Causality
  granger_causality_f_stat NUMERIC,
  granger_causality_p_value NUMERIC,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_correlation_symbols ON public.correlation_analysis(symbol1, symbol2);
CREATE INDEX IF NOT EXISTS idx_correlation_timeframe ON public.correlation_analysis(timeframe);
CREATE INDEX IF NOT EXISTS idx_correlation_timestamp ON public.correlation_analysis(timestamp);

-- Tabela para dados de performance do sistema
CREATE TABLE IF NOT EXISTS public.system_performance (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Métricas de performance
  total_trades INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  win_rate NUMERIC,
  
  -- P&L
  total_pnl NUMERIC,
  daily_pnl NUMERIC,
  weekly_pnl NUMERIC,
  monthly_pnl NUMERIC,
  
  -- Métricas de risco
  max_drawdown NUMERIC,
  sharpe_ratio NUMERIC,
  sortino_ratio NUMERIC,
  calmar_ratio NUMERIC,
  
  -- Métricas de trading
  profit_factor NUMERIC,
  avg_win NUMERIC,
  avg_loss NUMERIC,
  max_win NUMERIC,
  max_loss NUMERIC,
  
  -- Sequências
  max_consecutive_wins INTEGER,
  max_consecutive_losses INTEGER,
  
  -- Duração
  avg_trade_duration_minutes NUMERIC,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_performance_timestamp ON public.system_performance(timestamp);

-- Tabela para alertas e notificações
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Dados do alerta
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- low, medium, high, critical
  symbol TEXT,
  
  -- Conteúdo
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  
  -- Dados relacionados
  related_data JSONB,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON public.system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON public.system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_symbol ON public.system_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_system_alerts_timestamp ON public.system_alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_alerts_unread ON public.system_alerts(is_read) WHERE is_read = FALSE;

-- Ativar RLS nas novas tabelas
ALTER TABLE public.market_data_realtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_indicators_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correlation_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir leitura
CREATE POLICY "Permitir leitura de market_data_realtime" 
ON public.market_data_realtime FOR SELECT 
USING (true);

CREATE POLICY "Permitir leitura de technical_indicators_history" 
ON public.technical_indicators_history FOR SELECT 
USING (true);

CREATE POLICY "Permitir leitura de sentiment_data" 
ON public.sentiment_data FOR SELECT 
USING (true);

CREATE POLICY "Permitir leitura de macro_indicators" 
ON public.macro_indicators FOR SELECT 
USING (true);

CREATE POLICY "Permitir leitura de correlation_analysis" 
ON public.correlation_analysis FOR SELECT 
USING (true);

CREATE POLICY "Permitir leitura de system_performance" 
ON public.system_performance FOR SELECT 
USING (true);

CREATE POLICY "Permitir leitura de system_alerts" 
ON public.system_alerts FOR SELECT 
USING (true);

-- Views para análises rápidas
CREATE OR REPLACE VIEW public.market_overview AS
SELECT 
  symbol,
  MAX(timestamp) as last_update,
  AVG(funding_rate) as avg_funding_rate,
  AVG(open_interest) as avg_open_interest,
  AVG(long_short_ratio) as avg_long_short_ratio,
  SUM(liquidations_24h) as total_liquidations_24h
FROM public.market_data_realtime
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY symbol;

CREATE OR REPLACE VIEW public.sentiment_overview AS
SELECT 
  MAX(timestamp) as last_update,
  AVG(fear_greed_index) as avg_fear_greed,
  AVG(social_sentiment) as avg_social_sentiment,
  AVG(news_sentiment) as avg_news_sentiment,
  SUM(social_volume) as total_social_volume,
  SUM(news_volume) as total_news_volume
FROM public.sentiment_data
WHERE timestamp >= NOW() - INTERVAL '24 hours';

CREATE OR REPLACE VIEW public.system_health AS
SELECT 
  MAX(timestamp) as last_update,
  AVG(win_rate) as avg_win_rate,
  AVG(total_pnl) as avg_total_pnl,
  AVG(sharpe_ratio) as avg_sharpe_ratio,
  AVG(max_drawdown) as avg_max_drawdown,
  COUNT(*) as performance_records
FROM public.system_performance
WHERE timestamp >= NOW() - INTERVAL '7 days';

-- Função para limpeza automática de dados antigos
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Limpar dados de mercado mais antigos que 30 dias
  DELETE FROM public.market_data_realtime 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  -- Limpar indicadores técnicos mais antigos que 90 dias
  DELETE FROM public.technical_indicators_history 
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  -- Limpar dados de sentiment mais antigos que 30 dias
  DELETE FROM public.sentiment_data 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  -- Limpar indicadores macro mais antigos que 365 dias
  DELETE FROM public.macro_indicators 
  WHERE timestamp < NOW() - INTERVAL '365 days';
  
  -- Limpar análise de correlação mais antiga que 30 dias
  DELETE FROM public.correlation_analysis 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  -- Limpar performance do sistema mais antiga que 365 dias
  DELETE FROM public.system_performance 
  WHERE timestamp < NOW() - INTERVAL '365 days';
  
  -- Limpar alertas resolvidos mais antigos que 30 dias
  DELETE FROM public.system_alerts 
  WHERE is_resolved = TRUE AND resolved_at < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Limpeza de dados antigos concluída';
END;
$$ LANGUAGE plpgsql;

-- Criar job para limpeza automática (requer pg_cron)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

-- Comentários para documentação
COMMENT ON TABLE public.market_data_realtime IS 'Dados de mercado em tempo real da Binance Futures';
COMMENT ON TABLE public.technical_indicators_history IS 'Histórico de indicadores técnicos calculados';
COMMENT ON TABLE public.sentiment_data IS 'Dados de sentiment do mercado e redes sociais';
COMMENT ON TABLE public.macro_indicators IS 'Indicadores macroeconômicos globais';
COMMENT ON TABLE public.correlation_analysis IS 'Análise de correlação entre ativos';
COMMENT ON TABLE public.system_performance IS 'Métricas de performance do sistema de trading';
COMMENT ON TABLE public.system_alerts IS 'Alertas e notificações do sistema';
