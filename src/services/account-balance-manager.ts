import { info, warn, error } from './logging';
import { generateUniqueId } from '../utils';
import { binanceApiClient } from './binance-api';

export interface AccountBalance {
  total_balance_usdt: number;
  available_balance_usdt: number;
  locked_balance_usdt: number;
  balances: Array<{
    asset: string;
    free: number;
    locked: number;
    total: number;
    usdt_value: number;
  }>;
  last_updated: number;
}

export interface MultiAccountSummary {
  total_balance_usdt: number;
  spot_balance: number;
  margin_balance: number;
  futures_balance: number;
  available_for_trading: number;
  reserved_amount: number;
  last_updated: number;
  accounts: Array<{
    account_type: 'SPOT' | 'MARGIN' | 'FUTURES';
    balance_usdt: number;
    available_usdt: number;
    locked_usdt: number;
  }>;
}

export interface TradingConfig {
  max_position_size_percent: number;
  risk_per_trade_percent: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  max_daily_trades: number;
  trading_enabled: boolean;
  auto_rebalance: boolean;
  rebalance_threshold_percent: number;
}

export interface BalanceAlert {
  id: string;
  type: 'LOW_BALANCE' | 'HIGH_BALANCE' | 'BALANCE_CHANGE' | 'TRADING_LIMIT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  current_balance: number;
  threshold_balance: number;
  asset?: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface AccountBalanceManagerConfig {
  refresh_interval_ms: number;
  low_balance_threshold_usdt: number;
  high_balance_threshold_usdt: number;
  balance_change_threshold_percent: number;
  max_retry_attempts: number;
  retry_delay_ms: number;
}

export class AccountBalanceManager {
  private config: AccountBalanceManagerConfig;
  private currentBalance: AccountBalance;
  private multiAccountSummary: MultiAccountSummary;
  private tradingConfig: TradingConfig;
  private alerts: BalanceAlert[] = [];
  private refreshInterval: NodeJS.Timeout | null = null;
  private lastBalance: AccountBalance | null = null;
  private isRefreshing: boolean = false;

  constructor(config?: Partial<AccountBalanceManagerConfig>) {
    this.config = {
      refresh_interval_ms: config?.refresh_interval_ms || 30000, // 30 seconds
      low_balance_threshold_usdt: config?.low_balance_threshold_usdt || 100,
      high_balance_threshold_usdt: config?.high_balance_threshold_usdt || 50000,
      balance_change_threshold_percent: config?.balance_change_threshold_percent || 5,
      max_retry_attempts: config?.max_retry_attempts || 3,
      retry_delay_ms: config?.retry_delay_ms || 1000,
    };

    this.currentBalance = {
      total_balance_usdt: 0,
      available_balance_usdt: 0,
      locked_balance_usdt: 0,
      balances: [],
      last_updated: Date.now(),
    };

    this.multiAccountSummary = {
      total_balance_usdt: 0,
      spot_balance: 0,
      margin_balance: 0,
      futures_balance: 0,
      available_for_trading: 0,
      reserved_amount: 0,
      last_updated: Date.now(),
      accounts: [],
    };

    this.tradingConfig = {
      max_position_size_percent: 0.1, // 10%
      risk_per_trade_percent: 0.02, // 2%
      stop_loss_percent: 0.01, // 1%
      take_profit_percent: 0.02, // 2%
      max_daily_trades: 50,
      trading_enabled: true,
      auto_rebalance: false,
      rebalance_threshold_percent: 0.05, // 5%
    };

    info('Account Balance Manager initialized', { config: this.config });
    this.startAutoRefresh();
  }

  public updateConfig(newConfig: Partial<AccountBalanceManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    info('Account Balance Manager config updated', { newConfig });
  }

