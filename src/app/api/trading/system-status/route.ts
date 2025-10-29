import { NextResponse } from 'next/server';
import { advancedTradingEngine } from '@/services/advanced-trading-engine';

export async function GET() {
  try {
    const systemStatus = advancedTradingEngine.getSystemStatus();
    
    return NextResponse.json({
      status: 'success',
      data: systemStatus
    });
  } catch (error: any) {
    console.error('Erro ao obter status do sistema:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao obter status do sistema'
    }, { status: 500 });
  }
}
