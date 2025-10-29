import { NextRequest, NextResponse } from 'next/server';
import { alphaVantageClient } from '@/services/alpha-vantage-client';
import { getComponentLogger, SystemComponent, SystemAction } from '@/services/logging';

const logger = getComponentLogger(SystemComponent.TradingEngine);

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
        
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage quote retrieved', { symbol, type });
        return NextResponse.json({
          success: true,
          data: quote
        });

      case 'multiple':
        const symbols = symbol.split(',');
        const quotes = await alphaVantageClient.getMultipleStockQuotes(symbols);
        
        await logger.info(SystemAction.DataProcessing, 'API: Alpha Vantage multiple quotes retrieved', { 
          symbols: symbols.length, 
          retrieved: quotes.size 
        });
        return NextResponse.json({
          success: true,
          data: Object.fromEntries(quotes)
        });

      default:
        await logger.warn(SystemAction.DataProcessing, 'API: Invalid action for Alpha Vantage quote');
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: single, multiple'
        }, { status: 400 });
    }
  } catch (error) {
    await logger.error(SystemAction.ErrorHandling, 'API: Error in Alpha Vantage quote request', error as Error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process Alpha Vantage quote request'
    }, { status: 500 });
  }
}
