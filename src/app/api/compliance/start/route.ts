/**
 * API Route: /api/compliance/start
 * 
 * Inicia monitoramento de conformidade
 */

import { NextResponse } from 'next/server';
import { complianceMonitor } from '@/services/compliance-monitor';

export async function POST() {
  try {
    complianceMonitor.startMonitoring();
    
    return NextResponse.json({
      success: true,
      message: 'Monitoramento de conformidade iniciado'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro ao iniciar monitoramento',
      details: (error as Error).message
    }, { status: 500 });
  }
}

