'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Clock, TrendingUp, BarChart3, RefreshCw, DollarSign, Target, TrendingDown, Zap, Info, Settings, ChevronLeft, ChevronRight, Play, Square, AlertCircle } from 'lucide-react';

interface MonteCarloConfig {
  num_simulations: number;
  forecast_period_minutes: number;
  confidence_level: number;
  parallel_threads: number;
}

interface MonteCarloPerformance {
  total_simulations_run: number;
  cache_hit_count: number;
  cache_miss_count: number;
  average_simulation_time_ms: number;
  last_update_timestamp: number;
  total_analysis_run: number;
  average_analysis_time_ms: number;
  cache_hit_rate: number;
}

interface MonteCarloStatus {
  status: string;
  config: MonteCarloConfig;
}

interface SimulationResult {
  simulation_id: string;
  symbol: string;
  current_price: number;
  price_change: number;
  price_change_percent: number;
  initial_capital: number;
  num_simulations: number;
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  confidence_intervals: {
    '5%': number;
    '95%': number;
  };
  execution_time_ms: number;
  timestamp: number;
  results?: {
    estimated_profit?: number;
    risk_reward_ratio?: number;
    success_probability?: number;
  };
}

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
}

// Símbolos prioritários (maiores lucros segundo análise)
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 'BNBUSDT'];
const NUM_SIMULATIONS_OPTIONS = [1000, 5000, 10000];

