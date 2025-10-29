import { NextRequest, NextResponse } from 'next/server';
import { alphaVantageClient } from '@/services/alpha-vantage-client';
import { logger } from '@/services/logger';

/**
 * GET /api/alpha-vantage/stats
 * Obter estatísticas de uso da API
 */
export async function GET(request: NextRequest) {
  try {
    const stats = alphaVantageClient.getApiStats();
    
    logger.info('API: Alpha Vantage API stats retrieved', 'API');
    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        rateLimit: 5,
        rateLimitWindow: 60000,
        status: stats.rateLimitRemaining > 0 ? 'active' : 'rate_limited'
      }
    });
  } catch (error) {
    logger.error('API: Error in Alpha Vantage stats request', 'API', null, error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process Alpha Vantage stats request'
    }, { status: 500 });
  }
}

/**
 * POST /api/alpha-vantage/stats
 * Resetar contador de rate limit
 */
export async function POST(request: NextRequest) {
  try {
    alphaVantageClient.resetRateLimit();
    
    logger.info('API: Alpha Vantage rate limit reset', 'API');
    return NextResponse.json({
      success: true,
      message: 'Rate limit reset successfully'
    });
  } catch (error) {
    logger.error('API: Error in Alpha Vantage rate limit reset', 'API', null, error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to reset Alpha Vantage rate limit'
    }, { status: 500 });
  }
}
