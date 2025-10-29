// ============================================================================
// API ROUTE: /api/status - STATUS GERAL DO SISTEMA
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getMetrics } from '@/services/metrics';
import { getBinanceClient } from '@/services/binance-api';
import { getWebSocketManager } from '@/services/websocket';
import { getComponentLogger, SystemComponent, SystemAction } from '@/services/logging';
import { getConfig } from '@/config';
import { tradeSimulatorEngine } from '@/services/trade-simulator-engine';
import { getAllSimulationStats } from '@/services/supabase-db';

const logger = getComponentLogger(SystemComponent.TradingEngine);

export async function GET(request: NextRequest) {
  try {
    const config = getConfig();
    const metrics = getMetrics();
    const binanceClient = getBinanceClient();
    const wsManager = getWebSocketManager();
    
    // Verifica conectividade
    const binanceConnectivity = await binanceClient.checkConnectivity();
    const wsConnected = wsManager.isConnected();
    
    // ✅ USER REQUEST: Busca saldo FUTURES ao invés de Spot
    let actualEquity = metrics.get().equity; // Valor padrão
    let futuresBalance = 0;
    
    try {
      // Buscar saldo Futures
      const futuresInfo = await binanceClient.getFuturesAccountInfo();
      futuresBalance = parseFloat(futuresInfo.totalWalletBalance || '0');
      
      if (futuresBalance > 0) {
        actualEquity = futuresBalance;
        
        // Atualiza o equity no sistema de métricas
        metrics.updateEquity(actualEquity);
        logger.info(
          SystemAction.DataProcessing,
          'Equity atualizado com saldo FUTURES da Binance',
          { equity: actualEquity, availableBalance: parseFloat(futuresInfo.availableBalance || '0') }
        );
      }
    } catch (error) {
      logger.debug(
        SystemAction.ErrorHandling,
        'Não foi possível buscar saldo Futures da Binance, usando valor padrão',
        error as Error
      );
    }
    
    // Obtém métricas (agora com equity atualizado)
    const currentMetrics = metrics.get();
    currentMetrics.equity = actualEquity; // Garante que está usando o valor real
    
    // BUSCA DADOS DO TRADE SIMULATOR
    let simulatorStats = null;
    let simulatorEquity = actualEquity;
    let simulatorPnL = 0;
    let simulatorFillRate = 0;
    let simulatorWinRate = 0;
    let simulatorTotalTrades = 0;
    let simulatorWinningTrades = 0;
    let simulatorLosingTrades = 0;
    
    try {
      // Busca stats do trade simulator
      simulatorStats = tradeSimulatorEngine.getAggregatedStats();
      
      if (simulatorStats) {
        simulatorTotalTrades = simulatorStats.totalTrades || 0;
        simulatorWinningTrades = simulatorStats.winningTrades || 0;
        simulatorLosingTrades = simulatorStats.losingTrades || 0;
        simulatorWinRate = simulatorStats.winRate || 0;
        simulatorPnL = simulatorStats.totalPnL || 0;
        simulatorFillRate = simulatorTotalTrades > 0 ? 1.0 : 0; // 100% fill rate se houver trades
        
        // Calcula equity do simulator (usando dados do banco se disponível)
        try {
          const dbStats = await getAllSimulationStats();
          if (dbStats.data && dbStats.data.length > 0) {
            // Soma o total_pnl de todas as simulações
            const totalPnLFromDB = dbStats.data.reduce((sum: number, stat: any) => {
              return sum + parseFloat(stat.total_pnl || 0);
            }, 0);
            
            simulatorEquity = actualEquity + totalPnLFromDB;
            simulatorPnL = totalPnLFromDB;
            
            // Calcula win rate do banco
            const totalTradesDB = dbStats.data.reduce((sum: number, stat: any) => sum + (stat.total_trades || 0), 0);
            const winningTradesDB = dbStats.data.reduce((sum: number, stat: any) => sum + (stat.winning_trades || 0), 0);
            
            if (totalTradesDB > 0) {
              simulatorWinRate = (winningTradesDB / totalTradesDB) * 100;
              simulatorFillRate = 1.0; // Se houver trades no banco
            }
          }
        } catch (dbError) {
          // Se não conseguir dados do banco, usa os do engine
          console.debug('Não foi possível buscar dados do banco, usando dados do engine');
        }
      }
    } catch (simError) {
      // Se não conseguir dados do simulator, mantém valores padrão
      console.debug('Não foi possível buscar dados do Trade Simulator');
    }
    
    const performanceMetrics = metrics.getPerformanceMetrics();
    const tradingMetrics = metrics.getTradingMetrics();
    const systemHealth = metrics.getSystemHealthStatus();
    
    // Obtém estatísticas do WebSocket
    const wsStats = wsManager.getStats();
    
    // Obtém estatísticas da API Binance
    const apiStats = binanceClient.getApiStats();
    
    const status = {
      status: 'running',
      engine: 'active',
      trading_status: 'enabled',
      timestamp: Date.now(),
      version: '2.0.0',
      environment: config.getEngineConfig().env,
      testnet: config.isTestnet(),
      
      // Conectividade
      connectivity: {
        binance_api: binanceConnectivity,
        websocket: wsConnected,
        database: true, // Simulado
        redis: true // Simulado
      },
      
      // Métricas principais - USANDO DADOS DO TRADE SIMULATOR
      metrics: {
        equity: simulatorEquity, // Equity do simulator (atual + lucros)
        pnl_day: simulatorPnL, // P&L total do simulator
        fills_ratio: simulatorFillRate, // Fill rate baseado em trades realizados
        selected_symbols: currentMetrics.selected_symbols.length > 0 ? currentMetrics.selected_symbols : ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'],
        notes: `Trade Simulator: ${simulatorTotalTrades} trades`
      },
      
      // Performance - USANDO DADOS DO TRADE SIMULATOR
      performance: {
        total_trades: simulatorTotalTrades || 0,
        winning_trades: simulatorWinningTrades || 0,
        losing_trades: simulatorLosingTrades || 0,
        win_rate: simulatorWinRate,
        total_pnl: simulatorPnL,
        daily_pnl: simulatorPnL, // P&L diário é o mesmo que total no nosso caso
        sharpe_ratio: performanceMetrics.sharpe_ratio,
        max_drawdown: performanceMetrics.max_drawdown
      },
      
      // Trading
      trading: {
        active_positions: tradingMetrics.active_positions,
        max_positions: tradingMetrics.max_positions,
        position_utilization: tradingMetrics.position_utilization,
        risk_exposure: tradingMetrics.risk_exposure,
        last_trade_time: tradingMetrics.last_trade_time
      },
      
      // Saúde do sistema
      system_health: {
        cpu_usage: systemHealth[0]?.metrics?.usage || 0,
        memory_usage: systemHealth[1]?.metrics?.usage || 0,
        network_latency: systemHealth[2]?.metrics?.latency || 0,
        queue_size: systemHealth[3]?.metrics?.size || 0
      },
      
      // Estatísticas WebSocket
      websocket_stats: {
        connected: wsStats.connected,
        reconnect_attempts: wsStats.reconnectAttempts,
        messages_received: wsStats.messagesReceived,
        messages_sent: wsStats.messagesSent,
        errors: wsStats.errors,
        uptime: wsStats.uptime,
        connection_state: wsManager.getConnectionState()
      },
      
      // Configurações
      configuration: {
        symbols: config.getSymbols(),
        streams: config.getStreams(),
        has_api_keys: config.hasApiKeys(),
        port: config.getPort(),
        timeout: config.getTimeout()
      },
      
      // Estatísticas da API
      api_stats: apiStats
    };

    await logger.info(
      SystemAction.PerformanceUpdate,
      'Status geral solicitado via API',
      { endpoint: '/api/status' }
    );

    return NextResponse.json({
      status: 'success',
      data: status
    });
    
  } catch (error) {
    await logger.error(
      SystemAction.ErrorHandling,
      'Erro ao obter status geral',
      error as Error,
      { endpoint: '/api/status' }
    );

    return NextResponse.json(
      {
        status: 'error',
        error: 'Erro interno do servidor',
        message: (error as Error).message,
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}
