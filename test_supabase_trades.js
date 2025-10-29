// Script para testar se trades estão sendo salvos no Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

console.log('🔍 Conectando ao Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTrades() {
  try {
    // Testa conexão
    console.log('\n✅ Supabase conectado!\n');

    // Busca trades
    const { data: trades, error } = await supabase
      .from('simulated_trades')
      .select('*')
      .order('entry_time', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erro ao buscar trades:', error);
      return;
    }

    console.log(`\n📊 Total de trades encontrados: ${trades?.length || 0}\n`);

    if (trades && trades.length > 0) {
      console.log('📋 Últimos 5 trades:');
      trades.slice(0, 5).forEach((trade, idx) => {
        console.log(`\n${idx + 1}. ${trade.symbol} ${trade.side}`);
        console.log(`   Trade ID: ${trade.trade_id}`);
        console.log(`   Entrada: $${trade.entry_price?.toFixed(2) || 'N/A'} @ ${new Date(trade.entry_time).toLocaleString()}`);
        console.log(`   Saída: ${trade.exit_time ? `$${trade.exit_price?.toFixed(2)} @ ${new Date(trade.exit_time).toLocaleString()}` : 'Aberto'}`);
        console.log(`   P&L: $${trade.pnl?.toFixed(4) || '0'} (${trade.pnl_percent?.toFixed(2) || '0'}%)`);
        console.log(`   Status: ${trade.status}`);
        console.log(`   Algoritmo: ${trade.algorithm}`);
      });

      // Estatísticas
      const openTrades = trades.filter(t => t.status === 'open').length;
      const closedTrades = trades.filter(t => t.status === 'closed').length;
      const totalPnL = trades.filter(t => t.status === 'closed').reduce((sum, t) => sum + (t.pnl || 0), 0);
      const winningTrades = trades.filter(t => t.status === 'closed' && (t.pnl || 0) > 0).length;
      const losingTrades = trades.filter(t => t.status === 'closed' && (t.pnl || 0) < 0).length;

      console.log(`\n📈 Estatísticas:`);
      console.log(`   Trades Abertos: ${openTrades}`);
      console.log(`   Trades Fechados: ${closedTrades}`);
      console.log(`   Total P&L: $${totalPnL.toFixed(4)}`);
      console.log(`   Trades Vencedores: ${winningTrades}`);
      console.log(`   Trades Perdedores: ${losingTrades}`);
      if (closedTrades > 0) {
        console.log(`   Taxa de Acerto: ${((winningTrades / closedTrades) * 100).toFixed(2)}%`);
      }
    } else {
      console.log('⚠️ Nenhum trade encontrado no banco ainda.');
      console.log('   O sistema está rodando? Trades estão sendo gerados?');
    }

    // Testa equity history
    console.log('\n\n📊 Testando equity_history...');
    const { data: equityHistory, error: equityError } = await supabase
      .from('equity_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);

    if (equityError) {
      console.error('❌ Erro ao buscar equity history:', equityError);
    } else {
      console.log(`✅ Registros de equity: ${equityHistory?.length || 0}`);
      if (equityHistory && equityHistory.length > 0) {
        equityHistory.forEach((record, idx) => {
          console.log(`   ${idx + 1}. ${record.symbol}: $${record.equity?.toFixed(4) || 'N/A'} @ ${new Date(record.timestamp).toLocaleString()}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testTrades();

