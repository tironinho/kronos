import { NextResponse } from 'next/server';
import { getBinanceClient } from '@/services/binance-api';

export async function GET() {
  try {
    const binanceClient = getBinanceClient();
    
    // Obter saldo Spot
    let spotBalance = 0;
    let spotInfo = null;
    let spotBalances = [];
    let canTradeSpot = false;
    let canWithdrawSpot = false;
    let canDepositSpot = false;
    
    try {
      spotInfo = await binanceClient.getAccountInfo();
      const usdtBalance = spotInfo.balances?.find((b: any) => b.asset === 'USDT');
      spotBalance = usdtBalance ? parseFloat(usdtBalance.free) : 0;
      
      // Converter balances para formato esperado
      spotBalances = spotInfo.balances?.map((b: any) => ({
        asset: b.asset,
        total: parseFloat(b.free) + parseFloat(b.locked),
        free: parseFloat(b.free),
        locked: parseFloat(b.locked)
      })) || [];
      
      // Verificar permissões Spot
      canTradeSpot = spotInfo.accountType === 'SPOT' && spotBalance > 0;
      canWithdrawSpot = true; // Assumir que pode sacar se tem saldo
      canDepositSpot = true; // Assumir que pode depositar
    } catch (error) {
      console.warn('⚠️ Erro ao obter saldo Spot:', error);
    }

    // Obter saldo Futures
    let futuresBalance = 0;
    let futuresInfo = null;
    let canTradeFutures = false;
    let canWithdrawFutures = false;
    let canDepositFutures = false;
    
    try {
      futuresInfo = await binanceClient.getFuturesAccountInfo();
      futuresBalance = parseFloat(futuresInfo.totalWalletBalance || futuresInfo.availableBalance || '0');
      
      // Verificar permissões Futures
      canTradeFutures = futuresBalance > 0;
      canWithdrawFutures = futuresBalance > 0;
      canDepositFutures = true; // Assumir que pode depositar
    } catch (error) {
      console.warn('⚠️ Erro ao obter saldo Futures:', error);
    }

    // Determinar status geral
    const totalBalance = spotBalance + futuresBalance;
    const canTrade = canTradeSpot || canTradeFutures;
    const canWithdraw = canWithdrawSpot || canWithdrawFutures;
    const canDeposit = canDepositSpot || canDepositFutures;

    return NextResponse.json({
      status: 'success',
      data: {
        balances: spotBalances,
        totalBalance: totalBalance,
        accountType: 'SPOT_FUTURES',
        canTrade: canTrade,
        canWithdraw: canWithdraw,
        canDeposit: canDeposit,
        updateTime: Date.now(),
        spot: {
          balance: spotBalance,
          currency: 'USDT',
          available: spotBalance,
          canTrade: canTradeSpot,
          canWithdraw: canWithdrawSpot,
          canDeposit: canDepositSpot
        },
        futures: {
          balance: futuresBalance,
          currency: 'USDT',
          available: futuresBalance,
          canTrade: canTradeFutures,
          canWithdraw: canWithdrawFutures,
          canDeposit: canDepositFutures
        },
        total: totalBalance,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Erro ao obter saldo da Binance:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Erro ao conectar com a Binance',
      error: error.message || 'Erro desconhecido'
    }, { status: 500 });
  }
}
