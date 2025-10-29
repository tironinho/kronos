import { NextRequest, NextResponse } from 'next/server';
import { alphaVantageClient } from '@/services/alpha-vantage-client';
import { logger } from '@/services/logger';

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
        logger.info('API: Alpha Vantage GDP retrieved', 'API', { country });
        return NextResponse.json({
          success: true,
          data: gdp
        });

      case 'inflation':
        const inflation = await alphaVantageClient.getInflation(country);
        logger.info('API: Alpha Vantage inflation retrieved', 'API', { country });
        return NextResponse.json({
          success: true,
          data: inflation
        });

      case 'complete':
        const economicData = await alphaVantageClient.getCompleteEconomicData();
        logger.info('API: Alpha Vantage complete economic data retrieved', 'API');
        return NextResponse.json({
          success: true,
          data: economicData
        });

      default:
        logger.warn('API: Invalid action for Alpha Vantage economic', 'API');
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: gdp, inflation, complete'
        }, { status: 400 });
    }
  } catch (error) {
    logger.error('API: Error in Alpha Vantage economic request', 'API', null, error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process Alpha Vantage economic request'
    }, { status: 500 });
  }
}
