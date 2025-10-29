// ============================================================================
// SISTEMA DE INICIALIZAÇÃO KRONOS-X ENGINE V2
// ============================================================================

import { getConfig } from './config';
import { getSystemLogger, getComponentLogger, SystemComponent, SystemAction } from './services/logging';
import { getMetrics } from './services/metrics';
import { createSignalEngineWithDefaults } from './services/signal-engine';
import { getBinanceClient } from './services/binance-api';
import { startWebSocketSystem } from './services/websocket';

// ============================================================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================================================

export async function initializeKronosXSystem(): Promise<void> {
  const logger = getComponentLogger(SystemComponent.TradingEngine);
  
  try {
    await logger.info(
      SystemAction.SystemStart,
      '🚀 Iniciando Sistema Kronos-X Engine V2',
      { version: '2.0.0', timestamp: Date.now() }
    );

    // 1. Carrega configurações
    await logger.info(SystemAction.Configuration, 'Carregando configurações...');
    const config = getConfig();
    const validation = config.validateConfig();
    
    if (!validation.valid) {
      await logger.error(
        SystemAction.Configuration,
        'Configuração inválida',
        new Error(validation.errors.join(', '))
      );
      throw new Error(`Configuração inválida: ${validation.errors.join(', ')}`);
    }

    // 2. Inicializa sistema de métricas
    await logger.info(SystemAction.SystemStart, 'Inicializando sistema de métricas...');
    const metrics = getMetrics();
    
    // Configura métricas iniciais
    metrics.update((data) => {
      data.equity = 10000.0; // Valor inicial
      data.pnl_day = 0.0;
      data.fills_ratio = 0.0;
      data.selected_symbols = config.getSymbols();
      data.notes = 'Sistema Kronos-X Engine V2 inicializado com sucesso';
    });

    // 3. Inicializa SignalEngine
    await logger.info(SystemAction.SystemStart, 'Inicializando SignalEngine...');
    const signalEngine = createSignalEngineWithDefaults();
    
    await logger.info(
      SystemAction.SystemStart,
      'SignalEngine inicializado',
      { 
        symbols: config.getSymbols(),
        streams: config.getStreams()
      }
    );

    // 4. Inicializa cliente Binance
    await logger.info(SystemAction.SystemStart, 'Inicializando cliente Binance...');
    const binanceClient = getBinanceClient();
    
    // Verifica conectividade
    const connectivity = await binanceClient.checkConnectivity();
    if (!connectivity) {
      await logger.warn(
        SystemAction.ErrorHandling,
        'Binance API não está acessível - continuando sem conectividade'
      );
    } else {
      await logger.info(SystemAction.SystemStart, 'Binance API conectada com sucesso');
    }

    // 5. Inicializa sistema WebSocket (opcional - não crítico para funcionamento básico)
    await logger.info(SystemAction.SystemStart, 'Inicializando sistema WebSocket...');
    try {
      await startWebSocketSystem();
      await logger.info(SystemAction.SystemStart, 'Sistema WebSocket iniciado com sucesso');
    } catch (error) {
      // ✅ WebSocket não é crítico - sistema pode funcionar sem ele
      await logger.warn(
        SystemAction.ErrorHandling,
        'Erro ao iniciar WebSocket - continuando sem dados em tempo real (não crítico)',
        error as Error
      );
      // Não relançar erro para não bloquear inicialização
    }

    // 6. Configura atualizações automáticas
    await logger.info(SystemAction.SystemStart, 'Configurando atualizações automáticas...');
    
    // Atualiza métricas a cada 5 segundos
    setInterval(() => {
      metrics.update((data) => {
        // Simula pequenas variações para demonstração
        data.pnl_day += (Math.random() - 0.5) * 10;
        data.fills_ratio = Math.min(data.fills_ratio + (Math.random() - 0.5) * 0.01, 0.99);
      });
    }, 5000);

    // Atualiza símbolos selecionados a cada 30 segundos
    setInterval(() => {
      const symbols = config.getSymbols();
      metrics.updateSelectedSymbols(symbols);
    }, 30000);

    // 7. Log de inicialização completa
    await logger.info(
      SystemAction.SystemStart,
      '✅ Sistema Kronos-X Engine V2 inicializado com sucesso',
      {
        version: '2.0.0',
        environment: config.getEngineConfig().env,
        testnet: config.isTestnet(),
        symbols: config.getSymbols().length,
        has_api_keys: config.hasApiKeys(),
        port: config.getPort(),
        timestamp: Date.now()
      }
    );

    console.log('🎉 Sistema Kronos-X Engine V2 está rodando!');
    console.log(`📊 Dashboard disponível em: http://localhost:${config.getPort()}`);
    console.log(`🔗 API disponível em: http://localhost:${config.getPort()}/api`);
    console.log(`📈 Métricas em tempo real: http://localhost:${config.getPort()}/api/metrics`);
    console.log(`🎯 Sinais de trading: http://localhost:${config.getPort()}/api/signals`);
    console.log(`🏥 Status de saúde: http://localhost:${config.getPort()}/api/health`);

  } catch (error) {
    await logger.critical(
      SystemAction.ErrorHandling,
      '❌ Erro crítico na inicialização do sistema',
      error as Error
    );
    
    console.error('❌ Erro na inicialização do sistema:', error);
    throw error;
  }
}

