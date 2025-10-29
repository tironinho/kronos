const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTrades() {
  console.log('🔍 VERIFICANDO TRADES NA TABELA real_trades...\n');
  
  try {
    const { data: trades, error } = await supabase
      .from('real_trades')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Erro ao buscar trades:', error);
      return;
    }
    
    console.log(`📊 Total de trades encontradas: ${trades.length}`);
    
    if (trades.length > 0) {
      console.log('\n📋 ÚLTIMAS TRADES:');
      trades.forEach((trade, idx) => {
        console.log(`${idx + 1}. ${trade.symbol} - ${trade.side} - Status: ${trade.status}`);
        console.log(`   Quantidade: ${trade.quantity}`);
        console.log(`   Preço entrada: ${trade.entry_price}`);
        console.log(`   P&L: ${trade.pnl || 0}`);
        console.log(`   Aberta em: ${trade.opened_at}`);
        console.log(`   Fechada em: ${trade.closed_at || 'Ainda aberta'}`);
        console.log('');
      });
    } else {
      console.log('⚠️ Nenhuma trade encontrada na tabela real_trades');
    }
    
    // Verificar trades abertas vs fechadas
    const openTrades = trades.filter(t => t.status === 'open');
    const closedTrades = trades.filter(t => t.status === 'closed');
    
    console.log(`📈 RESUMO:`);
    console.log(`   Trades abertas: ${openTrades.length}`);
    console.log(`   Trades fechadas: ${closedTrades.length}`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkTrades();