'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, Square, AlertTriangle, Shield, DollarSign, TrendingUp, TrendingDown, 
  RefreshCw, Clock, CheckCircle, XCircle, Zap, Target, Activity, 
  Brain, BarChart3, TrendingUp as TrendingUpIcon, Info, Award, LineChart,
  Gauge, Lock, AlertCircle, Lightbulb, Settings2, Activity as ActivityIcon,
  Eye, EyeOff, Bell, TrendingDown as TrendingDownIcon, Minus, Plus, Calendar
} from 'lucide-react';

interface TradeControlProps {
  isEngineRunning: boolean;
  onToggleEngine: () => void;
}

interface ActiveTrade {
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  timestamp: number;
  algorithm: string;
}

interface TradingMetrics {
  totalTrades: number;
  activeTrades: number;
  totalPnL: number;
  totalPnLPercent: number;
  todayPnL: number;
  winRate: number;
  realTimeWinRate?: number; // ✅ Win Rate em tempo real incluindo trades abertas
  avgTradeDuration: number;
  profitFactor: number;
  sharpeRatio: number;
  currentActivePnL: number;
  winningTrades: number;
  totalPnLIncludingActive?: number; // ✅ P&L Total incluindo trades abertas
  losingTrades: number;
  totalWins: number;
  totalLosses: number;
  // ✅ NOVO: Dados de evolução do equity
  currentEquity: number;
  initialEquity: number;
  equityReturn: number;
  equityEvolution: {
    totalReturn: number;
    totalReturnPercent: number;
    dailyReturn: number;
    dailyReturnPercent: number;
    weeklyReturn: number;
    weeklyReturnPercent: number;
    monthlyReturn: number;
    monthlyReturnPercent: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    volatility: number;
  } | null;
  performanceMetrics: {
    avgWin: number;
    avgLoss: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    bestTrade: number;
    worstTrade: number;
  } | null;
}

interface TechnicalAnalysis {
  symbol: string;
  overallScore: number;
  recommendation: string;
  confidence: number;
  technicalIndicators: {
    rsi: { value: number; signal: string };
    macd: { value: number; signal: string };
    bollingerBands: { position: string; signal: string };
  };
  sentimentAnalysis: {
    newsSentiment: number;
    sentimentLabel: string;
    newsCount: number;
  };
  reasoning: string[];
}

interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  activeAlerts: any[];
  canTrade: boolean;
}

interface PerformanceData {
  strategyName: string;
  winRate: number;
  totalPnL: number;
  sharpeRatio: number;
  maxDrawdown: number;
  confidence: number;
  profitFactor: number;
}

