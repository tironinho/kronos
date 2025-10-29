'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PositionSizingConfig {
  basePositionSize: number;
  maxPositionSize: number;
  exceptionalMultiplier: number;
  capitalGrowthFactor: number;
  riskRewardThreshold: number;
  confluenceThreshold: number;
}

interface PerformanceHistory {
  trades: number;
  wins: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface PositionSizingResult {
  positionSize: number;
  positionValue: number;
  isExceptional: boolean;
  sizingReason: string;
  riskAmount: number;
  potentialReward: number;
  riskRewardRatio: number;
}

export default function DynamicPositionSizingDashboard() {
  const [config, setConfig] = useState<PositionSizingConfig | null>(null);
  const [performance, setPerformance] = useState<PerformanceHistory | null>(null);
  const [canIncrease, setCanIncrease] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculationResult, setCalculationResult] = useState<PositionSizingResult | null>(null);

  // Estados para cálculo manual
  const [calculationInputs, setCalculationInputs] = useState({
    symbol: 'BTCUSDT',
    confidence: 85,
    score: 85,
    volatility: 0.05,
    technicalSignals: 5,
    fundamentalScore: 0.8,
    currentPrice: 50000,
    stopLoss: 48000,
    takeProfit: 55000
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Simulação de dados - substituir por chamadas reais à API
      const mockConfig: PositionSizingConfig = {
        basePositionSize: 2.0,
        maxPositionSize: 10.0,
        exceptionalMultiplier: 2.5,
        capitalGrowthFactor: 1.2,
        riskRewardThreshold: 3.0,
        confluenceThreshold: 0.85
      };

      const mockPerformance: PerformanceHistory = {
        trades: 25,
        wins: 18,
        totalReturn: 1250.50,
        maxDrawdown: -150.25,
        sharpeRatio: 1.85
      };

      setConfig(mockConfig);
      setPerformance(mockPerformance);
      setCanIncrease(true);
      setLoading(false);
    } catch (err) {
      setError('Erro ao carregar dados');
      setLoading(false);
    }
  };

  const calculatePositionSize = async () => {
    try {
      const tradeAnalysis = {
        confidence: calculationInputs.confidence / 100,
        score: calculationInputs.score,
        riskRewardRatio: 0,
        confluenceScore: 0,
        volatility: calculationInputs.volatility,
        marketCondition: 'sideways',
        technicalSignals: calculationInputs.technicalSignals,
        fundamentalScore: calculationInputs.fundamentalScore
      };

      // Simulação de cálculo
      const mockResult: PositionSizingResult = {
        positionSize: 3.5,
        positionValue: 1750,
        isExceptional: calculationInputs.confidence > 90,
        sizingReason: `Trade de alta confiança (${calculationInputs.confidence}%, R:R: 2.5)`,
        riskAmount: 350,
        potentialReward: 875,
        riskRewardRatio: 2.5
      };

      setCalculationResult(mockResult);
    } catch (error) {
      setError('Erro ao calcular dimensionamento');
    }
  };

