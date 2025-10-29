// Teste de análise de símbolos para identificar limitações
const { predictiveAnalyzerV2 } = require('./src/services/analyzers/predictive-analyzer-v2');

async function testSymbolAnalysis() {
  const symbols = ['SOLUSDT', 'ETHUSDT', 'BTCUSDT', 'BNBUSDT', 'DOGEUSDT', 'ENAUSDT'];
  
  console.log('🔍 TESTE DE ANÁLISE DE SÍMBOLOS');
  console.log('================================');
  
  for (const symbol of symbols) {
    try {
      console.log(`\n📊 Analisando ${symbol}...`);
      
      const predictiveV2 = await predictiveAnalyzerV2.consolidate(symbol);
      
      console.log(`   Score: ${predictiveV2.weightedScore.toFixed(2)}`);
      console.log(`   Confiança: ${predictiveV2.confidence}%`);
      console.log(`   Sinal: ${predictiveV2.signal}`);
      console.log(`   Rationale: ${predictiveV2.rationale}`);
      
      // Verificar filtros
      const scoreOk = predictiveV2.weightedScore >= 1.5 || predictiveV2.weightedScore <= -1.5;
      const confidenceOk = predictiveV2.confidence >= 40;
      const signalOk = !predictiveV2.signal.includes('HOLD');
      
      console.log(`   ✅ Score OK: ${scoreOk} (${predictiveV2.weightedScore.toFixed(2)})`);
      console.log(`   ✅ Confiança OK: ${confidenceOk} (${predictiveV2.confidence}%)`);
      console.log(`   ✅ Sinal OK: ${signalOk} (${predictiveV2.signal})`);
      
      const wouldTrade = scoreOk && confidenceOk && signalOk;
      console.log(`   🎯 TRADE APROVADO: ${wouldTrade ? 'SIM' : 'NÃO'}`);
      
    } catch (error) {
      console.error(`❌ Erro ao analisar ${symbol}:`, error.message);
    }
  }
}

testSymbolAnalysis().catch(console.error);
