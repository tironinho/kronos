import { NextRequest, NextResponse } from 'next/server';
import { activeMonitoringService } from '@/services/active-monitoring-service';
import { advancedStatisticsService } from '@/services/advanced-statistics-service';
import { intelligentAlertSystem } from '@/services/intelligent-alert-system';

/**
 * GET /api/monitoring/alerts
 * Obtém alertas ativos
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');

    let alerts;
    if (severity) {
      alerts = intelligentAlertSystem.getAlertsBySeverity(severity);
    } else {
      alerts = intelligentAlertSystem.getActiveAlerts();
    }

    if (type) {
      alerts = alerts.filter(alert => alert.type === type);
    }

    const statistics = intelligentAlertSystem.getAlertStatistics();

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        statistics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting alerts:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get alerts'
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/alerts/acknowledge
 * Reconhece um alerta
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json({
        success: false,
        error: 'Alert ID is required'
      }, { status: 400 });
    }

    intelligentAlertSystem.acknowledgeAlert(alertId);

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledged'
    });
  } catch (error) {
    console.error('❌ Error acknowledging alert:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to acknowledge alert'
    }, { status: 500 });
  }
}

/**
 * PUT /api/monitoring/alerts/resolve
 * Resolve um alerta
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json({
        success: false,
        error: 'Alert ID is required'
      }, { status: 400 });
    }

    intelligentAlertSystem.resolveAlert(alertId);

    return NextResponse.json({
      success: true,
      message: 'Alert resolved'
    });
  } catch (error) {
    console.error('❌ Error resolving alert:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to resolve alert'
    }, { status: 500 });
  }
}
