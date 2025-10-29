#!/usr/bin/env node

/**
 * Script para inicializar e testar o sistema de logging
 */

const { logger } = require('./src/services/logger');

async function initializeLogging() {
  console.log('🚀 Inicializando Sistema de Logging...');

  try {
    // Testar diferentes níveis de log
    logger.debug('Teste de log DEBUG', 'TEST');
    logger.info('Teste de log INFO', 'TEST');
    logger.warn('Teste de log WARN', 'TEST');
    logger.error('Teste de log ERROR', 'TEST');
    logger.critical('Teste de log CRITICAL', 'TEST');

    // Testar logs específicos
    logger.trading('Teste de log de trading', { symbol: 'BTCUSDT', price: 50000 });
    logger.binance('Teste de log da Binance', { orderId: 123456 });
    logger.supabase('Teste de log do Supabase', { table: 'real_trades' });
    logger.monitoring('Teste de log de monitoramento', { status: 'active' });
    logger.alert('Teste de log de alerta', { severity: 'HIGH' });
    logger.performance('Teste de log de performance', { winRate: 65.5 });

    // Obter estatísticas
    const stats = logger.getLogStats();
    console.log('📊 Estatísticas do Log:');
    console.log(`   Arquivo: ${stats.file}`);
    console.log(`   Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   Última modificação: ${stats.lastModified}`);
    console.log(`   Existe: ${stats.exists}`);

    // Ler últimas linhas
    const lastLines = logger.readLogs(10);
    console.log('\n📋 Últimas 10 linhas do log:');
    lastLines.forEach((line, index) => {
      if (line.trim()) {
        console.log(`${index + 1}: ${line}`);
      }
    });

    console.log('\n✅ Sistema de Logging inicializado com sucesso!');
    console.log(`📁 Logs salvos em: ${stats.file}`);

  } catch (error) {
    console.error('❌ Erro ao inicializar sistema de logging:', error);
    process.exit(1);
  }
}

// Executar inicialização
initializeLogging()
  .then(() => {
    console.log('\n🎉 Inicialização concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
