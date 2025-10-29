async function testBinanceBalanceAPI() {
  console.log('🧪 TESTANDO API DE SALDO DA BINANCE\n');
  console.log('============================================================\n');

  try {
    // Testar API de saldo da Binance
    console.log('1️⃣ TESTANDO API DE SALDO DA BINANCE...');
    const response = await fetch('http://localhost:3000/api/binance/balance');
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ API de saldo funcionando');
      console.log(`   Status: ${data.status}`);
      
      if (data.status === 'success') {
        const balanceData = data.data;
        console.log(`   💰 Saldo Total: $${balanceData.totalBalance}`);
        console.log(`   💰 Saldo Spot: $${balanceData.spot.balance}`);
        console.log(`   💰 Saldo Futures: $${balanceData.futures.balance}`);
        console.log(`   📊 Total de Ativos: ${balanceData.balances?.length || 0}`);
        console.log(`   🔒 Status Trading: ${balanceData.canTrade ? '✅ ATIVO' : '❌ BLOQUEADO'}`);
        console.log(`   💸 Pode Sacar: ${balanceData.canWithdraw ? '✅ Sim' : '❌ Não'}`);
        console.log(`   💰 Pode Depositar: ${balanceData.canDeposit ? '✅ Sim' : '❌ Não'}`);
        console.log(`   🏦 Tipo de Conta: ${balanceData.accountType}`);
        
        // Mostrar detalhes dos saldos
        if (balanceData.balances && balanceData.balances.length > 0) {
          console.log('\n   📋 Detalhes dos Saldos:');
          balanceData.balances.forEach((bal, idx) => {
            if (parseFloat(bal.total) > 0) {
              console.log(`     ${bal.asset}: ${bal.total} (Livre: ${bal.free}, Bloqueado: ${bal.locked})`);
            }
          });
        } else {
          console.log('\n   ⚠️ Nenhum saldo encontrado');
        }
        
        // Análise do status
        console.log('\n   🔍 ANÁLISE DO STATUS:');
        if (!balanceData.canTrade) {
          console.log('   ❌ TRADING BLOQUEADO - Possíveis causas:');
          if (balanceData.totalBalance === 0) {
            console.log('     - Saldo insuficiente (Total: $0.00)');
          }
          if (balanceData.spot.balance === 0 && balanceData.futures.balance === 0) {
            console.log('     - Sem saldo em Spot e Futures');
          }
          console.log('     - Conta pode estar restrita');
          console.log('     - API keys podem não ter permissões de trading');
        } else {
          console.log('   ✅ TRADING ATIVO - Sistema pode executar trades');
        }
        
      } else {
        console.log(`   ❌ Erro na API: ${data.message}`);
      }
    } else {
      console.log(`   ❌ Erro HTTP: ${response.status}`);
      const errorText = await response.text();
      console.log(`   Erro: ${errorText}`);
    }

    console.log('\n✅ TESTE CONCLUÍDO!\n');

    console.log('📋 RESUMO DAS CORREÇÕES:');
    console.log('   ✅ API agora retorna canTrade, canWithdraw, canDeposit');
    console.log('   ✅ Conversão correta dos balances da Binance');
    console.log('   ✅ Verificação de permissões Spot e Futures');
    console.log('   ✅ Status geral baseado em saldos disponíveis');
    console.log('   ✅ Logs detalhados para debug\n');

    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('   1. Verificar se há saldo na conta Binance');
    console.log('   2. Confirmar que as API keys têm permissões de trading');
    console.log('   3. Recarregar a página para ver o status atualizado');
    console.log('   4. Se ainda estiver bloqueado, verificar logs do servidor');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

testBinanceBalanceAPI();