const MonteCarloMonitor: React.FC = () => {
  const [status, setStatus] = useState<MonteCarloStatus | null>(null);
  const [performance, setPerformance] = useState<MonteCarloPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [simulations, setSimulations] = useState<SimulationResult[]>([]);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [numSimulations, setNumSimulations] = useState(5000);
  const [initialCapital, setInitialCapital] = useState(1.84); // Seu saldo real
  const [currentPage, setCurrentPage] = useState(1);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [totalProfit, setTotalProfit] = useState(0);
  const [currentEquity, setCurrentEquity] = useState(1.84);
  const [stopLossTriggered, setStopLossTriggered] = useState(false);

  // Carregar saldo real da Binance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/binance/balance');
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.data.totalBalance) {
            setInitialCapital(data.data.totalBalance);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar saldo:', err);
      }
    };

    fetchBalance();
  }, []);

  // Carregar preços em tempo real
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const promises = SYMBOLS.map(async (symbol) => {
          try {
            const response = await fetch(`/api/binance/ticker/${symbol}`);
            if (response.ok) {
              const data = await response.json();
              return {
                symbol: symbol,
                price: parseFloat(data.data.lastPrice || '0'),
                change24h: parseFloat(data.data.priceChange || '0'),
                changePercent24h: parseFloat(data.data.priceChangePercent || '0')
              };
            }
          } catch (e) {
            // Ignorar erros individuais
          }
          return null;
        });

        const results = await Promise.all(promises);
        setPrices(results.filter(p => p !== null) as PriceData[]);
      } catch (err) {
        console.error('Erro ao carregar preços:', err);
      }
    };

    fetchPrices();
    const priceInterval = setInterval(fetchPrices, 5000); // Atualiza a cada 5 segundos

    return () => clearInterval(priceInterval);
  }, []);

  // Carregar simulações do banco ao iniciar
  useEffect(() => {
    const loadSavedSimulations = async () => {
      try {
        const response = await fetch('/api/monte-carlo/history?limit=50');
        if (response.ok) {
          const data = await response.json();
          if (data.data.simulations && data.data.simulations.length > 0) {
            // Converter dados do banco para formato do componente
            const savedSims = data.data.simulations.map((sim: any) => ({
              simulation_id: sim.simulation_id,
              symbol: sim.symbol,
              current_price: parseFloat(sim.current_price),
              price_change: parseFloat(sim.price_change),
              price_change_percent: parseFloat(sim.price_change_percent),
              initial_capital: parseFloat(sim.initial_capital),
              num_simulations: sim.num_simulations,
              expected_return: parseFloat(sim.expected_return),
              volatility: parseFloat(sim.volatility),
              sharpe_ratio: parseFloat(sim.sharpe_ratio),
              max_drawdown: parseFloat(sim.max_drawdown),
              confidence_intervals: {
                '5%': parseFloat(sim.confidence_lower),
                '95%': parseFloat(sim.confidence_upper)
              },
              execution_time_ms: sim.execution_time_ms,
              timestamp: new Date(sim.timestamp).getTime(),
              results: {
                estimated_profit: sim.estimated_profit ? parseFloat(sim.estimated_profit) : undefined,
                risk_reward_ratio: sim.risk_reward_ratio ? parseFloat(sim.risk_reward_ratio) : undefined,
                success_probability: sim.success_probability ? parseFloat(sim.success_probability) : undefined
              }
            }));
            setSimulations(savedSims);
            console.log(`✅ Carregadas ${savedSims.length} simulações salvas do banco`);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar simulações do banco:', err);
      }
    };

    loadSavedSimulations();
  }, []);

  // Auto-start Monte Carlo ao carregar - DESABILITADO
  useEffect(() => {
    // Auto-start DESABILITADO - Espera clique no botão
    // const timer = setTimeout(() => {
    //   if (!stopLossTriggered) {
    //     setIsAutoRunning(true);
    //     runAllSimulations();
    //     console.log('✅ Monte Carlo iniciado automaticamente em modo auto-run');
    //   }
    // }, 2000); // Aguarda 2s para carregar dados salvos

    // return () => clearTimeout(timer);
    console.log('⏸️ Monte Carlo aguardando ação do usuário...');
  }, [stopLossTriggered]);

  // Calcular lucro total e controlar stop loss
  useEffect(() => {
    const calculateStats = () => {
      let totalProfit = 0;
      simulations.forEach(sim => {
        if (sim.results?.estimated_profit) {
          totalProfit += sim.results.estimated_profit;
        }
      });
      setTotalProfit(totalProfit);
      
      const currentLoss = initialCapital - (initialCapital + totalProfit);
      const lossPercent = (currentLoss / initialCapital) * 100;
      
      if (lossPercent <= -20 && isAutoRunning) {
        setStopLossTriggered(true);
        setIsAutoRunning(false);
        console.log(`🛑 STOP LOSS ACIONADO! Perda: ${lossPercent.toFixed(2)}%`);
      }
      
      setCurrentEquity(initialCapital + totalProfit);
    };
    
    calculateStats();
  }, [simulations, initialCapital, isAutoRunning]);

  // Auto-run simulações em paralelo - SEM LIMITE DE QUANTIDADE
  // ÚNICA RESTRIÇÃO: Stop loss de 20% de perda de capital
  useEffect(() => {
    if (isAutoRunning && !stopLossTriggered) { // SEM LIMITE DE SIMULAÇÕES
      const simulateInterval = async () => {
        if (!stopLossTriggered) {
          await runAllSimulations();
        }
      };
      
      const interval = setInterval(simulateInterval, 30000); // A cada 30 segundos
      return () => clearInterval(interval);
    }
  }, [isAutoRunning, stopLossTriggered]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statusRes, performanceRes] = await Promise.all([
          fetch('/api/monte-carlo/status'),
          fetch('/api/monte-carlo/performance')
        ]);

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setStatus(statusData.data);
        }

        if (performanceRes.ok) {
          const performanceData = await performanceRes.json();
          setPerformance(performanceData.data);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const runSimulation = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      const currentPriceData = prices.find(p => p.symbol === selectedSymbol);
      const currentPrice = currentPriceData?.price || 0;

      const response = await fetch('/api/monte-carlo/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          initial_capital: initialCapital,
          num_simulations: numSimulations
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          const simulationResult: SimulationResult = {
            simulation_id: data.data.simulation_id,
            symbol: data.data.symbol,
            current_price: currentPrice || data.data.current_price || 0,
            price_change: currentPriceData?.change24h || data.data.price_change || 0,
            price_change_percent: currentPriceData?.changePercent24h || data.data.price_change_percent || 0,
            initial_capital: data.data.initial_capital,
            num_simulations: data.data.num_simulations,
            expected_return: data.data.results?.expected_return || data.data.expected_return,
            volatility: data.data.results?.volatility || data.data.volatility,
            sharpe_ratio: data.data.results?.sharpe_ratio || data.data.sharpe_ratio,
            max_drawdown: data.data.results?.max_drawdown || data.data.max_drawdown,
            confidence_intervals: data.data.results?.confidence_intervals || data.data.confidence_intervals,
            execution_time_ms: data.data.execution_time_ms,
            timestamp: data.data.timestamp,
            results: data.data.results
          };
          setSimulations(prev => [simulationResult, ...prev]);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao executar simulação');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const runAllSimulations = async () => {
    setIsRunning(true);
    setError(null);
    
    const newSimulations: SimulationResult[] = [];
    
    for (const symbol of SYMBOLS) {
      try {
        const currentPriceData = prices.find(p => p.symbol === symbol);
        const currentPrice = currentPriceData?.price || 0;

        const response = await fetch('/api/monte-carlo/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: symbol,
            initial_capital: initialCapital,
            num_simulations: numSimulations
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            const simulationResult: SimulationResult = {
              simulation_id: data.data.simulation_id,
              symbol: data.data.symbol,
              current_price: currentPrice || data.data.current_price || 0,
              price_change: currentPriceData?.change24h || data.data.price_change || 0,
              price_change_percent: currentPriceData?.changePercent24h || data.data.price_change_percent || 0,
              initial_capital: data.data.initial_capital,
              num_simulations: data.data.num_simulations,
              expected_return: data.data.results?.expected_return || data.data.expected_return,
              volatility: data.data.results?.volatility || data.data.volatility,
              sharpe_ratio: data.data.results?.sharpe_ratio || data.data.sharpe_ratio,
              max_drawdown: data.data.results?.max_drawdown || data.data.max_drawdown,
              confidence_intervals: data.data.results?.confidence_intervals || data.data.confidence_intervals,
              execution_time_ms: data.data.execution_time_ms,
              timestamp: data.data.timestamp,
              results: data.data.results
            };
            newSimulations.push(simulationResult);
          }
        }
        
        // Pequeno delay entre simulações
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`Erro ao simular ${symbol}:`, err);
      }
    }
    
    setSimulations(prev => [...newSimulations, ...prev]);
    setIsRunning(false);
  };

  const getPriceColor = (percent: number) => {
    if (percent > 0) return 'text-green-600';
    if (percent < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSimulationColor = (sharpe: number) => {
    if (sharpe > 1) return 'border-green-500 bg-green-50';
    if (sharpe > 0.5) return 'border-blue-500 bg-blue-50';
    if (sharpe > 0) return 'border-yellow-500 bg-yellow-50';
    return 'border-red-500 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Carregando Monte Carlo...</span>
      </div>
    );
  }

  if (error && !simulations.length) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Monte Carlo Engine</h2>
            <p className="text-sm text-gray-500">Simulações probabilísticas de trading</p>
          </div>
        </div>

      {/* Lucro Total e Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">Lucro Total Simulado</p>
              <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(4)}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Equity Atual</p>
              <p className="text-3xl font-bold text-blue-700">
                ${currentEquity.toFixed(4)}
              </p>
              <p className="text-xs text-blue-600 mt-1">Inicial: ${initialCapital.toFixed(4)}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-600" />
          </div>
        </div>

        <div className={`bg-gradient-to-br border-2 rounded-xl p-6 ${stopLossTriggered ? 'from-red-50 to-red-100 border-red-300' : 'from-purple-50 to-purple-100 border-purple-300'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium mb-1 ${stopLossTriggered ? 'text-red-700' : 'text-purple-700'}`}>
                Status
              </p>
              <p className={`text-2xl font-bold ${stopLossTriggered ? 'text-red-700' : 'text-purple-700'}`}>
                {stopLossTriggered ? 'STOP ATIVO' : 'ATIVO'}
              </p>
              <p className={`text-xs mt-1 ${stopLossTriggered ? 'text-red-600' : 'text-purple-600'}`}>
                Simulações: {simulations.length}
              </p>
            </div>
            {stopLossTriggered ? (
              <AlertCircle className="w-12 h-12 text-red-600" />
            ) : (
              <Activity className="w-12 h-12 text-purple-600" />
            )}
          </div>
        </div>
      </div>
        
        <div className="flex flex-wrap gap-2">
        <button
          onClick={runSimulation}
          disabled={isRunning}
            className="flex items-center space-x-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-semibold transition-colors"
        >
          {isRunning ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
          <span>{isRunning ? 'Executando...' : 'Executar Simulação'}</span>
        </button>
          
          <button
            onClick={runAllSimulations}
            disabled={isRunning}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-semibold transition-colors"
          >
            {isRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>Simular Todos</span>
          </button>

          <button
            onClick={() => {
              if (stopLossTriggered) {
                setStopLossTriggered(false);
              }
              setIsAutoRunning(!isAutoRunning);
            }}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg shadow-md font-semibold transition-colors ${
              isAutoRunning 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={stopLossTriggered && !isAutoRunning}
          >
            {stopLossTriggered ? (
              <AlertCircle className="w-4 h-4" />
            ) : isAutoRunning ? (
              <Square className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>
              {stopLossTriggered ? 'Resetar Stop Loss' : isAutoRunning ? 'Parar Auto-Run' : 'Iniciar Auto-Run'}
            </span>
          </button>
        </div>
      </div>

      {/* Alerta de Stop Loss */}
      {stopLossTriggered && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <h3 className="font-bold text-red-800">Stop Loss de 20% Acionado!</h3>
              <p className="text-sm text-red-700">
                As simulações foram pausadas para proteger seu capital. Lucro atual: ${totalProfit.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configurações */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-600" />
          <span>Configurações de Simulação</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Símbolo</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {SYMBOLS.map(symbol => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Número de Simulações</label>
            <select
              value={numSimulations}
              onChange={(e) => setNumSimulations(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {NUM_SIMULATIONS_OPTIONS.map(num => (
                <option key={num} value={num}>{num.toLocaleString()}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Capital Inicial (USD)</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Preços em Tempo Real */}
      {prices.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span>Preços em Tempo Real</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {prices.map((price) => (
              <div key={price.symbol} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">{price.symbol}</p>
                <p className="text-lg font-bold text-gray-900">${price.price.toFixed(2)}</p>
                <p className={`text-xs font-semibold ${getPriceColor(price.changePercent24h)}`}>
                  {price.changePercent24h > 0 ? '+' : ''}{price.changePercent24h.toFixed(2)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Simulações */}
      {simulations.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <span>Histórico de Simulações ({simulations.length})</span>
            </h3>
            
            {/* Paginação */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 py-2 text-sm font-medium">
                Página {currentPage} de {Math.ceil(simulations.length / 10)}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(Math.ceil(simulations.length / 10), currentPage + 1))}
                disabled={currentPage >= Math.ceil(simulations.length / 10)}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {simulations
              .slice((currentPage - 1) * 10, currentPage * 10)
              .map((sim, idx) => (
              <div key={sim.simulation_id || idx} className={`p-6 border-l-4 ${getSimulationColor(sim.sharpe_ratio)} hover:bg-gray-50 transition-colors`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-bold text-gray-900">{sim.symbol}</h4>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                          {sim.num_simulations.toLocaleString()} sims
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriceColor(sim.price_change_percent)}`}>
                          {sim.current_price > 0 ? `$${sim.current_price.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-gray-600">Retorno:</span>
                          <span className="font-semibold text-gray-900">{(sim.expected_return * 100).toFixed(2)}%</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <BarChart3 className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-600">Volatilidade:</span>
                          <span className="font-semibold text-gray-900">{(sim.volatility * 100).toFixed(2)}%</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Target className="w-4 h-4 text-yellow-600" />
                          <span className="text-gray-600">Sharpe:</span>
                          <span className="font-semibold text-gray-900">{sim.sharpe_ratio.toFixed(3)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <TrendingDown className="w-4 h-4 text-red-600" />
                          <span className="text-gray-600">Max DD:</span>
                          <span className="font-semibold text-gray-900">{(sim.max_drawdown * 100).toFixed(2)}%</span>
                        </div>
                      </div>
                      
                      {sim.confidence_intervals && (
                        <div className="mt-2 space-y-1">
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                            <div className="flex items-center space-x-1">
                              <Info className="w-3 h-3" />
                              <span className="text-gray-600">CI 5%:</span>
                              <span className="font-semibold text-red-700">{(sim.confidence_intervals['5%'] * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Info className="w-3 h-3" />
                              <span className="text-gray-600">CI 95%:</span>
                              <span className="font-semibold text-green-700">{(sim.confidence_intervals['95%'] * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span className="text-gray-600">Execução:</span>
                              <span className="font-semibold">{sim.execution_time_ms}ms</span>
                            </div>
                          </div>
                          {sim.results && (
                            <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-gray-200">
                              {sim.results.estimated_profit !== undefined && (
                                <div className="flex items-center space-x-1">
                                  <DollarSign className="w-3 h-3 text-green-600" />
                                  <span className="text-gray-600">Lucro Est.:</span>
                                  <span className="font-bold text-green-600">${sim.results.estimated_profit.toLocaleString()}</span>
                                </div>
                              )}
                              {sim.results.risk_reward_ratio !== undefined && (
                                <div className="flex items-center space-x-1">
                                  <Target className="w-3 h-3 text-blue-600" />
                                  <span className="text-gray-600">Risk/Reward:</span>
                                  <span className="font-semibold">{sim.results.risk_reward_ratio.toFixed(2)}</span>
                                </div>
                              )}
                              {sim.results.success_probability !== undefined && (
                                <div className="flex items-center space-x-1">
                                  <Zap className="w-3 h-3 text-purple-600" />
                                  <span className="text-gray-600">Prob. Sucesso:</span>
                                  <span className="font-bold text-purple-600">{(sim.results.success_probability * 100).toFixed(1)}%</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Capital Inicial</p>
                    <p className="text-lg font-bold text-gray-900">${sim.initial_capital.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(sim.timestamp).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas de Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <span>Status do Sistema</span>
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                status?.status === 'running' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {status?.status || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Simulações Totais:</span>
              <span className="text-sm font-semibold">{status?.config.num_simulations || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Período (min):</span>
              <span className="text-sm font-semibold">{status?.config.forecast_period_minutes || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Confiança:</span>
              <span className="text-sm font-semibold">{((status?.config.confidence_level || 0) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Threads:</span>
              <span className="text-sm font-semibold">{status?.config.parallel_threads || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Performance</span>
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Executadas:</span>
              <span className="text-sm font-semibold">{performance?.total_simulations_run || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cache Hit Rate:</span>
                <span className="text-sm font-semibold">{(performance?.cache_hit_rate || 0) * 100}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tempo Médio (ms):</span>
              <span className="text-sm font-semibold">{performance?.average_simulation_time_ms?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cache Hits:</span>
              <span className="text-sm font-semibold">{performance?.cache_hit_count || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cache Misses:</span>
              <span className="text-sm font-semibold">{performance?.cache_miss_count || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Última Atualização:</span>
              <span className="text-sm font-semibold">
                {performance?.last_update_timestamp 
                  ? new Date(performance.last_update_timestamp).toLocaleTimeString('pt-BR')
                  : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && simulations.length === 0 && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">⚠️ {error}</p>
        </div>
      )}
    </div>
  );
};

export default MonteCarloMonitor;