const TradeControl: React.FC<TradeControlProps> = ({ isEngineRunning, onToggleEngine }) => {
  const [tradingEnabled, setTradingEnabled] = useState(false);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [metrics, setMetrics] = useState<TradingMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  // Novos estados para funcionalidades aprimoradas
  const [technicalAnalysis, setTechnicalAnalysis] = useState<Map<string, TechnicalAnalysis>>(new Map());
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [marketOverview, setMarketOverview] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(true);
  const [showTechnicalAnalysis, setShowTechnicalAnalysis] = useState(true);
  const [showRiskAssessment, setShowRiskAssessment] = useState(true);

  useEffect(() => {
    if (!isEngineRunning) return;

    const fetchData = async () => {
      try {
        // Buscar trades ativos
        const tradesRes = await fetch('/api/trades');
        if (tradesRes.ok) {
          const tradesData = await tradesRes.json();
          const trades = tradesData?.data || [];
          setActiveTrades(trades);
          console.log(`✅ Trades ativos: ${trades.length}`);
          
          // Buscar análise técnica para cada trade ativo
          // TODO: Implementar análise técnica integrada
          if (trades.length > 0) {
            const analysisMap = new Map<string, TechnicalAnalysis>();
            // Temporariamente desabilitado para evitar erros
            // for (const trade of trades.slice(0, 3)) {
            //   try {
            //     const analysisRes = await fetch(`/api/enhanced-analysis/technical?action=analyze&symbol=${trade.symbol}`);
            //     if (analysisRes.ok) {
            //       const analysisData = await analysisRes.json();
            //       if (analysisData.success && analysisData.data) {
            //         analysisMap.set(trade.symbol, analysisData.data);
            //       }
            //     }
            //   } catch (err) {
            //     console.warn(`Erro ao buscar análise técnica para ${trade.symbol}:`, err);
            //   }
            // }
            setTechnicalAnalysis(analysisMap);
          }
        }

        // Buscar métricas
        const metricsRes = await fetch('/api/trading/metrics');
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData?.data || {
            totalTrades: 0,
            activeTrades: activeTrades.length,
            totalPnL: 0,
            totalPnLPercent: 0,
            todayPnL: 0,
            winRate: 0,
            avgTradeDuration: 0,
            profitFactor: 0,
            sharpeRatio: 0,
            currentActivePnL: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalWins: 0,
            totalLosses: 0,
            currentEquity: 0,
            initialEquity: 0,
            equityReturn: 0,
            equityEvolution: null,
            performanceMetrics: null
          });
        }

        // Buscar dados de performance
        // TODO: Implementar dados de performance
        // try {
        //   const performanceRes = await fetch('/api/improvements/performance?action=report');
        //   if (performanceRes.ok) {
        //     const performanceDataResult = await performanceRes.json();
        //     if (performanceDataResult.success && performanceDataResult.data?.strategies) {
        //       setPerformanceData(performanceDataResult.data.strategies.map((s: any) => ({
        //         strategyName: s.strategyName,
        //         winRate: s.metrics?.winRate || 0,
        //         totalPnL: s.metrics?.totalPnL || 0,
        //         sharpeRatio: s.metrics?.sharpeRatio || 0,
        //         maxDrawdown: s.metrics?.maxDrawdownPercent || 0,
        //         confidence: s.confidence || 0,
        //         profitFactor: s.metrics?.profitFactor || 0
        //       })));
        //     }
        //   }
        // } catch (err) {
        //   console.warn('Erro ao buscar dados de performance:', err);
        // }

        // Buscar visão geral do mercado
        // TODO: Implementar visão geral do mercado
        // try {
        //   const marketRes = await fetch('/api/enhanced-analysis/technical?action=market-overview');
        //   if (marketRes.ok) {
        //     const marketData = await marketRes.json();
        //     if (marketData.success) {
        //       setMarketOverview(marketData.data);
        //     }
        //   }
        // } catch (err) {
        //   console.warn('Erro ao buscar visão geral do mercado:', err);
        // }

        // Buscar alertas ativos
        // TODO: Implementar sistema de alertas
        // try {
        //   const alertsRes = await fetch('/api/improvements/monitoring?action=alerts');
        //   if (alertsRes.ok) {
        //     const alertsData = await alertsRes.json();
        //     if (alertsData.success && alertsData.data) {
        //       setActiveAlerts(alertsData.data);
        //     }
        //   }
        // } catch (err) {
        //   console.warn('Erro ao buscar alertas:', err);
        // }

      } catch (err) {
        console.error('Erro ao buscar dados:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [isEngineRunning, activeTrades.length]);

  const handleStartTrading = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/trading/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setTradingEnabled(true);
        setConfirmOpen(false);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao iniciar trading');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopTrading = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/trading/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setTradingEnabled(false);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao parar trading');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKillSwitch = async () => {
    if (!confirm('Tem CERTEZA que deseja ativar o Kill Switch? Isso vai fechar TODAS as posições!')) {
      return;
    }

    try {
      const response = await fetch('/api/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setTradingEnabled(false);
        setActiveTrades([]);
        alert('Kill Switch ativado! Todas as posições foram fechadas.');
      }
    } catch (err) {
      console.error('Erro ao ativar kill switch:', err);
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch(recommendation) {
      case 'STRONG_BUY': return 'bg-green-600 text-white';
      case 'BUY': return 'bg-green-500 text-white';
      case 'HOLD': return 'bg-yellow-500 text-white';
      case 'SELL': return 'bg-red-500 text-white';
      case 'STRONG_SELL': return 'bg-red-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getRiskColor = (risk: string) => {
    switch(risk) {
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Principal */}
      <div className={`rounded-xl border-2 p-6 ${
        tradingEnabled 
          ? 'bg-red-50 border-red-500' 
          : 'bg-green-50 border-green-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              tradingEnabled ? 'bg-red-500' : 'bg-green-500'
            }`}>
              {tradingEnabled ? (
                <AlertTriangle className="w-8 h-8 text-white" />
              ) : (
                <Shield className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {tradingEnabled ? '🔴 TRADING ATIVO' : '🟢 TRADING DESATIVADO'}
              </h2>
              <p className="text-sm text-gray-600">
                {tradingEnabled 
                  ? '⚠️ Sistema executando trades REAIS na Binance!'
                  : '✅ Sistema seguro, sem execução de trades'
                }
              </p>
            </div>
          </div>

          {/* Botões de Controle */}
          <div className="flex gap-3">
            {!tradingEnabled ? (
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 shadow-lg font-bold transition-all"
              >
                <Play className="w-5 h-5" />
                <span>INICIAR TRADING</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleStopTrading}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 shadow-lg font-bold transition-all"
                >
                  <Square className="w-5 h-5" />
                  <span>PARAR TRADING</span>
                </button>
                <button
                  onClick={handleKillSwitch}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 shadow-lg font-bold transition-all"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span>KILL SWITCH</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de Confirmação */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md">
            <div className="text-center mb-6">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                ⚠️ ATENÇÃO: TRADES REAIS
              </h3>
              <p className="text-gray-600 mb-4">
                Você está prestes a <strong>ativar o trading real</strong> na Binance.
              </p>
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
              <h4 className="font-bold text-red-800 mb-2">⚠️ AVISO CRÍTICO:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Trades serão executados com dinheiro REAL</li>
                <li>• Você pode PERDER capital</li>
                <li>• Usar 10% do capital por trade</li>
                <li>• Stop Loss: 2% automático</li>
                <li>• Kill Switch disponível 24/7</li>
              </ul>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleStartTrading}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 shadow-lg font-bold transition-all"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>CONFIRMO, ATIVAR TRADING</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-all"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alertas Ativos */}
      {activeAlerts.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Bell className="w-6 h-6 text-orange-600" />
            <h3 className="text-lg font-bold text-orange-900">Alertas Ativos ({activeAlerts.length})</h3>
          </div>
          <div className="space-y-2">
            {activeAlerts.slice(0, 3).map((alert, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-orange-200">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{alert.title}</p>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    alert.severity === 'critical' ? 'bg-red-600 text-white' :
                    alert.severity === 'high' ? 'bg-orange-600 text-white' :
                    alert.severity === 'medium' ? 'bg-yellow-600 text-white' :
                    'bg-blue-600 text-white'
                  }`}>{alert.severity}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas em Tempo Real - CORRIGIDAS */}
      {tradingEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total de Trades */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-7 h-7 text-blue-600" />
              <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold">
                {metrics?.activeTrades || 0} ativas
              </span>
            </div>
            <p className="text-4xl font-bold text-blue-900 mb-1">{metrics?.totalTrades || 0}</p>
            <p className="text-sm font-semibold text-gray-700">Total de Trades</p>
            {metrics && metrics.totalTrades > 0 && (
              <div className="text-xs text-gray-600 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Fechadas:</span>
                  <span className="font-bold text-blue-600">{metrics.totalTrades - (metrics.activeTrades || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Win Rate:</span>
                  <span className="font-bold text-green-600">
                    {(metrics.realTimeWinRate || metrics.winRate || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* P&L Total (apenas trades fechadas) */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-300 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className={`w-7 h-7 ${(metrics?.totalPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                (metrics?.totalPnL || 0) >= 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}>
                {(metrics?.totalPnL || 0) >= 0 ? '+' : ''}{(metrics?.totalPnL || 0).toFixed(2)}
              </span>
            </div>
            <p className={`text-4xl font-bold ${(metrics?.totalPnL || 0) >= 0 ? 'text-green-700' : 'text-red-700'} mb-1`}>
              ${(metrics?.totalPnL || 0).toFixed(2)}
            </p>
            <p className="text-sm font-semibold text-gray-700">P&L Total (Fechadas)</p>
            {metrics && metrics.profitFactor > 0 && (
              <div className="text-xs text-gray-600 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Profit Factor:</span>
                  <span className="font-bold text-purple-600">{metrics.profitFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vitórias:</span>
                  <span className="font-bold text-green-600">${metrics.totalWins?.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Taxa de Acerto */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-300 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-7 h-7 text-purple-600" />
              <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-bold">
                {(metrics?.realTimeWinRate || metrics?.winRate || 0).toFixed(1)}%
              </span>
            </div>
            <p className="text-4xl font-bold text-purple-900 mb-1">
              {metrics?.realTimeWinRate ? metrics.realTimeWinRate.toFixed(1) : metrics?.winRate?.toFixed(1) || 0}%
            </p>
            <p className="text-sm font-semibold text-gray-700">
              Taxa de Acerto {metrics?.realTimeWinRate ? '(Tempo Real)' : '(Fechadas)'}
            </p>
            {metrics && metrics.winningTrades > 0 && (
              <div className="text-xs text-gray-600 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Vitórias:</span>
                  <span className="font-bold text-green-600">{metrics.winningTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span>Derrotas:</span>
                  <span className="font-bold text-red-600">{metrics.losingTrades}</span>
                </div>
                {metrics.sharpeRatio > 0 && (
                  <div className="flex justify-between">
                    <span>Sharpe:</span>
                    <span className="font-bold text-indigo-600">{metrics.sharpeRatio.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* P&L Hoje + Ativas */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className={`w-7 h-7 ${(metrics?.todayPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                (metrics?.todayPnL || 0) >= 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}>
                Hoje
              </span>
            </div>
            <p className={`text-4xl font-bold ${(metrics?.todayPnL || 0) >= 0 ? 'text-green-700' : 'text-red-700'} mb-1`}>
              ${(metrics?.todayPnL || 0).toFixed(2)}
            </p>
            <p className="text-sm font-semibold text-gray-700">P&L Hoje (Fechadas)</p>
            {metrics && metrics.currentActivePnL !== 0 && (
              <div className="text-xs text-gray-600 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Ativas:</span>
                  <span className={`font-bold ${metrics.currentActivePnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${metrics.currentActivePnL.toFixed(2)}
                  </span>
                </div>
                {metrics.avgTradeDuration > 0 && (
                  <div className="flex justify-between">
                    <span>Duração média:</span>
                    <span className="font-bold">{Math.floor(metrics.avgTradeDuration / 60)}min</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visão Geral do Mercado */}
      {marketOverview && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              <h3 className="text-lg font-bold text-gray-900">Visão Geral do Mercado</h3>
            </div>
            <button
              onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
              className="text-gray-500 hover:text-gray-700"
            >
              {showAdvancedMetrics ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {showAdvancedMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <p className="text-xs text-gray-600 mb-1">Sentimento Geral</p>
                <p className="text-2xl font-bold text-indigo-900">
                  {marketOverview.marketSentiment?.overall?.toFixed(2) || '0.00'}
                </p>
                <p className={`text-xs mt-1 ${
                  marketOverview.marketSentiment?.overall > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {marketOverview.marketSentiment?.overall > 0 ? 'Positivo' : 'Negativo'}
                </p>
              </div>
              
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <p className="text-xs text-gray-600 mb-1">Sentimento Crypto</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {marketOverview.marketSentiment?.crypto?.toFixed(2) || '0.00'}
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs text-gray-600 mb-1">Sentimento Tech</p>
                <p className="text-2xl font-bold text-blue-900">
                  {marketOverview.marketSentiment?.tech?.toFixed(2) || '0.00'}
                </p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-xs text-gray-600 mb-1">Medo do Mercado</p>
                <p className={`text-2xl font-bold ${
                  marketOverview.volatility?.marketFear === 'extreme' ? 'text-red-600' :
                  marketOverview.volatility?.marketFear === 'high' ? 'text-orange-600' :
                  marketOverview.volatility?.marketFear === 'moderate' ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {marketOverview.volatility?.marketFear?.toUpperCase() || 'LOW'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance por Estratégia */}
      {performanceData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Award className="w-6 h-6 text-yellow-600" />
              <h3 className="text-lg font-bold text-gray-900">Performance por Estratégia</h3>
            </div>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
              {performanceData.length} Estratégias
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {performanceData.slice(0, 3).map((strategy, idx) => (
              <div key={idx} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-300">
                <div className="flex items-center justify-between mb-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    strategy.confidence > 70 ? 'bg-green-600 text-white' :
                    strategy.confidence > 50 ? 'bg-yellow-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    {strategy.confidence}%
                  </span>
                </div>
                <p className="font-bold text-gray-900 mb-1">{strategy.strategyName}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Win Rate:</span>
                    <span className="font-bold text-purple-600">{strategy.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">P&L Total:</span>
                    <span className={`font-bold ${strategy.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${strategy.totalPnL.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sharpe:</span>
                    <span className="font-bold text-indigo-600">{strategy.sharpeRatio.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trades Ativos com Análise Técnica Integrada */}
      {tradingEnabled && (
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300">
          <div className="p-6 border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="w-6 h-6 text-yellow-600" />
                <h3 className="text-xl font-bold text-gray-900">Trades Ativos ({activeTrades.length})</h3>
                {technicalAnalysis.size > 0 && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">
                    {technicalAnalysis.size} com Análise Técnica
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowTechnicalAnalysis(!showTechnicalAnalysis)}
                className="text-gray-500 hover:text-gray-700"
              >
                {showTechnicalAnalysis ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {activeTrades.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {activeTrades.map((trade, idx) => {
                const priceDiff = trade.currentPrice - trade.entryPrice;
                const priceDiffPercent = (priceDiff / trade.entryPrice) * 100;
                const duration = Math.floor((Date.now() - trade.timestamp) / 1000);
                const analysis = technicalAnalysis.get(trade.symbol);
                
                return (
                  <div key={idx} className={`p-6 border-l-4 ${
                    trade.pnl >= 0 ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                  }`}>
                    {/* Cabeçalho do Trade */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        {trade.side === 'BUY' ? (
                          <TrendingUp className="w-12 h-12 text-green-600" />
                        ) : (
                          <TrendingDown className="w-12 h-12 text-red-600" />
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-bold text-2xl">{trade.symbol}</p>
                            <span className={`px-4 py-1 rounded-full text-sm font-bold ${
                              trade.side === 'BUY' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                            }`}>
                              {trade.side}
                            </span>
                            {analysis && (
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRecommendationColor(analysis.recommendation)}`}>
                                {analysis.recommendation}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 flex items-center space-x-2">
                            <Brain className="w-4 h-4" />
                            <span>{trade.algorithm}</span>
                          </p>
                        </div>
                      </div>
                      
                      {/* P&L Principal */}
                      <div className="text-right">
                        <p className={`text-4xl font-bold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(4)}
                        </p>
                        <p className={`text-xl font-semibold ${trade.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                    
                    {/* Análise Técnica Expandida */}
                    {showTechnicalAnalysis && analysis && (
                      <div className="bg-white rounded-lg p-4 mb-4 border-2 border-purple-300">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <LineChart className="w-5 h-5 text-purple-600" />
                            <h4 className="font-bold text-purple-900">Análise Técnica Avançada</h4>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">Score: </span>
                            <span className={`text-lg font-bold ${
                              analysis.overallScore >= 70 ? 'text-green-600' :
                              analysis.overallScore >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {analysis.overallScore.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Indicadores Técnicos */}
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-700 mb-2">Indicadores Técnicos:</p>
                            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                              <span className="text-sm text-gray-700">RSI:</span>
                              <span className={`font-bold ${analysis.technicalIndicators.rsi.signal === 'overbought' ? 'text-red-600' : 
                                analysis.technicalIndicators.rsi.signal === 'oversold' ? 'text-green-600' : 'text-gray-600'}`}>
                                {analysis.technicalIndicators.rsi.value.toFixed(1)} ({analysis.technicalIndicators.rsi.signal})
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                              <span className="text-sm text-gray-700">MACD:</span>
                              <span className={`font-bold ${analysis.technicalIndicators.macd.signal === 'bullish' ? 'text-green-600' : 'text-red-600'}`}>
                                {analysis.technicalIndicators.macd.signal}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                              <span className="text-sm text-gray-700">Bollinger:</span>
                              <span className={`font-bold ${analysis.technicalIndicators.bollingerBands.signal === 'oversold' ? 'text-green-600' : 
                                analysis.technicalIndicators.bollingerBands.signal === 'overbought' ? 'text-red-600' : 'text-gray-600'}`}>
                                {analysis.technicalIndicators.bollingerBands.signal}
                              </span>
                            </div>
                          </div>
                          
                          {/* Análise de Sentimento */}
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-700 mb-2">Análise de Sentimento:</p>
                            <div className="flex items-center justify-between p-2 bg-indigo-50 rounded">
                              <span className="text-sm text-gray-700">Sentimento:</span>
                              <span className={`font-bold ${
                                analysis.sentimentAnalysis.sentimentLabel === 'very_positive' ? 'text-green-600' :
                                analysis.sentimentAnalysis.sentimentLabel === 'positive' ? 'text-green-500' :
                                analysis.sentimentAnalysis.sentimentLabel === 'negative' ? 'text-red-500' :
                                'text-red-600'
                              }`}>
                                {analysis.sentimentAnalysis.sentimentLabel.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                              <span className="text-sm text-gray-700">Score:</span>
                              <span className="font-bold text-yellow-600">
                                {analysis.sentimentAnalysis.newsSentiment.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                              <span className="text-sm text-gray-700">Notícias:</span>
                              <span className="font-bold text-blue-600">
                                {analysis.sentimentAnalysis.newsCount}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {analysis.reasoning && analysis.reasoning.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            <p className="text-xs font-bold text-gray-700 mb-2">Raciocínio:</p>
                            <div className="space-y-1">
                              {analysis.reasoning.slice(0, 3).map((reason, rIdx) => (
                                <div key={rIdx} className="flex items-start space-x-2 text-xs text-gray-600">
                                  <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Dados Detalhados em Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="bg-white rounded-lg p-3 border-2 border-gray-200">
                        <p className="text-xs text-gray-500 mb-1 font-semibold">Preço de Entrada</p>
                        <p className="font-bold text-lg text-gray-900">${trade.entryPrice.toFixed(2)}</p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3 border-2 border-gray-200">
                        <p className="text-xs text-gray-500 mb-1 font-semibold">Preço Atual</p>
                        <p className={`font-bold text-lg ${priceDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${trade.currentPrice.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {priceDiff >= 0 ? '+' : ''}{priceDiffPercent.toFixed(2)}%
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3 border-2 border-gray-200">
                        <p className="text-xs text-gray-500 mb-1 font-semibold">Quantidade</p>
                        <p className="font-bold text-lg text-gray-900">{trade.quantity.toFixed(4)}</p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3 border-2 border-gray-200">
                        <p className="text-xs text-gray-500 mb-1 font-semibold">Duração</p>
                        <p className="font-bold text-lg text-gray-900">
                          {Math.floor(duration / 60)}m {duration % 60}s
                        </p>
                      </div>
                    </div>
                    
                    {/* Data e Hora */}
                    <div className="mt-3 pt-3 border-t-2 border-gray-200">
                      <div className="flex items-center space-x-2 text-xs text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Aberto em: {new Date(trade.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-semibold">Nenhum trade ativo no momento</p>
              <p className="text-sm text-gray-400 mt-2">Trades aparecerão aqui quando abertos</p>
            </div>
          )}
        </div>
      )}

      {/* Evolução do Equity */}
      {tradingEnabled && metrics && metrics.equityEvolution && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-300 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUpIcon className="w-6 h-6 text-emerald-600" />
              <h3 className="text-lg font-bold text-emerald-900">Evolução do Equity</h3>
            </div>
            <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold">
              ${metrics.currentEquity?.toFixed(2) || '0.00'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Retorno Total */}
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <h4 className="font-bold text-gray-900 mb-2 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Retorno Total</span>
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className={`font-bold ${metrics.equityEvolution.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${metrics.equityEvolution.totalReturn.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Percentual:</span>
                  <span className={`font-bold ${metrics.equityEvolution.totalReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics.equityEvolution.totalReturnPercent >= 0 ? '+' : ''}{metrics.equityEvolution.totalReturnPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Retorno Diário */}
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <h4 className="font-bold text-gray-900 mb-2 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>Retorno Diário</span>
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className={`font-bold ${metrics.equityEvolution.dailyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${metrics.equityEvolution.dailyReturn.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Percentual:</span>
                  <span className={`font-bold ${metrics.equityEvolution.dailyReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics.equityEvolution.dailyReturnPercent >= 0 ? '+' : ''}{metrics.equityEvolution.dailyReturnPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Retorno Semanal */}
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <h4 className="font-bold text-gray-900 mb-2 flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span>Retorno Semanal</span>
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className={`font-bold ${metrics.equityEvolution.weeklyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${metrics.equityEvolution.weeklyReturn.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Percentual:</span>
                  <span className={`font-bold ${metrics.equityEvolution.weeklyReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics.equityEvolution.weeklyReturnPercent >= 0 ? '+' : ''}{metrics.equityEvolution.weeklyReturnPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Retorno Mensal */}
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <h4 className="font-bold text-gray-900 mb-2 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                <span>Retorno Mensal</span>
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className={`font-bold ${metrics.equityEvolution.monthlyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${metrics.equityEvolution.monthlyReturn.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Percentual:</span>
                  <span className={`font-bold ${metrics.equityEvolution.monthlyReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics.equityEvolution.monthlyReturnPercent >= 0 ? '+' : ''}{metrics.equityEvolution.monthlyReturnPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas de Risco */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <h4 className="font-bold text-gray-900 mb-2 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-red-600" />
                <span>Max Drawdown</span>
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className="font-bold text-red-600">
                    ${metrics.equityEvolution.maxDrawdown.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Percentual:</span>
                  <span className="font-bold text-red-600">
                    {metrics.equityEvolution.maxDrawdownPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <h4 className="font-bold text-gray-900 mb-2 flex items-center space-x-2">
                <Target className="w-5 h-5 text-indigo-600" />
                <span>Sharpe Ratio</span>
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className={`font-bold ${
                    metrics.equityEvolution.sharpeRatio >= 1.0 ? 'text-green-600' : 
                    metrics.equityEvolution.sharpeRatio >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.equityEvolution.sharpeRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Qualidade:</span>
                  <span className={`font-bold text-xs ${
                    metrics.equityEvolution.sharpeRatio >= 1.0 ? 'text-green-600' : 
                    metrics.equityEvolution.sharpeRatio >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.equityEvolution.sharpeRatio >= 1.0 ? 'Excelente' : 
                     metrics.equityEvolution.sharpeRatio >= 0.5 ? 'Bom' : 'Ruim'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-emerald-200">
              <h4 className="font-bold text-gray-900 mb-2 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <span>Volatilidade</span>
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className={`font-bold ${
                    metrics.equityEvolution.volatility <= 0.05 ? 'text-green-600' : 
                    metrics.equityEvolution.volatility <= 0.1 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {(metrics.equityEvolution.volatility * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Nível:</span>
                  <span className={`font-bold text-xs ${
                    metrics.equityEvolution.volatility <= 0.05 ? 'text-green-600' : 
                    metrics.equityEvolution.volatility <= 0.1 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.equityEvolution.volatility <= 0.05 ? 'Baixa' : 
                     metrics.equityEvolution.volatility <= 0.1 ? 'Média' : 'Alta'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumo Estatístico Detalhado */}
      {tradingEnabled && metrics && metrics.totalTrades > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-300 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              <h3 className="text-lg font-bold text-indigo-900">Resumo Estatístico Detalhado</h3>
            </div>
            <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold">
              {metrics.totalTrades} Trades
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Estatísticas de Performance */}
            <div className="bg-white rounded-lg p-4 border border-indigo-200">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                <TrendingUpIcon className="w-5 h-5 text-green-600" />
                <span>Performance</span>
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Taxa de Acerto:</span>
                  <span className={`font-bold ${(metrics.realTimeWinRate || metrics.winRate) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {(metrics.realTimeWinRate || metrics.winRate).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Profit Factor:</span>
                  <span className={`font-bold ${metrics.profitFactor >= 1.5 ? 'text-green-600' : metrics.profitFactor >= 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {metrics.profitFactor.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Sharpe Ratio:</span>
                  <span className={`font-bold ${metrics.sharpeRatio >= 1.0 ? 'text-green-600' : metrics.sharpeRatio >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {metrics.sharpeRatio.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Estatísticas de Trades */}
            <div className="bg-white rounded-lg p-4 border border-indigo-200">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <span>Distribuição</span>
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Trades Fechadas:</span>
                  <span className="font-bold text-blue-600">{metrics.totalTrades - metrics.activeTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Trades Ativas:</span>
                  <span className="font-bold text-orange-600">{metrics.activeTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Vitórias:</span>
                  <span className="font-bold text-green-600">{metrics.winningTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Derrotas:</span>
                  <span className="font-bold text-red-600">{metrics.losingTrades}</span>
                </div>
              </div>
            </div>

            {/* Estatísticas Financeiras */}
            <div className="bg-white rounded-lg p-4 border border-indigo-200">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <span>Financeiro</span>
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">P&L Total:</span>
                  <span className={`font-bold ${metrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${metrics.totalPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">P&L Hoje:</span>
                  <span className={`font-bold ${metrics.todayPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${metrics.todayPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">P&L Ativas:</span>
                  <span className={`font-bold ${metrics.currentActivePnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${metrics.currentActivePnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Duração Média:</span>
                  <span className="font-bold text-gray-600">
                    {Math.floor(metrics.avgTradeDuration / 60)}min
                  </span>
                </div>
                {metrics.performanceMetrics && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Melhor Trade:</span>
                      <span className="font-bold text-green-600">
                        ${metrics.performanceMetrics.bestTrade.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Pior Trade:</span>
                      <span className="font-bold text-red-600">
                        ${metrics.performanceMetrics.worstTrade.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Vitórias Consecutivas:</span>
                      <span className="font-bold text-green-600">
                        {metrics.performanceMetrics.maxConsecutiveWins}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Derrotas Consecutivas:</span>
                      <span className="font-bold text-red-600">
                        {metrics.performanceMetrics.maxConsecutiveLosses}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Informações de Configuração */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-300 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
          <Shield className="w-6 h-6 text-blue-600" />
          <span>Proteções de Segurança Ativas</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-2 border-green-300">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-bold text-gray-900">Stop Loss: 2%</p>
              <p className="text-sm text-gray-600">Fechamento automático em perda</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-2 border-green-300">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-bold text-gray-900">Take Profit: 4%</p>
              <p className="text-sm text-gray-600">Fechamento automático em lucro</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-2 border-green-300">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-bold text-gray-900">Max Posição: 10%</p>
              <p className="text-sm text-gray-600">Limite por trade</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border-2 border-orange-300">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <div>
              <p className="font-bold text-gray-900">Kill Switch</p>
              <p className="text-sm text-gray-600">Fechar todas as posições</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-6 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="flex items-center space-x-2">
            <XCircle className="w-6 h-6 text-red-600" />
            <p className="text-red-600 font-semibold">⚠️ {error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeControl;