import { NextRequest, NextResponse } from 'next/server';
import { tradeStatusMonitor } from '@/services/trade-status-monitor';

/**
 * GET /api/monitoring/trade-status
 * Obtém status do monitor de trades
 */
export async function GET(request: NextRequest) {
  try {
    const stats = tradeStatusMonitor.getMonitoringStats();
    
    return NextResponse.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting trade status monitor:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get trade status monitor'
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/trade-status/check
 * Força verificação de uma trade específica
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tradeId } = body;

    if (!tradeId) {
      return NextResponse.json({
        success: false,
        error: 'Trade ID is required'
      }, { status: 400 });
    }

    const result = await tradeStatusMonitor.forceCheckTrade(tradeId);

    return NextResponse.json({
      success: true,
      data: {
        tradeId,
        checked: result,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error force checking trade:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to force check trade'
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/trade-status/cleanup
 * Limpa trades órfãs
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxAgeHours = 24 } = body;

    await tradeStatusMonitor.cleanupOrphanTrades(maxAgeHours);

    return NextResponse.json({
      success: true,
      message: 'Orphan trades cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error cleaning up orphan trades:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup orphan trades'
    }, { status: 500 });
  }
}
