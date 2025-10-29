import { NextRequest, NextResponse } from 'next/server';
import BackupRecoveryService from '@/services/backup-recovery-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const limit = parseInt(searchParams.get('limit') || '50');

    switch (action) {
      case 'configs':
        const configs = BackupRecoveryService.getConfigs();
        return NextResponse.json({
          success: true,
          data: configs
        });

      case 'jobs':
        const jobs = BackupRecoveryService.getJobs(limit);
        return NextResponse.json({
          success: true,
          data: jobs,
          count: jobs.length
        });

      case 'restore-jobs':
        const restoreJobs = BackupRecoveryService.getRestoreJobs(limit);
        return NextResponse.json({
          success: true,
          data: restoreJobs,
          count: restoreJobs.length
        });

      case 'stats':
        const stats = BackupRecoveryService.getBackupStats();
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'restore-stats':
        const restoreStats = BackupRecoveryService.getRestoreStats();
        return NextResponse.json({
          success: true,
          data: restoreStats
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação não reconhecida'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Erro na API de backup:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'add-config':
        const { config } = body;
        BackupRecoveryService.addConfig(config);
        return NextResponse.json({
          success: true,
          message: 'Configuração de backup adicionada com sucesso'
        });

      case 'update-config':
        const { configId, updates } = body;
        BackupRecoveryService.updateConfig(configId, updates);
        return NextResponse.json({
          success: true,
          message: 'Configuração de backup atualizada com sucesso'
        });

      case 'delete-config':
        const { configId: deleteConfigId } = body;
        BackupRecoveryService.deleteConfig(deleteConfigId);
        return NextResponse.json({
          success: true,
          message: 'Configuração de backup removida com sucesso'
        });

      case 'create-backup':
        const { configId: backupConfigId } = body;
        const backupConfig = BackupRecoveryService.getConfigs().find(c => c.id === backupConfigId);
        if (!backupConfig) {
          return NextResponse.json({
            success: false,
            error: 'Configuração não encontrada'
          }, { status: 404 });
        }
        
        const backupJob = await BackupRecoveryService.createBackup(config);
        return NextResponse.json({
          success: true,
          data: backupJob,
          message: 'Backup iniciado com sucesso'
        });

      case 'restore-backup':
        const { backupId, targetDatabase } = body;
        const restoreJob = await BackupRecoveryService.restoreFromBackup(backupId, targetDatabase);
        return NextResponse.json({
          success: true,
          data: restoreJob,
          message: 'Restauração iniciada com sucesso'
        });

      case 'validate-backup':
        const { backupId: validateBackupId } = body;
        const isValid = await BackupRecoveryService.validateBackup(validateBackupId);
        return NextResponse.json({
          success: true,
          data: { valid: isValid }
        });

      case 'start':
        BackupRecoveryService.start();
        return NextResponse.json({
          success: true,
          message: 'Sistema de backup iniciado'
        });

      case 'stop':
        BackupRecoveryService.stop();
        return NextResponse.json({
          success: true,
          message: 'Sistema de backup parado'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação não reconhecida'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Erro na API de backup:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
