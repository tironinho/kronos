/**
 * API Route: /api/backtesting/run
 * 
 * Endpoint para executar backtest manual
 */

import { NextRequest, NextResponse } from 'next/server';
import { automatedBacktestingService } from '@/services/automated-backtesting-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { symbols, days } = body;

    const symbolsList = symbols || ['BTCUSDT', 'ETHUSDT'];
    const daysCount = days || 7;

    // Executar backtest manual
    await automatedBacktestingService.runManualBacktest(symbolsList, daysCount);
    
    return NextResponse.json({
      success: true,
      message: 'Backtest executado com sucesso',
      data: {
        symbols: symbolsList,
        days: daysCount
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro ao executar backtest',
      details: (error as Error).message
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Retornar status do serviço de backtesting
    return NextResponse.json({
      success: true,
      data: {
        enabled: true,
        frequency: 'weekly',
        message: 'Serviço de backtesting automático está ativo'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro ao obter status de backtesting',
      details: (error as Error).message
    }, { status: 500 });
  }
}

