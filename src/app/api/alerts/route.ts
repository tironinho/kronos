import { NextRequest, NextResponse } from 'next/server';
import IntelligentAlertsService from '@/services/intelligent-alerts-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (action) {
      case 'list':
        const alerts = IntelligentAlertsService.getAlerts(limit);
        return NextResponse.json({
          success: true,
          data: alerts,
          count: alerts.length
        });

      case 'stats':
        const stats = IntelligentAlertsService.getAlertStats();
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'rules':
        const rules = IntelligentAlertsService.getRules();
        return NextResponse.json({
          success: true,
          data: rules
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação não reconhecida'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Erro na API de alertas:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'add-rule':
        const { rule } = body;
        IntelligentAlertsService.addRule(rule);
        return NextResponse.json({
          success: true,
          message: 'Regra adicionada com sucesso'
        });

      case 'update-rule':
        const { ruleId, updates } = body;
        IntelligentAlertsService.updateRule(ruleId, updates);
        return NextResponse.json({
          success: true,
          message: 'Regra atualizada com sucesso'
        });

      case 'delete-rule':
        const { ruleId: deleteRuleId } = body;
        IntelligentAlertsService.deleteRule(deleteRuleId);
        return NextResponse.json({
          success: true,
          message: 'Regra removida com sucesso'
        });

      case 'resolve-alert':
        const { alertId } = body;
        IntelligentAlertsService.resolveAlert(alertId);
        return NextResponse.json({
          success: true,
          message: 'Alerta resolvido com sucesso'
        });

      case 'start':
        IntelligentAlertsService.start();
        return NextResponse.json({
          success: true,
          message: 'Sistema de alertas iniciado'
        });

      case 'stop':
        IntelligentAlertsService.stop();
        return NextResponse.json({
          success: true,
          message: 'Sistema de alertas parado'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação não reconhecida'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Erro na API de alertas:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
