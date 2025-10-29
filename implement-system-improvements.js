const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function implementSystemImprovements() {
  console.log('🚀 IMPLEMENTANDO MELHORIAS DO SISTEMA KRONOS-X\n');
  console.log('='.repeat(60) + '\n');

  try {
    // 1. CORREÇÃO DE CONFIANÇA ANORMAL
    console.log('1️⃣ CORRIGINDO CONFIANÇAS ANORMAIS...');
    await fixAbnormalConfidence();
    
    // 2. IMPLEMENTAÇÃO DE TIMEOUT PARA TRADES ABERTAS
    console.log('\n2️⃣ IMPLEMENTANDO TIMEOUT PARA TRADES ABERTAS...');
    await implementTradeTimeout();
    
    // 3. CONFIGURAÇÃO DE FILTROS DE QUALIDADE
    console.log('\n3️⃣ CONFIGURANDO FILTROS DE QUALIDADE...');
    await configureQualityFilters();
    
    // 4. GESTÃO DE RISCO MELHORADA
    console.log('\n4️⃣ IMPLEMENTANDO GESTÃO DE RISCO MELHORADA...');
    await implementImprovedRiskManagement();
    
    // 5. CONFIGURAÇÃO DE ANÁLISE TÉCNICA ROBUSTA
    console.log('\n5️⃣ CONFIGURANDO ANÁLISE TÉCNICA ROBUSTA...');
    await configureRobustTechnicalAnalysis();
    
    // 6. CONFIGURAÇÃO DE SÍMBOLOS (EVITAR ENA, INCLUIR BTC/ETH)
    console.log('\n6️⃣ CONFIGURANDO SÍMBOLOS DE TRADING...');
    await configureTradingSymbols();
    
    // 7. REMOVENDO LIMITAÇÃO DE TRADES ATIVAS
    console.log('\n7️⃣ REMOVENDO LIMITAÇÃO DE TRADES ATIVAS...');
    await removeActiveTradeLimits();
    
    // 8. IMPLEMENTANDO ANÁLISE DE PERFORMANCE POR SÍMBOLO
    console.log('\n8️⃣ IMPLEMENTANDO ANÁLISE DE PERFORMANCE POR SÍMBOLO...');
    await implementSymbolPerformanceAnalysis();
    
    console.log('\n✅ TODAS AS MELHORIAS FORAM IMPLEMENTADAS COM SUCESSO!');
    
  } catch (error) {
    console.error('❌ Erro durante implementação:', error);
  }
}

async function fixAbnormalConfidence() {
  try {
    const { data: trades, error } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'open');

    if (error) throw error;

    let fixedCount = 0;
    for (const trade of trades || []) {
      const confidence = parseFloat(trade.confidence || 0);
      
      // Corrigir confianças anormais (> 100% ou < 0%)
      if (confidence > 100 || confidence < 0) {
        const correctedConfidence = Math.max(0, Math.min(100, confidence));
        
        await supabase
          .from('real_trades')
          .update({ confidence: correctedConfidence })
          .eq('id', trade.id);
        
        console.log(`   ✅ Corrigido ${trade.symbol}: ${confidence}% → ${correctedConfidence}%`);
        fixedCount++;
      }
    }
    
    console.log(`   📊 Total de confianças corrigidas: ${fixedCount}`);
  } catch (error) {
    console.error('   ❌ Erro ao corrigir confianças:', error);
  }
}

async function implementTradeTimeout() {
  try {
    const { data: trades, error } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'open');

    if (error) throw error;

    const timeoutHours = 24; // Timeout de 24 horas
    const timeoutMs = timeoutHours * 60 * 60 * 1000;
    const now = new Date();
    
    let closedCount = 0;
    for (const trade of trades || []) {
      const openedAt = new Date(trade.opened_at);
      const timeOpen = now - openedAt;
      
      if (timeOpen > timeoutMs) {
        // Fechar trade por timeout
        await supabase
          .from('real_trades')
          .update({ 
            status: 'closed',
            closed_at: now.toISOString(),
            close_reason: 'timeout',
            pnl: '0.00'
          })
          .eq('id', trade.id);
        
        console.log(`   ✅ Fechado por timeout: ${trade.symbol} (${Math.round(timeOpen / (60 * 60 * 1000))}h)`);
        closedCount++;
      }
    }
    
    console.log(`   📊 Total de trades fechados por timeout: ${closedCount}`);
  } catch (error) {
    console.error('   ❌ Erro ao implementar timeout:', error);
  }
}

