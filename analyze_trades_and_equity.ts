// Script de análise completa de trades e equity
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TradeAnalysis {
  symbol: string;
  side: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  openedAt: string;
  durationHours: number;
  maxDrawdown: number;
  isProfitable: boolean;
}

interface EquityPoint {
  timestamp: string;
  equity: number;
  returnPercent: number;
}

async function analyzeTradesAndEquity() {
  console.log('🔍 Análise Completa de Trades e Equity\n');
  console.log('=' .repeat(80));

  // ============================================================================
  // 1. ANÁLISE DE TRADES ABERTAS
  // ============================================================================
  console.log('\n📊 1. ANALISANDO TRADES ABERTAS\n');
  
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
    console.log('⚠️ Nenhuma trade aberta encontrada');
  } else {
    console.log(`✅ Total de trades abertas: ${openTrades.length}\n`);

    const trades: TradeAnalysis[] = [];
    let totalPnL = 0;
    let totalPnLPercent = 0;
    let profitableTrades = 0;
    let losingTrades = 0;
    let totalExposure = 0;

    for (const trade of openTrades) {
      if (!trade.entry_price || !trade.quantity || !trade.symbol) {
        continue; // Pular trades inválidas
      }

      const currentPrice = trade.current_price || trade.entry_price;
      const pnl = trade.side === 'BUY' 
        ? (currentPrice - trade.entry_price) * trade.quantity
        : (trade.entry_price - currentPrice) * trade.quantity;
      
      const entryValue = trade.entry_price * trade.quantity;
      const pnlPercent = (pnl / entryValue) * 100;
      
      const openedAt = new Date(trade.opened_at);
      const durationHours = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);

      // Calcular drawdown aproximado
      const maxDrawdown = Math.abs(pnlPercent < 0 ? pnlPercent : 0);

      trades.push({
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entry_price,
        currentPrice: currentPrice,
        quantity: trade.quantity,
        pnl: pnl,
        pnlPercent: pnlPercent,
        openedAt: trade.opened_at,
        durationHours: durationHours,
        maxDrawdown: maxDrawdown,
        isProfitable: pnl > 0
      });

      totalPnL += pnl;
      totalPnLPercent += pnlPercent;
      totalExposure += entryValue;

      if (pnl > 0) profitableTrades++;
      else if (pnl < 0) losingTrades++;
    }

    // Estatísticas gerais
    console.log(`💰 EXPOSIÇÃO TOTAL: $${totalExposure.toFixed(2)}`);
    console.log(`📊 P&L TOTAL: $${totalPnL.toFixed(2)} (${totalPnLPercent.toFixed(2)}%)`);
    console.log(`✅ Trades lucrativas: ${profitableTrades}`);
    console.log(`❌ Trades em prejuízo: ${losingTrades}`);
    console.log(`📈 Média de P&L por trade: $${(totalPnL / trades.length).toFixed(2)}`);
    console.log(`⏱️  Duração média: ${(trades.reduce((sum, t) => sum + t.durationHours, 0) / trades.length).toFixed(1)} horas\n`);

    // Trades mais problemáticas
    const losingTradesList = trades.filter(t => t.pnl < 0).sort((a, b) => a.pnlPercent - b.pnlPercent);
    if (losingTradesList.length > 0) {
      console.log('🚨 TOP 5 TRADES COM MAIOR PREJUÍZO:\n');
      losingTradesList.slice(0, 5).forEach((trade, index) => {
        console.log(`${index + 1}. ${trade.symbol} (${trade.side})`);
        console.log(`   Entry: $${trade.entryPrice.toFixed(4)} | Current: $${trade.currentPrice.toFixed(4)}`);
        console.log(`   P&L: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
        console.log(`   Drawdown: ${trade.maxDrawdown.toFixed(2)}%`);
        console.log(`   Duração: ${trade.durationHours.toFixed(1)} horas`);
        console.log('');
      });
    }

    // Trades com maior duração
    const longestTrades = trades.sort((a, b) => b.durationHours - a.durationHours);
    if (longestTrades.length > 0) {
      console.log('⏳ TOP 5 TRADES COM MAIOR DURAÇÃO:\n');
      longestTrades.slice(0, 5).forEach((trade, index) => {
        console.log(`${index + 1}. ${trade.symbol} (${trade.side})`);
        console.log(`   Duração: ${trade.durationHours.toFixed(1)} horas (${(trade.durationHours / 24).toFixed(1)} dias)`);
        console.log(`   P&L: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
        console.log('');
      });
    }

    // Distribuição por símbolo
    const symbolStats: { [key: string]: { count: number; totalPnL: number; avgPnL: number } } = {};
    trades.forEach(trade => {
      if (!symbolStats[trade.symbol]) {
        symbolStats[trade.symbol] = { count: 0, totalPnL: 0, avgPnL: 0 };
      }
      symbolStats[trade.symbol].count++;
      symbolStats[trade.symbol].totalPnL += trade.pnl;
    });
    
    Object.keys(symbolStats).forEach(symbol => {
      symbolStats[symbol].avgPnL = symbolStats[symbol].totalPnL / symbolStats[symbol].count;
    });

    console.log('📊 DISTRIBUIÇÃO POR SÍMBOLO:\n');
    Object.entries(symbolStats)
      .sort((a, b) => b[1].totalPnL - a[1].totalPnL)
      .forEach(([symbol, stats]) => {
        console.log(`${symbol}:`);
        console.log(`   Trades: ${stats.count}`);
        console.log(`   P&L Total: $${stats.totalPnL.toFixed(2)}`);
        console.log(`   P&L Médio: $${stats.avgPnL.toFixed(2)}`);
        console.log('');
      });
  }

  // ============================================================================
  // 2. ANÁLISE DO EQUITY HISTORY
  // ============================================================================
  console.log('\n📈 2. ANALISANDO EQUITY HISTORY\n');

  const { data: equityHistory, error: equityError } = await supabase
    .from('equity_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1000);

  if (equityError) {
    console.error('❌ Erro ao buscar equity history:', equityError);
  } else if (!equityHistory || equityHistory.length === 0) {
    console.log('⚠️ Nenhum dado de equity history encontrado');
  } else {
    console.log(`✅ Total de registros: ${equityHistory.length}\n`);

    const equityPoints: EquityPoint[] = equityHistory
      .map((point: any) => ({
        timestamp: point.timestamp,
        equity: point.equity || 0,
        returnPercent: point.return_percent || 0
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (equityPoints.length === 0) {
      console.log('⚠️ Nenhum ponto de equity válido encontrado');
    } else {
      const firstEquity = equityPoints[0].equity;
      const lastEquity = equityPoints[equityPoints.length - 1].equity;
      const totalReturn = lastEquity - firstEquity;
      const totalReturnPercent = firstEquity > 0 ? (totalReturn / firstEquity) * 100 : 0;

      // Calcular drawdown máximo
      let maxEquity = firstEquity;
      let maxDrawdown = 0;
      let maxDrawdownPercent = 0;

      equityPoints.forEach(point => {
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

      // Calcular volatilidade (desvio padrão dos retornos)
      const returns = equityPoints.slice(1).map((point, index) => {
        const prevEquity = equityPoints[index].equity;
        if (prevEquity > 0) {
          return ((point.equity - prevEquity) / prevEquity) * 100;
        }
        return 0;
      });

      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);

      console.log(`📊 Equity Inicial: $${firstEquity.toFixed(2)}`);
      console.log(`📊 Equity Atual: $${lastEquity.toFixed(2)}`);
      console.log(`💰 Retorno Total: $${totalReturn.toFixed(2)} (${totalReturnPercent.toFixed(2)}%)`);
      console.log(`📉 Drawdown Máximo: $${maxDrawdown.toFixed(2)} (${maxDrawdownPercent.toFixed(2)}%)`);
      console.log(`📊 Volatilidade: ${volatility.toFixed(2)}%`);
      console.log(`📈 Equity Máximo: $${maxEquity.toFixed(2)}\n`);

      // Análise de tendência recente
      const recentPoints = equityPoints.slice(-24); // Últimas 24 horas
      if (recentPoints.length >= 2) {
        const recentReturn = recentPoints[recentPoints.length - 1].equity - recentPoints[0].equity;
        const recentReturnPercent = recentPoints[0].equity > 0 
          ? (recentReturn / recentPoints[0].equity) * 100 
          : 0;
        
        console.log(`📊 TENDÊNCIA RECENTE (últimas ${recentPoints.length} horas):`);
        console.log(`   Retorno: $${recentReturn.toFixed(2)} (${recentReturnPercent.toFixed(2)}%)`);
        
        if (recentReturnPercent > 1) {
          console.log('   ✅ Tendência POSITIVA');
        } else if (recentReturnPercent < -1) {
          console.log('   ❌ Tendência NEGATIVA');
        } else {
          console.log('   ⚠️ Tendência NEUTRA');
        }
        console.log('');
      }
    }
  }

  // ============================================================================
  // 3. RECOMENDAÇÕES E MELHORIAS
  // ============================================================================
  console.log('\n💡 3. RECOMENDAÇÕES E PONTOS DE MELHORIA\n');
  console.log('=' .repeat(80));

  const recommendations: string[] = [];

  // Verificar trades com prejuízo significativo
  if (openTrades && openTrades.length > 0) {
    const criticalLosses = openTrades.filter((t: any) => {
      const currentPrice = t.current_price || t.entry_price;
      const pnl = t.side === 'BUY' 
        ? (currentPrice - t.entry_price) * t.quantity
        : (t.entry_price - currentPrice) * t.quantity;
      const entryValue = t.entry_price * t.quantity;
      const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;
      return pnlPercent < -5; // Prejuízo maior que 5%
    });

    if (criticalLosses.length > 0) {
      recommendations.push(
        `🚨 CRÍTICO: ${criticalLosses.length} trade(s) com prejuízo > 5%. ` +
        `Considerar implementar stop loss mais agressivo ou fechamento automático.`
      );
    }

    // Verificar trades muito antigas
    const oldTrades = openTrades.filter((t: any) => {
      const openedAt = new Date(t.opened_at);
      const hoursOpen = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
      return hoursOpen > 48; // Mais de 48 horas
    });

    if (oldTrades.length > 0) {
      recommendations.push(
        `⏳ ${oldTrades.length} trade(s) aberta(s) há mais de 48 horas. ` +
        `Implementar máximo de tempo de abertura ou revisão de estratégia.`
      );
    }

    // Verificar concentração de risco
    const symbolCounts: { [key: string]: number } = {};
    openTrades.forEach((t: any) => {
      symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1;
    });

    const maxConcentration = Math.max(...Object.values(symbolCounts));
    if (maxConcentration > 3) {
      recommendations.push(
        `⚠️ Alto nível de concentração: ${maxConcentration} trades no mesmo símbolo. ` +
        `Considerar diversificação.`
      );
    }
  }

  // Verificar equity em declínio
  if (equityHistory && equityHistory.length > 0) {
    const sortedEquity = equityHistory
      .map((p: any) => p.equity || 0)
      .filter((e: number) => e > 0)
      .sort((a: number, b: number) => a - b);

    if (sortedEquity.length >= 2) {
      const first = sortedEquity[0];
      const last = sortedEquity[sortedEquity.length - 1];
      const declinePercent = first > 0 ? ((first - last) / first) * 100 : 0;

      if (declinePercent > 5) {
        recommendations.push(
          `📉 Equity em declínio de ${declinePercent.toFixed(2)}%. ` +
          `Revisar estratégia de entrada e stop loss.`
        );
      }
    }
  }

  if (recommendations.length === 0) {
    console.log('✅ Nenhuma recomendação crítica no momento.\n');
  } else {
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}\n`);
    });
  }

  // ============================================================================
  // 4. MÉTRICAS DE PERFORMANCE
  // ============================================================================
  console.log('\n📊 4. MÉTRICAS DE PERFORMANCE SUGERIDAS\n');
  console.log('=' .repeat(80));
  console.log('📌 KPIs para monitorar:\n');
  console.log('   • Win Rate: % de trades lucrativas vs total');
  console.log('   • Average Win/Loss Ratio: Média de ganhos vs perdas');
  console.log('   • Sharpe Ratio: Retorno ajustado ao risco');
  console.log('   • Maximum Drawdown: Maior queda do equity');
  console.log('   • Profit Factor: Total de ganhos / Total de perdas');
  console.log('   • Recovery Factor: Retorno líquido / Drawdown máximo');
  console.log('   • Average Trade Duration: Tempo médio de abertura');
  console.log('   • Risk/Reward Ratio: Média de risco vs recompensa por trade\n');
}

// Executar análise
analyzeTradesAndEquity()
  .then(() => {
    console.log('\n✅ Análise concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro durante análise:', error);
    process.exit(1);
  });
