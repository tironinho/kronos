import { NextResponse } from 'next/server';
import { aiReplyAnalyzer } from '@/services/analyzers/ai-replay-analyzer';
import { supabase } from '@/services/supabase-db';

/**
 * API para análise retrospectiva de trades fechadas com IA
 * NÃO interfere na abertura de trades
 * Apenas análise e feedback pós-execução
 */
export async function POST(request: Request) {
  try {
    const { tradeId } = await request.json();
    
    if (!tradeId) {
      return NextResponse.json({
        status: 'error',
        message: 'tradeId é obrigatório'
      }, { status: 400 });
    }

    // Buscar trade fechada
    const { data: trade, error } = await supabase
      .from('real_trades')
      .select('*')
      .eq('trade_id', tradeId)
      .eq('status', 'closed')
      .single();

    if (error || !trade) {
      return NextResponse.json({
        status: 'error',
        message: 'Trade não encontrada ou ainda aberta'
      }, { status: 404 });
    }

    // Buscar indicadores históricos (se salvos)
    // TODO: Implementar busca de indicadores salvos
    
    // Analisar com IA
    const analysis = await aiReplyAnalyzer.analyzeTrade(
      {
        tradeId: trade.trade_id,
        symbol: trade.symbol,
        side: trade.side as 'BUY' | 'SELL',
        entryPrice: trade.entry_price,
        exitPrice: trade.current_price || trade.entry_price,
        quantity: trade.quantity,
        pnl: trade.pnl || 0,
        pnlPercent: trade.pnl_percent || 0,
        entryTime: trade.opened_at,
        exitTime: trade.closed_at || '',
        algorithm: trade.algorithm || 'unknown',
        confidence: trade.confidence || 0
      },
      {}, // Indicadores na entrada (TODO)
      {}  // Indicadores na saída (TODO)
    );

    if (!analysis) {
      return NextResponse.json({
        status: 'error',
        message: 'Erro ao analisar trade com IA'
      }, { status: 500 });
    }

    // Salvar análise no banco
    const { error: saveError } = await supabase
      .from('trade_ai_analysis')
      .insert({
        trade_id: tradeId,
        score: analysis.score,
        verdict: analysis.verdict,
        reasoning: analysis.reasoning,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        improvements: analysis.improvements,
        analyzed_at: new Date().toISOString()
      });

    if (saveError) {
      console.warn('⚠️ Não foi possível salvar análise no banco:', saveError);
    }

    return NextResponse.json({
      status: 'success',
      data: analysis
    });

  } catch (error: any) {
    console.error('Erro ao analisar trade:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * GET: Busca análises de IA para trades fechadas
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const { data: analyses, error } = await supabase
      .from('trade_ai_analysis')
      .select('*')
      .order('analyzed_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({
        status: 'error',
        message: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      data: analyses
    });

  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
}

