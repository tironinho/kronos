'use client';

import { useEffect, useState } from 'react';

interface AnalysisData {
  summary: {
    total: number;
    open: number;
    closed: number;
    totalPnl: number;
    avgPnl: number;
    wins: number;
    losses: number;
    winRate: string;
  };
  buyVsSell: {
    buy: { count: number; pnl: number; winRate: string };
    sell: { count: number; pnl: number; winRate: string };
  };
  symbols: Array<{ symbol: string; count: number; pnl: number; winRate: number }>;
  riskRules: {
    violouSL: number;
    atingiuTP: number;
    fechouNormal: number;
  };
  reasons: Array<{ reason: string; count: number; pnl: number; winRate: number }>;
  worstTrades: Array<any>;
  bestTrades: Array<any>;
  distribution: Record<string, number>;
}

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analysis/trades');
      if (!res.ok) throw new Error('Erro ao buscar análise');
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Carregando análise...</div>;
  if (error) return <div className="p-8 text-red-500">Erro: {error}</div>;
  if (!data) return <div className="p-8">Nenhum dado disponível</div>;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">📊 Análise de Trading</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-100 p-4 rounded">
          <div className="text-sm text-gray-600">Total Trades</div>
          <div className="text-2xl font-bold">{data.summary.total}</div>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <div className="text-sm text-gray-600">Win Rate</div>
          <div className="text-2xl font-bold">{data.summary.winRate}%</div>
        </div>
        <div className="bg-purple-100 p-4 rounded">
          <div className="text-sm text-gray-600">Total P&L</div>
          <div className="text-2xl font-bold">${data.summary.totalPnl.toFixed(4)}</div>
        </div>
        <div className="bg-yellow-100 p-4 rounded">
          <div className="text-sm text-gray-600">P&L Médio</div>
          <div className="text-2xl font-bold">${data.summary.avgPnl.toFixed(4)}</div>
        </div>
      </div>

      {/* BUY vs SELL */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📈 BUY vs SELL</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border p-4 rounded">
            <div className="font-bold text-green-600">BUY</div>
            <div>Count: {data.buyVsSell.buy.count}</div>
            <div>P&L: ${data.buyVsSell.buy.pnl.toFixed(4)}</div>
            <div>Win Rate: {data.buyVsSell.buy.winRate}%</div>
          </div>
          <div className="border p-4 rounded">
            <div className="font-bold text-red-600">SELL</div>
            <div>Count: {data.buyVsSell.sell.count}</div>
            <div>P&L: ${data.buyVsSell.sell.pnl.toFixed(4)}</div>
            <div>Win Rate: {data.buyVsSell.sell.winRate}%</div>
          </div>
        </div>
      </div>

      {/* Top Symbols */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">🪙 Top Símbolos</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Símbolo</th>
              <th className="text-right p-2">Trades</th>
              <th className="text-right p-2">P&L Total</th>
              <th className="text-right p-2">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.symbols.slice(0, 10).map((s) => (
              <tr key={s.symbol} className="border-b">
                <td className="p-2 font-mono">{s.symbol}</td>
                <td className="text-right p-2">{s.count}</td>
                <td className={`text-right p-2 ${s.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${s.pnl.toFixed(4)}
                </td>
                <td className="text-right p-2">{s.winRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Risk Rules */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">🛡️ Verificação de Regras (SL: -2.5%, TP: +5.8%)</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded">
            <div className="text-red-600 text-3xl font-bold">{data.riskRules.violouSL}</div>
            <div className="text-sm">Violou SL</div>
          </div>
          <div className="text-center p-4 border rounded">
            <div className="text-green-600 text-3xl font-bold">{data.riskRules.atingiuTP}</div>
            <div className="text-sm">Atingiu TP</div>
          </div>
          <div className="text-center p-4 border rounded">
            <div className="text-blue-600 text-3xl font-bold">{data.riskRules.fechouNormal}</div>
            <div className="text-sm">Fechou Normal</div>
          </div>
        </div>
      </div>

      {/* Distribution */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📊 Distribuição de P&L</h2>
        <div className="space-y-2">
          {Object.entries(data.distribution).map(([bucket, count]) => (
            <div key={bucket} className="flex items-center">
              <div className="w-40 text-sm">{bucket}</div>
              <div className="flex-1 bg-gray-200 rounded h-6 relative">
                <div 
                  className={`h-6 rounded ${
                    bucket.includes('Perda') ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${(count / data.summary.closed) * 100}%` }}
                />
              </div>
              <div className="w-20 text-right text-sm">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

