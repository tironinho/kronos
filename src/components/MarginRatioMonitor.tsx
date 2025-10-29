'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, TrendingUp } from 'lucide-react';

interface MarginData {
  accountMarginRatio: number;      // 15.35%
  accountMaintenanceMargin: number; // 0.51 USD
  accountCapital: number;          // 3.33 USD
  positionValue: number;           // 122.88 USD
  realLeverage: number;            // 36.8710x
  marginLevel?: number;
  availableMargin?: number;
  usedMargin?: number;
}

interface MarginRatioMonitorProps {
  onMarginAlert?: (isCritical: boolean) => void;
}

const MarginRatioMonitor: React.FC<MarginRatioMonitorProps> = ({ onMarginAlert }) => {
  const [marginData, setMarginData] = useState<MarginData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarginData();
    const interval = setInterval(fetchMarginData, 5000); // Atualizar a cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  const fetchMarginData = async () => {
    try {
      const res = await fetch('/api/trading/margin-status');
      if (res.ok) {
        const data = await res.json();
        setMarginData(data.data);
        
        // Alertar se margem crítica
        if (data.data.accountMarginRatio < 20) {
          onMarginAlert?.(data.data.accountMarginRatio < 10);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados de margem:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-800 rounded w-1/3"></div>
          <div className="h-8 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!marginData) {
    return null;
  }

  // Determinar status crítico
  const isCritical = marginData.accountMarginRatio < 10;
  const isWarning = marginData.accountMarginRatio < 20 && !isCritical;
  const isHealthy = marginData.accountMarginRatio >= 20;

  const statusColor = isCritical ? 'red' : isWarning ? 'orange' : 'green';

  return (
    <div className="bg-gray-900 rounded-lg p-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center space-x-2">
          <Info className="w-5 h-5" />
          <span>Taxa de Margem</span>
        </h3>
        {isCritical && (
          <div className="flex items-center space-x-2 bg-red-900/30 px-3 py-1 rounded">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-500 font-bold">CRÍTICO</span>
          </div>
        )}
        {isWarning && (
          <div className="flex items-center space-x-2 bg-orange-900/30 px-3 py-1 rounded">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-orange-500 font-bold">ATENÇÃO</span>
          </div>
        )}
      </div>

      {/* Rácio de Margem da Conta */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-800">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-400">Rácio de Margem da Conta</p>
          </div>
          <p className={`text-2xl font-bold ${
            statusColor === 'green' ? 'text-green-500' :
            statusColor === 'orange' ? 'text-orange-500' :
            'text-red-500'
          }`}>
            {marginData.accountMarginRatio.toFixed(2)}%
          </p>
        </div>
        
        {/* Barra de progresso */}
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              statusColor === 'green' ? 'bg-green-500' :
              statusColor === 'orange' ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{ width: `${Math.min(marginData.accountMarginRatio / 100 * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Grid de Informações */}
      <div className="grid grid-cols-2 gap-4">
        {/* Margem de Manutenção */}
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Margem de Manutenção da Conta</p>
          <p className="text-xl font-bold text-white">
            {marginData.accountMaintenanceMargin.toFixed(2)} USD
          </p>
        </div>

        {/* Capital da Conta */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Capital da Conta</p>
              <p className="text-xl font-bold text-white">
                {marginData.accountCapital.toFixed(2)} USD
              </p>
            </div>
            <Info className="w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Valor da Posição */}
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Valor da Posição</p>
          <p className="text-xl font-bold text-white">
            {marginData.positionValue.toFixed(2)} USD
          </p>
        </div>

        {/* Alavancagem Real */}
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Alavancagem Real</p>
          <p className="text-xl font-bold text-orange-500">
            {marginData.realLeverage.toFixed(4)} X
          </p>
        </div>
      </div>

      {/* Avisos */}
      {isCritical && (
        <div className="mt-4 bg-red-900/30 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500 mt-0.5" />
            <div>
              <p className="font-bold text-red-500 mb-2">🚨 MARGEM CRÍTICA</p>
              <p className="text-sm text-gray-300">
                A taxa de margem está abaixo de 10%. Risco de liquidação alto.
                Considerar fechar posições urgentemente.
              </p>
            </div>
          </div>
        </div>
      )}

      {isWarning && (
        <div className="mt-4 bg-orange-900/30 border border-orange-500/50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-orange-500 mt-0.5" />
            <div>
              <p className="font-bold text-orange-500 mb-2">⚠️ ATENÇÃO</p>
              <p className="text-sm text-gray-300">
                A taxa de margem está entre 10-20%. Monitorar de perto.
                Evitar abrir novas posições.
              </p>
            </div>
          </div>
        </div>
      )}

      {isHealthy && (
        <div className="mt-4 bg-green-900/30 border border-green-500/50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <TrendingUp className="w-6 h-6 text-green-500 mt-0.5" />
            <div>
              <p className="font-bold text-green-500 mb-2">✅ SAUDÁVEL</p>
              <p className="text-sm text-gray-300">
                Taxa de margem acima de 20%. Pode abrir novas posições com segurança.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarginRatioMonitor;

