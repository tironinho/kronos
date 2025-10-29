import { NextRequest, NextResponse } from 'next/server';
import { activeMonitoringService } from '@/services/active-monitoring-service';
import { advancedStatisticsService } from '@/services/advanced-statistics-service';
import { intelligentAlertSystem } from '@/services/intelligent-alert-system';

/**
 * GET /api/monitoring/status
 * Obtém status do sistema de monitoramento
 */
export async function GET(request: NextRequest) {
  try {
    const monitoringStatus = activeMonitoringService.getMonitoringStatus();
    const alertStatus = intelligentAlertSystem.getStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        monitoring: monitoringStatus,
        alerts: alertStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting monitoring status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get monitoring status'
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/analyze
 * Força análise completa das estratégias
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { forceAnalysis = false } = body;

    if (forceAnalysis) {
      console.log('🔍 Forcing complete strategy analysis...');
      
      // Realizar análise completa
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
    }

    return NextResponse.json({
      success: true,
      message: 'Analysis triggered'
    });
  } catch (error) {
    console.error('❌ Error performing analysis:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform analysis'
    }, { status: 500 });
  }
}
