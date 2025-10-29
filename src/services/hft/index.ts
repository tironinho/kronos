/**
 * HFT Pipeline - Entry Point
 * 
 * Integra todos os componentes do pipeline HFT + IA
 */

export { tradeAuditor, TradeAuditor } from './trade-auditor';
export { tickIngestion, TickIngestionEngine } from './tick-ingestion';
export { featureStore, MicrostructuralFeatureStore } from './feature-store';
export { regimeDetector, RegimeDetector } from './regime-detection';
export { decisionGates, DecisionGatesValidator } from './decision-gates';
export { autoReporter, AutoReporter } from './auto-reporter';

/**
 * Inicializa pipeline HFT completo
 */
export async function initializeHFTPipeline(): Promise<void> {
  console.log('🚀 Inicializando pipeline HFT + IA...');
  
  // Os componentes são lazy-loaded quando necessário
  console.log('✅ Pipeline HFT inicializado');
}

