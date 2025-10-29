'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Activity, 
  Settings, 
  TrendingUp, 
  Brain, 
  Database, 
  Zap, 
  Shield,
  Play,
  Square,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Wallet,
  TrendingDown,
  Eye,
  EyeOff
} from 'lucide-react';
import MonteCarloMonitor from '../components/MonteCarloMonitor';
import TradeOrchestratorMonitor from '../components/TradeOrchestratorMonitor';
import SystemLogs from '../components/SystemLogs';
import TradeSimulator from '../components/TradeSimulator';
import TradeControl from '../components/TradeControl';
import RealTimeMonitoringDashboard from '../components/RealTimeMonitoringDashboard';

interface SystemStatus {
  status: string;
  engine: string;
  trading: string;
  timestamp: number;
  version: string;
  connectivity: {
    binance_api: boolean;
    websocket: boolean;
    database: boolean;
    redis: boolean;
  };
  metrics: {
    equity: number;
    pnl_day: number;
    fills_ratio: number;
    selected_symbols: string[];
    notes: string;
  };
  performance: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    total_pnl: number;
    daily_pnl: number;
  };
}

interface BalanceData {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

interface BinanceBalance {
  balances: BalanceData[];
  totalBalance: number;
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
}

interface TabConfig {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
}

  const tabs: TabConfig[] = [
    { id: 'overview', name: 'Overview', icon: BarChart3, color: 'text-blue-600' },
    { id: 'trading', name: 'Trading', icon: TrendingUp, color: 'text-green-600' },
    { id: 'monitoring', name: 'Monitoramento', icon: AlertTriangle, color: 'text-red-600' },
    { id: 'trade-simulator', name: 'Trade Simulator', icon: Activity, color: 'text-green-600' },
    { id: 'monte-carlo', name: 'Monte Carlo', icon: Activity, color: 'text-purple-600' },
    { id: 'orchestrator', name: 'Orchestrator', icon: Zap, color: 'text-yellow-600' },
    { id: 'test', name: 'Testes', icon: Activity, color: 'text-orange-600' },
    { id: 'ai-agent', name: 'AI Agent', icon: Brain, color: 'text-pink-600' },
    { id: 'logs', name: 'Logs', icon: Database, color: 'text-gray-600' },
    { id: 'settings', name: 'Settings', icon: Settings, color: 'text-indigo-600' },
];

export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const [engineStatus, setEngineStatus] = useState<'stopped' | 'starting' | 'running' | 'stopping'>('stopped');
  const [binanceBalance, setBinanceBalance] = useState<BinanceBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showFullBalance, setShowFullBalance] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.status === 'success') {
          setStatus(prevStatus => {
            // Evitar atualizações desnecessárias durante hot reload
            if (JSON.stringify(prevStatus) === JSON.stringify(data.data)) {
              return prevStatus;
            }
            return data.data;
          });
          setIsEngineRunning(data.data.status === 'running');
          setEngineStatus(data.data.status as any);
        } else {
          setError(data.message || 'Erro ao carregar status');
        }
      } catch (err) {
        setError('Erro de conexão com o servidor');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    
    // Atualiza status a cada 5 segundos
    const interval = setInterval(fetchStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setBalanceLoading(true);
        const response = await fetch('/api/binance/balance');
        const data = await response.json();
        
        if (data.status === 'success') {
          setBinanceBalance(prevBalance => {
            // Evitar atualizações desnecessárias durante hot reload
            if (JSON.stringify(prevBalance) === JSON.stringify(data.data)) {
              return prevBalance;
            }
            return data.data;
          });
          setLastUpdate(new Date());
        }
      } catch (err) {
        console.error('Erro ao carregar saldo:', err);
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchBalance();
    // Atualiza saldo a cada 30 segundos
    const interval = setInterval(fetchBalance, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const refreshBalance = async () => {
    setBalanceLoading(true);
    try {
      const response = await fetch('/api/binance/balance');
      const data = await response.json();
      
      if (data.status === 'success') {
        setBinanceBalance(data.data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Erro ao atualizar saldo:', err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const startEngine = async () => {
    setEngineStatus('starting');
    try {
      const response = await fetch('/api/engine/start', { method: 'POST' });
      if (response.ok) {
        setIsEngineRunning(true);
        setEngineStatus('running');
      }
    } catch (error) {
      console.error('Erro ao iniciar engine:', error);
      setEngineStatus('stopped');
    }
  };

  const stopEngine = async () => {
    setEngineStatus('stopping');
    try {
      const response = await fetch('/api/engine/stop', { method: 'POST' });
      if (response.ok) {
        setIsEngineRunning(false);
        setEngineStatus('stopped');
      }
    } catch (error) {
      console.error('Erro ao parar engine:', error);
      setEngineStatus('stopped');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'stopped':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'starting':
        return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'stopping':
        return <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'stopped':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'starting':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'stopping':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '$0.00';
    }
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Carregando sistema Kronos-X...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-800 mb-2">Erro no Sistema</h1>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100">
      {/* Header Fixo com Controles */}
      <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo e Título */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">K</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Kronos-X Engine V2</h1>
                <p className="text-xs text-gray-500">Sistema de Trading Avançado</p>
              </div>
            </div>
            
            {/* Controles Principais */}
            <div className="flex items-center space-x-4">
              {/* Botão Refresh Saldo */}
              <button
                onClick={refreshBalance}
                disabled={balanceLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Atualizar Saldo</span>
              </button>

              {/* Status do Engine */}
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 ${getStatusColor(engineStatus)}`}>
                {getStatusIcon(engineStatus)}
                <span className="text-sm font-semibold capitalize">{engineStatus}</span>
              </div>
              
              {/* Controles do Engine */}
              <div className="flex space-x-2">
                {!isEngineRunning ? (
                  <button
                    onClick={startEngine}
                    disabled={engineStatus === 'starting'}
                    className="flex items-center space-x-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md font-semibold"
                  >
                    <Play className="w-4 h-4" />
                    <span>Start</span>
                  </button>
                ) : (
                  <button
                    onClick={stopEngine}
                    disabled={engineStatus === 'stopping'}
                    className="flex items-center space-x-2 px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md font-semibold"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div className="flex space-x-1 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-b from-blue-50 to-blue-100 text-blue-700 border-t-2 border-blue-600 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Saldo da Binance - Card Destaque */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-xl p-6 mb-8 text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Wallet className="w-6 h-6" />
                <h2 className="text-xl font-bold">Saldo Binance</h2>
              </div>
              <p className="text-green-100 text-sm">Última atualização: {formatTime(lastUpdate)}</p>
            </div>
            <button
              onClick={() => setShowFullBalance(!showFullBalance)}
              className="p-2 hover:bg-green-600 rounded-lg transition-colors"
            >
              {showFullBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {balanceLoading ? (
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-lg">Carregando saldo...</span>
            </div>
          ) : binanceBalance ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <p className="text-green-100 text-sm mb-1">Total Balance</p>
                  <p className="text-3xl font-bold">{formatCurrency(binanceBalance.totalBalance)}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <p className="text-green-100 text-sm mb-1">Ativos</p>
                  <p className="text-3xl font-bold">{binanceBalance.balances?.length || 0}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <p className="text-green-100 text-sm mb-1">Status</p>
                  <p className="text-2xl font-bold">{binanceBalance.canTrade ? '✅ Ativo' : '❌ Bloqueado'}</p>
                </div>
              </div>

              {showFullBalance && binanceBalance.balances && binanceBalance.balances.length > 0 && (
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
                  <p className="text-green-100 text-sm mb-3 font-semibold">Detalhes dos Saldos:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                    {binanceBalance.balances?.map((bal, idx) => (
                      <div key={idx} className="bg-white/5 rounded p-2">
                        <p className="text-green-100 text-xs font-medium">{bal.asset}</p>
                        <p className="text-white text-lg font-bold">{(bal.total || 0).toFixed(4)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-lg">⚠️ Configure suas chaves da API da Binance para ver o saldo</p>
          )}
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-500 rounded-lg flex items-center justify-center shadow-md">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">Equity</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              ${(status?.metrics?.equity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-gray-600">Saldo total investido</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg flex items-center justify-center shadow-md">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className={`text-xs px-2 py-1 rounded font-semibold ${(status?.metrics.pnl_day || 0) >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                PnL Diário
              </span>
            </div>
            <p className={`text-3xl font-bold mb-1 ${(status?.metrics.pnl_day || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${(status?.metrics?.pnl_day || 0).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">
              {status?.performance.total_pnl ? `${status.performance.total_pnl >= 0 ? '+' : ''}$${status.performance.total_pnl.toFixed(2)} total` : 'Sem dados'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-500 rounded-lg flex items-center justify-center shadow-md">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">Fill Rate</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {(status?.metrics.fills_ratio ? status.metrics.fills_ratio * 100 : 0).toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600">Taxa de preenchimento</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center shadow-md">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">Win Rate</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {(status?.performance?.win_rate || 0).toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600">
              {status?.performance?.total_trades ? `${status.performance.winning_trades || 0}W / ${status.performance.losing_trades || 0}L` : 'Sem trades'}
            </p>
          </div>
        </div>

        {/* Conteúdo da Aba Ativa */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">📊 Overview do Sistema</h2>
                
                {/* Status de Conectividade */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <span>Status de Conectividade</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Binance API', status: status?.connectivity.binance_api },
                      { label: 'WebSocket', status: status?.connectivity.websocket },
                      { label: 'Database', status: status?.connectivity.database },
                      { label: 'Redis', status: status?.connectivity.redis },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center space-x-2 bg-gray-50 rounded-lg p-3">
                        {item.status ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Símbolos Selecionados */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <span>Símbolos Ativos</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {status?.metrics.selected_symbols.map((symbol) => (
                      <span
                        key={symbol}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-sm font-semibold shadow-md"
                      >
                        {symbol}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Performance Detalhada */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-yellow-600" />
                    <span>Performance Detalhada</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                      <p className="text-4xl font-bold text-blue-600 mb-2">{status?.performance.total_trades || 0}</p>
                      <p className="text-sm font-semibold text-gray-700">Total Trades</p>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                      <p className="text-4xl font-bold text-green-600 mb-2">{status?.performance.winning_trades || 0}</p>
                      <p className="text-sm font-semibold text-gray-700">Trades Vencedores</p>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200">
                      <p className="text-4xl font-bold text-red-600 mb-2">{status?.performance.losing_trades || 0}</p>
                      <p className="text-sm font-semibold text-gray-700">Trades Perdedores</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trading' && (
              <TradeControl 
                isEngineRunning={isEngineRunning}
                onToggleEngine={isEngineRunning ? stopEngine : startEngine}
              />
            )}

            {activeTab === 'monitoring' && (
              <RealTimeMonitoringDashboard />
            )}

            {activeTab === 'trade-simulator' && (
              <TradeSimulator />
            )}

            {activeTab === 'monte-carlo' && (
              <MonteCarloMonitor />
            )}

            {activeTab === 'orchestrator' && (
              <TradeOrchestratorMonitor />
            )}

            {activeTab === 'test' && (
              <div>
                <iframe 
                  src="/test" 
                  className="w-full h-screen border-0"
                  title="Test Page"
                />
              </div>
            )}

            {activeTab === 'ai-agent' && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">🤖 AI Agent</h2>
                <p className="text-gray-600">Interface do AI Agent será implementada aqui...</p>
              </div>
            )}

            {activeTab === 'logs' && (
              <SystemLogs />
            )}

            {activeTab === 'settings' && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">⚙️ Configurações</h2>
                <p className="text-gray-600">Configurações do sistema serão implementadas aqui...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
