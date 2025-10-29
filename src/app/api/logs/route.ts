import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/services/logger';

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
        const stats = logger.getLogStats();
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'read':
        const logLines = logger.readLogs(lines);
        return NextResponse.json({
          success: true,
          data: {
            lines: logLines,
            count: logLines.length
          }
        });

      case 'clear':
        logger.clearLogs();
        return NextResponse.json({
          success: true,
          message: 'Logs cleared successfully'
        });

      default:
        const logStats = logger.getLogStats();
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

    // Escrever log
    switch (level) {
      case 'DEBUG':
        logger.debug(message, component, data);
        break;
      case 'INFO':
        logger.info(message, component, data);
        break;
      case 'WARN':
        logger.warn(message, component, data);
        break;
      case 'ERROR':
        logger.error(message, component, data);
        break;
      case 'CRITICAL':
        logger.critical(message, component, data);
        break;
    }

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
