'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface TrendAnalysis {
  direction: string;
  strength: number;
  confidence: number;
  reversalProbability: number;
  timestamp: string;
}

interface WhaleActivity {
  level: string;
  volumeSpike: number;
  priceImpact: number;
  manipulationSignal: string;
  confidence: number;
  timestamp: string;
}

interface MarketAlert {
  type: string;
  severity: string;
  message: string;
  confidence: number;
  recommendedAction: string;
  timestamp: string;
}

interface MonitoringData {
  symbol: string;
  trendAnalysis: TrendAnalysis;
  whaleActivity: WhaleActivity;
  alerts: MarketAlert[];
  recommendations: {
    trendAction: string;
    whaleAction: string;
    finalAction: string;
  };
}

export default function IntelligentMonitoringDashboard() {
  const [monitoringData, setMonitoringData] = useState<MonitoringData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 10000); // Atualiza a cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      // Simulação de dados - substituir por chamadas reais à API
      const mockData: MonitoringData[] = [
        {
          symbol: 'BTCUSDT',
          trendAnalysis: {
            direction: 'bullish',
            strength: 0.75,
            confidence: 0.82,
            reversalProbability: 0.15,
            timestamp: new Date().toISOString()
          },
          whaleActivity: {
            level: 'medium',
            volumeSpike: 0.45,
            priceImpact: 0.32,
            manipulationSignal: 'none',
            confidence: 0.28,
            timestamp: new Date().toISOString()
          },
          alerts: [],
          recommendations: {
            trendAction: 'HOLD_LONG',
            whaleAction: 'MONITOR',
            finalAction: 'MONITOR'
          }
        },
        {
          symbol: 'ETHUSDT',
          trendAnalysis: {
            direction: 'reversing',
            strength: 0.35,
            confidence: 0.68,
            reversalProbability: 0.85,
            timestamp: new Date().toISOString()
          },
          whaleActivity: {
            level: 'high',
            volumeSpike: 0.78,
            priceImpact: 0.65,
            manipulationSignal: 'suspicious',
            confidence: 0.72,
            timestamp: new Date().toISOString()
          },
          alerts: [
            {
              type: 'trend_reversal',
              severity: 'high',
              message: 'Alta probabilidade de reversão de tendência detectada para ETHUSDT',
              confidence: 0.85,
              recommendedAction: 'Considerar fechamento de posições',
              timestamp: new Date().toISOString()
            }
          ],
          recommendations: {
            trendAction: 'CLOSE_POSITIONS',
            whaleAction: 'CLOSE_PREVENTIVELY',
            finalAction: 'CLOSE_PREVENTIVELY'
          }
        }
      ];

      setMonitoringData(mockData);
      setLoading(false);
    } catch (err) {
      setError('Erro ao carregar dados de monitoramento');
      setLoading(false);
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'bullish': return 'text-green-600';
      case 'bearish': return 'text-red-600';
      case 'reversing': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getWhaleLevelColor = (level: string) => {
    switch (level) {
      case 'extreme': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando monitoramento inteligente...</div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Monitoramento Inteligente</h2>
        <Badge variant="outline" className="text-green-600">
          Sistema Ativo
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="trends">Análise de Tendências</TabsTrigger>
          <TabsTrigger value="whales">Atividade de Baleias</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitoringData.map((data) => (
              <Card key={data.symbol}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {data.symbol}
                    <Badge 
                      className={getWhaleLevelColor(data.whaleActivity.level)}
                      variant="secondary"
                    >
                      {data.whaleActivity.level.toUpperCase()}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Tendência</span>
                      <span className={`text-sm font-semibold ${getTrendColor(data.trendAnalysis.direction)}`}>
                        {data.trendAnalysis.direction.toUpperCase()}
                      </span>
                    </div>
                    <Progress value={data.trendAnalysis.strength * 100} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">
                      Força: {(data.trendAnalysis.strength * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Prob. Reversão</span>
                      <span className="text-sm font-semibold">
                        {(data.trendAnalysis.reversalProbability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={data.trendAnalysis.reversalProbability * 100} 
                      className="h-2" 
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Atividade Baleias</span>
                      <span className="text-sm font-semibold">
                        {(data.whaleActivity.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={data.whaleActivity.confidence * 100} 
                      className="h-2" 
                    />
                  </div>

                  <div className="pt-2 border-t">
                    <div className="text-sm">
                      <span className="font-medium">Ação Recomendada:</span>
                      <Badge variant="outline" className="ml-2">
                        {data.recommendations.finalAction}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {monitoringData.map((data) => (
            <Card key={data.symbol}>
              <CardHeader>
                <CardTitle>{data.symbol} - Análise de Tendência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {data.trendAnalysis.direction.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-500">Direção</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(data.trendAnalysis.strength * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Força</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(data.trendAnalysis.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Confiança</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {(data.trendAnalysis.reversalProbability * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Reversão</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="whales" className="space-y-4">
          {monitoringData.map((data) => (
            <Card key={data.symbol}>
              <CardHeader>
                <CardTitle>{data.symbol} - Atividade de Baleias</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getWhaleLevelColor(data.whaleActivity.level)}`}>
                      {data.whaleActivity.level.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-500">Nível</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(data.whaleActivity.volumeSpike * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Spike Volume</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {(data.whaleActivity.priceImpact * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Impacto Preço</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {data.whaleActivity.manipulationSignal.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-500">Manipulação</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {monitoringData.some(data => data.alerts.length > 0) ? (
            monitoringData.map((data) => 
              data.alerts.map((alert, index) => (
                <Alert key={`${data.symbol}-${index}`} variant={getSeverityColor(alert.severity)}>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{data.symbol}</span>
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <div>{alert.message}</div>
                      <div className="text-sm opacity-75">
                        Confiança: {(alert.confidence * 100).toFixed(1)}% | 
                        Ação: {alert.recommendedAction}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))
            )
          ) : (
            <Alert>
              <AlertDescription>
                Nenhum alerta ativo no momento. Sistema monitorando normalmente.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
