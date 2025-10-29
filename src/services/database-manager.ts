import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';

export interface DatabaseConfig {
  type: 'POSTGRESQL' | 'SQLITE' | 'MYSQL';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connection_pool_size?: number;
  connection_timeout_ms?: number;
  retry_attempts?: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price: number;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  filled_quantity: number;
  average_price: number;
  commission: number;
  commission_asset: string;
  timestamp: number;
  update_time: number;
  client_order_id: string;
  binance_order_id: string;
  pnl: number;
  pnl_percent: number;
}

export interface SignalRecord {
  id: string;
  symbol: string;
  signal_type: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  confidence: number;
  source: string;
  timestamp: number;
  executed: boolean;
  execution_price?: number;
  execution_time?: number;
  pnl?: number;
  pnl_percent?: number;
}

export interface MetricsRecord {
  id: string;
  timestamp: number;
  equity: number;
  pnl_day: number;
  pnl_total: number;
  fills_ratio: number;
  win_rate: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  max_drawdown: number;
  sharpe_ratio: number;
  selected_symbols: string[];
  notes: string;
}

export interface DatabaseStats {
  total_records: number;
  trades_count: number;
  signals_count: number;
  metrics_count: number;
  last_backup: number;
  database_size_mb: number;
  connection_status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  last_query_time: number;
  average_query_time_ms: number;
  error_count: number;
}

