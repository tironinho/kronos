/**
 * Script para limpar trades duplicadas e órfãs
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDuplicateTrades() {
  console.log('🔧 LIMPANDO TRADES DUPLICADAS E ÓRFÃS\n');
  console.log('='.repeat(80));

  // 1. Buscar todas as trades abertas
  const { data: openTrades, error } = await supabase
    .from('real_trades')
    .select('*')
    .eq('status', 'open')
    .order('opened_at', { ascending: false });

  if (error) {
    console.error('❌ Erro ao buscar trades:', error);
    return;
  }

  if (!openTrades || openTrades.length === 0) {
    console.log('✅ Nenhuma trade aberta encontrada');
    return;
  }

  console.log(`📊 Total de trades abertas encontradas: ${openTrades.length}\n`);

  // 2. Agrupar por símbolo e identificar duplicatas
  const tradesBySymbol = {};
  openTrades.forEach(trade => {
    if (!trade.symbol) return;
    
    if (!tradesBySymbol[trade.symbol]) {
      tradesBySymbol[trade.symbol] = [];
    }
    tradesBySymbol[trade.symbol].push(trade);
  });

  console.log('📊 DISTRIBUIÇÃO POR SÍMBOLO:\n');
  Object.entries(tradesBySymbol).forEach(([symbol, trades]) => {
    console.log(`${symbol}: ${trades.length} trades`);
  });
  console.log('');

  // 3. Para cada símbolo com mais de 3 trades, manter apenas as 3 mais recentes
  let closedCount = 0;
  let updatedCount = 0;

  for (const [symbol, trades] of Object.entries(tradesBySymbol)) {
    if (trades.length <= 3) {
      continue; // Não precisa limpar
    }

    console.log(`\n🔧 Processando ${symbol} (${trades.length} trades, máximo: 3)...`);

    // Ordenar por data de abertura (mais recentes primeiro)
    trades.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());

    // Manter apenas as 3 mais recentes
    const toKeep = trades.slice(0, 3);
    const toClose = trades.slice(3);

    console.log(`   Mantendo: ${toKeep.length} trades (mais recentes)`);
    console.log(`   Fechando: ${toClose.length} trades (mais antigas)`);

    // Fechar trades duplicadas
    for (const trade of toClose) {
      try {
        await supabase
          .from('real_trades')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_reason: 'duplicate_trade_cleaned',
            pnl: trade.pnl || 0,
            pnl_percent: trade.pnl_percent || 0
          })
          .eq('trade_id', trade.trade_id);
        
        closedCount++;
        console.log(`   ✅ Fechada trade ${trade.trade_id} (aberta em ${new Date(trade.opened_at).toLocaleString()})`);
      } catch (err) {
        console.error(`   ❌ Erro ao fechar trade ${trade.trade_id}:`, err);
      }
    }
  }

  // 4. Atualizar preços de todas as trades abertas restantes
  console.log('\n🔄 ATUALIZANDO PREÇOS DAS TRADES ABERTAS...\n');
  
  const { data: remainingTrades } = await supabase
    .from('real_trades')
    .select('*')
    .eq('status', 'open');

  if (remainingTrades && remainingTrades.length > 0) {
    // Para cada trade, vamos simular atualização de preço
    // Em produção, isso seria feito pelo sistema de monitoramento
    for (const trade of remainingTrades) {
      try {
        // Verificar se current_price está diferente de entry_price
        // Se estiver igual, pode ser que não foi atualizado
        if (trade.current_price === trade.entry_price) {
          console.log(`⚠️ ${trade.symbol}: current_price = entry_price (pode não estar atualizado)`);
        }
        
        // Manter como está por enquanto - o sistema de monitoramento deve atualizar
        updatedCount++;
      } catch (err) {
        console.error(`❌ Erro ao atualizar trade ${trade.trade_id}:`, err);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ LIMPEZA CONCLUÍDA:');
  console.log(`   Trades fechadas (duplicadas): ${closedCount}`);
  console.log(`   Trades verificadas: ${updatedCount}`);
  console.log(`\n💡 PRÓXIMOS PASSOS:`);
  console.log(`   1. Reiniciar o sistema de trading`);
  console.log(`   2. Verificar se o monitoramento está atualizando preços`);
  console.log(`   3. Confirmar que não há mais trades duplicadas`);
}

fixDuplicateTrades()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
