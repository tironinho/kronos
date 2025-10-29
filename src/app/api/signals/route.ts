// ============================================================================
// API ROUTE: /api/signals - SINAIS DE TRADING
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSignalEngine, createSignalEngineWithDefaults } from '@/services/signal-engine';
import { getComponentLogger, SystemComponent, SystemAction } from '@/services/logging';
import { getStrategyConfig } from '@/config';

const logger = getComponentLogger(SystemComponent.SignalEngine);

export async function GET(request: NextRequest) {
  try {
    let signalEngine;
    
    try {
      // Tenta obter engine existente
      signalEngine = getSignalEngine();
    } catch (error) {
      // Se não existir, cria com configurações padrão
      const strategyConfig = getStrategyConfig();
      signalEngine = createSignalEngineWithDefaults();
    }

    const signals = signalEngine.generateSignals();
    
    const response = {
      status: 'success',
      data: signals,
      count: signals.length,
      timestamp: Date.now()
    };

    await logger.info(
      SystemAction.SignalGeneration,
      `${signals.length} sinais gerados via API`,
      { endpoint: '/api/signals', signals_count: signals.length }
    );

    return NextResponse.json(response);
    
  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro ao gerar sinais',
      error as Error,
      { endpoint: '/api/signals' }
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
    const signalEngine = getSignalEngine();
    
    // Adiciona dados de trade se fornecidos
    if (body.trade) {
      signalEngine.addTrade(body.symbol, {
        price: body.trade.price,
        quantity: body.trade.quantity,
        is_buyer_maker: body.trade.is_buyer_maker,
        timestamp: body.trade.timestamp || Date.now()
      });
    }
    
    // Adiciona dados de depth se fornecidos
    if (body.depth) {
      signalEngine.addDepth(body.symbol, {
        bids: body.depth.bids,
        asks: body.depth.asks,
        timestamp: body.depth.timestamp || Date.now()
      });
    }

    await logger.info(
      SystemAction.DataProcessing,
      'Dados adicionados ao SignalEngine via API',
      { endpoint: '/api/signals', has_trade: !!body.trade, has_depth: !!body.depth }
    );

    return NextResponse.json({
      status: 'success',
      message: 'Dados adicionados com sucesso'
    });
    
  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro ao adicionar dados ao SignalEngine',
      error as Error,
      { endpoint: '/api/signals' }
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
