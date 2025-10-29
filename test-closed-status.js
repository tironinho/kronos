const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testClosedStatus() {
  console.log('🧪 TESTANDO STATUS "CLOSED" NO SISTEMA KRONOS-X\n');
  console.log('============================================================\n');

  try {
    // 1. Verificar trades abertos
    console.log('1️⃣ VERIFICANDO TRADES ABERTAS...');
    const { data: openTrades, error: openError } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false });

    if (openError) {
      console.error('❌ Erro ao buscar trades abertas:', openError);
      return;
    }

    console.log(`   📊 Trades abertas encontradas: ${openTrades?.length || 0}`);
    if (openTrades && openTrades.length > 0) {
      console.log('   📋 Detalhes das trades abertas:');
      openTrades.slice(0, 5).forEach((trade, idx) => {
        console.log(`      ${idx + 1}. ${trade.symbol} - ${trade.side} - ${trade.opened_at}`);
        console.log(`         Trade ID: ${trade.trade_id}`);
        console.log(`         Status: ${trade.status}`);
        console.log(`         Closed At: ${trade.closed_at || 'N/A'}`);
        console.log(`         Closed Reason: ${trade.closed_reason || 'N/A'}`);
      });
    }
    console.log('');

    // 2. Verificar trades fechadas
    console.log('2️⃣ VERIFICANDO TRADES FECHADAS...');
    const { data: closedTrades, error: closedError } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(10);

    if (closedError) {
      console.error('❌ Erro ao buscar trades fechadas:', closedError);
      return;
    }

    console.log(`   📊 Trades fechadas encontradas: ${closedTrades?.length || 0}`);
    if (closedTrades && closedTrades.length > 0) {
      console.log('   📋 Detalhes das trades fechadas:');
      closedTrades.forEach((trade, idx) => {
        console.log(`      ${idx + 1}. ${trade.symbol} - ${trade.side}`);
        console.log(`         Trade ID: ${trade.trade_id}`);
        console.log(`         Status: ${trade.status}`);
        console.log(`         Opened At: ${trade.opened_at}`);
        console.log(`         Closed At: ${trade.closed_at || 'N/A'}`);
        console.log(`         Closed Reason: ${trade.closed_reason || 'N/A'}`);
        console.log(`         P&L: $${trade.pnl || 0} (${trade.pnl_percent || 0}%)`);
        console.log('');
      });
    } else {
      console.log('   ⚠️ Nenhuma trade fechada encontrada');
    }
    console.log('');

    // 3. Verificar trades sem status closed_at
    console.log('3️⃣ VERIFICANDO TRADES SEM CLOSED_AT...');
    const { data: tradesWithoutClosedAt, error: noClosedAtError } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'closed')
      .is('closed_at', null);

    if (noClosedAtError) {
      console.error('❌ Erro ao buscar trades sem closed_at:', noClosedAtError);
      return;
    }

    console.log(`   📊 Trades fechadas sem closed_at: ${tradesWithoutClosedAt?.length || 0}`);
    if (tradesWithoutClosedAt && tradesWithoutClosedAt.length > 0) {
      console.log('   ⚠️ PROBLEMA ENCONTRADO: Trades fechadas sem timestamp de fechamento!');
      tradesWithoutClosedAt.forEach((trade, idx) => {
        console.log(`      ${idx + 1}. ${trade.symbol} - ${trade.side}`);
        console.log(`         Trade ID: ${trade.trade_id}`);
        console.log(`         Status: ${trade.status}`);
        console.log(`         Opened At: ${trade.opened_at}`);
        console.log(`         Closed At: ${trade.closed_at || 'NULL'}`);
        console.log(`         Closed Reason: ${trade.closed_reason || 'N/A'}`);
      });
    } else {
      console.log('   ✅ Todas as trades fechadas têm closed_at preenchido');
    }
    console.log('');

    // 4. Estatísticas gerais
    console.log('4️⃣ ESTATÍSTICAS GERAIS...');
    const { data: allTrades, error: allError } = await supabase
      .from('real_trades')
      .select('status, closed_reason');

    if (allError) {
      console.error('❌ Erro ao buscar todas as trades:', allError);
      return;
    }

    const stats = {
      total: allTrades?.length || 0,
      open: allTrades?.filter(t => t.status === 'open').length || 0,
      closed: allTrades?.filter(t => t.status === 'closed').length || 0,
      closedReasons: {}
    };

    // Contar razões de fechamento
    allTrades?.filter(t => t.status === 'closed').forEach(trade => {
      const reason = trade.closed_reason || 'unknown';
      stats.closedReasons[reason] = (stats.closedReasons[reason] || 0) + 1;
    });

    console.log(`   📊 Total de trades: ${stats.total}`);
    console.log(`   📊 Trades abertas: ${stats.open}`);
    console.log(`   📊 Trades fechadas: ${stats.closed}`);
    console.log('   📊 Razões de fechamento:');
    Object.entries(stats.closedReasons).forEach(([reason, count]) => {
      console.log(`      - ${reason}: ${count} trades`);
    });
    console.log('');

    // 5. Verificar trades recentes (últimas 24h)
    console.log('5️⃣ TRADES RECENTES (ÚLTIMAS 24H)...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentTrades, error: recentError } = await supabase
      .from('real_trades')
      .select('*')
      .gte('opened_at', yesterday.toISOString())
      .order('opened_at', { ascending: false });

    if (recentError) {
      console.error('❌ Erro ao buscar trades recentes:', recentError);
      return;
    }

    console.log(`   📊 Trades nas últimas 24h: ${recentTrades?.length || 0}`);
    if (recentTrades && recentTrades.length > 0) {
      const recentOpen = recentTrades.filter(t => t.status === 'open').length;
      const recentClosed = recentTrades.filter(t => t.status === 'closed').length;
      
      console.log(`   📊 Abertas: ${recentOpen}`);
      console.log(`   📊 Fechadas: ${recentClosed}`);
      
      if (recentClosed > 0) {
        console.log('   📋 Trades fechadas recentes:');
        recentTrades.filter(t => t.status === 'closed').slice(0, 3).forEach((trade, idx) => {
          console.log(`      ${idx + 1}. ${trade.symbol} - ${trade.side}`);
          console.log(`         Fechada em: ${trade.closed_at}`);
          console.log(`         Razão: ${trade.closed_reason}`);
          console.log(`         P&L: $${trade.pnl || 0} (${trade.pnl_percent || 0}%)`);
        });
      }
    }
    console.log('');

    // 6. Resumo e recomendações
    console.log('6️⃣ RESUMO E RECOMENDAÇÕES...');
    console.log('============================================================');
    
    if (stats.closed > 0) {
      console.log('✅ Sistema está funcionando - trades estão sendo fechadas');
      
      if (tradesWithoutClosedAt && tradesWithoutClosedAt.length > 0) {
        console.log('⚠️ PROBLEMA: Algumas trades fechadas não têm closed_at');
        console.log('   Recomendação: Executar script de correção para preencher closed_at');
      } else {
        console.log('✅ Todas as trades fechadas têm closed_at preenchido');
      }
      
      const hasRecentActivity = recentTrades && recentTrades.length > 0;
      if (hasRecentActivity) {
        console.log('✅ Sistema ativo - trades recentes encontradas');
      } else {
        console.log('⚠️ Sistema pode estar inativo - nenhuma trade recente');
      }
    } else {
      console.log('⚠️ ATENÇÃO: Nenhuma trade fechada encontrada');
      console.log('   Possíveis causas:');
      console.log('   - Sistema não está executando trades');
      console.log('   - Problema na função closeTrade');
      console.log('   - Trades estão sendo fechadas mas não atualizadas no banco');
    }
    
    console.log('\n🎯 PRÓXIMOS PASSOS:');
    console.log('   1. Monitorar logs do sistema durante execução');
    console.log('   2. Verificar se closeTrade está sendo chamado');
    console.log('   3. Confirmar que updateTradeStatusInDatabase está funcionando');
    console.log('   4. Executar este teste periodicamente para monitorar');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testClosedStatus().then(() => {
  console.log('\n✅ Teste concluído!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
