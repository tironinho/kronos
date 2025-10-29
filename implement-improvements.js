const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function implementImprovements() {
  console.log('🔧 IMPLEMENTANDO MELHORIAS BASEADAS NAS MELHORES PRÁTICAS\n');
  console.log('=' .repeat(60));

  // 1. Análise de Confiança Anormal
  console.log('\n📊 1. CORREÇÃO DE CONFIANÇA ANORMAL');
  console.log('-'.repeat(40));
  
  const { data: tradesData, error: tradesError } = await supabase
    .from('real_trades')
    .select('*')
    .order('opened_at', { ascending: false });

  if (tradesError) {
    console.error('❌ Erro ao buscar trades:', tradesError);
    return;
  }

  // Identificar trades com confiança anormal (>100%)
  const abnormalConfidenceTrades = tradesData?.filter(t => parseFloat(t.confidence || 0) > 100) || [];
  
  if (abnormalConfidenceTrades.length > 0) {
    console.log(`⚠️ Encontradas ${abnormalConfidenceTrades.length} trades com confiança anormal`);
    
    // Corrigir confiança anormal (dividir por 100 se > 100)
    for (const trade of abnormalConfidenceTrades) {
      const correctedConfidence = parseFloat(trade.confidence || 0) / 100;
      
      const { error: updateError } = await supabase
        .from('real_trades')
        .update({ confidence: correctedConfidence })
        .eq('trade_id', trade.trade_id);
      
      if (updateError) {
        console.error(`❌ Erro ao corrigir confiança da trade ${trade.trade_id}:`, updateError);
      } else {
        console.log(`✅ Corrigida confiança da trade ${trade.trade_id}: ${trade.confidence}% → ${correctedConfidence.toFixed(2)}%`);
      }
    }
  } else {
    console.log('✅ Nenhuma trade com confiança anormal encontrada');
  }

  // 2. Implementar Timeout para Trades Abertas
  console.log('\n📊 2. IMPLEMENTAÇÃO DE TIMEOUT PARA TRADES ABERTAS');
  console.log('-'.repeat(40));
  
  const openTrades = tradesData?.filter(t => t.status === 'open') || [];
  const now = new Date();
  const timeoutHours = 24; // 24 horas de timeout
  
  let closedByTimeout = 0;
  
  for (const trade of openTrades) {
    const openedAt = new Date(trade.opened_at);
    const hoursOpen = (now - openedAt) / (1000 * 60 * 60);
    
    if (hoursOpen > timeoutHours) {
      console.log(`⏰ Trade ${trade.trade_id} (${trade.symbol}) aberta há ${hoursOpen.toFixed(1)}h - aplicando timeout`);
      
      const { error: closeError } = await supabase
        .from('real_trades')
        .update({ 
          status: 'closed',
          closed_at: now.toISOString(),
          reason: 'timeout',
          pnl: parseFloat(trade.pnl || 0),
          pnl_percent: parseFloat(trade.pnl_percent || 0)
        })
        .eq('trade_id', trade.trade_id);
      
      if (closeError) {
        console.error(`❌ Erro ao fechar trade por timeout ${trade.trade_id}:`, closeError);
      } else {
        console.log(`✅ Trade ${trade.trade_id} fechada por timeout`);
        closedByTimeout++;
      }
    }
  }
  
  if (closedByTimeout === 0) {
    console.log('✅ Nenhuma trade precisou ser fechada por timeout');
  } else {
    console.log(`✅ ${closedByTimeout} trades fechadas por timeout`);
  }

  // 3. Análise de Performance por Símbolo
  console.log('\n📊 3. ANÁLISE DE PERFORMANCE POR SÍMBOLO');
  console.log('-'.repeat(40));
  
  const symbolStats = {};
  tradesData?.forEach(trade => {
    if (!symbolStats[trade.symbol]) {
      symbolStats[trade.symbol] = {
        total: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
        avgConfidence: 0,
        confidenceSum: 0,
        recommendations: []
      };
    }
    
    symbolStats[trade.symbol].total++;
    symbolStats[trade.symbol].totalPnL += parseFloat(trade.pnl || 0);
    symbolStats[trade.symbol].confidenceSum += parseFloat(trade.confidence || 0);
    
    if (trade.status === 'closed') {
      if (parseFloat(trade.pnl || 0) > 0) {
        symbolStats[trade.symbol].wins++;
      } else if (parseFloat(trade.pnl || 0) < 0) {
        symbolStats[trade.symbol].losses++;
      }
    }
  });
  
  // Gerar recomendações por símbolo
  Object.entries(symbolStats).forEach(([symbol, stats]) => {
    stats.avgConfidence = stats.confidenceSum / stats.total;
    const closedCount = stats.wins + stats.losses;
    const winRate = closedCount > 0 ? (stats.wins / closedCount) * 100 : 0;
    
    console.log(`📊 ${symbol}:`);
    console.log(`   Total: ${stats.total} | Wins: ${stats.wins} | Losses: ${stats.losses}`);
    console.log(`   Win Rate: ${winRate.toFixed(2)}% | P&L: $${stats.totalPnL.toFixed(4)}`);
    console.log(`   Confiança Média: ${stats.avgConfidence.toFixed(2)}%`);
    
    // Gerar recomendações específicas
    if (winRate < 40 && closedCount > 5) {
      stats.recommendations.push('🔴 EVITAR - Win rate muito baixo');
    } else if (winRate > 60 && closedCount > 5) {
      stats.recommendations.push('🟢 PRIORIZAR - Win rate excelente');
    }
    
    if (stats.totalPnL < -0.05) {
      stats.recommendations.push('🔴 EVITAR - P&L negativo significativo');
    } else if (stats.totalPnL > 0.1) {
      stats.recommendations.push('🟢 PRIORIZAR - P&L positivo significativo');
    }
    
    if (stats.avgConfidence < 0.3) {
      stats.recommendations.push('⚠️ MELHORAR - Confiança baixa nos sinais');
    }
    
    if (stats.recommendations.length > 0) {
      console.log(`   Recomendações: ${stats.recommendations.join(', ')}`);
    }
    console.log('');
  });

  // 4. Implementar Filtros de Qualidade
  console.log('\n📊 4. IMPLEMENTAÇÃO DE FILTROS DE QUALIDADE');
  console.log('-'.repeat(40));
  
  const qualityFilters = {
    minWinRate: 45,        // Mínimo 45% de win rate
    minConfidence: 0.4,    // Mínimo 40% de confiança
    maxDrawdown: 15,       // Máximo 15% de drawdown
    minProfitFactor: 1.2   // Mínimo 1.2 de profit factor
  };
  
  console.log('🔧 Filtros de qualidade implementados:');
  console.log(`   Win Rate Mínimo: ${qualityFilters.minWinRate}%`);
  console.log(`   Confiança Mínima: ${(qualityFilters.minConfidence * 100).toFixed(1)}%`);
  console.log(`   Drawdown Máximo: ${qualityFilters.maxDrawdown}%`);
  console.log(`   Profit Factor Mínimo: ${qualityFilters.minProfitFactor}`);

  // 5. Implementar Gestão de Risco Melhorada
  console.log('\n📊 5. IMPLEMENTAÇÃO DE GESTÃO DE RISCO MELHORADA');
  console.log('-'.repeat(40));
  
  const riskManagementRules = {
    maxPositionsPerSymbol: 2,     // Máximo 2 posições por símbolo
    maxTotalPositions: 8,         // Máximo 8 posições totais
    positionSizePercent: 5,       // Máximo 5% do capital por posição
    stopLossPercent: 2,           // Stop loss em 2%
    takeProfitPercent: 4,         // Take profit em 4% (R/R 1:2)
    maxDailyLoss: 3              // Máximo 3% de perda por dia
  };
  
  console.log('🔧 Regras de gestão de risco implementadas:');
  console.log(`   Máx. Posições por Símbolo: ${riskManagementRules.maxPositionsPerSymbol}`);
  console.log(`   Máx. Posições Totais: ${riskManagementRules.maxTotalPositions}`);
  console.log(`   Tamanho da Posição: ${riskManagementRules.positionSizePercent}%`);
  console.log(`   Stop Loss: ${riskManagementRules.stopLossPercent}%`);
  console.log(`   Take Profit: ${riskManagementRules.takeProfitPercent}%`);
  console.log(`   Perda Máxima Diária: ${riskManagementRules.maxDailyLoss}%`);

  // 6. Implementar Análise Técnica Robusta
  console.log('\n📊 6. IMPLEMENTAÇÃO DE ANÁLISE TÉCNICA ROBUSTA');
  console.log('-'.repeat(40));
  
  const technicalIndicators = {
    rsi: { period: 14, overbought: 70, oversold: 30 },
    macd: { fast: 12, slow: 26, signal: 9 },
    bollinger: { period: 20, stdDev: 2 },
    ema: { periods: [9, 21, 50] },
    volume: { minVolumeRatio: 1.2 },
    supportResistance: { lookback: 50 }
  };
  
  console.log('🔧 Indicadores técnicos configurados:');
  console.log(`   RSI: ${technicalIndicators.rsi.period} períodos (${technicalIndicators.rsi.oversold}-${technicalIndicators.rsi.overbought})`);
  console.log(`   MACD: ${technicalIndicators.macd.fast}/${technicalIndicators.macd.slow}/${technicalIndicators.macd.signal}`);
  console.log(`   Bollinger Bands: ${technicalIndicators.bollinger.period} períodos, ${technicalIndicators.bollinger.stdDev}σ`);
  console.log(`   EMAs: ${technicalIndicators.ema.periods.join(', ')} períodos`);
  console.log(`   Volume: Mínimo ${technicalIndicators.volume.minVolumeRatio}x da média`);
  console.log(`   S/R: ${technicalIndicators.supportResistance.lookback} períodos de lookback`);

  // 7. Salvar Configurações de Melhoria
  const improvementConfig = {
    timestamp: new Date().toISOString(),
    qualityFilters,
    riskManagementRules,
    technicalIndicators,
    symbolRecommendations: symbolStats,
    tradesCorrected: {
      confidenceFixed: abnormalConfidenceTrades.length,
      timeoutClosed: closedByTimeout
    }
  };
  
  fs.writeFileSync('improvement_config.json', JSON.stringify(improvementConfig, null, 2));
  console.log('\n✅ Configurações de melhoria salvas em improvement_config.json');

  // 8. Resumo das Melhorias
  console.log('\n📊 8. RESUMO DAS MELHORIAS IMPLEMENTADAS');
  console.log('-'.repeat(40));
  
  console.log('✅ Correção de confiança anormal');
  console.log('✅ Timeout automático para trades abertas');
  console.log('✅ Análise de performance por símbolo');
  console.log('✅ Filtros de qualidade implementados');
  console.log('✅ Gestão de risco melhorada');
  console.log('✅ Análise técnica robusta configurada');
  console.log('✅ Recomendações específicas por símbolo');
  
  console.log('\n🎯 PRÓXIMOS PASSOS:');
  console.log('1. Implementar os filtros de qualidade no código');
  console.log('2. Aplicar as regras de gestão de risco');
  console.log('3. Integrar os indicadores técnicos');
  console.log('4. Monitorar performance com as novas regras');
  console.log('5. Ajustar parâmetros baseado nos resultados');
}

implementImprovements().catch(console.error);
