async function testTradingStartAPI() {
  console.log('🧪 TESTANDO API DE INÍCIO DE TRADING\n');
  console.log('============================================================\n');

  try {
    // 1. Testar API de saldo da Binance
    console.log('1️⃣ TESTANDO API DE SALDO DA BINANCE...');
    try {
      const balanceResponse = await fetch('http://localhost:3000/api/binance/balance');
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        console.log('   ✅ API de saldo funcionando');
        console.log(`   💰 Saldo Spot: $${balanceData.data.spot.balance}`);
        console.log(`   💰 Saldo Futures: $${balanceData.data.futures.balance}`);
        console.log(`   💰 Total: $${balanceData.data.total}`);
      } else {
        console.log(`   ❌ Erro na API de saldo: ${balanceResponse.status}`);
        const errorText = await balanceResponse.text();
        console.log(`   Erro: ${errorText}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Erro ao testar API de saldo: ${error.message}`);
    }

    // 2. Testar API de início de trading
    console.log('\n2️⃣ TESTANDO API DE INÍCIO DE TRADING...');
    try {
      const startResponse = await fetch('http://localhost:3000/api/trading/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initialCapital: 100,
          mode: 'spot',
          leverage: 5
        })
      });

      if (startResponse.ok) {
        const startData = await startResponse.json();
        console.log('   ✅ API de início de trading funcionando');
        console.log(`   Status: ${startData.status}`);
        console.log(`   Mensagem: ${startData.message}`);
        console.log(`   Modo: ${startData.data.mode}`);
        console.log(`   Saldo: $${startData.data.realBalance}`);
        console.log(`   Sistema: ${startData.data.system}`);
      } else {
        console.log(`   ❌ Erro na API de início: ${startResponse.status}`);
        const errorText = await startResponse.text();
        console.log(`   Erro: ${errorText}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Erro ao testar API de início: ${error.message}`);
    }

    // 3. Testar API de início de trading Futures
    console.log('\n3️⃣ TESTANDO API DE INÍCIO DE TRADING FUTURES...');
    try {
      const futuresResponse = await fetch('http://localhost:3000/api/trading/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initialCapital: 100,
          mode: 'futures',
          leverage: 5
        })
      });

      if (futuresResponse.ok) {
        const futuresData = await futuresResponse.json();
        console.log('   ✅ API de início de trading Futures funcionando');
        console.log(`   Status: ${futuresData.status}`);
        console.log(`   Mensagem: ${futuresData.message}`);
        console.log(`   Modo: ${futuresData.data.mode}`);
        console.log(`   Saldo: $${futuresData.data.realBalance}`);
      } else {
        console.log(`   ❌ Erro na API de início Futures: ${futuresResponse.status}`);
        const errorText = await futuresResponse.text();
        console.log(`   Erro: ${errorText}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Erro ao testar API de início Futures: ${error.message}`);
    }

    // 4. Testar API de status do trading
    console.log('\n4️⃣ TESTANDO API DE STATUS DO TRADING...');
    try {
      const statusResponse = await fetch('http://localhost:3000/api/trading/status');
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('   ✅ API de status funcionando');
        console.log(`   Status: ${statusData.status}`);
        console.log(`   Trading ativo: ${statusData.data.tradingActive}`);
        console.log(`   Modo: ${statusData.data.mode}`);
        console.log(`   Trades abertas: ${statusData.data.openTrades}`);
      } else {
        console.log(`   ❌ Erro na API de status: ${statusResponse.status}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Erro ao testar API de status: ${error.message}`);
    }

    console.log('\n✅ TESTE CONCLUÍDO!\n');

    console.log('📋 RESUMO DAS CORREÇÕES:');
    console.log('   ✅ Métodos startTrading() e startTradingFutures() adicionados');
    console.log('   ✅ API /api/binance/balance criada');
    console.log('   ✅ Tratamento de erros melhorado');
    console.log('   ✅ Logs detalhados para debug');
    console.log('   ✅ Validação de saldo implementada\n');

    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('   1. Reiniciar o servidor Next.js');
    console.log('   2. Testar o botão "Iniciar Trading" na interface');
    console.log('   3. Verificar os logs do console');
    console.log('   4. Confirmar que não há mais erros 500');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

testTradingStartAPI();
