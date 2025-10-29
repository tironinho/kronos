const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseSystem() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DO SISTEMA KRONOS-X\n');
  console.log('=' .repeat(60));

  // 1. Análise de Equity History
  console.log('\n📊 1. ANÁLISE DE EQUITY HISTORY');
  console.log('-'.repeat(40));
  
  const { data: equityData, error: equityError } = await supabase
    .from('equity_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  if (equityError) {
    console.error('❌ Erro ao buscar equity history:', equityError);
  } else {
    console.log(`✅ Registros encontrados: ${equityData?.length || 0}`);
    
    if (equityData && equityData.length > 0) {
      const latestEquity = equityData[0];
      const oldestEquity = equityData[equityData.length - 1];
      const equityChange = latestEquity.equity - oldestEquity.equity;
      const equityChangePercent = (equityChange / oldestEquity.equity) * 100;
      
      console.log(`💰 Equity Atual: $${latestEquity.equity.toFixed(4)}`);
      console.log(`📈 Equity Inicial: $${oldestEquity.equity.toFixed(4)}`);
      console.log(`📊 Variação: $${equityChange.toFixed(4)} (${equityChangePercent.toFixed(2)}%)`);
      console.log(`📅 Período: ${new Date(oldestEquity.timestamp).toLocaleString('pt-BR')} - ${new Date(latestEquity.timestamp).toLocaleString('pt-BR')}`);
    }
  }

  // 2. Análise de Trades Reais
  console.log('\n📊 2. ANÁLISE DE TRADES REAIS');
  console.log('-'.repeat(40));
  
  const { data: tradesData, error: tradesError } = await supabase
    .from('real_trades')
    .select('*')
    .order('opened_at', { ascending: false });

  if (tradesError) {
    console.error('❌ Erro ao buscar trades:', tradesError);
  } else {
    const validTrades = tradesData?.filter(t => t.entry_price > 0 && t.quantity > 0) || [];
    const openTrades = validTrades.filter(t => t.status === 'open');
    const closedTrades = validTrades.filter(t => t.status === 'closed');
    
    console.log(`✅ Total de trades válidas: ${validTrades.length}`);
    console.log(`📈 Trades abertas: ${openTrades.length}`);
    console.log(`📉 Trades fechadas: ${closedTrades.length}`);
    
    if (closedTrades.length > 0) {
      const wins = closedTrades.filter(t => parseFloat(t.pnl || 0) > 0).length;
      const losses = closedTrades.filter(t => parseFloat(t.pnl || 0) < 0).length;
      const winRate = (wins / closedTrades.length) * 100;
      
      const totalPnL = closedTrades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
      const avgWin = wins > 0 ? closedTrades.filter(t => parseFloat(t.pnl || 0) > 0).reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0) / wins : 0;
      const avgLoss = losses > 0 ? Math.abs(closedTrades.filter(t => parseFloat(t.pnl || 0) < 0).reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0)) / losses : 0;
      
      console.log(`🎯 Win Rate: ${winRate.toFixed(2)}%`);
      console.log(`💰 P&L Total: $${totalPnL.toFixed(4)}`);
      console.log(`📈 Lucro Médio: $${avgWin.toFixed(4)}`);
      console.log(`📉 Perda Média: $${avgLoss.toFixed(4)}`);
      console.log(`⚖️ Profit Factor: ${avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A'}`);
    }
  }

  // 3. Análise de Padrões de Trading
  console.log('\n📊 3. ANÁLISE DE PADRÕES DE TRADING');
  console.log('-'.repeat(40));
  
  if (tradesData && tradesData.length > 0) {
    // Análise por símbolo
    const symbolStats = {};
    tradesData.forEach(trade => {
      if (!symbolStats[trade.symbol]) {
        symbolStats[trade.symbol] = {
          total: 0,
          wins: 0,
          losses: 0,
          totalPnL: 0,
          avgConfidence: 0,
          confidenceSum: 0
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
    
    Object.entries(symbolStats).forEach(([symbol, stats]) => {
      stats.avgConfidence = stats.confidenceSum / stats.total;
      const closedCount = stats.wins + stats.losses;
      const winRate = closedCount > 0 ? (stats.wins / closedCount) * 100 : 0;
      
      console.log(`📊 ${symbol}:`);
      console.log(`   Total: ${stats.total} | Wins: ${stats.wins} | Losses: ${stats.losses}`);
      console.log(`   Win Rate: ${winRate.toFixed(2)}% | P&L: $${stats.totalPnL.toFixed(4)}`);
      console.log(`   Confiança Média: ${(stats.avgConfidence / 100).toFixed(2)}%`);
    });
  }

  // 4. Análise de Confiança vs Performance
  console.log('\n📊 4. ANÁLISE DE CONFIANÇA VS PERFORMANCE');
  console.log('-'.repeat(40));
  
  if (tradesData && tradesData.length > 0) {
    const confidenceRanges = {
      '0-20%': { trades: [], wins: 0, losses: 0 },
      '20-40%': { trades: [], wins: 0, losses: 0 },
      '40-60%': { trades: [], wins: 0, losses: 0 },
      '60-80%': { trades: [], wins: 0, losses: 0 },
      '80-100%': { trades: [], wins: 0, losses: 0 }
    };
    
    tradesData.forEach(trade => {
      const confidence = parseFloat(trade.confidence || 0) / 100;
      const pnl = parseFloat(trade.pnl || 0);
      
      let range = '0-20%';
      if (confidence >= 0.8) range = '80-100%';
      else if (confidence >= 0.6) range = '60-80%';
      else if (confidence >= 0.4) range = '40-60%';
      else if (confidence >= 0.2) range = '20-40%';
      
      confidenceRanges[range].trades.push(trade);
      if (trade.status === 'closed') {
        if (pnl > 0) confidenceRanges[range].wins++;
        else if (pnl < 0) confidenceRanges[range].losses++;
      }
    });
    
    Object.entries(confidenceRanges).forEach(([range, stats]) => {
      const totalClosed = stats.wins + stats.losses;
      const winRate = totalClosed > 0 ? (stats.wins / totalClosed) * 100 : 0;
      
      console.log(`📊 Confiança ${range}:`);
      console.log(`   Trades: ${stats.trades.length} | Win Rate: ${winRate.toFixed(2)}%`);
    });
  }

  // 5. Problemas Identificados
  console.log('\n🚨 5. PROBLEMAS IDENTIFICADOS');
  console.log('-'.repeat(40));
  
  const problems = [];
  
  // Problema 1: Confiança muito alta
  const highConfidenceTrades = tradesData?.filter(t => parseFloat(t.confidence || 0) > 5000) || [];
  if (highConfidenceTrades.length > 0) {
    problems.push(`⚠️ ${highConfidenceTrades.length} trades com confiança anormalmente alta (>5000%)`);
  }
  
  // Problema 2: Trades sem fechamento
  const openTradesOld = tradesData?.filter(t => t.status === 'open' && new Date(t.opened_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)) || [];
  if (openTradesOld.length > 0) {
    problems.push(`⚠️ ${openTradesOld.length} trades abertas há mais de 24h`);
  }
  
  // Problema 3: Drawdown excessivo
  if (equityData && equityData.length > 0) {
    const maxEquity = Math.max(...equityData.map(e => e.equity));
    const currentEquity = equityData[0].equity;
    const drawdown = ((maxEquity - currentEquity) / maxEquity) * 100;
    
    if (drawdown > 10) {
      problems.push(`⚠️ Drawdown atual: ${drawdown.toFixed(2)}% (acima de 10%)`);
    }
  }
  
  // Problema 4: Win Rate baixo
  if (tradesData) {
    const closedTrades = tradesData.filter(t => t.status === 'closed');
    if (closedTrades && closedTrades.length > 0) {
      const wins = closedTrades.filter(t => parseFloat(t.pnl || 0) > 0).length;
      const winRate = (wins / closedTrades.length) * 100;
      
      if (winRate < 40) {
        problems.push(`⚠️ Win Rate baixo: ${winRate.toFixed(2)}% (abaixo de 40%)`);
      }
    }
  }
  
  if (problems.length === 0) {
    console.log('✅ Nenhum problema crítico identificado');
  } else {
    problems.forEach(problem => console.log(problem));
  }

  // 6. Recomendações
  console.log('\n💡 6. RECOMENDAÇÕES');
  console.log('-'.repeat(40));
  
  const recommendations = [];
  
  if (highConfidenceTrades.length > 0) {
    recommendations.push('🔧 Revisar cálculo de confiança - valores acima de 100% indicam erro');
  }
  
  if (openTradesOld.length > 0) {
    recommendations.push('🔧 Implementar timeout automático para trades abertas');
  }
  
  if (tradesData) {
    const closedTrades = tradesData.filter(t => t.status === 'closed');
    if (closedTrades && closedTrades.length > 0) {
      const wins = closedTrades.filter(t => parseFloat(t.pnl || 0) > 0).length;
      const winRate = (wins / closedTrades.length) * 100;
      
      if (winRate < 50) {
        recommendations.push('🔧 Melhorar critérios de entrada - win rate baixo indica sinais fracos');
      }
    }
  }
  
  recommendations.push('🔧 Implementar análise técnica mais robusta');
  recommendations.push('🔧 Adicionar gestão de risco mais conservadora');
  recommendations.push('🔧 Implementar stop-loss dinâmico baseado em volatilidade');
  recommendations.push('🔧 Adicionar filtros de volume e liquidez');
  
  recommendations.forEach(rec => console.log(rec));

  // 7. Salvar relatório
  const report = {
    timestamp: new Date().toISOString(),
    equity: equityData?.[0] || null,
    trades: {
      total: tradesData?.length || 0,
      open: tradesData ? tradesData.filter(t => t.status === 'open').length : 0,
      closed: tradesData ? tradesData.filter(t => t.status === 'closed').length : 0,
      winRate: tradesData ? (tradesData.filter(t => t.status === 'closed' && parseFloat(t.pnl || 0) > 0).length / tradesData.filter(t => t.status === 'closed').length) * 100 : 0
    },
    problems,
    recommendations
  };
  
  fs.writeFileSync('system_diagnosis_report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Relatório salvo em system_diagnosis_report.json');
}

diagnoseSystem().catch(console.error);