// ============================================================================
// SHUTDOWN DO SISTEMA
// ============================================================================

export async function shutdownKronosXSystem(): Promise<void> {
  const logger = getComponentLogger(SystemComponent.TradingEngine);
  
  try {
    await logger.info(SystemAction.SystemStop, '🛑 Parando Sistema Kronos-X Engine V2...');

    // Para sistema WebSocket
    try {
      const { stopWebSocketSystem } = await import('./services/websocket');
      stopWebSocketSystem();
      await logger.info(SystemAction.SystemStop, 'Sistema WebSocket parado');
    } catch (error) {
      await logger.warn(SystemAction.ErrorHandling, 'Erro ao parar WebSocket', error as Error);
    }

    // Para sistema de métricas
    try {
      const metrics = getMetrics();
      metrics.stopUpdateLoop();
      await logger.info(SystemAction.SystemStop, 'Sistema de métricas parado');
    } catch (error) {
      await logger.warn(SystemAction.ErrorHandling, 'Erro ao parar métricas', error as Error);
    }

    await logger.info(
      SystemAction.SystemStop,
      '✅ Sistema Kronos-X Engine V2 parado com sucesso',
      { timestamp: Date.now() }
    );

    console.log('👋 Sistema Kronos-X Engine V2 parado com sucesso');

  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro ao parar sistema',
      error as Error
    );
    
    console.error('❌ Erro ao parar sistema:', error);
  }
}

// ============================================================================
// VERIFICAÇÃO DE SAÚDE DO SISTEMA
// ============================================================================

export async function checkSystemHealth(): Promise<{
  status: 'healthy' | 'warning' | 'critical';
  components: Array<{
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    message: string;
  }>;
}> {
  const logger = getComponentLogger(SystemComponent.HealthMonitor);
  const components: Array<{
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    message: string;
  }> = [];

  try {
    // Verifica configuração
    const config = getConfig();
    const validation = config.validateConfig();
    
    components.push({
      name: 'Configuration',
      status: validation.valid ? 'healthy' : 'critical',
      message: validation.valid ? 'Configuração válida' : `Erros: ${validation.errors.join(', ')}`
    });

    // Verifica métricas
    try {
      const metrics = getMetrics();
      const currentMetrics = metrics.get();
      
      components.push({
        name: 'Metrics',
        status: 'healthy',
        message: `Equity: $${currentMetrics.equity.toFixed(2)}`
      });
    } catch (error) {
      components.push({
        name: 'Metrics',
        status: 'critical',
        message: `Erro: ${(error as Error).message}`
      });
    }

    // Verifica SignalEngine
    try {
      const signalEngine = createSignalEngineWithDefaults();
      const stats = signalEngine.getStats();
      
      components.push({
        name: 'SignalEngine',
        status: 'healthy',
        message: `${stats.symbols_tracked} símbolos monitorados`
      });
    } catch (error) {
      components.push({
        name: 'SignalEngine',
        status: 'critical',
        message: `Erro: ${(error as Error).message}`
      });
    }

    // Verifica Binance API
    try {
      const binanceClient = getBinanceClient();
      const connectivity = await binanceClient.checkConnectivity();
      
      components.push({
        name: 'Binance API',
        status: connectivity ? 'healthy' : 'warning',
        message: connectivity ? 'Conectado' : 'Desconectado'
      });
    } catch (error) {
      components.push({
        name: 'Binance API',
        status: 'critical',
        message: `Erro: ${(error as Error).message}`
      });
    }

    // Verifica WebSocket
    try {
      const { getWebSocketManager } = await import('./services/websocket');
      const wsManager = getWebSocketManager();
      const connected = wsManager.isConnected();
      
      components.push({
        name: 'WebSocket',
        status: connected ? 'healthy' : 'warning',
        message: connected ? 'Conectado' : 'Desconectado'
      });
    } catch (error) {
      components.push({
        name: 'WebSocket',
        status: 'critical',
        message: `Erro: ${(error as Error).message}`
      });
    }

    // Calcula status geral
    const criticalCount = components.filter(c => c.status === 'critical').length;
    const warningCount = components.filter(c => c.status === 'warning').length;
    
    const overallStatus = criticalCount > 0 ? 'critical' : 
                        warningCount > 0 ? 'warning' : 'healthy';

    await logger.info(
      SystemAction.PerformanceUpdate,
      'Verificação de saúde do sistema concluída',
      { overall_status: overallStatus, components: components.length }
    );

    return {
      status: overallStatus,
      components
    };

  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro na verificação de saúde',
      error as Error
    );

    return {
      status: 'critical',
      components: [{
        name: 'System',
        status: 'critical',
        message: `Erro geral: ${(error as Error).message}`
      }]
    };
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  initializeKronosXSystem,
  shutdownKronosXSystem,
  checkSystemHealth
};
