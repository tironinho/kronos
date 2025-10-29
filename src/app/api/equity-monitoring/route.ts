import { NextResponse } from 'next/server';
import EquityMonitoringService from '@/services/equity-monitoring-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const days = parseInt(searchParams.get('days') || '30');
    const action = searchParams.get('action') || 'evolution';

    const equityService = EquityMonitoringService.getInstance();

    switch (action) {
      case 'evolution':
        const evolution = await equityService.getEquityEvolution(symbol, days);
        if (!evolution) {
          return NextResponse.json({
            status: 'error',
            message: 'Não foi possível obter evolução do equity'
          }, { status: 404 });
        }

        return NextResponse.json({
          status: 'success',
          data: {
            symbol,
            period: `${days} dias`,
            evolution
          }
        });

      case 'performance':
        const performance = await equityService.getPerformanceMetrics(symbol);
        if (!performance) {
          return NextResponse.json({
            status: 'error',
            message: 'Não foi possível obter métricas de performance'
          }, { status: 404 });
        }

        return NextResponse.json({
          status: 'success',
          data: {
            symbol,
            performance
          }
        });

      case 'combined':
        const [equityEvolution, performanceMetrics] = await Promise.all([
          equityService.getEquityEvolution(symbol, days),
          equityService.getPerformanceMetrics(symbol)
        ]);

        return NextResponse.json({
          status: 'success',
          data: {
            symbol,
            period: `${days} dias`,
            equityEvolution,
            performanceMetrics
          }
        });

      case 'snapshot':
        const snapshotSuccess = await equityService.saveEquitySnapshot(symbol);
        return NextResponse.json({
          status: snapshotSuccess ? 'success' : 'error',
          message: snapshotSuccess ? 'Snapshot salvo com sucesso' : 'Erro ao salvar snapshot'
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Ação não reconhecida'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Erro na API de equity monitoring:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, symbol = 'BTCUSDT' } = body;

    const equityService = EquityMonitoringService.getInstance();

    switch (action) {
      case 'save_snapshot':
        const success = await equityService.saveEquitySnapshot(symbol);
        return NextResponse.json({
          status: success ? 'success' : 'error',
          message: success ? 'Snapshot salvo com sucesso' : 'Erro ao salvar snapshot'
        });

      case 'clear_cache':
        equityService.clearCache();
        return NextResponse.json({
          status: 'success',
          message: 'Cache limpo com sucesso'
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Ação não reconhecida'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Erro na API POST de equity monitoring:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}
