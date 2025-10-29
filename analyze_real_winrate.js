/**
 * Script para analisar Win Rate real fazendo cruzamento entre real_trades e equity_history
 */

const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente do .env se disponível
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  try {
    require('dotenv').config();
  } catch (e2) {
    // Ignora se não houver dotenv
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  console.error('   Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeRealWinRate() {
  console.log('📊 ANALISANDO WIN RATE REAL - CRUZAMENTO ENTRE real_trades E equity_history\n');

  // 1. Buscar todas as trades fechadas
  const { data: closedTrades, error: tradesError } = await supabase
    .from('real_trades')
    .select('*')
    .eq('status', 'closed')
    .order('opened_at', { ascending: true });

  if (tradesError) {
    console.error('❌ Erro ao buscar trades:', tradesError);
    return;
  }

  if (!closedTrades || closedTrades.length === 0) {
    console.log('⚠️ Nenhuma trade fechada encontrada\n');
    return;
  }

  // 2. Buscar histórico de equity
  const { data: equityHistory, error: equityError } = await supabase
    .from('equity_history')
    .select('*')
    .eq('symbol', 'USDT_FUTURES')
    .order('timestamp', { ascending: true });

  if (equityError) {
    console.error('❌ Erro ao buscar equity history:', equityError);
  }

  console.log(`📈 Total de trades fechadas: ${closedTrades.length}`);
  if (equityHistory && equityHistory.length > 0) {
    console.log(`💰 Total de registros de equity: ${equityHistory.length}`);
    
    // Equity inicial e final
    const firstEquity = parseFloat(equityHistory[0].equity || 0);
    const lastEquity = parseFloat(equityHistory[equityHistory.length - 1].equity || 0);
    const totalPnLFromEquity = lastEquity - firstEquity;
    const totalPnLPercentFromEquity = firstEquity > 0 ? (totalPnLFromEquity / firstEquity) * 100 : 0;
    
    console.log(`\n💰 EQUITY HISTORY:`);
    console.log(`   Inicial: $${firstEquity.toFixed(2)}`);
    console.log(`   Final: $${lastEquity.toFixed(2)}`);
    console.log(`   P&L Total (Equity): ${totalPnLFromEquity >= 0 ? '+' : ''}$${totalPnLFromEquity.toFixed(2)}`);
    console.log(`   Retorno %: ${totalPnLPercentFromEquity >= 0 ? '+' : ''}${totalPnLPercentFromEquity.toFixed(2)}%\n`);
  }

  // 3. Analisar trades fechadas
  let validTrades = [];
  let invalidTrades = [];
  let tradesWithZeroPnL = [];
  let tradesWithNullPnL = [];

  for (const trade of closedTrades) {
    const pnl = trade.pnl;
    const pnlPercent = trade.pnl_percent;
    
    // Verificar se P&L é válido
    const pnlValue = typeof pnl === 'number' ? pnl : parseFloat(pnl || '0');
    const pnlPercentValue = typeof pnlPercent === 'number' ? pnlPercent : parseFloat(pnlPercent || '0');
    
    if (pnl === null || pnl === undefined) {
      invalidTrades.push({ ...trade, reason: 'P&L null/undefined' });
      tradesWithNullPnL.push(trade);
    } else if (isNaN(pnlValue)) {
      invalidTrades.push({ ...trade, reason: 'P&L inválido (NaN)' });
    } else if (pnlValue === 0) {
      tradesWithZeroPnL.push(trade);
      // Trade break-even ainda é válida
      validTrades.push({
        ...trade,
        pnl: pnlValue,
        pnl_percent: pnlPercentValue,
        category: 'break-even'
      });
    } else {
      validTrades.push({
        ...trade,
        pnl: pnlValue,
        pnl_percent: pnlPercentValue,
        category: pnlValue > 0 ? 'win' : 'loss'
      });
    }
  }

  console.log(`\n📊 ANÁLISE DE TRADES FECHADAS:`);
  console.log(`   ✅ Trades válidas (com P&L): ${validTrades.length}`);
  console.log(`   ⚠️  Trades com P&L inválido: ${invalidTrades.length}`);
  console.log(`   ⚪ Trades break-even (P&L = 0): ${tradesWithZeroPnL.length}`);
  console.log(`   🔴 Trades com P&L null/undefined: ${tradesWithNullPnL.length}`);

  // 4. Calcular métricas apenas com trades válidas
  const winningTrades = validTrades.filter(t => t.category === 'win');
  const losingTrades = validTrades.filter(t => t.category === 'loss');
  const breakEvenTrades = validTrades.filter(t => t.category === 'break-even');

  // Win rate baseado apenas em trades com resultado (win/loss)
  const tradesWithResult = winningTrades.length + losingTrades.length;
  const winRate = tradesWithResult > 0 ? (winningTrades.length / tradesWithResult) * 100 : 0;

  // P&L total
  const totalPnL = validTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);

  // P&L médio
  const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

  console.log(`\n🎯 MÉTRICAS CALCULADAS:`);
  console.log(`   ✅ Vitórias: ${winningTrades.length}`);
  console.log(`   ❌ Derrotas: ${losingTrades.length}`);
  console.log(`   ⚪ Break-even: ${breakEvenTrades.length}`);
  console.log(`   📊 Win Rate: ${winRate.toFixed(2)}% (baseado em ${tradesWithResult} trades com resultado)`);
  console.log(`   💰 P&L Total: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`);
  console.log(`   💚 Lucros Totais: $${totalWins.toFixed(2)}`);
  console.log(`   💔 Perdas Totais: $${totalLosses.toFixed(2)}`);
  console.log(`   📈 Profit Factor: ${profitFactor.toFixed(2)}`);
  console.log(`   📊 Ganho Médio: $${avgWin.toFixed(2)}`);
  console.log(`   📊 Perda Média: $${avgLoss.toFixed(2)}`);

  // 5. Verificar discrepâncias entre P&L das trades e equity_history
  let totalPnLFromEquity = 0;
  if (equityHistory && equityHistory.length > 0) {
    const firstEquity = parseFloat(equityHistory[0].equity || 0);
    const lastEquity = parseFloat(equityHistory[equityHistory.length - 1].equity || 0);
    totalPnLFromEquity = lastEquity - firstEquity;
    
    const pnlFromTrades = totalPnL;
    const discrepancy = Math.abs(pnlFromTrades - totalPnLFromEquity);
    
    console.log(`\n🔍 VALIDAÇÃO CRUZADA:`);
    console.log(`   P&L das Trades (real_trades): ${pnlFromTrades >= 0 ? '+' : ''}$${pnlFromTrades.toFixed(2)}`);
    console.log(`   P&L do Equity (equity_history): ${totalPnLFromEquity >= 0 ? '+' : ''}$${totalPnLFromEquity.toFixed(2)}`);
    console.log(`   Diferença: $${discrepancy.toFixed(2)}`);
    
    if (discrepancy > 1) {
      console.log(`   ⚠️  DISCREPÂNCIA ENCONTRADA! Pode indicar:`);
      console.log(`      - Trades não registradas corretamente`);
      console.log(`      - Taxas de trading não contabilizadas`);
      console.log(`      - Erros no cálculo de P&L`);
      console.log(`      - Outras operações no account`);
    } else {
      console.log(`   ✅ Valores estão alinhados`);
    }
  }

  // 6. Mostrar detalhes de trades com P&L inválido (se houver)
  if (invalidTrades.length > 0 && invalidTrades.length <= 10) {
    console.log(`\n⚠️  TRADES COM P&L INVÁLIDO (primeiras 10):`);
    invalidTrades.slice(0, 10).forEach(t => {
      console.log(`   - ${t.symbol} | ID: ${t.trade_id} | Aberta: ${new Date(t.opened_at).toLocaleString()} | P&L: ${t.pnl} | Motivo: ${t.reason}`);
    });
  }

  // 7. Estatísticas por símbolo
  const statsBySymbol = {};
  validTrades.forEach(t => {
    if (!statsBySymbol[t.symbol]) {
      statsBySymbol[t.symbol] = {
        wins: 0,
        losses: 0,
        breakEven: 0,
        totalPnL: 0
      };
    }
    
    if (t.category === 'win') statsBySymbol[t.symbol].wins++;
    else if (t.category === 'loss') statsBySymbol[t.symbol].losses++;
    else statsBySymbol[t.symbol].breakEven++;
    
    statsBySymbol[t.symbol].totalPnL += t.pnl;
  });

  console.log(`\n📊 ESTATÍSTICAS POR SÍMBOLO (top 10):`);
  const sortedSymbols = Object.entries(statsBySymbol)
    .sort((a, b) => Math.abs(b[1].totalPnL) - Math.abs(a[1].totalPnL))
    .slice(0, 10);
  
  sortedSymbols.forEach(([symbol, stats]) => {
    const total = stats.wins + stats.losses + stats.breakEven;
    const winRateSymbol = stats.wins + stats.losses > 0 
      ? (stats.wins / (stats.wins + stats.losses)) * 100 
      : 0;
    console.log(`   ${symbol}: ${stats.wins}W/${stats.losses}L/${stats.breakEven}BE (${total} trades) | Win Rate: ${winRateSymbol.toFixed(1)}% | P&L: ${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`);
  });

  return {
    totalTrades: closedTrades.length,
    validTrades: validTrades.length,
    invalidTrades: invalidTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    breakEvenTrades: breakEvenTrades.length,
    winRate,
    totalPnL,
    totalWins,
    totalLosses,
    profitFactor,
    avgWin,
    avgLoss
  };
}

// Executar análise
analyzeRealWinRate()
  .then((result) => {
    console.log(`\n✅ Análise concluída!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro na análise:', error);
    process.exit(1);
  });

