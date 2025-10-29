'use client';

import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Activity } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
}

interface TestResponse {
  status: string;
  message: string;
  results: {
    passed: number;
    failed: number;
    warnings: number;
    total: number;
    tests: TestResult[];
  };
  timestamp: string;
}

const TestPage: React.FC = () => {
  const [results, setResults] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test/validate');
      const data: TestResponse = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Erro ao executar testes:', error);
      setResults({
        status: 'error',
        message: 'Erro ao executar testes',
        results: {
          passed: 0,
          failed: 1,
          warnings: 0,
          total: 1,
          tests: [{ name: 'Erro na execução', status: 'fail', details: 'Erro ao conectar com a API de testes' }]
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'fail': return <XCircle className="w-6 h-6 text-red-600" />;
      case 'warning': return <AlertCircle className="w-6 h-6 text-yellow-600" />;
      default: return <AlertCircle className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-50 border-green-200';
      case 'fail': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Testes de Validação</h2>
            <p className="text-sm text-gray-500">Verifique se tudo está funcionando corretamente</p>
          </div>
        </div>
        
        <button
          onClick={runTests}
          disabled={loading}
          className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-md font-semibold"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Activity className="w-5 h-5" />
          )}
          <span>{loading ? 'Executando...' : 'Executar Testes'}</span>
        </button>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Summary */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo dos Testes</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">Passaram</p>
                <p className="text-3xl font-bold text-green-600">{results.results.passed}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">Falharam</p>
                <p className="text-3xl font-bold text-red-600">{results.results.failed}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">Avisos</p>
                <p className="text-3xl font-bold text-yellow-600">{results.results.warnings}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-3xl font-bold text-blue-600">{results.results.total}</p>
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalhes dos Testes</h3>
            <div className="space-y-3">
              {results.results.tests.map((test, idx) => (
                <div key={idx} className={`rounded-lg border-2 ${getStatusColor(test.status)} p-4 flex items-start space-x-4`}>
                  <div className="flex-shrink-0">
                    {getStatusIcon(test.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{test.name}</h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        test.status === 'pass' ? 'bg-green-100 text-green-800' :
                        test.status === 'fail' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {test.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{test.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-center text-sm text-gray-500">
            Executado em: {new Date(results.timestamp).toLocaleString('pt-BR')}
          </div>
        </>
      )}

      {/* Instructions */}
      {!results && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h4 className="text-base font-semibold text-blue-900">Sobre os Testes</h4>
              <p className="text-sm text-blue-700 mt-2">
                Clique em "Executar Testes" para validar se:
              </p>
              <ul className="text-sm text-blue-700 mt-2 list-disc list-inside space-y-1">
                <li>Binance API está conectada</li>
                <li>Trade Simulator Engine está funcionando</li>
                <li>Supabase está configurado</li>
                <li>APIs de simulação estão ativas</li>
                <li>Sistema de auto-start está operacional</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestPage;

