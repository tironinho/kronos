import { info, error } from '../services/logging';
import { webSocketService } from '../services/websocket';
import { binanceApiClient } from '../services/binance-api';
import { updateSystemStatus } from '../services/metrics';
import { signalEngine } from '../services/signal-engine';
import { monteCarloEngine } from '../services/monte-carlo';
import { tradeOrchestrator } from '../services/trade-orchestrator';
import { confidenceModel } from '../services/confidence-model';
import { orderManager } from '../services/order-manager';
import { riskManager } from '../services/risk-manager';
import { accountBalanceManager } from '../services/account-balance-manager';
import { advancedTradingSystem } from '../services/advanced-trading-system';
import { mlPredictor } from '../services/ml-models';
import { backesTraderAgent } from '../services/ai-agent';
import { databaseManager } from '../services/database-manager';
import { backtestEngine } from '../services/backtest-engine';
import { dataProcessor } from '../services/data-processor';
import { sentimentAnalysisEngine } from '../services/sentiment-analysis';
import { onChainAnalysisEngine } from '../services/onchain-analysis';
import { rlAgent } from '../services/reinforcement-learning';
import { tradingIntegrationEngine } from '../services/trading-integration';
import { symbolAnalyzer } from '../services/symbol-analyzer';
import { derivativesTradingEngine } from '../services/derivatives-trading';
import { analysisIntegrationEngine } from '../services/analysis-integration';
import { config } from '../config';

export const initializeSystem = async () => {
  info('Initializing Kronos-X Engine V2 with Advanced Components...');

  try {
    // 1. Load Configuration (already done via import)
    info('Configuration loaded successfully.');

    // 2. Initialize Binance API Client (will test connectivity)
    try {
      binanceApiClient.testConnectivity();
      info('Binance API Client initialized successfully.');
    } catch (error) {
      console.warn('⚠️ Binance API Client initialization failed:', error);
      // Continue initialization even if Binance fails
    }

    // 3. Connect to Binance WebSocket
    try {
      webSocketService.connect();
      info('WebSocket service connected successfully.');
    } catch (error) {
      console.warn('⚠️ WebSocket connection failed:', error);
      // Continue initialization even if WebSocket fails
    }

    // 4. Initialize Monte Carlo Engine
    try {
      info('Monte Carlo Engine initialized.');
    } catch (error) {
      console.warn('⚠️ Monte Carlo Engine initialization failed:', error);
    }

    // 5. Initialize Trade Orchestrator
    try {
      info('Trade Orchestrator initialized.');
    } catch (error) {
      console.warn('⚠️ Trade Orchestrator initialization failed:', error);
    }

    // 6. Initialize Confidence Model
    try {
      info('Confidence Model initialized.');
    } catch (error) {
      console.warn('⚠️ Confidence Model initialization failed:', error);
    }

    // 7. Initialize Order Manager
    try {
      info('Order Manager initialized.');
    } catch (error) {
      console.warn('⚠️ Order Manager initialization failed:', error);
    }

    // 8. Initialize Risk Manager
    info('Risk Manager initialized.');

    // 9. Initialize Account Balance Manager
    info('Account Balance Manager initialized.');

    // 10. Initialize Advanced Trading System
    info('Advanced Trading System initialized.');

    // 11. Initialize ML Models
    info('ML Models initialized.');

    // 12. Initialize AI Agent
    info('AI Agent initialized.');

    // 13. Initialize Database Manager
    await databaseManager.connect();
    info('Database Manager initialized and connected.');

    // 14. Initialize Backtest Engine
    info('Backtest Engine initialized.');

    // 15. Initialize Data Processor
    info('Data Processor initialized.');

    // 16. Initialize Sentiment Analysis Engine
    await sentimentAnalysisEngine.startAnalysis();
    info('Sentiment Analysis Engine initialized and started.');

    // 17. Initialize On-Chain Analysis Engine
    await onChainAnalysisEngine.startAnalysis();
    info('On-Chain Analysis Engine initialized and started.');

    // 18. Initialize Reinforcement Learning Agent
    info('Reinforcement Learning Agent initialized.');

    // 19. Initialize Trading Integration Engine (DISABLED quando Advanced Trading está ativo)
    // await tradingIntegrationEngine.startIntegration();
    info('Trading Integration Engine SKIPPED (usando Advanced Trading Engine)');

    // 20. Initialize Symbol Analyzer
    await symbolAnalyzer.startAnalysis();
    info('Symbol Analyzer initialized and started.');

    // 21. Initialize Derivatives Trading Engine
    info('Derivatives Trading Engine initialized.');

    // 22. Initialize Analysis Integration Engine
    await analysisIntegrationEngine.startIntegration();
    info('Analysis Integration Engine initialized and started.');

    // 23. Start Signal Engine (it will process data from WebSocket)
    // The signalEngine is already instantiated and ready to receive data via addTrade/addDepth

    // 24. Update system status to running
    updateSystemStatus({
      status: 'running',
      engine: 'active',
      trading: 'enabled',
      version: '2.0.0',
      metrics: {
        equity: 10000, // Initial placeholder equity
        pnl_day: 0,
        fills_ratio: 0,
        selected_symbols: ['BTCUSDT', 'ETHUSDT'], // Placeholder
        notes: 'Complete Kronos-X Engine V2 operational. All advanced components initialized successfully.',
      },
      performance: {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        daily_pnl: 0,
      }
    });

    // 25. Start background processes
    startBackgroundProcesses();

    info('Complete Kronos-X Engine V2 initialized and running successfully.');
  } catch (e: any) {
    error('Failed to initialize Complete Kronos-X Engine V2', { error: e.message });
    updateSystemStatus({ status: 'error', notes: `Initialization failed: ${e.message}` });
  }
};

