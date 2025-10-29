const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeTrades() {
  console.log('🔍 ANÁLISE CRITERIOSA DOS LOGS E TRADES\n');
  console.log('============================================================\n');
  
  try {
    // 1. Buscar trades da tabela real_trades
    console.log('1️⃣ BUSCANDO TRADES DA TABELA real_trades...');
    const { data: trades, error } = await supabase
      .from('real_trades')
      .select('*')
      .order('opened_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erro ao buscar trades:', error);
      return;
    }
    
    console.log(`   📊 Total de trades encontradas: ${trades.length}`);
    
    const openTrades = trades.filter(t => t.status === 'open');
    const closedTrades = trades.filter(t => t.status === 'closed');
    
    console.log(`   📈 Trades abertas: ${openTrades.length}`);
    console.log(`   📉 Trades fechadas: ${closedTrades.length}\n`);
    
    // 2. Análise das trades abertas
    if (openTrades.length > 0) {
      console.log('2️⃣ ANÁLISE DAS TRADES ABERTAS:');
      openTrades.forEach((trade, idx) => {
        console.log(`   ${idx + 1}. ${trade.symbol} ${trade.side}`);
        console.log(`      - Quantidade: ${trade.quantity}`);
        console.log(`      - Preço entrada: $${trade.entry_price}`);
        console.log(`      - P&L atual: $${trade.pnl || 0}`);
        console.log(`      - Confiança: ${trade.confidence}%`);
        console.log(`      - Aberta em: ${trade.opened_at}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️ Nenhuma trade aberta encontrada na tabela\n');
    }
    
    // 3. Análise das trades fechadas recentes
    if (closedTrades.length > 0) {
      console.log('3️⃣ ANÁLISE DAS ÚLTIMAS 5 TRADES FECHADAS:');
      closedTrades.slice(0, 5).forEach((trade, idx) => {
        console.log(`   ${idx + 1}. ${trade.symbol} ${trade.side}`);
        console.log(`      - P&L: $${trade.pnl || 0}`);
        console.log(`      - Fechada em: ${trade.closed_at}`);
        console.log(`      - Razão: ${trade.closed_reason || 'N/A'}`);
        console.log('');
      });
    }
    
    // 4. Verificar consistência com logs
    console.log('4️⃣ VERIFICAÇÃO DE CONSISTÊNCIA:');
    console.log(`   📊 Logs mostram: "2 posições abertas na Binance Futures"`);
    console.log(`   📊 Tabela real_trades: ${openTrades.length} trades abertas`);
    
    if (openTrades.length === 2) {
      console.log('   ✅ CONSISTENTE: Logs e tabela coincidem');
    } else {
      console.log('   ⚠️ INCONSISTENTE: Diferença entre logs e tabela');
    }
    
    // 5. Análise de performance
    if (closedTrades.length > 0) {
      console.log('\n5️⃣ ANÁLISE DE PERFORMANCE:');
      const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
      const winRate = (winningTrades / closedTrades.length) * 100;
      
      console.log(`   💰 P&L Total: $${totalPnL.toFixed(2)}`);
      console.log(`   📈 Win Rate: ${winRate.toFixed(1)}%`);
      console.log(`   🏆 Trades vencedoras: ${winningTrades}/${closedTrades.length}`);
    }
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
  
  console.log('\n============================================================');
  console.log('✅ ANÁLISE CONCLUÍDA');
}

analyzeTrades();
