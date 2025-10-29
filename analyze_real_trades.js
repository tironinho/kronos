const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeTrades() {
  console.log('🔍 Analisando trades na tabela real_trades...\n');

  // Buscar TODAS as trades (abertas e fechadas)
  const { data: allTrades, error } = await supabase
    .from('real_trades')
    .select('*')
    .order('opened_at', { ascending: false });

  if (error) {
    console.error('❌ Erro ao buscar trades:', error);
    return;
  }

  if (!allTrades || allTrades.length === 0) {
    console.log('⚠️ Nenhum trade encontrado na tabela');
    return;
  }

  console.log(`📊 Total de trades: ${allTrades.length}\n`);

  // Filtrar trades válidas (com dados completos)
  const validTrades = allTrades.filter(t => 
    t.entry_price > 0 && 
    t.quantity > 0 && 
    t.symbol && 
    t.status
  );

  console.log(`✅ Trades válidas: ${validTrades.length}\n`);

  // Estatísticas gerais
  const openTrades = validTrades.filter(t => t.status === 'open');
  const closedTrades = validTrades.filter(t => t.status === 'closed');

  console.log(`📈 Trades abertas: ${openTrades.length}`);
  console.log(`📉 Trades fechadas: ${closedTrades.length}\n`);

  // Analisar trades fechadas
  if (closedTrades.length > 0) {
    let totalProfit = 0;
    let totalLoss = 0;
    let wins = 0;
    let losses = 0;

    console.log('📊 ANÁLISE DE TRADES FECHADAS:\n');

    closedTrades.forEach(trade => {
      const profit = parseFloat(trade.pnl || 0);
      const profitPercent = parseFloat(trade.pnl_percent || 0);

      totalProfit += profit;
      if (profit > 0) {
        wins++;
        totalProfit += profit;
      } else if (profit < 0) {
        losses++;
        totalLoss += Math.abs(profit);
      }

      console.log(`${trade.status === 'closed' ? '🔴' : '🟢'} ${trade.symbol} ${trade.side}`);
      console.log(`   Entry: $${trade.entry_price}`);
      console.log(`   Exit: $${trade.current_price || trade.closed_at}`);
      console.log(`   P&L: $${profit.toFixed(4)} (${profitPercent.toFixed(2)}%)`);
      console.log(`   Reason: ${trade.reason || 'N/A'}`);
      console.log(`   Algoritmo: ${trade.algorithm || 'N/A'}`);
      console.log(`   Confiança: ${(parseFloat(trade.confidence) * 100).toFixed(1)}%`);
      console.log(`   Aberta: ${new Date(trade.opened_at).toLocaleString('pt-BR')}`);
      console.log(`   Fechada: ${trade.closed_at ? new Date(trade.closed_at).toLocaleString('pt-BR') : 'N/A'}\n`);
    });

    console.log('\n📈 ESTATÍSTICAS GERAIS:\n');
    console.log(`✅ Wins: ${wins}`);
    console.log(`❌ Losses: ${losses}`);
    console.log(`📊 Win Rate: ${closedTrades.length > 0 ? ((wins / closedTrades.length) * 100).toFixed(2) : 0}%`);
    console.log(`💰 Lucro Total: $${totalProfit.toFixed(4)}`);
    console.log(`💸 Perda Total: $${totalLoss.toFixed(4)}`);
    console.log(`📉 P&L Líquido: $${(totalProfit - totalLoss).toFixed(4)}\n`);
  }

  // Analisar trades abertas
  if (openTrades.length > 0) {
    console.log('\n📊 TRADES ABERTAS ATUAIS:\n');

    openTrades.forEach(trade => {
      const pnl = parseFloat(trade.pnl || 0);
      const pnlPercent = parseFloat(trade.pnl_percent || 0);
      
      console.log(`${pnl >= 0 ? '🟢' : '🔴'} ${trade.symbol} ${trade.side}`);
      console.log(`   Entry: $${trade.entry_price}`);
      console.log(`   Atual: $${trade.current_price || trade.entry_price}`);
      console.log(`   P&L: $${pnl.toFixed(4)} (${pnlPercent.toFixed(2)}%)`);
      console.log(`   Stop Loss: $${parseFloat(trade.stop_loss || 0).toFixed(4)} (${((trade.stop_loss / trade.entry_price) - 1) * 100}%)`);
      console.log(`   Take Profit: $${parseFloat(trade.take_profit || 0).toFixed(4)} (${((trade.take_profit / trade.entry_price) - 1) * 100}%)`);
      console.log(`   Algoritmo: ${trade.algorithm || 'N/A'}`);
      console.log(`   Confiança: ${(parseFloat(trade.confidence) * 100).toFixed(1)}%`);
      console.log(`   Aberta: ${new Date(trade.opened_at).toLocaleString('pt-BR')}\n`);
    });

    const totalUnrealizedPnL = openTrades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    console.log(`💰 P&L Total Não Realizado: $${totalUnrealizedPnL.toFixed(4)}\n`);
  }

  // Análise por símbolo
  console.log('\n📊 ANÁLISE POR SÍMBOLO:\n');

  const symbolGroups = {};
  validTrades.forEach(trade => {
    if (!symbolGroups[trade.symbol]) {
      symbolGroups[trade.symbol] = {
        total: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
        openTrades: 0
      };
    }

    symbolGroups[trade.symbol].total++;
    symbolGroups[trade.symbol].totalPnL += parseFloat(trade.pnl || 0);

    if (trade.status === 'open') {
      symbolGroups[trade.symbol].openTrades++;
    } else {
      if (parseFloat(trade.pnl || 0) > 0) {
        symbolGroups[trade.symbol].wins++;
      } else if (parseFloat(trade.pnl || 0) < 0) {
        symbolGroups[trade.symbol].losses++;
      }
    }
  });

  Object.entries(symbolGroups).forEach(([symbol, stats]) => {
    console.log(`📊 ${symbol}:`);
    console.log(`   Total: ${stats.total} trades`);
    console.log(`   Abertas: ${stats.openTrades}`);
    console.log(`   Wins: ${stats.wins} | Losses: ${stats.losses}`);
    console.log(`   P&L Total: $${stats.totalPnL.toFixed(4)}`);
    console.log(`   Win Rate: ${stats.total > stats.openTrades ? ((stats.wins / (stats.total - stats.openTrades)) * 100).toFixed(2) : 'N/A'}%`);
    console.log('');
  });

  // Salvar análise em arquivo
  const report = {
    totalTrades: validTrades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    summary: {
      wins: 0,
      losses: 0,
      totalProfit: 0,
      totalLoss: 0,
      avgProfit: 0,
      avgLoss: 0
    },
    trades: validTrades
  };

  closedTrades.forEach(t => {
    const profit = parseFloat(t.pnl || 0);
    if (profit > 0) report.summary.wins++;
    if (profit < 0) report.summary.losses++;
    report.summary.totalProfit += profit > 0 ? profit : 0;
    report.summary.totalLoss += profit < 0 ? Math.abs(profit) : 0;
  });

  if (report.summary.wins > 0) {
    report.summary.avgProfit = report.summary.totalProfit / report.summary.wins;
  }
  if (report.summary.losses > 0) {
    report.summary.avgLoss = report.summary.totalLoss / report.summary.losses;
  }

  fs.writeFileSync('trade_analysis_report.json', JSON.stringify(report, null, 2));
  console.log('✅ Análise salva em trade_analysis_report.json');
}

analyzeTrades().catch(console.error);