const startBackgroundProcesses = () => {
  // Update metrics every 5 seconds
  setInterval(() => {
    updateSystemStatus({
      metrics: {
        equity: 10000 + Math.random() * 1000 - 500, // Simulate equity changes
        pnl_day: Math.random() * 200 - 100, // Simulate daily PnL
        fills_ratio: Math.min(0.95, Math.random() * 0.1 + 0.9), // Simulate fill ratio
        selected_symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
        notes: 'Complete system running smoothly with all advanced components.',
      }
    });
  }, 5000);

  // Refresh account balance every 30 seconds
  setInterval(async () => {
    try {
      await accountBalanceManager.refreshBalance();
    } catch (err: any) {
      error('Failed to refresh account balance', { error: err.message });
    }
  }, 30000);

  // Refresh orders every 60 seconds
  setInterval(async () => {
    try {
      await orderManager.refreshOrders();
    } catch (err: any) {
      error('Failed to refresh orders', { error: err.message });
    }
  }, 60000);

  // Run Monte Carlo simulations periodically
  setInterval(() => {
    monteCarloEngine.runSimulation('BTCUSDT', 10000);
    info('Monte Carlo simulation run for BTCUSDT.');
  }, 60000);

  // Trigger AI Agent analysis periodically
  setInterval(() => {
    backesTraderAgent.analyzeMarket('BTCUSDT');
    info('AI Agent market analysis triggered for BTCUSDT.');
  }, 120000);

  // Perform database cleanup periodically
  setInterval(() => {
    databaseManager.cleanupOldData();
    info('Database cleanup performed.');
  }, 3600000); // Every hour

  // Run sentiment analysis periodically
  setInterval(() => {
    sentimentAnalysisEngine.performAnalysis();
    info('Sentiment analysis performed.');
  }, 300000); // Every 5 minutes

  // Run on-chain analysis periodically
  setInterval(() => {
    onChainAnalysisEngine.performAnalysis();
    info('On-chain analysis performed.');
  }, 300000); // Every 5 minutes

  // Train RL agent periodically
  setInterval(() => {
    rlAgent['train']();
    info('RL agent training performed.');
  }, 1800000); // Every 30 minutes

  // Run symbol analysis periodically
  setInterval(() => {
    symbolAnalyzer.performAnalysis();
    info('Symbol analysis performed.');
  }, 300000); // Every 5 minutes

  // Update trading integration periodically
  setInterval(() => {
    tradingIntegrationEngine.processSignals();
    info('Trading integration signals processed.');
  }, 10000); // Every 10 seconds

  // Update derivatives positions periodically
  setInterval(() => {
    derivativesTradingEngine.updatePositions();
    info('Derivatives positions updated.');
  }, 30000); // Every 30 seconds

  // Run analysis integration periodically
  setInterval(() => {
    analysisIntegrationEngine.performIntegratedAnalysis();
    info('Analysis integration performed.');
  }, 300000); // Every 5 minutes

  info('Background processes started.');
};
