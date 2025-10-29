# Sistema de Monitoramento de Preços das Trades

## 📊 Visão Geral

Sistema completo para monitorar e registrar o histórico de preços de todas as trades em execução, permitindo análise detalhada de comportamento, performance e padrões de mercado.

## 🎯 Funcionalidades

### 1. **Registro Automático de Snapshots**
- Captura de preços a cada 1 minuto (configurável)
- Mínimo de 30 segundos entre snapshots da mesma trade (evita spam)
- Registro automático quando trades estão abertas

### 2. **Dados Coletados**

#### Preços
- `current_price`: Preço atual do ativo
- `entry_price`: Preço de entrada da trade
- `high_price`: Maior preço desde a entrada
- `low_price`: Menor preço desde a entrada

#### P&L e Métricas
- `pnl`: P&L absoluto em USDT
- `pnl_percent`: P&L percentual em relação ao capital investido
- `price_change`: Mudança absoluta de preço desde último snapshot
- `price_change_percent`: Mudança percentual de preço

#### Distâncias até Targets
- `distance_to_stop_loss`: Distância percentual até o Stop Loss
- `distance_to_take_profit`: Distância percentual até o Take Profit

#### Volume e Liquidez
- `volume_24h`: Volume negociado nas últimas 24h
- `volume_change_percent`: Mudança percentual de volume

#### Indicadores Técnicos (Opcional)
- `rsi`: RSI atual
- `macd`: MACD atual
- `bb_position`: Posição nas Bandas de Bollinger (0-1)

#### Volatilidade
- `volatility_24h`: Volatilidade das últimas 24h (%)
- `atr`: Average True Range

#### Tempo e Condições
- `minutes_since_entry`: Minutos desde abertura da trade
- `hours_since_entry`: Horas desde abertura (preciso)
- `market_condition`: Condição de mercado ('bullish', 'bearish', 'sideways', etc)
- `funding_rate`: Taxa de funding (Futures)

## 🗄️ Estrutura do Banco de Dados

### Tabela: `trade_price_history`

```sql
CREATE TABLE trade_price_history (
  id BIGSERIAL PRIMARY KEY,
  trade_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  current_price NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  high_price NUMERIC,
  low_price NUMERIC,
  pnl NUMERIC NOT NULL DEFAULT 0,
  pnl_percent NUMERIC NOT NULL DEFAULT 0,
  price_change NUMERIC DEFAULT 0,
  price_change_percent NUMERIC DEFAULT 0,
  distance_to_stop_loss NUMERIC,
  distance_to_take_profit NUMERIC,
  volume_24h NUMERIC,
  volume_change_percent NUMERIC,
  rsi NUMERIC,
  macd NUMERIC,
  bb_position NUMERIC,
  volatility_24h NUMERIC,
  atr NUMERIC,
  minutes_since_entry INTEGER,
  hours_since_entry NUMERIC,
  market_condition TEXT,
  funding_rate NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Índices:**
- `idx_trade_price_history_trade_id`: Busca rápida por trade
- `idx_trade_price_history_symbol`: Busca rápida por símbolo
- `idx_trade_price_history_timestamp`: Ordenação por tempo
- `idx_trade_price_history_composite`: Busca composta (trade_id + timestamp)

## 🔧 Implementação

### 1. **Serviço de Monitoramento**

**Arquivo:** `engine-v2/src/services/trade-price-monitor.service.ts`

**Métodos principais:**
- `startMonitoring()`: Inicia monitoramento contínuo
- `stopMonitoring()`: Para o monitoramento
- `getTradePriceHistory(tradeId, limit)`: Obtém histórico de uma trade
- `getTradeStatistics(tradeId)`: Calcula estatísticas de uma trade

### 2. **Integração no Trading Engine**

O monitoramento é iniciado automaticamente quando o trading é iniciado:

```typescript
// Em startTradingFutures()
await tradePriceMonitor.startMonitoring();
```

E roda em background durante todo o ciclo de trading.

### 3. **API Endpoints**

#### GET `/api/trades/price-history`

**Query Parameters:**
- `trade_id` (opcional): ID da trade específica
- `symbol` (opcional): Filtrar por símbolo
- `limit` (opcional): Limite de registros (padrão: 1000)
- `start_date` (opcional): Data de início (ISO string)
- `end_date` (opcional): Data de fim (ISO string)
- `statistics` (opcional): Se `true`, retorna estatísticas

**Exemplo:**
```bash
GET /api/trades/price-history?trade_id=abc123&statistics=true
```

#### POST `/api/trades/price-history/statistics`

**Body:**
```json
{
  "trade_ids": ["trade1", "trade2"],
  "symbols": ["BTCUSDT", "ETHUSDT"]
}
```

**Retorna:** Estatísticas agregadas de múltiplas trades

## 📈 Casos de Uso

### 1. **Análise de Performance**
- Identificar padrões de comportamento de trades vencedoras vs perdedoras
- Analisar momento ideal para entrar/sair
- Correlacionar performance com condições de mercado

### 2. **Otimização de Estratégia**
- Verificar se Stop Loss está adequado (trades que quase acionaram SL)
- Ajustar Take Profit baseado em histórico (quando trades atingem TP)
- Identificar timing ideal para fechar trades lucrativas

### 3. **Detecção de Padrões**
- Padrões de volatilidade antes de reversões
- Comportamento de volume em pontos de entrada/saída
- Correlação entre funding rate e performance (Futures)

### 4. **Backtesting e Validação**
- Validar estratégias usando dados históricos reais
- Comparar performance teórica vs real
- Identificar desvios entre previsão e realidade

## 🔍 Exemplos de Consultas SQL

### Histórico completo de uma trade
```sql
SELECT * 
FROM trade_price_history 
WHERE trade_id = 'abc123' 
ORDER BY timestamp ASC;
```

### P&L máximo e mínimo de uma trade
```sql
SELECT 
  MAX(pnl_percent) as max_pnl,
  MIN(pnl_percent) as min_pnl,
  MAX(current_price) as highest_price,
  MIN(current_price) as lowest_price
