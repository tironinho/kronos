import { NextRequest, NextResponse } from 'next/server';
import { alphaVantageClient } from '@/services/alpha-vantage-client';
import { getComponentLogger, SystemComponent, SystemAction } from '@/services/logging';

const logger = getComponentLogger(SystemComponent.TradingEngine);

/**
 * GET /api/alpha-vantage/economic
 * Obter indicadores econômicos
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const country = searchParams.get('country') || 'united states';

    switch (action) {
      case 'gdp':
        const gdp = await alphaVantageClient.getGDP(country);
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage GDP retrieved', { country });
        return NextResponse.json({
          success: true,
          data: gdp
        });

      case 'inflation':
        const inflation = await alphaVantageClient.getInflation(country);
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage inflation retrieved', { country });
        return NextResponse.json({
          success: true,
          data: inflation
        });

      case 'complete':
        const economicData = await alphaVantageClient.getCompleteEconomicData();
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage complete economic data retrieved');
        return NextResponse.json({
          success: true,
          data: economicData
        });

      default:
        await logger.warn(SystemAction.DataProcessing, 'API: Invalid action for Alpha Vantage economic');
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: gdp, inflation, complete'
        }, { status: 400 });
    }
  } catch (error) {
    await logger.error(SystemAction.ErrorHandling, 'API: Error in Alpha Vantage economic request', error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process Alpha Vantage economic request'
    }, { status: 500 });
  }
}
