/**
 * API Route: /api/compliance/status
 * 
 * Endpoint para obter status de conformidade do sistema
 */

import { NextRequest, NextResponse } from 'next/server';
import { complianceMonitor } from '@/services/compliance-monitor';

export async function GET(request: NextRequest) {
  try {
    const report = await complianceMonitor.checkCompliance();

    return NextResponse.json({
      success: true,
      data: {
        timestamp: report.timestamp,
        overallCompliance: report.overallCompliance,
        violations: report.violations.length,
        warnings: report.warnings.length,
        checks: report.checks,
        violationsList: report.violations,
        warningsList: report.warnings
      }
    });
  } catch (error) {
    console.error('❌ Erro ao verificar conformidade:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao verificar conformidade',
      details: (error as Error).message
    }, { status: 500 });
  }
}

