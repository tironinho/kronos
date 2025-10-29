import { NextResponse } from 'next/server';
import { tradeSimulatorEngine } from '@/services/trade-simulator-engine';
import { getBinanceClient } from '@/services/binance-api';

export async function GET() {
  try {
    const activeTrades: any[] = [];
    
    // 1. Buscar posições abertas REAIS na Binance (Futuros)
    try {
      const binanceClient = getBinanceClient();
      
      // Buscar posições de Futuros Perpétuos usando método do cliente
      const positions = await binanceClient.getFuturesPositions();
      
      // Filtrar posições abertas (não-zero)
      const openPositions = positions.filter((pos: any) => {
        const positionAmt = parseFloat(pos.positionAmt || '0');
        return Math.abs(positionAmt) > 0;
      });
      
      console.log(`📊 Encontradas ${openPositions.length} posições abertas na Binance Futures`);
      
      for (const pos of openPositions) {
        const positionAmt = parseFloat(pos.positionAmt || '0');
        const entryPrice = parseFloat(pos.entryPrice || '0');
        const markPrice = parseFloat(pos.markPrice || pos.notional || entryPrice);
        const leverage = parseFloat(pos.leverage || '1');
        const notional = parseFloat(pos.notional || '0'); // Valor da posição
        
        // Calcular P&L (já vem calculado da API)
        const unRealizedProfit = parseFloat(pos.unRealizedProfit || '0');
        const pnl = unRealizedProfit;
        
        // ✅ CORRIGIR: P&L % deve ser calculado SOBRE A MARGEM, não sobre o notional
        const isolatedMargin = parseFloat(pos.isolatedMargin || '0'); // Margem investida
        let pnlPercent = 0;
        
        if (isolatedMargin > 0) {
          // P&L % = (P&L / Margem investida) * 100
          pnlPercent = (unRealizedProfit / isolatedMargin) * 100;
        } else if (notional > 0 && leverage > 0) {
          // Fallback: calcular margem aproximada
          const estimatedMargin = Math.abs(notional) / leverage;
          if (estimatedMargin > 0) {
            pnlPercent = (unRealizedProfit / estimatedMargin) * 100;
          }
        } else {
          // Se não conseguimos calcular margem, usar notional como fallback (INPRECISO)
          pnlPercent = notional > 0 ? (unRealizedProfit / Math.abs(notional)) * 100 : 0;
        }
        
        // Determinar side
        const side = positionAmt > 0 ? 'BUY' : 'SELL';
        const quantity = Math.abs(positionAmt);
        
        activeTrades.push({
          symbol: pos.symbol,
          side,
          entryPrice,
          currentPrice: markPrice,
          quantity,
          pnl,
          pnlPercent,
          timestamp: Date.now(),
          algorithm: 'binance_real',
          leverage,
          liquidationPrice: parseFloat(pos.liquidationPrice || '0'),
          marginType: pos.marginType || 'isolated',
          notional: notional
        });
      }
    } catch (binanceError: any) {
      console.warn('⚠️ Erro ao buscar posições da Binance:', binanceError?.message || binanceError);
    }
    
    // 2. Buscar trades REAIS da tabela real_trades
    if (activeTrades.length === 0) {
      try {
        const { supabase } = await import('../../../services/supabase-db');
        if (supabase) {
          const { data: dbTrades } = await supabase
            .from('real_trades')
            .select('*')
            .eq('status', 'open')
            .order('opened_at', { ascending: false })
            .limit(50);
          
          if (dbTrades && dbTrades.length > 0) {
            // ✅ ChatGPT: FILTRAR trades órfãs com dados zerados
            const validTrades = dbTrades.filter((t: any) => {
              const hasValidPrice = t.entry_price > 0;
              const hasValidQuantity = t.quantity > 0;
              const hasValidSymbol = t.symbol && t.symbol.length > 0;
              
              if (!hasValidPrice || !hasValidQuantity || !hasValidSymbol) {
                console.log(`⚠️ Trade órfã filtrada: ${t.symbol} (entry=${t.entry_price}, qty=${t.quantity})`);
              }
              
              return hasValidPrice && hasValidQuantity && hasValidSymbol;
            });
            
            for (const dbTrade of validTrades) {
              activeTrades.push({
                symbol: dbTrade.symbol,
                side: dbTrade.side,
                entryPrice: dbTrade.entry_price,
                currentPrice: dbTrade.current_price || dbTrade.entry_price,
                quantity: dbTrade.quantity,
                pnl: dbTrade.pnl || 0,
                pnlPercent: dbTrade.pnl_percent || 0,
                timestamp: new Date(dbTrade.opened_at).getTime(),
                algorithm: dbTrade.algorithm || 'advanced_trading_engine'
              });
            }
            console.log(`📊 Encontrados ${validTrades.length}/${dbTrades.length} trades VÁLIDOS na tabela real_trades`);
            
            if (validTrades.length < dbTrades.length) {
              console.log(`⚠️ ${dbTrades.length - validTrades.length} trades órfãs filtradas (dados zerados)`);
            }
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Erro ao buscar trades reais:', dbError);
      }
    }

    console.log(`✅ Retornando ${activeTrades.length} trades ativos`);

    return NextResponse.json({
      status: 'success',
      data: activeTrades
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar trades:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao buscar trades'
    }, { status: 500 });
  }
}

