import { NextResponse } from 'next/server';
import { supabase } from '@/services/supabase-db';

export async function GET() {
  try {
    // Buscar trades abertas
    const { data: openTrades, error: tradesError } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false });

    if (tradesError) {
      console.error('❌ Erro ao buscar trades:', tradesError);
      return NextResponse.json({ error: tradesError.message }, { status: 500 });
    }

    // Buscar equity history
    const { data: equityHistory, error: equityError } = await supabase
      .from('equity_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);

    // Análise de trades
    const analysis = {
      trades: {
        total: openTrades?.length || 0,
        valid: 0,
        profitable: 0,
        losing: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        totalExposure: 0,
        bySymbol: {} as { [key: string]: any },
        critical: [] as any[],
        old: [] as any[],
        details: [] as any[]
      },
      equity: {
        hasHistory: false,
        current: 0,
        initial: 0,
        return: 0,
        returnPercent: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        trend: 'neutral' as 'up' | 'down' | 'neutral',
        recentReturn: 0,
        points: [] as any[]
      },
      recommendations: [] as string[]
    };

    if (openTrades && openTrades.length > 0) {
      let totalPnL = 0;
      let totalPnLPercent = 0;
      let totalExposure = 0;

      for (const trade of openTrades) {
        if (!trade.entry_price || !trade.quantity || !trade.symbol) {
          continue;
        }

        const currentPrice = trade.current_price || trade.entry_price;
        const entryValue = trade.entry_price * trade.quantity;
        const pnl = trade.side === 'BUY' 
          ? (currentPrice - trade.entry_price) * trade.quantity
          : (trade.entry_price - currentPrice) * trade.quantity;
        const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

        const openedAt = new Date(trade.opened_at);
        const hoursOpen = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);

        analysis.trades.valid++;
        totalPnL += pnl;
        totalPnLPercent += pnlPercent;
        totalExposure += entryValue;

        if (pnl > 0) analysis.trades.profitable++;
        else if (pnl < 0) analysis.trades.losing++;

        // Agrupar por símbolo
        if (!analysis.trades.bySymbol[trade.symbol]) {
          analysis.trades.bySymbol[trade.symbol] = {
            count: 0,
            totalPnL: 0,
            avgPnL: 0,
            exposure: 0
          };
        }
        analysis.trades.bySymbol[trade.symbol].count++;
        analysis.trades.bySymbol[trade.symbol].totalPnL += pnl;
        analysis.trades.bySymbol[trade.symbol].exposure += entryValue;

        // Detalhes
        analysis.trades.details.push({
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.entry_price,
          currentPrice: currentPrice,
          quantity: trade.quantity,
          pnl: pnl,
          pnlPercent: pnlPercent,
          exposure: entryValue,
          hoursOpen: hoursOpen,
          openedAt: trade.opened_at
        });

        // Crítico: prejuízo > 5%
        if (pnlPercent < -5) {
          analysis.trades.critical.push({
            symbol: trade.symbol,
            side: trade.side,
            pnlPercent: pnlPercent,
            hoursOpen: hoursOpen
          });
        }

        // Antiga: > 48 horas
        if (hoursOpen > 48) {
          analysis.trades.old.push({
            symbol: trade.symbol,
            side: trade.side,
            hoursOpen: hoursOpen,
            pnlPercent: pnlPercent
          });
        }
      }

      analysis.trades.totalPnL = totalPnL;
      analysis.trades.totalPnLPercent = totalPnLPercent;
      analysis.trades.totalExposure = totalExposure;

      // Calcular médias por símbolo
      Object.keys(analysis.trades.bySymbol).forEach(symbol => {
        const stats = analysis.trades.bySymbol[symbol];
        stats.avgPnL = stats.totalPnL / stats.count;
      });

      // Ordenar críticas por prejuízo
      analysis.trades.critical.sort((a, b) => a.pnlPercent - b.pnlPercent);
      
      // Ordenar antigas por duração
      analysis.trades.old.sort((a, b) => b.hoursOpen - a.hoursOpen);
    }

    // Análise de equity
    if (equityHistory && equityHistory.length > 0 && !equityError) {
      analysis.equity.hasHistory = true;
      const sorted = [...equityHistory]
        .map((p: any) => ({
          timestamp: p.timestamp,
          equity: p.equity || 0,
          returnPercent: p.return_percent || 0
        }))
        .filter((p: any) => p.equity > 0)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (sorted.length > 0) {
        analysis.equity.initial = sorted[0].equity;
        analysis.equity.current = sorted[sorted.length - 1].equity;
        analysis.equity.return = analysis.equity.current - analysis.equity.initial;
        analysis.equity.returnPercent = analysis.equity.initial > 0 
          ? (analysis.equity.return / analysis.equity.initial) * 100 
          : 0;

        // Calcular drawdown máximo
        let maxEquity = analysis.equity.initial;
        let maxDrawdown = 0;
        let maxDrawdownPercent = 0;

        sorted.forEach((point: any) => {
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

        analysis.equity.maxDrawdown = maxDrawdown;
        analysis.equity.maxDrawdownPercent = maxDrawdownPercent;

        // Tendência recente (últimas 24 horas)
        const recentPoints = sorted.slice(-24);
        if (recentPoints.length >= 2) {
          const recentReturn = recentPoints[recentPoints.length - 1].equity - recentPoints[0].equity;
          const recentReturnPercent = recentPoints[0].equity > 0 
            ? (recentReturn / recentPoints[0].equity) * 100 
            : 0;
          
          analysis.equity.recentReturn = recentReturnPercent;
          if (recentReturnPercent > 1) {
            analysis.equity.trend = 'up';
          } else if (recentReturnPercent < -1) {
            analysis.equity.trend = 'down';
          }
        }

        analysis.equity.points = sorted;
      }
    }

    // Recomendações
    if (analysis.trades.critical.length > 0) {
      analysis.recommendations.push(
        `🚨 CRÍTICO: ${analysis.trades.critical.length} trade(s) com prejuízo > 5%. ` +
        `Implementar stop loss mais agressivo.`
      );
    }

    if (analysis.trades.old.length > 0) {
      analysis.recommendations.push(
        `⏳ ${analysis.trades.old.length} trade(s) aberta(s) há mais de 48 horas. ` +
        `Implementar máximo de tempo ou revisão de estratégia.`
      );
    }

    const maxConcentration = Math.max(
      ...Object.values(analysis.trades.bySymbol).map((s: any) => s.count),
      0
    );
    if (maxConcentration > 3) {
      analysis.recommendations.push(
        `⚠️ Alto nível de concentração: ${maxConcentration} trades no mesmo símbolo. ` +
        `Considerar diversificação.`
      );
    }

    if (analysis.equity.hasHistory && analysis.equity.returnPercent < -5) {
      analysis.recommendations.push(
        `📉 Equity em declínio de ${analysis.equity.returnPercent.toFixed(2)}%. ` +
        `Revisar estratégia de entrada e stop loss.`
      );
    }

    if (analysis.trades.totalPnLPercent < -10) {
      analysis.recommendations.push(
        `📊 P&L total negativo de ${analysis.trades.totalPnLPercent.toFixed(2)}%. ` +
        `Considerar pausa nas operações ou redução de exposição.`
      );
    }

    return NextResponse.json(analysis, { status: 200 });
  } catch (error) {
    console.error('❌ Erro na análise:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