export class DatabaseManager {
  private config: DatabaseConfig;
  private stats: DatabaseStats;
  private isConnected: boolean = false;
  private connection: any = null;
  private retryCount: number = 0;

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      type: config?.type || 'SQLITE',
      host: config?.host || 'localhost',
      port: config?.port || 5432,
      database: config?.database || 'kronos_x.db',
      username: config?.username,
      password: config?.password,
      ssl: config?.ssl || false,
      connection_pool_size: config?.connection_pool_size || 10,
      connection_timeout_ms: config?.connection_timeout_ms || 30000,
      retry_attempts: config?.retry_attempts || 3,
    };

    this.stats = {
      total_records: 0,
      trades_count: 0,
      signals_count: 0,
      metrics_count: 0,
      last_backup: Date.now(),
      database_size_mb: 0,
      connection_status: 'DISCONNECTED',
      last_query_time: 0,
      average_query_time_ms: 0,
      error_count: 0,
    };

    info('Database Manager initialized', { config: this.config });
  }

  public async connect(): Promise<boolean> {
    try {
      if (this.isConnected) {
        return true;
      }

      info('Connecting to database', { type: this.config.type, database: this.config.database });

      if (this.config.type === 'SQLITE') {
        await this.connectSQLite();
      } else if (this.config.type === 'POSTGRESQL') {
        await this.connectPostgreSQL();
      } else if (this.config.type === 'MYSQL') {
        await this.connectMySQL();
      }

      await this.initializeTables();
      this.isConnected = true;
      this.stats.connection_status = 'CONNECTED';
      this.retryCount = 0;

      info('Database connected successfully');
      return true;

    } catch (err: any) {
      error('Database connection failed', { error: err.message });
      this.stats.connection_status = 'ERROR';
      this.stats.error_count++;
      return false;
    }
  }

  private async connectSQLite(): Promise<void> {
    // Simulate SQLite connection (in real implementation, would use sqlite3 package)
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connection = { type: 'sqlite', connected: true };
  }

  private async connectPostgreSQL(): Promise<void> {
    // Simulate PostgreSQL connection (in real implementation, would use pg package)
    await new Promise(resolve => setTimeout(resolve, 500));
    this.connection = { type: 'postgresql', connected: true };
  }

  private async connectMySQL(): Promise<void> {
    // Simulate MySQL connection (in real implementation, would use mysql2 package)
    await new Promise(resolve => setTimeout(resolve, 300));
    this.connection = { type: 'mysql', connected: true };
  }

  private async initializeTables(): Promise<void> {
    const startTime = Date.now();

    try {
      // Create trades table
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS trades (
          id VARCHAR(255) PRIMARY KEY,
          symbol VARCHAR(20) NOT NULL,
          side VARCHAR(10) NOT NULL,
          type VARCHAR(20) NOT NULL,
          quantity DECIMAL(20,8) NOT NULL,
          price DECIMAL(20,8) NOT NULL,
          status VARCHAR(20) NOT NULL,
          filled_quantity DECIMAL(20,8) DEFAULT 0,
          average_price DECIMAL(20,8),
          commission DECIMAL(20,8) DEFAULT 0,
          commission_asset VARCHAR(10),
          timestamp BIGINT NOT NULL,
          update_time BIGINT NOT NULL,
          client_order_id VARCHAR(255),
          binance_order_id VARCHAR(255),
          pnl DECIMAL(20,8) DEFAULT 0,
          pnl_percent DECIMAL(10,4) DEFAULT 0
        )
      `);

      // Create signals table
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS signals (
          id VARCHAR(255) PRIMARY KEY,
          symbol VARCHAR(20) NOT NULL,
          signal_type VARCHAR(10) NOT NULL,
          strength DECIMAL(10,6) NOT NULL,
          confidence DECIMAL(10,6) NOT NULL,
          source VARCHAR(100) NOT NULL,
          timestamp BIGINT NOT NULL,
          executed BOOLEAN DEFAULT FALSE,
          execution_price DECIMAL(20,8),
          execution_time BIGINT,
          pnl DECIMAL(20,8),
          pnl_percent DECIMAL(10,4)
        )
      `);

      // Create metrics table
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS metrics (
          id VARCHAR(255) PRIMARY KEY,
          timestamp BIGINT NOT NULL,
          equity DECIMAL(20,8) NOT NULL,
          pnl_day DECIMAL(20,8) NOT NULL,
          pnl_total DECIMAL(20,8) NOT NULL,
          fills_ratio DECIMAL(10,6) NOT NULL,
          win_rate DECIMAL(10,6) NOT NULL,
          total_trades INTEGER NOT NULL,
          winning_trades INTEGER NOT NULL,
          losing_trades INTEGER NOT NULL,
          max_drawdown DECIMAL(10,6) NOT NULL,
          sharpe_ratio DECIMAL(10,6) NOT NULL,
          selected_symbols TEXT,
          notes TEXT
        )
      `);

      // Create indexes for better performance
      await this.executeQuery('CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)');
      await this.executeQuery('CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)');
      await this.executeQuery('CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol)');
      await this.executeQuery('CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp)');
      await this.executeQuery('CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)');

      const queryTime = Date.now() - startTime;
      this.stats.last_query_time = Date.now();
      this.stats.average_query_time_ms = queryTime;

      info('Database tables initialized', { queryTime: `${queryTime}ms` });

    } catch (err: any) {
      error('Failed to initialize database tables', { error: err.message });
      throw err;
    }
  }

  private async executeQuery(query: string, params: any[] = []): Promise<any> {
    const startTime = Date.now();

    try {
      // Simulate query execution (in real implementation, would use actual database driver)
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50));

      const queryTime = Date.now() - startTime;
      this.stats.last_query_time = Date.now();
      this.stats.average_query_time_ms = 
        (this.stats.average_query_time_ms * 0.9) + (queryTime * 0.1); // Exponential moving average

      return { rows: [], rowCount: 0 };

    } catch (err: any) {
      this.stats.error_count++;
      error('Database query failed', { query: query.substring(0, 100), error: err.message });
      throw err;
    }
  }

  public async saveTrade(trade: TradeRecord): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const query = `
        INSERT INTO trades (
          id, symbol, side, type, quantity, price, status, filled_quantity,
          average_price, commission, commission_asset, timestamp, update_time,
          client_order_id, binance_order_id, pnl, pnl_percent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        trade.id, trade.symbol, trade.side, trade.type, trade.quantity, trade.price,
        trade.status, trade.filled_quantity, trade.average_price, trade.commission,
        trade.commission_asset, trade.timestamp, trade.update_time, trade.client_order_id,
        trade.binance_order_id, trade.pnl, trade.pnl_percent
      ];

      await this.executeQuery(query, params);
      this.stats.trades_count++;
      this.stats.total_records++;

      info('Trade saved to database', { id: trade.id, symbol: trade.symbol });
      return true;

    } catch (err: any) {
      error('Failed to save trade', { tradeId: trade.id, error: err.message });
      return false;
    }
  }

  public async saveSignal(signal: SignalRecord): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const query = `
        INSERT INTO signals (
          id, symbol, signal_type, strength, confidence, source, timestamp,
          executed, execution_price, execution_time, pnl, pnl_percent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        signal.id, signal.symbol, signal.signal_type, signal.strength, signal.confidence,
        signal.source, signal.timestamp, signal.executed, signal.execution_price,
        signal.execution_time, signal.pnl, signal.pnl_percent
      ];

      await this.executeQuery(query, params);
      this.stats.signals_count++;
      this.stats.total_records++;

      info('Signal saved to database', { id: signal.id, symbol: signal.symbol });
      return true;

    } catch (err: any) {
      error('Failed to save signal', { signalId: signal.id, error: err.message });
      return false;
    }
  }

  public async saveMetrics(metrics: MetricsRecord): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const query = `
        INSERT INTO metrics (
          id, timestamp, equity, pnl_day, pnl_total, fills_ratio, win_rate,
          total_trades, winning_trades, losing_trades, max_drawdown, sharpe_ratio,
          selected_symbols, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        metrics.id, metrics.timestamp, metrics.equity, metrics.pnl_day, metrics.pnl_total,
        metrics.fills_ratio, metrics.win_rate, metrics.total_trades, metrics.winning_trades,
        metrics.losing_trades, metrics.max_drawdown, metrics.sharpe_ratio,
        JSON.stringify(metrics.selected_symbols), metrics.notes
      ];

      await this.executeQuery(query, params);
      this.stats.metrics_count++;
      this.stats.total_records++;

      info('Metrics saved to database', { id: metrics.id });
      return true;

    } catch (err: any) {
      error('Failed to save metrics', { metricsId: metrics.id, error: err.message });
      return false;
    }
  }

  public async getTrades(symbol?: string, limit: number = 100): Promise<TradeRecord[]> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      let query = 'SELECT * FROM trades';
      let params: any[] = [];

      if (symbol) {
        query += ' WHERE symbol = ?';
        params.push(symbol);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const result = await this.executeQuery(query, params);
      
      // Simulate result parsing (in real implementation, would parse actual database results)
      const trades: TradeRecord[] = [];
      
      info('Trades retrieved from database', { count: trades.length, symbol });
      return trades;

    } catch (err: any) {
      error('Failed to retrieve trades', { error: err.message });
      return [];
    }
  }

  public async getSignals(symbol?: string, limit: number = 100): Promise<SignalRecord[]> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      let query = 'SELECT * FROM signals';
      let params: any[] = [];

      if (symbol) {
        query += ' WHERE symbol = ?';
        params.push(symbol);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const result = await this.executeQuery(query, params);
      
      // Simulate result parsing
      const signals: SignalRecord[] = [];
      
      info('Signals retrieved from database', { count: signals.length, symbol });
      return signals;

    } catch (err: any) {
      error('Failed to retrieve signals', { error: err.message });
      return [];
    }
  }

  public async getMetrics(limit: number = 100): Promise<MetricsRecord[]> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const query = 'SELECT * FROM metrics ORDER BY timestamp DESC LIMIT ?';
      const result = await this.executeQuery(query, [limit]);
      
      // Simulate result parsing
      const metrics: MetricsRecord[] = [];
      
      info('Metrics retrieved from database', { count: metrics.length });
      return metrics;

    } catch (err: any) {
      error('Failed to retrieve metrics', { error: err.message });
      return [];
    }
  }

  public async backup(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.stats.last_backup = Date.now();
      this.stats.database_size_mb = Math.random() * 100 + 50; // Simulate size

      info('Database backup completed', { 
        size: `${this.stats.database_size_mb.toFixed(2)}MB`,
        timestamp: new Date(this.stats.last_backup).toISOString()
      });

      return true;

    } catch (err: any) {
      error('Database backup failed', { error: err.message });
      return false;
    }
  }

  public async cleanup(daysToKeep: number = 30): Promise<number> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      // Clean up old trades
      const tradesQuery = 'DELETE FROM trades WHERE timestamp < ?';
      const tradesResult = await this.executeQuery(tradesQuery, [cutoffTime]);
      deletedCount += tradesResult.rowCount || 0;

      // Clean up old signals
      const signalsQuery = 'DELETE FROM signals WHERE timestamp < ?';
      const signalsResult = await this.executeQuery(signalsQuery, [cutoffTime]);
      deletedCount += signalsResult.rowCount || 0;

      // Clean up old metrics (keep more metrics)
      const metricsCutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
      const metricsQuery = 'DELETE FROM metrics WHERE timestamp < ?';
      const metricsResult = await this.executeQuery(metricsQuery, [metricsCutoffTime]);
      deletedCount += metricsResult.rowCount || 0;

      info('Database cleanup completed', { 
        deletedRecords: deletedCount,
        daysKept: daysToKeep
      });

      return deletedCount;

    } catch (err: any) {
      error('Database cleanup failed', { error: err.message });
      return 0;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.connection) {
        // Simulate disconnection
        this.connection = null;
      }
      
      this.isConnected = false;
      this.stats.connection_status = 'DISCONNECTED';
      
      info('Database disconnected');

    } catch (err: any) {
      error('Error disconnecting from database', { error: err.message });
    }
  }

  public getStats(): DatabaseStats {
    return { ...this.stats };
  }

  public getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  public isDatabaseConnected(): boolean {
    return this.isConnected;
  }

  public async reconnect(): Promise<boolean> {
    await this.disconnect();
    return await this.connect();
  }

  public clearStats(): void {
    this.stats = {
      total_records: 0,
      trades_count: 0,
      signals_count: 0,
      metrics_count: 0,
      last_backup: Date.now(),
      database_size_mb: 0,
      connection_status: 'DISCONNECTED',
      last_query_time: 0,
      average_query_time_ms: 0,
      error_count: 0,
    };
    info('Database stats cleared');
  }
}

export const databaseManager = new DatabaseManager();
