// ============================================================================
// API ROUTE: /api/logs - SISTEMA DE LOGS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSystemLogger } from '@/services/logging';
import { getComponentLogger, SystemComponent, SystemAction } from '@/services/logging';

const logger = getComponentLogger(SystemComponent.TradingEngine);

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const systemLogger = getSystemLogger();
    
    // Rota: /api/logs
    if (pathSegments.length === 2) {
      const logsJson = await systemLogger.getLogsJson();
      const logs = JSON.parse(logsJson);
      
      await logger.info(
        SystemAction.DataProcessing,
        'Logs solicitados via API',
        { endpoint: '/api/logs', logs_count: logs.length }
      );

      return NextResponse.json({
        status: 'success',
        logs: logs,
        count: logs.length
      });
    }
    
    // Rota: /api/logs/recent
    if (pathSegments[2] === 'recent') {
      const count = parseInt(url.searchParams.get('count') || '100');
      const logs = await systemLogger.getRecentLogs(count);
      
      await logger.info(
        SystemAction.DataProcessing,
        'Logs recentes solicitados via API',
        { endpoint: '/api/logs/recent', count }
      );

      return NextResponse.json({
        status: 'success',
        logs: logs,
        count: logs.length
      });
    }
    
    // Rota: /api/logs/errors
    if (pathSegments[2] === 'errors') {
      const errorLogs = await systemLogger.getErrorLogs();
      
      await logger.info(
        SystemAction.DataProcessing,
        'Logs de erro solicitados via API',
        { endpoint: '/api/logs/errors', error_count: errorLogs.length }
      );

      return NextResponse.json({
        status: 'success',
        error_logs: errorLogs,
        count: errorLogs.length
      });
    }
    
    // Rota: /api/logs/component
    if (pathSegments[2] === 'component') {
      const component = url.searchParams.get('component') || '';
      const logs = await systemLogger.getLogsByComponent(component);
      
      await logger.info(
        SystemAction.DataProcessing,
        'Logs por componente solicitados via API',
        { endpoint: '/api/logs/component', component, logs_count: logs.length }
      );

      return NextResponse.json({
        status: 'success',
        component: component,
        logs: logs,
        count: logs.length
      });
    }
    
    // Rota: /api/logs/statistics
    if (pathSegments[2] === 'statistics') {
      const stats = await systemLogger.getLogStatistics();
      
      await logger.info(
        SystemAction.DataProcessing,
        'Estatísticas de logs solicitadas via API',
        { endpoint: '/api/logs/statistics' }
      );

      return NextResponse.json({
        status: 'success',
        statistics: stats
      });
    }
    
    // Rota não encontrada
    return NextResponse.json(
      {
        status: 'error',
        error: 'Rota não encontrada',
        message: `Endpoint ${url.pathname} não existe`
      },
      { status: 404 }
    );
    
  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro na API de logs',
      error as Error,
      { endpoint: url.pathname }
    );

    return NextResponse.json(
      {
        status: 'error',
        error: 'Erro interno do servidor',
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const systemLogger = getSystemLogger();
    
    // Rota: /api/logs/export
    if (pathSegments[2] === 'export') {
      const body = await request.json();
      const filename = body.filename;
      
      const exportPath = await systemLogger.exportLogs(filename);
      
      await logger.info(
        SystemAction.DataProcessing,
        'Logs exportados via API',
        { endpoint: '/api/logs/export', export_path: exportPath }
      );

      return NextResponse.json({
        status: 'success',
        message: 'Logs exportados com sucesso',
        export_path: exportPath
      });
    }
    
    // Rota: /api/logs/clear
    if (pathSegments[2] === 'clear') {
      const body = await request.json();
      const olderThanMs = body.older_than_ms || (24 * 60 * 60 * 1000); // 24 horas por padrão
      
      await systemLogger.clearOldLogs(olderThanMs);
      
      await logger.info(
        SystemAction.DataProcessing,
        'Logs antigos limpos via API',
        { endpoint: '/api/logs/clear', older_than_ms: olderThanMs }
      );

      return NextResponse.json({
        status: 'success',
        message: 'Logs antigos limpos com sucesso'
      });
    }
    
    // Rota não encontrada
    return NextResponse.json(
      {
        status: 'error',
        error: 'Rota não encontrada',
        message: `Endpoint ${url.pathname} não existe`
      },
      { status: 404 }
    );
    
  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro na API de logs (POST)',
      error as Error,
      { endpoint: url.pathname }
    );

    return NextResponse.json(
      {
        status: 'error',
        error: 'Erro interno do servidor',
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}
