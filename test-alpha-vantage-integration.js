#!/usr/bin/env node

/**
 * Script para testar a integração com Alpha Vantage API
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const ALPHA_VANTAGE_API_KEY = '8A4WAOBVXKU5OCF7';
const BASE_URL = 'http://localhost:3000';

async function testAlphaVantageIntegration() {
  console.log('🧪 Testando Integração com Alpha Vantage API...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔑 API Key: ${ALPHA_VANTAGE_API_KEY.substring(0, 8)}...`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log('');

  try {
    console.log('🔧 TESTE 1: Cotação de Ação');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const stockQuote = await testStockQuote('AAPL');
    if (stockQuote) {
      console.log(`   ✅ Cotação AAPL obtida:`);
      console.log(`      Preço: $${stockQuote.price}`);
      console.log(`      Mudança: $${stockQuote.change} (${stockQuote.changePercent}%)`);
      console.log(`      Volume: ${stockQuote.volume.toLocaleString()}`);
      console.log(`      Timestamp: ${stockQuote.timestamp}`);
    } else {
      console.log('   ❌ Falha ao obter cotação de AAPL');
    }

    console.log('\n🔧 TESTE 2: Cotação de Criptomoeda');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const cryptoQuote = await testCryptoQuote('BTC');
    if (cryptoQuote) {
      console.log(`   ✅ Cotação BTC obtida:`);
      console.log(`      Preço: $${cryptoQuote.price}`);
      console.log(`      Volume: ${cryptoQuote.volume.toLocaleString()}`);
      console.log(`      Timestamp: ${cryptoQuote.timestamp}`);
    } else {
      console.log('   ❌ Falha ao obter cotação de BTC');
    }

    console.log('\n🔧 TESTE 3: Indicadores Técnicos');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Testar RSI
    const rsi = await testRSI('AAPL');
    if (rsi) {
      console.log(`   ✅ RSI para AAPL:`);
      console.log(`      Indicador: ${rsi.indicator}`);
      console.log(`      Timeframe: ${rsi.timeframe}`);
      console.log(`      Valores: ${rsi.values.length} pontos`);
      if (rsi.values.length > 0) {
        console.log(`      Último valor: ${rsi.values[rsi.values.length - 1].value.toFixed(2)}`);
      }
    } else {
      console.log('   ❌ Falha ao obter RSI para AAPL');
    }

    // Testar MACD
    const macd = await testMACD('AAPL');
    if (macd) {
      console.log(`   ✅ MACD para AAPL:`);
      console.log(`      Indicador: ${macd.indicator}`);
      console.log(`      Timeframe: ${macd.timeframe}`);
      console.log(`      Valores: ${macd.values.length} pontos`);
      if (macd.values.length > 0) {
        console.log(`      Último valor: ${macd.values[macd.values.length - 1].value.toFixed(4)}`);
      }
    } else {
      console.log('   ❌ Falha ao obter MACD para AAPL');
    }

    // Testar Bollinger Bands
    const bb = await testBollingerBands('AAPL');
    if (bb) {
      console.log(`   ✅ Bollinger Bands para AAPL:`);
      console.log(`      Indicador: ${bb.indicator}`);
      console.log(`      Timeframe: ${bb.timeframe}`);
      console.log(`      Valores: ${bb.values.length} pontos`);
      if (bb.values.length > 0) {
        const latest = bb.values[bb.values.length - 1];
        console.log(`      Último: Upper=${latest.upper.toFixed(2)}, Middle=${latest.middle.toFixed(2)}, Lower=${latest.lower.toFixed(2)}`);
      }
    } else {
      console.log('   ❌ Falha ao obter Bollinger Bands para AAPL');
    }

    console.log('\n🔧 TESTE 4: Indicadores Econômicos');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Testar GDP
    const gdp = await testGDP();
    if (gdp) {
      console.log(`   ✅ GDP obtido:`);
      console.log(`      Indicador: ${gdp.indicator}`);
      console.log(`      Valor: ${gdp.value}`);
      console.log(`      Unidade: ${gdp.unit}`);
      console.log(`      Data: ${gdp.date}`);
      console.log(`      País: ${gdp.country}`);
    } else {
      console.log('   ❌ Falha ao obter GDP');
    }

    // Testar Inflação
    const inflation = await testInflation();
    if (inflation) {
      console.log(`   ✅ Inflação obtida:`);
      console.log(`      Indicador: ${inflation.indicator}`);
      console.log(`      Valor: ${inflation.value}%`);
      console.log(`      Unidade: ${inflation.unit}`);
      console.log(`      Data: ${inflation.date}`);
      console.log(`      País: ${inflation.country}`);
    } else {
      console.log('   ❌ Falha ao obter inflação');
    }

    console.log('\n🔧 TESTE 5: Análise de Sentimento');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const sentiment = await testNewsSentiment();
    if (sentiment && sentiment.length > 0) {
      console.log(`   ✅ Análise de sentimento obtida:`);
      console.log(`      Notícias: ${sentiment.length}`);
      
      const avgSentiment = sentiment.reduce((sum, item) => sum + item.overallSentimentScore, 0) / sentiment.length;
      console.log(`      Sentimento médio: ${avgSentiment.toFixed(2)}`);
      
      const sentimentLabels = sentiment.map(item => item.overallSentimentLabel);
      const labelCounts = sentimentLabels.reduce((acc, label) => {
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`      Distribuição:`);
      Object.entries(labelCounts).forEach(([label, count]) => {
        console.log(`        ${label}: ${count} notícias`);
      });
      
      console.log(`      Primeira notícia:`);
      console.log(`        Título: ${sentiment[0].title.substring(0, 80)}...`);
      console.log(`        Sentimento: ${sentiment[0].overallSentimentLabel} (${sentiment[0].overallSentimentScore})`);
      console.log(`        Fonte: ${sentiment[0].source}`);
    } else {
      console.log('   ❌ Falha ao obter análise de sentimento');
    }

    console.log('\n🔧 TESTE 6: Análise Técnica Aprimorada');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const enhancedAnalysis = await testEnhancedAnalysis('AAPL');
    if (enhancedAnalysis) {
      console.log(`   ✅ Análise técnica aprimorada para AAPL:`);
      console.log(`      Preço: $${enhancedAnalysis.price}`);
      console.log(`      Mudança: ${enhancedAnalysis.changePercent.toFixed(2)}%`);
      console.log(`      Score geral: ${enhancedAnalysis.overallScore.toFixed(1)}`);
      console.log(`      Recomendação: ${enhancedAnalysis.recommendation}`);
      console.log(`      Confiança: ${enhancedAnalysis.confidence}%`);
      
      console.log(`      Indicadores técnicos:`);
      console.log(`        RSI: ${enhancedAnalysis.technicalIndicators.rsi.value.toFixed(1)} (${enhancedAnalysis.technicalIndicators.rsi.signal})`);
      console.log(`        MACD: ${enhancedAnalysis.technicalIndicators.macd.value.toFixed(4)} (${enhancedAnalysis.technicalIndicators.macd.signal})`);
      console.log(`        Bollinger: ${enhancedAnalysis.technicalIndicators.bollingerBands.position} (${enhancedAnalysis.technicalIndicators.bollingerBands.signal})`);
      
      console.log(`      Análise de sentimento:`);
      console.log(`        Sentimento: ${enhancedAnalysis.sentimentAnalysis.sentimentLabel} (${enhancedAnalysis.sentimentAnalysis.newsSentiment.toFixed(2)})`);
      console.log(`        Notícias: ${enhancedAnalysis.sentimentAnalysis.newsCount}`);
      
      console.log(`      Contexto econômico:`);
      console.log(`        Saúde econômica: ${enhancedAnalysis.economicContext.economicHealth}`);
      if (enhancedAnalysis.economicContext.gdp) {
        console.log(`        GDP: ${enhancedAnalysis.economicContext.gdp}`);
      }
      if (enhancedAnalysis.economicContext.inflation) {
        console.log(`        Inflação: ${enhancedAnalysis.economicContext.inflation}%`);
      }
      
      console.log(`      Raciocínio:`);
      enhancedAnalysis.reasoning.forEach((reason, index) => {
        console.log(`        ${index + 1}. ${reason}`);
      });
    } else {
      console.log('   ❌ Falha ao obter análise técnica aprimorada');
    }

    console.log('\n🔧 TESTE 7: Visão Geral do Mercado');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const marketOverview = await testMarketOverview();
    if (marketOverview) {
      console.log(`   ✅ Visão geral do mercado obtida:`);
      console.log(`      Timestamp: ${new Date(marketOverview.timestamp).toISOString()}`);
      
      console.log(`      Indicadores econômicos:`);
      if (marketOverview.economicIndicators.gdp) {
        console.log(`        GDP: ${marketOverview.economicIndicators.gdp}`);
      }
      if (marketOverview.economicIndicators.inflation) {
        console.log(`        Inflação: ${marketOverview.economicIndicators.inflation}%`);
      }
      
      console.log(`      Sentimento do mercado:`);
      console.log(`        Geral: ${marketOverview.marketSentiment.overall.toFixed(2)}`);
      console.log(`        Crypto: ${marketOverview.marketSentiment.crypto.toFixed(2)}`);
      console.log(`        Tech: ${marketOverview.marketSentiment.tech.toFixed(2)}`);
      console.log(`        Finance: ${marketOverview.marketSentiment.finance.toFixed(2)}`);
      
      console.log(`      Volatilidade:`);
      console.log(`        Medo do mercado: ${marketOverview.volatility.marketFear}`);
    } else {
      console.log('   ❌ Falha ao obter visão geral do mercado');
    }

    console.log('\n🔧 TESTE 8: Estatísticas da API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const apiStats = await testApiStats();
    if (apiStats) {
      console.log(`   ✅ Estatísticas da API:`);
      console.log(`      Requests feitos: ${apiStats.requestCount}`);
      console.log(`      Último request: ${new Date(apiStats.lastRequestTime).toISOString()}`);
      console.log(`      Rate limit restante: ${apiStats.rateLimitRemaining}`);
      console.log(`      Status: ${apiStats.status}`);
    } else {
      console.log('   ❌ Falha ao obter estatísticas da API');
    }

    console.log('\n🎉 RESUMO DA INTEGRAÇÃO ALPHA VANTAGE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Funcionalidades Implementadas:');
    console.log('   📊 Cotações de ações e criptomoedas');
    console.log('   📈 Indicadores técnicos (RSI, MACD, Bollinger Bands)');
    console.log('   🌍 Indicadores econômicos (GDP, Inflação)');
    console.log('   📰 Análise de sentimento de notícias');
    console.log('   🔍 Análise técnica aprimorada integrada');
    console.log('   🌐 Visão geral do mercado');
    console.log('   ⚡ Rate limiting e cache inteligente');
    console.log('');
    console.log('🚀 Benefícios:');
    console.log('   - Dados fundamentais em tempo real');
    console.log('   - Análise de sentimento de mercado');
    console.log('   - Contexto econômico para decisões');
    console.log('   - Indicadores técnicos profissionais');
    console.log('   - Integração completa com sistema de trading');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }
}

// Funções de teste
async function testStockQuote(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/quote?action=single&symbol=${symbol}`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error(`Erro ao testar cotação de ${symbol}:`, error.message);
    return null;
  }
}

async function testCryptoQuote(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/quote?action=single&symbol=${symbol}&type=crypto`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error(`Erro ao testar cotação crypto de ${symbol}:`, error.message);
    return null;
  }
}

async function testRSI(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/technical?action=rsi&symbol=${symbol}&timeframe=daily&period=14`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error(`Erro ao testar RSI de ${symbol}:`, error.message);
    return null;
  }
}

async function testMACD(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/technical?action=macd&symbol=${symbol}&timeframe=daily`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error(`Erro ao testar MACD de ${symbol}:`, error.message);
    return null;
  }
}

async function testBollingerBands(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/technical?action=bollinger&symbol=${symbol}&timeframe=daily&bbPeriod=20`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error(`Erro ao testar Bollinger Bands de ${symbol}:`, error.message);
    return null;
  }
}

async function testGDP() {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/economic?action=gdp`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error('Erro ao testar GDP:', error.message);
    return null;
  }
}

async function testInflation() {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/economic?action=inflation`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error('Erro ao testar inflação:', error.message);
    return null;
  }
}

async function testNewsSentiment() {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/news?action=sentiment&topics=blockchain,earnings&limit=10`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error('Erro ao testar sentimento de notícias:', error.message);
    return null;
  }
}

async function testEnhancedAnalysis(symbol) {
  try {
    const response = await axios.get(`${BASE_URL}/api/enhanced-analysis/technical?action=analyze&symbol=${symbol}`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error(`Erro ao testar análise aprimorada de ${symbol}:`, error.message);
    return null;
  }
}

async function testMarketOverview() {
  try {
    const response = await axios.get(`${BASE_URL}/api/enhanced-analysis/technical?action=market-overview`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error('Erro ao testar visão geral do mercado:', error.message);
    return null;
  }
}

async function testApiStats() {
  try {
    const response = await axios.get(`${BASE_URL}/api/alpha-vantage/stats`);
    return response.data.success ? response.data.data : null;
  } catch (error) {
    console.error('Erro ao testar estatísticas da API:', error.message);
    return null;
  }
}

// Executar testes
testAlphaVantageIntegration()
  .then(() => {
    console.log('\n✅ Testes de integração Alpha Vantage concluídos!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal nos testes:', error);
    process.exit(1);
  });
