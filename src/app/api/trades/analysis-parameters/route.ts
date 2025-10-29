import { NextRequest, NextResponse } from 'next/server';
import { tradeAnalysisCapture } from '@/services/trade-analysis-capture';

/**
 * GET /api/trades/analysis-parameters
 * Obtém parâmetros de análise de trades
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get('tradeId');
    const symbol = searchParams.get('symbol');
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        const stats = await tradeAnalysisCapture.getAnalysisStats();
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'trade':
        if (!tradeId) {
          return NextResponse.json({
            success: false,
            error: 'Trade ID is required for trade analysis'
          }, { status: 400 });
        }

        const analysis = await tradeAnalysisCapture.getAnalysisParameters(tradeId);
        if (!analysis) {
          return NextResponse.json({
            success: false,
            error: 'Analysis parameters not found for this trade'
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          data: analysis
        });

      default:
        return NextResponse.json({
          success: true,
          data: {
            endpoints: {
              stats: '/api/trades/analysis-parameters?action=stats',
              trade: '/api/trades/analysis-parameters?action=trade&tradeId=TRADE_ID'
            },
            description: 'API para consultar parâmetros de análise das trades'
          }
        });
    }
  } catch (error) {
    console.error('❌ Error handling analysis parameters request:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to handle analysis parameters request'
    }, { status: 500 });
  }
}

/**
 * POST /api/trades/analysis-parameters
 * Cria uma nova análise de parâmetros (para testes)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, tradeId, testData } = body;

    if (!symbol) {
      return NextResponse.json({
        success: false,
        error: 'Symbol is required'
      }, { status: 400 });
    }

    // Iniciar análise de teste
    const analysisId = tradeId || `TEST_${Date.now()}_${symbol}`;
    tradeAnalysisCapture.startAnalysis(symbol, analysisId);

    // Adicionar dados de teste se fornecidos
    if (testData) {
      if (testData.technical) {
        tradeAnalysisCapture.captureTechnicalAnalysis(testData.technical);
      }
      if (testData.predictiveV2) {
        tradeAnalysisCapture.capturePredictiveV2(testData.predictiveV2);
      }
      if (testData.hft) {
        tradeAnalysisCapture.captureHFT(testData.hft);
      }
      if (testData.risk) {
        tradeAnalysisCapture.captureRisk(testData.risk);
      }
      if (testData.market) {
        tradeAnalysisCapture.captureMarket(testData.market);
      }
      if (testData.decision) {
        tradeAnalysisCapture.captureDecision(testData.decision);
      }
    }

    // Finalizar análise
    const saved = await tradeAnalysisCapture.finishAnalysis();

    return NextResponse.json({
      success: saved,
      data: {
        analysisId,
        symbol,
        saved,
        message: saved ? 'Analysis parameters saved successfully' : 'Failed to save analysis parameters'
      }
    });
  } catch (error) {
    console.error('❌ Error creating analysis parameters:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create analysis parameters'
    }, { status: 500 });
  }
}
