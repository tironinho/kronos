/**
 * ANÁLISE COMPLETA DO SISTEMA - Cruzamento de Regras x Dados do Banco
 */

const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  try {
    require('dotenv').config();
  } catch (e2) {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

const supabase = createClient(supabaseUrl, supabaseKey);

// REGRAS IMPLEMENTADAS
const REGRAS = {
  minWinRate: 60,
  minConfidence: 70,
  maxDrawdown: 8,
  minProfitFactor: 2.0,
  maxPositionsPerSymbol: 1,
  maxTotalPositions: 2,
  stopLossPct: 5,
  takeProfitPct: 10,
  minRiskRewardRatio: 2.5,
  minVolumeFactor: 2.0,
  maxVolatility: 3.0
};

async function analiseCompleta() {
  console.log('='.repeat(100));
  console.log('📊 ANÁLISE COMPLETA DO SISTEMA - REGRAS x DADOS DO BANCO');
  console.log('='.repeat(100));
  console.log('');

  // ============================================================
  // 1. ANÁLISE DE TRADES REAIS
  // ============================================================
  console.log('1️⃣ ANÁLISE DE TRADES REAIS (real_trades)');
  console.log('-'.repeat(100));

  const { data: allTrades, error: tradesError } = await supabase
    .from('real_trades')
    .select('*')
    .order('opened_at', { ascending: false });

  if (tradesError) {
    console.error('❌ Erro ao buscar trades:', tradesError);
    return;
  }

  if (!allTrades || allTrades.length === 0) {
    console.log('⚠️ Nenhuma trade encontrada no banco');
  } else {
    const closedTrades = allTrades.filter(t => t.status === 'closed');
    const openTrades = allTrades.filter(t => t.status === 'open');

    console.log(`   Total de Trades: ${allTrades.length}`);
    console.log(`   Trades Fechadas: ${closedTrades.length}`);
    console.log(`   Trades Abertas: ${openTrades.length}`);
    console.log('');

    // Análise de trades fechadas
    if (closedTrades.length > 0) {
      const totalPnL = closedTrades.reduce((sum, t) => sum + (parseFloat(t.pnl || '0') || 0), 0);
      const winningTrades = closedTrades.filter(t => parseFloat(t.pnl || '0') > 0);
      const losingTrades = closedTrades.filter(t => parseFloat(t.pnl || '0') < 0);
      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

      const winsValue = winningTrades.reduce((sum, t) => sum + Math.abs(parseFloat(t.pnl || '0')), 0);
      const lossesValue = losingTrades.reduce((sum, t) => sum + Math.abs(parseFloat(t.pnl || '0')), 0);
      const profitFactor = lossesValue > 0 ? winsValue / lossesValue : (winsValue > 0 ? 999 : 0);

      const avgConfidence = closedTrades.reduce((sum, t) => sum + (parseFloat(t.confidence || '0') || 0), 0) / closedTrades.length;

      console.log('   📊 Performance de Trades Fechadas:');
      console.log(`      💰 P&L Total: $${totalPnL.toFixed(4)}`);
      console.log(`      ✅ Vitórias: ${winningTrades.length}`);
      console.log(`      ❌ Derrotas: ${losingTrades.length}`);
      console.log(`      📈 Win Rate: ${winRate.toFixed(2)}% ${winRate >= REGRAS.minWinRate ? '✅' : '❌'}`);
      console.log(`      📊 Profit Factor: ${profitFactor.toFixed(2)} ${profitFactor >= REGRAS.minProfitFactor ? '✅' : '❌'}`);
      console.log(`      🎯 Confiança Média: ${avgConfidence.toFixed(2)}% ${avgConfidence >= REGRAS.minConfidence ? '✅' : '❌'}`);
      console.log('');

      // Verificar conformidade com regras
      console.log('   ✅ Verificação de Conformidade com Regras:');
      console.log(`      ${winRate >= REGRAS.minWinRate ? '✅' : '❌'} Win Rate >= ${REGRAS.minWinRate}%: ${winRate.toFixed(2)}%`);
      console.log(`      ${profitFactor >= REGRAS.minProfitFactor ? '✅' : '❌'} Profit Factor >= ${REGRAS.minProfitFactor}: ${profitFactor.toFixed(2)}`);
      console.log(`      ${avgConfidence >= REGRAS.minConfidence ? '✅' : '❌'} Confiança Média >= ${REGRAS.minConfidence}%: ${avgConfidence.toFixed(2)}%`);
      console.log('');
    }

    // Análise de trades abertas
    if (openTrades.length > 0) {
      console.log('   📊 Trades Abertas Atuais:');
      
      const tradesBySymbol = {};
      openTrades.forEach(t => {
        if (!tradesBySymbol[t.symbol]) {
          tradesBySymbol[t.symbol] = [];
        }
        tradesBySymbol[t.symbol].push(t);
      });

      Object.entries(tradesBySymbol).forEach(([symbol, trades]) => {
        console.log(`      ${symbol}: ${trades.length} trade(s) aberta(s)`);
        if (trades.length > REGRAS.maxPositionsPerSymbol) {
          console.log(`         ⚠️ VIOLAÇÃO: Máximo permitido é ${REGRAS.maxPositionsPerSymbol}`);
        }
      });

      console.log('');
      console.log(`      ${openTrades.length <= REGRAS.maxTotalPositions ? '✅' : '❌'} Total de Trades Abertas (${openTrades.length}) <= ${REGRAS.maxTotalPositions}`);
      console.log('');
    }
  }

  // ============================================================
  // 2. ANÁLISE DE PARÂMETROS DE ANÁLISE
  // ============================================================
  console.log('2️⃣ ANÁLISE DE PARÂMETROS DE DECISÃO (trade_analysis_parameters)');
  console.log('-'.repeat(100));

  const { data: analysisParams, error: paramsError } = await supabase
    .from('trade_analysis_parameters')
    .select('*')
    .order('analysis_timestamp', { ascending: false })
    .limit(50);

  if (paramsError) {
    console.log('   ⚠️ Erro ao buscar parâmetros:', paramsError.message);
  } else if (!analysisParams || analysisParams.length === 0) {
    console.log('   ⚠️ Nenhum parâmetro de análise encontrado');
    console.log('   ⚠️ SISTEMA PODE NÃO ESTAR CAPTURANDO PARÂMETROS CORRETAMENTE');
  } else {
    console.log(`   📊 Parâmetros Analisados: ${analysisParams.length}`);
    
    // Calcular médias de indicadores
    const avgConfidence = analysisParams.reduce((sum, p) => sum + (parseFloat(p.decision_confidence || '0') || 0), 0) / analysisParams.length;
    const avgTechnicalRSI = analysisParams.filter(p => p.technical_rsi).reduce((sum, p) => sum + parseFloat(p.technical_rsi), 0) / analysisParams.filter(p => p.technical_rsi).length;
    const tradesWithMultipleConfirmations = analysisParams.filter(p => p.decision_multiple_confirmations === true).length;
    const tradesVolumeConfirmed = analysisParams.filter(p => p.decision_volume_confirmed === true).length;

    console.log('');
    console.log('   📈 Métricas Médias dos Parâmetros:');
    console.log(`      🎯 Confiança Média na Decisão: ${avgConfidence.toFixed(2)}%`);
    console.log(`      📊 RSI Médio: ${avgTechnicalRSI.toFixed(2)}`);
    console.log(`      ✅ Múltiplas Confirmações: ${tradesWithMultipleConfirmations}/${analysisParams.length} (${((tradesWithMultipleConfirmations/analysisParams.length)*100).toFixed(1)}%)`);
    console.log(`      📊 Volume Confirmado: ${tradesVolumeConfirmed}/${analysisParams.length} (${((tradesVolumeConfirmed/analysisParams.length)*100).toFixed(1)}%)`);
    console.log('');

    // Verificar distribuição de confiança
    const confidenceDistribution = {
      '70-100': analysisParams.filter(p => parseFloat(p.decision_confidence || '0') >= 70).length,
      '60-70': analysisParams.filter(p => parseFloat(p.decision_confidence || '0') >= 60 && parseFloat(p.decision_confidence || '0') < 70).length,
      '50-60': analysisParams.filter(p => parseFloat(p.decision_confidence || '0') >= 50 && parseFloat(p.decision_confidence || '0') < 60).length,
      '<50': analysisParams.filter(p => parseFloat(p.decision_confidence || '0') < 50).length
    };

    console.log('   📊 Distribuição de Confiança:');
    Object.entries(confidenceDistribution).forEach(([range, count]) => {
      const pct = (count / analysisParams.length) * 100;
      console.log(`      ${range}%: ${count} (${pct.toFixed(1)}%)`);
    });
    console.log('');
  }

  // ============================================================
  // 3. ANÁLISE DE INDICADORES TÉCNICOS
  // ============================================================
  console.log('3️⃣ ANÁLISE DE INDICADORES TÉCNICOS (technical_indicators_history)');
  console.log('-'.repeat(100));

  const { data: techIndicators, error: techError } = await supabase
    .from('technical_indicators_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100);

  if (techError) {
    console.log('   ⚠️ Erro ao buscar indicadores:', techError.message);
  } else if (!techIndicators || techIndicators.length === 0) {
    console.log('   ⚠️ Nenhum indicador técnico encontrado');
    console.log('   ⚠️ TABELA PODE NÃO ESTAR SENDO POPULADA');
  } else {
    console.log(`   📊 Indicadores Técnicos Encontrados: ${techIndicators.length}`);
    
    const symbols = [...new Set(techIndicators.map(t => t.symbol))];
    console.log(`   📊 Símbolos Analisados: ${symbols.join(', ')}`);
    
    // Análise de RSI
    const rsiValues = techIndicators.filter(t => t.rsi).map(t => parseFloat(t.rsi));
    if (rsiValues.length > 0) {
      const avgRSI = rsiValues.reduce((a, b) => a + b, 0) / rsiValues.length;
      const overbought = rsiValues.filter(r => r > 70).length;
      const oversold = rsiValues.filter(r => r < 30).length;
      console.log('');
      console.log('   📊 Análise RSI:');
      console.log(`      RSI Médio: ${avgRSI.toFixed(2)}`);
      console.log(`      Zona Overbought (>70): ${overbought}/${rsiValues.length}`);
      console.log(`      Zona Oversold (<30): ${oversold}/${rsiValues.length}`);
    }
  }
  console.log('');

  // ============================================================
  // 4. ANÁLISE DE SENTIMENTO
  // ============================================================
  console.log('4️⃣ ANÁLISE DE SENTIMENTO (sentiment_data)');
  console.log('-'.repeat(100));

  const { data: sentimentData, error: sentimentError } = await supabase
    .from('sentiment_data')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  if (sentimentError) {
    console.log('   ⚠️ Erro ao buscar sentiment:', sentimentError.message);
  } else if (!sentimentData || sentimentData.length === 0) {
    console.log('   ⚠️ Nenhum dado de sentiment encontrado');
    console.log('   ⚠️ TABELA PODE NÃO ESTAR SENDO POPULADA');
  } else {
    console.log(`   📊 Registros de Sentiment: ${sentimentData.length}`);
    
    const avgFearGreed = sentimentData
      .filter(s => s.fear_greed_index)
      .reduce((sum, s) => sum + parseFloat(s.fear_greed_index), 0) / sentimentData.filter(s => s.fear_greed_index).length;

    if (avgFearGreed) {
      let sentimentLevel = 'Neutro';
      if (avgFearGreed > 75) sentimentLevel = 'Extremo Ganância';
      else if (avgFearGreed > 55) sentimentLevel = 'Ganância';
      else if (avgFearGreed < 25) sentimentLevel = 'Extremo Medo';
      else if (avgFearGreed < 45) sentimentLevel = 'Medo';

      console.log(`   📊 Fear & Greed Index Médio: ${avgFearGreed.toFixed(2)} (${sentimentLevel})`);
    }
  }
  console.log('');

  // ============================================================
  // 5. ANÁLISE DE DADOS DE MERCADO
  // ============================================================
  console.log('5️⃣ ANÁLISE DE DADOS DE MERCADO (market_data_realtime)');
  console.log('-'.repeat(100));

  const { data: marketData, error: marketError } = await supabase
    .from('market_data_realtime')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  if (marketError) {
    console.log('   ⚠️ Erro ao buscar dados de mercado:', marketError.message);
  } else if (!marketData || marketData.length === 0) {
    console.log('   ⚠️ Nenhum dado de mercado encontrado');
    console.log('   ⚠️ TABELA PODE NÃO ESTAR SENDO POPULADA');
  } else {
    console.log(`   📊 Registros de Dados de Mercado: ${marketData.length}`);
    
    const symbols = [...new Set(marketData.map(m => m.symbol))];
    console.log(`   📊 Símbolos Monitorados: ${symbols.join(', ')}`);
    
    // Análise de funding rate
    const fundingRates = marketData
      .filter(m => m.funding_rate)
      .map(m => parseFloat(m.funding_rate));
    
    if (fundingRates.length > 0) {
      const avgFunding = fundingRates.reduce((a, b) => a + b, 0) / fundingRates.length;
      const extremeBullish = fundingRates.filter(f => f > 0.1).length;
      
      console.log('');
      console.log('   📊 Análise de Funding Rate:');
      console.log(`      Funding Rate Médio: ${(avgFunding * 100).toFixed(4)}%`);
      console.log(`      Extremos Bullish (>0.1%): ${extremeBullish}`);
    }
  }
  console.log('');

  // ============================================================
  // 6. ANÁLISE DE PERFORMANCE DO SISTEMA
  // ============================================================
  console.log('6️⃣ ANÁLISE DE PERFORMANCE DO SISTEMA (system_performance)');
  console.log('-'.repeat(100));

  const { data: systemPerf, error: perfError } = await supabase
    .from('system_performance')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10);

  if (perfError) {
    console.log('   ⚠️ Erro ao buscar performance:', perfError.message);
  } else if (!systemPerf || systemPerf.length === 0) {
    console.log('   ⚠️ Nenhum dado de performance encontrado');
  } else {
    const latest = systemPerf[0];
    console.log('   📊 Performance Mais Recente:');
    console.log(`      Total de Trades: ${latest.total_trades || 0}`);
    console.log(`      Win Rate: ${(parseFloat(latest.win_rate || '0') * 100).toFixed(2)}%`);
    console.log(`      P&L Total: $${(parseFloat(latest.total_pnl || '0')).toFixed(4)}`);
    console.log(`      Max Drawdown: ${(parseFloat(latest.max_drawdown || '0') * 100).toFixed(2)}%`);
    console.log(`      Sharpe Ratio: ${(parseFloat(latest.sharpe_ratio || '0')).toFixed(2)}`);
    console.log(`      Profit Factor: ${(parseFloat(latest.profit_factor || '0')).toFixed(2)}`);
  }
  console.log('');

  // ============================================================
  // 7. ANÁLISE DE MONTE CARLO
  // ============================================================
  console.log('7️⃣ ANÁLISE DE SIMULAÇÕES MONTE CARLO');
  console.log('-'.repeat(100));

  const { data: monteCarlo, error: mcError } = await supabase
    .from('monte_carlo_simulations')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(20);

  if (mcError) {
    console.log('   ⚠️ Erro ao buscar Monte Carlo:', mcError.message);
  } else if (!monteCarlo || monteCarlo.length === 0) {
    console.log('   ⚠️ Nenhuma simulação Monte Carlo encontrada');
  } else {
    console.log(`   📊 Simulações Encontradas: ${monteCarlo.length}`);
    
    const avgSuccessProb = monteCarlo
      .filter(m => m.success_probability)
      .reduce((sum, m) => sum + parseFloat(m.success_probability || '0'), 0) / monteCarlo.filter(m => m.success_probability).length;

    console.log(`   📊 Probabilidade de Sucesso Média: ${(avgSuccessProb * 100).toFixed(2)}%`);
  }
  console.log('');

  // ============================================================
  // 8. RESUMO E CONCLUSÕES
  // ============================================================
  console.log('='.repeat(100));
  console.log('📋 RESUMO E CONCLUSÕES');
  console.log('='.repeat(100));
  console.log('');

  const tablesStatus = {
    'real_trades': allTrades && allTrades.length > 0 ? '✅' : '❌',
    'trade_analysis_parameters': analysisParams && analysisParams.length > 0 ? '✅' : '❌',
    'technical_indicators_history': techIndicators && techIndicators.length > 0 ? '✅' : '❌',
    'sentiment_data': sentimentData && sentimentData.length > 0 ? '✅' : '❌',
    'market_data_realtime': marketData && marketData.length > 0 ? '✅' : '❌',
    'system_performance': systemPerf && systemPerf.length > 0 ? '✅' : '❌',
    'monte_carlo_simulations': monteCarlo && monteCarlo.length > 0 ? '✅' : '❌'
  };

  console.log('   📊 Status de População das Tabelas:');
  Object.entries(tablesStatus).forEach(([table, status]) => {
    console.log(`      ${status} ${table}`);
  });
  console.log('');

  const emptyTables = Object.entries(tablesStatus).filter(([_, status]) => status === '❌').map(([table, _]) => table);
  if (emptyTables.length > 0) {
    console.log('   ⚠️ TABELAS VAZIAS (verificar database-population-service.ts):');
    emptyTables.forEach(table => console.log(`      - ${table}`));
    console.log('');
  }

  console.log('   ✅ Recomendações:');
  console.log('      1. Verificar se database-population-service.ts está rodando');
  console.log('      2. Validar logs para erros de população');
  console.log('      3. Confirmar que indicadores estão sendo salvos corretamente');
  console.log('      4. Usar trade_analysis_parameters para ajustar pesos de indicadores');
  console.log('');
}

analiseCompleta()
  .then(() => {
    console.log('✅ Análise concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro na análise:', error);
    process.exit(1);
  });

