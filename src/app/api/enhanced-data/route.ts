import { NextResponse } from 'next/server';
import EnhancedDataCollector from '@/services/enhanced-data-collector';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const action = searchParams.get('action') || 'complete';
    const symbols = searchParams.get('symbols')?.split(',') || [symbol];

    const collector = EnhancedDataCollector.getInstance();

    switch (action) {
      case 'complete':
        const completeData = await collector.collectCompleteData(symbol);
        return NextResponse.json({
          status: 'success',
          data: completeData
        });

      case 'binance-futures':
        const binanceData = await collector.collectBinanceFuturesData(symbol);
        return NextResponse.json({
          status: 'success',
          data: binanceData
        });

      case 'market-sentiment':
        const sentimentData = await collector.collectMarketSentimentData();
        return NextResponse.json({
          status: 'success',
          data: sentimentData
        });

      case 'multiple-symbols':
        const multipleData = await collector.collectMultipleSymbols(symbols);
        return NextResponse.json({
          status: 'success',
          data: Object.fromEntries(multipleData)
        });

      case 'funding-rate':
        const fundingData = await collector.collectBinanceFuturesData(symbol);
        return NextResponse.json({
          status: 'success',
          data: {
            symbol,
            fundingRate: fundingData.fundingRate,
            timestamp: new Date().toISOString()
          }
        });

      case 'open-interest':
        const oiData = await collector.collectBinanceFuturesData(symbol);
        return NextResponse.json({
          status: 'success',
          data: {
            symbol,
            openInterest: oiData.openInterest,
            timestamp: new Date().toISOString()
          }
        });

      case 'long-short-ratio':
        const lsData = await collector.collectBinanceFuturesData(symbol);
        return NextResponse.json({
          status: 'success',
          data: {
            symbol,
            longShortRatio: lsData.longShortRatio,
            tradeFlow: lsData.tradeFlow,
            timestamp: new Date().toISOString()
          }
        });

      case 'liquidations':
        const liqData = await collector.collectBinanceFuturesData(symbol);
        return NextResponse.json({
          status: 'success',
          data: {
            symbol,
            liquidations24h: liqData.liquidations24h,
            timestamp: new Date().toISOString()
          }
        });

      case 'fear-greed':
        const fgData = await collector.collectMarketSentimentData();
        return NextResponse.json({
          status: 'success',
          data: {
            fearGreedIndex: fgData.fearGreedIndex,
            timestamp: new Date().toISOString()
          }
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Ação não reconhecida'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Erro na API de dados enriquecidos:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, symbols } = body;

    const collector = EnhancedDataCollector.getInstance();

    switch (action) {
      case 'collect-all':
        if (!symbols || !Array.isArray(symbols)) {
          return NextResponse.json({
            status: 'error',
            message: 'Lista de símbolos é obrigatória'
          }, { status: 400 });
        }

        const allData = await collector.collectMultipleSymbols(symbols);
        return NextResponse.json({
          status: 'success',
          data: Object.fromEntries(allData),
          count: allData.size
        });

      case 'batch-update':
        // Implementar atualização em lote para o banco de dados
        const symbolsToUpdate = symbols || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];
        const batchData = await collector.collectMultipleSymbols(symbolsToUpdate);
        
        // TODO: Salvar no banco de dados
        console.log('Dados coletados para atualização em lote:', batchData.size);
        
        return NextResponse.json({
          status: 'success',
          message: `Dados coletados para ${batchData.size} símbolos`,
          data: Object.fromEntries(batchData)
        });

      default:
        return NextResponse.json({
          status: 'error',
          message: 'Ação não reconhecida'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Erro na API POST de dados enriquecidos:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}
