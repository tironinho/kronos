import { NextRequest, NextResponse } from 'next/server';
import TechnicalAnalysisService from '@/services/technical-analysis-service';
import { logger } from '@/services/logger';

/**
 * GET /api/technical-analysis/signal
 * Obter sinal técnico para um símbolo específico
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') || '1h';
    const minConfidence = parseInt(searchParams.get('minConfidence') || '40');
    const action = searchParams.get('action');

    if (!symbol) {
      logger.warn('API: Symbol parameter is required for technical analysis', 'API');
      return NextResponse.json({
        success: false,
        error: 'Symbol parameter is required'
      }, { status: 400 });
    }

    switch (action) {
      case 'signal':
        const signal = await TechnicalAnalysisService.getTechnicalSignal(symbol, {
          timeframe,
          minConfidence
        });

        if (!signal) {
          logger.warn(`API: No technical signal found for ${symbol}`, 'API');
          return NextResponse.json({
            success: false,
            error: 'No technical signal found for this symbol'
          }, { status: 404 });
        }

        logger.info(`API: Technical signal retrieved for ${symbol}`, 'API', {
          recommendation: signal.recommendation,
          confidence: signal.confidence,
          strength: signal.strength
        });

        return NextResponse.json({
          success: true,
          data: signal
        });

      case 'full':
        const fullAnalysis = await TechnicalAnalysisService.getFullTechnicalAnalysis(symbol, {
          timeframe
        });

        if (!fullAnalysis) {
          logger.warn(`API: No full technical analysis found for ${symbol}`, 'API');
          return NextResponse.json({
            success: false,
            error: 'No full technical analysis found for this symbol'
          }, { status: 404 });
        }

        logger.info(`API: Full technical analysis retrieved for ${symbol}`, 'API');

        return NextResponse.json({
          success: true,
          data: fullAnalysis
        });

      case 'multiple':
        const symbolsParam = searchParams.get('symbols');
        if (!symbolsParam) {
          logger.warn('API: Symbols parameter is required for multiple analysis', 'API');
          return NextResponse.json({
            success: false,
            error: 'Symbols parameter is required for multiple analysis'
          }, { status: 400 });
        }

        const symbols = symbolsParam.split(',');
        const signals = await TechnicalAnalysisService.getMultipleTechnicalSignals(symbols, {
          timeframe,
          minConfidence
        });

        logger.info(`API: Multiple technical signals retrieved for ${symbols.length} symbols`, 'API', {
          symbols: Array.from(signals.keys()),
          count: signals.size
        });

        return NextResponse.json({
          success: true,
          data: Object.fromEntries(signals)
        });

      case 'filter':
        const symbolsToFilter = searchParams.get('symbols');
        const allowedSignals = searchParams.get('allowedSignals')?.split(',') as ('STRONG_BUY' | 'BUY' | 'SELL' | 'STRONG_SELL')[] || ['STRONG_BUY', 'BUY', 'SELL', 'STRONG_SELL'];

        if (!symbolsToFilter) {
          logger.warn('API: Symbols parameter is required for filtering', 'API');
          return NextResponse.json({
            success: false,
            error: 'Symbols parameter is required for filtering'
          }, { status: 400 });
        }

        const symbolsList = symbolsToFilter.split(',');
        const filteredSymbols = await TechnicalAnalysisService.filterSymbolsByTechnicalSignal(
          symbolsList,
          allowedSignals,
          minConfidence,
          { timeframe }
        );

        logger.info(`API: Symbols filtered by technical signal`, 'API', {
          original: symbolsList.length,
          filtered: filteredSymbols.length,
          allowedSignals
        });

        return NextResponse.json({
          success: true,
          data: {
            original: symbolsList,
            filtered: filteredSymbols,
            count: filteredSymbols.length
          }
        });

      case 'stats':
        const symbolsForStats = searchParams.get('symbols');
        if (!symbolsForStats) {
          logger.warn('API: Symbols parameter is required for stats', 'API');
          return NextResponse.json({
            success: false,
            error: 'Symbols parameter is required for stats'
          }, { status: 400 });
        }

        const symbolsStats = symbolsForStats.split(',');
        const stats = await TechnicalAnalysisService.getTechnicalSignalsStats(symbolsStats, {
          timeframe
        });

        logger.info(`API: Technical signals stats retrieved for ${symbolsStats.length} symbols`, 'API');

        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'cache':
        const cacheStats = TechnicalAnalysisService.getCacheStats();
        logger.info('API: Cache stats retrieved', 'API');
        return NextResponse.json({
          success: true,
          data: cacheStats
        });

      default:
        logger.warn('API: Invalid action for technical analysis', 'API');
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Valid actions: signal, full, multiple, filter, stats, cache'
        }, { status: 400 });
    }
  } catch (error) {
    logger.error('API: Error in technical analysis request', 'API', null, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process technical analysis request'
    }, { status: 500 });
  }
}

/**
 * POST /api/technical-analysis/signal
 * Obter sinal técnico com configuração personalizada
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, symbols, config = {} } = body;

    if (!symbol && !symbols) {
      logger.warn('API: Symbol or symbols parameter is required for POST technical analysis', 'API');
      return NextResponse.json({
        success: false,
        error: 'Symbol or symbols parameter is required'
      }, { status: 400 });
    }

    if (symbol) {
      // Análise de um símbolo
      const signal = await TechnicalAnalysisService.getTechnicalSignal(symbol, config);

      if (!signal) {
        logger.warn(`API: No technical signal found for ${symbol}`, 'API');
        return NextResponse.json({
          success: false,
          error: 'No technical signal found for this symbol'
        }, { status: 404 });
      }

      logger.info(`API: Technical signal retrieved for ${symbol} via POST`, 'API', {
        recommendation: signal.recommendation,
        confidence: signal.confidence
      });

      return NextResponse.json({
        success: true,
        data: signal
      });
    } else if (symbols) {
      // Análise de múltiplos símbolos
      const signals = await TechnicalAnalysisService.getMultipleTechnicalSignals(symbols, config);

      logger.info(`API: Multiple technical signals retrieved for ${symbols.length} symbols via POST`, 'API', {
        count: signals.size
      });

      return NextResponse.json({
        success: true,
        data: Object.fromEntries(signals)
      });
    }
  } catch (error) {
    logger.error('API: Error in POST technical analysis request', 'API', null, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process POST technical analysis request'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/technical-analysis/signal
 * Limpar cache de análise técnica
 */
export async function DELETE(request: NextRequest) {
  try {
    TechnicalAnalysisService.clearCache();
    logger.info('API: Technical analysis cache cleared', 'API');
    return NextResponse.json({
      success: true,
      message: 'Technical analysis cache cleared successfully'
    });
  } catch (error) {
    logger.error('API: Error clearing technical analysis cache', 'API', null, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to clear technical analysis cache'
    }, { status: 500 });
  }
}
