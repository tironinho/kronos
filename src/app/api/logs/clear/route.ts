import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Simular limpeza de logs
    return NextResponse.json({
      status: 'success',
      message: 'Logs limpos com sucesso',
      data: {
        cleared_count: 150,
        timestamp: Date.now()
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Erro ao limpar logs',
      error: error.message
    }, { status: 500 });
  }
}
