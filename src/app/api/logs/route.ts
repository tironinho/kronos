import { NextRequest, NextResponse } from 'next/server';
import { getSystemLogger, getComponentLogger, SystemComponent, SystemAction, LogLevel } from '@/services/logging';

const logger = getSystemLogger();
const componentLogger = getComponentLogger(SystemComponent.TradingEngine);

/**
 * GET /api/logs
 * Obtém informações sobre os logs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const lines = parseInt(searchParams.get('lines') || '100');

    switch (action) {
      case 'stats':
        const stats = await logger.getLogStatistics();
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'read':
        const logLines = await logger.getRecentLogs(lines);
        return NextResponse.json({
          success: true,
          data: {
            lines: logLines,
            count: logLines.length
          }
        });

      case 'clear':
        await logger.clearOldLogs(0); // Limpar todos os logs
        await componentLogger.info(SystemAction.Configuration, 'Logs limpos via API');
        return NextResponse.json({
          success: true,
          message: 'Logs cleared successfully'
        });

      default:
        const logStats = await logger.getLogStatistics();
        return NextResponse.json({
          success: true,
          data: {
            stats: logStats,
            endpoints: {
              stats: '/api/logs?action=stats',
              read: '/api/logs?action=read&lines=100',
              clear: '/api/logs?action=clear'
            }
          }
        });
    }
  } catch (error) {
    console.error('❌ Error handling logs request:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to handle logs request'
    }, { status: 500 });
  }
}

/**
 * POST /api/logs
 * Escreve uma entrada de log personalizada
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { level, message, component, data } = body;

    if (!level || !message) {
      return NextResponse.json({
        success: false,
        error: 'Level and message are required'
      }, { status: 400 });
    }

    // Validar nível de log
    const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    if (!validLevels.includes(level)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid log level. Must be one of: DEBUG, INFO, WARN, ERROR, CRITICAL'
      }, { status: 400 });
    }

    // Escrever log usando o logger do sistema
    const systemLogger = getSystemLogger();
    
    // Converter string level para LogLevel enum
    const levelMap: Record<string, LogLevel> = {
      'DEBUG': LogLevel.DEBUG,
      'INFO': LogLevel.INFO,
      'WARN': LogLevel.WARN,
      'ERROR': LogLevel.ERROR,
      'CRITICAL': LogLevel.CRITICAL
    };
    
    const logLevel = levelMap[level] || LogLevel.INFO;
    
    const componentMap: Record<string, SystemComponent> = {
      'API': SystemComponent.TradingEngine,
      'default': SystemComponent.TradingEngine
    };
    const actionMap: Record<string, SystemAction> = {
      'API': SystemAction.DataProcessing,
      'default': SystemAction.DataProcessing
    };
    
    const comp = componentMap[component || 'default'] || SystemComponent.TradingEngine;
    const action = actionMap[component || 'default'] || SystemAction.DataProcessing;
    const success = level === 'DEBUG' || level === 'INFO';
    
    await systemLogger.addLog(logLevel, comp, action, message, data, success);

    return NextResponse.json({
      success: true,
      message: 'Log entry written successfully'
    });
  } catch (error) {
    console.error('❌ Error writing log entry:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to write log entry'
    }, { status: 500 });
  }
}
