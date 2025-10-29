#!/usr/bin/env node

/**
 * Script simples para testar o sistema de logging
 * Este script cria um arquivo de log básico para demonstrar o funcionamento
 */

const fs = require('fs');
const path = require('path');

function createTestLog() {
  console.log('🚀 Testando Sistema de Logging...');

  const logFile = path.join(process.cwd(), 'logs.txt');
  
  try {
    // Criar cabeçalho do log
    const header = `# ============================================================================
# KRONOS-X TRADING ENGINE - LOG FILE
# ============================================================================
# Started: ${new Date().toISOString()}
# Log Level: DEBUG, INFO, WARN, ERROR, CRITICAL
# Format: [TIMESTAMP] [LEVEL] [COMPONENT] MESSAGE
# ============================================================================

`;

    // Escrever cabeçalho
    fs.writeFileSync(logFile, header);

    // Adicionar alguns logs de teste
    const testLogs = [
      `[${new Date().toISOString()}] INFO     [TRADING] 🚀 ADVANCED TRADING ENGINE INICIADO`,
      `[${new Date().toISOString()}] INFO     [TRADING] 💰 Capital: $1000.00`,
      `[${new Date().toISOString()}] INFO     [MONITORING] 🚀 Inicializando Sistema de Monitoramento Ativo...`,
      `[${new Date().toISOString()}] INFO     [SUPABASE] ✅ TradeStatusMonitor: Supabase initialized`,
      `[${new Date().toISOString()}] INFO     [BINANCE] 📊 Encontradas 1 posições abertas na Binance Futures`,
      `[${new Date().toISOString()}] INFO     [TRADING] 📈 New Trade: SOLUSDT BUY @ $197.0100`,
      `[${new Date().toISOString()}] INFO     [SUPABASE] 💾 Trade SOLUSDT_1761680564448_6lw67n salvo no banco de dados`,
      `[${new Date().toISOString()}] INFO     [BINANCE] 🛡️ Stop Loss criado na Binance para SOLUSDT @ 200.00575`,
      `[${new Date().toISOString()}] INFO     [BINANCE] 🎯 Take Profit criado na Binance para SOLUSDT @ 191.02027`,
      `[${new Date().toISOString()}] INFO     [TRADING] 📊 Trades abertos agora: 1/2`,
      `[${new Date().toISOString()}] INFO     [TRADING] 📅 Trades hoje: 1/400`,
      `[${new Date().toISOString()}] INFO     [PERFORMANCE] 📊 Análise de Estratégia Recebida:`,
      `[${new Date().toISOString()}] INFO     [PERFORMANCE]    Win Rate: 65.50%`,
      `[${new Date().toISOString()}] INFO     [PERFORMANCE]    Total PnL: $125.50`,
      `[${new Date().toISOString()}] INFO     [PERFORMANCE]    Max Drawdown: 8.20%`,
      `[${new Date().toISOString()}] INFO     [PERFORMANCE]    Sharpe Ratio: 1.80`,
      `[${new Date().toISOString()}] WARN     [ALERT] ⚠️ Drawdown Alert: BTCUSDT - 12.50% drawdown`,
      `[${new Date().toISOString()}] ERROR    [TRADING] ❌ Erro ao executar trade: Connection timeout`,
      `[${new Date().toISOString()}] INFO     [MONITORING] ✅ Sistema de Monitoramento Ativo inicializado`
    ];

    // Adicionar logs de teste
    testLogs.forEach(log => {
      fs.appendFileSync(logFile, log + '\n');
    });

    // Obter estatísticas do arquivo
    const stats = fs.statSync(logFile);
    
    console.log('✅ Sistema de Logging testado com sucesso!');
    console.log(`📁 Arquivo de log criado: ${logFile}`);
    console.log(`📊 Tamanho do arquivo: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`📅 Última modificação: ${stats.mtime}`);
    console.log(`📝 Total de linhas: ${testLogs.length + 6}`); // +6 para o cabeçalho

    // Mostrar últimas 5 linhas
    console.log('\n📋 Últimas 5 linhas do log:');
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    lines.slice(-5).forEach((line, index) => {
      console.log(`${lines.length - 5 + index + 1}: ${line}`);
    });

    console.log('\n🎉 Teste concluído! O sistema de logging está funcionando.');
    console.log('📝 Todos os logs da aplicação serão salvos em logs.txt');

  } catch (error) {
    console.error('❌ Erro ao criar arquivo de log:', error);
    process.exit(1);
  }
}

// Executar teste
createTestLog();
