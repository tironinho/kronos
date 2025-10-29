import { NextResponse } from 'next/server';
import { supabase } from '@/services/supabase-db';
import { getBinanceClient } from '@/services/binance-api';
import EquityMonitoringService from '@/services/equity-monitoring-service';

export async function GET() {
  try {
    // ✅ Buscar métricas REAIS de trading da tabela real_trades
    const { data: trades, error } = await supabase
      .from('real_trades')
      .select('*')
      .order('opened_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar trades:', error);
      throw error;
    }

    // Calcular métricas consolidadas
    const allTrades = trades || [];
    const closedTrades = allTrades.filter((t: any) => t.status === 'closed');
    const activeTrades = allTrades.filter((t: any) => t.status === 'open');
    
    const totalTrades = allTrades.length;
    
    // ✅ CORRIGIR: Calcular P&L total apenas de trades fechadas
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    // ✅ CORRIGIR: P&L % médio apenas de trades fechadas
    const totalPnLPercent = closedTrades.length > 0 
      ? closedTrades.reduce((sum, t) => sum + (t.pnl_percent || 0), 0) / closedTrades.length 
      : 0;
    
    // ✅ CORRIGIR: P&L hoje apenas de trades fechadas hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPnL = closedTrades
      .filter(t => {
        const closedAt = t.closed_at ? new Date(t.closed_at) : null;
        return closedAt && closedAt >= today;
      })
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    // ✅ CORRIGIR: Win rate apenas de trades fechadas
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0).length;
    const winRate = closedTrades.length > 0 
      ? (winningTrades / closedTrades.length) * 100 
      : 0;
    
    // ✅ CORRIGIR: Duração média apenas de trades fechadas
    const avgDuration = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => {
          const opened = new Date(t.opened_at);
          const closed = t.closed_at ? new Date(t.closed_at) : new Date();
          return sum + (closed.getTime() - opened.getTime()) / 1000 / 60; // em minutos
        }, 0) / closedTrades.length
      : 0;

    // ✅ NOVO: Calcular Profit Factor
    const totalWins = closedTrades
      .filter(t => (t.pnl || 0) > 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(closedTrades
      .filter(t => (t.pnl || 0) < 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);

    // ✅ NOVO: Calcular Sharpe Ratio aproximado
    const returns = closedTrades.map(t => t.pnl_percent || 0);
    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const variance = returns.length > 0 
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length 
      : 0;
    const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

    // ✅ NOVO: Buscar P&L atual de trades ativas na Binance
    let currentActivePnL = 0;
    let currentEquity = 0;
    let initialEquity = 0;
    let equityEvolution = null;
    let performanceMetrics = null;
    
    try {
      const binanceClient = getBinanceClient();
      const positions = await binanceClient.getFuturesPositions();
      const openPositions = positions.filter((pos: any) => {
        const positionAmt = parseFloat(pos.positionAmt || '0');
        return Math.abs(positionAmt) > 0;
      });
      
      currentActivePnL = openPositions.reduce((sum: number, pos: any) => {
        return sum + parseFloat(pos.unRealizedProfit || '0');
      }, 0);

      // ✅ NOVO: Buscar evolução do equity
      const accountInfo = await binanceClient.getFuturesAccountInfo();
      currentEquity = parseFloat(accountInfo.totalWalletBalance || '0');
      
      // Buscar evolução do equity usando o serviço
      const equityService = EquityMonitoringService.getInstance();
      equityEvolution = await equityService.getEquityEvolution('BTCUSDT', 30);
      performanceMetrics = await equityService.getPerformanceMetrics();
      
      if (equityEvolution) {
        initialEquity = equityEvolution.initialEquity;
      }
      
    } catch (binanceError) {
      console.warn('⚠️ Erro ao buscar dados da Binance:', binanceError);
    }

    const metrics = {
      totalTrades,
      activeTrades: activeTrades.length,
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      totalPnLPercent: parseFloat(totalPnLPercent.toFixed(2)),
      todayPnL: parseFloat(todayPnL.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
      avgTradeDuration: parseFloat(avgDuration.toFixed(1)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      currentActivePnL: parseFloat(currentActivePnL.toFixed(2)),
      winningTrades,
      losingTrades,
      totalWins: parseFloat(totalWins.toFixed(2)),
      totalLosses: parseFloat(totalLosses.toFixed(2)),
      // ✅ NOVO: Dados de evolução do equity
      currentEquity: parseFloat(currentEquity.toFixed(2)),
      initialEquity: parseFloat(initialEquity.toFixed(2)),
      equityReturn: initialEquity > 0 ? parseFloat(((currentEquity - initialEquity) / initialEquity * 100).toFixed(2)) : 0,
      equityEvolution: equityEvolution ? {
        totalReturn: parseFloat(equityEvolution.totalReturn.toFixed(2)),
        totalReturnPercent: parseFloat(equityEvolution.totalReturnPercent.toFixed(2)),
        dailyReturn: parseFloat(equityEvolution.dailyReturn.toFixed(2)),
        dailyReturnPercent: parseFloat(equityEvolution.dailyReturnPercent.toFixed(2)),
        weeklyReturn: parseFloat(equityEvolution.weeklyReturn.toFixed(2)),
        weeklyReturnPercent: parseFloat(equityEvolution.weeklyReturnPercent.toFixed(2)),
        monthlyReturn: parseFloat(equityEvolution.monthlyReturn.toFixed(2)),
        monthlyReturnPercent: parseFloat(equityEvolution.monthlyReturnPercent.toFixed(2)),
        maxDrawdown: parseFloat(equityEvolution.maxDrawdown.toFixed(2)),
        maxDrawdownPercent: parseFloat(equityEvolution.maxDrawdownPercent.toFixed(2)),
        sharpeRatio: parseFloat(equityEvolution.sharpeRatio.toFixed(2)),
        volatility: parseFloat(equityEvolution.volatility.toFixed(4))
      } : null,
      // ✅ NOVO: Métricas de performance avançadas
      performanceMetrics: performanceMetrics ? {
        avgWin: parseFloat(performanceMetrics.avgWin.toFixed(2)),
        avgLoss: parseFloat(performanceMetrics.avgLoss.toFixed(2)),
        maxConsecutiveWins: performanceMetrics.maxConsecutiveWins,
        maxConsecutiveLosses: performanceMetrics.maxConsecutiveLosses,
        bestTrade: parseFloat(performanceMetrics.bestTrade.toFixed(2)),
        worstTrade: parseFloat(performanceMetrics.worstTrade.toFixed(2))
      } : null
    };

    console.log(`📊 Métricas calculadas: ${closedTrades.length} trades fechadas, Win Rate: ${winRate.toFixed(1)}%, P&L Total: $${totalPnL.toFixed(2)}`);

    return NextResponse.json({
      status: 'success',
      data: metrics
    });
  } catch (error: any) {
    console.error('Erro ao buscar métricas:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao buscar métricas'
    }, { status: 500 });
  }
}

