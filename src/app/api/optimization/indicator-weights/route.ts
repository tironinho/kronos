/**
 * API Route: /api/optimization/indicator-weights
 * 
 * Endpoint para otimizar pesos de indicadores e aplicar
 */

import { NextRequest, NextResponse } from 'next/server';
import { indicatorWeightOptimizer } from '@/services/indicator-weight-optimizer';
import { predictiveAnalyzerV2 } from '@/services/analyzers/predictive-analyzer-v2';

export async function GET() {
  try {
    // Analisar performance atual
    const performance = await indicatorWeightOptimizer.analyzeIndicatorPerformance();
    
    return NextResponse.json({
      success: true,
      data: {
        performance,
        currentWeights: indicatorWeightOptimizer.getOptimizedWeights()
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro ao analisar performance de indicadores',
      details: (error as Error).message
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Otimizar pesos
    const optimized = await indicatorWeightOptimizer.optimizeWeights();
    
    if (!optimized) {
      return NextResponse.json({
        success: false,
        message: 'Otimização não executada (dados insuficientes ou muito recente)'
      });
    }

    // Aplicar pesos otimizados
    predictiveAnalyzerV2.updateWeights(optimized);
    
    return NextResponse.json({
      success: true,
      message: 'Pesos otimizados e aplicados com sucesso',
      data: {
        optimizedWeights: optimized
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro ao otimizar pesos',
      details: (error as Error).message
    }, { status: 500 });
  }
}

