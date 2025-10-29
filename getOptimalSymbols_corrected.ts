  /**
   * ✅ CORREÇÃO CRÍTICA: Seleciona símbolos ótimos com sistema consistente
   * Problema: Aprovava internamente mas depois bloqueava por HOLD no agregador final
   */
  private async getOptimalSymbols(availableBalance: number): Promise<any[]> {
    // ✅ CORREÇÃO: Símbolos com minNotional mais baixo para capital pequeno
    const allSymbols = ['DOGEUSDT', 'ENAUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 'ETHUSDT', 'BTCUSDT', 'BNBUSDT'];
    
    logTrading(`🔍 Analisando oportunidades em ${allSymbols.length} símbolos...`);
    logTrading(`💰 Capital disponível: $${availableBalance.toFixed(2)}`);

    try {
      // ✅ CORREÇÃO: Usar sistema de decisão consistente
      const scoringDataMap = new Map<string, any>();
      
      // Coletar dados de scoring para todos os símbolos
      for (const symbol of allSymbols) {
        try {
          logTrading(`📊 Coletando dados de scoring para ${symbol}...`);
          
          // ✅ CORREÇÃO: Usar análise V2 com tratamento neutro
          const predictiveV2 = await predictiveAnalyzerV2.consolidate(symbol);
          
          // ✅ CORREÇÃO: Mapear dados para o novo sistema
          scoringDataMap.set(symbol, {
            technical: predictiveV2.technicalScore,
            sentiment: predictiveV2.sentimentScore,
            onchain: predictiveV2.onchainScore,
            derivatives: predictiveV2.derivativesScore,
            macro: predictiveV2.macroScore,
            smartMoney: predictiveV2.smartMoneyScore,
            coingecko: predictiveV2.fundamentalScore,
            fearGreed: null, // Será tratado como neutro
            news: predictiveV2.newsScore
          });
          
          logTrading(`✅ ${symbol}: Dados coletados`, {
            technical: predictiveV2.technicalScore,
            sentiment: predictiveV2.sentimentScore,
            onchain: predictiveV2.onchainScore,
            derivatives: predictiveV2.derivativesScore,
            weightedScore: predictiveV2.weightedScore,
            confidence: predictiveV2.confidence
          });
        } catch (error) {
          logger.error(`❌ Erro ao coletar dados para ${symbol}:`, 'TRADING', null, error);
          // Continuar com outros símbolos
        }
      }

      // ✅ CORREÇÃO: Usar sistema de decisão consistente
      const opportunities = await ConsistentDecisionEngine.getOptimalSymbols(
        allSymbols,
        scoringDataMap,
        availableBalance,
        {
          minConfidence: 40,
          strongBuyThreshold: 2.5,
          buyThreshold: 1.0,
          sellThreshold: -1.0,
          strongSellThreshold: -2.5,
          maxTrades: 2,
          maxMarginPerTrade: 0.8,
          leverage: 2
        }
      );

      // ✅ CORREÇÃO: Converter para formato compatível
      const compatibleOpportunities = opportunities.map(opp => ({
        symbol: opp.symbol,
        score: opp.scoring.weightedScore,
        confidence: opp.confidence,
        decision: {
          action: opp.action,
          confidence: opp.confidence,
          size: opp.sizing.qty || 0,
          entry: opp.sizing.entryPrice || 0,
          stopLoss: 0, // Será calculado depois
          takeProfit: 0, // Será calculado depois
          timeInForce: 'GTC',
          explanation: `${opp.action} - Confiança: ${opp.confidence}%`
        },
        tradeSize: opp.sizing.requiredMargin || 0,
        currentPrice: opp.sizing.entryPrice || 0,
        estimatedMinCost: opp.sizing.notionalUsd || 0,
        minNotional: opp.sizing.meta?.minNotional || 0,
        stepSize: opp.sizing.meta?.stepSize || 0.01,
        minQty: opp.sizing.meta?.minQty || 0.1,
        sizing: opp.sizing,
        scoring: opp.scoring
      }));

      logTrading(`🎯 Oportunidades encontradas: ${compatibleOpportunities.length}/${allSymbols.length}`, {
        opportunities: compatibleOpportunities.map(opp => ({
          symbol: opp.symbol,
          action: opp.decision.action,
          confidence: opp.confidence,
          notional: opp.estimatedMinCost.toFixed(2)
        }))
      });

      return compatibleOpportunities;
    } catch (error) {
      logger.error('❌ Erro ao buscar oportunidades:', 'TRADING', null, error);
      return [];
    }
  }