  public async loadAccountBalance(): Promise<AccountBalance> {
    try {
      const accountInfo = await binanceApiClient.getAccountInfo();
      
      if (!accountInfo || !accountInfo.balances) {
        throw new Error('Failed to get account info from Binance');
      }

      const balances = accountInfo.balances
        .filter((balance: any) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
        .map((balance: any) => {
          const free = parseFloat(balance.free);
          const locked = parseFloat(balance.locked);
          const total = free + locked;
          
          // Calculate USDT value (simplified - would need real-time prices)
          const usdtValue = this.calculateUSDTValue(balance.asset, total);
          
          return {
            asset: balance.asset,
            free,
            locked,
            total,
            usdt_value: usdtValue,
          };
        });

      const totalBalanceUsdt = balances.reduce((sum: number, bal: any) => sum + bal.usdt_value, 0);
      const availableBalanceUsdt = balances.reduce((sum: number, bal: any) => sum + (bal.free * this.getAssetPrice(bal.asset)), 0);
      const lockedBalanceUsdt = totalBalanceUsdt - availableBalanceUsdt;

      this.currentBalance = {
        total_balance_usdt: totalBalanceUsdt,
        available_balance_usdt: availableBalanceUsdt,
        locked_balance_usdt: lockedBalanceUsdt,
        balances,
        last_updated: Date.now(),
      };

      // Check for balance changes and generate alerts
      this.checkBalanceChanges();

      info(`Account balance loaded`, {
        totalBalance: totalBalanceUsdt.toFixed(2),
        availableBalance: availableBalanceUsdt.toFixed(2),
        lockedBalance: lockedBalanceUsdt.toFixed(2),
        assetCount: balances.length,
      });

      return this.currentBalance;

    } catch (err: any) {
      error(`Failed to load account balance`, { error: err.message });
      throw err;
    }
  }

  public async refreshBalance(): Promise<AccountBalance> {
    if (this.isRefreshing) {
      warn('Balance refresh already in progress');
      return this.currentBalance;
    }

    this.isRefreshing = true;

    try {
      const balance = await this.loadAccountBalance();
      this.lastBalance = { ...this.currentBalance };
      return balance;
    } finally {
      this.isRefreshing = false;
    }
  }

  private calculateUSDTValue(asset: string, amount: number): number {
    // Simplified USDT value calculation
    // In reality, would fetch real-time prices from Binance API
    const prices: Record<string, number> = {
      'BTC': 50000,
      'ETH': 3000,
      'BNB': 300,
      'USDT': 1,
      'USDC': 1,
      'BUSD': 1,
    };

    return amount * (prices[asset] || 0);
  }

  private getAssetPrice(asset: string): number {
    const prices: Record<string, number> = {
      'BTC': 50000,
      'ETH': 3000,
      'BNB': 300,
      'USDT': 1,
      'USDC': 1,
      'BUSD': 1,
    };

    return prices[asset] || 0;
  }

  private checkBalanceChanges(): void {
    if (!this.lastBalance) {
      this.lastBalance = { ...this.currentBalance };
      return;
    }

    // Check total balance change
    const balanceChangePercent = Math.abs(
      (this.currentBalance.total_balance_usdt - this.lastBalance.total_balance_usdt) / 
      this.lastBalance.total_balance_usdt
    ) * 100;

    if (balanceChangePercent > this.config.balance_change_threshold_percent) {
      this.addAlert({
        type: 'BALANCE_CHANGE',
        severity: balanceChangePercent > 10 ? 'HIGH' : 'MEDIUM',
        message: `Significant balance change detected: ${balanceChangePercent.toFixed(2)}%`,
        current_balance: this.currentBalance.total_balance_usdt,
        threshold_balance: this.lastBalance.total_balance_usdt,
      });
    }

    // Check low balance
    if (this.currentBalance.available_balance_usdt < this.config.low_balance_threshold_usdt) {
      this.addAlert({
        type: 'LOW_BALANCE',
        severity: 'CRITICAL',
        message: `Low available balance: $${this.currentBalance.available_balance_usdt.toFixed(2)}`,
        current_balance: this.currentBalance.available_balance_usdt,
        threshold_balance: this.config.low_balance_threshold_usdt,
      });
    }

    // Check high balance
    if (this.currentBalance.total_balance_usdt > this.config.high_balance_threshold_usdt) {
      this.addAlert({
        type: 'HIGH_BALANCE',
        severity: 'LOW',
        message: `High total balance: $${this.currentBalance.total_balance_usdt.toFixed(2)}`,
        current_balance: this.currentBalance.total_balance_usdt,
        threshold_balance: this.config.high_balance_threshold_usdt,
      });
    }

    this.lastBalance = { ...this.currentBalance };
  }

  private addAlert(alert: Omit<BalanceAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const newAlert: BalanceAlert = {
      id: generateUniqueId(),
      timestamp: Date.now(),
      acknowledged: false,
      ...alert,
    };

    this.alerts.unshift(newAlert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(0, 1000);
    }

    info(`Balance alert generated`, {
      type: newAlert.type,
      severity: newAlert.severity,
      message: newAlert.message,
    });
  }

  public async loadAllAccounts(): Promise<MultiAccountSummary> {
    try {
      // Load spot account
      const spotBalance = await this.loadAccountBalance();
      
      // In a real implementation, would also load margin and futures accounts
      // For now, simulate with spot data
      const marginBalance = spotBalance.total_balance_usdt * 0.1; // 10% in margin
      const futuresBalance = spotBalance.total_balance_usdt * 0.05; // 5% in futures
      
      const totalBalance = spotBalance.total_balance_usdt + marginBalance + futuresBalance;
      const availableForTrading = spotBalance.available_balance_usdt;
      const reservedAmount = spotBalance.locked_balance_usdt;

      this.multiAccountSummary = {
        total_balance_usdt: totalBalance,
        spot_balance: spotBalance.total_balance_usdt,
        margin_balance: marginBalance,
        futures_balance: futuresBalance,
        available_for_trading: availableForTrading,
        reserved_amount: reservedAmount,
        last_updated: Date.now(),
        accounts: [
          {
            account_type: 'SPOT',
            balance_usdt: spotBalance.total_balance_usdt,
            available_usdt: spotBalance.available_balance_usdt,
            locked_usdt: spotBalance.locked_balance_usdt,
          },
          {
            account_type: 'MARGIN',
            balance_usdt: marginBalance,
            available_usdt: marginBalance * 0.8,
            locked_usdt: marginBalance * 0.2,
          },
          {
            account_type: 'FUTURES',
            balance_usdt: futuresBalance,
            available_usdt: futuresBalance * 0.9,
            locked_usdt: futuresBalance * 0.1,
          },
        ],
      };

      info(`Multi-account summary loaded`, {
        totalBalance: totalBalance.toFixed(2),
        spotBalance: spotBalance.total_balance_usdt.toFixed(2),
        marginBalance: marginBalance.toFixed(2),
        futuresBalance: futuresBalance.toFixed(2),
      });

      return this.multiAccountSummary;

    } catch (err: any) {
      error(`Failed to load multi-account summary`, { error: err.message });
      throw err;
    }
  }

  public getCurrentBalance(): AccountBalance {
    return { ...this.currentBalance };
  }

  public getMultiAccountSummary(): MultiAccountSummary {
    return { ...this.multiAccountSummary };
  }

  public getTradingConfig(): TradingConfig {
    return { ...this.tradingConfig };
  }

  public updateTradingConfig(newConfig: Partial<TradingConfig>): void {
    this.tradingConfig = { ...this.tradingConfig, ...newConfig };
    info('Trading config updated', { newConfig });
  }

  public getAlerts(limit?: number): BalanceAlert[] {
    return limit ? this.alerts.slice(0, limit) : this.alerts;
  }

  public getUnacknowledgedAlerts(): BalanceAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      info(`Alert acknowledged`, { alertId });
      return true;
    }
    return false;
  }

