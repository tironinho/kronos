import { NextRequest, NextResponse } from 'next/server';
import { alphaVantageClient } from '@/services/alpha-vantage-client';
import { getComponentLogger, SystemComponent, SystemAction } from '@/services/logging';

const logger = getComponentLogger(SystemComponent.TradingEngine);

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
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage RSI retrieved', { symbol, timeframe, period });
        return NextResponse.json({
          success: true,
          data: rsi
        });

      case 'macd':
        const macd = await alphaVantageClient.getMACD(symbol, timeframe);
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage MACD retrieved', { symbol, timeframe });
        return NextResponse.json({
          success: true,
          data: macd
        });

      case 'bollinger':
        const bbPeriod = parseInt(searchParams.get('bbPeriod') || '20');
        const bollingerBands = await alphaVantageClient.getBollingerBands(symbol, timeframe, bbPeriod);
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage Bollinger Bands retrieved', { symbol, timeframe, period: bbPeriod });
        return NextResponse.json({
          success: true,
          data: bollingerBands
        });

      case 'complete':
        const completeAnalysis = await alphaVantageClient.getCompleteTechnicalAnalysis(symbol);
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage complete technical analysis retrieved', { symbol });
        return NextResponse.json({
          success: true,
          data: completeAnalysis
        });

      default:
        await logger.warn(SystemAction.DataProcessing, 'API: Invalid action for Alpha Vantage technical');
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: rsi, macd, bollinger, complete'
        }, { status: 400 });
    }
  } catch (error) {
    await logger.error(SystemAction.ErrorHandling, 'API: Error in Alpha Vantage technical request', error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process Alpha Vantage technical request'
    }, { status: 500 });
  }
}
