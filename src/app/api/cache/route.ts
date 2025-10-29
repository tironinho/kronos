import { NextRequest, NextResponse } from 'next/server';
import CacheService from '@/services/cache-service';
import RedisService from '@/services/redis-service';

const cacheService = CacheService.getInstance();
const redisService = RedisService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats':
        const stats = cacheService.getStats();
        const redisStats = await redisService.getCacheStats();
        
        return NextResponse.json({
          status: 'success',
          data: {
            cache: stats,
            redis: redisStats
          }
        });

      case 'get':
        const key = searchParams.get('key');
        if (!key) {
          return NextResponse.json({
            status: 'error',
            message: 'Key parameter is required'
          }, { status: 400 });
        }

        const data = await cacheService.get(key);
        return NextResponse.json({
          status: 'success',
          data: { key, data }
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Erro na API de cache:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, key, data, ttl } = body;

    switch (action) {
      case 'set':
        if (!key || data === undefined) {
          return NextResponse.json({
            status: 'error',
            message: 'Key and data are required'
          }, { status: 400 });
        }

        const success = await cacheService.set(key, data, ttl || 300);
        return NextResponse.json({
          status: success ? 'success' : 'error',
          message: success ? 'Data cached successfully' : 'Failed to cache data'
        });

      case 'delete':
        if (!key) {
          return NextResponse.json({
            status: 'error',
            message: 'Key is required'
          }, { status: 400 });
        }

        const deleted = await cacheService.delete(key);
        return NextResponse.json({
          status: deleted ? 'success' : 'error',
          message: deleted ? 'Key deleted successfully' : 'Key not found'
        });

      case 'clear':
        const cleared = await cacheService.clear();
        return NextResponse.json({
          status: cleared ? 'success' : 'error',
          message: cleared ? 'Cache cleared successfully' : 'Failed to clear cache'
        });

      case 'connect-redis':
        const connected = await redisService.connect();
        cacheService.setRedisService(redisService);
        
        return NextResponse.json({
          status: connected ? 'success' : 'error',
          message: connected ? 'Redis connected successfully' : 'Failed to connect to Redis'
        });

      case 'disconnect-redis':
        await redisService.disconnect();
        cacheService.setRedisService(null);
        
        return NextResponse.json({
          status: 'success',
          message: 'Redis disconnected successfully'
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Erro na API de cache:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({
        status: 'error',
        message: 'Key parameter is required'
      }, { status: 400 });
    }

    const deleted = await cacheService.delete(key);
    return NextResponse.json({
      status: deleted ? 'success' : 'error',
      message: deleted ? 'Key deleted successfully' : 'Key not found'
    });

  } catch (error: any) {
    console.error('Erro na API de cache:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}
