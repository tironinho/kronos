/**
 * ANÁLISE COMPLETA DO SISTEMA DE TRADING
 * Identifica todas as causas de perda e propõe soluções
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

async function comprehensiveAnalysis() {
  console.log('='.repeat(100));
  console.log('📊 ANÁLISE COMPLETA DO SISTEMA DE TRADING');
  console.log('='.repeat(100));
  console.log('');

  // ============================================================================
  // 1. ANÁLISE DAS TRADES
  // ============================================================================
  console.log('🔍 1. ANÁLISE DAS TRADES');
  console.log('-'.repeat(100));

  const { data: allTrades, error: tradesError } = await supabase
    .from('real_trades')
    .select('*')
    .order('opened_at', { ascending: true });

  if (tradesError) {
    console.error('❌ Erro ao buscar trades:', tradesError);
    return;
  }

  const closedTrades = allTrades.filter(t => t.status === 'closed');
  const openTrades = allTrades.filter(t => t.status === 'open');
  
  console.log(`Total de trades: ${allTrades.length}`);
  console.log(`   - Fechadas: ${closedTrades.length}`);
  console.log(`   - Abertas: ${openTrades.length}`);
  console.log('');

  // Análise de trades fechadas
  const validClosedTrades = closedTrades.filter(t => 
    t.pnl !== null && t.pnl !== undefined
  );

  const winningTrades = validClosedTrades.filter(t => parseFloat(t.pnl || '0') > 0);
  const losingTrades = validClosedTrades.filter(t => parseFloat(t.pnl || '0') < 0);
  const breakEvenTrades = validClosedTrades.filter(t => parseFloat(t.pnl || '0') === 0);

  const winRate = winningTrades.length + losingTrades.length > 0
    ? (winningTrades.length / (winningTrades.length + losingTrades.length)) * 100
    : 0;

  const totalWins = winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

  const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
  const avgPnL = validClosedTrades.length > 0
    ? validClosedTrades.reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0) / validClosedTrades.length
    : 0;

  console.log('📈 MÉTRICAS DE TRADES FECHADAS:');
  console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`   Vitórias: ${winningTrades.length} | Derrotas: ${losingTrades.length} | Break-even: ${breakEvenTrades.length}`);
  console.log(`   Profit Factor: ${profitFactor.toFixed(2)}`);
  console.log(`   Ganho Médio: $${avgWin.toFixed(4)}`);
  console.log(`   Perda Média: $${avgLoss.toFixed(4)}`);
  console.log(`   P&L Médio por Trade: $${avgPnL.toFixed(4)}`);
  console.log(`   Lucro Total: $${totalWins.toFixed(4)}`);
  console.log(`   Perda Total: $${totalLosses.toFixed(4)}`);
  console.log(`   P&L Líquido: $${(totalWins - totalLosses).toFixed(4)}`);
  console.log('');

  // Análise de trades abertas
  let openPnL = 0;
  let openWinning = 0;
  let openLosing = 0;
  for (const trade of openTrades) {
    const pnl = parseFloat(trade.pnl || '0');
    openPnL += pnl;
    if (pnl > 0.001) openWinning++;
    else if (pnl < -0.001) openLosing++;
  }

  console.log('📊 MÉTRICAS DE TRADES ABERTAS:');
  console.log(`   Total: ${openTrades.length}`);
  console.log(`   P&L Não Realizado: $${openPnL.toFixed(4)}`);
  console.log(`   Vitoriosas: ${openWinning} | Perdedoras: ${openLosing}`);
  console.log('');

  // ============================================================================
  // 2. ANÁLISE DO EQUITY HISTORY
  // ============================================================================
  console.log('💰 2. ANÁLISE DO EQUITY HISTORY');
  console.log('-'.repeat(100));

  const { data: equityHistory, error: equityError } = await supabase
    .from('equity_history')
    .select('*')
    .eq('symbol', 'USDT_FUTURES')
    .order('timestamp', { ascending: true });

  if (equityError) {
    console.error('❌ Erro ao buscar equity:', equityError);
  } else if (equityHistory && equityHistory.length > 0) {
    const equities = equityHistory.map(e => parseFloat(e.equity || '0')).filter(e => e > 0);
    
    const initialEquity = equities[0];
    const finalEquity = equities[equities.length - 1];
    const maxEquity = Math.max(...equities);
    const minEquity = Math.min(...equities);
    
    const totalReturn = finalEquity - initialEquity;
    const totalReturnPercent = initialEquity > 0 ? (totalReturn / initialEquity) * 100 : 0;
    const maxDrawdown = maxEquity - minEquity;
    const maxDrawdownPercent = maxEquity > 0 ? (maxDrawdown / maxEquity) * 100 : 0;
    
    // Tendência recente (últimas 10 entradas)
    const recentEquities = equities.slice(-10);
    const recentTrend = recentEquities.length > 1 
      ? recentEquities[recentEquities.length - 1] - recentEquities[0]
      : 0;
    const recentTrendPercent = recentEquities[0] > 0 ? (recentTrend / recentEquities[0]) * 100 : 0;

    console.log(`   Equity Inicial: $${initialEquity.toFixed(4)}`);
    console.log(`   Equity Final: $${finalEquity.toFixed(4)}`);
    console.log(`   Equity Máximo: $${maxEquity.toFixed(4)}`);
    console.log(`   Equity Mínimo: $${minEquity.toFixed(4)}`);
    console.log(`   Retorno Total: ${totalReturn >= 0 ? '+' : ''}$${totalReturn.toFixed(4)} (${totalReturnPercent >= 0 ? '+' : ''}${totalReturnPercent.toFixed(2)}%)`);
    console.log(`   Drawdown Máximo: $${maxDrawdown.toFixed(4)} (${maxDrawdownPercent.toFixed(2)}%)`);
    console.log(`   Tendência Recente: ${recentTrend >= 0 ? '+' : ''}$${recentTrend.toFixed(4)} (${recentTrendPercent >= 0 ? '+' : ''}${recentTrendPercent.toFixed(2)}%)`);
    console.log('');
  }

  // ============================================================================
  // 3. ANÁLISE DE EFICIÊNCIA
  // ============================================================================
  console.log('⚡ 3. ANÁLISE DE EFICIÊNCIA DOS TRADES');
  console.log('-'.repeat(100));

  // Duração média
  let totalDuration = 0;
  let countWithDuration = 0;
  for (const trade of closedTrades) {
    if (trade.opened_at && trade.closed_at) {
      const opened = new Date(trade.opened_at);
      const closed = new Date(trade.closed_at);
      const duration = (closed - opened) / 1000 / 60; // minutos
      totalDuration += duration;
      countWithDuration++;
    }
  }
  const avgDuration = countWithDuration > 0 ? totalDuration / countWithDuration : 0;

  // Taxa de rotatividade (trades por dia)
  const firstTrade = closedTrades.length > 0 ? new Date(closedTrades[0].opened_at) : null;
  const lastTrade = closedTrades.length > 0 ? new Date(closedTrades[closedTrades.length - 1].closed_at || closedTrades[closedTrades.length - 1].opened_at) : null;
  const daysActive = firstTrade && lastTrade ? (lastTrade - firstTrade) / (1000 * 60 * 60 * 24) : 0;
  const tradesPerDay = daysActive > 0 ? closedTrades.length / daysActive : 0;

  // Trades por símbolo
  const tradesBySymbol = {};
  for (const trade of validClosedTrades) {
    if (!tradesBySymbol[trade.symbol]) {
      tradesBySymbol[trade.symbol] = { wins: 0, losses: 0, totalPnL: 0 };
    }
    const pnl = parseFloat(trade.pnl || '0');
    if (pnl > 0) tradesBySymbol[trade.symbol].wins++;
    else if (pnl < 0) tradesBySymbol[trade.symbol].losses++;
    tradesBySymbol[trade.symbol].totalPnL += pnl;
  }

  console.log(`   Duração Média por Trade: ${avgDuration.toFixed(2)} minutos`);
  console.log(`   Trades por Dia: ${tradesPerDay.toFixed(2)}`);
  console.log(`   Dias Ativos: ${daysActive.toFixed(1)}`);
  console.log('');

  console.log('📊 PERFORMANCE POR SÍMBOLO:');
  const sortedSymbols = Object.entries(tradesBySymbol)
    .sort((a, b) => b[1].totalPnL - a[1].totalPnL)
    .slice(0, 10);

  for (const [symbol, stats] of sortedSymbols) {
    const total = stats.wins + stats.losses;
    const symbolWinRate = total > 0 ? (stats.wins / total) * 100 : 0;
    console.log(`   ${symbol}: ${stats.wins}W/${stats.losses}L | Win Rate: ${symbolWinRate.toFixed(1)}% | P&L: $${stats.totalPnL.toFixed(4)}`);
  }
  console.log('');

  // ============================================================================
  // 4. IDENTIFICAÇÃO DE PROBLEMAS CRÍTICOS
  // ============================================================================
  console.log('🚨 4. IDENTIFICAÇÃO DE PROBLEMAS CRÍTICOS');
  console.log('-'.repeat(100));

  const problems = [];
  const solutions = [];

  // Problema 1: Win Rate baixo ou negativo
  if (winRate < 50) {
    problems.push(`Win Rate baixo: ${winRate.toFixed(2)}%`);
    solutions.push('- Revisar estratégias de entrada');
    solutions.push('- Melhorar filtros de qualidade de sinais');
    solutions.push('- Adicionar mais confirmações antes de abrir trade');
  }

  // Problema 2: Profit Factor < 1
  if (profitFactor < 1) {
    problems.push(`Profit Factor abaixo de 1: ${profitFactor.toFixed(2)}`);
    solutions.push('- Ajustar relação risco/retorno (aumentar Take Profit)');
    solutions.push('- Reduzir Stop Loss para limitar perdas');
    solutions.push('- Melhorar timing de saída');
  }

  // Problema 3: Perda média > Ganho médio
  if (avgLoss > avgWin && avgLoss > 0 && avgWin > 0) {
    problems.push(`Perda média ($${avgLoss.toFixed(4)}) maior que ganho médio ($${avgWin.toFixed(4)})`);
    solutions.push('- Reduzir tamanho de posição em trades de menor confiança');
    solutions.push('- Implementar trailing stop loss');
    solutions.push('- Tomar lucros parciais em trades vitoriosas');
  }

  // Problema 4: P&L médio negativo
  if (avgPnL < 0) {
    problems.push(`P&L médio negativo: $${avgPnL.toFixed(4)}`);
    solutions.push('- Reduzir frequência de trades (ser mais seletivo)');
    solutions.push('- Aumentar spread mínimo para entrar');
    solutions.push('- Considerar pausar trading até melhorar estratégia');
  }

  // Problema 5: Drawdown alto
  if (equityHistory && equityHistory.length > 0) {
    const maxDrawdownPercent = parseFloat(((maxEquity - minEquity) / maxEquity) * 100);
    if (maxDrawdownPercent > 20) {
      problems.push(`Drawdown muito alto: ${maxDrawdownPercent.toFixed(2)}%`);
      solutions.push('- Implementar stop loss global por drawdown');
      solutions.push('- Reduzir tamanho de posições');
      solutions.push('- Parar trading temporariamente se drawdown > 25%');
    }
  }

  // Problema 6: Win Rate negativo
  if (winRate < 0 || totalWins - totalLosses < 0) {
    problems.push('Win Rate negativo ou P&L total negativo');
    solutions.push('- PARAR TRADING IMEDIATAMENTE');
    solutions.push('- Revisar completamente as estratégias');
    solutions.push('- Testar em backtest antes de continuar');
  }

  // Problema 7: Muitas trades com P&L = 0
  if (breakEvenTrades.length > validClosedTrades.length * 0.3) {
    problems.push(`Muitas trades break-even (${breakEvenTrades.length}) - possivelmente pagando apenas taxas`);
    solutions.push('- Verificar se taxas estão sendo descontadas do P&L');
    solutions.push('- Ajustar Take Profit e Stop Loss para evitar break-even');
  }

  // Problema 8: P&L não cobre taxas
  const estimatedFees = validClosedTrades.length * 0.001; // 0.1% por trade (abertura + fechamento)
  const netPnL = totalWins - totalLosses;
  if (netPnL < estimatedFees) {
    problems.push(`P&L líquido ($${netPnL.toFixed(4)}) não cobre taxas estimadas ($${estimatedFees.toFixed(4)})`);
    solutions.push('- Reduzir frequência de trades');
    solutions.push('- Aumentar tamanho mínimo de Take Profit para cobrir taxas');
    solutions.push('- Considerar custos de trading no cálculo de P&L');
  }

  console.log('PROBLEMAS ENCONTRADOS:');
  problems.forEach(p => console.log(`   ⚠️  ${p}`));
  console.log('');

  console.log('SOLUÇÕES PROPOSTAS:');
  solutions.forEach(s => console.log(`   ✅ ${s}`));
  console.log('');

  // ============================================================================
  // 5. RECOMENDAÇÕES PRIORITÁRIAS
  // ============================================================================
  console.log('🎯 5. RECOMENDAÇÕES PRIORITÁRIAS');
  console.log('-'.repeat(100));

  const priorities = [];

  if (winRate < 40 || profitFactor < 0.8) {
    priorities.push('🔴 CRÍTICO: Sistema não é lucrativo. Considere PARAR TRADING até corrigir.');
  }

  if (avgPnL < -0.01) {
    priorities.push('🔴 CRÍTICO: Cada trade está perdendo dinheiro em média. Reduza frequência.');
  }

  if (totalLosses > totalWins * 1.5) {
    priorities.push('🟡 ALTO: Perdas são muito maiores que ganhos. Ajuste Stop Loss e Take Profit.');
  }

  if (maxDrawdownPercent > 30) {
    priorities.push('🟡 ALTO: Drawdown muito alto. Reduza exposição imediatamente.');
  }

  if (tradesPerDay > 50) {
    priorities.push('🟡 MÉDIO: Muitas trades por dia podem aumentar custos. Seja mais seletivo.');
  }

  if (problems.length === 0) {
    priorities.push('✅ Sistema parece estar funcionando bem, mas monitore continuamente.');
  }

  priorities.forEach(p => console.log(`   ${p}`));
  console.log('');

  // ============================================================================
  // 6. RESumo FINAL
  // ============================================================================
  console.log('📋 RESUMO FINAL');
  console.log('-'.repeat(100));
  console.log(`   Status: ${winRate >= 50 && profitFactor >= 1.2 ? '✅ LUCARTIVO' : winRate >= 45 && profitFactor >= 1.0 ? '🟡 MARGINAL' : '🔴 PERDENDOR'}`);
  console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`   Profit Factor: ${profitFactor.toFixed(2)}`);
  console.log(`   P&L Líquido: $${(totalWins - totalLosses).toFixed(4)}`);
  console.log(`   P&L Líquido + Abertas: $${(totalWins - totalLosses + openPnL).toFixed(4)}`);
  if (equityHistory && equityHistory.length > 0) {
    console.log(`   Retorno do Capital: ${totalReturnPercent.toFixed(2)}%`);
    console.log(`   Drawdown Máximo: ${maxDrawdownPercent.toFixed(2)}%`);
  }
  console.log(`   Problemas Encontrados: ${problems.length}`);
  console.log(`   Soluções Propostas: ${solutions.length}`);
  console.log('');

  return {
    winRate,
    profitFactor,
    totalPnL: totalWins - totalLosses,
    totalPnLWithOpen: totalWins - totalLosses + openPnL,
    problems,
    solutions,
    priorities
  };
}

comprehensiveAnalysis()
  .then(() => {
    console.log('✅ Análise completa concluída!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro na análise:', error);
    process.exit(1);
  });

