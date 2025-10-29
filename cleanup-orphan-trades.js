#!/usr/bin/env node

/**
 * Script para limpar trades órfãs na tabela real_trades
 * Trades que estão com status "open" mas já foram executadas na Binance
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function cleanupOrphanTrades() {
  console.log('🧹 Iniciando limpeza de trades órfãs...');

  // Inicializar Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Credenciais do Supabase não encontradas');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Buscar todas as trades abertas
    const { data: openTrades, error: fetchError } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Erro ao buscar trades abertas:', fetchError);
      return;
    }

    if (!openTrades || openTrades.length === 0) {
      console.log('✅ Nenhuma trade órfã encontrada');
      return;
    }

    console.log(`📊 Encontradas ${openTrades.length} trades abertas`);

    // Analisar cada trade
    let orphanCount = 0;
    let updatedCount = 0;

    for (const trade of openTrades) {
      console.log(`\n🔍 Analisando trade: ${trade.trade_id}`);
      console.log(`   Símbolo: ${trade.symbol}`);
      console.log(`   Lado: ${trade.side}`);
      console.log(`   Aberta em: ${trade.opened_at}`);
      console.log(`   Preço entrada: $${trade.entry_price}`);

      // Verificar se a trade tem mais de 1 hora (considerar órfã)
      const tradeTime = new Date(trade.opened_at);
      const now = new Date();
      const hoursDiff = (now.getTime() - tradeTime.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > 1) {
        console.log(`   ⚠️ Trade órfã detectada (${hoursDiff.toFixed(1)}h atrás)`);
        
        // Marcar como fechada com PnL 0
        const { error: updateError } = await supabase
          .from('real_trades')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            current_price: trade.entry_price, // Manter preço de entrada
            pnl: 0,
            pnl_percent: 0
          })
          .eq('id', trade.id);

        if (updateError) {
          console.error(`   ❌ Erro ao atualizar trade ${trade.trade_id}:`, updateError);
        } else {
          console.log(`   ✅ Trade ${trade.trade_id} marcada como fechada`);
          updatedCount++;
        }
        
        orphanCount++;
      } else {
        console.log(`   ✅ Trade recente (${hoursDiff.toFixed(1)}h atrás) - mantendo aberta`);
      }
    }

    console.log(`\n📊 Resumo da limpeza:`);
    console.log(`   Trades órfãs encontradas: ${orphanCount}`);
    console.log(`   Trades atualizadas: ${updatedCount}`);
    console.log(`   Trades mantidas abertas: ${openTrades.length - orphanCount}`);

    // Verificar resultado final
    const { data: finalTrades, error: finalError } = await supabase
      .from('real_trades')
      .select('status')
      .eq('status', 'open');

    if (!finalError && finalTrades) {
      console.log(`\n✅ Trades abertas restantes: ${finalTrades.length}`);
    }

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  }
}

// Executar limpeza
cleanupOrphanTrades()
  .then(() => {
    console.log('\n🎉 Limpeza concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
