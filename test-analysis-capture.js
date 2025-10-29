#!/usr/bin/env node

/**
 * Script para testar o sistema de captura de parâmetros de análise
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testAnalysisCapture() {
  console.log('🧪 Testando Sistema de Captura de Parâmetros de Análise...');

  // Inicializar Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Credenciais do Supabase não encontradas');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Criar dados de teste
    const testTradeId = `TEST_${Date.now()}_BTCUSDT`;
    const testSymbol = 'BTCUSDT';
    
    console.log(`📊 Criando análise de teste para ${testSymbol}...`);
    console.log(`   Trade ID: ${testTradeId}`);

    // Dados de teste realistas
    const testAnalysisData = {
      trade_id: testTradeId,
      symbol: testSymbol,
      analysis_timestamp: new Date().toISOString(),
      
      // Parâmetros técnicos
      technical_rsi: 65.5,
      technical_macd_signal: 0.0025,
      technical_macd_histogram: 0.0012,
      technical_bollinger_upper: 67500,
      technical_bollinger_middle: 67000,
      technical_bollinger_lower: 66500,
      technical_volume_ratio: 1.8,
      technical_price_change_24h: 2.5,
      technical_support_level: 66000,
      technical_resistance_level: 68000,
      
      // Parâmetros preditivos V2
      predictive_v2_signal: 'STRONG_BUY',
      predictive_v2_confidence: 75.5,
      predictive_v2_weighted_score: 2.3,
      predictive_v2_technical_score: 2.1,
      predictive_v2_sentiment_score: 1.8,
      predictive_v2_onchain_score: 2.5,
      predictive_v2_derivatives_score: 2.0,
      predictive_v2_macro_score: 1.9,
      predictive_v2_smart_money_score: 2.4,
      predictive_v2_news_score: 1.7,
      predictive_v2_fundamental_score: 2.2,
      
      // Parâmetros HFT
      hft_vwap: 67150,
      hft_mean_reversion_signal: 'BUY',
      hft_confirmations_count: 3,
      hft_confirmations_score: 3.2,
      hft_volume_analysis: 'Volume OK: 1.8x média',
      hft_atr: 850,
      hft_position_size: 125.50,
      hft_volatility_adjustment: 0.8,
      hft_atr_adjustment: 1.0,
      
      // Parâmetros de risco
      risk_stop_loss: 65975,
      risk_take_profit: 69030,
      risk_position_size: 125.50,
      risk_leverage: 5,
      risk_margin_required: 125.50,
      risk_max_loss: 187.50,
      risk_reward_ratio: 2.0,
      
      // Parâmetros de mercado
      market_current_price: 67000,
      market_24h_high: 67500,
      market_24h_low: 66000,
      market_24h_volume: 1250000000,
      market_funding_rate: 0.0001,
      market_open_interest: 8500000000,
      
      // Parâmetros de decisão
      decision_action: 'BUY',
      decision_confidence: 75.5,
      decision_reason: 'Múltiplas confirmações técnicas e sentimentais positivas. Leverage: 5x (day)',
      decision_algorithm: 'AdvancedTradingEngineV2',
      decision_multiple_confirmations: true,
      decision_volume_confirmed: true,
      decision_risk_acceptable: true,
      
      // Dados estruturados
      technical_indicators: {
        rsi: 65.5,
        macd: { signal: 0.0025, histogram: 0.0012 },
        bollinger: { upper: 67500, middle: 67000, lower: 66500 },
        volume: { ratio: 1.8, avg24h: 1250000000 }
      },
      sentiment_data: {
        fear_greed_index: 45,
        social_sentiment: 'positive',
        news_sentiment: 0.7
      },
      onchain_metrics: {
        whale_movements: 'positive',
        exchange_flows: 'negative',
        active_addresses: 850000
      },
      
      // Metadados
      analysis_duration_ms: 1250,
      api_calls_count: 8,
      errors_encountered: [],
      warnings_generated: ['Volume slightly below average']
    };

    // Inserir dados de teste
    const { data, error } = await supabase
      .from('trade_analysis_parameters')
      .insert(testAnalysisData);

    if (error) {
      console.error('❌ Erro ao inserir dados de teste:', error);
      return;
    }

    console.log('✅ Dados de análise inseridos com sucesso!');

    // Verificar se foi inserido corretamente
    const { data: insertedData, error: fetchError } = await supabase
      .from('trade_analysis_parameters')
      .select('*')
      .eq('trade_id', testTradeId)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao verificar dados inseridos:', fetchError);
      return;
    }

    console.log('\n📊 Dados inseridos verificados:');
    console.log(`   Trade ID: ${insertedData.trade_id}`);
    console.log(`   Símbolo: ${insertedData.symbol}`);
    console.log(`   Sinal: ${insertedData.predictive_v2_signal}`);
    console.log(`   Confiança: ${insertedData.predictive_v2_confidence}%`);
    console.log(`   Score Ponderado: ${insertedData.predictive_v2_weighted_score}`);
    console.log(`   Ação: ${insertedData.decision_action}`);
    console.log(`   Leverage: ${insertedData.risk_leverage}x`);
    console.log(`   Position Size: $${insertedData.risk_position_size}`);
    console.log(`   Stop Loss: $${insertedData.risk_stop_loss}`);
    console.log(`   Take Profit: $${insertedData.risk_take_profit}`);
    console.log(`   Duração da Análise: ${insertedData.analysis_duration_ms}ms`);
    console.log(`   Chamadas de API: ${insertedData.api_calls_count}`);

    // Testar consulta por trade ID
    console.log('\n🔍 Testando consulta por Trade ID...');
    const { data: queryData, error: queryError } = await supabase
      .from('trade_analysis_parameters')
      .select('*')
      .eq('trade_id', testTradeId);

    if (queryError) {
      console.error('❌ Erro na consulta:', queryError);
    } else {
      console.log(`✅ Consulta bem-sucedida: ${queryData.length} registro(s) encontrado(s)`);
    }

    // Testar estatísticas
    console.log('\n📈 Testando estatísticas...');
    const { data: statsData, error: statsError } = await supabase
      .from('trade_analysis_parameters')
      .select('symbol, predictive_v2_confidence, decision_action, analysis_duration_ms, api_calls_count');

    if (statsError) {
      console.error('❌ Erro ao obter estatísticas:', statsError);
    } else {
      const totalAnalyses = statsData.length;
      const avgConfidence = statsData.reduce((sum, item) => sum + (item.predictive_v2_confidence || 0), 0) / totalAnalyses;
      const avgDuration = statsData.reduce((sum, item) => sum + (item.analysis_duration_ms || 0), 0) / totalAnalyses;
      const avgApiCalls = statsData.reduce((sum, item) => sum + (item.api_calls_count || 0), 0) / totalAnalyses;
      
      console.log(`📊 Estatísticas:`);
      console.log(`   Total de análises: ${totalAnalyses}`);
      console.log(`   Confiança média: ${avgConfidence.toFixed(2)}%`);
      console.log(`   Duração média: ${avgDuration.toFixed(0)}ms`);
      console.log(`   Chamadas de API médias: ${avgApiCalls.toFixed(1)}`);
    }

    console.log('\n🎉 Teste do sistema de captura de parâmetros concluído com sucesso!');
    console.log('📝 Todos os parâmetros de análise das trades serão salvos automaticamente.');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testAnalysisCapture()
  .then(() => {
    console.log('\n✅ Teste finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
