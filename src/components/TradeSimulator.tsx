'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Zap, Activity, Play, RefreshCw, Clock, Target, Shield, AlertCircle, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  pnl: number;
  pnlPercent: number;
  duration: number;
  algorithm: string;
  status: 'open' | 'closed';
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TradeSimulator: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const fetchTrades = async () => {
    try {
      const response = await fetch(`/api/simulations/trades?page=${pagination.page}&limit=${pagination.limit}`);
      if (response.ok) {
        const data = await response.json();
        setTrades(data.data.trades);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error('Erro ao buscar trades:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/simulations/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
    }
  };

  // Auto-start DESABILITADO - Espera clique no botão
  useEffect(() => {
    // NÃO inicia automaticamente - usuário deve clicar no botão
    console.log('⏸️ Trade Simulator aguardando ação do usuário...');
    
    // CÓDIGO COMENTADO PARA MANUAL START
    /*
    const autoStart = async () => {
      try {
        console.log('🚀 Iniciando Trade Simulator automaticamente...');
        const response = await fetch('/api/simulations/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'],
            initialCapital: 1.84
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Trade Simulator iniciado:', data);
          setIsRunning(true);
          fetchStats();
        } else {
          const errorData = await response.json();
          console.error('❌ Erro ao iniciar simulação:', errorData);
        }
      } catch (err) {
        console.error('❌ Erro ao iniciar automáticamente:', err);
      }
    };
    
    autoStart();
    */
    
  }, []);

  // Buscar trades periodicamente quando running
  useEffect(() => {
    fetchTrades(); // Busca imediata
    fetchStats(); // Stats imediato
    
    if (isRunning) {
      const tradesInterval = setInterval(fetchTrades, 5000);
      const statsInterval = setInterval(fetchStats, 10000);
      
      return () => {
        clearInterval(tradesInterval);
        clearInterval(statsInterval);
      };
    }
  }, [isRunning, pagination.page]);

  const startSimulation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'],
          initialCapital: 1.84
        })
      });

      if (response.ok) {
        setIsRunning(true);
        fetchStats();
      }
    } catch (err) {
      console.error('Erro ao iniciar simulação:', err);
    } finally {
      setLoading(false);
    }
  };

  const stopSimulation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/simulations/stop', {
        method: 'POST'
      });

      if (response.ok) {
        setIsRunning(false);
      }
    } catch (err) {
      console.error('Erro ao parar simulação:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (winRate: number) => {
    if (winRate >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (winRate >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (winRate >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Trade Simulator - Dados Reais</h2>
            <p className="text-sm text-gray-500">Simulação automática com preços da Binance</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          {!isRunning ? (
            <button
              onClick={startSimulation}
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-md font-semibold"
            >
              <Play className="w-5 h-5" />
              <span>Iniciar Simulação</span>
            </button>
          ) : (
            <button
              onClick={stopSimulation}
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 shadow-md font-semibold"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              <span>Parar Simulação</span>
            </button>
          )}
        </div>
      </div>

      {/* Status e Stats */}
      {stats && (
        <div className="space-y-4">
          {/* Cards de Estatísticas */}
          <div className={`rounded-xl border-2 ${getScoreColor(stats.winRate)} p-6`}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-600">Taxa de Acerto</p>
                <p className="text-3xl font-bold">{stats.winRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total de Trades</p>
                <p className="text-3xl font-bold">{stats.totalTrades}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.winningTrades} ✅ | {stats.losingTrades} ❌
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Lucro/Prejuízo Total</p>
                <p className={`text-3xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(4)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.totalPnLPercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Equity Atual</p>
                <p className={`text-2xl font-bold ${(stats.currentEquity || 0) >= (stats.initialEquity || 0) ? 'text-green-600' : 'text-red-600'}`}>
                  ${(stats.currentEquity || 0).toFixed(4)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Inicial: ${(stats.initialEquity || 0).toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Posições Abertas</p>
                <p className="text-3xl font-bold">{stats.activePositions}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Trades Paginada */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Histórico de Trades ({pagination.total})
          </h3>
          
          {/* Paginação */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-sm font-medium">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination({ ...pagination, page: Math.min(pagination.totalPages, pagination.page + 1) })}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {trades.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum trade ainda. Clique em "Iniciar Simulação" para começar.</p>
            </div>
          ) : (
            trades.map((trade, idx) => (
              <div key={trade.id} className={`p-6 border-l-4 ${
                trade.pnl >= 0 ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    {trade.side === 'BUY' ? (
                      <TrendingUp className="w-8 h-8 text-green-600 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="w-8 h-8 text-red-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-bold text-lg">{trade.symbol}</span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                          {trade.side}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {trade.algorithm}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Entrada:</span>
                          <span className="font-semibold ml-1 text-blue-600">${(trade.entryPrice || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Saída:</span>
                          <span className="font-semibold ml-1 text-purple-600">${(trade.exitPrice || trade.entryPrice || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Tempo:</span>
                          <span className="font-semibold ml-1">
                            {Math.floor((trade.duration || 0) / 3600000) > 0 
                              ? `${Math.floor((trade.duration || 0) / 3600000)}h ${Math.floor(((trade.duration || 0) % 3600000) / 60000)}min`
                              : `${Math.floor((trade.duration || 0) / 60000)}min ${Math.floor(((trade.duration || 0) % 60000) / 1000)}s`
                            }
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Qty:</span>
                          <span className="font-semibold ml-1">{(trade.quantity || 0).toFixed(4)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <span className={`font-semibold ml-1 ${trade.status === 'open' ? 'text-yellow-600' : (trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.status === 'open' ? '🟢 Aberto' : (trade.pnl || 0) >= 0 ? '✅ Lucro' : '❌ Prejuízo'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {trade.status === 'open' ? (
                      <div className="bg-yellow-100 px-3 py-2 rounded-lg">
                        <p className="text-sm font-semibold text-yellow-800">Aberto</p>
                        <p className="text-xs text-yellow-600">
                          {new Date(trade.entryTime).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className={`text-3xl font-bold ${(trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(4)}
                        </p>
                        <p className={`text-sm font-semibold ${(trade.pnlPercent || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          ({(trade.pnlPercent || 0) >= 0 ? '+' : ''}{(trade.pnlPercent || 0).toFixed(2)}%)
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(trade.exitTime || trade.entryTime).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TradeSimulator;
