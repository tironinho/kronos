-- ============================================================================
-- TABELA: trade_price_history
-- ============================================================================
-- Armazena histórico de preços e comportamento de cada trade ao longo do tempo
-- Permite análise detalhada de performance e comportamento de mercado
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trade_price_history (
  id BIGSERIAL PRIMARY KEY,
  trade_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Preços
  current_price NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  high_price NUMERIC,  -- Maior preço desde a entrada
  low_price NUMERIC,   -- Menor preço desde a entrada
  
  -- P&L
  pnl NUMERIC NOT NULL DEFAULT 0,
  pnl_percent NUMERIC NOT NULL DEFAULT 0,
  
  -- Métricas de movimento
  price_change NUMERIC DEFAULT 0,        -- Mudança absoluta de preço
  price_change_percent NUMERIC DEFAULT 0, -- Mudança percentual
  
  -- Distâncias até targets
  distance_to_stop_loss NUMERIC,         -- Distância até SL (%)
  distance_to_take_profit NUMERIC,       -- Distância até TP (%)
  
  -- Volume e liquidez
  volume_24h NUMERIC,                     -- Volume 24h
  volume_change_percent NUMERIC,         -- Mudança de volume (%)
  
  -- Indicadores técnicos (opcional, para análise avançada)
  rsi NUMERIC,                           -- RSI atual
  macd NUMERIC,                          -- MACD atual
  bb_position NUMERIC,                   -- Posição nas Bandas de Bollinger (0-1)
  
  -- Volatilidade
  volatility_24h NUMERIC,                -- Volatilidade 24h (%)
  atr NUMERIC,                           -- Average True Range
  
  -- Tempo decorrido
  minutes_since_entry INTEGER,           -- Minutos desde abertura da trade
  hours_since_entry NUMERIC,             -- Horas desde abertura (preciso)
  
  -- Condições de mercado no momento
  market_condition TEXT,                 -- 'bullish', 'bearish', 'sideways', etc
  funding_rate NUMERIC,                   -- Taxa de funding (Futures)
  
  -- Metadados
  notes TEXT,                            -- Notas adicionais
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_trade_price_history_trade_id ON public.trade_price_history(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_price_history_symbol ON public.trade_price_history(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_price_history_timestamp ON public.trade_price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_trade_price_history_trade_timestamp ON public.trade_price_history(trade_id, timestamp DESC);

-- Índice composto para consultas rápidas por trade e período
CREATE INDEX IF NOT EXISTS idx_trade_price_history_composite ON public.trade_price_history(trade_id, timestamp DESC);

-- Comentários para documentação
COMMENT ON TABLE public.trade_price_history IS 'Histórico detalhado de preços e métricas de cada trade para análise posterior';
COMMENT ON COLUMN public.trade_price_history.trade_id IS 'ID da trade (FK para real_trades.trade_id)';
COMMENT ON COLUMN public.trade_price_history.pnl_percent IS 'P&L percentual em relação ao capital investido';
COMMENT ON COLUMN public.trade_price_history.distance_to_stop_loss IS 'Distância percentual até o stop loss (negativo se já passou)';
COMMENT ON COLUMN public.trade_price_history.distance_to_take_profit IS 'Distância percentual até o take profit';
COMMENT ON COLUMN public.trade_price_history.bb_position IS 'Posição nas Bandas de Bollinger: 0 = lower, 0.5 = middle, 1 = upper';

