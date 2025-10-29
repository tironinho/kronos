// ============================================================================
// API ROUTE: /api/metrics - MÉTRICAS DO SISTEMA
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/services/metrics';
import { getComponentLogger, SystemComponent, SystemAction } from '@/services/logging';

const logger = getComponentLogger(SystemComponent.TradingEngine);

export async function GET(request: NextRequest) {
  try {
    const metrics = getMetrics();
    const metricsData = metrics.get();
    
    const response = {
      status: 'success',
      data: {
        equity: metricsData.equity,
        pnl_day: metricsData.pnl_day,
        fills_ratio: metricsData.fills_ratio,
        selected_symbols: metricsData.selected_symbols,
        notes: metricsData.notes,
        timestamp: metricsData.timestamp
      }
    };

    await logger.info(
      SystemAction.PerformanceUpdate,
      'Métricas solicitadas via API',
      { endpoint: '/api/metrics' }
    );

    return NextResponse.json(response);
    
  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro ao obter métricas',
      error as Error,
      { endpoint: '/api/metrics' }
    );

    return NextResponse.json(
      {
        status: 'error',
        error: 'Erro interno do servidor',
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const metrics = getMetrics();
    
    // Atualiza métricas com dados fornecidos
    metrics.update((data) => {
      if (body.equity !== undefined) data.equity = body.equity;
      if (body.pnl_day !== undefined) data.pnl_day = body.pnl_day;
      if (body.fills_ratio !== undefined) data.fills_ratio = body.fills_ratio;
      if (body.selected_symbols !== undefined) data.selected_symbols = body.selected_symbols;
      if (body.notes !== undefined) data.notes = body.notes;
    });

    await logger.info(
      SystemAction.PerformanceUpdate,
      'Métricas atualizadas via API',
      { endpoint: '/api/metrics', updates: body }
    );

    return NextResponse.json({
      status: 'success',
      message: 'Métricas atualizadas com sucesso',
      data: metrics.get()
    });
    
  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro ao atualizar métricas',
      error as Error,
      { endpoint: '/api/metrics' }
    );

    return NextResponse.json(
      {
        status: 'error',
        error: 'Erro interno do servidor',
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}
