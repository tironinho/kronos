import { NextRequest, NextResponse } from 'next/server';
import AuditLoggingService from '@/services/audit-logging-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'logs';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    switch (action) {
      case 'logs':
        const level = searchParams.get('level')?.split(',');
        const component = searchParams.get('component')?.split(',');
        const actionFilter = searchParams.get('action')?.split(',');
        const userId = searchParams.get('userId');
        const sessionId = searchParams.get('sessionId');
        const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
        const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

        const logs = AuditLoggingService.getLogs({
          level,
          component,
          action: actionFilter,
          userId: userId || undefined,
          sessionId: sessionId || undefined,
          startDate,
          endDate,
          limit,
          offset
        });

        return NextResponse.json({
          success: true,
          data: logs,
          count: logs.length
        });

      case 'audit-events':
        const auditUserId = searchParams.get('userId');
        const auditSessionId = searchParams.get('sessionId');
        const auditAction = searchParams.get('action')?.split(',');
        const resource = searchParams.get('resource')?.split(',');
        const success = searchParams.get('success') ? searchParams.get('success') === 'true' : undefined;
        const auditStartDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
        const auditEndDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

        const auditEvents = AuditLoggingService.getAuditEvents({
          userId: auditUserId || undefined,
          sessionId: auditSessionId || undefined,
          action: auditAction,
          resource,
          success,
          startDate: auditStartDate,
          endDate: auditEndDate,
          limit,
          offset
        });

        return NextResponse.json({
          success: true,
          data: auditEvents,
          count: auditEvents.length
        });

      case 'log-stats':
        const logStats = AuditLoggingService.getLogStats();
        return NextResponse.json({
          success: true,
          data: logStats
        });

      case 'audit-stats':
        const auditStats = AuditLoggingService.getAuditStats();
        return NextResponse.json({
          success: true,
          data: auditStats
        });

      case 'export-logs':
        const format = searchParams.get('format') as 'json' | 'csv' || 'json';
        const exportedLogs = AuditLoggingService.exportLogs(format);
        
        return new NextResponse(exportedLogs, {
          headers: {
            'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
            'Content-Disposition': `attachment; filename="logs_${new Date().toISOString().split('T')[0]}.${format}"`
          }
        });

      case 'export-audit':
        const auditFormat = searchParams.get('format') as 'json' | 'csv' || 'json';
        const exportedAudit = AuditLoggingService.exportAuditEvents(auditFormat);
        
        return new NextResponse(exportedAudit, {
          headers: {
            'Content-Type': auditFormat === 'csv' ? 'text/csv' : 'application/json',
            'Content-Disposition': `attachment; filename="audit_${new Date().toISOString().split('T')[0]}.${auditFormat}"`
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação não reconhecida'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Erro na API de auditoria:', error);
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
      case 'log':
        const {
          component,
          action: logAction,
          message,
          level = 'info',
          metadata = {},
          userId,
          sessionId,
          ipAddress,
          userAgent
        } = body;

        const logEntry = AuditLoggingService.log(
          component,
          logAction,
          message,
          level,
          metadata,
          userId,
          sessionId,
          ipAddress,
          userAgent
        );

        return NextResponse.json({
          success: true,
          data: logEntry
        });

      case 'audit':
        const {
          userId: auditUserId,
          sessionId: auditSessionId,
          action: auditAction,
          resource,
          resourceId,
          oldValue,
          newValue,
          success = true,
          errorMessage,
          metadata: auditMetadata = {},
          ipAddress: auditIpAddress,
          userAgent: auditUserAgent
        } = body;

        const auditEvent = AuditLoggingService.audit(
          auditUserId,
          auditSessionId,
          auditAction,
          resource,
          resourceId,
          oldValue,
          newValue,
          success,
          errorMessage,
          auditMetadata,
          auditIpAddress,
          auditUserAgent
        );

        return NextResponse.json({
          success: true,
          data: auditEvent
        });

      case 'log-trading':
        const {
          action: tradingAction,
          symbol,
          side,
          quantity,
          price,
          success: tradingSuccess,
          errorMessage: tradingError,
          userId: tradingUserId,
          sessionId: tradingSessionId
        } = body;

        AuditLoggingService.logTradingAction(
          tradingAction,
          symbol,
          side,
          quantity,
          price,
          tradingSuccess,
          tradingError,
          tradingUserId,
          tradingSessionId
        );

        return NextResponse.json({
          success: true,
          message: 'Ação de trading registrada'
        });

      case 'log-risk':
        const {
          action: riskAction,
          riskLevel,
          details: riskDetails,
          userId: riskUserId,
          sessionId: riskSessionId
        } = body;

        AuditLoggingService.logRiskAction(
          riskAction,
          riskLevel,
          riskDetails,
          riskUserId,
          riskSessionId
        );

        return NextResponse.json({
          success: true,
          message: 'Ação de risco registrada'
        });

      case 'log-api':
        const {
          service,
          endpoint,
          method,
          statusCode,
          responseTime,
          error: apiError
        } = body;

        AuditLoggingService.logApiCall(
          service,
          endpoint,
          method,
          statusCode,
          responseTime,
          apiError
        );

        return NextResponse.json({
          success: true,
          message: 'Chamada de API registrada'
        });

      case 'log-system':
        const {
          component: systemComponent,
          event,
          details: systemDetails,
          level: systemLevel = 'info'
        } = body;

        AuditLoggingService.logSystemEvent(
          systemComponent,
          event,
          systemDetails,
          systemLevel
        );

        return NextResponse.json({
          success: true,
          message: 'Evento do sistema registrado'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação não reconhecida'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Erro na API de auditoria:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
