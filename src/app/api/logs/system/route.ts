import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Simular logs do sistema
    const logs = [
      {
        id: 'log_001',
        timestamp: Date.now() - 5000,
        level: 'INFO',
        message: 'Monte Carlo simulation completed for BTCUSDT',
        source: 'monte-carlo-engine',
        metadata: { symbol: 'BTCUSDT', simulations: 1000, duration_ms: 1847 }
      },
      {
        id: 'log_002',
        timestamp: Date.now() - 10000,
        level: 'INFO',
        message: 'Trade executed successfully',
        source: 'trade-orchestrator',
        metadata: { trade_id: 'trade_001', symbol: 'BTCUSDT', side: 'BUY', quantity: 0.001 }
      },
      {
        id: 'log_003',
        timestamp: Date.now() - 15000,
        level: 'WARN',
        message: 'High volatility detected in ETHUSDT',
        source: 'risk-manager',
        metadata: { symbol: 'ETHUSDT', volatility: 0.1567, threshold: 0.15 }
      },
      {
        id: 'log_004',
        timestamp: Date.now() - 20000,
        level: 'ERROR',
        message: 'Failed to connect to Binance WebSocket',
        source: 'websocket-service',
        metadata: { error: 'Connection timeout', retry_count: 3 }
      },
      {
        id: 'log_005',
        timestamp: Date.now() - 25000,
        level: 'INFO',
        message: 'AI Agent analysis completed',
        source: 'ai-agent',
        metadata: { symbol: 'BTCUSDT', confidence: 0.85, recommendation: 'HOLD' }
      },
      {
        id: 'log_006',
        timestamp: Date.now() - 30000,
        level: 'DEBUG',
        message: 'Signal generated for ADAUSDT',
        source: 'signal-engine',
        metadata: { symbol: 'ADAUSDT', signal_type: 'OFI', strength: 0.72 }
      },
      {
        id: 'log_007',
        timestamp: Date.now() - 35000,
        level: 'INFO',
        message: 'Account balance updated',
        source: 'account-manager',
        metadata: { total_balance: 12500.50, available_balance: 8500.25 }
      },
      {
        id: 'log_008',
        timestamp: Date.now() - 40000,
        level: 'WARN',
        message: 'Risk limit approaching for SOLUSDT',
        source: 'risk-manager',
        metadata: { symbol: 'SOLUSDT', current_exposure: 0.08, limit: 0.10 }
      }
    ];

    return NextResponse.json({
      status: 'success',
      data: logs
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Erro ao obter logs do sistema',
      error: error.message
    }, { status: 500 });
  }
}
