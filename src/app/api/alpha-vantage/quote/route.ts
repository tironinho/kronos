import { NextRequest, NextResponse } from 'next/server';
import { alphaVantageClient } from '@/services/alpha-vantage-client';
import { logger } from '@/services/logger';

/**
 * GET /api/alpha-vantage/quote
 * Obter cotação de ação ou criptomoeda
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const symbol = searchParams.get('symbol');
    const type = searchParams.get('type') || 'stock'; // 'stock' ou 'crypto'

    if (!symbol) {
      return NextResponse.json({
        success: false,
        error: 'Symbol parameter is required'
      }, { status: 400 });
    }

    switch (action) {
      case 'single':
        let quote;
        if (type === 'crypto') {
          quote = await alphaVantageClient.getCryptoQuote(symbol);
        } else {
          quote = await alphaVantageClient.getStockQuote(symbol);
        }
        
        logger.info('API: Alpha Vantage quote retrieved', 'API', { symbol, type });
        return NextResponse.json({
          success: true,
          data: quote
        });

      case 'multiple':
        const symbols = symbol.split(',');
        const quotes = await alphaVantageClient.getMultipleStockQuotes(symbols);
        
        logger.info('API: Alpha Vantage multiple quotes retrieved', 'API', { 
          symbols: symbols.length, 
          retrieved: quotes.size 
        });
        return NextResponse.json({
          success: true,
          data: Object.fromEntries(quotes)
        });

      default:
        logger.warn('API: Invalid action for Alpha Vantage quote', 'API');
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: single, multiple'
        }, { status: 400 });
    }
  } catch (error) {
    logger.error('API: Error in Alpha Vantage quote request', 'API', null, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process Alpha Vantage quote request'
    }, { status: 500 });
  }
}
