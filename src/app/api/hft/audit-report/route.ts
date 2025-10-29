/**
 * API Endpoint para gerar relatório automático de auditoria
 */

import { NextResponse } from 'next/server';
import { autoReporter } from '@/services/hft/auto-reporter';

export async function GET() {
  try {
    console.log('📊 Gerando relatório automático de auditoria...');
    
    const report = await autoReporter.generateReport();
    const formatted = autoReporter.formatReport(report);

    return NextResponse.json({
      success: true,
      report,
      formatted
    });
  } catch (error: any) {
    console.error('❌ Erro ao gerar relatório:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

