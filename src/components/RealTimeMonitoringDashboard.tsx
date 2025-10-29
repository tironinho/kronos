'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Zap, Shield, Eye, EyeOff, RefreshCw, Settings, Bell, BarChart3,
  DollarSign, Target, AlertCircle, Info, XCircle, Play, Square
} from 'lucide-react';

interface Alert {
  id: string;
  ruleId: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
  triggerCount: number;
}

interface AlertStats {
  total: number;
  resolved: number;
  unresolved: number;
  bySeverity: Record<string, number>;
  activeRules: number;
}

const RealTimeMonitoringDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSystemRunning, setIsSystemRunning] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Atualizar a cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [alertsRes, rulesRes, statsRes] = await Promise.all([
        fetch('/api/alerts?action=list&limit=100'),
        fetch('/api/alerts?action=rules'),
        fetch('/api/alerts?action=stats')
      ]);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.data || []);
      }

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data || null);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados:', err);
      setError(err.message);
    }
  };

  const handleSystemToggle = async () => {
    setLoading(true);
    try {
      const action = isSystemRunning ? 'stop' : 'start';
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        setIsSystemRunning(!isSystemRunning);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve-alert', alertId })
      });

      if (response.ok) {
        setAlerts(alerts.map(alert => 
          alert.id === alertId 
            ? { ...alert, resolved: true, resolvedAt: new Date() }
            : alert
        ));
      }
    } catch (err: any) {
      console.error('Erro ao resolver alerta:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-300';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-300';
      default: return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5" />;
      case 'high': return <AlertCircle className="w-5 h-5" />;
      case 'medium': return <Info className="w-5 h-5" />;
      case 'low': return <CheckCircle className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (!showResolved && alert.resolved) return false;
    if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bell className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Monitoramento em Tempo Real</h1>
            <p className="text-sm text-gray-600">Sistema de alertas inteligentes</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSystemToggle}
            disabled={loading}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-all ${
              isSystemRunning 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-green-600 text-white hover:bg-green-700'
            } disabled:opacity-50`}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isSystemRunning ? (
              <Square className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{isSystemRunning ? 'Parar Sistema' : 'Iniciar Sistema'}</span>
          </button>
          
          <button
            onClick={fetchData}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Status do Sistema */}
      <div className={`rounded-xl border-2 p-6 ${
        isSystemRunning 
          ? 'bg-green-50 border-green-500' 
          : 'bg-red-50 border-red-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isSystemRunning ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {isSystemRunning ? (
                <CheckCircle className="w-6 h-6 text-white" />
              ) : (
                <XCircle className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {isSystemRunning ? '🟢 SISTEMA ATIVO' : '🔴 SISTEMA INATIVO'}
              </h2>
              <p className="text-sm text-gray-600">
                {isSystemRunning 
                  ? 'Monitoramento em tempo real ativo'
                  : 'Sistema de alertas parado'
                }
              </p>
            </div>
          </div>
          
          {stats && (
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{stats.activeRules}</p>
              <p className="text-sm text-gray-600">Regras Ativas</p>
            </div>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <Bell className="w-6 h-6 text-blue-600" />
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                Total
              </span>
            </div>
            <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
            <p className="text-sm text-gray-600">Alertas</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">
                Resolvidos
              </span>
            </div>
            <p className="text-3xl font-bold text-green-900">{stats.resolved}</p>
            <p className="text-sm text-gray-600">Alertas</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-bold">
                Pendentes
              </span>
            </div>
            <p className="text-3xl font-bold text-orange-900">{stats.unresolved}</p>
            <p className="text-sm text-gray-600">Alertas</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <Settings className="w-6 h-6 text-purple-600" />
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-bold">
                Ativas
              </span>
            </div>
            <p className="text-3xl font-bold text-purple-900">{stats.activeRules}</p>
            <p className="text-sm text-gray-600">Regras</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Filtros</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                showResolved 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Mostrar Resolvidos</span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-semibold text-gray-700">Severidade:</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Alertas */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            Alertas ({filteredAlerts.length})
          </h3>
        </div>
        
        {filteredAlerts.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className={`p-6 border-l-4 ${
                alert.resolved 
                  ? 'border-gray-300 bg-gray-50' 
                  : getSeverityColor(alert.severity).split(' ')[2]
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      alert.resolved 
                        ? 'bg-gray-300' 
                        : getSeverityColor(alert.severity).split(' ')[1]
                    }`}>
                      {getSeverityIcon(alert.severity)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-bold text-gray-900">{alert.title}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          alert.resolved 
                            ? 'bg-gray-200 text-gray-700' 
                            : getSeverityColor(alert.severity)
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.resolved && (
                          <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-bold">
                            RESOLVIDO
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-700 mb-3">{alert.message}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(alert.timestamp).toLocaleString('pt-BR')}</span>
                        </div>
                        
                        {alert.resolved && alert.resolvedAt && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>Resolvido: {new Date(alert.resolvedAt).toLocaleString('pt-BR')}</span>
                          </div>
                        )}
                        
                        {alert.metadata?.triggerCount && (
                          <div className="flex items-center space-x-1">
                            <Zap className="w-4 h-4" />
                            <span>Triggers: {alert.metadata.triggerCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!alert.resolved && (
                    <button
                      onClick={() => handleResolveAlert(alert.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                    >
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-semibold">Nenhum alerta encontrado</p>
            <p className="text-sm text-gray-400 mt-2">
              {selectedSeverity !== 'all' || !showResolved 
                ? 'Ajuste os filtros para ver mais alertas'
                : 'Alertas aparecerão aqui quando detectados'
              }
            </p>
          </div>
        )}
      </div>

      {/* Lista de Regras */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            Regras de Alerta ({rules.length})
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {rules.map((rule) => (
            <div key={rule.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-bold text-gray-900">{rule.name}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      rule.enabled 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {rule.enabled ? 'ATIVA' : 'INATIVA'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getSeverityColor(rule.severity)}`}>
                      {rule.severity.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-2">{rule.description}</p>
                  
                  <div className="text-sm text-gray-500 space-y-1">
                    <p><strong>Condição:</strong> {rule.condition}</p>
                    <p><strong>Cooldown:</strong> {rule.cooldownMinutes} minutos</p>
                    <p><strong>Triggers:</strong> {rule.triggerCount}</p>
                    {rule.lastTriggered && (
                      <p><strong>Último Trigger:</strong> {new Date(rule.lastTriggered).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-600">⚠️ {error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeMonitoringDashboard;
