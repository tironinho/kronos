import { NextResponse } from 'next/server';
import WebSocketService from '@/services/websocket-service';

const wsService = WebSocketService.getInstance();

export async function GET() {
  try {
    const stats = wsService.getStats();
    
    return NextResponse.json({
      status: 'success',
      data: {
        websocket: stats,
        message: 'WebSocket service statistics retrieved successfully'
      }
    });

  } catch (error: any) {
    console.error('Erro ao buscar estatísticas WebSocket:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'broadcast':
        if (!data) {
          return NextResponse.json({
            status: 'error',
            message: 'Data is required for broadcast'
          }, { status: 400 });
        }

        wsService.broadcast({
          type: 'manual_broadcast',
          data,
          timestamp: new Date().toISOString()
        });

        return NextResponse.json({
          status: 'success',
          message: 'Message broadcasted successfully'
        });

      case 'broadcast_trading_metrics':
        await wsService.broadcastTradingMetrics();
        return NextResponse.json({
          status: 'success',
          message: 'Trading metrics broadcasted successfully'
        });

      case 'broadcast_market_data':
        const { symbol } = data;
        if (!symbol) {
          return NextResponse.json({
            status: 'error',
            message: 'Symbol is required for market data broadcast'
          }, { status: 400 });
        }

        await wsService.broadcastMarketData(symbol);
        return NextResponse.json({
          status: 'success',
          message: `Market data for ${symbol} broadcasted successfully`
        });

      case 'broadcast_technical_analysis':
        const { symbol: taSymbol, timeframe } = data;
        if (!taSymbol || !timeframe) {
          return NextResponse.json({
            status: 'error',
            message: 'Symbol and timeframe are required for technical analysis broadcast'
          }, { status: 400 });
        }

        await wsService.broadcastTechnicalAnalysis(taSymbol, timeframe);
        return NextResponse.json({
          status: 'success',
          message: `Technical analysis for ${taSymbol} (${timeframe}) broadcasted successfully`
        });

      case 'broadcast_enhanced_data':
        const { symbol: edSymbol } = data;
        if (!edSymbol) {
          return NextResponse.json({
            status: 'error',
            message: 'Symbol is required for enhanced data broadcast'
          }, { status: 400 });
        }

        await wsService.broadcastEnhancedData(edSymbol);
        return NextResponse.json({
          status: 'success',
          message: `Enhanced data for ${edSymbol} broadcasted successfully`
        });

      case 'broadcast_trade_update':
        if (!data) {
          return NextResponse.json({
            status: 'error',
            message: 'Trade data is required for trade update broadcast'
          }, { status: 400 });
        }

        await wsService.broadcastTradeUpdate(data);
        return NextResponse.json({
          status: 'success',
          message: 'Trade update broadcasted successfully'
        });

      case 'broadcast_alert':
        if (!data) {
          return NextResponse.json({
            status: 'error',
            message: 'Alert data is required for alert broadcast'
          }, { status: 400 });
        }

        await wsService.broadcastAlert(data);
        return NextResponse.json({
          status: 'success',
          message: 'Alert broadcasted successfully'
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Erro na API WebSocket:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}
