import { NextResponse } from 'next/server';
import { advancedTradingEngine } from '@/services/advanced-trading-engine';

export async function POST() {
  try {
    console.info('⏸️ Parando ADVANCED TRADING ENGINE...');
    
    // Para o Advanced Trading Engine
    advancedTradingEngine.stopTrading();
    
    console.log('✅ Advanced Trading parado - Nenhum trade será executado');

    return NextResponse.json({
      status: 'success',
      message: 'ADVANCED TRADING parado com sucesso. O sistema está em modo seguro.',
      data: {
        tradingEnabled: false,
        timestamp: Date.now()
      }
    });
  } catch (error: any) {
    console.error('Erro ao parar trading:', error);

    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao parar trading'
    }, { status: 500 });
  }
}

