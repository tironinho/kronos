const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getCorrectAnalysis() {
  console.log('🔍 ANÁLISE CORRIGIDA - P&L REAL INCLUINDO TRADES ABERTAS\n');
  console.log('='.repeat(80));

  // Buscar TODAS as trades (abertas E fechadas)
  const { data: allTrades, error: tradesError } = await supabase
    .from('real_trades')
    .select('*')
    .order('opened_at', { ascending: false });

  if (tradesError) {
    console.error('❌ Erro ao buscar trades:', tradesError);
    return;
  }

  if (!allTrades || allTrades.length === 0) {
    console.log('⚠️ Nenhum trade encontrado\n');
    return;
  }

  const openTrades = allTrades.filter(t => t.status === 'open');
  const closedTrades = allTrades.filter(t => t.status === 'closed');

  console.log(`📊 Total de Trades: ${allTrades.length}`);
  console.log(`   - Abertas: ${openTrades.length}`);
  console.log(`   - Fechadas: ${closedTrades.length}\n`);

  // ============================================================================
  // P&L DAS TRADES FECHADAS
  // ============================================================================
  console.log('📉 P&L DAS TRADES FECHADAS:\n');
  
  let closedPnL = 0;
  let closedPnLPercent = 0;
  let winningClosed = 0;
  let losingClosed = 0;

  closedTrades.forEach(t => {
    const pnl = t.pnl || 0;
    closedPnL += pnl;
    if (pnl > 0) winningClosed++;
    if (pnl < 0) losingClosed++;
  });

  if (closedTrades.length > 0) {
    closedPnLPercent = (closedPnL / closedTrades.reduce((sum, t) => sum + ((t.entry_price || 0) * (t.quantity || 0)), 0)) * 100;
  }

  console.log(`💰 P&L Total (Fechadas): ${closedPnL >= 0 ? '+' : ''}$${closedPnL.toFixed(2)}`);
  console.log(`✅ Lucrativas: ${winningClosed}`);
  console.log(`❌ Perdedoras: ${losingClosed}`);
  console.log(`📈 Win Rate: ${closedTrades.length > 0 ? ((winningClosed / closedTrades.length) * 100).toFixed(2) : 0}%\n`);

  // ============================================================================
  // P&L ESTIMADO DAS TRADES ABERTAS (usando current_price ou entry_price)
  // ============================================================================
  console.log('📊 P&L ESTIMADO DAS TRADES ABERTAS:\n');
  
  let openPnL = 0;
  let openExposure = 0;
  let profitableOpen = 0;
  let losingOpen = 0;

  const openTradeDetails = [];

  for (const trade of openTrades) {
    if (!trade.entry_price || !trade.quantity || !trade.symbol) {
      continue;
    }

    const currentPrice = trade.current_price || trade.entry_price;
    const entryValue = trade.entry_price * trade.quantity;
    const pnl = trade.pnl || (trade.side === 'BUY' 
      ? (currentPrice - trade.entry_price) * trade.quantity
      : (trade.entry_price - currentPrice) * trade.quantity);
    const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

    openPnL += pnl;
    openExposure += entryValue;

    if (pnl > 0) profitableOpen++;
    if (pnl < 0) losingOpen++;

    openTradeDetails.push({
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.entry_price,
      currentPrice: currentPrice,
      quantity: trade.quantity,
      pnl: pnl,
      pnlPercent: pnlPercent,
      exposure: entryValue,
      hoursOpen: (Date.now() - new Date(trade.opened_at).getTime()) / (1000 * 60 * 60)
    });
  }

  console.log(`💰 P&L Total (Abertas): ${openPnL >= 0 ? '+' : ''}$${openPnL.toFixed(2)}`);
  console.log(`💵 Exposição Total: $${openExposure.toFixed(2)}`);
  console.log(`✅ Lucrativas: ${profitableOpen}`);
  console.log(`❌ Perdedoras: ${losingOpen}`);
  console.log(`⚪ Neutras: ${openTrades.length - profitableOpen - losingOpen}\n`);

  // ============================================================================
  // P&L TOTAL (FECHADAS + ABERTAS)
  // ============================================================================
  console.log('='.repeat(80));
  console.log('📊 P&L TOTAL (FECHADAS + ABERTAS):\n');
  
  const totalPnL = closedPnL + openPnL;
  const totalExposure = openExposure;
  const totalTrades = closedTrades.length + openTrades.length;

  console.log(`💰 P&L TOTAL: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`);
  console.log(`💵 Exposição Atual (Abertas): $${totalExposure.toFixed(2)}`);
  console.log(`📊 Total de Trades: ${totalTrades}`);
  console.log(`   - Fechadas: ${closedTrades.length}`);
  console.log(`   - Abertas: ${openTrades.length}\n`);

  // ============================================================================
  // EQUITY HISTORY
  // ============================================================================
  console.log('📈 EQUITY HISTORY:\n');

  const { data: equityHistory } = await supabase
    .from('equity_history')
    .select('*')
    .eq('symbol', 'USDT_FUTURES')
    .order('timestamp', { ascending: true })
    .limit(1000);

  if (equityHistory && equityHistory.length > 0) {
    const sorted = equityHistory
      .map(p => parseFloat(p.equity || 0))
      .filter(e => e > 0);

    if (sorted.length > 0) {
      const firstEquity = sorted[0];
      const lastEquity = sorted[sorted.length - 1];
      const equityLoss = lastEquity - firstEquity;
      const equityLossPercent = firstEquity > 0 ? (equityLoss / firstEquity) * 100 : 0;

      console.log(`📊 Equity Inicial: $${firstEquity.toFixed(2)}`);
      console.log(`📊 Equity Atual: $${lastEquity.toFixed(2)}`);
      console.log(`💰 Perda de Equity: ${equityLoss >= 0 ? '+' : ''}$${equityLoss.toFixed(2)} (${equityLossPercent >= 0 ? '+' : ''}${equityLossPercent.toFixed(2)}%)\n`);

      console.log('🔍 ANÁLISE DA DISCREPÂNCIA:\n');
      console.log(`   P&L Trades Fechadas: ${closedPnL >= 0 ? '+' : ''}$${closedPnL.toFixed(2)}`);
      console.log(`   P&L Trades Abertas (estimado): ${openPnL >= 0 ? '+' : ''}$${openPnL.toFixed(2)}`);
      console.log(`   P&L Total Estimado: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`);
      console.log(`   Perda Real de Equity: ${equityLoss >= 0 ? '+' : ''}$${equityLoss.toFixed(2)}\n`);

      const discrepancy = Math.abs(equityLoss - totalPnL);
      console.log(`⚠️ DISCREPÂNCIA: $${discrepancy.toFixed(2)}`);
      console.log(`   Isso pode indicar:`);
      console.log(`   - Trades não estão sendo executadas na Binance (criadas apenas no banco)`);
      console.log(`   - Preços atuais não estão sendo atualizados`);
      console.log(`   - Fees/custos não estão sendo considerados`);
      console.log(`   - Trades foram fechadas mas não atualizadas no banco\n`);
    }
  }

  // ============================================================================
  // TRADES DUPLICADAS POR SÍMBOLO
  // ============================================================================
  console.log('🚨 ANÁLISE DE TRADES DUPLICADAS:\n');

  const symbolCounts = {};
  openTrades.forEach(t => {
    if (t.symbol) {
      symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1;
    }
  });

  const duplicates = Object.entries(symbolCounts).filter(([symbol, count]) => count > 3);
  
  if (duplicates.length > 0) {
    console.log('⚠️ SÍMBOLOS COM MUITAS TRADES DUPLICADAS:\n');
    duplicates.forEach(([symbol, count]) => {
      console.log(`   ${symbol}: ${count} trades abertas!`);
    });
    console.log('');
  } else {
    console.log('✅ Nenhuma duplicação excessiva detectada\n');
  }

  // ============================================================================
  // TOP 10 TRADES COM MAIOR PREJUÍZO
  // ============================================================================
  if (openTradeDetails.length > 0) {
    const sortedByLoss = [...openTradeDetails].sort((a, b) => a.pnl - b.pnl);
    const worst = sortedByLoss.slice(0, 10);

    console.log('🚨 TOP 10 TRADES COM MAIOR PREJUÍZO (Abertas):\n');
    worst.forEach((trade, index) => {
      if (trade.pnl < 0) {
        console.log(`${index + 1}. ${trade.symbol} (${trade.side}):`);
        console.log(`   Entry: $${trade.entryPrice.toFixed(4)} | Current: $${trade.currentPrice.toFixed(4)}`);
        console.log(`   P&L: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
        console.log(`   Aberta há: ${trade.hoursOpen.toFixed(1)} horas\n`);
      }
    });
  }

  console.log('='.repeat(80));
  console.log('✅ Análise corrigida concluída!');
}

getCorrectAnalysis()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