  public calculatePositionSize(symbol: string, riskPercent?: number): number {
    const risk = riskPercent || this.tradingConfig.risk_per_trade_percent;
    const availableBalance = this.currentBalance.available_balance_usdt;
    const maxPositionSize = availableBalance * this.tradingConfig.max_position_size_percent;
    const riskBasedSize = availableBalance * risk;

    return Math.min(maxPositionSize, riskBasedSize);
  }

  public canPlaceTrade(symbol: string, quantity: number, price: number): boolean {
    const tradeValue = quantity * price;
    const availableBalance = this.currentBalance.available_balance_usdt;

    // Check if enough balance
    if (tradeValue > availableBalance) {
      return false;
    }

    // Check position size limit
    const maxPositionSize = availableBalance * this.tradingConfig.max_position_size_percent;
    if (tradeValue > maxPositionSize) {
      return false;
    }

    return true;
  }

  public getBalanceForAsset(asset: string): number {
    const balance = this.currentBalance.balances.find(b => b.asset === asset);
    return balance ? balance.total : 0;
  }

  public getAvailableBalanceForAsset(asset: string): number {
    const balance = this.currentBalance.balances.find(b => b.asset === asset);
    return balance ? balance.free : 0;
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshBalance();
      } catch (err: any) {
        error(`Auto refresh failed`, { error: err.message });
      }
    }, this.config.refresh_interval_ms);

    info('Auto refresh started', { intervalMs: this.config.refresh_interval_ms });
  }

  public stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    info('Auto refresh stopped');
  }

  public clearData(): void {
    this.currentBalance = {
      total_balance_usdt: 0,
      available_balance_usdt: 0,
      locked_balance_usdt: 0,
      balances: [],
      last_updated: Date.now(),
    };

    this.multiAccountSummary = {
      total_balance_usdt: 0,
      spot_balance: 0,
      margin_balance: 0,
      futures_balance: 0,
      available_for_trading: 0,
      reserved_amount: 0,
      last_updated: Date.now(),
      accounts: [],
    };

    this.alerts = [];
    this.lastBalance = null;

    info('Account Balance Manager data cleared');
  }
}

export const accountBalanceManager = new AccountBalanceManager();
