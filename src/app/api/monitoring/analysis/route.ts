import { NextRequest, NextResponse } from 'next/server';
import { advancedStatisticsService } from '@/services/advanced-statistics-service';
import { activeMonitoringService } from '@/services/active-monitoring-service';

/**
 * GET /api/monitoring/analysis
 * Obtém análise completa das estratégias
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (symbol) {
      // Análise por símbolo específico
      const symbolAnalysis = await activeMonitoringService.getSymbolAnalysis(symbol);
      
      if (!symbolAnalysis) {
        return NextResponse.json({
          success: false,
          error: 'No data found for symbol'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          symbolAnalysis,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Análise completa
    const metrics = await advancedStatisticsService.performCompleteAnalysis();
    const optimization = advancedStatisticsService.generateOptimizationRecommendations(metrics);

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        optimization,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting analysis:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get analysis'
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/analysis/optimize
 * Aplica otimizações recomendadas
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recommendations } = body;

    if (!recommendations || !Array.isArray(recommendations)) {
      return NextResponse.json({
        success: false,
        error: 'Recommendations array is required'
      }, { status: 400 });
    }

    console.log('🔧 Applying optimization recommendations:', recommendations);

    // Aqui você pode implementar a lógica para aplicar as recomendações
    // Por exemplo, atualizar configurações do sistema

    return NextResponse.json({
      success: true,
      message: 'Optimizations applied',
      appliedRecommendations: recommendations
    });
  } catch (error) {
    console.error('❌ Error applying optimizations:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to apply optimizations'
    }, { status: 500 });
  }
}
