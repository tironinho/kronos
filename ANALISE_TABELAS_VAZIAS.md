# Análise de Tabelas Vazias do Banco de Dados

## 📊 Status das Tabelas

### ✅ Tabelas Populadas (Com Código Ativo)
1. **`real_trades`** - ✅ Populada via `advanced-trading-engine.ts`
2. **`equity_history`** - ✅ Populada via `advanced-trading-engine.ts` (recordEquityPeriodically)
3. **`trade_price_history`** - ✅ Populada via `trade-price-monitor.service.ts` (recém implementado)

### ⚠️ Tabelas com Código, Mas Não Chamadas Regularmente
4. **`market_data_realtime`** - ⚠️ Código em `data-persistence-service.ts`, mas não chamado
5. **`sentiment_data`** - ⚠️ Código em `data-persistence-service.ts`, mas não chamado
6. **`macro_indicators`** - ⚠️ Código em `data-persistence-service.ts`, mas não chamado
7. **`system_performance`** - ⚠️ Código em `data-persistence-service.ts`, mas não chamado
8. **`system_alerts`** - ⚠️ Código em `data-persistence-service.ts`, mas não chamado
9. **`trade_analysis_parameters`** - ⚠️ Código em `trade-analysis-capture.ts`, mas não chamado no ciclo principal

### ❌ Tabelas Sem Código de Inserção
10. **`kronos_metrics`** - ❌ Nenhum código encontrado
11. **`kronos_events`** - ❌ Nenhum código encontrado
12. **`technical_indicators_history`** - ❌ Nenhum código encontrado
13. **`backtest_results`** - ❌ Código provavelmente em `automated-backtesting-module.ts`, mas não executado
14. **`monte_carlo_simulations`** - ⚠️ Código em `supabase-db.ts`, mas não chamado regularmente
15. **`trading_signals`** - ❌ Código provavelmente existe, mas não usado
16. **`orders`** - ❌ Código provavelmente existe, mas não usado
17. **`simulated_trades`** - ⚠️ Código em `trade-simulator-engine.ts`, mas não usado
18. **`simulation_config`** - ⚠️ Código existe, mas não usado
19. **`simulation_stats`** - ⚠️ Código existe, mas não usado
20. **`correlation_analysis`** - ❌ Sem código
21. **`trade_ai_analysis`** - ❌ Sem código
22. **`sentiment_data`** - ⚠️ Parcial (algumas inserções)

## 🔧 Solução: Criar Serviço de Preenchimento Automático

Vou criar um serviço que será chamado no ciclo principal do trading engine para preencher todas essas tabelas automaticamente.

