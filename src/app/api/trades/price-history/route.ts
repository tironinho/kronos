/**
 * API Route: /api/trades/price-history
 * 
 * Endpoint para consultar histórico de preços de trades
 * Permite análise detalhada do comportamento de preços ao longo do tempo
 */

import { NextRequest, NextResponse } from 'next/server';
import { tradePriceMonitor } from '@/services/trade-price-monitor.service';
import { supabase } from '@/services/supabase-db';
import { getComponentLogger, SystemAction, SystemComponent } from '@/services/logging';

const logger = getComponentLogger(SystemComponent.TradingEngine);

/**
 * GET /api/trades/price-history
 * 
 * Query params:
 * - trade_id: ID da trade específica (opcional)
 * - symbol: Símbolo para filtrar (opcional)
 * - limit: Limite de registros (padrão: 1000)
 * - start_date: Data de início (ISO string)
 * - end_date: Data de fim (ISO string)
 * - statistics: Se true, retorna estatísticas (padrão: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tradeId = searchParams.get('trade_id');
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const includeStatistics = searchParams.get('statistics') === 'true';

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase não disponível' },
        { status: 500 }
      );
    }

    let query = supabase
      .from('trade_price_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    // Filtrar por trade_id
    if (tradeId) {
      query = query.eq('trade_id', tradeId);
    }

    // Filtrar por symbol
    if (symbol) {
      query = query.eq('symbol', symbol);
    }

    // Filtrar por data
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }
    if (endDate) {
      query = query.lte('timestamp', endDate);
    }

    const { data: history, error } = await query;

    if (error) {
      logger.error(SystemAction.DataFetching, 'Erro ao buscar histórico de preços', error as Error);
      return NextResponse.json(
        { error: 'Erro ao buscar histórico de preços', details: error.message },
        { status: 500 }
      );
    }

    // Se solicitou estatísticas e tem trade_id, calcular estatísticas
    let statistics = null;
    if (includeStatistics && tradeId) {
      statistics = await tradePriceMonitor.getTradeStatistics(tradeId);
    }

    return NextResponse.json({
      success: true,
      count: history?.length || 0,
      data: history || [],
      statistics: statistics,
      filters: {
        trade_id: tradeId,
        symbol: symbol,
        limit: limit,
        start_date: startDate,
        end_date: endDate,
      },
    });
  } catch (error) {
    logger.error(SystemAction.SystemError, 'Erro no endpoint de histórico de preços', error as Error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trades/price-history/statistics
 * 
 * Calcula estatísticas agregadas de múltiplas trades
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trade_ids, symbols } = body;

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase não disponível' },
        { status: 500 }
      );
    }

    let query = supabase
      .from('trade_price_history')
      .select('*')
      .order('timestamp', { ascending: true });

    if (trade_ids && Array.isArray(trade_ids)) {
      query = query.in('trade_id', trade_ids);
    }

    if (symbols && Array.isArray(symbols)) {
      query = query.in('symbol', symbols);
    }

    const { data: history, error } = await query;

    if (error) {
      logger.error(SystemAction.DataFetching, 'Erro ao buscar histórico para estatísticas', error as Error);
      return NextResponse.json(
        { error: 'Erro ao buscar histórico', details: error.message },
        { status: 500 }
      );
    }

    // Calcular estatísticas agregadas
    if (!history || history.length === 0) {
      return NextResponse.json({
        success: true,
        statistics: {
          total_snapshots: 0,
          trades_analyzed: 0,
          average_pnl_percent: 0,
          max_pnl_percent: 0,
          min_pnl_percent: 0,
        },
      });
    }

    const pnls = history
      .map((h: any) => parseFloat(h.pnl_percent?.toString() || '0'))
      .filter((p: number) => !isNaN(p));

    const uniqueTrades = new Set(history.map((h: any) => h.trade_id));

    const statistics = {
      total_snapshots: history.length,
      trades_analyzed: uniqueTrades.size,
      average_pnl_percent: pnls.length > 0
        ? pnls.reduce((a, b) => a + b, 0) / pnls.length
        : 0,
      max_pnl_percent: pnls.length > 0 ? Math.max(...pnls) : 0,
      min_pnl_percent: pnls.length > 0 ? Math.min(...pnls) : 0,
      trades_with_data: Array.from(uniqueTrades),
    };

    return NextResponse.json({
      success: true,
      statistics: statistics,
    });
  } catch (error) {
    logger.error(SystemAction.SystemError, 'Erro ao calcular estatísticas', error as Error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: (error as Error).message },
      { status: 500 }
    );
  }
}

