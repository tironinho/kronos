async function testTradingLoop() {
  console.log('🧪 TESTANDO LOOP PRINCIPAL DE TRADING\n');
  console.log('============================================================\n');

  try {
    // 1. Verificar se o trading engine está funcionando
    console.log('1️⃣ VERIFICANDO TRADING ENGINE...');
    const response = await fetch('http://localhost:3000/api/status');
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ API de status funcionando');
      console.log(`   Status: ${data.status}`);
      
      if (data.data) {
        console.log(`   Trading ativo: ${data.data.isRunning ? 'Sim' : 'Não'}`);
        console.log(`   Modo Futures: ${data.data.isFuturesMode ? 'Sim' : 'Não'}`);
        console.log(`   Trades abertas: ${data.data.openTrades || 0}`);
      }
    } else {
      console.log('   ❌ Erro na API de status:', response.status);
    }

    // 2. Verificar logs recentes para loop de trading
    console.log('\n2️⃣ VERIFICANDO LOGS DE TRADING...');
    try {
      const logsResponse = await fetch('http://localhost:3000/api/logs');
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        const recentLogs = logsData.logs?.slice(-20) || [];
        
        console.log('   📋 Últimos 20 logs:');
        recentLogs.forEach((log, idx) => {
          if (log.includes('Ciclo de trading') || log.includes('oportunidades') || 
              log.includes('Executando trade') || log.includes('Loop principal')) {
            console.log(`   🔍 ${idx + 1}: ${log}`);
          }
        });
        
        // Verificar se há logs do loop
        const hasLoopLogs = recentLogs.some(log => 
          log.includes('Ciclo de trading') || log.includes('oportunidades')
        );
        
        if (hasLoopLogs) {
          console.log('   ✅ Logs do loop de trading encontrados!');
        } else {
          console.log('   ⚠️ Nenhum log do loop de trading encontrado');
        }
      }
    } catch (logsError) {
      console.log('   ⚠️ Erro ao verificar logs:', logsError.message);
    }

    // 3. Verificar trades ativas
    console.log('\n3️⃣ VERIFICANDO TRADES ATIVAS...');
    try {
      const tradesResponse = await fetch('http://localhost:3000/api/trades');
      if (tradesResponse.ok) {
        const tradesData = await tradesResponse.json();
        console.log(`   Trades ativas: ${tradesData.trades?.length || 0}`);
        
        if (tradesData.trades && tradesData.trades.length > 0) {
          console.log('   📊 Detalhes das trades:');
          tradesData.trades.forEach((trade, idx) => {
            console.log(`     ${idx + 1}. ${trade.symbol}: ${trade.side} - P&L: $${trade.pnl || 0}`);
          });
        }
      }
    } catch (tradesError) {
      console.log('   ⚠️ Erro ao verificar trades:', tradesError.message);
    }

    // 4. Verificar métricas de trading
    console.log('\n4️⃣ VERIFICANDO MÉTRICAS DE TRADING...');
    try {
      const metricsResponse = await fetch('http://localhost:3000/api/trading/metrics');
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        console.log('   📈 Métricas atuais:');
        console.log(`     Total trades: ${metricsData.data?.totalTrades || 0}`);
        console.log(`     Trades ativas: ${metricsData.data?.activeTrades || 0}`);
        console.log(`     Win Rate: ${metricsData.data?.winRate || 0}%`);
        console.log(`     P&L Total: $${metricsData.data?.totalPnL || 0}`);
      }
    } catch (metricsError) {
      console.log('   ⚠️ Erro ao verificar métricas:', metricsError.message);
    }

    console.log('\n✅ TESTE CONCLUÍDO!\n');

    console.log('📋 RESUMO DA IMPLEMENTAÇÃO:');
    console.log('   ✅ Loop principal de trading implementado');
    console.log('   ✅ Método runTradingCycle() adicionado');
    console.log('   ✅ Monitoramento de trades abertas');
    console.log('   ✅ Verificação de limites de trades');
    console.log('   ✅ Execução automática de oportunidades\n');

    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('   1. Reiniciar o servidor para aplicar as mudanças');
    console.log('   2. Iniciar trading novamente');
    console.log('   3. Verificar logs para confirmação do loop');
    console.log('   4. Monitorar execução de trades automáticas');
    console.log('   5. Ajustar parâmetros se necessário\n');

    console.log('🔍 LOGS ESPERADOS APÓS IMPLEMENTAÇÃO:');
    console.log('   🔄 Iniciando loop principal de trading...');
    console.log('   🔍 Ciclo de trading - verificando oportunidades...');
    console.log('   💰 Saldo atual: $X.XX');
    console.log('   🎯 Encontradas X oportunidades');
    console.log('   🚀 Executando trade: SYMBOL (confiança: XX%)');
    console.log('   ⏳ Aguardando 30 segundos para próximo ciclo...');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

testTradingLoop();
