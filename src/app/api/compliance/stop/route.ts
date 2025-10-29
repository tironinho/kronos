/**
 * API Route: /api/compliance/stop
 * 
 * Para monitoramento de conformidade
 */

import { NextResponse } from 'next/server';
import { complianceMonitor } from '@/services/compliance-monitor';

export async function POST() {
  try {
    complianceMonitor.stopMonitoring();
    
    return NextResponse.json({
      success: true,
      message: 'Monitoramento de conformidade parado'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro ao parar monitoramento',
      details: (error as Error).message
    }, { status: 500 });
  }
}