  const updateConfig = async (newConfig: Partial<PositionSizingConfig>) => {
    try {
      if (config) {
        const updatedConfig = { ...config, ...newConfig };
        setConfig(updatedConfig);
        // Aqui você faria a chamada real para a API
        console.log('Configuração atualizada:', updatedConfig);
      }
    } catch (error) {
      setError('Erro ao atualizar configurações');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando dimensionamento dinâmico...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const winRate = performance ? (performance.wins / performance.trades * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dimensionamento Dinâmico de Posições</h2>
        <Badge variant="outline" className="text-green-600">
          Sistema Ativo
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="calculator">Calculadora</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tamanho Base</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{config?.basePositionSize}%</div>
                <p className="text-xs text-gray-500">do capital</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tamanho Máximo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{config?.maxPositionSize}%</div>
                <p className="text-xs text-gray-500">do capital</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Multiplicador Excepcional</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{config?.exceptionalMultiplier}x</div>
                <p className="text-xs text-gray-500">para trades excepcionais</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Threshold R:R</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1:{config?.riskRewardThreshold}</div>
                <p className="text-xs text-gray-500">mínimo</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Status do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pode Aumentar Posições</span>
                  <Badge variant={canIncrease ? "default" : "secondary"}>
                    {canIncrease ? "SIM" : "NÃO"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Threshold Confluência</span>
                  <span className="text-sm">{(config?.confluenceThreshold * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fator Crescimento</span>
                  <span className="text-sm">{config?.capitalGrowthFactor}x</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Win Rate</span>
                  <span className="text-sm font-semibold">{winRate.toFixed(1)}%</span>
                </div>
                <Progress value={winRate} className="h-2" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Retorno Total</span>
                  <span className="text-sm font-semibold text-green-600">
                    ${performance?.totalReturn.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Max Drawdown</span>
                  <span className="text-sm font-semibold text-red-600">
                    ${performance?.maxDrawdown.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sharpe Ratio</span>
                  <span className="text-sm font-semibold">{performance?.sharpeRatio.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Dimensionamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="baseSize">Tamanho Base (%)</Label>
                  <Input
                    id="baseSize"
                    type="number"
                    value={config?.basePositionSize}
                    onChange={(e) => updateConfig({ basePositionSize: parseFloat(e.target.value) })}
                    step="0.1"
                    min="0.1"
                    max="5"
                  />
                </div>
                <div>
                  <Label htmlFor="maxSize">Tamanho Máximo (%)</Label>
                  <Input
                    id="maxSize"
                    type="number"
                    value={config?.maxPositionSize}
                    onChange={(e) => updateConfig({ maxPositionSize: parseFloat(e.target.value) })}
                    step="0.5"
                    min="5"
                    max="20"
                  />
                </div>
                <div>
                  <Label htmlFor="multiplier">Multiplicador Excepcional</Label>
                  <Input
                    id="multiplier"
                    type="number"
                    value={config?.exceptionalMultiplier}
                    onChange={(e) => updateConfig({ exceptionalMultiplier: parseFloat(e.target.value) })}
                    step="0.1"
                    min="1.5"
                    max="5"
                  />
                </div>
                <div>
                  <Label htmlFor="threshold">Threshold R:R</Label>
                  <Input
                    id="threshold"
                    type="number"
                    value={config?.riskRewardThreshold}
                    onChange={(e) => updateConfig({ riskRewardThreshold: parseFloat(e.target.value) })}
                    step="0.5"
                    min="1"
                    max="10"
                  />
                </div>
              </div>
              <Button onClick={() => console.log('Configurações salvas')}>
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas de Trading</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total de Trades</span>
                  <span className="text-lg font-bold">{performance?.trades}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trades Vencedoras</span>
                  <span className="text-lg font-bold text-green-600">{performance?.wins}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trades Perdedoras</span>
                  <span className="text-lg font-bold text-red-600">
                    {(performance?.trades || 0) - (performance?.wins || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Win Rate</span>
                  <span className="text-lg font-bold">{winRate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas Financeiras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Retorno Total</span>
                  <span className="text-lg font-bold text-green-600">
                    ${performance?.totalReturn.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Max Drawdown</span>
                  <span className="text-lg font-bold text-red-600">
                    ${performance?.maxDrawdown.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sharpe Ratio</span>
                  <span className="text-lg font-bold">{performance?.sharpeRatio.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Retorno Médio por Trade</span>
                  <span className="text-lg font-bold">
                    ${((performance?.totalReturn || 0) / (performance?.trades || 1)).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calculator" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Parâmetros da Trade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="symbol">Símbolo</Label>
                  <Input
                    id="symbol"
                    value={calculationInputs.symbol}
                    onChange={(e) => setCalculationInputs({...calculationInputs, symbol: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="confidence">Confiança (%)</Label>
                    <Input
                      id="confidence"
                      type="number"
                      value={calculationInputs.confidence}
                      onChange={(e) => setCalculationInputs({...calculationInputs, confidence: parseInt(e.target.value)})}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="score">Score</Label>
                    <Input
                      id="score"
                      type="number"
                      value={calculationInputs.score}
                      onChange={(e) => setCalculationInputs({...calculationInputs, score: parseInt(e.target.value)})}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="volatility">Volatilidade</Label>
                    <Input
                      id="volatility"
                      type="number"
                      step="0.01"
                      value={calculationInputs.volatility}
                      onChange={(e) => setCalculationInputs({...calculationInputs, volatility: parseFloat(e.target.value)})}
                      min="0"
                      max="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signals">Sinais Técnicos</Label>
                    <Input
                      id="signals"
                      type="number"
                      value={calculationInputs.technicalSignals}
                      onChange={(e) => setCalculationInputs({...calculationInputs, technicalSignals: parseInt(e.target.value)})}
                      min="0"
                      max="10"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price">Preço Atual</Label>
                    <Input
                      id="price"
                      type="number"
                      value={calculationInputs.currentPrice}
                      onChange={(e) => setCalculationInputs({...calculationInputs, currentPrice: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stopLoss">Stop Loss</Label>
                    <Input
                      id="stopLoss"
                      type="number"
                      value={calculationInputs.stopLoss}
                      onChange={(e) => setCalculationInputs({...calculationInputs, stopLoss: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="takeProfit">Take Profit</Label>
                    <Input
                      id="takeProfit"
                      type="number"
                      value={calculationInputs.takeProfit}
                      onChange={(e) => setCalculationInputs({...calculationInputs, takeProfit: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <Button onClick={calculatePositionSize} className="w-full">
                  Calcular Dimensionamento
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resultado do Cálculo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {calculationResult ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Tamanho da Posição</span>
                      <span className="text-lg font-bold">{calculationResult.positionSize.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Valor da Posição</span>
                      <span className="text-lg font-bold">${calculationResult.positionValue.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Trade Excepcional</span>
                      <Badge variant={calculationResult.isExceptional ? "default" : "secondary"}>
                        {calculationResult.isExceptional ? "SIM" : "NÃO"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Risco</span>
                      <span className="text-sm font-semibold text-red-600">
                        ${calculationResult.riskAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Recompensa</span>
                      <span className="text-sm font-semibold text-green-600">
                        ${calculationResult.potentialReward.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">R:R</span>
                      <span className="text-sm font-semibold">{calculationResult.riskRewardRatio.toFixed(2)}</span>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{calculationResult.sizingReason}</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500">
                    Clique em "Calcular Dimensionamento" para ver o resultado
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
