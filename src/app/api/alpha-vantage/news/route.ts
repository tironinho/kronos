import { NextRequest, NextResponse } from 'next/server';
import { alphaVantageClient } from '@/services/alpha-vantage-client';
import { getComponentLogger, SystemComponent, SystemAction } from '@/services/logging';

const logger = getComponentLogger(SystemComponent.TradingEngine);

/**
 * GET /api/alpha-vantage/news
 * Obter análise de sentimento de notícias
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const topics = searchParams.get('topics')?.split(',') || ['blockchain', 'earnings'];
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (action) {
      case 'sentiment':
        const newsSentiment = await alphaVantageClient.getNewsSentiment(topics, limit);
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage news sentiment retrieved', { 
          topics: topics.length, 
          limit, 
          newsCount: newsSentiment.length 
        });
        return NextResponse.json({
          success: true,
          data: newsSentiment
        });

      case 'crypto-sentiment':
        const cryptoSentiment = await alphaVantageClient.getNewsSentiment(['blockchain', 'cryptocurrency', 'bitcoin'], limit);
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage crypto sentiment retrieved', { 
          newsCount: cryptoSentiment.length 
        });
        return NextResponse.json({
          success: true,
          data: cryptoSentiment
        });

      case 'earnings-sentiment':
        const earningsSentiment = await alphaVantageClient.getNewsSentiment(['earnings', 'financial'], limit);
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage earnings sentiment retrieved', { 
          newsCount: earningsSentiment.length 
        });
        return NextResponse.json({
          success: true,
          data: earningsSentiment
        });

      default:
        await logger.warn(SystemAction.DataProcessing, 'API: Invalid action for Alpha Vantage news');
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: sentiment, crypto-sentiment, earnings-sentiment'
        }, { status: 400 });
    }
  } catch (error) {
    await logger.error(SystemAction.ErrorHandling, 'API: Error in Alpha Vantage news request', error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process Alpha Vantage news request'
    }, { status: 500 });
  }
}
