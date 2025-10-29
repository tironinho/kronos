import { initializeSystem } from './advanced-init';
import { info } from '../services/logging';

// Flag para evitar inicialização múltipla
let systemInitialized = false;

// ============================================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================================================

export async function initializeAdvancedSystem(): Promise<void> {
  if (systemInitialized) {
    console.log('⚠️ Sistema avançado já foi inicializado');
    return;
  }

  try {
    console.log('🚀 Inicializando Sistema Kronos-X Engine V2 Avançado...');
    await initializeSystem();
    systemInitialized = true;
    console.log('✅ Sistema avançado inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro na inicialização do sistema avançado:', error);
    throw error;
  }
}

// ============================================================================
// HANDLERS DE PROCESSO
// ============================================================================

// Inicializa sistema quando o módulo é carregado
if (typeof window === 'undefined') { // Apenas no servidor
  initializeAdvancedSystem().catch(console.error);
}

// ============================================================================
// EXPORT
// ============================================================================