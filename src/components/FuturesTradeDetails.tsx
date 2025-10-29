'use client';

import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface FuturesPosition {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  breakEvenPrice: number;
  markPrice: number;
  liquidationPrice: number;
  marginRate: number;
  margin: number;
  unrealizedPnl: number;
  pnlPercent: number;
  estimatedFunding: number;
  leverage: number;
  isolated?: boolean;
}

interface FuturesTradeDetailsProps {
  position: FuturesPosition;
  onClosePosition: (symbol: string, isMarket: boolean) => void;
}

const FuturesTradeDetails: React.FC<FuturesTradeDetailsProps> = ({ 
  position, 
  onClosePosition 
}) => {
  const [showCloseModal, setShowCloseModal] = useState(false);

  const handleCloseMarket = () => {
    onClosePosition(position.symbol, true);
    setShowCloseModal(false);
  };

  const handleCloseLimit = () => {
    // TODO: Implementar fechamento com limit order
    alert('Fechamento com limite em breve');
    setShowCloseModal(false);
  };

  return (
    <>
      <div className="bg-gray-900 text-white rounded-lg p-4 mb-3 border-l-4 border-green-500">
        {/* Header com Símbolo e Leverage */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {position.side === 'BUY' ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            <div>
              <p className="font-bold text-lg">{position.symbol}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded">Perp.</span>
                <span className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded">{position.leverage}x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tamanho */}
        <div className="mb-2">
          <p className="text-xs text-gray-400 mb-1">Tamanho</p>
          <p className="text-green-500 font-semibold">
            {position.size} {position.symbol.replace('USDT', '')}
          </p>
        </div>

        {/* Grid de Informações */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Preço de Entrada */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Preço de Entrada</p>
            <p className="font-semibold">{position.entryPrice.toFixed(2)}</p>
          </div>

          {/* Break-even */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Break-even</p>
            <p className="font-semibold">{position.breakEvenPrice.toFixed(2)}</p>
          </div>

          {/* Preço de Referência */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Preço de Ref.</p>
            <p className="font-semibold">{position.markPrice.toFixed(2)}</p>
          </div>

          {/* Preço de Liquidação */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Preço de Liquidação</p>
            <p className="font-semibold text-orange-500">
              {position.liquidationPrice > 0 ? position.liquidationPrice.toFixed(2) : '--'}
            </p>
          </div>

          {/* Taxa de Margem */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Taxa de Margem</p>
            <p className="font-semibold">{position.marginRate.toFixed(2)}%</p>
          </div>

          {/* Margem */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Margem</p>
            <p className="font-semibold">{position.margin.toFixed(2)} USDT</p>
            {position.isolated && (
              <p className="text-xs text-gray-500">(Com Cruzamento)</p>
            )}
          </div>
        </div>

        {/* P&L */}
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">Ganhos e Perdas (ROI %)</p>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-2xl font-bold ${position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {position.unrealizedPnl >= 0 ? '+' : ''}{position.unrealizedPnl.toFixed(2)} USDT
              </p>
              <p className={`text-lg font-semibold ${position.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
              </p>
            </div>
          </div>
        </div>

        {/* Funding */}
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">Financiamento Previsto</p>
          <p className="text-red-500 font-semibold">
            {position.estimatedFunding.toFixed(2)} USDT
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center space-x-2 mt-4">
          <button
            onClick={() => setShowCloseModal(true)}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded font-semibold text-sm transition-all"
          >
            Merc.
          </button>
          <div className="w-px bg-gray-700 h-6"></div>
          <button
            onClick={() => setShowCloseModal(true)}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded font-semibold text-sm transition-all"
          >
            Limite
          </button>
        </div>
      </div>

      {/* Modal de Confirmação */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Fechar Posição</h3>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-sm mb-1">Símbolo</p>
              <p className="text-white font-bold text-lg">{position.symbol}</p>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">P&L Atual</p>
                  <p className={`text-xl font-bold ${position.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {position.unrealizedPnl >= 0 ? '+' : ''}{position.unrealizedPnl.toFixed(2)} USDT
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">ROI %</p>
                  <p className={`text-xl font-bold ${position.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleCloseMarket}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded font-bold transition-all"
              >
                FECHAR MERCADO
              </button>
              <button
                onClick={handleCloseLimit}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded font-bold transition-all"
              >
                LIMITE
              </button>
            </div>

            <button
              onClick={() => setShowCloseModal(false)}
              className="w-full mt-3 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-all"
            >
              CANCELAR
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FuturesTradeDetails;