FROM trade_price_history 
WHERE trade_id = 'abc123';
```

### Trades que quase acionaram Stop Loss
```sql
SELECT DISTINCT trade_id, symbol, MIN(distance_to_stop_loss) as closest_to_sl
FROM trade_price_history
WHERE distance_to_stop_loss IS NOT NULL 
  AND distance_to_stop_loss < 1  -- Menos de 1% até SL
GROUP BY trade_id, symbol
ORDER BY closest_to_sl ASC;
```

### Análise de volatilidade por trade
```sql
SELECT 
  trade_id,
  symbol,
  COUNT(*) as snapshots,
  AVG(ABS(price_change_percent)) as avg_volatility,
  MAX(ABS(price_change_percent)) as max_volatility
FROM trade_price_history
GROUP BY trade_id, symbol
ORDER BY avg_volatility DESC;
```

### Performance ao longo do tempo (últimas 24h)
```sql
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(pnl_percent) as avg_pnl,
  COUNT(DISTINCT trade_id) as active_trades
FROM trade_price_history
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour ASC;
```

## ⚙️ Configuração

### Intervalo de Monitoramento

Por padrão, snapshots são criados a cada **1 minuto**. Para alterar:

```typescript
// Em trade-price-monitor.service.ts
private readonly MONITORING_INTERVAL = 60000; // 1 minuto (em ms)
```

### Mínimo entre Snapshots

Mínimo de **30 segundos** entre snapshots da mesma trade:

```typescript
// Evitar snapshots muito frequentes (mínimo 30s)
if (lastSnapshot && (now - lastSnapshot) < 30000) {
  return; // Pular
}
```

## 📊 Estatísticas Calculadas

Quando `statistics=true` é passado na query, são calculadas:

- `total_snapshots`: Total de snapshots registrados
- `entry_price`: Preço de entrada
- `current_price`: Preço atual (último snapshot)
- `highest_price`: Maior preço atingido
- `lowest_price`: Menor preço atingido
- `max_pnl_percent`: Maior P&L percentual alcançado
- `min_pnl_percent`: Menor P&L percentual
- `current_pnl_percent`: P&L percentual atual
- `duration_hours`: Duração da trade em horas
- `price_volatility`: Volatilidade de preços (desvio padrão)

## 🚀 Próximos Passos

1. **Dashboard Visual**: Criar gráficos de evolução de preços
2. **Alertas Inteligentes**: Alertar quando trades se aproximam de SL/TP
3. **Análise Preditiva**: ML para prever comportamento futuro
4. **Exportação**: Exportar histórico em CSV/Excel para análise externa
5. **Correlação com Indicadores**: Adicionar mais indicadores técnicos

## ✅ Como Usar

1. **Criar tabela no Supabase:**
   ```sql
   -- Execute o arquivo schema_trade_price_history.sql no Supabase SQL Editor
   ```

2. **O sistema inicia automaticamente** quando o trading engine é iniciado

3. **Consultar histórico via API:**
   ```bash
   # Histórico de uma trade específica
   GET /api/trades/price-history?trade_id=abc123
   
   # Com estatísticas
   GET /api/trades/price-history?trade_id=abc123&statistics=true
   
   # Filtrar por símbolo
   GET /api/trades/price-history?symbol=BTCUSDT&limit=100
   ```

4. **Monitorar logs:**
   ```
   📊 Monitorando 5 trade(s) aberta(s)
   📊 Snapshot criado para BTCUSDT (abc123): P&L +2.45%
   ```

O sistema está totalmente funcional e pronto para uso! 🎉

