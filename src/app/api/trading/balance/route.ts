import { NextResponse } from 'next/server';
import { getBinanceClient } from '@/services/binance-api';

export async function GET() {
  try {
    const binanceClient = getBinanceClient();
    
    // Buscar saldo Futures
    let futuresBalance = 0;
    let totalWalletBalance = 0;
    let initialBalance = 0; // TODO: Implementar tracking de saldo inicial
    
    try {
      const futuresInfo = await binanceClient.getFuturesAccountInfo();
      futuresBalance = parseFloat(futuresInfo.availableBalance || '0');
      totalWalletBalance = parseFloat(futuresInfo.totalWalletBalance || '0');
    } catch (e) {
      console.error('Erro ao buscar saldo Futures:', e);
    }
    
    // Calcular evolução (%)
    let evolution = 0;
    if (initialBalance > 0) {
      evolution = ((totalWalletBalance - initialBalance) / initialBalance) * 100;
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        availableBalance: futuresBalance,
        totalWalletBalance: totalWalletBalance,
        initialBalance: initialBalance,
        evolution: evolution,
        timestamp: Date.now()
      }
    });
  } catch (error: any) {
    console.error('Erro ao buscar saldo Futures:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao buscar saldo'
    }, { status: 500 });
  }
}

