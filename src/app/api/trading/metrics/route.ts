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
    
    // ✅ CRÍTICO: Filtrar apenas trades fechadas com P&L válido (não null, não undefined)
    // Trades com P&L = 0 também devem ser consideradas (podem ter sido fechadas no break-even)
    const validClosedTrades = closedTrades.filter((t: any) => 
      t.pnl !== null && 
      t.pnl !== undefined && 
      (typeof t.pnl === 'number' || !isNaN(parseFloat(t.pnl)))
    );
    
    // ✅ CORRIGIR: Calcular P&L total apenas de trades fechadas válidas
    const totalPnL = validClosedTrades.reduce((sum: number, t: any) => {
      const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
      return sum + (isNaN(pnl) ? 0 : pnl);
    }, 0);
    
    // ✅ CORRIGIR: P&L % médio apenas de trades fechadas válidas
    const totalPnLPercent = validClosedTrades.length > 0 
      ? validClosedTrades.reduce((sum: number, t: any) => {
          const pnlPercent = typeof t.pnl_percent === 'number' ? t.pnl_percent : parseFloat(t.pnl_percent || '0');
          return sum + (isNaN(pnlPercent) ? 0 : pnlPercent);
        }, 0) / validClosedTrades.length 
      : 0;
    
    // ✅ CORRIGIR: P&L hoje apenas de trades fechadas hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPnL = validClosedTrades
      .filter((t: any) => {
        const closedAt = t.closed_at ? new Date(t.closed_at) : null;
        return closedAt && closedAt >= today;
      })
      .reduce((sum: number, t: any) => {
        const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
        return sum + (isNaN(pnl) ? 0 : pnl);
      }, 0);
    
    // ✅ CORRIGIR: Win rate apenas de trades fechadas VÁLIDAS (com P&L real)
    // ✅ CRÍTICO: Analisa cada trade individualmente para garantir cálculo correto
    const winningTrades = validClosedTrades.filter((t: any) => {
      const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
      // Trade é vitoriosa se P&L > 0 (mesmo que pequeno)
      return !isNaN(pnl) && pnl > 0;
    }).length;
    
    const losingTrades = validClosedTrades.filter((t: any) => {
      const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
      // Trade é perdedora se P&L < 0
      return !isNaN(pnl) && pnl < 0;
    }).length;
    
    const breakEvenTrades = validClosedTrades.filter((t: any) => {
      const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
      // Trade é break-even se P&L = 0
      return !isNaN(pnl) && pnl === 0;
    }).length;
    
    // ✅ CRÍTICO: Win rate baseado APENAS em trades com resultado (vitórias / (vitórias + derrotas))
    // ✅ Ignora trades break-even no cálculo do win rate (conforme análise cruzada)
    // ✅ Win Rate = Vitórias / (Vitórias + Derrotas) * 100
    const tradesWithResult = winningTrades + losingTrades;
    const winRate = tradesWithResult > 0 
      ? (winningTrades / tradesWithResult) * 100 
      : 0;
    
    // ✅ CORRIGIR: Duração média apenas de trades fechadas válidas
    const avgDuration = validClosedTrades.length > 0
      ? validClosedTrades.reduce((sum: number, t: any) => {
          const opened = new Date(t.opened_at);
          const closed = t.closed_at ? new Date(t.closed_at) : new Date();
          return sum + (closed.getTime() - opened.getTime()) / 1000 / 60; // em minutos
        }, 0) / validClosedTrades.length
      : 0;

    // ✅ CORRIGIR: Calcular Profit Factor apenas de trades com resultado
    const totalWins = validClosedTrades
      .filter((t: any) => {
        const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
        return !isNaN(pnl) && pnl > 0;
      })
      .reduce((sum: number, t: any) => {
        const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
        return sum + (isNaN(pnl) ? 0 : pnl);
      }, 0);
      
    const totalLosses = Math.abs(validClosedTrades
      .filter((t: any) => {
        const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
        return !isNaN(pnl) && pnl < 0;
      })
      .reduce((sum: number, t: any) => {
        const pnl = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl || '0');
        return sum + (isNaN(pnl) ? 0 : pnl);
      }, 0));
      
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);

    // ✅ CORRIGIR: Calcular Sharpe Ratio apenas de trades com resultado válido
    const returns = validClosedTrades
      .map((t: any) => {
        const pnlPercent = typeof t.pnl_percent === 'number' ? t.pnl_percent : parseFloat(t.pnl_percent || '0');
        return isNaN(pnlPercent) ? 0 : pnlPercent;
      })
      .filter((r: number) => r !== 0); // Filtrar returns zerados para cálculo mais preciso
    
    const avgReturn = returns.length > 0 ? returns.reduce((sum: number, r: number) => sum + r, 0) / returns.length : 0;
    const variance = returns.length > 0 
      ? returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length 
      : 0;
    const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

    // ✅ CRÍTICO: Calcular P&L em tempo real das trades abertas
    let currentActivePnL = 0;
    let currentEquity = 0;
    let initialEquity = 0;
    let equityEvolution = null;
    let performanceMetrics = null;
    
    // ✅ NOVO: Analisar trades abertas para Win Rate em tempo real
    let activeWinningTrades = 0;
    let activeLosingTrades = 0;
    let activeBreakEvenTrades = 0;
    let activeTradesPnL = 0;
    
    try {
      const binanceClient = getBinanceClient();
      
      // Buscar posições abertas na Binance
      const positions = await binanceClient.getFuturesPositions();
      const openPositions = positions.filter((pos: any) => {
        const positionAmt = parseFloat(pos.positionAmt || '0');
        return Math.abs(positionAmt) > 0;
      });
      
      // Calcular P&L total não realizado
      currentActivePnL = openPositions.reduce((sum: number, pos: any) => {
        const unRealizedPnl = parseFloat(pos.unRealizedProfit || '0');
        return sum + unRealizedPnl;
      }, 0);
      
      // Analisar cada posição aberta para Win Rate em tempo real
      for (const pos of openPositions) {
        const unRealizedPnl = parseFloat(pos.unRealizedProfit || '0');
        activeTradesPnL += unRealizedPnl;
        
        if (unRealizedPnl > 0.001) { // Margem de erro para considerar vitoriosa
          activeWinningTrades++;
        } else if (unRealizedPnl < -0.001) { // Margem de erro para considerar perdedora
          activeLosingTrades++;
        } else {
          activeBreakEvenTrades++;
        }
      }
      
      // ✅ CRÍTICO: Também verificar trades abertas no banco de dados (caso não estejam na Binance ainda)
      for (const trade of activeTrades) {
        const pnl = typeof trade.pnl === 'number' ? trade.pnl : parseFloat(trade.pnl || '0');
        const currentPrice = typeof trade.current_price === 'number' ? trade.current_price : parseFloat(trade.current_price || '0');
        const entryPrice = typeof trade.entry_price === 'number' ? trade.entry_price : parseFloat(trade.entry_price || '0');
        
        // Se P&L não está atualizado, calcular baseado no preço atual vs entrada
        let calculatedPnl = pnl;
        if ((!pnl || pnl === 0) && currentPrice > 0 && entryPrice > 0) {
          const quantity = typeof trade.quantity === 'number' ? trade.quantity : parseFloat(trade.quantity || '0');
          calculatedPnl = trade.side === 'BUY' 
            ? (currentPrice - entryPrice) * quantity
            : (entryPrice - currentPrice) * quantity;
        }
        
        activeTradesPnL += calculatedPnl;
        
        if (calculatedPnl > 0.001) {
          activeWinningTrades++;
        } else if (calculatedPnl < -0.001) {
          activeLosingTrades++;
        } else {
          activeBreakEvenTrades++;
        }
      }

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
      
      // Se não encontrou equity inicial, usar primeira entrada do equity_history
      if (!initialEquity || initialEquity === 0) {
        const { data: firstEquity } = await supabase
          .from('equity_history')
          .select('equity')
          .eq('symbol', 'USDT_FUTURES')
          .order('timestamp', { ascending: true })
          .limit(1)
          .single();
        
        if (firstEquity) {
          initialEquity = parseFloat(firstEquity.equity || '0');
        }
      }
      
    } catch (binanceError) {
      console.warn('⚠️ Erro ao buscar dados da Binance:', binanceError);
    }
    
    // ✅ CRÍTICO: Win Rate em TEMPO REAL incluindo trades abertas
    // Total de trades com resultado (fechadas + abertas)
    const totalWinningTrades = winningTrades + activeWinningTrades;
    const totalLosingTrades = losingTrades + activeLosingTrades;
    const totalTradesWithResult = totalWinningTrades + totalLosingTrades;
    
    // Win Rate real em tempo real = (Vitórias Fechadas + Vitórias Abertas) / (Total com Resultado)
    const realTimeWinRate = totalTradesWithResult > 0 
      ? (totalWinningTrades / totalTradesWithResult) * 100 
      : (tradesWithResult > 0 ? winRate : 0); // Fallback para win rate apenas de fechadas
    
    // ✅ CRÍTICO: P&L TOTAL (Fechadas + Abertas)
    const totalPnLIncludingActive = totalPnL + currentActivePnL;

    const metrics = {
      totalTrades,
      activeTrades: activeTrades.length,
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      totalPnLIncludingActive: parseFloat(totalPnLIncludingActive.toFixed(2)), // ✅ P&L Total incluindo trades abertas
      totalPnLPercent: parseFloat(totalPnLPercent.toFixed(2)),
      todayPnL: parseFloat(todayPnL.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)), // Win Rate apenas de trades fechadas
      realTimeWinRate: parseFloat(realTimeWinRate.toFixed(1)), // ✅ Win Rate em TEMPO REAL (fechadas + abertas)
      avgTradeDuration: parseFloat(avgDuration.toFixed(1)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      currentActivePnL: parseFloat(currentActivePnL.toFixed(2)),
      winningTrades,
      losingTrades,
      breakEvenTrades,
      activeWinningTrades, // ✅ Trades abertas vitoriosas
      activeLosingTrades, // ✅ Trades abertas perdedoras
      activeBreakEvenTrades, // ✅ Trades abertas break-even
      totalWinningTrades, // ✅ Total de vitórias (fechadas + abertas)
      totalLosingTrades, // ✅ Total de perdas (fechadas + abertas)
      tradesWithResult, // Total de trades com resultado (vitórias + derrotas) - apenas fechadas
      totalTradesWithResult, // ✅ Total de trades com resultado incluindo abertas
      validClosedTrades: validClosedTrades.length, // Total de trades com P&L válido
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

    console.log(`📊 Métricas calculadas:`);
    console.log(`   Total de trades fechadas: ${closedTrades.length}`);
    console.log(`   Trades abertas: ${activeTrades.length}`);
    console.log(`   Trades com P&L válido (fechadas): ${validClosedTrades.length}`);
    console.log(`   Vitórias Fechadas: ${winningTrades}, Derrotas Fechadas: ${losingTrades}, Break-even: ${breakEvenTrades}`);
    console.log(`   Vitórias Abertas: ${activeWinningTrades}, Perdas Abertas: ${activeLosingTrades}`);
    console.log(`   Win Rate (fechadas): ${winRate.toFixed(1)}% (baseado em ${tradesWithResult} trades)`);
    console.log(`   Win Rate (TEMPO REAL): ${realTimeWinRate.toFixed(1)}% (baseado em ${totalTradesWithResult} trades incluindo abertas)`);
    console.log(`   P&L Fechadas: $${totalPnL.toFixed(2)}`);
    console.log(`   P&L Abertas: $${currentActivePnL.toFixed(2)}`);
    console.log(`   P&L TOTAL: $${totalPnLIncludingActive.toFixed(2)}`);
    console.log(`   Profit Factor: ${profitFactor.toFixed(2)}`);
    
    // ✅ CRÍTICO: Explicar discrepância entre Win Rate e perda de capital
    if (realTimeWinRate > 50 && totalPnLIncludingActive < 0) {
      console.log(`   ⚠️  ALERTA: Win Rate alto (${realTimeWinRate.toFixed(1)}%) mas P&L negativo ($${totalPnLIncludingActive.toFixed(2)})`);
      console.log(`      Possíveis causas:`);
      console.log(`      - Perdas médias são maiores que ganhos médios (check Profit Factor)`);
      console.log(`      - Trades abertas com grandes perdas não realizadas: $${currentActivePnL.toFixed(2)}`);
      console.log(`      - Taxas de trading não contabilizadas`);
      const avgWinAmount = winningTrades > 0 ? totalWins / winningTrades : 0;
      const avgLossAmount = losingTrades > 0 ? totalLosses / losingTrades : 0;
      console.log(`      - Ganho médio: $${avgWinAmount.toFixed(2)} | Perda média: $${avgLossAmount.toFixed(2)}`);
    }

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