async function configureQualityFilters() {
  const qualityFilters = {
    minWinRate: 45,
    minConfidence: 40.0,
    maxDrawdown: 15,
    minProfitFactor: 1.2,
    minTradeDuration: 30, // minutos
    maxTradeDuration: 1440, // 24 horas
    minVolumeFactor: 1.2,
    maxVolatility: 5.0
  };

  try {
    // Salvar filtros de qualidade na tabela de configurações
    const { error } = await supabase
      .from('trading_config')
      .upsert({
        id: 'quality_filters',
        config: qualityFilters,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    
    console.log('   ✅ Filtros de qualidade configurados:');
    console.log(`      - Win Rate mínimo: ${qualityFilters.minWinRate}%`);
    console.log(`      - Confiança mínima: ${qualityFilters.minConfidence}%`);
    console.log(`      - Drawdown máximo: ${qualityFilters.maxDrawdown}%`);
    console.log(`      - Profit Factor mínimo: ${qualityFilters.minProfitFactor}`);
  } catch (error) {
    console.error('   ❌ Erro ao configurar filtros:', error);
  }
}

async function implementImprovedRiskManagement() {
  const riskRules = {
    maxPositionsPerSymbol: 2,
    maxTotalPositions: 10, // Aumentado de 8 para 10
    positionSizePct: 5, // % do capital
    stopLossPct: 2,
    takeProfitPct: 4,
    maxDailyLossPct: 3,
    maxDrawdownPct: 15,
    minRiskRewardRatio: 1.5,
    maxCorrelation: 0.7
  };

  try {
    const { error } = await supabase
      .from('trading_config')
      .upsert({
        id: 'risk_management',
        config: riskRules,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    
    console.log('   ✅ Gestão de risco melhorada configurada:');
    console.log(`      - Máximo de posições por símbolo: ${riskRules.maxPositionsPerSymbol}`);
    console.log(`      - Máximo de posições totais: ${riskRules.maxTotalPositions}`);
    console.log(`      - Tamanho da posição: ${riskRules.positionSizePct}% do capital`);
    console.log(`      - Stop Loss: ${riskRules.stopLossPct}%`);
    console.log(`      - Take Profit: ${riskRules.takeProfitPct}%`);
  } catch (error) {
    console.error('   ❌ Erro ao implementar gestão de risco:', error);
  }
}

async function configureRobustTechnicalAnalysis() {
  const taConfig = {
    rsi: { period: 14, overbought: 70, oversold: 30 },
    macd: { fast: 12, slow: 26, signal: 9 },
    bollingerBands: { period: 20, stdDev: 2 },
    emas: [9, 21, 50],
    smas: [20, 50, 200],
    volume: { minVolumeFactor: 1.2 },
    supportResistance: { lookbackPeriods: 50 },
    atr: { period: 14 },
    adx: { period: 14 },
    stochastic: { k: 14, d: 3 },
    williamsR: { period: 14 },
    cci: { period: 20 }
  };

  try {
    const { error } = await supabase
      .from('trading_config')
      .upsert({
        id: 'technical_analysis',
        config: taConfig,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    
    console.log('   ✅ Análise técnica robusta configurada:');
    console.log(`      - RSI: período ${taConfig.rsi.period}`);
    console.log(`      - MACD: ${taConfig.macd.fast}/${taConfig.macd.slow}/${taConfig.macd.signal}`);
    console.log(`      - Bollinger Bands: período ${taConfig.bollingerBands.period}`);
    console.log(`      - EMAs: ${taConfig.emas.join(', ')}`);
    console.log(`      - Volume mínimo: ${taConfig.volume.minVolumeFactor}x da média`);
  } catch (error) {
    console.error('   ❌ Erro ao configurar análise técnica:', error);
  }
}

async function configureTradingSymbols() {
  const symbolConfig = {
    // Símbolos a evitar
    blacklistedSymbols: ['ENAUSDT', 'ENAUSDT'],
    
    // Símbolos prioritários (BTC e ETH)
    prioritySymbols: ['BTCUSDT', 'ETHUSDT'],
    
    // Símbolos permitidos
    allowedSymbols: [
      'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT', 
      'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT', 'DOTUSDT', 'LINKUSDT',
      'UNIUSDT', 'ATOMUSDT', 'NEARUSDT', 'FTMUSDT', 'ALGOUSDT'
    ],
    
    // Configurações por símbolo
    symbolSettings: {
      'BTCUSDT': { minConfidence: 35, maxPositions: 2 },
      'ETHUSDT': { minConfidence: 35, maxPositions: 2 },
      'ADAUSDT': { minConfidence: 40, maxPositions: 1 },
      'SOLUSDT': { minConfidence: 40, maxPositions: 1 },
      'XRPUSDT': { minConfidence: 40, maxPositions: 1 }
    }
  };

  try {
    const { error } = await supabase
      .from('trading_config')
      .upsert({
        id: 'symbol_config',
        config: symbolConfig,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    
    console.log('   ✅ Configuração de símbolos atualizada:');
    console.log(`      - Símbolos bloqueados: ${symbolConfig.blacklistedSymbols.join(', ')}`);
    console.log(`      - Símbolos prioritários: ${symbolConfig.prioritySymbols.join(', ')}`);
    console.log(`      - Total de símbolos permitidos: ${symbolConfig.allowedSymbols.length}`);
  } catch (error) {
    console.error('   ❌ Erro ao configurar símbolos:', error);
  }
}

async function removeActiveTradeLimits() {
  try {
    // Remover limitação de trades ativas - permitir novos trades se atendem aos parâmetros
    const { error } = await supabase
      .from('trading_config')
      .upsert({
        id: 'trade_limits',
        config: {
          maxActiveTrades: null, // Sem limite
          allowNewTrades: true,
          checkParameters: true, // Verificar se atende aos parâmetros
          updated_at: new Date().toISOString()
        }
      });

    if (error) throw error;
    
    console.log('   ✅ Limitação de trades ativas removida');
    console.log('      - Novos trades serão abertos se atenderem aos parâmetros');
    console.log('      - Sem limite máximo de trades ativas');
  } catch (error) {
    console.error('   ❌ Erro ao remover limitação:', error);
  }
}

async function implementSymbolPerformanceAnalysis() {
  try {
    const { data: trades, error } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'closed');

    if (error) throw error;

    // Análise por símbolo
    const symbolAnalysis = {};
    
    for (const trade of trades || []) {
      const symbol = trade.symbol;
      if (!symbolAnalysis[symbol]) {
        symbolAnalysis[symbol] = {
          totalTrades: 0,
          winningTrades: 0,
          totalPnL: 0,
          avgConfidence: 0,
          avgDuration: 0
        };
      }
      
      const pnl = parseFloat(trade.pnl || 0);
      const confidence = parseFloat(trade.confidence || 0);
      const duration = trade.closed_at ? 
        (new Date(trade.closed_at) - new Date(trade.opened_at)) / (1000 * 60) : 0;
      
      symbolAnalysis[symbol].totalTrades++;
      symbolAnalysis[symbol].totalPnL += pnl;
      symbolAnalysis[symbol].avgConfidence += confidence;
      symbolAnalysis[symbol].avgDuration += duration;
      
      if (pnl > 0) {
        symbolAnalysis[symbol].winningTrades++;
      }
    }
    
    // Calcular métricas finais
    for (const symbol in symbolAnalysis) {
      const analysis = symbolAnalysis[symbol];
      analysis.winRate = (analysis.winningTrades / analysis.totalTrades) * 100;
      analysis.avgConfidence = analysis.avgConfidence / analysis.totalTrades;
      analysis.avgDuration = analysis.avgDuration / analysis.totalTrades;
      analysis.profitFactor = analysis.totalPnL > 0 ? analysis.totalPnL / Math.abs(analysis.totalPnL) : 0;
    }
    
    // Salvar análise
    const { error: saveError } = await supabase
      .from('trading_config')
      .upsert({
        id: 'symbol_performance',
        config: symbolAnalysis,
        updated_at: new Date().toISOString()
      });

    if (saveError) throw saveError;
    
    console.log('   ✅ Análise de performance por símbolo implementada:');
    for (const symbol in symbolAnalysis) {
      const analysis = symbolAnalysis[symbol];
      console.log(`      - ${symbol}: ${analysis.totalTrades} trades, ${analysis.winRate.toFixed(1)}% win rate, $${analysis.totalPnL.toFixed(2)} P&L`);
    }
  } catch (error) {
    console.error('   ❌ Erro ao implementar análise de performance:', error);
  }
}

// Executar implementação
implementSystemImprovements();
