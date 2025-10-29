import { NextRequest, NextResponse } from 'next/server';
import { alphaVantageClient } from '@/services/alpha-vantage-client';
import { logger } from '@/services/logger';

/**
 * GET /api/alpha-vantage/technical
 * Obter indicadores técnicos
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || 'daily';
    const period = parseInt(searchParams.get('period') || '14');

    if (!symbol) {
      return NextResponse.json({
        success: false,
        error: 'Symbol parameter is required'
      }, { status: 400 });
    }

    switch (action) {
      case 'rsi':
        const rsi = await alphaVantageClient.getRSI(symbol, timeframe, period);
        logger.info('API: Alpha Vantage RSI retrieved', 'API', { symbol, timeframe, period });
        return NextResponse.json({
          success: true,
          data: rsi
        });

      case 'macd':
        const macd = await alphaVantageClient.getMACD(symbol, timeframe);
        logger.info('API: Alpha Vantage MACD retrieved', 'API', { symbol, timeframe });
        return NextResponse.json({
          success: true,
          data: macd
        });

      case 'bollinger':
        const bbPeriod = parseInt(searchParams.get('bbPeriod') || '20');
        const bollingerBands = await alphaVantageClient.getBollingerBands(symbol, timeframe, bbPeriod);
        logger.info('API: Alpha Vantage Bollinger Bands retrieved', 'API', { symbol, timeframe, period: bbPeriod });
        return NextResponse.json({
          success: true,
          data: bollingerBands
        });

      case 'complete':
        const completeAnalysis = await alphaVantageClient.getCompleteTechnicalAnalysis(symbol);
        logger.info('API: Alpha Vantage complete technical analysis retrieved', 'API', { symbol });
        return NextResponse.json({
          success: true,
          data: completeAnalysis
        });

      default:
        logger.warn('API: Invalid action for Alpha Vantage technical', 'API');
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: rsi, macd, bollinger, complete'
        }, { status: 400 });
    }
  } catch (error) {
    logger.error('API: Error in Alpha Vantage technical request', 'API', null, error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process Alpha Vantage technical request'
    }, { status: 500 });
  }
}
