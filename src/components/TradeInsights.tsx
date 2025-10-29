'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Target, Lightbulb, AlertTriangle, CheckCircle, Info, BarChart3 } from 'lucide-react';

interface TradeInsight {
  totalTrades: number;
  winRate: number;
  avgPnL: number;
  bestTrade: number;
  worstTrade: number;
  bestWinStreak: number;
  bestLossStreak: number;
  avgDuration: number;
  byAlgorithm: { [key: string]: number };
  bySide: {
    BUY: { winRate: number; count: number };
    SELL: { winRate: number; count: number };
  };
  bySymbol: { [key: string]: { winRate: number; totalPnL: number; count: number } };
}

interface Recommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  impact: string;
}

const TradeInsights: React.FC = () => {
  const [insights, setInsights] = useState<TradeInsight | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analysis/trade-insights');
      if (response.ok) {
        const data = await response.json();
        setInsights(data.data.insights);
        setRecommendations(data.data.recommendations || []);
      }
    } catch (err) {
      console.error('Erro ao buscar insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 border-red-200 text-red-800';
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="w-5 h-5" />;
      case 'medium': return <Info className="w-5 h-5" />;
      case 'low': return <CheckCircle className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center space-x-2">
          <Activity className="w-6 h-6 text-blue-600 animate-pulse" />
          <p className="text-gray-600">Analisando trades...</p>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <p className="text-gray-500">Aguardando dados de trades para análise...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Análise Inteligente de Trades</h2>
            <p className="text-sm text-gray-500">Insights e recomendações baseadas em dados históricos</p>
          </div>
        </div>
        <button
          onClick={fetchInsights}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
        >
          Atualizar
        </button>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-gray-600">Taxa de Acerto</p>
          </div>
          <p className={`text-3xl font-bold ${insights.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
            {insights.winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">{insights.totalTrades} trades analisados</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-600">Melhor Trade</p>
          </div>
          <p className="text-3xl font-bold text-green-600">
            ${insights.bestTrade.toFixed(4)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Pior: ${insights.worstTrade.toFixed(4)}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-5 h-5 text-purple-600" />
            <p className="text-sm text-gray-600">Média P&L</p>
          </div>
          <p className={`text-3xl font-bold ${insights.avgPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {insights.avgPnL >= 0 ? '+' : ''}${insights.avgPnL.toFixed(4)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Por trade</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-5 h-5 text-orange-600" />
            <p className="text-sm text-gray-600">Duração Média</p>
          </div>
          <p className="text-3xl font-bold text-orange-600">
            {insights.avgDuration.toFixed(1)}s
          </p>
          <p className="text-xs text-gray-500 mt-1">Por trade</p>
        </div>
      </div>

      {/* Tabelas de Análise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por Algoritmo */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Performance por Algoritmo</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {Object.entries(insights.byAlgorithm).map(([alg, rate]) => (
                <div key={alg} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">{alg}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${rate >= 60 ? 'bg-green-500' : rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className={`font-bold text-sm w-12 text-right ${rate >= 60 ? 'text-green-600' : rate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Por Símbolo */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Performance por Símbolo</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {Object.entries(insights.bySymbol).map(([sym, data]) => (
                <div key={sym} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-900">{sym}</span>
                    <span className={`font-bold ${data.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {data.totalPnL >= 0 ? '+' : ''}${data.totalPnL.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${data.winRate >= 60 ? 'bg-green-500' : data.winRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${data.winRate}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-10 text-right">{data.winRate.toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{data.count} trades</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recomendações */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center space-x-2">
            <Lightbulb className="w-6 h-6 text-yellow-600" />
            <h3 className="text-lg font-semibold text-gray-900">Recomendações Inteligentes</h3>
          </div>
          <div className="p-6 space-y-4">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`border-l-4 ${getPriorityColor(rec.priority)} p-4 rounded-r-lg`}
              >
                <div className="flex items-start space-x-3">
                  {getPriorityIcon(rec.priority)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold">{rec.title}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(rec.priority)}`}>
                        {rec.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{rec.description}</p>
                    <div className="flex items-center space-x-2 bg-white bg-opacity-50 p-2 rounded">
                      <Target className="w-4 h-4" />
                      <p className="text-sm font-medium">{rec.action}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeInsights;
