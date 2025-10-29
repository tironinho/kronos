import { NextResponse } from 'next/server';
import { advancedTradingEngine } from '@/services/advanced-trading-engine';
import { getBinanceClient } from '@/services/binance-api';

export async function POST(request: Request) {
  try {
    let initialCapital = 100; // Capital padrão
    let mode: 'spot' | 'futures' = 'spot';
    let leverage: number | undefined;
    
    // Tenta ler body de forma segura
    try {
      const bodyText = await request.text();
      if (bodyText) {
        const body = JSON.parse(bodyText);
        initialCapital = body.initialCapital || 100;
        if (body.mode === 'futures') mode = 'futures';
        if (typeof body.leverage === 'number') leverage = body.leverage;
      }
    } catch (e) {
      // Body vazio ou inválido, usa valor padrão
      console.log('Body vazio ou inválido, usando valor padrão: $100');
    }
    
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('⚠️⚠️⚠️  ADVANCED TRADING ENGINE ATIVADO  ⚠️⚠️⚠️');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧠 Sistema de IA com 8 análises simultâneas');
    console.log('📊 Technical, Sentiment, On-Chain, Derivatives');
    console.log('📊 Macro, Smart Money, Predictive, HFT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const binanceClient = getBinanceClient();
    let realBalance = 0;

    // Sempre ler ambos saldos para fallback inteligente
    const spotInfo = await binanceClient.getAccountInfo();
    const spotUsdt = spotInfo.balances?.find((b: any) => b.asset === 'USDT');
    const spotBalance = spotUsdt ? parseFloat(spotUsdt.free) : 0;
    let futuresBalance = 0;
    try {
      const futuresInfo = await binanceClient.getFuturesAccountInfo();
      futuresBalance = parseFloat(futuresInfo.availableBalance || futuresInfo.totalWalletBalance || '0');
    } catch (e) {
      console.warn('⚠️ Não foi possível obter saldo Futures (chave sem permissão ou API off):', e);
    }

    console.log(`💰 Saldos → Spot: $${spotBalance.toFixed(2)} | Futures: $${futuresBalance.toFixed(2)}`);

    // Auto-fallback: se usuário pediu spot, mas não tem saldo e há saldo em futures → usar futures
    if (mode !== 'futures' && spotBalance < 0.5 && futuresBalance >= 0.5) {
      console.log('↪️ Spot sem saldo suficiente. Alternando automaticamente para FUTURES.');
      mode = 'futures';
    }

    if (mode === 'futures') {
      realBalance = futuresBalance;
      if (realBalance < 0.5) {
        return NextResponse.json({
          status: 'error',
          message: 'Saldo insuficiente na Binance Futures. Mínimo $0.50 USDT necessário.',
          data: { availableBalance: realBalance, minimumRequired: 0.50 }
        }, { status: 400 });
      }
      await advancedTradingEngine.startTradingFutures(leverage || 5);
    } else {
      realBalance = spotBalance;
      if (realBalance < 0.5) {
        return NextResponse.json({
          status: 'error',
          message: 'Saldo insuficiente na Binance Spot. Mínimo $0.50 USDT necessário.',
          data: { availableBalance: realBalance, minimumRequired: 0.50 }
        }, { status: 400 });
      }
      await advancedTradingEngine.startTrading(realBalance);
    }
    
    console.log('✅ Advanced Trading iniciado com IA!');

    return NextResponse.json({
      status: 'success',
      message: 'ADVANCED TRADING ATIVADO! Sistema de IA executando trades reais.',
      data: {
        tradingEnabled: true,
        initialCapital: realBalance,
        system: 'ADVANCED_TRADING_ENGINE',
        mode,
        features: [
          'Technical Analysis (RSI, MACD, Bollinger, EMAs)',
          'Sentiment Analysis (Twitter, Reddit, Fear & Greed)',
          'On-Chain Analysis (Exchange flow, Active addresses, MVRV)',
          'Derivatives Analysis (Funding rates, Open Interest, Long/Short ratio)',
          'Macro Analysis (Fed policy, DXY, SP500 correlation)',
          'Smart Money Detection (Whale tracking, Order book imbalance)',
          'Predictive AI (Score -12 a +12)',
          'HFT Execution (Order slicing, Smart routing)'
        ],
        strategy: {
          symbols: ['ETHUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT'],
          allocation: {
            ETHUSDT: '40%',
            ADAUSDT: '30%',
            XRPUSDT: '20%',
            SOLUSDT: '10%'
          },
          minConfidence: '70%',
          adaptive: true
        },
        warnings: [
          '⚠️ ATENÇÃO: Trades serão executados com DINHEIRO REAL',
          '🧠 Sistema usa IA com 8 análises simultâneas',
          '📊 Decisões baseadas em score preditivo -12 a +12',
          '🎯 Apenas trades com confiança >= 70% serão executados',
          '⚡ Kill Switch disponível a qualquer momento',
          '📈 Trades serão salvos na tabela real_trades'
        ],
        realBalance: realBalance,
        timestamp: Date.now()
      }
    });
  } catch (error: any) {
    console.error('Erro ao iniciar trading:', error);
    console.error('Stack trace:', error.stack);

    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro ao iniciar trading',
      error: error.toString()
    }, { status: 500 });
  }
}

