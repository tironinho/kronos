// ============================================================================
// AI REPLAY ANALYZER - Análise Retrospectiva com OpenAI
// ============================================================================

interface TradeAnalysis {
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  entryTime: string;
  exitTime: string;
  algorithm: string;
  confidence: number;
}

interface IndicatorData {
  rsi?: number;
  macd?: number;
  bollinger?: any;
  trend?: string;
  momentum?: number;
  sentiment?: number;
  fundingRate?: number;
  volume?: number;
}

interface AIAnalysisResult {
  score: number; // 0-100
  verdict: 'correct' | 'incorrect' | 'questionable';
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  similarPastTrades: number;
}

export class AIReplyAnalyzer {
  private apiKey: string;
  private assistantId: string = 'Backes Trader V2';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ OPENAI_API_KEY não configurada. Análise com IA desabilitada.');
    }
  }

  /**
   * Analisa uma trade fechada usando IA
   * NÃO interfere na abertura de trades
   * Apenas análise retrospectiva
   */
  async analyzeTrade(
    trade: TradeAnalysis,
    indicatorsAtEntry: IndicatorData,
    indicatorsAtExit: IndicatorData
  ): Promise<AIAnalysisResult | null> {
    if (!this.apiKey) {
      console.warn('⚠️ OpenAI não disponível, pulando análise de IA');
      return null;
    }

    try {
      const prompt = this.buildAnalysisPrompt(trade, indicatorsAtEntry, indicatorsAtExit);
      
      // Chamar OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Você é Backes Trader V2, um analista de trading especializado em avaliar trades de criptomoedas. 
              
Sua função é analisar trades EXECUTADAS e fornecer feedback construtivo.
NUNCA sugira abrir trades, apenas ANALISE trades já executadas.

Analise:
- Se a decisão foi correta baseada nos indicadores
- Pontos fortes e fracos da trade
- Oportunidades de melhoria para o sistema
- Contexto de mercado naquele momento`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Erro na API OpenAI:', error as Error);
        return null;
      }

      const data = await response.json();
      const aiText = data.choices[0]?.message?.content || '';

      // Parse da resposta da IA
      return this.parseAIResponse(aiText, trade);
    } catch (error: any) {
      console.error('❌ Erro ao analisar trade com IA:', error.message);
      return null;
    }
  }

  /**
   * Constrói prompt de análise
   */
  private buildAnalysisPrompt(
    trade: TradeAnalysis,
    entryIndicators: IndicatorData,
    exitIndicators: IndicatorData
  ): string {
    return `
ANÁLISE DE TRADE REALIZADA

═══════════════════════════════════════════════
📊 DADOS DA TRADE
═══════════════════════════════════════════════

Symbol: ${trade.symbol}
Side: ${trade.side}
Entry: $${trade.entryPrice.toFixed(4)} (${trade.entryTime})
Exit: $${trade.exitPrice.toFixed(4)} (${trade.exitTime})
Quantity: ${trade.quantity}
P&L: $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)
Algorithm: ${trade.algorithm}
Confidence: ${trade.confidence}%

═══════════════════════════════════════════════
📈 INDICADORES NA ENTRADA
═══════════════════════════════════════════════

RSI: ${entryIndicators.rsi?.toFixed(2) || 'N/A'}
MACD: ${entryIndicators.macd?.toFixed(2) || 'N/A'}
Trend: ${entryIndicators.trend || 'N/A'}
Momentum: ${entryIndicators.momentum?.toFixed(2) || 'N/A'}
Sentiment: ${entryIndicators.sentiment?.toFixed(2) || 'N/A'}
Funding Rate: ${entryIndicators.fundingRate?.toFixed(4) || 'N/A'}
Volume: ${entryIndicators.volume?.toFixed(2) || 'N/A'}

═══════════════════════════════════════════════
📉 INDICADORES NA SAÍDA
═══════════════════════════════════════════════

RSI: ${exitIndicators.rsi?.toFixed(2) || 'N/A'}
MACD: ${exitIndicators.macd?.toFixed(2) || 'N/A'}
Trend: ${exitIndicators.trend || 'N/A'}
Momentum: ${exitIndicators.momentum?.toFixed(2) || 'N/A'}
Sentiment: ${exitIndicators.sentiment?.toFixed(2) || 'N/A'}
Funding Rate: ${exitIndicators.fundingRate?.toFixed(4) || 'N/A'}

═══════════════════════════════════════════════
🎯 SEU ANALISE (objetiva e construtiva)
═══════════════════════════════════════════════

Responda em JSON apenas:

{
  "score": 85,
  "verdict": "correct",
  "reasoning": "Trade bem executada. RSI indicava oversold e MACD convergente. Stop loss funcionou corretamente.",
  "strengths": [
    "RSI oversold bem identificado",
    "Stop loss respeitado",
    "Entrada em momento oportuno"
  ],
  "weaknesses": [
    "Take profit muito próximo",
    "Não considerou volume abaixo da média"
  ],
  "improvements": [
    "Aumentar take profit para 3%",
    "Verificar volume antes de entrar"
  ]
}

IMPORTANTE: NUNCA sugira abrir novas trades, apenas analise esta trade executada.
`;
  }

  /**
   * Parse da resposta da IA para estrutura
   */
  private parseAIResponse(aiText: string, trade: TradeAnalysis): AIAnalysisResult {
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        return {
          score: json.score || 50,
          verdict: json.verdict || 'questionable',
          reasoning: json.reasoning || 'Análise não disponível',
          strengths: json.strengths || [],
          weaknesses: json.weaknesses || [],
          improvements: json.improvements || [],
          similarPastTrades: 0 // TODO: Implementar busca no banco
        };
      }
    } catch (error) {
      console.error('❌ Erro ao parsear resposta da IA:', error as Error);
    }

    // Fallback
    return {
      score: 50,
      verdict: 'questionable',
      reasoning: aiText.substring(0, 200),
      strengths: [],
      weaknesses: [],
      improvements: [],
      similarPastTrades: 0
    };
  }

  /**
   * Analisa múltiplas trades fechadas (batch analysis)
   */
  async analyzeBatchTrades(trades: TradeAnalysis[]): Promise<AIAnalysisResult[]> {
    const results: AIAnalysisResult[] = [];
    
    for (const trade of trades) {
      // Buscar indicadores do banco (implementar busca)
      const entryIndicators: IndicatorData = {}; // TODO
      const exitIndicators: IndicatorData = {}; // TODO
      
      const analysis = await this.analyzeTrade(trade, entryIndicators, exitIndicators);
      if (analysis) {
        results.push(analysis);
      }
      
      // Rate limit: esperar 1s entre requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Gera resumo de performance com recomendações
   */
  async generatePerformanceReport(trades: TradeAnalysis[]): Promise<string> {
    if (!this.apiKey) {
      return 'OpenAI não configurado';
    }

    const prompt = `
ANÁLISE DE PERFORMANCE GERAL

Trades analisadas: ${trades.length}
Total P&L: ${trades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)} USDT
Taxa de acerto: ${(trades.filter(t => t.pnl > 0).length / trades.length * 100).toFixed(1)}%

Forneça um resumo executivo com:
1. Tendências identificadas
2. Pontos fortes do sistema
3. Áreas de melhoria
4. Recomendações de ajuste

Mantenha resposta objetiva e focada em melhorias.
`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Você é Backes Trader V2, analista de trading.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 800
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || 'Análise não disponível';
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error as Error);
    }

    return 'Erro ao gerar relatório de performance';
  }
}

export const aiReplyAnalyzer = new AIReplyAnalyzer();

