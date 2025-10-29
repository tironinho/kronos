const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeTradingDiscrepancies() {
  console.log('🔍 ANÁLISE DE DISCREPÂNCIAS: LOGS vs BANCO DE DADOS\n');
  console.log('============================================================\n');

  try {
    // 1. Ler logs e extrair oportunidades
    console.log('1️⃣ ANALISANDO LOGS...');
    const logContent = fs.readFileSync('log_history.txt', 'utf8');
    
    // Extrair oportunidades dos logs
    const opportunityMatches = logContent.match(/✅ .* ADICIONADO com sucesso! Decision: \{"action":"(BUY|SELL)","size":([0-9.]+)\}/g);
    
    const opportunitiesFromLogs = [];
    if (opportunityMatches) {
      opportunityMatches.forEach(match => {
        const symbolMatch = match.match(/✅ (.*?) ADICIONADO/);
        const actionMatch = match.match(/"action":"(BUY|SELL)"/);
        const sizeMatch = match.match(/"size":([0-9.]+)/);
        
        if (symbolMatch && actionMatch && sizeMatch) {
          opportunitiesFromLogs.push({
            symbol: symbolMatch[1],
            action: actionMatch[1],
            size: parseFloat(sizeMatch[1]),
            timestamp: new Date().toISOString() // Aproximado
          });
        }
      });
    }
    
    console.log(`   📊 Oportunidades encontradas nos logs: ${opportunitiesFromLogs.length}`);
    opportunitiesFromLogs.forEach(opp => {
      console.log(`     - ${opp.symbol}: ${opp.action} ${opp.size}`);
    });

    // 2. Buscar trades no banco de dados
    console.log('\n2️⃣ ANALISANDO BANCO DE DADOS...');
    const { data: dbTrades, error } = await supabase
      .from('real_trades')
      .select('*')
      .order('opened_at', { ascending: false });

    if (error) {
      throw error;
    }

    const allDbTrades = dbTrades || [];
    const openDbTrades = allDbTrades.filter(t => t.status === 'open');
    const closedDbTrades = allDbTrades.filter(t => t.status === 'closed');

    console.log(`   📊 Total de trades no banco: ${allDbTrades.length}`);
    console.log(`   📊 Trades abertas: ${openDbTrades.length}`);
    console.log(`   📊 Trades fechadas: ${closedDbTrades.length}`);

    // 3. Comparar oportunidades vs trades executadas
    console.log('\n3️⃣ COMPARANDO OPORTUNIDADES vs TRADES EXECUTADAS...');
    
    const recentOpportunities = opportunitiesFromLogs.slice(-10); // Últimas 10 oportunidades
    const recentDbTrades = allDbTrades.slice(0, 10); // Últimas 10 trades do banco
    
    console.log('\n   📋 ÚLTIMAS OPORTUNIDADES DOS LOGS:');
    recentOpportunities.forEach((opp, idx) => {
      console.log(`     ${idx + 1}. ${opp.symbol}: ${opp.action} ${opp.size}`);
    });
    
    console.log('\n   📋 ÚLTIMAS TRADES DO BANCO:');
    recentDbTrades.forEach((trade, idx) => {
      console.log(`     ${idx + 1}. ${trade.symbol}: ${trade.side} ${trade.quantity} (${trade.status})`);
    });

    // 4. Identificar discrepâncias
    console.log('\n4️⃣ IDENTIFICANDO DISCREPÂNCIAS...');
    
    const discrepancies = [];
    
    // Verificar se há oportunidades nos logs que não estão no banco
    recentOpportunities.forEach(opp => {
      const matchingTrade = recentDbTrades.find(trade => 
        trade.symbol === opp.symbol && 
        trade.side === opp.action &&
        Math.abs(trade.quantity - opp.size) < 0.1
      );
      
      if (!matchingTrade) {
        discrepancies.push({
          type: 'OPPORTUNITY_NOT_EXECUTED',
          symbol: opp.symbol,
          action: opp.action,
          size: opp.size,
          description: `Oportunidade ${opp.symbol} ${opp.action} ${opp.size} encontrada nos logs mas não executada`
        });
      }
    });

    // Verificar se há trades no banco que não estão nos logs recentes
    recentDbTrades.forEach(trade => {
      const matchingOpportunity = recentOpportunities.find(opp => 
        opp.symbol === trade.symbol && 
        opp.action === trade.side &&
        Math.abs(opp.size - trade.quantity) < 0.1
      );
      
      if (!matchingOpportunity) {
        discrepancies.push({
          type: 'TRADE_NOT_IN_LOGS',
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          status: trade.status,
          description: `Trade ${trade.symbol} ${trade.side} ${trade.quantity} no banco mas não encontrada nos logs recentes`
        });
      }
    });

    console.log(`\n   🚨 Discrepâncias encontradas: ${discrepancies.length}`);
    discrepancies.forEach((disc, idx) => {
      console.log(`     ${idx + 1}. ${disc.description}`);
    });

    // 5. Análise de problemas
    console.log('\n5️⃣ ANÁLISE DE PROBLEMAS...');
    
    // Verificar se há execuções de trades nos logs
    const executionMatches = logContent.match(/🚀 Executando trade:/g);
    console.log(`   📊 Tentativas de execução nos logs: ${executionMatches ? executionMatches.length : 0}`);
    
    // Verificar erros de execução
    const errorMatches = logContent.match(/❌ Erro no ciclo de trading/g);
    console.log(`   📊 Erros no ciclo de trading: ${errorMatches ? errorMatches.length : 0}`);
    
    // Verificar se o trading está rodando
    const tradingStarted = logContent.includes('Trading Futures iniciado com sucesso');
    console.log(`   📊 Trading iniciado: ${tradingStarted ? 'Sim' : 'Não'}`);
    
    // Verificar loop principal
    const loopRunning = logContent.includes('Ciclo de trading - verificando oportunidades');
    console.log(`   📊 Loop principal rodando: ${loopRunning ? 'Sim' : 'Não'}`);

    // 6. Recomendações
    console.log('\n6️⃣ RECOMENDAÇÕES...');
    
    if (discrepancies.length > 0) {
      console.log('   🚨 PROBLEMAS IDENTIFICADOS:');
      discrepancies.forEach(disc => {
        console.log(`     - ${disc.description}`);
      });
    }
    
    if (executionMatches && executionMatches.length === 0) {
      console.log('   ⚠️ PROBLEMA CRÍTICO: Nenhuma execução de trade encontrada nos logs');
      console.log('     - Verificar se o loop principal está executando trades');
      console.log('     - Verificar se há erros impedindo a execução');
    }
    
    if (errorMatches && errorMatches.length > 0) {
      console.log('   ⚠️ PROBLEMA: Erros no ciclo de trading detectados');
      console.log('     - Verificar logs de erro para identificar causa');
      console.log('     - Verificar conectividade com APIs');
    }

    console.log('\n✅ ANÁLISE CONCLUÍDA!\n');

  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
}

analyzeTradingDiscrepancies();
