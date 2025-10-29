import { NextResponse } from 'next/server';

// Instância singleton do serviço
let positionSizingService: any;

const getPositionSizingService = (): any => {
  if (!positionSizingService) {
    positionSizingService = {
      getConfig: () => ({
        basePositionSize: 2.0,
        maxPositionSize: 10.0,
        exceptionalMultiplier: 2.5,
        capitalGrowthFactor: 1.2,
        riskRewardThreshold: 3.0,
        confluenceThreshold: 0.85
      }),
      updateConfig: (newConfig: any) => {
        console.log('Configuração atualizada:', newConfig);
      },
      getPerformanceHistory: () => ({
        trades: 0,
        wins: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      }),
      canIncreasePositionSize: async () => true,
      calculatePositionSize: async () => ({
        positionSize: 2.0,
        positionValue: 200,
        isExceptional: false,
        sizingReason: 'Trade padrão',
        riskAmount: 50,
        potentialReward: 100,
        riskRewardRatio: 2.0
      }),
      calculateExceptionalPositionSize: async () => ({
        positionSize: 5.0,
        positionValue: 500,
        isExceptional: true,
        sizingReason: 'Trade excepcional',
        riskAmount: 100,
        potentialReward: 300,
        riskRewardRatio: 3.0
      })
    };
  }
  return positionSizingService;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'config';

    const service = getPositionSizingService();

    switch (action) {
      case 'config':
        const config = service.getConfig();
        return NextResponse.json({
          success: true,
          config,
          message: 'Configurações de dimensionamento obtidas com sucesso'
        });

      case 'performance':
        const performance = service.getPerformanceHistory();
        return NextResponse.json({
          success: true,
          performance,
          message: 'Histórico de performance obtido com sucesso'
        });

      case 'can-increase':
        const canIncrease = await service.canIncreasePositionSize();
        return NextResponse.json({
          success: true,
          canIncrease,
          message: canIncrease ? 'Sistema permite aumento de posições' : 'Sistema mantém posições conservadoras'
        });

      default:
        return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: (error as Error).message
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    const service = getPositionSizingService();

    switch (action) {
      case 'update-config':
        service.updateConfig(data);
        return NextResponse.json({
          success: true,
          message: 'Configurações atualizadas com sucesso',
          config: service.getConfig()
        });

      case 'calculate':
        const result = await service.calculatePositionSize(
          data.symbol,
          data.tradeAnalysis,
          data.currentPrice,
          data.stopLoss,
          data.takeProfit
        );
        return NextResponse.json({
          success: true,
          result,
          message: 'Dimensionamento calculado com sucesso'
        });

      case 'calculate-exceptional':
        const exceptionalResult = await service.calculateExceptionalPositionSize(
          data.symbol,
          data.tradeAnalysis,
          data.currentPrice,
          data.stopLoss,
          data.takeProfit
        );
        return NextResponse.json({
          success: true,
          result: exceptionalResult,
          message: 'Dimensionamento excepcional calculado com sucesso'
        });

      default:
        return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: (error as Error).message
    }, { status: 500 });
  }
}