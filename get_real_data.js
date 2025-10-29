const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getRealData() {
  console.log('🔍 ANALISANDO DADOS REAIS DAS TRADES E EQUITY\n');
  console.log('='.repeat(80));

  // ============================================================================
  // TRADES ABERTAS
  // ============================================================================
  console.log('\n📊 TRADES ABERTAS\n');
  
  const { data: openTrades, error: tradesError } = await supabase
    .from('real_trades')
    .select('*')
    .eq('status', 'open')
    .order('opened_at', { ascending: false });

  if (tradesError) {
    console.error('❌ Erro ao buscar trades:', tradesError);
    return;
  }

  if (!openTrades || openTrades.length === 0) {
    console.log('⚠️ Nenhuma trade aberta encontrada\n');
  } else {
    console.log(`✅ Total de trades abertas: ${openTrades.length}\n`);

    let totalPnL = 0;
    let totalPnLPercent = 0;
    let totalExposure = 0;
    let profitable = 0;
    let losing = 0;
    const bySymbol = {};

    console.log('📋 DETALHES DAS TRADES:\n');
    openTrades.forEach((trade, index) => {
      if (!trade.entry_price || !trade.quantity || !trade.symbol) {
        return;
      }

      const currentPrice = trade.current_price || trade.entry_price;
      const entryValue = trade.entry_price * trade.quantity;
      const pnl = trade.pnl || (trade.side === 'BUY' 
        ? (currentPrice - trade.entry_price) * trade.quantity
        : (trade.entry_price - currentPrice) * trade.quantity);
      
      const pnlPercent = trade.pnl_percent || (entryValue > 0 ? (pnl / entryValue) * 100 : 0);
      
      const openedAt = new Date(trade.opened_at);
      const hoursOpen = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);

      totalPnL += pnl;
      totalPnLPercent += pnlPercent;
      totalExposure += entryValue;

      if (pnl > 0) profitable++;
      else if (pnl < 0) losing++;

      if (!bySymbol[trade.symbol]) {
        bySymbol[trade.symbol] = { count: 0, totalPnL: 0, exposure: 0 };
      }
      bySymbol[trade.symbol].count++;
      bySymbol[trade.symbol].totalPnL += pnl;
      bySymbol[trade.symbol].exposure += entryValue;

      const pnlEmoji = pnl > 0 ? '✅' : pnl < 0 ? '❌' : '⚪';
      const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      const percentStr = pnlPercent >= 0 ? `+${pnlPercent.toFixed(2)}%` : `${pnlPercent.toFixed(2)}%`;

      console.log(`${index + 1}. ${pnlEmoji} ${trade.symbol} (${trade.side})`);
      console.log(`   Entry: $${trade.entry_price.toFixed(4)} | Current: $${currentPrice.toFixed(4)}`);
      console.log(`   Quantity: ${trade.quantity.toFixed(4)} | Exposure: $${entryValue.toFixed(2)}`);
      console.log(`   P&L: ${pnlStr} (${percentStr})`);
      console.log(`   Aberta há: ${hoursOpen.toFixed(1)} horas (${(hoursOpen / 24).toFixed(1)} dias)`);
      
      if (pnlPercent < -5) {
        console.log(`   🚨 CRÍTICO: Prejuízo acima de 5%!`);
      }
      if (hoursOpen > 48) {
        console.log(`   ⏳ AVISO: Trade muito antiga (> 48h)`);
      }
      console.log('');
    });

    console.log('📊 RESUMO ESTATÍSTICO:\n');
    console.log(`💰 Exposição Total: $${totalExposure.toFixed(2)}`);
    console.log(`📊 P&L Total: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)} (${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)`);
    console.log(`✅ Trades Lucrativas: ${profitable}`);
    console.log(`❌ Trades em Prejuízo: ${losing}`);
    console.log(`⚪ Trades Neutras: ${openTrades.length - profitable - losing}`);
    
    if (openTrades.length > 0) {
      const avgPnL = totalPnL / openTrades.length;
      const avgPnLPercent = totalPnLPercent / openTrades.length;
      console.log(`📈 P&L Médio por Trade: ${avgPnL >= 0 ? '+' : ''}$${avgPnL.toFixed(2)} (${avgPnLPercent >= 0 ? '+' : ''}${avgPnLPercent.toFixed(2)}%)`);
    }

    console.log('\n📊 DISTRIBUIÇÃO POR SÍMBOLO:\n');
    Object.entries(bySymbol)
      .sort((a, b) => b[1].totalPnL - a[1].totalPnL)
      .forEach(([symbol, stats]) => {
        const avgPnL = stats.totalPnL / stats.count;
        console.log(`${symbol}:`);
        console.log(`   Trades: ${stats.count}`);
        console.log(`   P&L Total: ${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`);
        console.log(`   P&L Médio: ${avgPnL >= 0 ? '+' : ''}$${avgPnL.toFixed(2)}`);
        console.log(`   Exposição: $${stats.exposure.toFixed(2)}`);
        console.log('');
      });

    // Trades críticas
    const critical = openTrades.filter(t => {
      const pnlPercent = t.pnl_percent || ((t.current_price || t.entry_price) - t.entry_price) / t.entry_price * 100;
      return pnlPercent < -5;
    });

    if (critical.length > 0) {
      console.log('🚨 TRADES CRÍTICAS (Prejuízo > 5%):\n');
      critical.forEach((trade, index) => {
        const pnlPercent = trade.pnl_percent || ((trade.current_price || trade.entry_price) - trade.entry_price) / trade.entry_price * 100;
        console.log(`${index + 1}. ${trade.symbol} (${trade.side}): ${pnlPercent.toFixed(2)}%`);
      });
      console.log('');
    }
  }

  // ============================================================================
  // EQUITY HISTORY
  // ============================================================================
  console.log('\n📈 EQUITY HISTORY\n');

  const { data: equityHistory, error: equityError } = await supabase
    .from('equity_history')
    .select('*')
    .eq('symbol', 'USDT_FUTURES')
    .order('timestamp', { ascending: false })
    .limit(1000);

  if (equityError) {
    console.error('❌ Erro ao buscar equity:', equityError);
  } else if (!equityHistory || equityHistory.length === 0) {
    console.log('⚠️ Nenhum registro de equity encontrado\n');
  } else {
    console.log(`✅ Total de registros: ${equityHistory.length}\n`);

    const sorted = [...equityHistory]
      .map(p => ({
        timestamp: p.timestamp,
        equity: parseFloat(p.equity || 0),
        returnPercent: parseFloat(p.return_percent || 0)
      }))
      .filter(p => p.equity > 0)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (sorted.length > 0) {
      const firstEquity = sorted[0].equity;
      const lastEquity = sorted[sorted.length - 1].equity;
      const totalReturn = lastEquity - firstEquity;
      const totalReturnPercent = firstEquity > 0 ? (totalReturn / firstEquity) * 100 : 0;

      // Drawdown máximo
      let maxEquity = firstEquity;
      let maxDrawdown = 0;
      let maxDrawdownPercent = 0;

      sorted.forEach(point => {
        if (point.equity > maxEquity) {
          maxEquity = point.equity;
        }
        const drawdown = maxEquity - point.equity;
        const drawdownPercent = maxEquity > 0 ? (drawdown / maxEquity) * 100 : 0;
        if (drawdownPercent > maxDrawdownPercent) {
          maxDrawdownPercent = drawdownPercent;
          maxDrawdown = drawdown;
        }
      });

      console.log(`📊 Equity Inicial: $${firstEquity.toFixed(2)}`);
      console.log(`📊 Equity Atual: $${lastEquity.toFixed(2)}`);
      console.log(`💰 Retorno Total: ${totalReturn >= 0 ? '+' : ''}$${totalReturn.toFixed(2)} (${totalReturnPercent >= 0 ? '+' : ''}${totalReturnPercent.toFixed(2)}%)`);
      console.log(`📉 Drawdown Máximo: $${maxDrawdown.toFixed(2)} (${maxDrawdownPercent.toFixed(2)}%)`);
      console.log(`📈 Equity Máximo: $${maxEquity.toFixed(2)}`);

      // Tendência recente
      const recentPoints = sorted.slice(-24);
      if (recentPoints.length >= 2) {
        const recentReturn = recentPoints[recentPoints.length - 1].equity - recentPoints[0].equity;
        const recentReturnPercent = recentPoints[0].equity > 0 
          ? (recentReturn / recentPoints[0].equity) * 100 
          : 0;
        
        console.log(`\n📊 TENDÊNCIA RECENTE (últimas ${recentPoints.length} horas):`);
        console.log(`   Retorno: ${recentReturn >= 0 ? '+' : ''}$${recentReturn.toFixed(2)} (${recentReturnPercent >= 0 ? '+' : ''}${recentReturnPercent.toFixed(2)}%)`);
        
        if (recentReturnPercent > 1) {
          console.log('   ✅ Tendência POSITIVA');
        } else if (recentReturnPercent < -1) {
          console.log('   ❌ Tendência NEGATIVA');
        } else {
          console.log('   ⚠️ Tendência NEUTRA');
        }
      }
      console.log('');
    }
  }

  // ============================================================================
  // TRADES FECHADAS (Para estatísticas)
  // ============================================================================
  console.log('\n📉 TRADES FECHADAS (Estatísticas)\n');

  const { data: closedTrades } = await supabase
    .from('real_trades')
    .select('*')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(100);

  if (closedTrades && closedTrades.length > 0) {
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0).length;
    const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;

    console.log(`📊 Total de Trades Fechadas: ${closedTrades.length}`);
    console.log(`💰 P&L Total (Realizado): ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`);
    console.log(`✅ Trades Lucrativas: ${winningTrades}`);
    console.log(`❌ Trades em Prejuízo: ${losingTrades}`);
    console.log(`📈 Win Rate: ${winRate.toFixed(2)}%`);
    
    if (closedTrades.length > 0) {
      const avgPnL = totalPnL / closedTrades.length;
      console.log(`📊 P&L Médio: ${avgPnL >= 0 ? '+' : ''}$${avgPnL.toFixed(2)}`);
    }

    // ✅ CORREÇÃO: Calcular P&L Total (Realizado + Não Realizado)
    const unrealizedPnL = openTrades && openTrades.length > 0 
      ? openTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      : 0;
    
    const totalPnLComplete = totalPnL + unrealizedPnL;
    
    console.log(`\n📊 ANÁLISE COMPLETA DE PERFORMANCE:\n`);
    console.log(`💰 P&L Realizado (trades fechadas): ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`);
    console.log(`📊 P&L Não Realizado (trades abertas): ${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)}`);
    console.log(`💼 P&L Total (Realizado + Não Realizado): ${totalPnLComplete >= 0 ? '+' : ''}$${totalPnLComplete.toFixed(2)}`);
    
    // Comparar com drawdown do equity
    if (equityHistory && equityHistory.length > 0 && !equityError) {
      const sorted = [...equityHistory]
        .map(p => ({ equity: parseFloat(p.equity || 0) }))
        .filter(p => p.equity > 0)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      if (sorted.length > 0) {
        const firstEquity = sorted[0].equity;
        const lastEquity = sorted[sorted.length - 1].equity;
        const equityLoss = lastEquity - firstEquity;
        
        console.log(`\n⚠️ INCONSISTÊNCIA DETECTADA:\n`);
        console.log(`   P&L Total das Trades: ${totalPnLComplete >= 0 ? '+' : ''}$${totalPnLComplete.toFixed(2)}`);
        console.log(`   Perda Real do Equity: $${equityLoss.toFixed(2)}`);
        console.log(`   Diferença: $${(equityLoss - totalPnLComplete).toFixed(2)}`);
        console.log(`\n   💡 Possíveis causas:`);
        console.log(`   - Custos de transação (taxas) não contabilizados`);
        console.log(`   - Funding fees de Futures`);
        console.log(`   - Trades fechadas não registradas corretamente`);
        console.log(`   - P&L não realizado das trades abertas incorreto`);
      }
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ Análise concluída!');
}

getRealData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
