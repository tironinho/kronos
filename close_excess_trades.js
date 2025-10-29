/**
 * Script para fechar trades excedentes
 * Reduz o número de trades abertas de 7 para 2 (ou conforme limite configurado)
 */

const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  try {
    require('dotenv').config();
  } catch (e2) {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

const supabase = createClient(supabaseUrl, supabaseKey);

// Limite máximo de trades (configuração atual)
const MAX_ACTIVE_TRADES = 2;

async function closeExcessTrades() {
  console.log('='.repeat(100));
  console.log('🔧 AJUSTE: FECHAR TRADES EXCEDENTES');
  console.log('='.repeat(100));
  console.log('');

  try {
    // 1. Buscar todas as trades abertas
    const { data: openTrades, error } = await supabase
      .from('real_trades')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: true }); // Mais antigas primeiro

    if (error) {
      console.error('❌ Erro ao buscar trades abertas:', error);
      return;
    }

    if (!openTrades || openTrades.length === 0) {
      console.log('✅ Nenhuma trade aberta encontrada');
      return;
    }

    console.log(`📊 Trades Abertas Encontradas: ${openTrades.length}`);
    console.log(`📊 Limite Máximo: ${MAX_ACTIVE_TRADES}`);
    console.log('');

    if (openTrades.length <= MAX_ACTIVE_TRADES) {
      console.log(`✅ Número de trades está dentro do limite (${openTrades.length} <= ${MAX_ACTIVE_TRADES})`);
      return;
    }

    const excessCount = openTrades.length - MAX_ACTIVE_TRADES;
    console.log(`⚠️ Trades Excedentes: ${excessCount}`);
    console.log(`📋 Trades que serão fechadas:`);
    console.log('');

    // 2. Listar trades ordenadas por P&L (pior primeiro)
    const tradesSorted = openTrades.map(t => ({
      ...t,
      pnlValue: parseFloat(t.pnl?.toString() || '0'),
      pnlPercent: parseFloat(t.pnl_percent?.toString() || '0')
    })).sort((a, b) => {
      // Priorizar: menor P&L, menor confiança, mais antiga
      if (a.pnlValue !== b.pnlValue) return a.pnlValue - b.pnlValue;
      if (a.confidence !== b.confidence) return a.confidence - b.confidence;
      return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
    });

    // 3. Identificar trades para fechar (mantém as 2 melhores)
    const tradesToClose = tradesSorted.slice(0, excessCount);
    const tradesToKeep = tradesSorted.slice(excessCount);

    console.log('📊 TRADES QUE SERÃO FECHADAS:');
    tradesToClose.forEach((trade, idx) => {
      console.log(`   ${idx + 1}. ${trade.symbol} ${trade.side} - P&L: $${trade.pnlValue.toFixed(4)} (${trade.pnlPercent.toFixed(2)}%) - Confiança: ${trade.confidence}%`);
      console.log(`      Trade ID: ${trade.trade_id}`);
      console.log(`      Aberta em: ${trade.opened_at}`);
    });
    console.log('');

    console.log('✅ TRADES QUE SERÃO MANTIDAS:');
    tradesToKeep.forEach((trade, idx) => {
      console.log(`   ${idx + 1}. ${trade.symbol} ${trade.side} - P&L: $${trade.pnlValue.toFixed(4)} (${trade.pnlPercent.toFixed(2)}%) - Confiança: ${trade.confidence}%`);
    });
    console.log('');

    // 4. Confirmar ação
    console.log(`⚠️ ATENÇÃO: Este script marcará ${excessCount} trades como 'closed' no banco de dados.`);
    console.log(`⚠️ As ordens na Binance NÃO serão fechadas automaticamente.`);
    console.log(`⚠️ Você precisará fechar manualmente na Binance ou usar o método closeTrade() do sistema.`);
    console.log('');

    // 5. Fechar trades no banco (marcar como closed)
    let closedCount = 0;
    for (const trade of tradesToClose) {
      try {
        // Obter preço atual para atualizar current_price
        const { data: priceData } = await supabase
          .from('real_trades')
          .select('current_price')
          .eq('trade_id', trade.trade_id)
          .single();

        const currentPrice = priceData?.current_price || trade.current_price || trade.entry_price;
        const currentTime = new Date().toISOString();

        // Atualizar trade como fechada
        const { error: updateError } = await supabase
          .from('real_trades')
          .update({
            status: 'closed',
            closed_at: currentTime,
            current_price: currentPrice,
            reason: 'closed_by_limit_adjustment_script'
          })
          .eq('trade_id', trade.trade_id);

        if (updateError) {
          console.error(`❌ Erro ao fechar trade ${trade.trade_id}:`, updateError);
        } else {
          console.log(`✅ Trade ${trade.symbol} ${trade.trade_id} marcada como fechada`);
          closedCount++;
        }
      } catch (err) {
        console.error(`❌ Erro ao processar trade ${trade.trade_id}:`, err);
      }
    }

    console.log('');
    console.log('='.repeat(100));
    console.log('📊 RESUMO:');
    console.log(`   Trades encontradas: ${openTrades.length}`);
    console.log(`   Trades fechadas: ${closedCount}/${excessCount}`);
    console.log(`   Trades mantidas: ${tradesToKeep.length}`);
    console.log('='.repeat(100));

    if (closedCount < excessCount) {
      console.log('');
      console.log('⚠️ ALGUMAS TRADES NÃO FORAM FECHADAS COM SUCESSO');
      console.log('⚠️ Verifique os erros acima e tente novamente se necessário');
    }

  } catch (error) {
    console.error('❌ Erro crítico:', error);
    process.exit(1);
  }
}

closeExcessTrades()
  .then(() => {
    console.log('');
    console.log('✅ Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

