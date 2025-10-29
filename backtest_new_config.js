/**
 * BACKTEST DAS NOVAS CONFIGURAÇÕES
 * Simula performance com Stop Loss 4%, Take Profit 8%, Confiança 60%
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

// NOVAS CONFIGURAÇÕES
const NEW_CONFIG = {
  stopLossPct: 4,        // Aumentado de 2% para 4%
  takeProfitPct: 8,     // Aumentado de 4% para 8%
  minConfidence: 60,    // Aumentado de 40% para 60%
  positionSizePct: 3,   // Reduzido de 5% para 3%
  maxPositions: 3,       // Reduzido de 10 para 3
  tradingFee: 0.0004,   // 0.04% (0.02% entrada + 0.02% saída)
  minRiskReward: 2.0    // Aumentado de 1.5 para 2.0
};

// CONFIGURAÇÕES ANTIGAS (para comparação)
const OLD_CONFIG = {
  stopLossPct: 2,
  takeProfitPct: 4,
  minConfidence: 40,
  positionSizePct: 5,
  maxPositions: 10,
  tradingFee: 0.0004,
  minRiskReward: 1.5
};

async function backtestNewConfig() {
  console.log('='.repeat(100));
  console.log('📊 BACKTEST - NOVAS CONFIGURAÇÕES');
  console.log('='.repeat(100));
  console.log('');

  // Buscar trades fechadas para análise
  const { data: closedTrades, error } = await supabase
    .from('real_trades')
    .select('*')
    .eq('status', 'closed')
    .order('opened_at', { ascending: true });

  if (error || !closedTrades || closedTrades.length === 0) {
    console.error('❌ Erro ao buscar trades:', error);
    console.log('⚠️  Sem trades históricas para backtest. Usando simulação baseada em dados disponíveis.');
    return simulateBacktest();
  }

  console.log(`📈 Analisando ${closedTrades.length} trades fechadas...`);
  console.log('');

  // Simular como seria o desempenho com novas configurações
  let simulatedWins = 0;
  let simulatedLosses = 0;
  let simulatedBreakEven = 0;
  let simulatedTotalPnL = 0;
  let simulatedWinsValue = 0;
  let simulatedLossesValue = 0;
  let tradesAccepted = 0;
  let tradesRejected = 0;

  for (const trade of closedTrades) {
    const confidence = parseFloat(trade.confidence || '0');
    const entryPrice = parseFloat(trade.entry_price || '0');
    const exitPrice = parseFloat(trade.current_price || trade.entry_price);
    const quantity = parseFloat(trade.quantity || '0');
    
    // Filtrar por confiança mínima (NOVA CONFIGURAÇÃO)
    if (confidence < NEW_CONFIG.minConfidence) {
      tradesRejected++;
      continue;
    }
    
    tradesAccepted++;
    
    // Calcular P&L bruto
    let grossPnL = 0;
    if (trade.side === 'BUY') {
      grossPnL = (exitPrice - entryPrice) * quantity;
    } else {
      grossPnL = (entryPrice - exitPrice) * quantity;
    }
    
    // Calcular P&L percentual bruto
    const grossPnLPercent = entryPrice > 0 ? (grossPnL / (entryPrice * quantity)) * 100 : 0;
    
    // Aplicar Stop Loss e Take Profit (NOVAS CONFIGURAÇÕES)
    const stopLossPercent = -(NEW_CONFIG.stopLossPct + NEW_CONFIG.tradingFee * 100); // -4.04%
    const takeProfitPercent = NEW_CONFIG.takeProfitPct - (NEW_CONFIG.tradingFee * 100); // +7.96%
    
    // Descontar taxas
    const tradeValue = entryPrice * quantity;
    const totalFee = tradeValue * NEW_CONFIG.tradingFee;
    const netPnL = grossPnL - totalFee;
    const netPnLPercent = grossPnLPercent - (NEW_CONFIG.tradingFee * 100);
    
    // Classificar resultado
    if (netPnLPercent >= takeProfitPercent) {
      // Take Profit alcançado
      simulatedWins++;
      simulatedWinsValue += netPnL;
      simulatedTotalPnL += netPnL;
    } else if (netPnLPercent <= stopLossPercent) {
      // Stop Loss ativado
      simulatedLosses++;
      simulatedLossesValue += netPnL;
      simulatedTotalPnL += netPnL;
    } else if (Math.abs(netPnLPercent) < 0.1) {
      // Break-even (muito próximo de zero)
      simulatedBreakEven++;
      simulatedTotalPnL += netPnL; // Geralmente negativo devido a taxas
    } else {
      // Trade que não atingiu SL nem TP (mantém P&L atual)
      if (netPnL > 0.01) {
        simulatedWins++;
        simulatedWinsValue += netPnL;
      } else if (netPnL < -0.01) {
        simulatedLosses++;
        simulatedLossesValue += netPnL;
      } else {
        simulatedBreakEven++;
      }
      simulatedTotalPnL += netPnL;
    }
  }

  // Calcular métricas
  const totalTradesWithResult = simulatedWins + simulatedLosses;
  const winRate = totalTradesWithResult > 0 ? (simulatedWins / totalTradesWithResult) * 100 : 0;
  const profitFactor = simulatedLossesValue > 0 ? Math.abs(simulatedWinsValue / simulatedLossesValue) : (simulatedWinsValue > 0 ? 999 : 0);
  const avgWin = simulatedWins > 0 ? simulatedWinsValue / simulatedWins : 0;
  const avgLoss = simulatedLosses > 0 ? Math.abs(simulatedLossesValue / simulatedLosses) : 0;

  // Comparar com performance antiga
  const oldTotalPnL = closedTrades.reduce((sum, t) => {
    const pnl = parseFloat(t.pnl || '0');
    return sum + (isNaN(pnl) ? 0 : pnl);
  }, 0);

  console.log('📊 RESULTADOS DO BACKTEST (NOVAS CONFIGURAÇÕES):');
  console.log('-'.repeat(100));
  console.log(`   Total de Trades Analisadas: ${closedTrades.length}`);
  console.log(`   Trades Aceitas (confiança >= ${NEW_CONFIG.minConfidence}%): ${tradesAccepted} (${((tradesAccepted/closedTrades.length)*100).toFixed(1)}%)`);
  console.log(`   Trades Rejeitadas (confiança < ${NEW_CONFIG.minConfidence}%): ${tradesRejected} (${((tradesRejected/closedTrades.length)*100).toFixed(1)}%)`);
  console.log('');
  console.log(`   ✅ Vitórias: ${simulatedWins}`);
  console.log(`   ❌ Derrotas: ${simulatedLosses}`);
  console.log(`   ⚪ Break-even: ${simulatedBreakEven}`);
  console.log('');
  console.log(`   📊 Win Rate: ${winRate.toFixed(2)}%`);
  console.log(`   💰 P&L Total (líquido após taxas): $${simulatedTotalPnL.toFixed(4)}`);
  console.log(`   💚 Lucros Totais: $${simulatedWinsValue.toFixed(4)}`);
  console.log(`   💔 Perdas Totais: $${simulatedLossesValue.toFixed(4)}`);
  console.log(`   📈 Profit Factor: ${profitFactor.toFixed(2)}`);
  console.log(`   📊 Ganho Médio: $${avgWin.toFixed(4)}`);
  console.log(`   📊 Perda Média: $${avgLoss.toFixed(4)}`);
  console.log('');

  console.log('📊 COMPARAÇÃO COM CONFIGURAÇÃO ANTIGA:');
  console.log('-'.repeat(100));
  console.log(`   P&L Antiga (com taxas não contabilizadas): $${oldTotalPnL.toFixed(4)}`);
  console.log(`   P&L Nova (com taxas contabilizadas): $${simulatedTotalPnL.toFixed(4)}`);
  const improvement = simulatedTotalPnL - oldTotalPnL;
  console.log(`   Melhoria: ${improvement >= 0 ? '+' : ''}$${improvement.toFixed(4)} (${((improvement/Math.abs(oldTotalPnL || 1))*100).toFixed(1)}%)`);
  console.log('');

  // Análise final
  console.log('🎯 ANÁLISE FINAL:');
  console.log('-'.repeat(100));
  
  const isProfitable = simulatedTotalPnL > 0;
  const hasGoodWinRate = winRate >= 50;
  const hasGoodProfitFactor = profitFactor >= 1.5;
  const acceptableBreakEven = (simulatedBreakEven / tradesAccepted) < 0.3; // Menos de 30% break-even

  const allCriteria = isProfitable && hasGoodWinRate && hasGoodProfitFactor && acceptableBreakEven;

  if (allCriteria) {
    console.log('   ✅ RESULTADO: BACKTEST POSITIVO');
    console.log('   ✅ Win Rate: ' + (hasGoodWinRate ? '✅' : '❌') + ` (${winRate.toFixed(2)}%)`);
    console.log('   ✅ Profit Factor: ' + (hasGoodProfitFactor ? '✅' : '❌') + ` (${profitFactor.toFixed(2)})`);
    console.log('   ✅ P&L Líquido: ' + (isProfitable ? '✅' : '❌') + ` ($${simulatedTotalPnL.toFixed(4)})`);
    console.log('   ✅ Break-even: ' + (acceptableBreakEven ? '✅' : '❌') + ` (${((simulatedBreakEven/tradesAccepted)*100).toFixed(1)}%)`);
    console.log('');
    console.log('   🎉 RECOMENDAÇÃO: DESBLOQUEAR TRADING');
    console.log('   As novas configurações são superiores às antigas.');
    return { success: true, result: 'PASS' };
  } else {
    console.log('   ⚠️  RESULTADO: BACKTEST COM RESERVAS');
    if (!isProfitable) console.log('      ❌ P&L ainda negativo');
    if (!hasGoodWinRate) console.log('      ❌ Win Rate abaixo de 50%');
    if (!hasGoodProfitFactor) console.log('      ❌ Profit Factor abaixo de 1.5');
    if (!acceptableBreakEven) console.log('      ❌ Muitas trades break-even');
    console.log('');
    console.log('   ⚠️  RECOMENDAÇÃO: AJUSTES ADICIONAIS NECESSÁRIOS');
    console.log('   Considere:');
    console.log('      - Aumentar ainda mais confiança mínima');
    console.log('      - Ajustar Stop Loss/Take Profit');
    console.log('      - Reduzir mais frequência de trades');
    return { success: false, result: 'FAIL', details: { isProfitable, hasGoodWinRate, hasGoodProfitFactor, acceptableBreakEven } };
  }
}

async function simulateBacktest() {
  console.log('📊 Simulação de Backtest (sem dados históricos suficientes)');
  console.log('');
  console.log('Baseado nas correções implementadas:');
  console.log('   ✅ Stop Loss: 4% (vs 2% anterior) - Menos cortes prematuros');
  console.log('   ✅ Take Profit: 8% (vs 4% anterior) - Cobre taxas + lucro');
  console.log('   ✅ Confiança mínima: 60% (vs 40% anterior) - Muito mais seletivo');
  console.log('   ✅ Taxas contabilizadas - P&L real');
  console.log('   ✅ Limite de trades: 3 (vs 10 anterior) - Menos custos');
  console.log('');
  console.log('   ⚠️  AVISO: Sem dados suficientes para backtest completo');
  console.log('   ⚠️  Recomendação: Testar em ambiente controlado primeiro');
  return { success: false, result: 'INSUFFICIENT_DATA' };
}

backtestNewConfig()
  .then((result) => {
    console.log('');
    if (result.success) {
      console.log('✅ Backtest concluído com sucesso!');
      console.log('✅ Sistema pronto para desbloquear');
      process.exit(0);
    } else {
      console.log('⚠️  Backtest concluído com reservas');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Erro no backtest:', error);
    process.exit(1);
  });

